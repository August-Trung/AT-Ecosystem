from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from src.core.app_paths import app_data_root
from src.plugins.startup_service import StartupService


class FactoryResetService:
    def __init__(self, startup_service: StartupService | None = None) -> None:
        self._startup_service = startup_service or StartupService()

    def app_data_path(self) -> Path:
        return app_data_root()

    def get_status(self) -> dict[str, Any]:
        return {
            "app_data_path": str(self.app_data_path()),
            "startup_shortcut_path": str(self._startup_service.shortcut_path()),
            "startup_enabled": self._startup_service.is_enabled(),
        }

    def schedule_reset(self, *, disable_startup: bool = True) -> dict[str, Any]:
        startup_result = None
        if disable_startup:
            startup_result = self._startup_service.disable()

        app_data_path = self.app_data_path()
        script_path = self._write_cleanup_script(app_data_path=app_data_path)
        self._launch_cleanup_script(script_path)

        return {
            "startup": startup_result,
            "disable_startup": disable_startup,
            "delete_user_data": True,
            "app_data_path": str(app_data_path),
            "cleanup_script_path": str(script_path),
        }

    def _write_cleanup_script(self, *, app_data_path: Path) -> Path:
        script_path = Path(tempfile.gettempdir()) / f"ATAssistant-factory-reset-{os.getpid()}.cmd"
        lines = [
            "@echo off",
            "setlocal",
            f'set "TARGET_PID={os.getpid()}"',
            ":wait_for_app",
            'tasklist /FI "PID eq %TARGET_PID%" 2>NUL | find "%TARGET_PID%" >NUL',
            "if not errorlevel 1 (",
            "    timeout /t 1 /nobreak >NUL",
            "    goto wait_for_app",
            ")",
            f'if exist "{app_data_path}" rmdir /s /q "{app_data_path}" 2>NUL',
            'del /f /q "%~f0" 2>NUL',
            "endlocal",
        ]
        script_path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
        return script_path

    def _launch_cleanup_script(self, script_path: Path) -> None:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(
            ["cmd.exe", "/c", str(script_path)],
            close_fds=True,
            creationflags=creationflags,
        )
