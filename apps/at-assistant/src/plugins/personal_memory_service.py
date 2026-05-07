from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root


VN_TZ = timezone(timedelta(hours=7))


class PersonalMemoryService:
    KEY_ALIASES = {
        "name": "profile.name",
        "ten": "profile.name",
        "profile.name": "profile.name",
        "timezone": "profile.timezone",
        "mui_gio": "profile.timezone",
        "múi_giờ": "profile.timezone",
        "profile.timezone": "profile.timezone",
        "job": "profile.job",
        "cong_viec": "profile.job",
        "công_việc": "profile.job",
        "profile.job": "profile.job",
        "frequent_folders": "profile.frequent_folders",
        "thu_muc_hay_dung": "profile.frequent_folders",
        "thư_mục_hay_dùng": "profile.frequent_folders",
        "profile.frequent_folders": "profile.frequent_folders",
        "preferred_apps": "profile.preferred_apps",
        "app_hay_dung": "profile.preferred_apps",
        "ứng_dụng_hay_dùng": "profile.preferred_apps",
        "ung_dung_hay_dung": "profile.preferred_apps",
        "profile.preferred_apps": "profile.preferred_apps",
        "favorite_prompt_style": "profile.favorite_prompt_style",
        "mau_cau_ua_thich": "profile.favorite_prompt_style",
        "mẫu_câu_ưa_thích": "profile.favorite_prompt_style",
        "profile.favorite_prompt_style": "profile.favorite_prompt_style",
        "gmail_default_account": "preferences.gmail_default_account",
        "tai_khoan_gmail_mac_dinh": "preferences.gmail_default_account",
        "tài_khoản_gmail_mặc_định": "preferences.gmail_default_account",
        "preferences.gmail_default_account": "preferences.gmail_default_account",
        "favorite_report_folder": "preferences.favorite_report_folder",
        "folder_bao_cao_yeu_thich": "preferences.favorite_report_folder",
        "thu_muc_bao_cao_yeu_thich": "preferences.favorite_report_folder",
        "thư_mục_báo_cáo_yêu_thích": "preferences.favorite_report_folder",
        "preferences.favorite_report_folder": "preferences.favorite_report_folder",
        "open_file_app": "preferences.open_file_app",
        "mo_file_bang": "preferences.open_file_app",
        "mở_file_bằng": "preferences.open_file_app",
        "preferences.open_file_app": "preferences.open_file_app",
    }

    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "personal_memory.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def view_memory(self) -> dict[str, Any]:
        return self._load()

    def set_value(self, key: str, value: Any, *, source: str = "chat") -> dict[str, Any]:
        normalized_key = self._normalize_key(key)
        if not normalized_key:
            raise ValueError("Không nhận ra key memory cần lưu.")

        payload = self._load()
        target = self._get_parent(payload, normalized_key, create=True)
        leaf = normalized_key.split(".")[-1]
        target[leaf] = value
        payload["updated_at"] = self._now_iso()
        self._append_history(payload, action="set", key=normalized_key, value=value, source=source)
        self._save(payload)
        return {"key": normalized_key, "value": value}

    def delete_key(self, key: str, *, source: str = "chat") -> dict[str, Any]:
        normalized_key = self._normalize_key(key)
        if not normalized_key:
            raise ValueError("Không nhận ra key memory cần xóa.")

        payload = self._load()
        target = self._get_parent(payload, normalized_key, create=False)
        leaf = normalized_key.split(".")[-1]
        if target is None or leaf not in target:
            raise FileNotFoundError(f"Không tìm thấy key '{normalized_key}'.")

        deleted_value = target.pop(leaf)
        payload["updated_at"] = self._now_iso()
        self._append_history(payload, action="delete", key=normalized_key, value=deleted_value, source=source)
        self._save(payload)
        return {"key": normalized_key, "deleted_value": deleted_value}

    def clear_history(self) -> dict[str, Any]:
        payload = self._load()
        cleared_history = len(payload.get("history") or [])
        cleared_recent = len(payload.get("recent_actions") or [])
        payload["history"] = []
        payload["recent_actions"] = []
        payload["updated_at"] = self._now_iso()
        self._save(payload)
        return {
            "history_cleared": cleared_history,
            "recent_actions_cleared": cleared_recent,
        }

    def set_entity(
        self,
        alias: str,
        value: Any,
        *,
        kind: str = "generic",
        notes: str = "",
        source: str = "chat",
    ) -> dict[str, Any]:
        normalized_alias = self._normalize_entity_alias(alias)
        if not normalized_alias:
            raise ValueError("Không nhận ra entity alias cần lưu.")

        payload = self._load()
        entities = payload.setdefault("entities", {})
        entities[normalized_alias] = {
            "alias": alias.strip(),
            "value": value,
            "kind": (kind or "generic").strip().lower(),
            "notes": (notes or "").strip(),
            "updated_at": self._now_iso(),
        }
        payload["updated_at"] = self._now_iso()
        self._append_history(
            payload,
            action="set_entity",
            key=f"entities.{normalized_alias}",
            value=entities[normalized_alias],
            source=source,
        )
        self._save(payload)
        return entities[normalized_alias]

    def get_entity(self, alias: str, default: Any = None) -> Any:
        normalized_alias = self._normalize_entity_alias(alias)
        if not normalized_alias:
            return default
        payload = self._load()
        entities = payload.get("entities") or {}
        return entities.get(normalized_alias, default)

    def list_entities(self, *, kind: str = "") -> list[dict[str, Any]]:
        payload = self._load()
        entities = payload.get("entities") or {}
        expected_kind = (kind or "").strip().lower()
        results: list[dict[str, Any]] = []
        for normalized_alias in sorted(entities.keys()):
            item = entities.get(normalized_alias)
            if not isinstance(item, dict):
                continue
            if expected_kind and str(item.get("kind") or "").strip().lower() != expected_kind:
                continue
            results.append(item)
        return results

    def delete_entity(self, alias: str, *, source: str = "chat") -> dict[str, Any]:
        normalized_alias = self._normalize_entity_alias(alias)
        if not normalized_alias:
            raise ValueError("Không nhận ra entity alias cần xóa.")

        payload = self._load()
        entities = payload.get("entities") or {}
        entity = entities.pop(normalized_alias, None)
        if entity is None:
            raise FileNotFoundError(f"Không tìm thấy entity '{alias}'.")

        payload["updated_at"] = self._now_iso()
        self._append_history(
            payload,
            action="delete_entity",
            key=f"entities.{normalized_alias}",
            value=entity,
            source=source,
        )
        self._save(payload)
        return entity

    def add_pinned_knowledge(
        self,
        title: str,
        content: str,
        *,
        tags: list[str] | None = None,
        source: str = "chat",
    ) -> dict[str, Any]:
        normalized_title = self._normalize_pinned_title(title)
        if not normalized_title:
            raise ValueError("Không nhận ra tiêu đề ghi chú cần ghim.")
        content = (content or "").strip()
        if not content:
            raise ValueError("Thiếu nội dung ghi chú ghim.")

        payload = self._load()
        pinned = payload.setdefault("pinned_knowledge", [])
        item = {
            "title": title.strip(),
            "content": content,
            "tags": [str(tag).strip() for tag in (tags or []) if str(tag).strip()],
            "updated_at": self._now_iso(),
        }
        replaced = False
        for index, existing in enumerate(pinned):
            if self._normalize_pinned_title(existing.get("title", "")) == normalized_title:
                pinned[index] = item
                replaced = True
                break
        if not replaced:
            pinned.append(item)
        payload["updated_at"] = self._now_iso()
        self._append_history(
            payload,
            action="set_pinned",
            key=f"pinned_knowledge.{normalized_title}",
            value=item,
            source=source,
        )
        self._save(payload)
        return item

    def list_pinned_knowledge(self) -> list[dict[str, Any]]:
        payload = self._load()
        pinned = payload.get("pinned_knowledge") or []
        return [item for item in pinned if isinstance(item, dict)]

    def delete_pinned_knowledge(self, title: str, *, source: str = "chat") -> dict[str, Any]:
        normalized_title = self._normalize_pinned_title(title)
        if not normalized_title:
            raise ValueError("Không nhận ra ghi chú ghim cần xóa.")

        payload = self._load()
        pinned = payload.get("pinned_knowledge") or []
        for index, item in enumerate(pinned):
            if self._normalize_pinned_title(item.get("title", "")) != normalized_title:
                continue
            deleted = pinned.pop(index)
            payload["updated_at"] = self._now_iso()
            self._append_history(
                payload,
                action="delete_pinned",
                key=f"pinned_knowledge.{normalized_title}",
                value=deleted,
                source=source,
            )
            self._save(payload)
            return deleted
        raise FileNotFoundError(f"Không tìm thấy ghi chú ghim '{title}'.")

    def get_recent_actions(self, *, limit: int = 10) -> list[dict[str, Any]]:
        payload = self._load()
        recent = payload.get("recent_actions") or []
        recent = [item for item in recent if isinstance(item, dict)]
        return recent[-max(int(limit or 0), 0):] if limit else recent

    def find_latest_recent_action(
        self,
        predicate,
        *,
        limit: int = 20,
    ) -> dict[str, Any] | None:
        for item in reversed(self.get_recent_actions(limit=limit)):
            try:
                if predicate(item):
                    return item
            except Exception:
                continue
        return None

    def get_latest_metadata_value(self, *keys: str, limit: int = 20) -> Any:
        for item in reversed(self.get_recent_actions(limit=limit)):
            metadata = item.get("metadata") or {}
            if not isinstance(metadata, dict):
                continue
            for key in keys:
                value = metadata.get(key)
                if value not in ("", None, [], {}):
                    return value
        return None

    def append_recent_action(
        self,
        *,
        command: str,
        status: str,
        result_message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        payload = self._load()
        recent = payload.get("recent_actions") or []
        recent.append(
            {
                "timestamp": self._now_iso(),
                "command": (command or "").strip(),
                "status": (status or "").strip(),
                "result_message": (result_message or "").strip(),
                "metadata": metadata or {},
            }
        )
        payload["recent_actions"] = recent[-20:]
        payload["updated_at"] = self._now_iso()
        self._save(payload)

    def learn_from_action(
        self,
        *,
        command: str,
        status: str,
        result_message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        payload = self._load()
        meta = metadata or {}

        self._append_recent_action_to_payload(
            payload,
            command=command,
            status=status,
            result_message=result_message,
            metadata=meta,
        )
        self._learn_prompt_style(payload, command)
        self._learn_apps(payload, meta)
        self._learn_folders(payload, command, meta)
        payload["updated_at"] = self._now_iso()
        self._save(payload)

    def get_preference(self, key: str, default: Any = "") -> Any:
        normalized_key = self._normalize_key(key)
        if not normalized_key:
            return default
        payload = self._load()
        current: Any = payload
        for part in normalized_key.split("."):
            if not isinstance(current, dict):
                return default
            current = current.get(part)
            if current is None:
                return default
        return current

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return self._default_payload()
        try:
            with self.path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception:
            return self._default_payload()

        payload = self._default_payload()
        for key in ("schema_version", "updated_at"):
            if key in raw:
                payload[key] = raw[key]

        for section in ("profile", "preferences"):
            if isinstance(raw.get(section), dict):
                payload[section].update(raw[section])

        for section in ("history", "recent_actions", "pinned_knowledge"):
            if isinstance(raw.get(section), list):
                payload[section] = raw[section]
        if isinstance(raw.get("entities"), dict):
            payload["entities"] = raw["entities"]
        if isinstance(raw.get("_learning"), dict):
            for key, default_value in payload["_learning"].items():
                value = raw["_learning"].get(key)
                if isinstance(value, dict):
                    payload["_learning"][key] = value
        return payload

    def _save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _default_payload(self) -> dict[str, Any]:
        return {
            "schema_version": 2,
            "profile": {
                "name": "",
                "timezone": "Asia/Ho_Chi_Minh",
                "job": "",
                "frequent_folders": [],
                "preferred_apps": [],
                "favorite_prompt_style": "",
            },
            "preferences": {
                "gmail_default_account": "",
                "favorite_report_folder": "",
                "open_file_app": "",
            },
            "entities": {},
            "pinned_knowledge": [],
            "recent_actions": [],
            "history": [],
            "_learning": {
                "prompt_style_counts": {},
                "app_counts": {},
                "folder_counts": {},
                "report_folder_counts": {},
            },
            "updated_at": self._now_iso(),
        }

    def _normalize_key(self, key: str) -> str:
        cleaned = (
            (key or "")
            .strip()
            .lower()
            .replace(" ", "_")
            .replace("-", "_")
        )
        return self.KEY_ALIASES.get(cleaned, cleaned if "." in cleaned else "")

    def _get_parent(self, payload: dict[str, Any], key: str, *, create: bool) -> dict[str, Any] | None:
        parts = key.split(".")
        current: dict[str, Any] = payload
        for part in parts[:-1]:
            child = current.get(part)
            if child is None:
                if not create:
                    return None
                child = {}
                current[part] = child
            if not isinstance(child, dict):
                if not create:
                    return None
                child = {}
                current[part] = child
            current = child
        return current

    def _append_history(
        self,
        payload: dict[str, Any],
        *,
        action: str,
        key: str,
        value: Any,
        source: str,
    ) -> None:
        history = payload.get("history") or []
        history.append(
            {
                "timestamp": self._now_iso(),
                "action": action,
                "key": key,
                "value": value,
                "source": source,
            }
        )
        payload["history"] = history[-50:]

    def _append_recent_action_to_payload(
        self,
        payload: dict[str, Any],
        *,
        command: str,
        status: str,
        result_message: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        recent = payload.get("recent_actions") or []
        recent.append(
            {
                "timestamp": self._now_iso(),
                "command": (command or "").strip(),
                "status": (status or "").strip(),
                "result_message": (result_message or "").strip(),
                "metadata": metadata or {},
            }
        )
        payload["recent_actions"] = recent[-20:]

    def _learn_prompt_style(self, payload: dict[str, Any], command: str) -> None:
        command = (command or "").strip()
        if not command:
            return
        normalized = command.lower()
        if any(token in normalized for token in ("hãy ", "hay ", "giúp", "giup", "please", "làm ơn", "lam on")) or len(command.split()) >= 10:
            style = "tự nhiên"
        else:
            style = "ngắn gọn"
        self._bump_learning_counter(payload, "prompt_style_counts", style)
        payload["profile"]["favorite_prompt_style"] = self._pick_top_learning_value(payload, "prompt_style_counts")

    def _learn_apps(self, payload: dict[str, Any], metadata: dict[str, Any]) -> None:
        app = str(metadata.get("app") or "").strip().lower()
        if not app:
            return
        self._bump_learning_counter(payload, "app_counts", app)
        payload["profile"]["preferred_apps"] = self._pick_top_learning_list(payload, "app_counts")

    def _learn_folders(self, payload: dict[str, Any], command: str, metadata: dict[str, Any]) -> None:
        folders: list[str] = []
        for key in ("path", "src", "dst", "file_path"):
            folder = self._extract_folder_from_value(metadata.get(key))
            if folder:
                folders.append(folder)

        bulk_email = metadata.get("bulk_email")
        if isinstance(bulk_email, dict):
            folder = self._extract_folder_from_value(bulk_email.get("source_file"))
            if folder:
                folders.append(folder)

        favorite_report_folder = ""
        lowered = (command or "").lower()
        for folder in folders:
            self._bump_learning_counter(payload, "folder_counts", folder)
            if any(token in lowered for token in ("báo cáo", "bao cao", "report")):
                self._bump_learning_counter(payload, "report_folder_counts", folder)
                favorite_report_folder = self._pick_top_learning_value(payload, "report_folder_counts")

        payload["profile"]["frequent_folders"] = self._pick_top_learning_list(payload, "folder_counts")
        if favorite_report_folder:
            payload["preferences"]["favorite_report_folder"] = favorite_report_folder

    def _extract_folder_from_value(self, value: Any) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        path = Path(text)
        if path.suffix:
            folder = path.parent
        else:
            folder = path
        folder_text = str(folder).strip()
        return folder_text if folder_text not in {".", ""} else ""

    def _bump_learning_counter(self, payload: dict[str, Any], group: str, value: str) -> None:
        value = (value or "").strip()
        if not value:
            return
        learning = payload.setdefault("_learning", {})
        counters = learning.setdefault(group, {})
        counters[value] = int(counters.get(value) or 0) + 1

    def _pick_top_learning_value(self, payload: dict[str, Any], group: str) -> str:
        learning = payload.get("_learning") or {}
        counters = learning.get(group) or {}
        if not counters:
            return ""
        ranked = sorted(counters.items(), key=lambda item: (-int(item[1]), str(item[0]).lower()))
        return str(ranked[0][0])

    def _pick_top_learning_list(self, payload: dict[str, Any], group: str, limit: int = 5) -> list[str]:
        learning = payload.get("_learning") or {}
        counters = learning.get(group) or {}
        ranked = sorted(counters.items(), key=lambda item: (-int(item[1]), str(item[0]).lower()))
        return [str(item[0]) for item in ranked[:limit]]

    def _normalize_entity_alias(self, alias: str) -> str:
        return " ".join((alias or "").strip().lower().split())

    def _normalize_pinned_title(self, title: str) -> str:
        return " ".join((title or "").strip().lower().split())

    def _now_iso(self) -> str:
        return datetime.now(VN_TZ).isoformat()
