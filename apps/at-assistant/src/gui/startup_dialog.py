from __future__ import annotations

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.startup_service import StartupService


class StartupDialog(ctk.CTkToplevel):
    def __init__(self, master, *, palette: dict[str, str], on_message=None) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._service = StartupService()

        self.title("Khởi động cùng Windows")
        self.geometry("620x360")
        self.minsize(540, 320)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_SECONDARY"], corner_radius=14)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            shell,
            text="Khởi động cùng Windows",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        ctk.CTkLabel(
            shell,
            text=(
                "Khi bật, Windows sẽ tự mở AT Assistant sau khi đăng nhập.\n"
                "App sẽ vào khay hệ thống để workflow scheduled tiếp tục chạy nền."
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))

        self.enabled_switch = ctk.CTkSwitch(
            shell,
            text="Bật khởi động cùng Windows",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            progress_color=palette["ACCENT"],
        )
        self.enabled_switch.grid(row=2, column=0, sticky="w", padx=16, pady=(0, 12))

        self.status_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.status_label.grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 12))

        self.path_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=560,
        )
        self.path_label.grid(row=4, column=0, sticky="ew", padx=16, pady=(0, 18))

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=5, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu thiết lập",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._save_settings,
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

        self._refresh_status()

    def _refresh_status(self) -> None:
        status = self._service.get_status()
        if status["enabled"]:
            self.enabled_switch.select()
            message = "Đang bật. App sẽ tự mở ẩn xuống tray khi bạn đăng nhập Windows."
        else:
            self.enabled_switch.deselect()
            message = "Đang tắt. Nếu đóng app hoàn toàn thì workflow scheduled sẽ không tự chạy."
        self.status_label.configure(text=message)
        self.path_label.configure(text=f"Shortcut Startup: {status['shortcut_path']}")

    def _save_settings(self) -> None:
        try:
            if self.enabled_switch.get():
                status = self._service.enable()
                message = "Đã bật khởi động cùng Windows."
            else:
                status = self._service.disable()
                message = "Đã tắt khởi động cùng Windows."
            self._refresh_status()
            if self._on_message:
                self._on_message(message, "success")
        except Exception as exc:
            self.status_label.configure(text=f"Lỗi cấu hình startup: {exc}", text_color=self._palette["FG_ERROR"])
