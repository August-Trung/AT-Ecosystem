from __future__ import annotations

import ctypes
import ctypes.wintypes
from datetime import datetime, timedelta, timezone
import customtkinter as ctk
from typing import Callable


def _get_work_area() -> tuple[int, int, int, int]:
    """Trả về (x, y, width, height) của vùng màn hình không bị taskbar che."""
    try:
        SPI_GETWORKAREA = 48
        rect = ctypes.wintypes.RECT()
        ctypes.windll.user32.SystemParametersInfoW(
            SPI_GETWORKAREA, 0, ctypes.byref(rect), 0
        )
        return rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top
    except Exception:
        import tkinter as tk
        r = tk.Tk()
        w = r.winfo_screenwidth()
        h = r.winfo_screenheight()
        r.destroy()
        return 0, 0, w, h

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE


VN_TZ = timezone(timedelta(hours=7))


class ReminderDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_submit: Callable[[str, str, str], None],
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_submit = on_submit
        self._is_maximized = False
        self._normal_geometry = "820x760"
        self._drag_x = 0
        self._drag_y = 0

        self.configure(fg_color=palette["BG_PRIMARY"])
        self.geometry("820x760")
        self.minsize(720, 660)
        self.transient(master)
        self.grab_set()
        self.overrideredirect(True)   # ẩn title bar gốc của OS

        # Center on screen on open
        self.after(0, self._center_window)

        # ── Custom title bar ──────────────────────────────────────────
        title_bar = ctk.CTkFrame(
            self,
            fg_color=palette["BG_SECONDARY"],
            height=42,
            corner_radius=0,
        )
        title_bar.pack(fill="x", side="top")
        title_bar.pack_propagate(False)

        title_lbl = ctk.CTkLabel(
            title_bar,
            text="  Tạo reminder",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        )
        title_lbl.pack(side="left", padx=(8, 0))

        # Close button  ✕
        close_btn = ctk.CTkButton(
            title_bar,
            text="✕",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            fg_color="transparent",
            hover_color="#E81123",
            text_color=palette["FG_PRIMARY"],
            corner_radius=0,
            width=46,
            height=42,
            command=self.destroy,
        )
        close_btn.pack(side="right")

        # Restore / Maximize button  ❐
        self._restore_btn = ctk.CTkButton(
            title_bar,
            text="❐",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            fg_color="transparent",
            hover_color=palette["ACCENT_CHOICE"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=0,
            width=46,
            height=42,
            command=self._toggle_maximize,
        )
        self._restore_btn.pack(side="right")

        # Make title bar draggable
        for w in (title_bar, title_lbl):
            w.bind("<ButtonPress-1>", self._start_drag)
            w.bind("<B1-Motion>", self._on_drag)
            w.bind("<Double-Button-1>", lambda _e: self._toggle_maximize())

        # ── Main content ──────────────────────────────────────────────
        shell = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        shell.pack(fill="both", expand=True, padx=18, pady=(8, 18))
        shell.grid_columnconfigure(0, weight=1)
        shell.grid_rowconfigure(0, weight=1)
        shell.grid_rowconfigure(1, weight=0)

        content = ctk.CTkScrollableFrame(
            shell,
            fg_color=palette["BG_PRIMARY"],
            scrollbar_button_color=palette["ACCENT_CHOICE"],
            scrollbar_button_hover_color=palette["ACCENT_CHOICE_HOVER"],
        )
        content.grid(row=0, column=0, sticky="nsew")
        content.grid_columnconfigure((0, 1, 2), weight=1)
        content.grid_rowconfigure(10, weight=1, minsize=220)

        ctk.CTkLabel(
            content,
            text="Tạo reminder nhanh",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=3, sticky="ew", pady=(0, 6))

        ctk.CTkLabel(
            content,
            text="Nhập nội dung và chọn thời gian nhắc. Reminder sẽ được lưu trực tiếp, không cần gõ lệnh chat.",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=700,
        ).grid(row=1, column=0, columnspan=3, sticky="ew", pady=(0, 14))

        self.title_entry = self._build_labeled_entry(content, "Tiêu đề reminder", row=2, columnspan=3)
        self.title_entry.configure(placeholder_text="Ví dụ: Họp khóa luận")

        ctk.CTkLabel(
            content,
            text="Thời gian dd/MM/yyyy, giờ:phút",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=4, column=0, columnspan=3, sticky="ew", pady=(0, 6))

        self.date_entry = ctk.CTkEntry(
            content,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=42,
            fg_color=palette["BG_INPUT"],
            text_color=palette["FG_PRIMARY"],
            placeholder_text="dd/mm/yyyy",
            placeholder_text_color=palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        self.date_entry.grid(row=5, column=0, sticky="ew", padx=(0, 6), pady=(0, 10))

        self.hour_entry = ctk.CTkEntry(
            content,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=42,
            fg_color=palette["BG_INPUT"],
            text_color=palette["FG_PRIMARY"],
            placeholder_text="Giờ (0-23)",
            placeholder_text_color=palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        self.hour_entry.grid(row=5, column=1, sticky="ew", padx=3, pady=(0, 10))

        self.minute_entry = ctk.CTkEntry(
            content,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=42,
            fg_color=palette["BG_INPUT"],
            text_color=palette["FG_PRIMARY"],
            placeholder_text="Phút (0-59)",
            placeholder_text_color=palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        self.minute_entry.grid(row=5, column=2, sticky="ew", padx=(6, 0), pady=(0, 10))

        ctk.CTkLabel(
            content,
            text="Thiết lập nhanh",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=6, column=0, columnspan=3, sticky="ew", pady=(0, 6))

        quick_actions = ctk.CTkFrame(content, fg_color="transparent")
        quick_actions.grid(row=7, column=0, columnspan=3, sticky="ew", pady=(0, 10))
        quick_actions.grid_columnconfigure((0, 1, 2, 3), weight=1)

        quick_specs = [
            ("+10 phút", lambda: self._set_due_datetime(datetime.now(VN_TZ) + timedelta(minutes=10))),
            ("+30 phút", lambda: self._set_due_datetime(datetime.now(VN_TZ) + timedelta(minutes=30))),
            ("Tối nay 20:00", self._set_tonight),
            ("Sáng mai 08:00", self._set_tomorrow_morning),
        ]
        for index, (label, command) in enumerate(quick_specs):
            ctk.CTkButton(
                quick_actions,
                text=label,
                height=36,
                corner_radius=11,
                fg_color=palette["ACCENT_CHOICE"],
                hover_color=palette["ACCENT_CHOICE_HOVER"],
                text_color=palette["FG_PRIMARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                command=command,
            ).grid(row=0, column=index, sticky="ew", padx=3)

        self.preview_label = ctk.CTkLabel(
            content,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=700,
        )
        self.preview_label.grid(row=8, column=0, columnspan=3, sticky="ew", pady=(0, 12))

        ctk.CTkLabel(
            content,
            text="Ghi chú",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=9, column=0, columnspan=3, sticky="ew", pady=(0, 6))

        self.message_text = ctk.CTkTextbox(
            content,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=220,
            text_color=palette["FG_PRIMARY"],
            fg_color=palette["BG_INPUT"],
            border_width=0,
            corner_radius=12,
            activate_scrollbars=True,
        )
        self.message_text.grid(row=10, column=0, columnspan=3, sticky="nsew", pady=(0, 10))

        self.error_label = ctk.CTkLabel(
            content,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_ERROR"],
            anchor="w",
            justify="left",
            wraplength=700,
        )
        self.error_label.grid(row=11, column=0, columnspan=3, sticky="ew", pady=(10, 0))

        # ── Bottom action bar ─────────────────────────────────────────
        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=1, column=0, sticky="ew", pady=(18, 0))
        actions.grid_columnconfigure(0, weight=1)
        actions.grid_columnconfigure(1, weight=0)

        ctk.CTkButton(
            actions,
            text="Tạo reminder",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._submit,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 6))

        ctk.CTkButton(
            actions,
            text="Đóng",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self.destroy,
        ).grid(row=0, column=1, sticky="e")

        self.title_entry.focus_set()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self._set_due_datetime(datetime.now(VN_TZ) + timedelta(minutes=10))
        self.date_entry.bind("<KeyRelease>", lambda _e: self._update_preview())
        self.hour_entry.bind("<KeyRelease>", lambda _e: self._update_preview())
        self.minute_entry.bind("<KeyRelease>", lambda _e: self._update_preview())

    # ──────────────────────────── WINDOW DRAG ────────────────────────────

    def _center_window(self) -> None:
        self.update_idletasks()
        w, h = 820, 760
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = (sw - w) // 2
        y = (sh - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")
        self._normal_geometry = self.geometry()
        self.lift()
        self.focus_force()

    def _start_drag(self, event) -> None:
        if self._is_maximized:
            return
        self._drag_x = event.x
        self._drag_y = event.y

    def _on_drag(self, event) -> None:
        if self._is_maximized:
            return
        x = self.winfo_x() + (event.x - self._drag_x)
        y = self.winfo_y() + (event.y - self._drag_y)
        self.geometry(f"+{x}+{y}")

    # ──────────────────────────── WINDOW STATE ────────────────────────────

    def _toggle_maximize(self) -> None:
        if self._is_maximized:
            self.geometry(self._normal_geometry)
            self._is_maximized = False
            self._restore_btn.configure(text="❐")
        else:
            self._normal_geometry = self.geometry()
            wx, wy, ww, wh = _get_work_area()
            self.geometry(f"{ww}x{wh}+{wx}+{wy}")
            self._is_maximized = True
            self._restore_btn.configure(text="🗗")
        self.lift()
        self.focus_force()

    # ──────────────────────────── HELPERS ────────────────────────────

    def _build_labeled_entry(self, master, label: str, *, row: int, columnspan: int = 1) -> ctk.CTkEntry:
        ctk.CTkLabel(
            master,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=row, column=0, columnspan=columnspan, sticky="ew", pady=(0, 6))

        entry = ctk.CTkEntry(
            master,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        entry.grid(row=row + 1, column=0, columnspan=columnspan, sticky="ew", pady=(0, 12))
        return entry

    # ──────────────────────────── DATE / TIME ────────────────────────────

    def _set_due_datetime(self, due_at: datetime) -> None:
        due_at = due_at.astimezone(VN_TZ)
        self.date_entry.delete(0, "end")
        self.date_entry.insert(0, due_at.strftime("%d/%m/%Y"))
        self.hour_entry.delete(0, "end")
        self.hour_entry.insert(0, due_at.strftime("%H"))
        self.minute_entry.delete(0, "end")
        self.minute_entry.insert(0, due_at.strftime("%M"))
        self._update_preview()

    def _set_tonight(self) -> None:
        now = datetime.now(VN_TZ)
        due_at = now.replace(hour=20, minute=0, second=0, microsecond=0)
        if due_at <= now:
            due_at += timedelta(days=1)
        self._set_due_datetime(due_at)

    def _set_tomorrow_morning(self) -> None:
        now = datetime.now(VN_TZ) + timedelta(days=1)
        due_at = now.replace(hour=8, minute=0, second=0, microsecond=0)
        self._set_due_datetime(due_at)

    def _parse_due_at(self) -> datetime:
        raw_date = self.date_entry.get().strip()
        if not raw_date:
            raise ValueError("Thiếu ngày nhắc.")
        try:
            date_part = datetime.strptime(raw_date, "%d/%m/%Y")
        except ValueError as exc:
            raise ValueError("Ngày nhắc phải theo định dạng dd/mm/yyyy.") from exc

        raw_hour = self.hour_entry.get().strip()
        raw_minute = self.minute_entry.get().strip()
        if not raw_hour:
            raise ValueError("Thiếu giờ nhắc.")
        if not raw_minute:
            raise ValueError("Thiếu phút nhắc.")
        if not raw_hour.isdigit():
            raise ValueError("Giờ nhắc phải là số từ 0 đến 23.")
        if not raw_minute.isdigit():
            raise ValueError("Phút nhắc phải là số từ 0 đến 59.")
        hour = int(raw_hour)
        minute = int(raw_minute)
        if not 0 <= hour <= 23:
            raise ValueError("Giờ nhắc phải nằm trong khoảng 0-23.")
        if not 0 <= minute <= 59:
            raise ValueError("Phút nhắc phải nằm trong khoảng 0-59.")
        return datetime(
            year=date_part.year,
            month=date_part.month,
            day=date_part.day,
            hour=hour,
            minute=minute,
            tzinfo=VN_TZ,
        )

    def _update_preview(self) -> None:
        try:
            due_at = self._parse_due_at()
        except ValueError:
            self.preview_label.configure(text="Ví dụ thời gian: 07/04/2026, 17:30")
            return
        self.preview_label.configure(
            text=f"Sẽ nhắc vào {due_at.strftime('%H:%M - %d/%m/%Y')} (GMT+7)."
        )

    # ──────────────────────────── SUBMIT ────────────────────────────

    def _submit(self) -> None:
        title = self.title_entry.get().strip()
        message = self.message_text.get("1.0", "end").strip()

        if not title:
            self.error_label.configure(text="Thiếu tiêu đề reminder.")
            self.title_entry.focus_set()
            return

        try:
            due_at = self._parse_due_at()
        except ValueError as exc:
            self.error_label.configure(text=str(exc))
            self.date_entry.focus_set()
            return

        if due_at <= datetime.now(VN_TZ):
            self.error_label.configure(text="Thời gian reminder phải nằm trong tương lai.")
            self.date_entry.focus_set()
            return

        self.error_label.configure(text="")
        self._on_submit(title, message or title, due_at.isoformat())
        self.destroy()
