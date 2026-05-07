# src/plugins/installed_apps_service.py
"""
Scans the Windows Start Menu for installed applications and caches
the result to app_settings/installed_apps_cache.json (TTL = 24 h).

Each cached entry:
    {
        "name":     "Spotify",          # shortcut stem (original case)
        "name_lower": "spotify",        # for searching
        "exe":      "C:\\...\\Spotify.exe",
        "scanned_at": "2026-04-10T..."
    }
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from src.core.app_paths import ensure_runtime_dir

try:
    import win32com.client
    import pythoncom
    _COM_AVAILABLE = True
except ImportError:
    _COM_AVAILABLE = False

_CACHE_TTL_HOURS = 24

_START_MENU_DIRS = [
    Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
    Path(os.environ.get("PROGRAMDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
]


class InstalledAppsService:
    """Scan installed apps from the Start Menu and support fuzzy search."""

    def __init__(self, cache_path: Path | None = None) -> None:
        self._cache_path = cache_path or ensure_runtime_dir("app_settings") / "installed_apps_cache.json"

    # ──────────────────────────────────────────────────────────
    #  Public API
    # ──────────────────────────────────────────────────────────

    def search(self, query: str, limit: int = 5) -> list[dict]:
        """Return up to *limit* installed apps whose name matches *query*.

        Matching strategy (in order of priority):
        1. Exact match on normalized stem
        2. Starts-with match
        3. Contains match

        Each result: {"name": str, "exe": str}
        """
        q = _normalize(query)
        if len(q) < 2:
            return []

        apps = self.get_all()
        scored: list[tuple[int, dict]] = []

        for app in apps:
            name_lower = app.get("name_lower", "")
            name_norm = _normalize(name_lower)
            if name_norm == q:
                scored.append((0, app))
            elif name_norm.startswith(q):
                scored.append((1, app))
            elif q in name_norm:
                scored.append((2, app))

        scored.sort(key=lambda t: t[0])
        return [item for _, item in scored[:limit]]

    def get_all(self) -> list[dict]:
        """Return cached list, refreshing if stale or missing."""
        cached = self._load_cache()
        if cached is not None:
            return cached
        return self.scan_and_cache()

    def scan_and_cache(self) -> list[dict]:
        """Perform a fresh scan and overwrite the cache."""
        apps = self._scan()
        self._save_cache(apps)
        return apps

    # ──────────────────────────────────────────────────────────
    #  Internal helpers
    # ──────────────────────────────────────────────────────────

    def _scan(self) -> list[dict]:
        if not _COM_AVAILABLE:
            return []

        try:
            pythoncom.CoInitialize()
            return self._scan_start_menu()
        except Exception:
            return []
        finally:
            try:
                pythoncom.CoUninitialize()
            except Exception:
                pass

    def _scan_start_menu(self) -> list[dict]:
        shell = win32com.client.Dispatch("WScript.Shell")
        seen_names: set[str] = set()
        seen_exes: set[str] = set()
        results: list[dict] = []
        now_iso = datetime.now().isoformat(timespec="seconds")

        for base in _START_MENU_DIRS:
            if not base.exists():
                continue
            for lnk in base.rglob("*.lnk"):
                try:
                    sc = shell.CreateShortcut(str(lnk))
                    target = str(sc.TargetPath or "").strip()
                except Exception:
                    continue

                if not target or not target.lower().endswith(".exe"):
                    continue
                if not Path(target).exists():
                    continue

                # Deduplicate by exe path
                exe_lower = target.lower()
                if exe_lower in seen_exes:
                    continue
                seen_exes.add(exe_lower)

                stem = lnk.stem
                stem_lower = stem.lower()

                # Skip installer / uninstaller shortcuts
                skip_keywords = {"uninstall", "setup", "install", "update", "repair"}
                if any(k in stem_lower for k in skip_keywords):
                    continue

                # Deduplicate by name
                if stem_lower in seen_names:
                    continue
                seen_names.add(stem_lower)

                results.append(
                    {
                        "name": stem,
                        "name_lower": stem_lower,
                        "exe": target,
                        "scanned_at": now_iso,
                    }
                )

        return sorted(results, key=lambda r: r["name_lower"])

    def _load_cache(self) -> Optional[list[dict]]:
        try:
            if not self._cache_path.exists():
                return None
            raw = json.loads(self._cache_path.read_text(encoding="utf-8"))
            if not isinstance(raw, list) or not raw:
                return None
            # Check TTL using first entry
            first_scanned = raw[0].get("scanned_at", "")
            if first_scanned:
                scanned_dt = datetime.fromisoformat(first_scanned)
                if datetime.now() - scanned_dt > timedelta(hours=_CACHE_TTL_HOURS):
                    return None
            return raw
        except Exception:
            return None

    def _save_cache(self, apps: list[dict]) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(
                json.dumps(apps, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass


def _normalize(text: str) -> str:
    """Strip whitespace, lowercase, remove non-alphanumeric separators."""
    t = (text or "").strip().lower()
    t = re.sub(r"[\s\-_]+", "", t)
    return t
