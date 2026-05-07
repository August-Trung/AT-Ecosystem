from __future__ import annotations

import tkinter.messagebox as messagebox

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.factory_reset_service import FactoryResetService


class FactoryResetDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_message=None,
        on_complete=None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._on_complete = on_complete
        self._service = FactoryResetService()
        self._status = self._service.get_status()

        self.title("Khôi phục cài đặt gốc")
        self.geometry("680x440")
        self.minsize(600, 400)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(
            self,
            fg_color="#2a0909",
            border_width=1,
            border_color="#dc2626",
            corner_radius=14,
        )
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            shell,
            text="Khôi phục cài đặt gốc",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color="#fecaca",
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        ctk.CTkLabel(
            shell,
            text=(
                "Thao tác này sẽ đưa AT Assistant về trạng thái như mới cài. "
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color="#fca5a5",
            anchor="w",
            justify="left",
            wraplength=620,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))

        impact = (
            "Sẽ xóa:\n"
            "- Cài đặt hệ thống, theme, wakeword\n"
            "- Lịch sử chat, reminder, workflow, custom apps\n"
            "- Gmail/Drive token và cấu hình tích hợp\n"
            "- Gói voice offline đã tải về\n\n"
        )
        ctk.CTkLabel(
            shell,
            text=impact,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
            justify="left",
            wraplength=620,
        ).grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 14))

        details = (
            f"Dữ liệu sẽ xóa: {self._status['app_data_path']}\n"
            f"Startup shortcut: {self._status['startup_shortcut_path']}"
        )
        ctk.CTkLabel(
            shell,
            text=details,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color="#fca5a5",
            anchor="w",
            justify="left",
            wraplength=620,
        ).grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 18))

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=4, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Khôi phục cài đặt gốc",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CANCEL"],
            hover_color=palette["ACCENT_CANCEL_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._confirm_reset,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=10,
            command=self.destroy,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

    def _confirm_reset(self) -> None:
        confirmed = messagebox.askyesno(
            "Khôi phục cài đặt gốc",
            (
                "Bạn chắc chắn muốn khôi phục cài đặt gốc?\n\n"
                "Thao tác này không thể hoàn tác."
            ),
            parent=self,
        )
        if not confirmed:
            return

        try:
            result = self._service.schedule_reset(disable_startup=True)
        except Exception as exc:
            if self._on_message:
                self._on_message(f"Không thể khôi phục cài đặt gốc: {exc}", "error")
            return

        if self._on_message:
            self._on_message(
                "Đã lên lịch khôi phục cài đặt gốc. AT Assistant sẽ thoát để hoàn tất dọn dữ liệu.",
                "success",
            )
        self.grab_release()
        if callable(self._on_complete):
            self._on_complete(result)
            return
        self.destroy()
