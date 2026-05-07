# src/gui/input_frame.py
"""Input bar with text entry, action menu, send button, voice toggle, and command history."""

from __future__ import annotations

from typing import Callable, List, Optional

import customtkinter as ctk

from src.gui.theme import (
    ACCENT,
    ACCENT_HOVER,
    BG_INPUT,
    BG_PRIMARY,
    FG_PLACEHOLDER,
    FG_PRIMARY,
    FG_ERROR,
    FONT_FAMILY,
    FONT_SIZE_NORMAL,
    INPUT_HEIGHT,
    get_theme_palette,
)


class UpwardCTkOptionMenu(ctk.CTkOptionMenu):
    """Option menu that opens above the trigger without covering it."""

    def _open_dropdown_menu(self):
        values = getattr(self, "_values", []) or []
        item_height = self._apply_widget_scaling(30)
        menu_height = max(1, len(values)) * item_height
        gap = self._apply_widget_scaling(8)
        x = self.winfo_rootx()
        y = self.winfo_rooty() - menu_height - gap
        top_limit = self.winfo_toplevel().winfo_rooty() + gap
        if y < top_limit:
            y = self.winfo_rooty() + self._apply_widget_scaling(self._current_height) + gap
        self._dropdown_menu.open(x, y)


class InputFrame(ctk.CTkFrame):
    """Bottom bar: text entry + send button + voice toggle + command history."""

    def __init__(
        self,
        master,
        on_send: Callable[[str], None],
        on_stop: Optional[Callable[[], None]] = None,
        on_mic_toggle: Optional[Callable[[bool], None]] = None,
        on_pick_excel: Optional[Callable[[], None]] = None,
        on_open_send_email: Optional[Callable[[], None]] = None,
        on_open_reminder: Optional[Callable[[], None]] = None,
        on_manage_drive: Optional[Callable[[], None]] = None,
        on_manage_voice: Optional[Callable[[], None]] = None,
        on_manage_workflows: Optional[Callable[[], None]] = None,
        on_manage_email_auto_checks: Optional[Callable[[], None]] = None,
        on_manage_startup: Optional[Callable[[], None]] = None,
        on_manage_custom_apps: Optional[Callable[[], None]] = None,
        on_open_settings: Optional[Callable[[], None]] = None,
        on_view_history: Optional[Callable[[], None]] = None,
        on_stop_speech: Optional[Callable[[], None]] = None,
        **kwargs,
    ):
        super().__init__(master, fg_color=BG_PRIMARY, **kwargs)
        self._on_send = on_send
        self._on_stop = on_stop
        self._on_mic_toggle = on_mic_toggle
        self._on_pick_excel = on_pick_excel
        self._on_open_send_email = on_open_send_email
        self._on_open_reminder = on_open_reminder
        self._on_manage_drive = on_manage_drive
        self._on_manage_voice = on_manage_voice
        self._on_manage_workflows = on_manage_workflows
        self._on_manage_email_auto_checks = on_manage_email_auto_checks
        self._on_manage_startup = on_manage_startup
        self._on_manage_custom_apps = on_manage_custom_apps
        self._on_open_settings = on_open_settings
        self._on_view_history = on_view_history
        self._on_stop_speech = on_stop_speech
        self._email_menu_default = "Tác vụ"
        self._placeholder_text = "Nhập lệnh... (Enter để gửi)"
        self._is_processing = False

        self._history: List[str] = []
        self._history_index: int = -1
        self._draft: str = ""
        self._mic_on = False
        self._palette = get_theme_palette("dark")

        self.grid_columnconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=0)

        self.compose_bar = ctk.CTkFrame(self, fg_color=BG_INPUT, corner_radius=10)
        self.compose_bar.grid(row=0, column=0, padx=(10, 4), pady=10, sticky="ew")
        self.compose_bar.grid_columnconfigure(2, weight=1)

        self.mic_btn = ctk.CTkButton(
            self.compose_bar,
            text="🎤",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 2),
            width=INPUT_HEIGHT,
            height=INPUT_HEIGHT - 4,
            fg_color=self._palette["MIC_OFF_COLOR"],
            hover_color=self._palette["MIC_OFF_HOVER"],
            corner_radius=10,
            border_width=0,
            command=self._toggle_mic,
        )
        self.mic_btn.grid(row=0, column=0, padx=(6, 4), pady=2)

        self.email_menu = UpwardCTkOptionMenu(
            self.compose_bar,
            values=[
                self._email_menu_default,
                "Gửi email",
                "Tạo reminder",
                "Workflow",
                "Kiểm tra mail tự động",
                "Ứng dụng đã lưu",
                "Cài đặt hệ thống",
                "Khởi động cùng Windows",
                "Gửi mail thư mời",
                "Quản lý Google Drive",
                "Gói giọng nói offline",
            ],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            dropdown_font=(FONT_FAMILY, FONT_SIZE_NORMAL + 2),
            width=182,
            height=INPUT_HEIGHT - 4,
            fg_color=self._palette["ACCENT"],
            button_color=self._palette["ACCENT"],
            button_hover_color=self._palette["ACCENT_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._handle_email_action,
        )
        self.email_menu.set(self._email_menu_default)
        self.email_menu.grid(row=0, column=1, padx=(0, 6), pady=2)

        self.entry = ctk.CTkEntry(
            self.compose_bar,
            placeholder_text=self._placeholder_text,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=INPUT_HEIGHT - 4,
            fg_color=BG_INPUT,
            text_color=FG_PRIMARY,
            placeholder_text_color=FG_PLACEHOLDER,
            border_width=0,
            corner_radius=10,
        )
        self.entry.grid(row=0, column=2, padx=(0, 8), pady=2, sticky="ew")
        self.entry.bind("<Return>", self._handle_enter)
        self.entry.bind("<Up>", self._history_prev)
        self.entry.bind("<Down>", self._history_next)

        self.send_btn = ctk.CTkButton(
            self,
            text="Gửi",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            width=86,
            height=INPUT_HEIGHT,
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            text_color="#ffffff",
            corner_radius=10,
            command=self._handle_click,
        )
        self.send_btn.grid(row=0, column=1, padx=(0, 4), pady=10, sticky="ns")

        self.stop_speech_btn = ctk.CTkButton(
            self,
            text="🔇",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 4),
            width=42,
            height=INPUT_HEIGHT,
            fg_color="#ef4444",
            hover_color="#b91c1c",
            text_color="#ffffff",
            corner_radius=10,
            command=self._handle_stop_speech,
        )
        # Hidden by default; will appear in column 2 when speech is active

        self.status_label = ctk.CTkLabel(
            self,
            text="",
            font=(FONT_FAMILY, 10),
            text_color=FG_PLACEHOLDER,
            height=14,
        )
        self.status_label.grid(row=1, column=0, columnspan=3, padx=10, pady=(0, 4), sticky="w")

    def set_enabled(self, enabled: bool) -> None:
        state = "normal" if enabled else "disabled"
        self.entry.configure(state=state)
        self.email_menu.configure(state=state)
        self.send_btn.configure(state="normal" if self._is_processing else state)

    def set_processing(self, processing: bool) -> None:
        self._is_processing = processing
        if processing:
            self.send_btn.configure(
                text="Dừng",
                fg_color=FG_ERROR,
                hover_color="#b91c1c",
                command=self._handle_stop,
                state="normal",
            )
        else:
            self.send_btn.configure(
                text="Gửi",
                fg_color=ACCENT,
                hover_color=ACCENT_HOVER,
                command=self._handle_click,
                state="normal",
            )

    def focus_input(self) -> None:
        self.entry.focus_set()
        if hasattr(self.entry, "focus_force"):
            self.entry.focus_force()

    def clear(self) -> None:
        self.entry.delete(0, "end")

    def set_status(self, text: str, color: str = "") -> None:
        self.status_label.configure(text=text)
        self.status_label.configure(text_color=color or FG_PLACEHOLDER)

    def set_mic_state(self, is_on: bool) -> None:
        self._mic_on = is_on
        if is_on:
            self.mic_btn.configure(
                fg_color=self._palette["MIC_ON_COLOR"],
                hover_color=self._palette["MIC_ON_HOVER"],
            )
        else:
            self.mic_btn.configure(
                fg_color=self._palette["MIC_OFF_COLOR"],
                hover_color=self._palette["MIC_OFF_HOVER"],
            )

    def apply_theme(self, palette: dict[str, str]) -> None:
        self._palette = palette
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.compose_bar.configure(fg_color=palette["BG_INPUT"])
        self.entry.configure(
            fg_color=palette["BG_INPUT"],
            text_color=palette["FG_PRIMARY"],
            placeholder_text_color=palette["FG_PLACEHOLDER"],
        )
        self.send_btn.configure(
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
        )
        self.email_menu.configure(
            fg_color=palette["ACCENT"],
            button_color=palette["ACCENT"],
            button_hover_color=palette["ACCENT_HOVER"],
            dropdown_fg_color=palette["BG_PRIMARY"],
            dropdown_hover_color=palette["ACCENT_HOVER"],
            dropdown_text_color=palette["FG_PRIMARY"],
            text_color="#ffffff",
        )
        self.status_label.configure(text_color=palette["FG_PLACEHOLDER"])
        self.set_mic_state(self._mic_on)

    def show_stop_speech(self) -> None:
        """Show the stop-speech button when TTS is playing."""
        self.stop_speech_btn.grid(row=0, column=2, padx=(0, 10), pady=10, sticky="ns")

    def hide_stop_speech(self) -> None:
        """Hide the stop-speech button when TTS is not playing."""
        self.stop_speech_btn.grid_forget()

    def _history_prev(self, event=None) -> str:
        if not self._history:
            return "break"
        if self._history_index == -1:
            self._draft = self._read_entry_text()
        if self._history_index < len(self._history) - 1:
            self._history_index += 1
        self._set_entry_text(self._history[self._history_index])
        return "break"

    def _history_next(self, event=None) -> str:
        if self._history_index == -1:
            return "break"
        self._history_index -= 1
        if self._history_index < 0:
            self._history_index = -1
            self._set_entry_text(self._draft)
        else:
            self._set_entry_text(self._history[self._history_index])
        return "break"

    def _set_entry_text(self, text: str) -> None:
        self.entry.delete(0, "end")
        clean_text = (text or "").strip()
        if clean_text and clean_text != self._placeholder_text:
            self.entry.insert(0, clean_text)

    def _read_entry_text(self) -> str:
        text = (self.entry.get() or "").strip()
        return "" if text == self._placeholder_text else text

    def _toggle_mic(self) -> None:
        self._mic_on = not self._mic_on
        self.set_mic_state(self._mic_on)
        if self._mic_on:
            self.set_status("🎤 Mic đang bật, hãy nói lệnh.", self._palette["MIC_ON_COLOR"])
        else:
            self.set_status("")
        if self._on_mic_toggle:
            self._on_mic_toggle(self._mic_on)

    def _pick_excel(self) -> None:
        if self._on_pick_excel:
            self._on_pick_excel()

    def _open_send_email(self) -> None:
        if self._on_open_send_email:
            self._on_open_send_email()

    def _open_reminder(self) -> None:
        if self._on_open_reminder:
            self._on_open_reminder()

    def _manage_drive(self) -> None:
        if self._on_manage_drive:
            self._on_manage_drive()

    def _manage_voice(self) -> None:
        if self._on_manage_voice:
            self._on_manage_voice()

    def _manage_workflows(self) -> None:
        if self._on_manage_workflows:
            self._on_manage_workflows()

    def _manage_email_auto_checks(self) -> None:
        if self._on_manage_email_auto_checks:
            self._on_manage_email_auto_checks()

    def _manage_startup(self) -> None:
        if self._on_manage_startup:
            self._on_manage_startup()

    def _manage_custom_apps(self) -> None:
        if self._on_manage_custom_apps:
            self._on_manage_custom_apps()

    def _view_history(self) -> None:
        if self._on_view_history:
            self._on_view_history()

    def _open_settings(self) -> None:
        if self._on_open_settings:
            self._on_open_settings()

    def _handle_stop_speech(self) -> None:
        if self._on_stop_speech:
            self._on_stop_speech()

    def _handle_email_action(self, choice: str) -> None:
        if choice == "Gửi email":
            self._open_send_email()
        elif choice == "Tạo reminder":
            self._open_reminder()
        elif choice == "Workflow":
            self._manage_workflows()
        elif choice == "Kiểm tra mail tự động":
            self._manage_email_auto_checks()
        elif choice == "Ứng dụng đã lưu":
            self._manage_custom_apps()
        elif choice == "Cài đặt hệ thống":
            self._open_settings()
        elif choice == "Khởi động cùng Windows":
            self._manage_startup()
        elif choice == "Gửi mail thư mời":
            self._pick_excel()
        elif choice == "Quản lý Google Drive":
            self._manage_drive()
        elif choice == "Gói giọng nói offline":
            self._manage_voice()
        self.email_menu.set(self._email_menu_default)

    def _handle_enter(self, event=None) -> None:
        self._submit()

    def _handle_click(self) -> None:
        self._submit()

    def _handle_stop(self) -> None:
        if self._on_stop:
            self._on_stop()

    def _submit(self) -> None:
        text = self._read_entry_text()
        if not text:
            return
        self.entry.delete(0, "end")

        if not self._history or self._history[0] != text:
            self._history.insert(0, text)
            if len(self._history) > 50:
                self._history.pop()

        self._history_index = -1
        self._draft = ""
        self._on_send(text)
