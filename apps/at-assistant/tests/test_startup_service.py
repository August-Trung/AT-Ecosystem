from __future__ import annotations

import os
from pathlib import Path

from src.plugins import startup_service
from src.plugins.startup_service import StartupService


class _FakeShortcut:
    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self.TargetPath = ""
        self.Arguments = ""
        self.WorkingDirectory = ""
        self.IconLocation = ""
        self.Description = ""

    def Save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            "\n".join(
                [
                    self.TargetPath,
                    self.Arguments,
                    self.WorkingDirectory,
                    self.IconLocation,
                    self.Description,
                ]
            ),
            encoding="utf-8",
        )


class _FakeShell:
    def CreateShortcut(self, path: str):
        return _FakeShortcut(path)


def test_startup_service_enable_disable(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setattr(StartupService, "_find_packaged_app_executable", lambda self: None)
    service = StartupService()
    monkeypatch.setattr(service, "_create_shell", lambda: _FakeShell())

    enabled = service.enable()
    shortcut_path = Path(enabled["shortcut_path"])
    assert shortcut_path.exists()
    assert service.is_enabled() is True
    assert "--background-startup" in enabled["arguments"]

    content = shortcut_path.read_text(encoding="utf-8")
    assert "--background-startup" in content

    disabled = service.disable()
    assert disabled["enabled"] is False
    assert service.is_enabled() is False
    assert not shortcut_path.exists()


def test_startup_service_prefers_packaged_exe(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    app_exe = project_root / "dist" / "ATAssistant" / "ATAssistant.exe"
    app_exe.parent.mkdir(parents=True)
    app_exe.write_text("", encoding="utf-8")
    monkeypatch.setattr(startup_service, "source_project_root", lambda: project_root)

    spec = StartupService()._build_shortcut_spec()

    assert spec["target_path"] == str(app_exe.resolve())
    assert spec["arguments"] == "--background-startup"
    assert spec["working_directory"] == str(app_exe.parent.resolve())


def test_startup_service_prefers_onefile_packaged_exe(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    onefile_exe = project_root / "dist" / "ATAssistant.exe"
    onedir_exe = project_root / "dist" / "ATAssistant" / "ATAssistant.exe"
    onefile_exe.parent.mkdir(parents=True)
    onefile_exe.write_text("", encoding="utf-8")
    onedir_exe.parent.mkdir(parents=True)
    onedir_exe.write_text("", encoding="utf-8")
    monkeypatch.setattr(startup_service, "source_project_root", lambda: project_root)

    spec = StartupService()._build_shortcut_spec()

    assert spec["target_path"] == str(onefile_exe.resolve())
    assert spec["arguments"] == "--background-startup"
    assert spec["working_directory"] == str(onefile_exe.parent.resolve())


def test_startup_service_uses_pythonw_when_unbuilt(tmp_path, monkeypatch):
    project_root = tmp_path / "project"
    project_root.mkdir()
    python_dir = tmp_path / "python"
    python_dir.mkdir()
    python_exe = python_dir / "python.exe"
    pythonw_exe = python_dir / "pythonw.exe"
    python_exe.write_text("", encoding="utf-8")
    pythonw_exe.write_text("", encoding="utf-8")
    monkeypatch.setattr(startup_service, "source_project_root", lambda: project_root)
    monkeypatch.setattr(startup_service.sys, "executable", str(python_exe))

    spec = StartupService()._build_shortcut_spec()

    assert spec["target_path"] == str(pythonw_exe.resolve())
    assert spec["arguments"] == "-m src.gui.main_gui --background-startup"
    assert spec["working_directory"] == str(project_root.resolve())
