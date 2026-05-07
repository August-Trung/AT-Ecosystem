from __future__ import annotations

import os
import sys
from pathlib import Path


def source_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return app_data_root()
    return source_project_root()


def bundle_root() -> Path:
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        return Path(meipass).resolve()
    return source_project_root()


def resource_path(*parts: str, prefer_runtime: bool = True) -> Path:
    rel = Path(*parts)
    candidates = []
    if prefer_runtime:
        candidates.append(runtime_root() / rel)
        candidates.append(bundle_root() / rel)
    else:
        candidates.append(bundle_root() / rel)
        candidates.append(runtime_root() / rel)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def ensure_runtime_dir(*parts: str) -> Path:
    path = runtime_root().joinpath(*parts)
    path.mkdir(parents=True, exist_ok=True)
    return path


def app_data_root(app_name: str = "ATAssistant") -> Path:
    base = os.environ.get("LOCALAPPDATA")
    if base:
        root = Path(base).expanduser().resolve()
    else:
        root = Path.home() / "AppData" / "Local"
    path = root / app_name
    path.mkdir(parents=True, exist_ok=True)
    return path


def ensure_app_data_dir(*parts: str, app_name: str = "ATAssistant") -> Path:
    path = app_data_root(app_name).joinpath(*parts)
    path.mkdir(parents=True, exist_ok=True)
    return path
