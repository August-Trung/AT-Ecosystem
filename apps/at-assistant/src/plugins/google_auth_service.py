from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from src.core.app_paths import ensure_runtime_dir, resource_path, runtime_root
from src.core import security_utils


class GoogleAuthService:
    def __init__(self, service_key: str) -> None:
        self.service_key = service_key.strip().lower()
        if not self.service_key:
            raise ValueError("service_key cannot be empty")
            
        ensure_runtime_dir("app_settings")
        self.tokens_dir = ensure_runtime_dir("app_settings", f"{self.service_key}_tokens")
        self.active_accounts_path = runtime_root() / "app_settings" / f"{self.service_key}_active_account.json"
        
        # Look for service-specific credentials, fallback to old generic one if not found
        specific_cred = resource_path("app_settings", f"credentials_{self.service_key}.json")
        if specific_cred.exists():
            self.creds_path = specific_cred
        else:
            self.creds_path = resource_path("app_settings", "credentials.json")

    def list_accounts(self) -> list[dict[str, Any]]:
        active = self.get_active_account()
        accounts: list[dict[str, Any]] = []
        pattern = f"{self.service_key}__*.json"
        for token_path in sorted(self.tokens_dir.glob(pattern)):
            email = token_path.stem[len(self.service_key) + 2 :]
            if not email:
                continue
            accounts.append(
                {
                    "email": email,
                    "is_active": email == active,
                    "token_path": str(token_path),
                }
            )
        return accounts

    def get_active_account(self) -> str:
        if not self.active_accounts_path.exists():
            return ""
        try:
            with self.active_accounts_path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception:
            return ""
        return str((payload.get("active_email") or "")).strip().lower()

    def set_active_account(self, email: str) -> dict[str, Any]:
        normalized = (email or "").strip().lower()
        if not normalized:
            raise ValueError(f"Bạn chưa cung cấp email tài khoản Google cho {self.service_key}.")
        token_path = self._token_path(normalized)
        if not token_path.exists():
            raise ValueError(f"Tài khoản '{normalized}' chưa được kết nối cho {self.service_key}.")

        payload: dict[str, Any] = {}
        if self.active_accounts_path.exists():
            try:
                with self.active_accounts_path.open("r", encoding="utf-8") as f:
                    payload = json.load(f)
            except Exception:
                payload = {}

        payload["active_email"] = normalized
        with self.active_accounts_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return {"email": normalized, "service": self.service_key}

    def clear_active_account(self) -> None:
        if self.active_accounts_path.exists():
            self.active_accounts_path.unlink()

    def remove_account(self, email: str) -> dict[str, Any]:
        normalized = (email or "").strip().lower()
        if not normalized:
            raise ValueError(f"Bạn chưa cung cấp email tài khoản Google cho {self.service_key}.")

        token_path = self._token_path(normalized)
        removed = False
        if token_path.exists():
            token_path.unlink()
            removed = True

        active = self.get_active_account()
        if active == normalized:
            remaining = [item for item in self.list_accounts() if item.get("email") != normalized]
            if remaining:
                self.set_active_account(str(remaining[0].get("email") or ""))
            else:
                self.clear_active_account()

        return {"email": normalized, "service": self.service_key, "removed": removed}

    def get_credentials(
        self,
        *,
        scopes: list[str],
        account_email: str | None = None,
        legacy_token_names: Iterable[str] | None = None,
        prompt_select: bool = False,
        allow_missing_email: bool = False,
    ) -> tuple[Credentials, str]:
        candidates: list[Path] = []
        normalized_email = (account_email or "").strip().lower()
        if normalized_email:
            candidates.append(self._token_path(normalized_email))
        else:
            active = self.get_active_account()
            if active:
                candidates.append(self._token_path(active))
        for legacy_name in legacy_token_names or []:
            candidates.append(runtime_root() / "app_settings" / legacy_name)

        creds = None
        loaded_from: Path | None = None
        seen: set[str] = set()
        for candidate in candidates:
            key = str(candidate)
            if key in seen:
                continue
            seen.add(key)
            creds = self._load_credentials(candidate, scopes)
            if creds:
                loaded_from = candidate
                break

        if not creds:
            if not self.creds_path.exists():
                raise FileNotFoundError(f"Không tìm thấy file credentials tại {self.creds_path}. Vui lòng kiểm tra lại cấu hình cho {self.service_key}.")
            # Đọc credentials.json qua security_utils để hỗ trợ cả plaintext lẫn mã hóa
            creds_config = self._load_client_config(self.creds_path)
            if not creds_config:
                raise ValueError(f"File credentials tại {self.creds_path} rỗng hoặc không hợp lệ.")
            flow = InstalledAppFlow.from_client_config(creds_config, scopes)
            run_kwargs = {
                "port": 0,
                "authorization_prompt_message": f"Trình duyệt sẽ mở để bạn đăng nhập tài khoản Google ({self.service_key}).",
                "success_message": f"Đăng nhập {self.service_key.capitalize()} thành công. Bạn có thể quay lại ứng dụng.",
            }
            if prompt_select:
                run_kwargs.update(
                    {
                        "prompt": "select_account consent",
                        "access_type": "offline",
                    }
                )
            try:
                creds = flow.run_local_server(**run_kwargs)
            except TypeError:
                creds = flow.run_local_server(port=0)

        email, email_lookup_error = self._fetch_account_email(creds)
        email = email or normalized_email
        if not email and not allow_missing_email:
            detail = f" Chi tiết: {email_lookup_error}" if email_lookup_error else ""
            raise RuntimeError(f"Không xác định được tài khoản Google sau khi đăng nhập {self.service_key}.{detail}")

        if email:
            self.persist_credentials(email=email, creds=creds, set_active=True)
        elif loaded_from:
            self._save_credentials(loaded_from, creds)
        return creds, email

    def persist_credentials(
        self,
        *,
        email: str,
        creds: Credentials,
        set_active: bool = True,
    ) -> Path:
        normalized = (email or "").strip().lower()
        if not normalized:
            raise ValueError(f"Không có email để lưu token Google {self.service_key}.")
        token_path = self._token_path(normalized)
        self._save_credentials(token_path, creds)
        if set_active:
            self.set_active_account(normalized)
        return token_path

    def _load_credentials(self, token_path: Path, scopes: list[str]) -> Credentials | None:
        if not token_path.exists():
            return None
        try:
            # Giải mã token (hoặc đọc plaintext nếu chưa migrate) rồi load từ dict
            info = security_utils.read_json_file(token_path)
            if not info:
                return None
            creds = Credentials.from_authorized_user_info(info, scopes)
        except Exception:
            return None

        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                self._save_credentials(token_path, creds)
            except Exception:
                return None

        if not creds or not creds.valid:
            return None
        return creds

    def _save_credentials(self, token_path: Path, creds: Credentials) -> None:
        # Ghi token dưới dạng JSON mã hóa thay vì plaintext
        data = json.loads(creds.to_json())
        security_utils.write_json_file(token_path, data)

    def _load_client_config(self, path: Path) -> dict[str, Any]:
        # OAuth client config is bundled into the exe, so keep it as normal JSON.
        # User tokens remain encrypted through security_utils.
        try:
            with path.open("r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

        # Backward compatibility for older encrypted local client config files.
        try:
            data = security_utils.read_json_file(path)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        return {}

    def _fetch_account_email(self, creds: Credentials) -> tuple[str, str]:
        last_error = ""
        if self.service_key == "drive":
            try:
                drive_service = build("drive", "v3", credentials=creds)
                payload = drive_service.about().get(fields="user(emailAddress)").execute()
                user = payload.get("user") or {}
                email = str(user.get("emailAddress") or "").strip().lower()
                if email:
                    return email, ""
            except Exception as exc:
                last_error = self._describe_google_error(exc, "Google Drive")

        if self.service_key == "gmail":
            try:
                gmail_service = build("gmail", "v1", credentials=creds)
                payload = gmail_service.users().getProfile(userId="me").execute()
                email = str(payload.get("emailAddress") or "").strip().lower()
                if email:
                    return email, ""
            except Exception as exc:
                last_error = self._describe_google_error(exc, "Gmail")

        try:
            oauth_service = build("oauth2", "v2", credentials=creds)
            payload = oauth_service.userinfo().get().execute()
            email = str(payload.get("email") or "").strip().lower()
            if email:
                return email, ""
        except Exception as exc:
            if not last_error:
                last_error = self._describe_google_error(exc, "Google OAuth")
        return self._extract_email_from_creds(creds), last_error

    def _extract_email_from_creds(self, creds: Credentials) -> str:
        try:
            raw = creds.to_json()
        except Exception:
            return ""
        match = re.search(r'"account"\s*:\s*"([^"]+)"', raw)
        if match:
            return match.group(1).strip().lower()
        return ""

    def _describe_google_error(self, exc: Exception, service_name: str) -> str:
        if isinstance(exc, HttpError):
            text = str(exc).lower()
            if "accessnotconfigured" in text or "has not been used in project" in text or "is disabled" in text:
                return f"{service_name} API chưa được bật trong Google Cloud project đang dùng."
            if "insufficient authentication scopes" in text:
                return f"Tài khoản chưa được cấp đủ quyền cho {service_name}."
            if exc.resp.status == 401:
                return f"Phiên đăng nhập {service_name} đã hết hạn hoặc không hợp lệ."
            if exc.resp.status == 403:
                return f"Google từ chối truy cập {service_name} cho project hoặc tài khoản hiện tại."
        message = str(exc).strip()
        return message[:300] if message else ""

    def _token_path(self, email: str) -> Path:
        safe_email = re.sub(r"[^a-z0-9._@-]+", "_", (email or "").strip().lower())
        return self.tokens_dir / f"{self.service_key}__{safe_email}.json"
