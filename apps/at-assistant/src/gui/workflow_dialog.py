from __future__ import annotations

from typing import Callable

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.workflow_service import WorkflowService


STEP_TYPE_LABELS = {
    "open_app": "Mở ứng dụng",
    "open_url": "Mở URL",
    "open_file": "Mở file",
    "wait": "Chờ",
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

WEEKDAY_OPTIONS = [
    ("mon", "Thứ 2"),
    ("tue", "Thứ 3"),
    ("wed", "Thứ 4"),
    ("thu", "Thứ 5"),
    ("fri", "Thứ 6"),
    ("sat", "Thứ 7"),
    ("sun", "Chủ nhật"),
]


class WorkflowDialog(ctk.CTkToplevel):
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
        self._on_run = on_run
        self._on_message = on_message
        self._service = WorkflowService()
        self._selected_workflow_id = ""
        self._workflows: list[dict] = []
        self._step_rows: list[dict] = []
        self._dragging_step_frame = None
        self._drag_target_frame = None
        self._drag_target_index: int | None = None
        self._weekday_vars: dict[str, ctk.StringVar] = {}
        self._weekday_checkboxes: dict[str, ctk.CTkCheckBox] = {}
        self._run_policy_collapsed = False

        self.title("Workflow Manager")
        self.geometry("1160x860")
        self.minsize(1000, 760)
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
        self._install_mousewheel_support()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self._reload_workflows(select_first=True)

    def _label_for_step_type(self, step_type: str) -> str:
        return STEP_TYPE_LABELS.get(step_type, STEP_TYPE_LABELS["open_app"])

    def _step_type_from_label(self, label: str) -> str:
        for key, value in STEP_TYPE_LABELS.items():
            if value == label:
                return key
        return "open_app"

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

    def _build_sidebar(self, master) -> None:
        sidebar = ctk.CTkFrame(master, fg_color=self._palette["BG_SECONDARY"], corner_radius=14)
        sidebar.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        sidebar.grid_columnconfigure(0, weight=1)
        sidebar.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            sidebar,
            text="Workflow đã lưu",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(14, 8))

        self.workflow_list = ctk.CTkScrollableFrame(
            sidebar,
            fg_color="transparent",
            scrollbar_button_color=self._palette["ACCENT_CHOICE"],
            scrollbar_button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
        )
        self.workflow_list.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))
        self.workflow_list.grid_columnconfigure(0, weight=1)

        actions = ctk.CTkFrame(sidebar, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 12))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Workflow mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._new_workflow,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Làm mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=self._reload_workflows,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

    def _build_editor(self, master) -> None:
        editor = ctk.CTkFrame(master, fg_color=self._palette["BG_SECONDARY"], corner_radius=14)
        editor.grid(row=0, column=1, sticky="nsew")
        editor.grid_columnconfigure(0, weight=1)
        editor.grid_rowconfigure(8, weight=1)

        ctk.CTkLabel(
            editor,
            text="Thiết kế workflow",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 8))

        meta_frame = ctk.CTkFrame(editor, fg_color="transparent")
        meta_frame.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 10))
        meta_frame.grid_columnconfigure((0, 1), weight=1, uniform="workflow_meta")

        name_frame = ctk.CTkFrame(meta_frame, fg_color="transparent")
        name_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        name_frame.grid_columnconfigure(0, weight=1)
        self._build_label(name_frame, "Tên workflow", row=0)
        self.name_entry = ctk.CTkEntry(
            name_frame,
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="Ví dụ: Công việc sáng",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.name_entry.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 0))

        description_frame = ctk.CTkFrame(meta_frame, fg_color="transparent")
        description_frame.grid(row=0, column=1, sticky="nsew", padx=(8, 0))
        description_frame.grid_columnconfigure(0, weight=1)
        self._build_label(description_frame, "Mô tả", row=0)
        self.description_text = ctk.CTkTextbox(
            description_frame,
            height=72,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.description_text.grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 0))

        toggles = ctk.CTkFrame(editor, fg_color="transparent")
        toggles.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 8))
        toggles.grid_columnconfigure((0, 1), weight=1)
        self.enabled_switch = ctk.CTkSwitch(
            toggles,
            text="Bật workflow",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.enabled_switch.grid(row=0, column=0, sticky="w", padx=(0, 8))
        self.enabled_switch.select()

        self.continue_switch = ctk.CTkSwitch(
            toggles,
            text="Tiếp tục khi lỗi step",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            progress_color=self._palette["ACCENT"],
        )
        self.continue_switch.grid(row=0, column=1, sticky="w", padx=(8, 0))

        self._build_run_policy_section(editor)

        steps_header = ctk.CTkFrame(editor, fg_color="transparent")
        steps_header.grid(row=7, column=0, sticky="ew", padx=16, pady=(0, 6))
        steps_header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            steps_header,
            text="Chuỗi hành động",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=0, column=0, sticky="w")

        ctk.CTkButton(
            steps_header,
            text="+ Thêm bước",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            width=112,
            command=self._add_step_row,
        ).grid(row=0, column=1, sticky="e")

        self.steps_frame = ctk.CTkScrollableFrame(
            editor,
            fg_color=self._palette["BG_PRIMARY"],
            corner_radius=12,
            scrollbar_button_color=self._palette["ACCENT_CHOICE"],
            scrollbar_button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            height=260,
        )
        self.steps_frame.grid(row=8, column=0, sticky="nsew", padx=16, pady=(0, 10))
        self.steps_frame.grid_columnconfigure(0, weight=1)

        self.drop_indicator = ctk.CTkFrame(
            self.steps_frame,
            fg_color=self._palette["ACCENT"],
            height=4,
            corner_radius=99,
        )
        self.drop_indicator.place_forget()

        self.error_label = ctk.CTkLabel(
            editor,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_ERROR"],
            anchor="w",
        )
        self.error_label.grid(row=9, column=0, sticky="ew", padx=16, pady=(0, 10))

        actions = ctk.CTkFrame(editor, fg_color="transparent")
        actions.grid(row=10, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1, 2, 3), weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu workflow",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._save_workflow,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Chạy workflow",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CONFIRM"],
            hover_color=self._palette["ACCENT_CONFIRM_HOVER"],
            text_color="#1a1a2e",
            corner_radius=10,
            command=self._run_selected,
        ).grid(row=0, column=1, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Xóa workflow",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            corner_radius=10,
            command=self._delete_selected,
        ).grid(row=0, column=2, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Reset form",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=self._new_workflow,
        ).grid(row=0, column=3, sticky="ew", padx=(4, 0))

    def _build_run_policy_section(self, master) -> None:
        section = ctk.CTkFrame(master, fg_color=self._palette["BG_PRIMARY"], corner_radius=12)
        section.grid(row=6, column=0, sticky="ew", padx=16, pady=(0, 8))
        section.grid_columnconfigure(0, weight=1)
        self.run_policy_section = section

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
        self.run_policy_toggle_btn = ctk.CTkButton(
            header,
            text="Thu gọn",
            width=92,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=self._toggle_run_policy_section,
        )
        self.run_policy_toggle_btn.grid(row=0, column=1, sticky="e")

        body = ctk.CTkFrame(section, fg_color="transparent")
        body.grid(row=1, column=0, sticky="ew")
        body.grid_columnconfigure((0, 1, 2), weight=1)
        self.run_policy_body = body

        ctk.CTkLabel(
            body,
            text="Mode chạy",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=1, column=0, sticky="w", padx=(14, 8), pady=(0, 4))
        ctk.CTkLabel(
            body,
            text="Delay trước khi chạy (giây)",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=1, column=1, sticky="w", padx=(8, 8), pady=(0, 4))
        ctk.CTkLabel(
            body,
            text="Kiểu lịch",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=1, column=2, sticky="w", padx=(8, 14), pady=(0, 4))

        self.run_mode_menu = ctk.CTkOptionMenu(
            body,
            values=list(RUN_MODE_LABELS.values()),
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            dropdown_font=(FONT_FAMILY, FONT_SIZE_SMALL),
            fg_color=self._palette["ACCENT_CHOICE"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            command=lambda _value: self._refresh_run_policy_visibility(),
        )
        self.run_mode_menu.grid(row=2, column=0, sticky="ew", padx=(14, 8), pady=(0, 8))
        self.run_mode_menu.set(self._label_for_run_mode("manual"))

        self.start_delay_entry = ctk.CTkEntry(
            body,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="0",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.start_delay_entry.grid(row=2, column=1, sticky="ew", padx=(8, 8), pady=(0, 8))

        self.schedule_type_menu = ctk.CTkOptionMenu(
            body,
            values=list(SCHEDULE_TYPE_LABELS.values()),
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            dropdown_font=(FONT_FAMILY, FONT_SIZE_SMALL),
            fg_color=self._palette["ACCENT_CHOICE"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            command=lambda _value: self._refresh_run_policy_visibility(),
        )
        self.schedule_type_menu.grid(row=2, column=2, sticky="ew", padx=(8, 14), pady=(0, 8))
        self.schedule_type_menu.set(self._label_for_schedule_type("daily"))

        self.repeat_frame = ctk.CTkFrame(body, fg_color="transparent")
        self.repeat_frame.grid(row=3, column=0, columnspan=3, sticky="ew", padx=14, pady=(0, 6))
        self.repeat_frame.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(
            self.repeat_frame,
            text="Số lần lặp",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=0, column=0, sticky="w", padx=(0, 8), pady=(0, 4))
        ctk.CTkLabel(
            self.repeat_frame,
            text="Nghỉ giữa các lần (giây)",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=0, column=1, sticky="w", padx=(8, 0), pady=(0, 4))

        self.repeat_count_entry = ctk.CTkEntry(
            self.repeat_frame,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="1",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.repeat_count_entry.grid(row=1, column=0, sticky="ew", padx=(0, 8), pady=(0, 4))

        self.repeat_interval_entry = ctk.CTkEntry(
            self.repeat_frame,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="0",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.repeat_interval_entry.grid(row=1, column=1, sticky="ew", padx=(8, 0), pady=(0, 4))

        self.schedule_frame = ctk.CTkFrame(body, fg_color="transparent")
        self.schedule_frame.grid(row=4, column=0, columnspan=3, sticky="ew", padx=14, pady=(0, 6))
        self.schedule_frame.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(
            self.schedule_frame,
            text="Giờ chạy (HH:MM)",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=0, column=0, sticky="w", padx=(0, 8), pady=(0, 4))
        self.schedule_time_entry = ctk.CTkEntry(
            self.schedule_frame,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="08:00",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        self.schedule_time_entry.grid(row=1, column=0, sticky="ew", padx=(0, 8), pady=(0, 4))

        self.weekday_frame = ctk.CTkFrame(self.schedule_frame, fg_color="transparent")
        self.weekday_frame.grid(row=0, column=1, rowspan=2, sticky="ew", padx=(8, 0), pady=(0, 0))
        for column in range(4):
            self.weekday_frame.grid_columnconfigure(column, weight=1, minsize=92)
        ctk.CTkLabel(
            self.weekday_frame,
            text="Ngày chạy",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=4, sticky="ew", pady=(0, 4))

        for index, (key, label) in enumerate(WEEKDAY_OPTIONS):
            var = ctk.StringVar(value="0")
            self._weekday_vars[key] = var
            checkbox = ctk.CTkCheckBox(
                self.weekday_frame,
                text=label,
                variable=var,
                onvalue="1",
                offvalue="0",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_PRIMARY"],
                checkbox_width=18,
                checkbox_height=18,
                fg_color=self._palette["ACCENT"],
                hover_color=self._palette["ACCENT_HOVER"],
            )
            row_index = 1 + (index // 4)
            col_index = index % 4
            checkbox.grid(row=row_index, column=col_index, padx=(0, 8), pady=(0, 2), sticky="w")
            self._weekday_checkboxes[key] = checkbox

        self.run_policy_hint = ctk.CTkLabel(
            body,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.run_policy_hint.grid(row=5, column=0, columnspan=3, sticky="ew", padx=14, pady=(0, 8))
        self._refresh_run_policy_visibility()

    def _build_label(self, master, text: str, *, row: int, pady: tuple[int, int] = (0, 6)) -> None:
        ctk.CTkLabel(
            master,
            text=text,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=row, column=0, sticky="ew", padx=16, pady=pady)

    def _build_entry(self, master, label: str, row: int, placeholder: str) -> ctk.CTkEntry:
        self._build_label(master, label, row=row)
        entry = ctk.CTkEntry(
            master,
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text=placeholder,
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        entry.grid(row=row + 1, column=0, sticky="ew", padx=16, pady=(0, 10))
        return entry

    def _install_mousewheel_support(self) -> None:
        self.bind_all("<MouseWheel>", self._on_global_mousewheel, add="+")
        self.bind_all("<Button-4>", self._on_global_mousewheel, add="+")
        self.bind_all("<Button-5>", self._on_global_mousewheel, add="+")

    def _on_global_mousewheel(self, event) -> str | None:
        target = self._pick_scrollable_target(event)
        if target is None:
            return None
        units = self._mousewheel_units(event)
        if units == 0:
            return "break"
        canvas = getattr(target, "_parent_canvas", None)
        if canvas is None:
            return None
        canvas.yview_scroll(units, "units")
        return "break"

    def _pick_scrollable_target(self, event):
        x_root = getattr(event, "x_root", 0)
        y_root = getattr(event, "y_root", 0)
        try:
            widget = self.winfo_containing(x_root, y_root)
        except Exception:
            widget = None

        while widget is not None:
            for scrollable in (self.steps_frame, self.workflow_list):
                if widget is scrollable:
                    return scrollable
                canvas = getattr(scrollable, "_parent_canvas", None)
                inner = getattr(scrollable, "_scrollable_frame", None)
                if widget is canvas or widget is inner:
                    return scrollable
            try:
                widget = widget.master
            except Exception:
                widget = None

        for scrollable in (self.steps_frame, self.workflow_list):
            canvas = getattr(scrollable, "_parent_canvas", None)
            if canvas is None or not canvas.winfo_exists():
                continue
            left = canvas.winfo_rootx()
            top = canvas.winfo_rooty()
            right = left + canvas.winfo_width()
            bottom = top + canvas.winfo_height()
            if left <= x_root <= right and top <= y_root <= bottom:
                return scrollable
        return None

    def _mousewheel_units(self, event) -> int:
        num = getattr(event, "num", None)
        if num == 4:
            return -2
        if num == 5:
            return 2
        delta = int(getattr(event, "delta", 0) or 0)
        if delta == 0:
            return 0
        return -max(1, abs(delta) // 120)

    def _toggle_run_policy_section(self) -> None:
        self._run_policy_collapsed = not self._run_policy_collapsed
        self._refresh_run_policy_visibility()

    def _refresh_run_policy_visibility(self) -> None:
        mode = self._run_mode_from_label(self.run_mode_menu.get())
        schedule_type = self._schedule_type_from_label(self.schedule_type_menu.get())

        if self._run_policy_collapsed:
            self.run_policy_body.grid_remove()
            self.run_policy_toggle_btn.configure(text="Mở rộng")
            return

        self.run_policy_body.grid()
        self.run_policy_toggle_btn.configure(text="Thu gọn")

        if mode == "repeat":
            self.repeat_frame.grid()
        else:
            self.repeat_frame.grid_remove()

        if mode == "scheduled":
            self.schedule_type_menu.configure(state="normal")
            self.schedule_frame.grid()
            if schedule_type == "weekly":
                self.weekday_frame.grid()
            else:
                self.weekday_frame.grid_remove()
        else:
            self.schedule_type_menu.configure(state="disabled")
            self.schedule_frame.grid_remove()

        hint_map = {
            "manual": "Chỉ chạy khi bạn bấm nút Chạy workflow.",
            "repeat": "Chạy ngay và lặp lại toàn bộ workflow theo số lần đã cấu hình.",
            "scheduled": "Tự chạy khi app đang mở và tới đúng giờ trong lịch đã chọn.",
        }
        self.run_policy_hint.configure(text=hint_map.get(mode, ""))

    def _reload_workflows(self, *, select_first: bool = False) -> None:
        self._workflows = self._service.list_workflows()
        for child in self.workflow_list.winfo_children():
            child.destroy()

        if not self._workflows:
            ctk.CTkLabel(
                self.workflow_list,
                text="Chưa có workflow nào.",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                text_color=self._palette["FG_SECONDARY"],
            ).grid(row=0, column=0, sticky="ew", padx=8, pady=8)
            if select_first:
                self._new_workflow()
            return

        for index, workflow in enumerate(self._workflows):
            is_selected = str(workflow.get("id") or "") == self._selected_workflow_id
            ctk.CTkButton(
                self.workflow_list,
                text=self._format_workflow_button(workflow),
                anchor="w",
                height=60,
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                fg_color=self._palette["ACCENT"] if is_selected else self._palette["ACCENT_CHOICE"],
                hover_color=self._palette["ACCENT_HOVER"] if is_selected else self._palette["ACCENT_CHOICE_HOVER"],
                text_color="#ffffff" if is_selected else self._palette["FG_PRIMARY"],
                corner_radius=12,
                command=lambda wf=workflow: self._select_workflow(wf),
            ).grid(row=index, column=0, sticky="ew", padx=4, pady=4)

        if select_first and self._workflows:
            current = self._service.get_workflow(self._selected_workflow_id) if self._selected_workflow_id else None
            self._select_workflow(current or self._workflows[0])

    def _format_workflow_button(self, workflow: dict) -> str:
        run_policy = workflow.get("run_policy") or {}
        mode = str(run_policy.get("mode") or "manual")
        mode_label = {
            "manual": "Thủ công",
            "repeat": f"Lặp {int(run_policy.get('repeat_count') or 1)} lần",
            "scheduled": "Theo lịch",
        }.get(mode, mode)
        status = "ON" if bool(workflow.get("enabled", True)) else "OFF"
        return f"{str(workflow.get('name') or workflow.get('id') or '').strip()}\n{len(workflow.get('steps') or [])} bước • {mode_label} • {status}"

    def _new_workflow(self) -> None:
        self._selected_workflow_id = ""
        self.name_entry.delete(0, "end")
        self.description_text.delete("1.0", "end")
        self.enabled_switch.select()
        self.continue_switch.deselect()
        self.start_delay_entry.delete(0, "end")
        self.start_delay_entry.insert(0, "0")
        self.repeat_count_entry.delete(0, "end")
        self.repeat_count_entry.insert(0, "1")
        self.repeat_interval_entry.delete(0, "end")
        self.repeat_interval_entry.insert(0, "0")
        self.schedule_time_entry.delete(0, "end")
        self.schedule_time_entry.insert(0, "08:00")
        self.run_mode_menu.set(self._label_for_run_mode("manual"))
        self.schedule_type_menu.set(self._label_for_schedule_type("daily"))
        for var in self._weekday_vars.values():
            var.set("0")
        self._weekday_vars["mon"].set("1")
        self.error_label.configure(text="")
        self._clear_drop_indicator()
        self._clear_steps()
        self._refresh_run_policy_visibility()
        self._add_step_row(step_type="open_app")
        self._reload_workflows()
        self.name_entry.focus_set()

    def _select_workflow(self, workflow: dict | None) -> None:
        if not workflow:
            self._new_workflow()
            return

        self._selected_workflow_id = str(workflow.get("id") or "")
        self.name_entry.delete(0, "end")
        self.name_entry.insert(0, str(workflow.get("name") or ""))
        self.description_text.delete("1.0", "end")
        self.description_text.insert("1.0", str(workflow.get("description") or ""))
        self.enabled_switch.select() if bool(workflow.get("enabled", True)) else self.enabled_switch.deselect()
        self.continue_switch.select() if bool(workflow.get("continue_on_error", False)) else self.continue_switch.deselect()
        self._load_run_policy(workflow.get("run_policy") or {})
        self.error_label.configure(text="")
        self._clear_drop_indicator()
        self._clear_steps()
        for step in workflow.get("steps") or []:
            self._add_step_row(
                step_type=str(step.get("type") or "open_app"),
                value=self._step_primary_value(step),
                extra=self._step_extra_value(step),
            )
        if not self._step_rows:
            self._add_step_row(step_type="open_app")
        self._reload_workflows()

    def _load_run_policy(self, run_policy: dict) -> None:
        policy = dict(run_policy or {})
        self.run_mode_menu.set(self._label_for_run_mode(str(policy.get("mode") or "manual")))
        self.start_delay_entry.delete(0, "end")
        self.start_delay_entry.insert(0, str(policy.get("start_delay_seconds", 0)))

        self.repeat_count_entry.delete(0, "end")
        self.repeat_count_entry.insert(0, str(policy.get("repeat_count", 1)))
        self.repeat_interval_entry.delete(0, "end")
        self.repeat_interval_entry.insert(0, str(policy.get("repeat_interval_seconds", 0)))

        schedule = policy.get("schedule") or {}
        self.schedule_type_menu.set(self._label_for_schedule_type(str(schedule.get("type") or "daily")))
        self.schedule_time_entry.delete(0, "end")
        self.schedule_time_entry.insert(0, str(schedule.get("time") or "08:00"))

        selected_days = set(schedule.get("days") or [])
        for key, var in self._weekday_vars.items():
            var.set("1" if key in selected_days else "0")
        if not selected_days:
            self._weekday_vars["mon"].set("1")
        self._refresh_run_policy_visibility()

    def _clear_steps(self) -> None:
        for row in self._step_rows:
            frame = row.get("frame")
            if frame is not None and frame.winfo_exists():
                frame.destroy()
        self._step_rows.clear()

    def _step_primary_value(self, step: dict) -> str:
        params = step.get("params") or {}
        step_type = str(step.get("type") or "")
        if step_type == "open_app":
            return str(params.get("app_name") or "")
        if step_type == "open_url":
            return str(params.get("url") or "")
        if step_type == "open_file":
            return str(params.get("path") or "")
        if step_type == "wait":
            return str(params.get("seconds") or 0)
        return ""

    def _step_extra_value(self, step: dict) -> str:
        params = step.get("params") or {}
        if str(step.get("type") or "") == "open_url":
            browser = str(params.get("browser") or "default").strip()
            return "" if browser == "default" else browser
        return ""

    def _add_step_row(self, *, step_type: str = "open_app", value: str = "", extra: str = "") -> None:
        row_index = len(self._step_rows)
        frame = ctk.CTkFrame(self.steps_frame, fg_color=self._palette["BG_SECONDARY"], corner_radius=12)
        frame.grid(row=row_index, column=0, sticky="ew", padx=4, pady=4)
        frame.grid_columnconfigure(3, weight=1)

        drag_label = ctk.CTkLabel(
            frame,
            text="⋮⋮",
            width=28,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            cursor="hand2",
        )
        drag_label.grid(row=0, column=0, padx=(10, 2), pady=10)
        drag_label.bind("<ButtonPress-1>", lambda _event, row_ref=frame: self._begin_step_drag(row_ref))
        drag_label.bind("<B1-Motion>", self._on_step_drag_motion)
        drag_label.bind("<ButtonRelease-1>", lambda event, row_ref=frame: self._end_step_drag(event, row_ref))

        index_label = ctk.CTkLabel(
            frame,
            text=f"{row_index + 1}",
            width=30,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        )
        index_label.grid(row=0, column=1, padx=(0, 6), pady=10)

        type_menu = ctk.CTkOptionMenu(
            frame,
            values=list(STEP_TYPE_LABELS.values()),
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            dropdown_font=(FONT_FAMILY, FONT_SIZE_SMALL),
            fg_color=self._palette["ACCENT_CHOICE"],
            button_color=self._palette["ACCENT_CHOICE"],
            button_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_fg_color=self._palette["BG_PRIMARY"],
            dropdown_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            dropdown_text_color=self._palette["FG_PRIMARY"],
            text_color=self._palette["FG_PRIMARY"],
            width=120,
            command=lambda _choice, row_ref=frame: self._refresh_step_row(row_ref),
        )
        type_menu.set(self._label_for_step_type(step_type if step_type in STEP_TYPE_LABELS else "open_app"))
        type_menu.grid(row=0, column=2, padx=(0, 8), pady=10, sticky="w")

        value_entry = ctk.CTkEntry(
            frame,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="Giá trị step",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
        )
        value_entry.grid(row=0, column=3, padx=(0, 8), pady=10, sticky="ew")
        if value:
            value_entry.insert(0, value)

        extra_entry = ctk.CTkEntry(
            frame,
            width=140,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text="Extra",
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=10,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
        )
        extra_entry.grid(row=0, column=4, padx=(0, 8), pady=10, sticky="ew")
        if extra:
            extra_entry.insert(0, extra)

        up_btn = ctk.CTkButton(
            frame,
            text="↑",
            width=34,
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=lambda row_ref=frame: self._move_step_row(row_ref, -1),
        )
        up_btn.grid(row=0, column=5, padx=(0, 6), pady=10)

        down_btn = ctk.CTkButton(
            frame,
            text="↓",
            width=34,
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=lambda row_ref=frame: self._move_step_row(row_ref, 1),
        )
        down_btn.grid(row=0, column=6, padx=(0, 6), pady=10)

        delete_btn = ctk.CTkButton(
            frame,
            text="X",
            width=34,
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            corner_radius=10,
            command=lambda row_ref=frame: self._remove_step_row(row_ref),
        )
        delete_btn.grid(row=0, column=7, padx=(0, 10), pady=10)

        hint_label = ctk.CTkLabel(
            frame,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        hint_label.grid(row=1, column=2, columnspan=6, sticky="ew", padx=(0, 10), pady=(0, 10))

        self._step_rows.append(
            {
                "frame": frame,
                "drag_label": drag_label,
                "index_label": index_label,
                "type_menu": type_menu,
                "value_entry": value_entry,
                "extra_entry": extra_entry,
                "up_btn": up_btn,
                "down_btn": down_btn,
                "hint_label": hint_label,
            }
        )
        self._refresh_step_row(frame)
        self._refresh_step_numbers()

    def _find_row(self, frame) -> dict | None:
        for row in self._step_rows:
            if row.get("frame") is frame:
                return row
        return None

    def _refresh_step_row(self, frame) -> None:
        row = self._find_row(frame)
        if not row:
            return
        step_type = self._step_type_from_label(row["type_menu"].get())
        value_entry = row["value_entry"]
        extra_entry = row["extra_entry"]
        hint_label = row["hint_label"]
        if step_type == "open_app":
            value_entry.configure(placeholder_text="Tên app, ví dụ: edge / word / notepad")
            extra_entry.delete(0, "end")
            extra_entry.configure(state="disabled", placeholder_text="Không dùng")
            hint_label.configure(text="Mở ứng dụng đã cài trên máy.")
        elif step_type == "open_url":
            value_entry.configure(placeholder_text="facebook.com hoặc https://facebook.com")
            extra_entry.configure(state="normal", placeholder_text="để trống = browser mặc định")
            hint_label.configure(text="Mở trang web. Ô extra dùng cho browser, ví dụ: edge.")
        elif step_type == "open_file":
            value_entry.configure(placeholder_text=r"C:\Users\...\file.docx")
            extra_entry.delete(0, "end")
            extra_entry.configure(state="disabled", placeholder_text="Không dùng")
            hint_label.configure(text="Mở file trong thư mục an toàn của ứng dụng.")
        else:
            value_entry.configure(placeholder_text="Số giây chờ, ví dụ: 2")
            extra_entry.delete(0, "end")
            extra_entry.configure(state="disabled", placeholder_text="Không dùng")
            hint_label.configure(text="Tạm dừng giữa các bước.")

    def _move_step_row(self, frame, direction: int) -> None:
        row = self._find_row(frame)
        if not row:
            return
        current_index = self._step_rows.index(row)
        target_index = current_index + direction
        if target_index < 0 or target_index >= len(self._step_rows):
            return
        self._step_rows.pop(current_index)
        self._step_rows.insert(target_index, row)
        self._refresh_step_numbers()
        self.error_label.configure(text="")

    def _begin_step_drag(self, frame) -> None:
        row = self._find_row(frame)
        if not row:
            return
        self._dragging_step_frame = frame
        self._drag_target_frame = None
        self._drag_target_index = self._step_rows.index(row)
        frame.configure(border_width=1, border_color=self._palette["ACCENT"])
        self._update_drop_indicator(frame.winfo_rooty() + (frame.winfo_height() // 2))
        self.error_label.configure(text="Đang kéo step... giữ chuột và di chuyển lên/xuống, khung sẽ tự cuộn.")

    def _on_step_drag_motion(self, event) -> None:
        if self._dragging_step_frame is None:
            return
        self._auto_scroll_steps(event.y_root)
        self._update_drop_indicator(event.y_root)

    def _end_step_drag(self, event, frame) -> None:
        row = self._find_row(frame)
        if not row:
            return
        frame.configure(border_width=0, border_color=self._palette["BG_SECONDARY"])
        if self._dragging_step_frame is not frame:
            self._dragging_step_frame = None
            self._clear_drop_indicator()
            self.error_label.configure(text="")
            return
        current_index = self._step_rows.index(row)
        target_index = self._find_drop_index(event.y_root, fallback=current_index)
        self._dragging_step_frame = None
        if target_index != current_index:
            self._step_rows.pop(current_index)
            self._step_rows.insert(target_index, row)
            self._refresh_step_numbers()
        self._clear_drop_indicator()
        self.error_label.configure(text="")

    def _auto_scroll_steps(self, y_root: int) -> None:
        canvas = getattr(self.steps_frame, "_parent_canvas", None)
        if canvas is None:
            return
        top = canvas.winfo_rooty()
        bottom = top + canvas.winfo_height()
        margin = 64
        if y_root < top + margin:
            distance = max(1, (top + margin) - y_root)
            steps = 1 if distance < 18 else 2 if distance < 36 else 3
            canvas.yview_scroll(-steps, "units")
        elif y_root > bottom - margin:
            distance = max(1, y_root - (bottom - margin))
            steps = 1 if distance < 18 else 2 if distance < 36 else 3
            canvas.yview_scroll(steps, "units")

    def _update_drop_indicator(self, y_root: int) -> None:
        target_index = self._find_drop_index(y_root, fallback=0)
        self._drag_target_index = target_index
        self._apply_drag_target_highlight(target_index)
        if not self._step_rows:
            self.drop_indicator.place_forget()
            return
        if target_index >= len(self._step_rows):
            reference = self._step_rows[-1]["frame"]
            y_pos = reference.winfo_y() + reference.winfo_height() + 2
        else:
            reference = self._step_rows[target_index]["frame"]
            y_pos = max(2, reference.winfo_y() - 3)
        self.drop_indicator.place(x=10, y=y_pos, relwidth=0.96)

    def _apply_drag_target_highlight(self, target_index: int) -> None:
        next_target = None
        if 0 <= target_index < len(self._step_rows):
            next_target = self._step_rows[target_index]["frame"]
        if self._drag_target_frame is not None and self._drag_target_frame is not self._dragging_step_frame:
            self._drag_target_frame.configure(border_width=0, border_color=self._palette["BG_SECONDARY"])
        if next_target is not None and next_target is not self._dragging_step_frame:
            next_target.configure(border_width=1, border_color=self._palette["ACCENT_HOVER"])
        self._drag_target_frame = next_target

    def _clear_drop_indicator(self) -> None:
        self.drop_indicator.place_forget()
        if self._drag_target_frame is not None and self._drag_target_frame is not self._dragging_step_frame:
            self._drag_target_frame.configure(border_width=0, border_color=self._palette["BG_SECONDARY"])
        self._drag_target_frame = None
        self._drag_target_index = None

    def _find_drop_index(self, y_root: int, *, fallback: int) -> int:
        midpoints: list[tuple[int, int]] = []
        for index, row in enumerate(self._step_rows):
            frame = row.get("frame")
            if frame is None or not frame.winfo_exists():
                continue
            midpoints.append((frame.winfo_rooty() + (frame.winfo_height() // 2), index))
        if not midpoints:
            return fallback
        for midpoint, index in midpoints:
            if y_root < midpoint:
                return index
        return len(midpoints)

    def _remove_step_row(self, frame) -> None:
        if len(self._step_rows) <= 1:
            self.error_label.configure(text="Workflow cần ít nhất 1 bước.")
            return
        row = self._find_row(frame)
        if not row:
            return
        frame.destroy()
        self._step_rows.remove(row)
        self._clear_drop_indicator()
        self._refresh_step_numbers()

    def _refresh_step_numbers(self) -> None:
        for index, row in enumerate(self._step_rows, start=1):
            row["index_label"].configure(text=str(index))
            row["frame"].grid_configure(row=index - 1)
            row["up_btn"].configure(state="normal" if index > 1 else "disabled")
            row["down_btn"].configure(state="normal" if index < len(self._step_rows) else "disabled")

    def _collect_steps(self) -> list[dict]:
        steps: list[dict] = []
        for index, row in enumerate(self._step_rows, start=1):
            step_type = self._step_type_from_label(row["type_menu"].get())
            raw_value = row["value_entry"].get().strip()
            raw_extra = row["extra_entry"].get().strip()
            if step_type == "open_app":
                if not raw_value:
                    raise ValueError(f"Step {index} thiếu tên ứng dụng.")
                params = {"app_name": raw_value}
            elif step_type == "open_url":
                if not raw_value:
                    raise ValueError(f"Step {index} thiếu URL.")
                params = {"url": raw_value, "browser": raw_extra or "default"}
            elif step_type == "open_file":
                if not raw_value:
                    raise ValueError(f"Step {index} thiếu đường dẫn file.")
                params = {"path": raw_value}
            else:
                if not raw_value:
                    raise ValueError(f"Step {index} thiếu số giây chờ.")
                params = {"seconds": raw_value}
            steps.append({"type": step_type, "params": params})
        return steps

    def _collect_run_policy(self) -> dict:
        mode = self._run_mode_from_label(self.run_mode_menu.get())
        start_delay = self.start_delay_entry.get().strip() or "0"
        run_policy: dict[str, object] = {
            "mode": mode,
            "start_delay_seconds": start_delay,
        }
        if mode == "repeat":
            run_policy["repeat_count"] = self.repeat_count_entry.get().strip() or "1"
            run_policy["repeat_interval_seconds"] = self.repeat_interval_entry.get().strip() or "0"
        elif mode == "scheduled":
            schedule = {
                "type": self._schedule_type_from_label(self.schedule_type_menu.get()),
                "time": self.schedule_time_entry.get().strip() or "08:00",
            }
            if schedule["type"] == "weekly":
                days = [key for key, var in self._weekday_vars.items() if var.get() == "1"]
                schedule["days"] = days
            run_policy["schedule"] = schedule
        return run_policy

    def _save_workflow(self) -> None:
        name = self.name_entry.get().strip()
        description = self.description_text.get("1.0", "end").strip()
        try:
            steps = self._collect_steps()
            run_policy = self._collect_run_policy()
            if self._selected_workflow_id:
                workflow = self._service.update_workflow(
                    self._selected_workflow_id,
                    name=name,
                    description=description,
                    steps=steps,
                    enabled=bool(self.enabled_switch.get()),
                    continue_on_error=bool(self.continue_switch.get()),
                    run_policy=run_policy,
                )
                message = f"Đã cập nhật workflow '{workflow['name']}'."
            else:
                workflow = self._service.create_workflow(
                    name=name,
                    description=description,
                    steps=steps,
                    enabled=bool(self.enabled_switch.get()),
                    continue_on_error=bool(self.continue_switch.get()),
                    run_policy=run_policy,
                )
                self._selected_workflow_id = str(workflow.get("id") or "")
                message = f"Đã tạo workflow '{workflow['name']}'."
            self.error_label.configure(text="")
            self._reload_workflows(select_first=True)
            self._emit_message(message, "success")
        except Exception as exc:
            self.error_label.configure(text=str(exc))

    def _delete_selected(self) -> None:
        if not self._selected_workflow_id:
            self.error_label.configure(text="Chưa chọn workflow để xóa.")
            return
        try:
            deleted = self._service.delete_workflow(self._selected_workflow_id)
            self._emit_message(f"Đã xóa workflow '{deleted['name']}'.", "success")
            self._selected_workflow_id = ""
            self._reload_workflows(select_first=True)
            if self._workflows:
                self._select_workflow(self._workflows[0])
            else:
                self._new_workflow()
        except Exception as exc:
            self.error_label.configure(text=str(exc))

    def _run_selected(self) -> None:
        target = self._selected_workflow_id or self.name_entry.get().strip()
        if not target:
            self.error_label.configure(text="Chưa có workflow để chạy.")
            return
        self.error_label.configure(text="")
        self._on_run(target)

    def _emit_message(self, message: str, style: str = "normal") -> None:
        if self._on_message:
            self._on_message(message, style)
