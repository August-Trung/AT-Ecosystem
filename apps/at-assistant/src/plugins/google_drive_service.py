from __future__ import annotations

import io
import mimetypes
from pathlib import Path
from typing import Any

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload

from src.plugins.google_auth_service import GoogleAuthService


class GoogleDriveService:
    SCOPES = ["https://www.googleapis.com/auth/drive"]
    FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

    def __init__(self, account_email: str | None = None):
        self.auth_service = GoogleAuthService("drive")
        self.account_email = (account_email or self.auth_service.get_active_account()).strip().lower()
        self.service = None

    def connect(self, account_email: str | None = None, prompt_select: bool = True) -> dict[str, Any]:
        creds, email = self.auth_service.get_credentials(
            scopes=self.SCOPES,
            account_email=account_email or self.account_email,
            prompt_select=prompt_select,
            allow_missing_email=True,
        )
        self.service = build("drive", "v3", credentials=creds)
        profile = self.get_profile()
        user = profile.get("user") or {}
        resolved_email = (user.get("emailAddress") or email or account_email or "").strip().lower()
        if not resolved_email:
            raise RuntimeError("Không xác định được tài khoản Google Drive sau khi đăng nhập.")
        self.auth_service.persist_credentials(
            email=resolved_email,
            creds=creds,
            set_active=True,
        )
        self.account_email = resolved_email
        return {"email": resolved_email, "profile": profile}

    def list_connected_accounts(self) -> list[dict[str, Any]]:
        return self.auth_service.list_accounts()

    def set_active_account(self, email: str) -> dict[str, Any]:
        data = self.auth_service.set_active_account(email)
        self.account_email = data["email"]
        self.service = None
        return data

    def get_active_account(self) -> str:
        return self.auth_service.get_active_account()

    def logout(self, account_email: str | None = None) -> dict[str, Any]:
        target_email = (account_email or self.get_active_account() or self.account_email).strip().lower()
        if not target_email:
            raise ValueError("Hiện chưa có tài khoản Google Drive nào đang được chọn để đăng xuất.")

        removed = self.auth_service.remove_account(target_email)
        self.service = None
        if self.account_email == target_email:
            self.account_email = self.get_active_account()
        return {
            "email": target_email,
            "removed": bool(removed.get("removed")),
            "active_email": self.get_active_account(),
        }

    def get_profile(self) -> dict[str, Any]:
        service = self._get_service()
        return service.about().get(fields="user(displayName,emailAddress),storageQuota").execute()

    def upload_file(self, local_path: str, folder_id: str | None = None) -> dict[str, Any]:
        service = self._get_service()
        path = Path(local_path).resolve()
        mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        media = MediaFileUpload(str(path), resumable=True, mimetype=mime_type)
        metadata: dict[str, Any] = {"name": path.name}
        if folder_id:
            metadata["parents"] = [folder_id]
        created = (
            service.files()
            .create(
                body=metadata,
                media_body=media,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(created)

    def search_folders(
        self,
        query: str,
        *,
        parent_id: str | None = None,
        exact_name: bool = False,
        max_results: int = 20,
    ) -> list[dict[str, Any]]:
        service = self._get_service()
        cleaned = self._clean_folder_name(query)
        filters = ["trashed = false", f"mimeType = '{self.FOLDER_MIME_TYPE}'"]
        if cleaned:
            escaped = self._escape_query_literal(cleaned)
            if exact_name:
                filters.append(f"name = '{escaped}'")
            else:
                filters.append(f"name contains '{escaped}'")
        if parent_id:
            filters.append(f"'{self._escape_query_literal(parent_id)}' in parents")
        response = (
            service.files()
            .list(
                q=" and ".join(filters),
                pageSize=max_results,
                fields="files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents)",
                spaces="drive",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return [self._normalize_file(item) for item in (response.get("files") or [])]

    def search_items(
        self,
        query: str,
        *,
        parent_id: str | None = None,
        exact_name: bool = False,
        item_type: str = "all",
        max_results: int = 20,
    ) -> list[dict[str, Any]]:
        service = self._get_service()
        cleaned = (query or "").strip()
        filters = ["trashed = false"]
        if cleaned:
            escaped = self._escape_query_literal(cleaned)
            if exact_name:
                filters.append(f"name = '{escaped}'")
            else:
                filters.append(f"name contains '{escaped}'")
        if parent_id:
            filters.append(f"'{self._escape_query_literal(parent_id)}' in parents")
        if item_type == "folder":
            filters.append(f"mimeType = '{self.FOLDER_MIME_TYPE}'")
        elif item_type == "file":
            filters.append(f"mimeType != '{self.FOLDER_MIME_TYPE}'")
        response = (
            service.files()
            .list(
                q=" and ".join(filters),
                pageSize=max_results,
                fields="files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents,trashed)",
                spaces="drive",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return [self._normalize_file(item) for item in (response.get("files") or [])]

    def list_root_items(
        self,
        *,
        item_type: str = "all",
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        return self.search_items(
            "",
            parent_id="root",
            item_type=item_type,
            max_results=max_results,
        )

    def list_child_items(
        self,
        parent_id: str,
        *,
        item_type: str = "all",
        max_results: int = 100,
    ) -> list[dict[str, Any]]:
        cleaned_parent = (parent_id or "").strip()
        if not cleaned_parent:
            raise ValueError("Thiếu parent_id để liệt kê nội dung folder.")
        return self.search_items(
            "",
            parent_id=cleaned_parent,
            item_type=item_type,
            max_results=max_results,
        )

    def create_folder(self, name: str, parent_id: str | None = None) -> dict[str, Any]:
        service = self._get_service()
        cleaned = self._clean_folder_name(name)
        if not cleaned:
            raise ValueError("Tên folder Google Drive không hợp lệ.")
        metadata: dict[str, Any] = {
            "name": cleaned,
            "mimeType": self.FOLDER_MIME_TYPE,
        }
        if parent_id:
            metadata["parents"] = [parent_id]
        created = (
            service.files()
            .create(
                body=metadata,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(created)

    def get_item(self, item_id: str) -> dict[str, Any]:
        service = self._get_service()
        detail = (
            service.files()
            .get(
                fileId=item_id,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents,trashed",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(detail)

    def rename_item(self, item_id: str, new_name: str) -> dict[str, Any]:
        service = self._get_service()
        cleaned = (new_name or "").strip().strip("\"'")
        if not cleaned:
            raise ValueError("Tên mới không hợp lệ.")
        updated = (
            service.files()
            .update(
                fileId=item_id,
                body={"name": cleaned},
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents,trashed",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(updated)

    def trash_item(self, item_id: str) -> dict[str, Any]:
        service = self._get_service()
        updated = (
            service.files()
            .update(
                fileId=item_id,
                body={"trashed": True},
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents,trashed",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(updated)

    def move_item(self, item_id: str, target_folder_id: str) -> dict[str, Any]:
        service = self._get_service()
        current = self.get_item(item_id)
        parents = ",".join(current.get("parents") or [])
        updated = (
            service.files()
            .update(
                fileId=item_id,
                addParents=target_folder_id,
                removeParents=parents,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,parents,trashed",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(updated)

    def describe_item(self, item: dict[str, Any]) -> dict[str, Any]:
        item_id = item.get("id") or ""
        path = self.get_item_path(item_id) if item_id else ""
        item_type = "Folder" if item.get("mime_type") == self.FOLDER_MIME_TYPE else "File"
        return {
            **item,
            "path": path,
            "item_type": item_type,
            "display_label": f"{item_type} • {item.get('name') or item_id}",
            "display_path": path or "My Drive",
        }

    def get_item_path(self, item_id: str) -> str:
        segments: list[str] = []
        current_id = (item_id or "").strip()
        visited: set[str] = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            item = self.get_item(current_id)
            name = (item.get("name") or "").strip()
            if name:
                segments.append(name)
            parents = item.get("parents") or []
            current_id = parents[0] if parents else ""
        if not segments:
            return "My Drive"
        return "My Drive/" + "/".join(reversed(segments))

    def resolve_folder(self, folder_ref: str, *, create_if_missing: bool = False) -> dict[str, Any]:
        cleaned = (folder_ref or "").strip()
        if not cleaned:
            raise ValueError("Bạn chưa cung cấp folder Google Drive đích.")

        segments = [self._clean_folder_name(part) for part in cleaned.replace("\\", "/").split("/") if self._clean_folder_name(part)]
        if not segments:
            raise ValueError("Tên folder Google Drive không hợp lệ.")

        if len(segments) == 1:
            return self._resolve_folder_by_name(segments[0], create_if_missing=create_if_missing)

        parent_id: str | None = None
        current: dict[str, Any] | None = None
        for segment in segments:
            matches = self.search_folders(segment, parent_id=parent_id, exact_name=True, max_results=10)
            if not matches:
                if create_if_missing:
                    current = self.create_folder(segment, parent_id=parent_id)
                    parent_id = current["id"]
                    continue
                raise FileNotFoundError(f"Không tìm thấy folder Google Drive '{segment}' trong đường dẫn '{cleaned}'.")
            if len(matches) > 1:
                raise RuntimeError(f"Có nhiều folder Google Drive trùng tên '{segment}' trong đường dẫn '{cleaned}'.")
            current = matches[0]
            parent_id = current["id"]
        if not current:
            raise FileNotFoundError(f"Không tìm thấy folder Google Drive '{cleaned}'.")
        return current

    def _resolve_folder_by_name(self, name: str, *, create_if_missing: bool = False) -> dict[str, Any]:
        matches = self.search_folders(name, exact_name=True, max_results=10)
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise RuntimeError(f"Có nhiều folder Google Drive trùng tên '{name}'. Hãy nói rõ hơn bằng đường dẫn folder.")
        if create_if_missing:
            return self.create_folder(name)
        raise FileNotFoundError(f"Không tìm thấy folder Google Drive '{name}'.")

    def search_files(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        service = self._get_service()
        q = self._build_search_query(query)
        response = (
            service.files()
            .list(
                q=q,
                pageSize=max_results,
                fields="files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime)",
                spaces="drive",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        return [self._normalize_file(item) for item in (response.get("files") or [])]

    def get_share_link(self, file_id: str, make_public: bool = False) -> dict[str, Any]:
        service = self._get_service()
        if make_public:
            service.permissions().create(
                fileId=file_id,
                body={"type": "anyone", "role": "reader"},
                supportsAllDrives=True,
            ).execute()
        detail = (
            service.files()
            .get(
                fileId=file_id,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime",
                supportsAllDrives=True,
            )
            .execute()
        )
        return self._normalize_file(detail)

    def download_file(self, file_id: str, save_to: str) -> dict[str, Any]:
        service = self._get_service()
        target = Path(save_to).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)

        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()

        with target.open("wb") as f:
            f.write(buffer.getvalue())

        detail = (
            service.files()
            .get(
                fileId=file_id,
                fields="id,name,mimeType,webViewLink,webContentLink,size,modifiedTime",
                supportsAllDrives=True,
            )
            .execute()
        )
        normalized = self._normalize_file(detail)
        normalized["saved_to"] = str(target)
        return normalized

    def _get_service(self):
        if self.service is not None:
            return self.service
        creds, email = self.auth_service.get_credentials(
            scopes=self.SCOPES,
            account_email=self.account_email or None,
            allow_missing_email=True,
        )
        self.service = build("drive", "v3", credentials=creds)
        if not email:
            try:
                profile = self.service.about().get(fields="user(emailAddress)").execute()
                user = profile.get("user") or {}
                resolved_email = str(user.get("emailAddress") or "").strip().lower()
                if resolved_email:
                    self.auth_service.persist_credentials(
                        email=resolved_email,
                        creds=creds,
                        set_active=True,
                    )
                    self.account_email = resolved_email
            except Exception:
                pass
        else:
            self.account_email = email
        return self.service

    def _build_search_query(self, query: str) -> str:
        cleaned = (query or "").strip()
        if not cleaned:
            return "trashed = false"
        escaped = self._escape_query_literal(cleaned)
        return f"trashed = false and name contains '{escaped}'"

    def _escape_query_literal(self, value: str) -> str:
        return (value or "").replace("\\", "\\\\").replace("'", "\\'")

    def _clean_folder_name(self, value: str) -> str:
        cleaned = (value or "").strip().strip("\"'")
        cleaned = cleaned.removeprefix("folder ").removeprefix("thư mục ").removeprefix("thu muc ")
        return cleaned.strip()

    def _normalize_file(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": item.get("id", ""),
            "name": item.get("name", ""),
            "mime_type": item.get("mimeType", ""),
            "web_view_link": item.get("webViewLink", ""),
            "web_content_link": item.get("webContentLink", ""),
            "size": item.get("size", ""),
            "modified_time": item.get("modifiedTime", ""),
            "parents": item.get("parents") or [],
            "trashed": bool(item.get("trashed", False)),
        }
