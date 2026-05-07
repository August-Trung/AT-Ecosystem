from __future__ import annotations

import tkinter.messagebox as messagebox

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.uninstall_service import UninstallService


class UninstallDialog(ctk.CTkToplevel):
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
        self._service = UninstallService()
        self._status = self._service.get_status()

        self.title("Gỡ cài đặt AT Assistant")
        self.geometry("660x460")
        self.minsize(580, 400)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_SECONDARY"], corner_radius=14)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            shell,
            text="Gỡ cài đặt AT Assistant",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        ctk.CTkLabel(
            shell,
            text=(
                "Thao tác này sẽ tắt khởi động cùng Windows. Nếu đang chạy bản exe, "
                "app có thể tự xóa file exe sau khi bạn xác nhận và app thoát."
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=600,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))

        self.delete_data_var = ctk.BooleanVar(value=True)
        self.delete_exe_var = ctk.BooleanVar(value=bool(self._status["can_delete_executable"]))

        self.delete_data_switch = ctk.CTkSwitch(
            shell,
            text="Xóa dữ liệu trong LocalAppData (settings, chat, voice offline)",
            variable=self.delete_data_var,
            onvalue=True,
            offvalue=False,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            progress_color=palette["ACCENT"],
        )
        self.delete_data_switch.grid(row=2, column=0, sticky="w", padx=16, pady=(0, 10))

        self.delete_exe_switch = ctk.CTkSwitch(
            shell,
            text="Xóa file exe đang chạy sau khi app thoát",
            variable=self.delete_exe_var,
            onvalue=True,
            offvalue=False,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            progress_color=palette["ACCENT"],
        )
        self.delete_exe_switch.grid(row=3, column=0, sticky="w", padx=16, pady=(0, 10))
        if not self._status["can_delete_executable"]:
            self.delete_exe_switch.configure(state="disabled")
            self.delete_exe_var.set(False)

        details = (
            f"Startup shortcut: {self._status['startup_shortcut_path']}\n"
            f"Dữ liệu app: {self._status['app_data_path']}\n"
            f"File đang chạy: {self._status['executable_path']}"
        )
        if not self._status["is_packaged"]:
            details += "\nĐang chạy từ source Python nên app sẽ không tự xóa mã nguồn dự án."

        ctk.CTkLabel(
            shell,
            text=details,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=600,
        ).grid(row=4, column=0, sticky="ew", padx=16, pady=(4, 18))

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=5, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Gỡ cài đặt",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CANCEL"],
            hover_color=palette["ACCENT_CANCEL_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._confirm_uninstall,
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

    def _confirm_uninstall(self) -> None:
        confirmed = messagebox.askyesno(
            "Gỡ cài đặt AT Assistant",
            (
                "Bạn chắc chắn muốn gỡ cài đặt AT Assistant?\n\n"
                "App sẽ tắt startup shortcut và thoát sau khi lên lịch dọn dẹp."
            ),
            parent=self,
        )
        if not confirmed:
            return

        try:
            result = self._service.schedule_uninstall(
                delete_user_data=bool(self.delete_data_var.get()),
                delete_executable=bool(self.delete_exe_var.get()),
            )
        except Exception as exc:
            if self._on_message:
                self._on_message(f"Không thể gỡ cài đặt: {exc}", "error")
            return

        if self._on_message:
            self._on_message(
                "Đã lên lịch gỡ cài đặt. AT Assistant sẽ thoát để hoàn tất dọn dẹp.",
                "success",
            )
        self.grab_release()
        if callable(self._on_complete):
            self._on_complete(result)
            return
        self.destroy()
