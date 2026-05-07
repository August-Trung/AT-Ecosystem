from __future__ import annotations

from datetime import datetime

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE


class ReminderPopup(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        reminder: dict,
        extra_due_count: int = 0,
        on_done,
        on_snooze,
        on_open_list,
        on_dismiss,
    ) -> None:
        super().__init__(master)
        self._master = master
        self._palette = palette
        self._reminder = reminder
        self._on_done = on_done
        self._on_snooze = on_snooze
        self._on_open_list = on_open_list
        self._on_dismiss = on_dismiss
        self._closing = False
        self._alpha = 0.0
        self._extra_due_count = max(int(extra_due_count or 0), 0)
        self._width = 392

        self.overrideredirect(True)
        self.attributes("-topmost", True)
        self.attributes("-alpha", self._alpha)
        self.configure(fg_color=palette["BG_SECONDARY"])
        self.resizable(False, False)
        self.protocol("WM_DELETE_WINDOW", self._dismiss)

        container = ctk.CTkFrame(
            self,
            fg_color=palette["BG_SECONDARY"],
            border_width=1,
            border_color=palette["BORDER_COLOR"],
            corner_radius=18,
        )
        container.pack(fill="both", expand=True, padx=2, pady=2)

        body = ctk.CTkFrame(container, fg_color="transparent")
        body.pack(fill="both", expand=True, padx=14, pady=14)
        body.grid_columnconfigure(1, weight=1)

        accent_bar = ctk.CTkFrame(
            body,
            fg_color=palette["ACCENT_CONFIRM"],
            width=6,
            corner_radius=18,
        )
        accent_bar.grid(row=0, column=0, rowspan=5, sticky="ns", padx=(0, 12))

        content = ctk.CTkFrame(body, fg_color="transparent")
        content.grid(row=0, column=1, sticky="nsew")
        content.grid_columnconfigure((0, 1), weight=1)

        header = ctk.CTkFrame(content, fg_color="transparent")
        header.grid(row=0, column=0, columnspan=2, sticky="ew")
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            header,
            text="Reminder đến hạn",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w")

        ctk.CTkButton(
            header,
            text="X",
            width=28,
            height=28,
            corner_radius=14,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_SECONDARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._dismiss,
        ).grid(row=0, column=1, sticky="e")

        reminder_title = (reminder.get("title") or reminder.get("message") or "Reminder").strip()
        due_at = self._format_due_at(reminder.get("due_at"))
        message = (reminder.get("message") or reminder_title).strip()

        ctk.CTkLabel(
            content,
            text=reminder_title,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
            justify="left",
            wraplength=316,
        ).grid(row=1, column=0, columnspan=2, sticky="ew", pady=(12, 4))

        if due_at:
            ctk.CTkLabel(
                content,
                text=f"Đến hạn: {due_at}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=palette["FG_SECONDARY"],
                anchor="w",
                justify="left",
                wraplength=316,
            ).grid(row=2, column=0, columnspan=2, sticky="ew", pady=(0, 8))

        info_text = ""
        if message and message != reminder_title:
            info_text = message
        elif self._extra_due_count:
            info_text = f"Có thêm {self._extra_due_count} reminder khác đang đến hạn."
        else:
            info_text = "Bạn có thể hoàn thành, snooze hoặc mở danh sách reminder."

        ctk.CTkLabel(
            content,
            text=info_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=316,
        ).grid(row=3, column=0, columnspan=2, sticky="ew", pady=(0, 12))

        primary_actions = ctk.CTkFrame(content, fg_color="transparent")
        primary_actions.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(2, 8))
        primary_actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            primary_actions,
            text="Xong",
            height=38,
            corner_radius=12,
            fg_color=palette["ACCENT_CONFIRM"],
            hover_color=palette["ACCENT_CONFIRM_HOVER"],
            text_color="#ffffff",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            command=self._done,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 5))

        ctk.CTkButton(
            primary_actions,
            text="Mở danh sách",
            height=38,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            command=self._open_list,
        ).grid(row=0, column=1, sticky="ew", padx=(5, 0))

        ctk.CTkLabel(
            content,
            text="Nhắc lại nhanh",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=5, column=0, columnspan=2, sticky="ew", pady=(0, 6))

        snooze_actions = ctk.CTkFrame(content, fg_color="transparent")
        snooze_actions.grid(row=6, column=0, columnspan=2, sticky="ew")
        snooze_actions.grid_columnconfigure((0, 1, 2, 3), weight=1)

        snooze_specs = [
            ("5p", 5),
            ("10p", 10),
            ("30p", 30),
            ("Đóng", None),
        ]
        for index, (label, minutes) in enumerate(snooze_specs):
            is_close = minutes is None
            ctk.CTkButton(
                snooze_actions,
                text=label,
                height=34,
                corner_radius=11,
                fg_color=palette["ACCENT_CHOICE"] if is_close else palette["ACCENT"],
                hover_color=palette["ACCENT_CHOICE_HOVER"] if is_close else palette["ACCENT_HOVER"],
                text_color=palette["FG_PRIMARY"] if is_close else "#ffffff",
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                command=self._dismiss if is_close else (lambda value=minutes: self._snooze(value)),
            ).grid(row=0, column=index, sticky="ew", padx=3)

        self.after(10, self._apply_geometry)
        self.after(25, self._animate_in)

    def _apply_geometry(self) -> None:
        if not self.winfo_exists():
            return
        self.update_idletasks()
        height = max(286, min(self.winfo_reqheight() + 8, 360))
        self.geometry(self._compute_geometry(self._master, self._width, height))

    def _compute_geometry(self, master, width: int, height: int) -> str:
        master.update_idletasks()
        x = master.winfo_x() + max(master.winfo_width() - width - 20, 20)
        y = master.winfo_y() + 70
        return f"{width}x{height}+{x}+{y}"

    def _format_due_at(self, raw_due_at) -> str:
        value = str(raw_due_at or "").strip()
        if not value:
            return ""
        try:
            due_at = datetime.fromisoformat(value)
        except ValueError:
            return value
        time_fmt = "%H:%M:%S" if due_at.second else "%H:%M"
        return due_at.strftime(f"{time_fmt} %d/%m/%Y")

    def _animate_in(self) -> None:
        if self._closing or not self.winfo_exists():
            return
        self._alpha = min(self._alpha + 0.16, 1.0)
        self.attributes("-alpha", self._alpha)
        if self._alpha < 1.0:
            self.after(18, self._animate_in)

    def _animate_out(self, callback) -> None:
        if self._closing:
            return
        self._closing = True
        self._fade_out(callback)

    def _fade_out(self, callback) -> None:
        if not self.winfo_exists():
            return
        self._alpha = max(self._alpha - 0.2, 0.0)
        self.attributes("-alpha", self._alpha)
        if self._alpha > 0.0:
            self.after(16, lambda: self._fade_out(callback))
            return
        callback()
        self.destroy()

    def _done(self) -> None:
        self._animate_out(lambda: self._on_done(self._reminder))

    def _snooze(self, minutes: int) -> None:
        self._animate_out(lambda: self._on_snooze(self._reminder, minutes))

    def _open_list(self) -> None:
        self._animate_out(lambda: self._on_open_list(self._reminder))

    def _dismiss(self) -> None:
        self._animate_out(lambda: self._on_dismiss(self._reminder))
