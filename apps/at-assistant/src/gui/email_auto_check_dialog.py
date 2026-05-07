from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Callable

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.email_auto_check_service import EmailAutoCheckService


QUERY_MODE_LABELS = {
    "unread:today": "Mail chưa đọc hôm nay",
    "read:today": "Mail đã đọc hôm nay",
    "any:today": "Tất cả mail hôm nay",
    "unread:yesterday": "Mail chưa đọc hôm qua",
    "read:yesterday": "Mail đã đọc hôm qua",
    "any:yesterday": "Tất cả mail hôm qua",
    "any:latest": "Mail gần nhất",
    "unread:latest": "Mail chưa đọc gần nhất",
    "read:latest": "Mail đã đọc gần nhất",
}

RUN_MODE_LABELS = {
    "manual": "Thủ công",
    "repeat": "Lặp lại",
    "scheduled": "Theo lịch",
}

SCHEDULE_TYPE_LABELS = {
    "daily": "Hằng ngày",
    "weekly": "Theo tuần",
}

VOICE_DETAIL_MODE_LABELS = {
    "count_only": "Chỉ đọc số lượng",
    "first_title": "Đọc tiêu đề mail đầu tiên",
    "up_to_3_titles": "Đọc tối đa 3 tiêu đề",
}

WEEKDAY_OPTIONS = [
    ("mon", "Thứ 2"),
    ("tue", "Thứ 3"),
    ("wed", "Thứ 4"),
    ("thu", "Thứ 5"),
    ("fri", "Thứ 6"),
    ("sat", "Thứ 7"),
    ("sun", "Chủ nhật"),
]

VN_TZ = timezone(timedelta(hours=7))


class EmailAutoCheckDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_run: Callable[[str], None],
        on_message: Callable[[str, str], None] | None = None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._service = EmailAutoCheckService()
        self._on_run = on_run
        self._on_message = on_message
        self._selected_check_id = ""
        self._checks: list[dict] = []
        self._weekday_vars: dict[str, ctk.StringVar] = {}
        self._policy_collapsed = False

        self.title("Kiểm tra mail tự động")
        self.geometry("1160x840")
        self.minsize(980, 740)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=0, minsize=320)
        shell.grid_columnconfigure(1, weight=1)
        shell.grid_rowconfigure(0, weight=1)

        self._build_sidebar(shell)
        self._build_editor(shell)
        if hasattr(self.editor_panel, "_scrollbar"):
            try:
                self.editor_panel._scrollbar.grid_remove()
            except Exception:
                pass
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self._reload_checks(select_first=True)

    def _label_for_query_mode(self, mode: str) -> str:
        return QUERY_MODE_LABELS.get(mode, QUERY_MODE_LABELS["unread:today"])

    def _query_mode_from_label(self, label: str) -> str:
        for key, value in QUERY_MODE_LABELS.items():
            if value == label:
                return key
        return "unread:today"

    def _label_for_run_mode(self, mode: str) -> str:
        return RUN_MODE_LABELS.get(mode, RUN_MODE_LABELS["manual"])

    def _run_mode_from_label(self, label: str) -> str:
        for key, value in RUN_MODE_LABELS.items():
            if value == label:
                return key
        return "manual"

    def _label_for_schedule_type(self, schedule_type: str) -> str:
        return SCHEDULE_TYPE_LABELS.get(schedule_type, SCHEDULE_TYPE_LABELS["daily"])

    def _schedule_type_from_label(self, label: str) -> str:
        for key, value in SCHEDULE_TYPE_LABELS.items():
            if value == label:
                return key
        return "daily"

    def _label_for_voice_detail_mode(self, mode: str) -> str:
        return VOICE_DETAIL_MODE_LABELS.get(mode, VOICE_DETAIL_MODE_LABELS["first_title"])

    def _voice_detail_mode_from_label(self, label: str) -> str:
        for key, value in VOICE_DETAIL_MODE_LABELS.items():
            if value == label:
                return key
        return "first_title"

    def _format_run_timestamp(self, raw_value: str) -> str:
        value = (raw_value or "").strip()
        if not value:
            return ""
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return value
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=VN_TZ)
        else:
            parsed = parsed.astimezone(VN_TZ)
        now = datetime.now(VN_TZ)
        if parsed.date() == now.date():
            return f"Hôm nay lúc {parsed.strftime('%H:%M')}"
        if parsed.date() == (now + timedelta(days=1)).date():
            return f"Ngày mai lúc {parsed.strftime('%H:%M')}"
        return parsed.strftime("%H:%M %d/%m/%Y")

    def _build_sidebar(self, master) -> None:
        panel = ctk.CTkFrame(master, fg_color=self._palette["BG_SECONDARY"], corner_radius=14)
        panel.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            panel,
            text="Kiểm tra mail tự động",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 8))

        self.check_list = ctk.CTkScrollableFrame(
            panel,
            fg_color="transparent",
            scrollbar_button_color=self._palette["ACCENT_CHOICE"],
            scrollbar_button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
        )
        self.check_list.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.check_list.grid_columnconfigure(0, weight=1)

        actions = ctk.CTkFrame(panel, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 12))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Cấu hình mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            command=self._new_check,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Làm mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._reload_checks,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

    def _build_editor(self, master) -> None:
        panel = ctk.CTkScrollableFrame(
            master,
            fg_color=self._palette["BG_SECONDARY"],
            corner_radius=14,
            scrollbar_button_color=self._palette["ACCENT_CHOICE"],
            scrollbar_button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
        )
        panel.grid(row=0, column=1, sticky="nsew")
        panel.grid_columnconfigure((0, 1), weight=1, uniform="mail_meta")
        self.editor_panel = panel

        ctk.CTkLabel(
            panel,
            text="Thiết lập kiểm tra mail",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=2, sticky="ew", padx=16, pady=(16, 8))

        self._build_label(panel, "Tên cấu hình", row=1, column=0, padx=(16, 8))
        self._build_label(panel, "Loại mail", row=1, column=1, padx=(8, 16))

        self.name_entry = ctk.CTkEntry(
            panel,
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="Ví dụ: Mail chưa đọc buổi sáng",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.name_entry.grid(row=2, column=0, sticky="ew", padx=(16, 8), pady=(0, 10))

        self.query_mode_var = ctk.StringVar(value=self._label_for_query_mode("unread:today"))
        self.query_mode_menu = ctk.CTkOptionMenu(
            panel,
            variable=self.query_mode_var,
            values=list(QUERY_MODE_LABELS.values()),
            height=42,
            fg_color=self._palette["BG_INPUT"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
        )
        self.query_mode_menu.grid(row=2, column=1, sticky="ew", padx=(8, 16), pady=(0, 10))

        self._build_label(panel, "Số email tối đa", row=3, column=0, padx=(16, 8))
        limit_hint = ctk.CTkLabel(
            panel,
            text="Chỉ lấy tối đa N email mỗi lần check.",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        limit_hint.grid(row=3, column=1, sticky="sw", padx=(8, 16), pady=(0, 6))

        self.limit_entry = ctk.CTkEntry(
            panel,
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.limit_entry.grid(row=4, column=0, sticky="ew", padx=(16, 8), pady=(0, 12))

        self.enabled_switch = ctk.CTkSwitch(
            panel,
            text="Bật auto check",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.enabled_switch.grid(row=4, column=1, sticky="w", padx=(8, 16), pady=(0, 12))
        self.enabled_switch.select()

        self._build_run_policy_section(panel)
        self._build_delivery_section(panel)

        self.status_label = ctk.CTkLabel(
            panel,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=680,
        )
        self.status_label.grid(row=7, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 10))

        actions = ctk.CTkFrame(panel, fg_color="transparent")
        actions.grid(row=8, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1, 2, 3), weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu cấu hình",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            command=self._save_check,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Chạy ngay",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CONFIRM"],
            hover_color=self._palette["ACCENT_CONFIRM_HOVER"],
            text_color="#1a1a2e",
            command=self._run_selected,
        ).grid(row=0, column=1, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Xóa cấu hình",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            command=self._delete_selected,
        ).grid(row=0, column=2, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Reset form",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._new_check,
        ).grid(row=0, column=3, sticky="ew", padx=(4, 0))

    def _build_label(self, master, text: str, *, row: int, column: int = 0, padx=(16, 16)) -> None:
        ctk.CTkLabel(
            master,
            text=text,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=row, column=column, sticky="ew", padx=padx, pady=(0, 6))

    def _build_run_policy_section(self, master) -> None:
        section = ctk.CTkFrame(master, fg_color=self._palette["BG_PRIMARY"], corner_radius=12)
        section.grid(row=5, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 8))
        section.grid_columnconfigure(0, weight=1)
        self.policy_section = section

        header = ctk.CTkFrame(section, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 8))
        header.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(
            header,
            text="Thiết lập chạy",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew")
        self.policy_toggle_btn = ctk.CTkButton(
            header,
            text="Thu gọn",
            width=92,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._toggle_policy_section,
        )
        self.policy_toggle_btn.grid(row=0, column=1, sticky="e")

        body = ctk.CTkFrame(section, fg_color="transparent")
        body.grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 12))
        body.grid_columnconfigure((0, 1), weight=1, uniform="mail_run")
        self.policy_body = body

        self._build_label(body, "Mode chạy", row=0, column=0, padx=(0, 8))
        self._build_label(body, "Delay trước khi chạy (giây)", row=0, column=1, padx=(8, 0))

        self.run_mode_var = ctk.StringVar(value=self._label_for_run_mode("manual"))
        self.run_mode_menu = ctk.CTkOptionMenu(
            body,
            variable=self.run_mode_var,
            values=list(RUN_MODE_LABELS.values()),
            height=40,
            fg_color=self._palette["BG_INPUT"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=lambda _value: self._refresh_policy_fields(),
        )
        self.run_mode_menu.grid(row=1, column=0, sticky="ew", padx=(0, 8), pady=(0, 10))

        self.start_delay_entry = ctk.CTkEntry(
            body,
            height=40,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.start_delay_entry.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=(0, 10))

        self.schedule_type_frame = ctk.CTkFrame(body, fg_color="transparent")
        self.schedule_type_frame.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        self.schedule_type_frame.grid_columnconfigure(0, weight=1)
        self.schedule_type_var = ctk.StringVar(value=self._label_for_schedule_type("daily"))
        self._build_label(self.schedule_type_frame, "Kiểu lịch", row=0, column=0, padx=(0, 0))
        self.schedule_type_menu = ctk.CTkOptionMenu(
            self.schedule_type_frame,
            variable=self.schedule_type_var,
            values=list(SCHEDULE_TYPE_LABELS.values()),
            height=40,
            fg_color=self._palette["BG_INPUT"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=lambda _value: self._refresh_policy_fields(),
        )
        self.schedule_type_menu.grid(row=1, column=0, sticky="ew", padx=(0, 0), pady=(0, 0))

        self.repeat_frame = ctk.CTkFrame(body, fg_color="transparent")
        self.repeat_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        self.repeat_frame.grid_columnconfigure((0, 1), weight=1, uniform="mail_repeat")
        self._build_label(self.repeat_frame, "Số lần lặp", row=0, column=0, padx=(0, 8))
        self._build_label(self.repeat_frame, "Nghỉ giữa các lần (giây)", row=0, column=1, padx=(8, 0))

        self.repeat_count_entry = ctk.CTkEntry(
            self.repeat_frame,
            height=40,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.repeat_count_entry.grid(row=1, column=0, sticky="ew", padx=(0, 8), pady=(0, 0))

        self.repeat_interval_entry = ctk.CTkEntry(
            self.repeat_frame,
            height=40,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.repeat_interval_entry.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=(0, 0))

        self.schedule_frame = ctk.CTkFrame(body, fg_color="transparent")
        self.schedule_frame.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(0, 0))
        self.schedule_frame.grid_columnconfigure(0, weight=1)
        self.schedule_time_entry = ctk.CTkEntry(
            self.schedule_frame,
            height=40,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self._build_label(self.schedule_frame, "Giờ chạy (HH:MM)", row=0, column=0, padx=(0, 0))
        self.schedule_time_entry.grid(row=1, column=0, sticky="ew", padx=(0, 0), pady=(0, 10))

        self._build_label(self.schedule_frame, "Ngày chạy", row=2, column=0, padx=(0, 0))
        self.weekday_frame = ctk.CTkFrame(self.schedule_frame, fg_color="transparent")
        self.weekday_frame.grid(row=3, column=0, sticky="ew", pady=(0, 2))
        for index in range(4):
            self.weekday_frame.grid_columnconfigure(index, weight=1)
        for index, (key, label) in enumerate(WEEKDAY_OPTIONS):
            var = ctk.StringVar(value="off")
            checkbox = ctk.CTkCheckBox(
                self.weekday_frame,
                text=label,
                variable=var,
                onvalue="on",
                offvalue="off",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                text_color=self._palette["FG_PRIMARY"],
            )
            checkbox.grid(row=index // 4, column=index % 4, sticky="w", padx=(0, 8), pady=(0, 8))
            self._weekday_vars[key] = var

    def _build_delivery_section(self, master) -> None:
        section = ctk.CTkFrame(master, fg_color=self._palette["BG_PRIMARY"], corner_radius=12)
        section.grid(row=6, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 8))
        section.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(
            section,
            text="Cách thông báo",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=2, sticky="ew", padx=14, pady=(10, 8))

        self.show_chat_switch = ctk.CTkSwitch(
            section,
            text="Hiện kết quả trong chat",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.show_chat_switch.grid(row=1, column=0, sticky="w", padx=14, pady=(0, 10))

        self.show_notification_switch = ctk.CTkSwitch(
            section,
            text="Hiện notification",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.show_notification_switch.grid(row=1, column=1, sticky="w", padx=14, pady=(0, 10))

        self.only_new_switch = ctk.CTkSwitch(
            section,
            text="Chỉ báo khi có mail mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.only_new_switch.grid(row=2, column=0, sticky="w", padx=14, pady=(0, 10))

        self.speak_switch = ctk.CTkSwitch(
            section,
            text="Đọc tóm tắt bằng giọng nói",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
            command=self._refresh_voice_delivery_fields,
        )
        self.speak_switch.grid(row=2, column=1, sticky="w", padx=14, pady=(0, 12))

        self.voice_detail_frame = ctk.CTkFrame(section, fg_color="transparent")
        self.voice_detail_frame.grid(row=3, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 12))
        self.voice_detail_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            self.voice_detail_frame,
            text="Kiểu đọc giọng nói",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", pady=(0, 4))

        self.voice_detail_var = ctk.StringVar(value=self._label_for_voice_detail_mode("first_title"))
        self.voice_detail_menu = ctk.CTkOptionMenu(
            self.voice_detail_frame,
            variable=self.voice_detail_var,
            values=list(VOICE_DETAIL_MODE_LABELS.values()),
            height=40,
            fg_color=self._palette["BG_INPUT"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
        )
        self.voice_detail_menu.grid(row=1, column=0, sticky="ew")

    def _toggle_policy_section(self) -> None:
        self._policy_collapsed = not self._policy_collapsed
        if self._policy_collapsed:
            self.policy_body.grid_remove()
            self.policy_toggle_btn.configure(text="Mở rộng")
        else:
            self.policy_body.grid()
            self.policy_toggle_btn.configure(text="Thu gọn")

    def _refresh_policy_fields(self) -> None:
        mode = self._run_mode_from_label(self.run_mode_var.get())
        schedule_type = self._schedule_type_from_label(self.schedule_type_var.get())
        if mode == "manual":
            self.repeat_frame.grid_remove()
            self.schedule_type_frame.grid_remove()
            self.schedule_frame.grid_remove()
        elif mode == "repeat":
            self.repeat_frame.grid()
            self.schedule_type_frame.grid_remove()
            self.schedule_frame.grid_remove()
        else:
            self.repeat_frame.grid_remove()
            self.schedule_type_frame.grid()
            self.schedule_frame.grid()

        weekday_state = "normal" if mode == "scheduled" and schedule_type == "weekly" else "disabled"
        for checkbox in self.weekday_frame.winfo_children():
            checkbox.configure(state=weekday_state)
        if mode == "scheduled" and schedule_type == "weekly":
            self.weekday_frame.grid()
        elif mode == "scheduled":
            self.weekday_frame.grid_remove()

    def _refresh_voice_delivery_fields(self) -> None:
        if bool(self.speak_switch.get()):
            self.voice_detail_frame.grid()
        else:
            self.voice_detail_frame.grid_remove()

    def _reload_checks(self, *, select_first: bool = False) -> None:
        self._checks = self._service.list_checks()
        for child in self.check_list.winfo_children():
            child.destroy()

        if not self._checks:
            ctk.CTkLabel(
                self.check_list,
                text="Chưa có cấu hình kiểm tra mail tự động nào.",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
            ).grid(row=0, column=0, sticky="ew", padx=8, pady=8)
            self._new_check(refresh_list=False)
            return

        if select_first and not self._selected_check_id:
            self._selected_check_id = str(self._checks[0].get("id") or "")

        for index, item in enumerate(self._checks):
            query = item.get("query") or {}
            mode_label = self._label_for_query_mode(str(query.get("mode") or "unread:today"))
            enabled_label = "ON" if item.get("enabled", True) else "OFF"
            button = ctk.CTkButton(
                self.check_list,
                text=f"{item.get('name')}\n{mode_label} • {enabled_label}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                anchor="w",
                height=62,
                fg_color=self._palette["ACCENT"] if item.get("id") == self._selected_check_id else self._palette["BG_SECONDARY"],
                hover_color=self._palette["ACCENT_HOVER"] if item.get("id") == self._selected_check_id else self._palette["ACCENT_CHOICE_HOVER"],
                text_color="#ffffff" if item.get("id") == self._selected_check_id else self._palette["FG_PRIMARY"],
                command=lambda check_id=str(item.get("id") or ""): self._load_check(check_id),
            )
            button.grid(row=index, column=0, sticky="ew", padx=6, pady=(0, 8))

        if self._selected_check_id:
            self._load_check(self._selected_check_id, refresh_list=False)

    def _load_check(self, check_id: str, *, refresh_list: bool = True) -> None:
        item = self._service.get_check(check_id)
        if not item:
            return
        self._selected_check_id = str(item.get("id") or "")
        query = item.get("query") or {}
        run_policy = item.get("run_policy") or {}
        schedule = run_policy.get("schedule") or {}
        delivery = item.get("delivery") or {}

        self.name_entry.delete(0, "end")
        self.name_entry.insert(0, str(item.get("name") or ""))
        self.query_mode_var.set(self._label_for_query_mode(str(query.get("mode") or "unread:today")))
        self.limit_entry.delete(0, "end")
        self.limit_entry.insert(0, str(query.get("limit") or 10))

        if item.get("enabled", True):
            self.enabled_switch.select()
        else:
            self.enabled_switch.deselect()

        self.run_mode_var.set(self._label_for_run_mode(str(run_policy.get("mode") or "manual")))
        self.start_delay_entry.delete(0, "end")
        self.start_delay_entry.insert(0, str(run_policy.get("start_delay_seconds") or 0))
        self.repeat_count_entry.delete(0, "end")
        self.repeat_count_entry.insert(0, str(run_policy.get("repeat_count") or 1))
        self.repeat_interval_entry.delete(0, "end")
        self.repeat_interval_entry.insert(0, str(run_policy.get("repeat_interval_seconds") or 0))
        self.schedule_type_var.set(self._label_for_schedule_type(str(schedule.get("type") or "daily")))
        self.schedule_time_entry.delete(0, "end")
        self.schedule_time_entry.insert(0, str(schedule.get("time") or "08:00"))

        days = set(schedule.get("days") or [])
        for key, _label in WEEKDAY_OPTIONS:
            self._weekday_vars[key].set("on" if key in days else "off")

        self.show_chat_switch.select() if delivery.get("show_chat_result", True) else self.show_chat_switch.deselect()
        self.show_notification_switch.select() if delivery.get("show_notification", True) else self.show_notification_switch.deselect()
        self.only_new_switch.select() if delivery.get("only_if_has_new_mail", True) else self.only_new_switch.deselect()
        self.speak_switch.select() if delivery.get("speak_summary", False) else self.speak_switch.deselect()
        self.voice_detail_var.set(self._label_for_voice_detail_mode(str(delivery.get("voice_detail_mode") or "first_title")))

        state = item.get("state") or {}
        next_run = self._format_run_timestamp(str(state.get("next_run_at") or ""))
        last_run = self._format_run_timestamp(str(state.get("last_run_at") or ""))
        details = []
        if next_run:
            details.append(f"Lần chạy tới: {next_run}")
        if last_run:
            details.append(f"Lần chạy gần nhất: {last_run}")
        self.status_label.configure(
            text=" | ".join(details) if details else f"Đang chỉnh: {item.get('name')}",
            text_color=self._palette["FG_SECONDARY"],
        )
        self._refresh_policy_fields()
        self._refresh_voice_delivery_fields()
        if refresh_list:
            self._reload_checks(select_first=False)

    def _new_check(self, *, refresh_list: bool = True) -> None:
        self._selected_check_id = ""
        self.name_entry.delete(0, "end")
        self.query_mode_var.set(self._label_for_query_mode("unread:today"))
        self.limit_entry.delete(0, "end")
        self.limit_entry.insert(0, "10")
        self.enabled_switch.select()
        self.run_mode_var.set(self._label_for_run_mode("manual"))
        self.start_delay_entry.delete(0, "end")
        self.start_delay_entry.insert(0, "0")
        self.repeat_count_entry.delete(0, "end")
        self.repeat_count_entry.insert(0, "3")
        self.repeat_interval_entry.delete(0, "end")
        self.repeat_interval_entry.insert(0, "10")
        self.schedule_type_var.set(self._label_for_schedule_type("daily"))
        self.schedule_time_entry.delete(0, "end")
        self.schedule_time_entry.insert(0, "08:00")
        for key, _label in WEEKDAY_OPTIONS:
            self._weekday_vars[key].set("off")
        self._weekday_vars["mon"].set("on")
        self.show_chat_switch.select()
        self.show_notification_switch.select()
        self.only_new_switch.select()
        self.speak_switch.deselect()
        self.voice_detail_var.set(self._label_for_voice_detail_mode("first_title"))
        self.status_label.configure(
            text="Tạo cấu hình mới. Có thể chạy tay, lặp lại hoặc đặt lịch hằng ngày/hằng tuần.",
            text_color=self._palette["FG_SECONDARY"],
        )
        self._refresh_policy_fields()
        self._refresh_voice_delivery_fields()
        if refresh_list:
            self._reload_checks(select_first=False)

    def _build_payload(self) -> dict:
        mode = self._run_mode_from_label(self.run_mode_var.get())
        schedule = None
        if mode == "scheduled":
            schedule_type = self._schedule_type_from_label(self.schedule_type_var.get())
            schedule = {
                "type": schedule_type,
                "time": (self.schedule_time_entry.get() or "").strip() or "08:00",
            }
            if schedule_type == "weekly":
                schedule["days"] = [
                    key
                    for key, _label in WEEKDAY_OPTIONS
                    if self._weekday_vars[key].get() == "on"
                ]

        return {
            "name": (self.name_entry.get() or "").strip(),
            "enabled": bool(self.enabled_switch.get()),
            "query": {
                "mode": self._query_mode_from_label(self.query_mode_var.get()),
                "limit": (self.limit_entry.get() or "").strip() or "10",
            },
            "run_policy": {
                "mode": mode,
                "repeat_count": (self.repeat_count_entry.get() or "").strip() or "1",
                "repeat_interval_seconds": (self.repeat_interval_entry.get() or "").strip() or "0",
                "start_delay_seconds": (self.start_delay_entry.get() or "").strip() or "0",
                "schedule": schedule,
            },
            "delivery": {
                "show_chat_result": bool(self.show_chat_switch.get()),
                "show_notification": bool(self.show_notification_switch.get()),
                "only_if_has_new_mail": bool(self.only_new_switch.get()),
                "speak_summary": bool(self.speak_switch.get()),
                "voice_detail_mode": self._voice_detail_mode_from_label(self.voice_detail_var.get()),
            },
        }

    def _save_check(self) -> None:
        try:
            payload = self._build_payload()
            if self._selected_check_id:
                record = self._service.update_check(self._selected_check_id, **payload)
                message = f"Đã cập nhật cấu hình mail: {record['name']}"
            else:
                record = self._service.create_check(**payload)
                message = f"Đã lưu cấu hình mail: {record['name']}"
            self._selected_check_id = str(record.get("id") or "")
            self.status_label.configure(text=message, text_color="#22c55e")
            self._reload_checks(select_first=False)
            self._load_check(self._selected_check_id, refresh_list=False)
            if self._on_message:
                self._on_message(message, "success")
        except Exception as exc:
            self.status_label.configure(text=str(exc), text_color=self._palette["FG_ERROR"])

    def _run_selected(self) -> None:
        check_id = self._selected_check_id
        if not check_id:
            try:
                self._save_check()
                check_id = self._selected_check_id
            except Exception:
                check_id = ""
        if not check_id:
            self.status_label.configure(text="Hãy lưu cấu hình trước khi chạy.", text_color=self._palette["FG_ERROR"])
            return
        self._on_run(check_id)

    def _delete_selected(self) -> None:
        if not self._selected_check_id:
            self.status_label.configure(text="Chưa chọn cấu hình để xóa.", text_color=self._palette["FG_ERROR"])
            return
        try:
            deleted = self._service.delete_check(self._selected_check_id)
            message = f"Đã xóa cấu hình mail: {deleted['name']}"
            self._selected_check_id = ""
            self._reload_checks(select_first=True)
            self.status_label.configure(text=message, text_color="#22c55e")
            if self._on_message:
                self._on_message(message, "success")
        except Exception as exc:
            self.status_label.configure(text=str(exc), text_color=self._palette["FG_ERROR"])
