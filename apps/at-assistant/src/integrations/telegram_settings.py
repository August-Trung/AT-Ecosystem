from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_app_data_dir


DEFAULT_TELEGRAM_SETTINGS: dict[str, Any] = {
    "bot_name": "",
    "bot_token": "",
    "allowed_user_ids": "",
    "allowed_chat_ids": "",
    "command_prefix": "/at",
    "poll_timeout": 30,
}


class TelegramSettingsStore:
    def __init__(self) -> None:
        self._path = ensure_app_data_dir("settings") / "telegram_bot.json"

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> dict[str, Any]:
        data = deepcopy(DEFAULT_TELEGRAM_SETTINGS)
        if not self._path.exists():
            return data
        try:
            with self._path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            return data
        if isinstance(payload, dict):
            for key, value in payload.items():
                if key in data:
                    data[key] = value
        return self._normalize(data)

    def save(self, settings: dict[str, Any]) -> dict[str, Any]:
        current = deepcopy(DEFAULT_TELEGRAM_SETTINGS)
        for key, value in (settings or {}).items():
            if key in current:
                current[key] = value
        current = self._normalize(current)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(current, handle, ensure_ascii=False, indent=2)
        return current

    def _normalize(self, settings: dict[str, Any]) -> dict[str, Any]:
        data = dict(settings)
        for key in ("bot_name", "bot_token", "allowed_user_ids", "allowed_chat_ids", "command_prefix"):
            data[key] = str(data.get(key) or "").strip()
        if not data["command_prefix"]:
            data["command_prefix"] = str(DEFAULT_TELEGRAM_SETTINGS["command_prefix"])
        try:
            data["poll_timeout"] = int(data.get("poll_timeout") or DEFAULT_TELEGRAM_SETTINGS["poll_timeout"])
        except (TypeError, ValueError):
            data["poll_timeout"] = int(DEFAULT_TELEGRAM_SETTINGS["poll_timeout"])
        if data["poll_timeout"] <= 0:
            data["poll_timeout"] = int(DEFAULT_TELEGRAM_SETTINGS["poll_timeout"])
        return data
