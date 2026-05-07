"""
pin_lock_dialog.py — Cửa sổ nhập PIN khi khởi động ATAssistant.

- Hiện ra trước khi main window được deiconify.
- Cho phép tối đa MAX_ATTEMPTS lần nhập sai, sau đó thoát app.
- Gọi on_success() nếu PIN đúng, on_fail() nếu hết lần thử.
"""

from __future__ import annotations

from typing import Callable

import customtkinter as ctk

from src.core.pin_service import PinService
from src.gui.theme import (
    FONT_FAMILY,
    FONT_SIZE_NORMAL,
    FONT_SIZE_SMALL,
    FONT_SIZE_TITLE,
)

MAX_ATTEMPTS = 5
_DOT_FILLED = "●"
_DOT_EMPTY = "○"


class PinLockDialog(ctk.CTkToplevel):
    """
    Modal xuất hiện trước khi main window được hiển thị.
    Chặn toàn bộ tương tác với parent cho đến khi PIN đúng hoặc hết lượt.
    """

    def __init__(
        self,
        master: ctk.CTk,
        *,
        palette: dict[str, str],
        on_success: Callable[[], None],
        on_fail: Callable[[], None],
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_success = on_success
        self._on_fail = on_fail
        self._service = PinService()
        self._attempts_left = MAX_ATTEMPTS

        # ── Cấu hình cửa sổ ──────────────────────────────────────
        self.title("AT Assistant — Xác thực")
        self.geometry("380x460")
        self.resizable(False, False)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()  # Chặn tương tác với cửa sổ parent
        self.protocol("WM_DELETE_WINDOW", self._on_close_button)

        # ── Layout ───────────────────────────────────────────────
        self._build_ui()
        self._center_on_screen()

        # ── Focus vào ô nhập ─────────────────────────────────────
        self.after(100, self._entry.focus_set)

    # ================================================================
    # Build UI
    # ================================================================

    def _build_ui(self) -> None:
        p = self._palette

        shell = ctk.CTkFrame(self, fg_color=p["BG_SECONDARY"], corner_radius=16)
        shell.pack(fill="both", expand=True, padx=20, pady=20)
        shell.grid_columnconfigure(0, weight=1)

        # Tiêu đề
        ctk.CTkLabel(
            shell,
            text="🔒  AT Assistant",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=p["FG_PRIMARY"],
        ).grid(row=0, column=0, pady=(28, 4))

        ctk.CTkLabel(
            shell,
            text="Nhập PIN để tiếp tục",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=p["FG_SECONDARY"],
        ).grid(row=1, column=0, pady=(0, 20))

        # Dot indicators — dùng khoảng cách giữa các chấm thay cho tracking
        self._dots_label = ctk.CTkLabel(
            shell,
            text="  ".join(_DOT_EMPTY * 6),
            font=(FONT_FAMILY, 26),
            text_color=p["ACCENT"],
        )
        self._dots_label.grid(row=2, column=0, pady=(0, 16))

        # Ô nhập PIN (ẩn ký tự)
        self._pin_var = ctk.StringVar()
        self._pin_var.trace_add("write", self._on_pin_changed)

        self._entry = ctk.CTkEntry(
            shell,
            textvariable=self._pin_var,
            show="●",
            width=200,
            height=44,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 2),
            fg_color=p["BG_INPUT"],
            border_color=p["BORDER_COLOR"],
            text_color=p["FG_PRIMARY"],
            corner_radius=10,
            justify="center",
        )
        self._entry.grid(row=3, column=0, pady=(0, 6))
        self._entry.bind("<Return>", lambda _e: self._submit())

        # Thông báo lỗi / trạng thái
        self._msg_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=p["FG_ERROR"],
        )
        self._msg_label.grid(row=4, column=0, pady=(0, 4))

        # Nhãn số lần còn lại
        self._attempts_label = ctk.CTkLabel(
            shell,
            text=self._attempts_text(),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=p["FG_SECONDARY"],
        )
        self._attempts_label.grid(row=5, column=0, pady=(0, 16))

        # Nút Xác nhận
        ctk.CTkButton(
            shell,
            text="Xác nhận",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=p["ACCENT"],
            hover_color=p["ACCENT_HOVER"],
            text_color="#ffffff",
            width=200,
            height=42,
            corner_radius=10,
            command=self._submit,
        ).grid(row=6, column=0, pady=(0, 12))

        # Gợi ý
        # ctk.CTkLabel(
        #     shell,
        #     text="Vào Cài đặt → Bảo mật để reset.",
        #     font=(FONT_FAMILY, FONT_SIZE_SMALL - 1),
        #     text_color=p["FG_SECONDARY"],
        # ).grid(row=7, column=0, pady=(0, 20))

    # ================================================================
    # Logic
    # ================================================================

    def _on_pin_changed(self, *_args) -> None:
        """Giới hạn độ dài và cập nhật dot indicators."""
        raw = self._pin_var.get()
        # Chỉ giữ chữ số, tối đa 6 ký tự
        digits = "".join(c for c in raw if c.isdigit())[:6]
        if raw != digits:
            self._pin_var.set(digits)
            self._entry.icursor("end")
            return

        filled = len(digits)
        dot_chars = _DOT_FILLED * filled + _DOT_EMPTY * (6 - filled)
        self._dots_label.configure(text="  ".join(dot_chars))

        # Xóa thông báo lỗi khi người dùng bắt đầu nhập lại
        if filled > 0:
            self._msg_label.configure(text="")

    def _submit(self) -> None:
        pin = self._pin_var.get().strip()
        if not pin:
            self._msg_label.configure(text="Vui lòng nhập PIN.")
            return

        if len(pin) < 4:
            self._msg_label.configure(text="PIN tối thiểu 4 chữ số.")
            return

        if self._service.verify_pin(pin):
            self.grab_release()
            self.destroy()
            self._on_success()
        else:
            self._attempts_left -= 1
            self._pin_var.set("")
            self._entry.focus_set()

            if self._attempts_left <= 0:
                self.grab_release()
                self.destroy()
                self._on_fail()
                return

            self._msg_label.configure(text="PIN không đúng. Vui lòng thử lại.")
            self._attempts_label.configure(text=self._attempts_text())

    def _on_close_button(self) -> None:
        """Nhấn X → thoát app (không cho bypass)."""
        self.grab_release()
        self.destroy()
        self._on_fail()

    # ================================================================
    # Helpers
    # ================================================================

    def _attempts_text(self) -> str:
        if self._attempts_left >= MAX_ATTEMPTS:
            return ""
        return f"Còn {self._attempts_left} lần thử"

    def _center_on_screen(self) -> None:
        self.update_idletasks()
        w, h = 380, 460
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")
