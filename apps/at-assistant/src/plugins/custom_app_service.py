from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root


ALLOWED_TARGET_TYPES = {"exe", "lnk"}


class CustomAppService:
    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "custom_apps.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def list_apps(self) -> list[dict[str, Any]]:
        return self._sort_apps(self._load()["apps"])

    def get_app(self, app_id: str) -> dict[str, Any] | None:
        app_id = (app_id or "").strip()
        if not app_id:
            return None
        for item in self._load()["apps"]:
            if str(item.get("id") or "").strip() == app_id:
                return deepcopy(item)
        return None

    def find_app(self, ref: str) -> dict[str, Any] | None:
        normalized = self._normalize_alias(ref)
        if not normalized:
            return None
        for item in self._load()["apps"]:
            if str(item.get("id") or "").strip().lower() == normalized:
                return deepcopy(item)
            if normalized in self._record_alias_keys(item):
                return deepcopy(item)
        return None

    def save_app(
        self,
        *,
        alias: str,
        target_path: str,
        display_name: str = "",
        arguments: str = "",
        working_dir: str = "",
        extra_aliases: list[str] | None = None,
    ) -> dict[str, Any]:
        alias_value = self._clean_alias(alias)
        if not alias_value:
            raise ValueError("Thiếu tên gọi ứng dụng.")

        target = self._normalize_target_path(target_path)
        target_type = self._infer_target_type(target)
        if target_type not in ALLOWED_TARGET_TYPES:
            raise ValueError("Chỉ hỗ trợ file .exe hoặc .lnk.")
        if not Path(target).exists():
            raise ValueError("Đường dẫn ứng dụng không tồn tại.")

        payload = self._load()
        apps = payload["apps"]
        alias_keys = self._collect_alias_keys(alias_value, display_name, target, extra_aliases or [])
        now = self._now_iso()
        existing = None

        for item in apps:
            record_keys = self._record_alias_keys(item)
            if alias_keys & record_keys or str(item.get("target_path") or "").strip().lower() == target.lower():
                existing = item
                break

        if existing is None:
            existing = {
                "id": self._next_app_id(apps),
                "created_at": now,
            }
            apps.append(existing)

        existing["alias"] = alias_value
        existing["aliases"] = sorted(alias_keys)
        existing["display_name"] = (display_name or Path(target).stem).strip() or alias_value
        existing["target_path"] = target
        existing["target_type"] = target_type
        existing["arguments"] = (arguments or "").strip()
        existing["working_dir"] = (working_dir or str(Path(target).parent)).strip()
        existing["updated_at"] = now
        payload["apps"] = self._sort_apps(apps)
        self._save(payload)
        return deepcopy(existing)

    def update_app(
        self,
        app_id: str,
        *,
        alias: str | None = None,
        target_path: str | None = None,
        display_name: str | None = None,
        arguments: str | None = None,
        working_dir: str | None = None,
        extra_aliases: list[str] | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        apps = payload["apps"]
        app_id = (app_id or "").strip()
        for item in apps:
            if str(item.get("id") or "").strip() != app_id:
                continue

            alias_value = self._clean_alias(alias if alias is not None else str(item.get("alias") or ""))
            if not alias_value:
                raise ValueError("Thiếu tên gọi ứng dụng.")

            target = self._normalize_target_path(
                target_path if target_path is not None else str(item.get("target_path") or "")
            )
            target_type = self._infer_target_type(target)
            if target_type not in ALLOWED_TARGET_TYPES:
                raise ValueError("Chỉ hỗ trợ file .exe hoặc .lnk.")
            if not Path(target).exists():
                raise ValueError("Đường dẫn ứng dụng không tồn tại.")

            display = (display_name if display_name is not None else str(item.get("display_name") or "")).strip()
            alias_keys = self._collect_alias_keys(alias_value, display, target, extra_aliases or list(item.get("aliases") or []))
            item["alias"] = alias_value
            item["aliases"] = sorted(alias_keys)
            item["display_name"] = display or Path(target).stem or alias_value
            item["target_path"] = target
            item["target_type"] = target_type
            item["arguments"] = (arguments if arguments is not None else str(item.get("arguments") or "")).strip()
            item["working_dir"] = (
                working_dir if working_dir is not None else str(item.get("working_dir") or Path(target).parent)
            ).strip()
            item["updated_at"] = self._now_iso()
            payload["apps"] = self._sort_apps(apps)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy ứng dụng đã lưu để cập nhật.")

    def delete_app(self, ref: str) -> dict[str, Any]:
        payload = self._load()
        apps = payload["apps"]
        normalized = self._normalize_alias(ref)
        for index, item in enumerate(apps):
            if str(item.get("id") or "").strip().lower() == normalized or normalized in self._record_alias_keys(item):
                deleted = apps.pop(index)
                payload["apps"] = self._sort_apps(apps)
                self._save(payload)
                return deepcopy(deleted)
        raise FileNotFoundError("Không tìm thấy ứng dụng đã lưu để xóa.")

    def validate_target(self, record: dict[str, Any]) -> bool:
        target = str((record or {}).get("target_path") or "").strip()
        if not target:
            return False
        try:
            path = Path(target)
        except Exception:
            return False
        return path.exists() and self._infer_target_type(str(path)) in ALLOWED_TARGET_TYPES

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"apps": []}
        with self.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        raw_apps = data.get("apps")
        if not isinstance(raw_apps, list):
            raw_apps = []
        apps: list[dict[str, Any]] = []
        for item in raw_apps:
            if not isinstance(item, dict):
                continue
            alias = self._clean_alias(item.get("alias") or "")
            target_path = str(item.get("target_path") or "").strip()
            if not alias or not target_path:
                continue
            aliases = item.get("aliases")
            if not isinstance(aliases, list):
                aliases = []
            cleaned_aliases = self._collect_alias_keys(alias, item.get("display_name") or "", target_path, aliases)
            apps.append(
                {
                    "id": str(item.get("id") or "").strip() or self._next_app_id(apps),
                    "alias": alias,
                    "aliases": sorted(cleaned_aliases),
                    "display_name": str(item.get("display_name") or "").strip() or Path(target_path).stem or alias,
                    "target_path": target_path,
                    "target_type": self._infer_target_type(target_path),
                    "arguments": str(item.get("arguments") or "").strip(),
                    "working_dir": str(item.get("working_dir") or Path(target_path).parent).strip(),
                    "created_at": str(item.get("created_at") or "").strip(),
                    "updated_at": str(item.get("updated_at") or "").strip(),
                }
            )
        return {"apps": self._sort_apps(apps)}

    def _save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _sort_apps(self, apps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            apps,
            key=lambda item: (
                str(item.get("alias") or "").lower(),
                str(item.get("display_name") or "").lower(),
                str(item.get("id") or ""),
            ),
        )

    def _record_alias_keys(self, item: dict[str, Any]) -> set[str]:
        aliases = item.get("aliases")
        keys: set[str] = set()
        if isinstance(aliases, list):
            keys.update(self._normalize_alias(alias) for alias in aliases if self._normalize_alias(alias))
        alias = self._normalize_alias(item.get("alias") or "")
        if alias:
            keys.add(alias)
        return keys

    def _collect_alias_keys(
        self,
        alias: str,
        display_name: str,
        target_path: str,
        extra_aliases: list[str],
    ) -> set[str]:
        keys: set[str] = set()
        for value in [alias, display_name, Path(target_path).stem, *extra_aliases]:
            normalized = self._normalize_alias(value)
            if normalized:
                keys.add(normalized)
        keys.add(self._normalize_alias(alias))
        return keys

    def _clean_alias(self, value: str) -> str:
        return " ".join(str(value or "").strip().split())

    def _normalize_alias(self, value: str) -> str:
        cleaned = self._clean_alias(value).lower()
        cleaned = re.sub(r"[\s\-_]+", " ", cleaned)
        return cleaned.strip()

    def _normalize_target_path(self, target_path: str) -> str:
        target = str(target_path or "").strip().strip('"').strip("'")
        if not target:
            raise ValueError("Thiếu đường dẫn ứng dụng.")
        path = Path(target).expanduser()
        return str(path.resolve()) if path.exists() else str(path)

    def _infer_target_type(self, target_path: str) -> str:
        suffix = Path(target_path).suffix.lower().lstrip(".")
        if suffix in ALLOWED_TARGET_TYPES:
            return suffix
        return ""

    def _next_app_id(self, apps: list[dict[str, Any]]) -> str:
        prefix = datetime.now().strftime("app_%Y%m%d_")
        used: set[int] = set()
        for item in apps:
            raw_id = str(item.get("id") or "")
            if not raw_id.startswith(prefix):
                continue
            suffix = raw_id.removeprefix(prefix)
            if suffix.isdigit():
                used.add(int(suffix))
        next_num = 1
        while next_num in used:
            next_num += 1
        return f"{prefix}{next_num:03d}"

    def _now_iso(self) -> str:
        return datetime.now().isoformat(timespec="seconds")
