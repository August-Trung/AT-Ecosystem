from __future__ import annotations

import threading
from pathlib import Path

import win32api
import win32con
import win32gui


WMAPP_NOTIFYCALLBACK = win32con.WM_APP + 1
WMAPP_RESTORE = win32con.WM_APP + 2
WMAPP_EXIT = win32con.WM_APP + 3
TRAY_UID = 1


class TrayIconManager:
    def __init__(
        self,
        *,
        on_restore,
        on_exit,
        tooltip: str = "AT Assistant",
        icon_path: str | None = None,
    ) -> None:
        self._on_restore = on_restore
        self._on_exit = on_exit
        self._tooltip = tooltip
        self._icon_path = icon_path
        self._hwnd = None
        self._thread = None
        self._class_name = "ATAssistantTrayIcon"
        self._ready = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self._ready.wait(timeout=3)

    def stop(self) -> None:
        hwnd = self._hwnd
        if hwnd:
            try:
                win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
            except Exception:
                pass
        self._hwnd = None
        self._ready.clear()

    def notify(self, title: str, message: str, timeout: int = 10) -> None:
        hwnd = self._hwnd
        if not hwnd:
            return
        hicon = self._load_icon()
        flags = win32gui.NIF_INFO | win32gui.NIF_MESSAGE | win32gui.NIF_TIP | win32gui.NIF_ICON
        nid = (
            hwnd,
            TRAY_UID,
            flags,
            WMAPP_NOTIFYCALLBACK,
            hicon,
            self._tooltip,
            message[:255],
            timeout * 1000,
            title[:63],
            win32gui.NIIF_INFO,
        )
        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_MODIFY, nid)
        except Exception:
            return

    def _run(self) -> None:
        hinst = win32api.GetModuleHandle(None)
        wc = win32gui.WNDCLASS()
        wc.hInstance = hinst
        wc.lpszClassName = self._class_name
        wc.lpfnWndProc = self._wndproc
        class_atom = win32gui.RegisterClass(wc)

        hwnd = win32gui.CreateWindow(
            class_atom,
            self._class_name,
            0,
            0,
            0,
            win32con.CW_USEDEFAULT,
            win32con.CW_USEDEFAULT,
            0,
            0,
            hinst,
            None,
        )
        self._hwnd = hwnd
        self._add_icon(hwnd)
        self._ready.set()
        win32gui.PumpMessages()
        self._ready.clear()

    def _add_icon(self, hwnd) -> None:
        hicon = self._load_icon()
        flags = win32gui.NIF_ICON | win32gui.NIF_MESSAGE | win32gui.NIF_TIP
        nid = (hwnd, TRAY_UID, flags, WMAPP_NOTIFYCALLBACK, hicon, self._tooltip)
        win32gui.Shell_NotifyIcon(win32gui.NIM_ADD, nid)
        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_SETVERSION, (hwnd, TRAY_UID, 0, 0, 0, "", 0, 0, 0, 4))
        except Exception:
            pass

    def _load_icon(self):
        if self._icon_path:
            path = Path(self._icon_path)
            if path.exists():
                try:
                    width = win32api.GetSystemMetrics(win32con.SM_CXSMICON)
                    height = win32api.GetSystemMetrics(win32con.SM_CYSMICON)
                    return win32gui.LoadImage(
                        0,
                        str(path),
                        win32con.IMAGE_ICON,
                        width,
                        height,
                        win32con.LR_LOADFROMFILE,
                    )
                except Exception:
                    pass
        return win32gui.LoadIcon(0, win32con.IDI_APPLICATION)

    def _remove_icon(self, hwnd) -> None:
        try:
            win32gui.Shell_NotifyIcon(win32gui.NIM_DELETE, (hwnd, TRAY_UID))
        except Exception:
            return

    def _show_menu(self, hwnd) -> None:
        menu = win32gui.CreatePopupMenu()
        win32gui.AppendMenu(menu, win32con.MF_STRING, WMAPP_RESTORE, "Mở lại")
        win32gui.AppendMenu(menu, win32con.MF_SEPARATOR, 0, "")
        win32gui.AppendMenu(menu, win32con.MF_STRING, WMAPP_EXIT, "Thoát")
        try:
            pos = win32gui.GetCursorPos()
            win32gui.SetForegroundWindow(hwnd)
            win32gui.TrackPopupMenu(
                menu,
                win32con.TPM_LEFTALIGN | win32con.TPM_BOTTOMALIGN | win32con.TPM_RIGHTBUTTON,
                pos[0],
                pos[1],
                0,
                hwnd,
                None,
            )
            win32gui.PostMessage(hwnd, win32con.WM_NULL, 0, 0)
        finally:
            try:
                win32gui.DestroyMenu(menu)
            except Exception:
                pass

    def _wndproc(self, hwnd, msg, wparam, lparam):
        if msg == WMAPP_NOTIFYCALLBACK:
            if lparam in {win32con.WM_LBUTTONUP, win32con.WM_LBUTTONDBLCLK}:
                self._on_restore()
                return 0
            if lparam == win32con.WM_RBUTTONUP:
                self._show_menu(hwnd)
                return 0
        elif msg == win32con.WM_COMMAND:
            command_id = int(wparam) & 0xFFFF
            if command_id == WMAPP_RESTORE:
                self._on_restore()
                return 0
            if command_id == WMAPP_EXIT:
                self._on_exit()
                return 0
        elif msg == WMAPP_RESTORE:
            self._on_restore()
            return 0
        elif msg == WMAPP_EXIT:
            self._on_exit()
            return 0
        elif msg == win32con.WM_DESTROY:
            self._remove_icon(hwnd)
            win32gui.PostQuitMessage(0)
            return 0
        return win32gui.DefWindowProc(hwnd, msg, wparam, lparam)
