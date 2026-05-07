from __future__ import annotations

import win32con

from src.gui.tray_icon import TrayIconManager, WMAPP_EXIT, WMAPP_RESTORE


def test_tray_menu_restore_command_calls_restore():
    calls: list[str] = []
    tray = TrayIconManager(
        on_restore=lambda: calls.append("restore"),
        on_exit=lambda: calls.append("exit"),
    )

    result = tray._wndproc(0, win32con.WM_COMMAND, WMAPP_RESTORE, 0)

    assert result == 0
    assert calls == ["restore"]


def test_tray_menu_exit_command_calls_exit():
    calls: list[str] = []
    tray = TrayIconManager(
        on_restore=lambda: calls.append("restore"),
        on_exit=lambda: calls.append("exit"),
    )

    result = tray._wndproc(0, win32con.WM_COMMAND, WMAPP_EXIT, 0)

    assert result == 0
    assert calls == ["exit"]
