from __future__ import annotations

import ctypes
import ctypes.wintypes
import customtkinter as ctk
import threading
import tkinter.filedialog as filedialog
import tkinter.messagebox as messagebox
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

from src.gui.theme import (
    FONT_FAMILY,
    FONT_SIZE_NORMAL,
    FONT_SIZE_SMALL,
    FONT_SIZE_TITLE,
)
from src.core import executor
from src.plugins.google_drive_service import GoogleDriveService

DRIVE_FONT_NORMAL = FONT_SIZE_NORMAL + 2
DRIVE_FONT_SMALL = FONT_SIZE_SMALL + 2
DRIVE_FONT_TITLE = FONT_SIZE_TITLE + 2


class SelectDriveItemDialog(ctk.CTkToplevel):
    def __init__(
        self, master, *, title: str, items: list[dict], palette: dict[str, str]
    ):
        super().__init__(master)
        self._palette = palette
        self._items = items
        self.selection: dict | None = None

        self.title(title)
        self.geometry("620x460")
        self.resizable(True, True)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        ctk.CTkLabel(
            self,
            text=title,
            font=(FONT_FAMILY, DRIVE_FONT_TITLE, "bold"),
            text_color=palette["FG_PRIMARY"],
        ).pack(anchor="w", padx=18, pady=(18, 8))

        ctk.CTkLabel(
            self,
            text="Chọn đúng mục trong danh sách bên dưới.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=palette["FG_SECONDARY"],
        ).pack(anchor="w", padx=18, pady=(0, 10))

        container = ctk.CTkScrollableFrame(
            self,
            fg_color=palette["BG_SECONDARY"],
            corner_radius=14,
        )
        container.pack(fill="both", expand=True, padx=16, pady=(0, 14))

        for item in items:
            card = ctk.CTkFrame(
                container, fg_color=palette["BG_INPUT"], corner_radius=12
            )
            card.pack(fill="x", padx=8, pady=8)

            ctk.CTkLabel(
                card,
                text=item.get("display_label")
                or item.get("name")
                or item.get("id")
                or "",
                font=(FONT_FAMILY, DRIVE_FONT_NORMAL, "bold"),
                text_color=palette["FG_PRIMARY"],
                anchor="w",
            ).pack(fill="x", padx=14, pady=(12, 2))

            ctk.CTkLabel(
                card,
                text=item.get("display_path") or item.get("path") or "My Drive",
                font=(FONT_FAMILY, DRIVE_FONT_SMALL),
                text_color=palette["FG_SECONDARY"],
                anchor="w",
            ).pack(fill="x", padx=14, pady=(0, 10))

            ctk.CTkButton(
                card,
                text="Chọn mục này",
                font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
                fg_color=palette["ACCENT"],
                hover_color=palette["ACCENT_HOVER"],
                text_color="#ffffff",
                corner_radius=10,
                command=lambda value=item: self._select(value),
            ).pack(anchor="e", padx=12, pady=(0, 12))

        ctk.CTkButton(
            self,
            text="Hủy",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL, "bold"),
            fg_color=palette["ACCENT_CANCEL"],
            hover_color=palette["ACCENT_CANCEL_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self.destroy,
        ).pack(anchor="e", padx=16, pady=(0, 16))

    def _select(self, item: dict) -> None:
        self.selection = item
        self.destroy()


def pick_drive_item(
    master, *, title: str, items: list[dict], palette: dict[str, str]
) -> dict | None:
    dialog = SelectDriveItemDialog(master, title=title, items=items, palette=palette)
    dialog.wait_window()
    return dialog.selection


class DriveManagerDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_message: Callable[[str, str], None] | None = None,
    ):
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._service = GoogleDriveService()

        # Multi-select state
        self._selected_items: list[dict] = []
        self._selected_target_folder: dict | None = None
        self._selected_upload_folder: dict | None = None
        self._card_frames: dict[str, ctk.CTkFrame] = {}
        self._card_select_buttons: dict[str, ctk.CTkButton] = {}
        self._current_items: list[dict] = []

        self._current_folder: dict | None = None
        self._folder_stack: list[dict | None] = []
        self._busy = False
        self._busy_message = ""
        self._spinner_after_id: str | None = None
        self._spinner_index = 0
        self._busy_widgets: list[object] = []
        self._is_maximized = False
        self._normal_geometry = ""

        # ── Cửa sổ OS độc lập (không modal, không custom title bar) ──
        self.title("Google Drive Manager")
        self.geometry("960x720")
        self.minsize(820, 620)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self.after(0, self._setup_window)

        # ── Main container ────────────────────────────────────────────
        container = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        container.pack(fill="both", expand=True)
        container.grid_columnconfigure(0, weight=3)
        container.grid_columnconfigure(1, weight=2)
        container.grid_rowconfigure(1, weight=1)

        self._build_header(container)
        self._build_workspace(container)
        self.after(50, self._load_root_items)

    # ──────────────────────────── BUILD UI ────────────────────────────

    def _build_header(self, master) -> None:
        header = ctk.CTkFrame(master, fg_color=self._palette["BG_PRIMARY"])
        header.grid(row=0, column=0, columnspan=2, sticky="ew", padx=18, pady=(10, 6))
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            header,
            text="Quản lý folder và file trên Drive: tạo, đổi tên, di chuyển, đưa vào thùng rác.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew")

        # Spinner hiển thị khi đang thực hiện tác vụ bất đồng bộ
        self.loading_label = ctk.CTkLabel(
            header,
            text="",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            text_color=self._palette["ACCENT"],
            anchor="e",
        )
        self.loading_label.grid(row=0, column=1, sticky="e", padx=(12, 0))

    def _build_workspace(self, master) -> None:
        left = ctk.CTkFrame(
            master, fg_color=self._palette["BG_SECONDARY"], corner_radius=18
        )
        right = ctk.CTkScrollableFrame(
            master,
            fg_color=self._palette["BG_SECONDARY"],
            corner_radius=18,
            scrollbar_button_color=self._palette["SCROLLBAR_COLOR"],
            scrollbar_button_hover_color=self._palette["SCROLLBAR_HOVER"],
        )
        left.grid(row=1, column=0, sticky="nsew", padx=(18, 9), pady=(0, 18))
        right.grid(row=1, column=1, sticky="nsew", padx=(9, 18), pady=(0, 18))
        left.grid_rowconfigure(5, weight=1)  # row 5 = results frame (expandable)
        left.grid_columnconfigure(0, weight=1)
        right.grid_columnconfigure(0, weight=1)

        self._build_search_panel(left)
        self._build_results_panel(left)
        self._build_action_panel(right)

    def _build_search_panel(self, master) -> None:
        ctk.CTkLabel(
            master,
            text="Tìm file / folder trên Drive",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).grid(row=0, column=0, sticky="w", padx=18, pady=(18, 6))

        row = ctk.CTkFrame(master, fg_color="transparent")
        row.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 8))
        row.grid_columnconfigure(0, weight=1)

        self.search_entry = ctk.CTkEntry(
            row,
            placeholder_text="Nhập từ khóa để lọc file hoặc folder trên Google Drive",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL),
            height=42,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        self.search_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self._register_busy_widget(self.search_entry)

        self.search_filter = ctk.CTkSegmentedButton(
            row,
            values=["Tất cả", "File", "Folder"],
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            selected_color=self._palette["ACCENT"],
            selected_hover_color=self._palette["ACCENT_HOVER"],
            unselected_color=self._palette["ACCENT_CHOICE"],
            unselected_hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
        )
        self.search_filter.set("Tất cả")
        self.search_filter.grid(row=0, column=1, padx=(0, 8))
        self._register_busy_widget(self.search_filter)

        self.search_button = ctk.CTkButton(
            row,
            text="Tìm",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=12,
            command=self._search_items,
        )
        self.search_button.grid(row=0, column=2)
        self._register_busy_widget(self.search_button)

        self.search_status = ctk.CTkLabel(
            master,
            text="",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
        )
        self.search_status.grid(row=2, column=0, sticky="w", padx=18, pady=(0, 4))

        browser_row = ctk.CTkFrame(master, fg_color="transparent")
        browser_row.grid(row=3, column=0, sticky="ew", padx=18, pady=(0, 6))
        browser_row.grid_columnconfigure(1, weight=1)

        self._make_button(browser_row, "My Drive", self._go_to_root, accent=False).grid(
            row=0, column=0, padx=(0, 8)
        )
        self._make_button(
            browser_row, "Lùi 1 cấp", self._go_up_one_level, accent=False
        ).grid(row=0, column=2, padx=(8, 0))

        self.current_folder_label = ctk.CTkLabel(
            browser_row,
            text="Đang xem: My Drive",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        self.current_folder_label.grid(row=0, column=1, sticky="ew")

    def _build_results_panel(self, master) -> None:
        # ── Multi-select toolbar (row 4) ──
        toolbar = ctk.CTkFrame(master, fg_color="transparent")
        toolbar.grid(row=4, column=0, sticky="ew", padx=18, pady=(0, 4))
        toolbar.grid_columnconfigure(1, weight=1)

        select_all_btn = ctk.CTkButton(
            toolbar,
            text="Chọn tất cả",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=10,
            height=30,
            command=self._select_all_items,
        )
        select_all_btn.grid(row=0, column=0, padx=(0, 6))
        self._register_busy_widget(select_all_btn)

        self._selection_count_label = ctk.CTkLabel(
            toolbar,
            text="Chưa chọn mục nào",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            text_color=self._palette["ACCENT"],
            anchor="center",
        )
        self._selection_count_label.grid(row=0, column=1, sticky="ew")

        deselect_all_btn = ctk.CTkButton(
            toolbar,
            text="Bỏ chọn tất cả",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            height=30,
            command=self._deselect_all_items,
        )
        deselect_all_btn.grid(row=0, column=2, padx=(6, 0))
        self._register_busy_widget(deselect_all_btn)

        # ── Results scrollable frame (row 5) ──
        self.results_frame = ctk.CTkScrollableFrame(
            master,
            fg_color=self._palette["BG_PRIMARY"],
            corner_radius=16,
        )
        self.results_frame.grid(row=5, column=0, sticky="nsew", padx=18, pady=(0, 18))

    def _build_action_panel(self, master) -> None:
        self._action_row = 0

        header_frame = ctk.CTkFrame(master, fg_color="transparent")
        header_frame.grid(
            row=self._action_row, column=0, sticky="ew", padx=18, pady=(18, 8)
        )
        header_frame.grid_columnconfigure(0, weight=1)
        self._action_row += 1

        ctk.CTkLabel(
            header_frame,
            text="Mục đang chọn",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL + 2, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="w")

        self.deselect_btn = self._make_button(
            header_frame, "Bỏ chọn tất cả", self._deselect_all_items, danger=True
        )
        self.deselect_btn.configure(height=28)
        self.deselect_btn.grid(row=0, column=1, sticky="e")
        self.deselect_btn.grid_remove()

        self.selected_summary = ctk.CTkTextbox(
            master,
            height=120,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            corner_radius=14,
            border_width=0,
        )
        self.selected_summary.grid(
            row=self._action_row, column=0, sticky="ew", padx=18, pady=(0, 18)
        )
        self._action_row += 1
        self.selected_summary.insert("1.0", "Chưa chọn file hoặc folder nào.")
        self.selected_summary.configure(state="disabled")

        upload_box = self._make_section(master, "Upload file từ máy")
        self.upload_target_label = ctk.CTkLabel(
            upload_box,
            text="Đích upload: My Drive",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.upload_target_label.pack(fill="x", padx=14, pady=(0, 8))
        self.upload_files_label = ctk.CTkLabel(
            upload_box,
            text="Chưa chọn file local nào.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.upload_files_label.pack(fill="x", padx=14, pady=(2, 8))
        upload_actions = ctk.CTkFrame(upload_box, fg_color="transparent")
        upload_actions.pack(fill="x", padx=12, pady=(0, 12))
        self._make_button(
            upload_actions, "Chọn file", self._pick_upload_files, accent=False
        ).pack(side="left")
        self._make_button(
            upload_actions, "Upload", self._upload_selected_files, accent=True
        ).pack(side="right")

        create_box = self._make_section(master, "Tạo folder")
        self.create_name_entry = self._make_entry(create_box, "Tên folder mới")
        self.create_parent_label = ctk.CTkLabel(
            create_box,
            text="Folder cha: My Drive",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.create_parent_label.pack(fill="x", padx=14, pady=(0, 8))
        self._make_button(
            create_box, "Tạo folder", self._create_folder, accent=True
        ).pack(anchor="e", padx=12, pady=(0, 12))

        rename_box = self._make_section(master, "Đổi tên (1 mục)")
        self.rename_entry = self._make_entry(rename_box, "Tên mới")
        self._make_button(
            rename_box, "Đổi tên", self._rename_selected, accent=True
        ).pack(anchor="e", padx=12, pady=(0, 12))

        download_box = self._make_section(master, "Tải file về máy")
        ctk.CTkLabel(
            download_box,
            text="Chọn 1 hoặc nhiều file ở danh sách bên trái, sau đó bấm 'Tải về'. Nếu chọn nhiều file, hãy chọn thư mục lưu.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=280,
        ).pack(fill="x", padx=14, pady=(0, 8))
        self._make_button(
            download_box, "Tải về", self._download_selected, success=True
        ).pack(anchor="e", padx=12, pady=(0, 12))

        share_box = self._make_section(master, "Lấy link chia sẻ")
        ctk.CTkLabel(
            share_box,
            text=(
                "Chọn 1 hoặc nhiều file/folder, sau đó lấy link. "
                "Bạn có thể bật chế độ công khai để bất kỳ ai có link đều xem được."
            ),
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=280,
        ).pack(fill="x", padx=14, pady=(0, 8))
        self.share_link_text = ctk.CTkTextbox(
            share_box,
            height=90,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            corner_radius=12,
            border_width=0,
        )
        self.share_link_text.pack(fill="x", padx=12, pady=(0, 8))
        self.share_link_text.insert("1.0", "Chưa có link chia sẻ.")
        self.share_link_text.configure(state="disabled")

        share_actions = ctk.CTkFrame(share_box, fg_color="transparent")
        share_actions.pack(fill="x", padx=12, pady=(0, 12))
        self._make_button(
            share_actions, "Lấy link", self._get_share_link, accent=False
        ).pack(side="left")
        self._make_button(
            share_actions,
            "Lấy link công khai",
            lambda: self._get_share_link(make_public=True),
            accent=True,
        ).pack(side="left", padx=(8, 0))
        self._make_button(
            share_actions, "Sao chép link", self._copy_share_link, success=True
        ).pack(side="right")

        move_box = self._make_section(master, "Di chuyển file đang chọn")
        ctk.CTkLabel(
            move_box,
            text="Chọn 1 hoặc nhiều file, rồi chọn 1 folder làm đích. Folder được chọn sẽ tự động trở thành đích di chuyển.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=280,
        ).pack(fill="x", padx=14, pady=(0, 8))
        self.move_target_label = ctk.CTkLabel(
            move_box,
            text="Folder đích chưa chọn.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        self.move_target_label.pack(fill="x", padx=14, pady=(2, 8))
        move_actions = ctk.CTkFrame(move_box, fg_color="transparent")
        move_actions.pack(fill="x", padx=12, pady=(0, 12))
        self._make_button(
            move_actions, "Di chuyển", self._move_selected, accent=True
        ).pack(side="right")

        trash_box = self._make_section(master, "Đưa vào thùng rác Drive")
        ctk.CTkLabel(
            trash_box,
            text="Tất cả mục đang chọn sẽ được chuyển vào thùng rác Google Drive, không xóa vĩnh viễn.",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=280,
        ).pack(fill="x", padx=14, pady=(0, 8))
        self._make_button(
            trash_box,
            "Đưa vào thùng rác",
            self._trash_selected,
            accent=False,
            danger=True,
        ).pack(anchor="e", padx=12, pady=(0, 12))

    # ──────────────────────────── WIDGET HELPERS ────────────────────────────

    def _make_section(self, master, title: str):
        frame = ctk.CTkFrame(
            master, fg_color=self._palette["BG_PRIMARY"], corner_radius=16
        )
        frame.grid(row=self._action_row, column=0, sticky="ew", padx=18, pady=(0, 14))
        self._action_row += 1
        ctk.CTkLabel(
            frame,
            text=title,
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        ).pack(anchor="w", padx=14, pady=(14, 10))
        return frame

    def _make_entry(self, master, placeholder: str):
        entry = ctk.CTkEntry(
            master,
            placeholder_text=placeholder,
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL),
            height=40,
            fg_color=self._palette["BG_INPUT"],
            text_color=self._palette["FG_PRIMARY"],
            placeholder_text_color=self._palette["FG_PLACEHOLDER"],
            border_width=0,
            corner_radius=12,
        )
        entry.pack(fill="x", padx=12, pady=(0, 8))
        self._register_busy_widget(entry)
        return entry

    def _make_button(
        self,
        master,
        text: str,
        command,
        *,
        accent: bool = False,
        danger: bool = False,
        success: bool = False,
    ):
        fg = self._palette["ACCENT_CHOICE"]
        hover = self._palette["ACCENT_CHOICE_HOVER"]
        text_color = self._palette["FG_PRIMARY"]
        if accent:
            fg = self._palette["ACCENT"]
            hover = self._palette["ACCENT_HOVER"]
            text_color = "#ffffff"
        if danger:
            fg = self._palette["ACCENT_CANCEL"]
            hover = self._palette["ACCENT_CANCEL_HOVER"]
            text_color = "#ffffff"
        if success:
            fg = "#10B981"
            hover = "#059669"
            text_color = "#ffffff"
        button = ctk.CTkButton(
            master,
            text=text,
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            fg_color=fg,
            hover_color=hover,
            text_color=text_color,
            corner_radius=10,
            command=command,
        )
        self._register_busy_widget(button)
        return button

    def _register_busy_widget(self, widget) -> None:
        self._busy_widgets.append(widget)

    # ──────────────────────────── BUSY / SPINNER ────────────────────────────

    def _set_busy(self, busy: bool, message: str = "") -> None:
        self._busy = busy
        self._busy_message = message if busy else ""
        state = "disabled" if busy else "normal"
        alive_widgets: list[object] = []
        for widget in self._busy_widgets:
            try:
                if widget.winfo_exists():
                    widget.configure(state=state)
                    alive_widgets.append(widget)
            except Exception:
                continue
        self._busy_widgets = alive_widgets
        if busy:
            self._spinner_index = 0
            self._animate_spinner()
        else:
            if self._spinner_after_id:
                try:
                    self.after_cancel(self._spinner_after_id)
                except Exception:
                    pass
                self._spinner_after_id = None
            self.loading_label.configure(text="")

    def _animate_spinner(self) -> None:
        if not self._busy or not self.winfo_exists():
            self.loading_label.configure(text="")
            self._spinner_after_id = None
            return
        frames = ["|", "/", "-", "\\"]
        frame = frames[self._spinner_index % len(frames)]
        self._spinner_index += 1
        self.loading_label.configure(text=f"{frame} {self._busy_message}")
        self._spinner_after_id = self.after(120, self._animate_spinner)

    def _run_async(self, task, on_success, *, busy_message: str) -> None:
        if self._busy:
            self._set_status(
                "Google Drive Manager đang xử lý tác vụ khác. Hãy chờ xong rồi thử lại.",
                error=True,
            )
            return

        self._set_busy(True, busy_message)

        def worker() -> None:
            try:
                payload = task()
            except Exception as exc:
                # Sau khi OAuth browser đóng (kể cả lỗi), đưa dialog lên foreground ngay
                self.after(0, lambda: self._finish_async(error=exc))
                return
            # Sau khi task hoàn thành (bao gồm OAuth flow), đưa dialog lên foreground
            self.after(
                0, lambda: self._finish_async(payload=payload, on_success=on_success)
            )

        threading.Thread(target=worker, daemon=True).start()

    def _finish_async(
        self, payload=None, on_success=None, error: Exception | None = None
    ) -> None:
        self._set_busy(False)
        # Sau khi browser OAuth đóng, Windows có thể trả focus về main window.
        # Lift cửa sổ lên foreground để user biết tác vụ đã hoàn tất.
        try:
            if self.winfo_exists():
                self.lift()
                self.focus_force()
        except Exception:
            pass
        if error is not None:
            self._set_status(str(error), error=True)
            return
        if on_success:
            on_success(payload)

    # ──────────────────────────── BROWSE / SEARCH ────────────────────────────

    def _search_items(self) -> None:
        query = self.search_entry.get().strip()
        item_type = {"Tất cả": "all", "File": "file", "Folder": "folder"}[
            self.search_filter.get()
        ]

        def task():
            if query:
                parent_id = (self._current_folder or {}).get("id") or None
                items = self._service.search_items(
                    query, parent_id=parent_id, item_type=item_type, max_results=100
                )
            else:
                items = self._list_current_folder_items(
                    item_type=item_type, max_results=100
                )
            return [self._service.describe_item(item) for item in items]

        self._run_async(
            task,
            lambda enriched: self._render_results(enriched, query=query),
            busy_message="Đang tìm trên Google Drive",
        )

    def _load_root_items(self) -> None:
        self._current_folder = None
        self._folder_stack = []
        item_type = {"Tất cả": "all", "File": "file", "Folder": "folder"}[
            self.search_filter.get()
        ]

        def task():
            items = self._service.list_root_items(item_type=item_type, max_results=100)
            return [self._service.describe_item(item) for item in items]

        self._run_async(
            task,
            lambda enriched: (
                self._update_current_folder_label(),
                self._render_results(enriched, query=""),
            ),
            busy_message="Đang tải My Drive",
        )

    def _list_current_folder_items(
        self, *, item_type: str, max_results: int
    ) -> list[dict]:
        if self._current_folder and self._current_folder.get("id"):
            return self._service.list_child_items(
                self._current_folder["id"],
                item_type=item_type,
                max_results=max_results,
            )
        return self._service.list_root_items(
            item_type=item_type, max_results=max_results
        )

    def _open_folder(self, item: dict) -> None:
        if item.get("mime_type") != GoogleDriveService.FOLDER_MIME_TYPE:
            self._set_status("Chỉ folder mới mở được để xem nội dung.", error=True)
            return
        self._folder_stack.append(self._current_folder)
        self._current_folder = item
        self.search_entry.delete(0, "end")
        self._refresh_current_view()

    def _go_to_root(self) -> None:
        self.search_entry.delete(0, "end")
        self._load_root_items()

    def _go_up_one_level(self) -> None:
        if not self._folder_stack:
            self._go_to_root()
            return
        self._current_folder = self._folder_stack.pop()
        self.search_entry.delete(0, "end")
        self._refresh_current_view()

    def _refresh_current_view(self) -> None:
        item_type = {"Tất cả": "all", "File": "file", "Folder": "folder"}[
            self.search_filter.get()
        ]

        def task():
            items = self._list_current_folder_items(
                item_type=item_type, max_results=100
            )
            return [self._service.describe_item(item) for item in items]

        self._run_async(
            task,
            lambda enriched: (
                self._update_current_folder_label(),
                self._render_results(enriched, query=""),
            ),
            busy_message="Đang tải dữ liệu Google Drive",
        )

    def _reload_browser_data(self) -> None:
        if self.search_entry.get().strip():
            self._search_items()
            return
        self._refresh_current_view()

    def _update_current_folder_label(self) -> None:
        if self._current_folder:
            text = (
                self._current_folder.get("display_path")
                or self._current_folder.get("name")
                or "My Drive"
            )
        else:
            text = "My Drive"
        self.current_folder_label.configure(text=f"Đang xem: {text}")
        # Sync upload/move/create targets to reflect the new current folder
        self._sync_selected_folder_targets()

    # ──────────────────────────── RENDER RESULTS ────────────────────────────

    def _render_results(self, items: list[dict], *, query: str) -> None:
        for child in self.results_frame.winfo_children():
            child.destroy()
        self._card_frames.clear()
        self._card_select_buttons.clear()
        self._current_items = list(items)

        if not items:
            if query:
                scope = (
                    self._current_folder.get("name")
                    if self._current_folder
                    else "My Drive"
                )
                self.search_status.configure(
                    text=f"Không tìm thấy mục phù hợp với '{query}' trong {scope}."
                )
            else:
                scope = (
                    self._current_folder.get("display_path")
                    if self._current_folder
                    else "My Drive"
                )
                self.search_status.configure(text=f"Không có mục nào trong {scope}.")
            return

        if query:
            scope = (
                self._current_folder.get("name") if self._current_folder else "My Drive"
            )
            self.search_status.configure(
                text=f"Tìm thấy {len(items)} mục phù hợp với '{query}' trong {scope}."
            )
        else:
            scope = (
                self._current_folder.get("display_path")
                if self._current_folder
                else "My Drive"
            )
            self.search_status.configure(
                text=f"Đang hiển thị {len(items)} mục trong {scope}."
            )
        for item in items:
            self._render_result_card(item)

    def _render_result_card(self, item: dict) -> None:
        item_id = item.get("id") or ""
        is_selected = any(i.get("id") == item_id for i in self._selected_items)

        card = ctk.CTkFrame(
            self.results_frame, fg_color=self._palette["BG_INPUT"], corner_radius=14
        )
        card.pack(fill="x", padx=8, pady=8)

        if item_id:
            self._card_frames[item_id] = card

        ctk.CTkLabel(
            card,
            text=item.get("display_label") or item.get("name") or item.get("id") or "",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", padx=14, pady=(12, 2))

        ctk.CTkLabel(
            card,
            text=item.get("display_path") or "My Drive",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).pack(fill="x", padx=14, pady=(0, 6))

        ctk.CTkLabel(
            card,
            text=f"ID: {item.get('id')}",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        ).pack(fill="x", padx=14, pady=(0, 10))

        actions = ctk.CTkFrame(card, fg_color="transparent")
        actions.pack(fill="x", padx=12, pady=(0, 12))

        if item.get("mime_type") == GoogleDriveService.FOLDER_MIME_TYPE:
            self._make_button(
                actions,
                "Mở folder",
                lambda value=item: self._open_folder(value),
                accent=False,
            ).pack(side="left")

        # Quick trash button
        trash_btn = ctk.CTkButton(
            actions,
            text="🗑",
            font=(FONT_FAMILY, DRIVE_FONT_NORMAL, "bold"),
            fg_color="transparent",
            hover_color=self._palette["ACCENT_CANCEL"],
            text_color=self._palette["FG_SECONDARY"],
            corner_radius=8,
            width=34,
            height=34,
            command=lambda value=item: self._trash_single_item(value),
        )
        trash_btn.pack(side="right", padx=(4, 0))
        self._register_busy_widget(trash_btn)

        # Selection toggle button
        select_btn = ctk.CTkButton(
            actions,
            text="✓ Đã chọn" if is_selected else "+ Chọn",
            font=(FONT_FAMILY, DRIVE_FONT_SMALL, "bold"),
            fg_color=self._palette["ACCENT"] if is_selected else self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_HOVER"] if is_selected else self._palette["ACCENT_CHOICE_HOVER"],
            text_color="#ffffff" if is_selected else self._palette["FG_PRIMARY"],
            corner_radius=10,
            command=lambda value=item: self._toggle_item_selection(value),
        )
        select_btn.pack(side="right")
        self._register_busy_widget(select_btn)

        if item_id:
            self._card_select_buttons[item_id] = select_btn

        # Highlight card if selected
        if is_selected:
            card.configure(fg_color=self._palette["ACCENT_CHOICE"])

    # ──────────────────────────── SELECTION MANAGEMENT ────────────────────────────

    def _toggle_item_selection(self, item: dict) -> None:
        item_id = item.get("id") or ""
        selected_ids = [i.get("id") for i in self._selected_items]

        if item_id in selected_ids:
            # Deselect
            self._selected_items = [i for i in self._selected_items if i.get("id") != item_id]
            if item_id in self._card_frames:
                try:
                    self._card_frames[item_id].configure(fg_color=self._palette["BG_INPUT"])
                except Exception:
                    pass
            if item_id in self._card_select_buttons:
                try:
                    self._card_select_buttons[item_id].configure(
                        text="+ Chọn",
                        fg_color=self._palette["ACCENT_CHOICE"],
                        hover_color=self._palette["ACCENT_CHOICE_HOVER"],
                        text_color=self._palette["FG_PRIMARY"],
                    )
                except Exception:
                    pass
        else:
            # Select
            self._selected_items.append(item)
            if item_id in self._card_frames:
                try:
                    self._card_frames[item_id].configure(fg_color=self._palette["ACCENT_CHOICE"])
                except Exception:
                    pass
            if item_id in self._card_select_buttons:
                try:
                    self._card_select_buttons[item_id].configure(
                        text="✓ Đã chọn",
                        fg_color=self._palette["ACCENT"],
                        hover_color=self._palette["ACCENT_HOVER"],
                        text_color="#ffffff",
                    )
                except Exception:
                    pass

        self._refresh_folder_target_from_selection()
        self._update_selection_summary()
        self._sync_selected_folder_targets()

    def _select_all_items(self) -> None:
        selected_ids = {i.get("id") for i in self._selected_items}
        for item in self._current_items:
            item_id = item.get("id") or ""
            if item_id not in selected_ids:
                self._selected_items.append(item)
                selected_ids.add(item_id)
                if item_id in self._card_frames:
                    try:
                        self._card_frames[item_id].configure(fg_color=self._palette["ACCENT_CHOICE"])
                    except Exception:
                        pass
                if item_id in self._card_select_buttons:
                    try:
                        self._card_select_buttons[item_id].configure(
                            text="✓ Đã chọn",
                            fg_color=self._palette["ACCENT"],
                            hover_color=self._palette["ACCENT_HOVER"],
                            text_color="#ffffff",
                        )
                    except Exception:
                        pass

        self._refresh_folder_target_from_selection()
        self._update_selection_summary()
        self._sync_selected_folder_targets()

    def _deselect_all_items(self) -> None:
        self._selected_items = []
        for item_id, frame in self._card_frames.items():
            try:
                frame.configure(fg_color=self._palette["BG_INPUT"])
            except Exception:
                pass
        for item_id, btn in self._card_select_buttons.items():
            try:
                btn.configure(
                    text="+ Chọn",
                    fg_color=self._palette["ACCENT_CHOICE"],
                    hover_color=self._palette["ACCENT_CHOICE_HOVER"],
                    text_color=self._palette["FG_PRIMARY"],
                )
            except Exception:
                pass

        self._selected_target_folder = None
        self._update_selection_summary()
        self._sync_selected_folder_targets()

    def _refresh_folder_target_from_selection(self) -> None:
        """Auto-set target folder from selected folders (first folder found)."""
        for item in self._selected_items:
            if item.get("mime_type") == GoogleDriveService.FOLDER_MIME_TYPE:
                self._selected_target_folder = self._service.describe_item(item)
                return
        # No folder selected — clear target only if it was auto-set from previous selection
        # (keep it if manually set — we have no way to distinguish, so leave as-is)

    def _update_selection_summary(self) -> None:
        self.selected_summary.configure(state="normal")
        self.selected_summary.delete("1.0", "end")

        count = len(self._selected_items)
        if count == 0:
            self.selected_summary.insert("1.0", "Chưa chọn file hoặc folder nào.")
            self.deselect_btn.grid_remove()
            self._selection_count_label.configure(text="Chưa chọn mục nào")
        else:
            lines = [f"{count} mục đã chọn:\n"]
            for item in self._selected_items:
                name = item.get("name") or item.get("id") or "?"
                item_type = item.get("item_type") or ""
                lines.append(f"• {name}  [{item_type}]")
            self.selected_summary.insert("1.0", "\n".join(lines))
            self.deselect_btn.grid()
            self._selection_count_label.configure(text=f"{count} mục đã chọn")

        self.selected_summary.configure(state="disabled")
        self._set_status(
            f"Đã chọn {count} mục." if count > 0 else "Chưa chọn mục nào."
        )

    def _sync_selected_folder_targets(self) -> None:
        # Check if a folder was explicitly selected from the list
        explicit_folder: dict | None = None
        for item in self._selected_items:
            if item.get("mime_type") == GoogleDriveService.FOLDER_MIME_TYPE:
                explicit_folder = self._service.describe_item(item)
                break
        if explicit_folder is None and self._selected_target_folder:
            explicit_folder = self._service.describe_item(self._selected_target_folder)

        if explicit_folder:
            folder_path = (
                explicit_folder.get("display_path")
                or explicit_folder.get("name")
                or "My Drive"
            )
            self.upload_target_label.configure(text=f"Đích upload: {folder_path}")
            self.create_parent_label.configure(text=f"Folder cha: {folder_path}")
            self.move_target_label.configure(text=f"Folder đích: {folder_path}")
        elif self._current_folder:
            # Fallback: use the folder currently being browsed
            folder_path = (
                self._current_folder.get("display_path")
                or self._current_folder.get("name")
                or "My Drive"
            )
            self.upload_target_label.configure(text=f"Đích upload: {folder_path}  (folder đang xem)")
            self.create_parent_label.configure(text=f"Folder cha: {folder_path}  (folder đang xem)")
            self.move_target_label.configure(text=f"Folder đích: {folder_path}  (folder đang xem)")
        else:
            self.upload_target_label.configure(text="Đích upload: My Drive")
            self.create_parent_label.configure(text="Folder cha: My Drive")
            self.move_target_label.configure(
                text="Folder đích chưa chọn. Hãy chọn một folder trong danh sách bên trái."
            )

    def _get_selected_folder_context(self) -> dict | None:
        # Priority 1: first folder explicitly selected from the list
        for item in self._selected_items:
            if item.get("mime_type") == GoogleDriveService.FOLDER_MIME_TYPE:
                return self._service.describe_item(item)
        # Priority 2: explicitly set target folder
        if self._selected_target_folder:
            return self._service.describe_item(self._selected_target_folder)
        # Priority 3: the folder currently being browsed
        if self._current_folder:
            return self._service.describe_item(self._current_folder)
        return None

    # ──────────────────────────── UPLOAD ────────────────────────────

    def _pick_upload_files(self) -> None:
        initial_dir = executor.SAFE_DIRS[0] if executor.SAFE_DIRS else None
        file_paths = filedialog.askopenfilenames(
            parent=self,
            title="Chọn file để upload lên Google Drive",
            initialdir=initial_dir,
        )
        self.lift()
        self.focus_force()
        if not file_paths:
            return
        normalized_paths = [str(path) for path in file_paths]
        unsafe_paths = [
            path for path in normalized_paths if not executor.is_safe_path(path)
        ]
        if unsafe_paths:
            preview = "\n".join(f"- {path}" for path in unsafe_paths[:5])
            suffix = "\n..." if len(unsafe_paths) > 5 else ""
            self._set_status(
                "Chỉ cho phép upload file trong thư mục an toàn.\n" + preview + suffix,
                error=True,
            )
            return
        self._selected_upload_files = normalized_paths
        preview = "\n".join(f"- {path}" for path in normalized_paths[:4])
        if len(normalized_paths) > 4:
            preview += f"\n... và thêm {len(normalized_paths) - 4} file."
        self.upload_files_label.configure(text=preview)
        self._set_status(f"Đã chọn {len(normalized_paths)} file local để upload.")

    def _upload_selected_files(self) -> None:
        if not self._selected_upload_files:
            self._set_status("Chọn file local trước khi upload.", error=True)
            return
        resolved_folder = self._get_selected_folder_context()
        selected_files = list(self._selected_upload_files)

        def task():
            uploaded_names: list[str] = []
            failed: list[str] = []
            for path in selected_files:
                try:
                    uploaded = self._service.upload_file(
                        local_path=path,
                        folder_id=(resolved_folder or {}).get("id") or None,
                    )
                    uploaded_names.append(
                        uploaded.get("name") or uploaded.get("id") or path
                    )
                except Exception as exc:
                    failed.append(f"{path}: {exc}")
            return {"uploaded_names": uploaded_names, "failed": failed}

        def on_success(payload: dict) -> None:
            uploaded_names = list(payload.get("uploaded_names") or [])
            failed = list(payload.get("failed") or [])
            if uploaded_names:
                destination = (
                    f" vào folder '{resolved_folder.get('name')}'"
                    if resolved_folder
                    else " vào My Drive"
                )
                summary = f"Đã upload {len(uploaded_names)} file{destination}."
                if failed:
                    summary += f"\nCó {len(failed)} file lỗi."
                self._notify(summary, "success")
                self.upload_files_label.configure(text="Chưa chọn file local nào.")
                self._selected_upload_files = []
            if failed:
                self._notify("\n".join(failed[:3]), "error")
            self.after(0, self._reload_browser_data)

        self._run_async(
            task, on_success, busy_message="Đang upload file lên Google Drive"
        )

    # ──────────────────────────── CREATE FOLDER ────────────────────────────

    def _create_folder(self) -> None:
        folder_name = self.create_name_entry.get().strip()
        if not folder_name:
            self._set_status("Nhập tên folder cần tạo.", error=True)
            return
        parent = self._get_selected_folder_context()

        def task():
            created = self._service.create_folder(
                folder_name, parent_id=(parent or {}).get("id")
            )
            return self._service.describe_item(created)

        def on_success(created: dict) -> None:
            # Add the new folder to selection
            self._selected_items.append(created)
            self._selected_target_folder = created
            self._update_selection_summary()
            self._sync_selected_folder_targets()
            self.after(0, self._reload_browser_data)
            self._notify(
                f"Đã tạo folder '{created.get('name')}' trên Google Drive.", "success"
            )

        self._run_async(
            task, on_success, busy_message="Đang tạo folder trên Google Drive"
        )

    # ──────────────────────────── RENAME ────────────────────────────

    def _rename_selected(self) -> None:
        if not self._selected_items:
            self._set_status("Chọn đúng 1 file hoặc folder để đổi tên.", error=True)
            return
        if len(self._selected_items) > 1:
            self._set_status(
                f"Đang chọn {len(self._selected_items)} mục. Chỉ có thể đổi tên 1 mục — hãy bỏ bớt để chỉ còn 1.",
                error=True,
            )
            return
        item = self._selected_items[0]
        new_name = self.rename_entry.get().strip()
        if not new_name:
            self._set_status("Nhập tên mới trước khi đổi tên.", error=True)
            return

        def task():
            updated = self._service.rename_item(item["id"], new_name)
            return self._service.describe_item(updated)

        def on_success(updated: dict) -> None:
            # Update the item in _selected_items
            for idx, sel in enumerate(self._selected_items):
                if sel.get("id") == item.get("id"):
                    self._selected_items[idx] = updated
                    break
            self._update_selection_summary()
            self.after(0, self._reload_browser_data)
            self._notify(f"Đã đổi tên thành '{updated.get('name')}'.", "success")

        self._run_async(
            task, on_success, busy_message="Đang đổi tên mục trên Google Drive"
        )

    # ──────────────────────────── DOWNLOAD ────────────────────────────

    def _download_selected(self) -> None:
        downloadable = [
            item for item in self._selected_items
            if item.get("mime_type") != GoogleDriveService.FOLDER_MIME_TYPE
        ]
        if not downloadable:
            self._set_status(
                "Chọn ít nhất 1 file để tải về. Folder không được hỗ trợ tải.", error=True
            )
            return

        if len(downloadable) == 1:
            # Single file: ask for save path
            item = downloadable[0]
            initial_name = item.get("name") or "downloaded_file"
            save_path = filedialog.asksaveasfilename(
                parent=self,
                title="Lưu file từ Google Drive",
                initialfile=initial_name,
            )
            self.lift()
            self.focus_force()
            if not save_path:
                return

            def task():
                return self._service.download_file(item["id"], save_to=save_path)

            def on_success(_) -> None:
                self._notify(
                    f"Đã tải thành công file '{item.get('name')}' về máy.", "success"
                )

            self._run_async(task, on_success, busy_message="Đang tải file từ Google Drive về máy")

        else:
            # Multiple files: ask for directory
            save_dir = filedialog.askdirectory(
                parent=self,
                title="Chọn thư mục để lưu các file từ Google Drive",
            )
            self.lift()
            self.focus_force()
            if not save_dir:
                return

            items_snapshot = list(downloadable)

            def task():
                downloaded_names: list[str] = []
                failed: list[str] = []
                for itm in items_snapshot:
                    import os
                    save_path = os.path.join(save_dir, itm.get("name") or itm.get("id") or "file")
                    try:
                        self._service.download_file(itm["id"], save_to=save_path)
                        downloaded_names.append(itm.get("name") or itm.get("id") or save_path)
                    except Exception as exc:
                        failed.append(f"{itm.get('name')}: {exc}")
                return {"downloaded_names": downloaded_names, "failed": failed}

            def on_success(payload: dict) -> None:
                downloaded_names = list(payload.get("downloaded_names") or [])
                failed = list(payload.get("failed") or [])
                if downloaded_names:
                    self._notify(
                        f"Đã tải {len(downloaded_names)} file về thư mục '{save_dir}'.",
                        "success",
                    )
                if failed:
                    self._notify("\n".join(failed[:3]), "error")

            self._run_async(
                task, on_success, busy_message="Đang tải các file từ Google Drive về máy"
            )

    # ──────────────────────────── SHARE LINK ────────────────────────────

    def _get_share_link(self, make_public: bool = False) -> None:
        if not self._selected_items:
            self._set_status(
                "Chọn file hoặc folder trước khi lấy link chia sẻ.", error=True
            )
            return

        items_snapshot = list(self._selected_items)

        def task():
            results = []
            for item in items_snapshot:
                file_id = str(item.get("id") or "").strip()
                if not file_id:
                    continue
                try:
                    detail = self._service.get_share_link(
                        file_id=file_id, make_public=make_public
                    )
                    link = str(
                        detail.get("web_view_link") or detail.get("web_content_link") or ""
                    ).strip()
                    results.append({"name": item.get("name") or file_id, "link": link or "(không lấy được link)"})
                except Exception as exc:
                    results.append({"name": item.get("name") or file_id, "link": f"[Lỗi: {exc}]"})
            return results

        def on_success(results: list) -> None:
            if not results:
                self._set_status("Không lấy được link chia sẻ từ Google Drive.", error=True)
                return
            if len(results) == 1:
                combined = results[0]["link"]
            else:
                combined = "\n\n".join(
                    f"{r['name']}:\n{r['link']}" for r in results
                )
            self.share_link_text.configure(state="normal")
            self.share_link_text.delete("1.0", "end")
            self.share_link_text.insert("1.0", combined)
            self.share_link_text.configure(state="disabled")
            action = "công khai" if make_public else "chia sẻ"
            self._emit_message(f"Đã lấy link {action} cho {len(results)} mục.", "success")

        message = (
            "Đang lấy link công khai Google Drive"
            if make_public
            else "Đang lấy link chia sẻ Google Drive"
        )
        self._run_async(task, on_success, busy_message=message)

    def _copy_share_link(self) -> None:
        link = self.share_link_text.get("1.0", "end").strip()
        if not link or link == "Chưa có link chia sẻ.":
            self._set_status(
                "Chưa có link để sao chép. Hãy lấy link trước.", error=True
            )
            return
        try:
            self.clipboard_clear()
            self.clipboard_append(link)
            self.update_idletasks()
            self._emit_message("Đã sao chép link chia sẻ vào clipboard.", "success")
        except Exception as exc:
            self._set_status(f"Không thể sao chép link: {exc}", error=True)

    # ──────────────────────────── MOVE ────────────────────────────

    def _move_selected(self) -> None:
        files_to_move = [
            item for item in self._selected_items
            if item.get("mime_type") != GoogleDriveService.FOLDER_MIME_TYPE
        ]
        if not files_to_move:
            self._set_status(
                "Chọn ít nhất 1 file để di chuyển. Hiện chưa hỗ trợ di chuyển folder.",
                error=True,
            )
            return

        target = self._get_selected_folder_context()
        if not target:
            self._set_status(
                "Hãy chọn một folder làm đích trước khi di chuyển.", error=True
            )
            return

        target_id = str(target.get("id") or "")
        if not target_id:
            self._set_status("Folder đích không có ID hợp lệ.", error=True)
            return

        # Exclude the target folder itself if somehow selected as a file
        items_snapshot = [i for i in files_to_move if i.get("id") != target_id]
        if not items_snapshot:
            self._set_status("Không có file nào hợp lệ để di chuyển.", error=True)
            return

        def task():
            moved_names: list[str] = []
            failed: list[str] = []
            for item in items_snapshot:
                try:
                    updated = self._service.move_item(item["id"], target_id)
                    moved_names.append(updated.get("name") or item.get("name") or item["id"])
                except Exception as exc:
                    failed.append(f"{item.get('name')}: {exc}")
            return {"moved_names": moved_names, "failed": failed}

        def on_success(payload: dict) -> None:
            moved_names = list(payload.get("moved_names") or [])
            failed = list(payload.get("failed") or [])
            if moved_names:
                self._notify(
                    f"Đã di chuyển {len(moved_names)} file vào folder '{target.get('name')}'.",
                    "success",
                )
            if failed:
                self._notify("\n".join(failed[:3]), "error")
            self.after(0, self._reload_browser_data)

        self._run_async(
            task, on_success, busy_message="Đang di chuyển file trên Google Drive"
        )

    # ──────────────────────────── TRASH ────────────────────────────

    def _trash_single_item(self, item: dict) -> None:
        """Xóa nhanh 1 mục vào thùng rác trực tiếp từ card, không cần chọn trước."""
        item_name = item.get("name") or item.get("id") or "mục này"
        item_type = "folder" if item.get("mime_type") == GoogleDriveService.FOLDER_MIME_TYPE else "file"

        confirmed = messagebox.askyesno(
            "Xác nhận đưa vào thùng rác",
            f"Bạn có chắc muốn đưa {item_type} '{item_name}' vào thùng rác Google Drive không?",
            parent=self,
        )
        self.lift()
        self.focus_force()
        if not confirmed:
            return

        def task():
            return self._service.trash_item(item["id"])

        def on_success(updated: dict) -> None:
            trashed_name = updated.get("name") or item_name
            self._emit_message(f"Đã đưa {item_type} '{trashed_name}' vào thùng rác.", "success")
            # Remove from selection if it was selected
            self._selected_items = [i for i in self._selected_items if i.get("id") != item.get("id")]
            self._update_selection_summary()
            self._sync_selected_folder_targets()
            self.after(0, self._reload_browser_data)

        self._run_async(
            task, on_success, busy_message=f"Đang đưa '{item_name}' vào thùng rác"
        )

    def _trash_selected(self) -> None:
        if not self._selected_items:
            self._set_status(
                "Chọn file hoặc folder trước khi đưa vào thùng rác.", error=True
            )
            return

        items_snapshot = list(self._selected_items)

        def task():
            trashed_names: list[str] = []
            failed: list[str] = []
            for item in items_snapshot:
                try:
                    updated = self._service.trash_item(item["id"])
                    trashed_names.append(
                        updated.get("name") or item.get("name") or item["id"]
                    )
                except Exception as exc:
                    failed.append(f"{item.get('name')}: {exc}")
            return {"trashed_names": trashed_names, "failed": failed}

        def on_success(payload: dict) -> None:
            trashed_names = list(payload.get("trashed_names") or [])
            failed = list(payload.get("failed") or [])
            if trashed_names:
                self._notify(
                    f"Đã chuyển {len(trashed_names)} mục vào thùng rác Google Drive.",
                    "success",
                )
            if failed:
                self._notify("\n".join(failed[:3]), "error")
            # Clear selection after trash
            self._selected_items = []
            self._selected_target_folder = None
            self._selected_upload_folder = None
            self._update_selection_summary()
            self._sync_selected_folder_targets()
            self.after(0, self._reload_browser_data)

        self._run_async(
            task, on_success, busy_message="Đang chuyển mục vào thùng rác Google Drive"
        )

    # ──────────────────────────── FOLDER PICKER (INTERNAL) ────────────────────────────

    def _resolve_folder_with_picker(
        self, folder_ref: str, *, allow_create: bool
    ) -> dict | None:
        cleaned = (folder_ref or "").strip()
        if not cleaned:
            return None
        if "/" in cleaned or "\\" in cleaned:
            folder = self._service.resolve_folder(
                cleaned, create_if_missing=allow_create
            )
            return self._service.describe_item(folder)
        matches = self._service.search_folders(cleaned, exact_name=True, max_results=20)
        if not matches:
            if allow_create:
                return self._service.describe_item(self._service.create_folder(cleaned))
            raise FileNotFoundError(f"Không tìm thấy folder Google Drive '{cleaned}'.")
        if len(matches) == 1:
            return self._service.describe_item(matches[0])
        enriched = [self._service.describe_item(item) for item in matches]
        return pick_drive_item(
            self,
            title=f"Chọn folder '{cleaned}'",
            items=enriched,
            palette=self._palette,
        )

    # ──────────────────────────── STATUS / NOTIFY ────────────────────────────

    def _set_status(self, message: str, *, error: bool = False) -> None:
        self.search_status.configure(
            text=message,
            text_color=(
                self._palette["FG_ERROR"] if error else self._palette["FG_SECONDARY"]
            ),
        )

    def _emit_message(self, message: str, style: str = "normal") -> None:
        self._set_status(message, error=style == "error")
        if self._on_message:
            self._on_message(message, style)

    def _notify(self, message: str, style: str = "normal") -> None:
        self._emit_message(message, style)
        try:
            if style == "error":
                messagebox.showerror("Google Drive Manager", message, parent=self)
            else:
                messagebox.showinfo("Google Drive Manager", message, parent=self)
        except Exception:
            pass

    # ──────────────────────────── WINDOW STATE ────────────────────────────

    def _setup_window(self) -> None:
        """Phóng to vùng làm việc (không che taskbar) khi mở."""
        self.update_idletasks()
        wx, wy, ww, wh = _get_work_area()
        self.geometry(f"{ww}x{wh}+{wx}+{wy}")
        self.lift()
        self.focus_force()
