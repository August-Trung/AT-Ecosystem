from __future__ import annotations

import os
import sys
from pathlib import Path


_LOADED = False


def _parse_env_line(line: str) -> tuple[str, str] | None:
    raw = (line or "").strip()
    if not raw or raw.startswith("#"):
        return None
    if raw.startswith("export "):
        raw = raw[len("export ") :].strip()
    if "=" not in raw:
        return None

    key, value = raw.split("=", 1)
    key = key.strip()
    value = value.strip()
    if not key:
        return None

    if (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in {"'", '"'}
    ):
        value = value[1:-1]
    return key, value


def _candidate_env_paths() -> list[Path]:
    paths: list[Path] = []

    if getattr(sys, "frozen", False):
        paths.append(Path(sys.executable).resolve().parent / ".env")

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        paths.append(Path(meipass).resolve() / ".env")

    paths.append(Path.cwd() / ".env")
    paths.append(Path(__file__).resolve().parents[2] / ".env")

    unique: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def load_project_env(*, override: bool = False) -> bool:
    """Load .env values for source runs and PyInstaller builds.

    Search order:
    1. Folder containing the frozen .exe.
    2. PyInstaller bundle temp folder.
    3. Current working directory.
    4. Project root in source mode.
    """
    global _LOADED
    if _LOADED and not override:
        return True

    loaded_any = False
    for env_path in _candidate_env_paths():
        if not env_path.exists():
            continue
        try:
            for line in env_path.read_text(encoding="utf-8-sig").splitlines():
                parsed = _parse_env_line(line)
                if parsed is None:
                    continue
                key, value = parsed
                if override or key not in os.environ:
                    os.environ[key] = value
            loaded_any = True
        except Exception:
            continue

    _LOADED = loaded_any or _LOADED
    return loaded_any
