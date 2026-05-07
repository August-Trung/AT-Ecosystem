from __future__ import annotations

from pathlib import Path

from src.plugins import uninstall_service
from src.plugins.uninstall_service import UninstallService


class _FakeStartupService:
    def __init__(self, shortcut_path: Path) -> None:
        self._shortcut_path = shortcut_path
        self.disabled = False

    def shortcut_path(self) -> Path:
        return self._shortcut_path

    def is_enabled(self) -> bool:
        return not self.disabled

    def disable(self) -> dict:
        self.disabled = True
        return {"enabled": False, "shortcut_path": str(self._shortcut_path)}


def test_uninstall_service_schedules_packaged_cleanup(tmp_path, monkeypatch):
    local_app_data = tmp_path / "local"
    exe_path = tmp_path / "ATAssistant.exe"
    exe_path.write_text("", encoding="utf-8")
    fake_startup = _FakeStartupService(tmp_path / "Startup" / "AT Assistant.lnk")
    launched: list[Path] = []

    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))
    monkeypatch.setattr(uninstall_service.sys, "frozen", True, raising=False)
    monkeypatch.setattr(uninstall_service.sys, "executable", str(exe_path))
    monkeypatch.setattr(uninstall_service.tempfile, "gettempdir", lambda: str(tmp_path))

    service = UninstallService(startup_service=fake_startup)
    monkeypatch.setattr(service, "_launch_cleanup_script", lambda path: launched.append(Path(path)))

    result = service.schedule_uninstall(delete_user_data=True, delete_executable=True)

    assert fake_startup.disabled is True
    assert result["delete_user_data"] is True
    assert result["delete_executable"] is True
    assert launched == [Path(result["cleanup_script_path"])]
    script = launched[0].read_text(encoding="utf-8")
    assert "rmdir /s /q" in script
    assert str(local_app_data / "ATAssistant") in script
    assert str(exe_path.resolve()) in script


def test_uninstall_service_does_not_delete_source_runner(tmp_path, monkeypatch):
    fake_startup = _FakeStartupService(tmp_path / "Startup" / "AT Assistant.lnk")
    launched: list[Path] = []

    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.delattr(uninstall_service.sys, "frozen", raising=False)
    monkeypatch.setattr(uninstall_service.sys, "executable", str(tmp_path / "python.exe"))

    service = UninstallService(startup_service=fake_startup)
    monkeypatch.setattr(service, "_launch_cleanup_script", lambda path: launched.append(Path(path)))

    result = service.schedule_uninstall(delete_user_data=False, delete_executable=True)

    assert fake_startup.disabled is True
    assert result["delete_user_data"] is False
    assert result["delete_executable"] is False
    assert result["cleanup_script_path"] == ""
    assert launched == []
