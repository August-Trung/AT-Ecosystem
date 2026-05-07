from __future__ import annotations

import threading

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.integrations.telegram_bot import TelegramBotConfig, check_telegram_connection
from src.integrations.telegram_settings import TelegramSettingsStore


class TelegramBotDialog(ctk.CTkToplevel):
    def __init__(self, master, *, palette: dict[str, str], on_message=None, on_saved=None) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._on_saved = on_saved
        self._store = TelegramSettingsStore()
        settings = self._store.load()

        self.title("Telegram Bot Bridge")
        self.geometry("700x560")
        self.minsize(620, 500)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        self.bot_name_var = ctk.StringVar(value=str(settings.get("bot_name") or ""))
        self.token_var = ctk.StringVar(value=str(settings.get("bot_token") or ""))
        self.user_ids_var = ctk.StringVar(value=str(settings.get("allowed_user_ids") or ""))
        self.chat_ids_var = ctk.StringVar(value=str(settings.get("allowed_chat_ids") or ""))
        self.prefix_var = ctk.StringVar(value=str(settings.get("command_prefix") or "/at"))
        self.timeout_var = ctk.StringVar(value=str(settings.get("poll_timeout") or 30))
        self.status_var = ctk.StringVar(value="")

        shell = ctk.CTkFrame(self, fg_color=palette["BG_SECONDARY"], corner_radius=14)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            shell,
            text="Telegram Bot Bridge",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        ctk.CTkLabel(
            shell,
            text=(
                "Lưu thông tin bot để app tự chạy bridge nền khi AT Assistant đang mở hoặc ẩn tray. "
                "User ID và Group/Chat ID có thể nhập nhiều giá trị, cách nhau bằng dấu phẩy."
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=640,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 14))

        row = 2
        self._entry_row(shell, "Tên bot", self.bot_name_var, row=row)
        row += 1
        self._entry_row(shell, "Token bot", self.token_var, row=row, show="*")
        row += 1
        self._entry_row(shell, "User ID được phép", self.user_ids_var, row=row)
        row += 1
        self._entry_row(shell, "Group/Chat ID được phép", self.chat_ids_var, row=row)
        row += 1
        self._entry_row(shell, "Command prefix", self.prefix_var, row=row)
        row += 1
        self._entry_row(shell, "Poll timeout giây", self.timeout_var, row=row)
        row += 1

        ctk.CTkLabel(
            shell,
            text="Allowlist rỗng sẽ deny toàn bộ. Token chỉ lưu local trên máy này, không đưa lên Git.",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=640,
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=(6, 10))
        row += 1

        ctk.CTkLabel(
            shell,
            textvariable=self.status_var,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=640,
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=(0, 12))
        row += 1

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=row, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1, 2), weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu cấu hình",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._save_settings,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        self.test_btn = ctk.CTkButton(
            actions,
            text="Lưu & kiểm tra",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._save_and_test,
        )
        self.test_btn.grid(row=0, column=1, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=10,
            command=self.destroy,
        ).grid(row=0, column=2, sticky="ew", padx=(4, 0))

    def _entry_row(self, master, label: str, variable: ctk.StringVar, *, row: int, show: str | None = None) -> None:
        wrap = ctk.CTkFrame(master, fg_color="transparent")
        wrap.grid(row=row, column=0, sticky="ew", padx=16, pady=5)
        wrap.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(
            wrap,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            width=170,
        ).grid(row=0, column=0, sticky="w", padx=(0, 10))
        ctk.CTkEntry(
            wrap,
            textvariable=variable,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            show=show,
        ).grid(row=0, column=1, sticky="ew")

    def _build_settings_payload(self) -> dict:
        try:
            timeout = int((self.timeout_var.get() or "30").strip())
        except ValueError:
            timeout = 30
        return {
            "bot_name": self.bot_name_var.get(),
            "bot_token": self.token_var.get(),
            "allowed_user_ids": self.user_ids_var.get(),
            "allowed_chat_ids": self.chat_ids_var.get(),
            "command_prefix": self.prefix_var.get(),
            "poll_timeout": timeout,
        }

    def _save_current_settings(self) -> dict:
        settings = self._store.save(self._build_settings_payload())
        if self._on_saved:
            self._on_saved()
        return settings

    def _config_from_settings(self, settings: dict) -> TelegramBotConfig:
        return TelegramBotConfig.from_env(
            {
                "TELEGRAM_BOT_NAME": str(settings.get("bot_name") or ""),
                "TELEGRAM_BOT_TOKEN": str(settings.get("bot_token") or ""),
                "TELEGRAM_ALLOWED_USER_IDS": str(settings.get("allowed_user_ids") or ""),
                "TELEGRAM_ALLOWED_CHAT_IDS": str(settings.get("allowed_chat_ids") or ""),
                "TELEGRAM_COMMAND_PREFIX": str(settings.get("command_prefix") or "/at"),
                "TELEGRAM_POLL_TIMEOUT": str(settings.get("poll_timeout") or 30),
            }
        )

    def _save_settings(self) -> None:
        self._save_current_settings()
        if self._on_message:
            self._on_message("Đã lưu cấu hình Telegram Bot Bridge.", "success")
        self.destroy()

    def _save_and_test(self) -> None:
        settings = self._save_current_settings()
        config = self._config_from_settings(settings)
        self.status_var.set("Đang kiểm tra Telegram bot và gửi tin test...")
        self.test_btn.configure(state="disabled")

        def worker() -> None:
            result = check_telegram_connection(config)
            self.after(0, lambda: self._handle_test_result(result.ok, result.message))

        threading.Thread(target=worker, daemon=True).start()

    def _handle_test_result(self, ok: bool, message: str) -> None:
        if not self.winfo_exists():
            return
        self.test_btn.configure(state="normal")
        self.status_var.set(message)
        if self._on_message:
            self._on_message(message, "success" if ok else "error")
