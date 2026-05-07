from __future__ import annotations

from pathlib import Path

from src.plugins import factory_reset_service
from src.plugins.factory_reset_service import FactoryResetService


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


def test_factory_reset_schedules_local_app_data_cleanup(tmp_path, monkeypatch):
    local_app_data = tmp_path / "local"
    fake_startup = _FakeStartupService(tmp_path / "Startup" / "AT Assistant.lnk")
    launched: list[Path] = []

    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))
    monkeypatch.setattr(factory_reset_service.tempfile, "gettempdir", lambda: str(tmp_path))

    service = FactoryResetService(startup_service=fake_startup)
    monkeypatch.setattr(service, "_launch_cleanup_script", lambda path: launched.append(Path(path)))

    result = service.schedule_reset(disable_startup=True)

    assert fake_startup.disabled is True
    assert result["delete_user_data"] is True
    assert result["disable_startup"] is True
    assert launched == [Path(result["cleanup_script_path"])]
    script = launched[0].read_text(encoding="utf-8")
    assert "rmdir /s /q" in script
    assert str(local_app_data / "ATAssistant") in script
    assert "del /f /q" in script
