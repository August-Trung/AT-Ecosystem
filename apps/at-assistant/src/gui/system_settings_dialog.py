from __future__ import annotations

import tkinter.messagebox as messagebox

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE


class SystemSettingsDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        settings: dict,
        module_sections: list[dict] | None = None,
        on_open_module=None,
        on_save=None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._settings = dict(settings or {})
        self._module_sections = list(module_sections or [])
        self._on_open_module = on_open_module
        self._on_save = on_save

        self.title("Cài đặt hệ thống")
        self.geometry("780x820")
        self.minsize(700, 640)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        shell.pack(fill="both", expand=True, padx=18, pady=18)

        ctk.CTkLabel(
            shell,
            text="Cài đặt hệ thống",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", pady=(0, 6))

        ctk.CTkLabel(
            shell,
            text=(
                "Hub trung tâm để quản lý giao diện, âm thanh, hồ sơ người dùng, "
                "wakeword, voice session và đi tới toàn bộ dialog cấu hình của từng module."
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            justify="left",
            anchor="w",
            wraplength=720,
        ).pack(fill="x", pady=(0, 14))

        body = ctk.CTkScrollableFrame(
            shell,
            fg_color=palette["BG_SECONDARY"],
            corner_radius=16,
        )
        body.pack(fill="both", expand=True)
        body.grid_columnconfigure(0, weight=1)

        self._display_name = ctk.StringVar(value=str(self._settings.get("display_name") or ""))
        self._appearance_mode = ctk.StringVar(value=str(self._settings.get("appearance_mode") or "dark"))
        self._widget_scale = ctk.DoubleVar(value=float(self._settings.get("widget_scale") or 1.0))
        self._speaker_enabled = ctk.BooleanVar(value=bool(self._settings.get("speaker_enabled", True)))
        self._wakeword_enabled = ctk.BooleanVar(value=bool(self._settings.get("wakeword_enabled", True)))
        self._wakeword_beep_enabled = ctk.BooleanVar(value=bool(self._settings.get("wakeword_beep_enabled", True)))
        self._wakeword_beep_frequency = ctk.IntVar(value=int(self._settings.get("wakeword_beep_frequency_hz") or 1046))
        self._wakeword_beep_duration = ctk.IntVar(value=int(self._settings.get("wakeword_beep_duration_ms") or 90))
        self._wakeword_phrase = ctk.StringVar(value=str(self._settings.get("wakeword_phrase") or "Hải ơi"))
        self._prompt_normal = ctk.StringVar(value=str(self._settings.get("wakeword_prompt_normal") or "Dạ, mời bạn nói."))
        self._prompt_confirm = ctk.StringVar(value=str(self._settings.get("wakeword_prompt_confirm") or "Bạn đang ở bước xác nhận. Hãy nói đồng ý hoặc hủy."))
        self._prompt_choice = ctk.StringVar(value=str(self._settings.get("wakeword_prompt_choice") or "Bạn đang ở bước lựa chọn. Hãy nói số thứ tự hoặc hủy."))
        self._prompt_retry = ctk.StringVar(value=str(self._settings.get("wakeword_prompt_retry") or "Mình chưa nghe rõ. Hãy nói lại."))
        self._activation_threshold = ctk.DoubleVar(value=float(self._settings.get("wakeword_activation_threshold") or 0.012))
        self._continuation_threshold = ctk.DoubleVar(value=float(self._settings.get("wakeword_continuation_threshold") or 0.008))
        self._cooldown_sec = ctk.DoubleVar(value=float(self._settings.get("wakeword_cooldown_sec") or 2.0))
        self._cooldown_success_sec = ctk.DoubleVar(value=float(self._settings.get("wakeword_cooldown_success_sec") or 2.5))
        self._cooldown_no_speech_sec = ctk.DoubleVar(value=float(self._settings.get("wakeword_cooldown_no_speech_sec") or 1.0))
        self._cooldown_cancel_sec = ctk.DoubleVar(value=float(self._settings.get("wakeword_cooldown_cancel_sec") or 1.2))
        self._voice_pre_speech_timeout = ctk.DoubleVar(value=float(self._settings.get("voice_pre_speech_timeout_sec") or 4.0))
        self._voice_max_recording = ctk.DoubleVar(value=float(self._settings.get("voice_max_recording_sec") or 8.0))
        self._voice_session_max_retries = ctk.IntVar(value=int(self._settings.get("voice_session_max_retries") or 2))

        row = 0
        self._section_label(body, "Hồ sơ", row=row)
        row += 1
        self._entry_row(body, "Tên hiển thị", self._display_name, row=row)
        row += 1

        self._section_label(body, "Giao diện", row=row)
        row += 1
        self._option_row(body, "Theme", self._appearance_mode, ["dark", "light"], row=row)
        row += 1
        self._slider_row(body, "Cỡ giao diện & chữ", self._widget_scale, row=row, from_=0.9, to=1.3, steps=4)
        row += 1

        self._section_label(body, "Âm thanh", row=row)
        row += 1
        self._switch_row(body, "Bật voice speaker", self._speaker_enabled, row=row)
        row += 1
        self._switch_row(body, "Beep trước prompt wakeword", self._wakeword_beep_enabled, row=row)
        row += 1
        self._slider_row(body, "Tần số beep (Hz)", self._wakeword_beep_frequency, row=row, from_=700, to=1600, steps=18, integer=True)
        row += 1
        self._slider_row(body, "Độ dài beep (ms)", self._wakeword_beep_duration, row=row, from_=40, to=160, steps=12, integer=True)
        row += 1

        self._section_label(body, "Wakeword", row=row)
        row += 1
        self._switch_row(body, "Bật wakeword", self._wakeword_enabled, row=row)
        row += 1
        self._entry_row(body, "Cụm wakeword", self._wakeword_phrase, row=row)
        row += 1
        self._entry_row(body, "Prompt bình thường", self._prompt_normal, row=row)
        row += 1
        self._entry_row(body, "Prompt xác nhận", self._prompt_confirm, row=row)
        row += 1
        self._entry_row(body, "Prompt lựa chọn", self._prompt_choice, row=row)
        row += 1
        self._entry_row(body, "Prompt nghe lại", self._prompt_retry, row=row)
        row += 1
        self._slider_row(body, "Ngưỡng kích hoạt", self._activation_threshold, row=row, from_=0.006, to=0.03, steps=12)
        row += 1
        self._slider_row(body, "Ngưỡng duy trì", self._continuation_threshold, row=row, from_=0.004, to=0.02, steps=8)
        row += 1
        self._slider_row(body, "Cooldown sau detect (giây)", self._cooldown_sec, row=row, from_=1.0, to=4.0, steps=6)
        row += 1
        self._slider_row(body, "Cooldown sau lượt thành công (giây)", self._cooldown_success_sec, row=row, from_=1.0, to=5.0, steps=8)
        row += 1
        self._slider_row(body, "Cooldown sau khi không nghe rõ (giây)", self._cooldown_no_speech_sec, row=row, from_=0.3, to=2.0, steps=17)
        row += 1
        self._slider_row(body, "Cooldown sau hủy/lỗi (giây)", self._cooldown_cancel_sec, row=row, from_=0.5, to=2.5, steps=10)
        row += 1

        self._section_label(body, "Voice session", row=row)
        row += 1
        self._slider_row(body, "Chờ bắt đầu nói (giây)", self._voice_pre_speech_timeout, row=row, from_=2.0, to=7.0, steps=10)
        row += 1
        self._slider_row(body, "Ghi tối đa (giây)", self._voice_max_recording, row=row, from_=4.0, to=12.0, steps=8)
        row += 1
        self._slider_row(body, "Số lần nghe lại", self._voice_session_max_retries, row=row, from_=0, to=3, steps=3, integer=True)
        row += 1

        self._section_label(body, "Trung tâm cấu hình", row=row)
        row += 1
        self._module_intro(body, row=row)
        row += 1
        for section in self._module_sections:
            row = self._module_section(body, section, row=row)

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.pack(fill="x", pady=(14, 0))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu cài đặt",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=12,
            command=self._save_settings,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 6))

        ctk.CTkButton(
            actions,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=12,
            command=self.destroy,
        ).grid(row=0, column=1, sticky="ew", padx=(6, 0))

    def _section_label(self, master, text: str, *, row: int) -> None:
        ctk.CTkLabel(
            master,
            text=text,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=(16, 6))

    def _entry_row(self, master, label: str, variable: ctk.StringVar, *, row: int) -> None:
        wrap = ctk.CTkFrame(master, fg_color="transparent")
        wrap.grid(row=row, column=0, sticky="ew", padx=16, pady=4)
        wrap.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(
            wrap,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=(0, 10))
        ctk.CTkEntry(wrap, textvariable=variable, font=(FONT_FAMILY, FONT_SIZE_NORMAL)).grid(row=0, column=1, sticky="ew")

    def _option_row(self, master, label: str, variable: ctk.StringVar, values: list[str], *, row: int) -> None:
        wrap = ctk.CTkFrame(master, fg_color="transparent")
        wrap.grid(row=row, column=0, sticky="ew", padx=16, pady=4)
        wrap.grid_columnconfigure(1, weight=1)
        ctk.CTkLabel(
            wrap,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=(0, 10))
        ctk.CTkOptionMenu(
            wrap,
            values=values,
            variable=variable,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            dropdown_font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        ).grid(row=0, column=1, sticky="ew")

    def _switch_row(self, master, label: str, variable: ctk.BooleanVar, *, row: int) -> None:
        ctk.CTkSwitch(
            master,
            text=label,
            variable=variable,
            onvalue=True,
            offvalue=False,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        ).grid(row=row, column=0, sticky="w", padx=16, pady=4)

    def _slider_row(
        self,
        master,
        label: str,
        variable,
        *,
        row: int,
        from_: float,
        to: float,
        steps: int,
        integer: bool = False,
    ) -> None:
        wrap = ctk.CTkFrame(master, fg_color="transparent")
        wrap.grid(row=row, column=0, sticky="ew", padx=16, pady=4)
        wrap.grid_columnconfigure(1, weight=1)
        value_label = ctk.CTkLabel(
            wrap,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="e",
            width=80,
        )

        def update_value(current: float) -> None:
            if integer:
                variable.set(int(round(float(current))))
                value_label.configure(text=str(int(round(float(current)))))
            else:
                variable.set(round(float(current), 3))
                value_label.configure(text=f"{float(variable.get()):.2f}")

        ctk.CTkLabel(
            wrap,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=(0, 10))
        ctk.CTkSlider(
            wrap,
            from_=from_,
            to=to,
            number_of_steps=steps,
            variable=variable,
            command=update_value,
            progress_color=self._palette["ACCENT"],
        ).grid(row=0, column=1, sticky="ew")
        value_label.grid(row=0, column=2, sticky="e", padx=(10, 0))
        update_value(variable.get())

    def _textbox_row(self, master, label: str, textbox: ctk.CTkTextbox, *, row: int) -> None:
        ctk.CTkLabel(
            master,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=(4, 4))
        textbox.grid(row=row + 1, column=0, sticky="ew", padx=16, pady=(0, 4))

    def _module_intro(self, master, *, row: int) -> None:
        ctk.CTkLabel(
            master,
            text=(
                "Giữ nguyên các dialog cũ nhưng gom đường dẫn quản lý về một nơi. "
                "Khi bấm vào một module, hub sẽ lưu cấu hình hiện tại trước rồi mở màn hình quản lý tương ứng."
            ),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=720,
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=(0, 6))

    def _module_section(self, master, section: dict, *, row: int) -> int:
        title = str(section.get("title") or "").strip()
        description = str(section.get("description") or "").strip()
        items = list(section.get("items") or [])
        if title:
            self._section_label(master, title, row=row)
            row += 1
        if description:
            ctk.CTkLabel(
                master,
                text=description,
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
                justify="left",
                wraplength=720,
            ).grid(row=row, column=0, sticky="ew", padx=16, pady=(0, 6))
            row += 1
        for item in items:
            self._module_card(master, item, row=row)
            row += 1
        return row

    def _module_card(self, master, item: dict, *, row: int) -> None:
        title = str(item.get("title") or "").strip()
        summary = str(item.get("summary") or "").strip()
        button_text = str(item.get("button_text") or "Quản lý").strip()
        action = item.get("command")
        danger = bool(item.get("danger"))
        card_color = "#2a0909" if danger else self._palette["BG_PRIMARY"]
        border_color = "#dc2626" if danger else card_color
        title_color = "#fecaca" if danger else self._palette["FG_PRIMARY"]
        summary_color = "#fca5a5" if danger else self._palette["FG_SECONDARY"]
        button_color = self._palette["ACCENT_CANCEL"] if danger else self._palette["ACCENT_CHOICE"]
        button_hover = self._palette["ACCENT_CANCEL_HOVER"] if danger else self._palette["ACCENT_CHOICE_HOVER"]
        button_text_color = "#ffffff" if danger else self._palette["FG_PRIMARY"]

        card = ctk.CTkFrame(
            master,
            fg_color=card_color,
            border_width=1 if danger else 0,
            border_color=border_color,
            corner_radius=14,
        )
        card.grid(row=row, column=0, sticky="ew", padx=16, pady=6)
        card.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            card,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=title_color,
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 4))

        ctk.CTkLabel(
            card,
            text=summary,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=summary_color,
            anchor="w",
            justify="left",
            wraplength=540,
        ).grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 12))

        ctk.CTkButton(
            card,
            text=button_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=button_color,
            hover_color=button_hover,
            text_color=button_text_color,
            width=128,
            corner_radius=10,
            command=lambda fn=action, item=item: self._open_module(fn, item=item),
            state="normal" if callable(action) else "disabled",
        ).grid(row=0, column=1, rowspan=2, sticky="e", padx=14, pady=14)

    def _open_module(self, command, *, item: dict | None = None) -> None:
        if item and item.get("danger"):
            title = str(item.get("title") or "Mục nguy hiểm").strip()
            summary = str(item.get("summary") or "").strip()
            confirmed = messagebox.askyesno(
                "Mục nguy hiểm",
                f"{title}\n\n{summary}\n\nTiếp tục mở màn hình này?",
                parent=self,
            )
            if not confirmed:
                return
            safe_item = dict(item)
            safe_item["danger"] = False
            return self._open_module(command, item=safe_item)
            confirmed = messagebox.askyesno(
                "Mục nguy hiểm",
                (
                    "Đây là mục gỡ cài đặt AT Assistant.\n\n"
                    "Tiếp tục mở màn hình gỡ cài đặt?"
                ),
                parent=self,
            )
            if not confirmed:
                return
        self._save_settings(close_dialog=False)
        master = self.master
        try:
            self.grab_release()
        except Exception:
            pass
        self.destroy()
        if callable(self._on_open_module):
            self._on_open_module(command)
            return
        if callable(command) and master is not None and master.winfo_exists():
            master.after(0, command)

    def _save_settings(self, *, close_dialog: bool = True) -> None:
        payload = {
            "display_name": self._display_name.get().strip(),
            "appearance_mode": self._appearance_mode.get().strip().lower() or "dark",
            "widget_scale": round(float(self._widget_scale.get() or 1.0), 2),
            "speaker_enabled": bool(self._speaker_enabled.get()),
            "wakeword_enabled": bool(self._wakeword_enabled.get()),
            "wakeword_beep_enabled": bool(self._wakeword_beep_enabled.get()),
            "wakeword_beep_frequency_hz": int(self._wakeword_beep_frequency.get() or 1046),
            "wakeword_beep_duration_ms": int(self._wakeword_beep_duration.get() or 90),
            "wakeword_phrase": self._wakeword_phrase.get().strip() or "Hải ơi",
            "wakeword_prompt_normal": self._prompt_normal.get().strip() or "Dạ, mời bạn nói.",
            "wakeword_prompt_confirm": self._prompt_confirm.get().strip() or "Bạn đang ở bước xác nhận. Hãy nói đồng ý hoặc hủy.",
            "wakeword_prompt_choice": self._prompt_choice.get().strip() or "Bạn đang ở bước lựa chọn. Hãy nói số thứ tự hoặc hủy.",
            "wakeword_prompt_retry": self._prompt_retry.get().strip() or "Mình chưa nghe rõ. Hãy nói lại.",
            "wakeword_activation_threshold": round(float(self._activation_threshold.get() or 0.012), 4),
            "wakeword_continuation_threshold": round(float(self._continuation_threshold.get() or 0.008), 4),
            "wakeword_cooldown_sec": round(float(self._cooldown_sec.get() or 2.0), 2),
            "wakeword_cooldown_success_sec": round(float(self._cooldown_success_sec.get() or 2.5), 2),
            "wakeword_cooldown_no_speech_sec": round(float(self._cooldown_no_speech_sec.get() or 1.0), 2),
            "wakeword_cooldown_cancel_sec": round(float(self._cooldown_cancel_sec.get() or 1.2), 2),
            "voice_pre_speech_timeout_sec": round(float(self._voice_pre_speech_timeout.get() or 4.0), 2),
            "voice_max_recording_sec": round(float(self._voice_max_recording.get() or 8.0), 2),
            "voice_session_max_retries": int(self._voice_session_max_retries.get() or 0),
        }
        if self._on_save:
            self._on_save(payload)
        if close_dialog:
            self.destroy()

    @staticmethod
    def _read_lines(textbox: ctk.CTkTextbox) -> list[str]:
        raw = textbox.get("1.0", "end").splitlines()
        lines = []
        for line in raw:
            value = line.strip()
            if value:
                lines.append(value)
        return lines
