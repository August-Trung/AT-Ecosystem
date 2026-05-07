from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from src.core.app_paths import runtime_root, source_project_root


STARTUP_SHORTCUT_NAME = "AT Assistant.lnk"
PACKAGED_EXE_RELATIVE_PATHS = (
    Path("dist") / "ATAssistant.exe",
    Path("dist") / "ATAssistant" / "ATAssistant.exe",
)


class StartupService:
    def startup_folder(self) -> Path:
        appdata = os.environ.get("APPDATA")
        if appdata:
            return Path(appdata).expanduser().resolve() / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        return Path.home() / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"

    def shortcut_path(self) -> Path:
        return self.startup_folder() / STARTUP_SHORTCUT_NAME

    def is_enabled(self) -> bool:
        return self.shortcut_path().exists()

    def enable(self) -> dict[str, Any]:
        shortcut_path = self.shortcut_path()
        shortcut_path.parent.mkdir(parents=True, exist_ok=True)
        spec = self._build_shortcut_spec()
        shell = self._create_shell()
        shortcut = shell.CreateShortcut(str(shortcut_path))
        shortcut.TargetPath = spec["target_path"]
        shortcut.Arguments = spec["arguments"]
        shortcut.WorkingDirectory = spec["working_directory"]
        shortcut.IconLocation = spec["icon_location"]
        shortcut.Description = "Khởi động AT Assistant cùng Windows và chạy nền ở khay hệ thống."
        shortcut.Save()
        return {
            "enabled": True,
            "shortcut_path": str(shortcut_path),
            **spec,
        }

    def disable(self) -> dict[str, Any]:
        shortcut_path = self.shortcut_path()
        if shortcut_path.exists():
            shortcut_path.unlink()
        return {
            "enabled": False,
            "shortcut_path": str(shortcut_path),
        }

    def get_status(self) -> dict[str, Any]:
        spec = self._build_shortcut_spec()
        return {
            "enabled": self.is_enabled(),
            "shortcut_path": str(self.shortcut_path()),
            **spec,
        }

    def _build_shortcut_spec(self) -> dict[str, str]:
        if getattr(sys, "frozen", False):
            target_path = str(Path(sys.executable).resolve())
            arguments = "--background-startup"
            working_directory = str(runtime_root())
            icon_location = target_path
        else:
            packaged_exe = self._find_packaged_app_executable()
            if packaged_exe is not None:
                target_path = str(packaged_exe)
                arguments = "--background-startup"
                working_directory = str(packaged_exe.parent)
                icon_location = target_path
            else:
                target_path = str(self._find_windowed_python_executable())
                arguments = "-m src.gui.main_gui --background-startup"
                working_directory = str(source_project_root())
                icon_location = target_path
        return {
            "target_path": target_path,
            "arguments": arguments,
            "working_directory": working_directory,
            "icon_location": icon_location,
        }

    def _find_packaged_app_executable(self) -> Path | None:
        for relative_path in PACKAGED_EXE_RELATIVE_PATHS:
            executable = source_project_root() / relative_path
            if executable.exists():
                return executable.resolve()
        return None

    def _find_windowed_python_executable(self) -> Path:
        executable = Path(sys.executable).resolve()
        if executable.name.lower() != "python.exe":
            return executable

        pythonw = executable.with_name("pythonw.exe")
        if pythonw.exists():
            return pythonw.resolve()
        return executable

    def _create_shell(self):
        import win32com.client

        return win32com.client.Dispatch("WScript.Shell")
