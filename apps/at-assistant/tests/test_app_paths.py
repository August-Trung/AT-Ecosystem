from __future__ import annotations

from pathlib import Path

from src.core import app_paths


def test_runtime_root_uses_project_root_when_running_from_source(monkeypatch):
    monkeypatch.delattr(app_paths.sys, "frozen", raising=False)

    assert app_paths.runtime_root() == app_paths.source_project_root()


def test_runtime_root_uses_local_app_data_when_frozen(tmp_path, monkeypatch):
    monkeypatch.setattr(app_paths.sys, "frozen", True, raising=False)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))

    expected = Path(tmp_path) / "ATAssistant"

    assert app_paths.runtime_root() == expected.resolve()
    assert expected.exists()
