from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from src.core.app_paths import app_data_root
from src.plugins.startup_service import StartupService


class UninstallService:
    def __init__(self, startup_service: StartupService | None = None) -> None:
        self._startup_service = startup_service or StartupService()

    def is_packaged(self) -> bool:
        return bool(getattr(sys, "frozen", False))

    def current_executable(self) -> Path:
        return Path(sys.executable).resolve()

    def app_data_path(self) -> Path:
        return app_data_root()

    def get_status(self) -> dict[str, Any]:
        exe_path = self.current_executable()
        return {
            "is_packaged": self.is_packaged(),
            "executable_path": str(exe_path),
            "app_data_path": str(self.app_data_path()),
            "startup_shortcut_path": str(self._startup_service.shortcut_path()),
            "startup_enabled": self._startup_service.is_enabled(),
            "can_delete_executable": self.is_packaged() and exe_path.exists(),
        }

    def schedule_uninstall(
        self,
        *,
        delete_user_data: bool = True,
        delete_executable: bool = True,
    ) -> dict[str, Any]:
        startup_result = self._startup_service.disable()
        exe_path = self.current_executable() if self.is_packaged() else None
        should_delete_exe = bool(delete_executable and exe_path and exe_path.exists())
        should_delete_data = bool(delete_user_data)

        script_path = None
        if should_delete_data or should_delete_exe:
            script_path = self._write_cleanup_script(
                app_data_path=self.app_data_path() if should_delete_data else None,
                executable_path=exe_path if should_delete_exe else None,
            )
            self._launch_cleanup_script(script_path)

        return {
            "startup": startup_result,
            "delete_user_data": should_delete_data,
            "delete_executable": should_delete_exe,
            "app_data_path": str(self.app_data_path()),
            "executable_path": str(exe_path) if exe_path else "",
            "cleanup_script_path": str(script_path) if script_path else "",
        }

    def _write_cleanup_script(
        self,
        *,
        app_data_path: Path | None,
        executable_path: Path | None,
    ) -> Path:
        script_path = Path(tempfile.gettempdir()) / f"ATAssistant-uninstall-{os.getpid()}.cmd"
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
        ]
        if app_data_path is not None:
            lines.append(f'if exist "{app_data_path}" rmdir /s /q "{app_data_path}" 2>NUL')
        if executable_path is not None:
            lines.append(f'if exist "{executable_path}" del /f /q "{executable_path}" 2>NUL')
        lines.extend(
            [
                'del /f /q "%~f0" 2>NUL',
                "endlocal",
            ]
        )
        script_path.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")
        return script_path

    def _launch_cleanup_script(self, script_path: Path) -> None:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        subprocess.Popen(
            ["cmd.exe", "/c", str(script_path)],
            close_fds=True,
            creationflags=creationflags,
        )
