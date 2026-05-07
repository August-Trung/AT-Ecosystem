# src/plugins/recent_apps_service.py
"""
Tracks recently opened applications and persists the list to
app_settings/recent_apps.json.

Schema of each entry:
    {
        "app":        "chrome",           # canonical app key
        "display":    "Google Chrome",    # human-readable name (optional)
        "exe":        "C:\\...\\chrome.exe",
        "opened_at":  "2026-04-10T08:00:00"
    }
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from src.core.app_paths import ensure_runtime_dir


_MAX_ENTRIES = 10


class RecentAppsService:
    """Read / write the recently-opened-apps list from JSON."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or ensure_runtime_dir("app_settings") / "recent_apps.json"

    # ──────────────────────────────────────────────────────────
    #  Public API
    # ──────────────────────────────────────────────────────────

    def record_app(
        self,
        app_key: str,
        exe_path: str = "",
        display_name: str = "",
    ) -> None:
        """Record that *app_key* was just opened.

        Moves the entry to the front of the list (deduplication by key).
        Keeps at most ``_MAX_ENTRIES`` entries.
        """
        key = (app_key or "").strip().lower()
        if not key:
            return

        entries = self._load()

        # Remove existing entry for the same key so we can re-insert at front
        entries = [e for e in entries if e.get("app", "").lower() != key]

        new_entry: dict = {
            "app": key,
            "display": display_name or self._make_display(key),
            "exe": exe_path or "",
            "opened_at": datetime.now().isoformat(timespec="seconds"),
        }
        entries.insert(0, new_entry)
        entries = entries[:_MAX_ENTRIES]

        self._save(entries)

    def get_recent_apps(self, limit: int = 5) -> list[dict]:
        """Return up to *limit* most-recently opened apps (newest first)."""
        return self._load()[: max(1, limit)]

    def get_recent_app_names(self, limit: int = 5) -> list[str]:
        """Return display names of the *limit* most-recently opened apps."""
        return [
            e.get("display") or e.get("app") or ""
            for e in self.get_recent_apps(limit)
            if e.get("display") or e.get("app")
        ]

    # ──────────────────────────────────────────────────────────
    #  Internal helpers
    # ──────────────────────────────────────────────────────────

    def _load(self) -> list[dict]:
        try:
            if self._path.exists():
                data = json.loads(self._path.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    return data
        except Exception:
            pass
        return []

    def _save(self, entries: list[dict]) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(
                json.dumps(entries, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

    @staticmethod
    def _make_display(key: str) -> str:
        """Best-effort human-readable name from an app key."""
        _display_map = {
            "chrome": "Google Chrome",
            "notepad": "Notepad",
            "calculator": "Máy tính",
            "vscode": "VS Code",
            "word": "Microsoft Word",
            "excel": "Microsoft Excel",
            "powerpoint": "Microsoft PowerPoint",
            "outlook": "Microsoft Outlook",
            "zalo": "Zalo",
            "sql_server": "SQL Server Management Studio",
            "postgres": "PostgreSQL",
            "pgadmin": "pgAdmin",
            "datagrip": "DataGrip",
            "visual_studio": "Visual Studio",
        }
        return _display_map.get(key, key.replace("_", " ").title())
