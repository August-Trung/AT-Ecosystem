"""
pin_manage_dialog.py — Dialog quản lý PIN trong Settings Hub.

3 chế độ:
  - Chưa có PIN: form đặt PIN mới (nhập + xác nhận).
  - Đã có PIN: form đổi PIN (PIN cũ + PIN mới + xác nhận) + nút Xóa PIN.
  - Sau khi xóa: quay về chế độ đặt PIN mới.
"""

from __future__ import annotations

from typing import Callable

import customtkinter as ctk

from src.core.pin_service import PinService
from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE


class PinManageDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_message: Callable[[str, str], None] | None = None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._service = PinService()

        self.title("Bảo mật — Quản lý PIN")
        self.geometry("480x520")
        self.resizable(False, False)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        self._build_ui()
        self._center_on_screen()

    # ================================================================
    # Build UI
    # ================================================================

    def _build_ui(self) -> None:
        p = self._palette

        shell = ctk.CTkFrame(self, fg_color=p["BG_SECONDARY"], corner_radius=14)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        # Tiêu đề
        ctk.CTkLabel(
            shell,
            text="Bảo mật — Quản lý PIN",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color=p["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 4))

        ctk.CTkLabel(
            shell,
            text=(
                "PIN 4–6 chữ số bảo vệ ứng dụng khi khởi động.\n"
                "Nếu quên PIN, bạn cần dùng Khôi phục cài đặt gốc để đặt lại."
            ),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=p["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=420,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 16))

        # ── Form area (thay đổi tùy chế độ) ──────────────────────
        self._form_frame = ctk.CTkFrame(shell, fg_color="transparent")
        self._form_frame.grid(row=2, column=0, sticky="ew", padx=16)
        self._form_frame.grid_columnconfigure(1, weight=1)

        # ── Thông báo ─────────────────────────────────────────────
        self._msg_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=p["FG_ERROR"],
            anchor="w",
            justify="left",
            wraplength=420,
        )
        self._msg_label.grid(row=3, column=0, sticky="ew", padx=16, pady=(8, 0))

        # ── Action buttons ─────────────────────────────────────────
        self._action_frame = ctk.CTkFrame(shell, fg_color="transparent")
        self._action_frame.grid(row=4, column=0, sticky="ew", padx=16, pady=(12, 16))
        self._action_frame.grid_columnconfigure((0, 1), weight=1)

        # ── Danger zone (xóa PIN) — chỉ hiện khi đã có PIN ────────
        self._danger_frame = ctk.CTkFrame(
            shell,
            fg_color="#2a0909",
            border_width=1,
            border_color="#dc2626",
            corner_radius=10,
        )
        self._danger_frame.grid(row=5, column=0, sticky="ew", padx=16, pady=(4, 16))
        self._danger_frame.grid_columnconfigure(0, weight=1)

        self._render_form()

    def _render_form(self) -> None:
        """Render lại form tùy theo trạng thái PIN hiện tại."""
        p = self._palette
        # Xóa nội dung cũ
        for widget in self._form_frame.winfo_children():
            widget.destroy()
        for widget in self._action_frame.winfo_children():
            widget.destroy()
        for widget in self._danger_frame.winfo_children():
            widget.destroy()

        self._msg_label.configure(text="")

        if self._service.is_pin_set():
            self._render_change_form(p)
        else:
            self._render_set_form(p)

    # ── Chế độ: Đặt PIN mới ──────────────────────────────────────

    def _render_set_form(self, p: dict) -> None:
        ctk.CTkLabel(
            self._form_frame,
            text="Trạng thái:",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=p["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w", pady=4)
        ctk.CTkLabel(
            self._form_frame,
            text="Chưa đặt PIN",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=p["FG_SUCCESS"],
            anchor="w",
        ).grid(row=0, column=1, sticky="w", padx=8, pady=4)

        self._new_pin = self._pin_row(self._form_frame, "PIN mới (4–6 số):", row=1)
        self._confirm_pin = self._pin_row(self._form_frame, "Xác nhận PIN:", row=2)
        self._confirm_pin.bind("<Return>", lambda _e: self._do_set_pin())

        # Nút Đặt PIN
        ctk.CTkButton(
            self._action_frame,
            text="Đặt PIN",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=p["ACCENT"],
            hover_color=p["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._do_set_pin,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))
        ctk.CTkButton(
            self._action_frame,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=p["ACCENT_CHOICE"],
            hover_color=p["ACCENT_CHOICE_HOVER"],
            text_color=p["FG_PRIMARY"],
            corner_radius=10,
            command=self.destroy,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

        # Ẩn danger zone khi chưa có PIN
        self._danger_frame.grid_remove()

    # ── Chế độ: Đổi PIN ──────────────────────────────────────────

    def _render_change_form(self, p: dict) -> None:
        ctk.CTkLabel(
            self._form_frame,
            text="Trạng thái:",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=p["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w", pady=4)
        ctk.CTkLabel(
            self._form_frame,
            text="PIN đang bật  🔒",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=p["ACCENT"],
            anchor="w",
        ).grid(row=0, column=1, sticky="w", padx=8, pady=4)

        self._old_pin = self._pin_row(self._form_frame, "PIN hiện tại:", row=1)
        self._new_pin = self._pin_row(self._form_frame, "PIN mới (4–6 số):", row=2)
        self._confirm_pin = self._pin_row(self._form_frame, "Xác nhận PIN mới:", row=3)
        self._confirm_pin.bind("<Return>", lambda _e: self._do_change_pin())

        # Nút Đổi PIN
        ctk.CTkButton(
            self._action_frame,
            text="Đổi PIN",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=p["ACCENT"],
            hover_color=p["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._do_change_pin,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))
        ctk.CTkButton(
            self._action_frame,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=p["ACCENT_CHOICE"],
            hover_color=p["ACCENT_CHOICE_HOVER"],
            text_color=p["FG_PRIMARY"],
            corner_radius=10,
            command=self.destroy,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

        # Danger zone: xóa PIN
        self._danger_frame.grid()
        ctk.CTkLabel(
            self._danger_frame,
            text="Xóa PIN — App sẽ không yêu cầu xác thực khi khởi động.",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color="#fca5a5",
            anchor="w",
            justify="left",
            wraplength=380,
        ).grid(row=0, column=0, sticky="ew", padx=12, pady=(10, 4))
        ctk.CTkButton(
            self._danger_frame,
            text="Xóa PIN",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color="#dc2626",
            hover_color="#ef4444",
            text_color="#ffffff",
            corner_radius=8,
            height=32,
            command=self._do_clear_pin,
        ).grid(row=1, column=0, sticky="w", padx=12, pady=(4, 10))

    # ================================================================
    # Actions
    # ================================================================

    def _do_set_pin(self) -> None:
        new_pin = self._new_pin.get().strip()
        confirm = self._confirm_pin.get().strip()
        if new_pin != confirm:
            self._error("PIN xác nhận không khớp.")
            return
        try:
            self._service.set_pin(new_pin)
            self._success("Đã đặt PIN thành công. App sẽ yêu cầu PIN khi khởi động.")
            self._render_form()
        except ValueError as exc:
            self._error(str(exc))

    def _do_change_pin(self) -> None:
        old_pin = self._old_pin.get().strip()
        new_pin = self._new_pin.get().strip()
        confirm = self._confirm_pin.get().strip()
        if new_pin != confirm:
            self._error("PIN mới và xác nhận không khớp.")
            return
        try:
            self._service.change_pin(old_pin, new_pin)
            self._success("Đã đổi PIN thành công.")
            self._render_form()
        except ValueError as exc:
            self._error(str(exc))

    def _do_clear_pin(self) -> None:
        import tkinter.messagebox as mb
        if not mb.askyesno(
            "Xóa PIN",
            "Bạn có chắc muốn xóa PIN?\nApp sẽ không yêu cầu xác thực khi khởi động nữa.",
            parent=self,
        ):
            return
        self._service.clear_pin()
        self._success("Đã xóa PIN.")
        self._render_form()

    # ================================================================
    # Helpers
    # ================================================================

    def _pin_row(self, parent: ctk.CTkFrame, label: str, *, row: int) -> ctk.CTkEntry:
        p = self._palette
        ctk.CTkLabel(
            parent,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=p["FG_SECONDARY"],
            anchor="w",
        ).grid(row=row, column=0, sticky="w", pady=4)
        entry = ctk.CTkEntry(
            parent,
            show="●",
            width=200,
            height=36,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            fg_color=p["BG_INPUT"],
            border_color=p["BORDER_COLOR"],
            text_color=p["FG_PRIMARY"],
            corner_radius=8,
        )
        entry.grid(row=row, column=1, sticky="ew", padx=(8, 0), pady=4)
        return entry

    def _error(self, msg: str) -> None:
        self._msg_label.configure(text=msg, text_color=self._palette["FG_ERROR"])

    def _success(self, msg: str) -> None:
        self._msg_label.configure(text=msg, text_color=self._palette["FG_SUCCESS"])
        if self._on_message:
            self._on_message(msg, "success")

    def _center_on_screen(self) -> None:
        self.update_idletasks()
        w, h = 480, 520
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")
