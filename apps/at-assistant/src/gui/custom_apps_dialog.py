from __future__ import annotations

import tkinter.filedialog as filedialog
from pathlib import Path

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.plugins.custom_app_service import CustomAppService


class CustomAppsDialog(ctk.CTkToplevel):
    def __init__(self, master, *, palette: dict[str, str], on_message=None) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_message = on_message
        self._service = CustomAppService()
        self._selected_app_id = ""

        self.title("Ứng dụng đã lưu")
        self.geometry("980x620")
        self.minsize(860, 560)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        self.grid_columnconfigure(0, weight=0, minsize=300)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_list_panel()
        self._build_editor_panel()
        self._refresh_list()
        self._reset_form()

    def _build_list_panel(self) -> None:
        panel = ctk.CTkFrame(self, fg_color=self._palette["BG_SECONDARY"], corner_radius=14)
        panel.grid(row=0, column=0, sticky="nsew", padx=(18, 8), pady=18)
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            panel,
            text="Ứng dụng đã lưu",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 10))

        self.app_list = ctk.CTkScrollableFrame(
            panel,
            fg_color=self._palette["BG_PRIMARY"],
            corner_radius=12,
        )
        self.app_list.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 12))
        self.app_list.grid_columnconfigure(0, weight=1)

        actions = ctk.CTkFrame(panel, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 16))
        actions.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(
            actions,
            text="Ứng dụng mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            command=self._reset_form,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Làm mới",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._refresh_list,
        ).grid(row=0, column=1, sticky="ew", padx=(4, 0))

    def _build_editor_panel(self) -> None:
        panel = ctk.CTkFrame(self, fg_color=self._palette["BG_SECONDARY"], corner_radius=14)
        panel.grid(row=0, column=1, sticky="nsew", padx=(8, 18), pady=18)
        panel.grid_columnconfigure(0, weight=1)
        panel.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            panel,
            text="Thiết lập ứng dụng",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=2, sticky="ew", padx=16, pady=(16, 10))

        ctk.CTkLabel(
            panel,
            text="Tên gọi",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=1, column=0, sticky="ew", padx=(16, 8), pady=(0, 6))
        ctk.CTkLabel(
            panel,
            text="Tên hiển thị",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=1, column=1, sticky="ew", padx=(8, 16), pady=(0, 6))

        self.alias_entry = ctk.CTkEntry(panel, font=(FONT_FAMILY, FONT_SIZE_NORMAL), height=40)
        self.alias_entry.grid(row=2, column=0, sticky="ew", padx=(16, 8), pady=(0, 12))

        self.display_name_entry = ctk.CTkEntry(panel, font=(FONT_FAMILY, FONT_SIZE_NORMAL), height=40)
        self.display_name_entry.grid(row=2, column=1, sticky="ew", padx=(8, 16), pady=(0, 12))

        ctk.CTkLabel(
            panel,
            text="Đường dẫn",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=3, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 6))

        path_row = ctk.CTkFrame(panel, fg_color="transparent")
        path_row.grid(row=4, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 12))
        path_row.grid_columnconfigure(0, weight=1)

        self.path_entry = ctk.CTkEntry(path_row, font=(FONT_FAMILY, FONT_SIZE_NORMAL), height=40)
        self.path_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        ctk.CTkButton(
            path_row,
            text="Chọn file",
            width=120,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._browse_target,
        ).grid(row=0, column=1, sticky="e")

        ctk.CTkLabel(
            panel,
            text="Alias phụ, ngăn cách bằng dấu phẩy",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=5, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 6))

        self.aliases_entry = ctk.CTkEntry(
            panel,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            height=40,
            placeholder_text="Ví dụ: pts, photoshop, adobe photoshop",
        )
        self.aliases_entry.grid(row=6, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 10))

        self.status_label = ctk.CTkLabel(
            panel,
            text="Chỉ hỗ trợ file .exe và .lnk.",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=600,
        )
        self.status_label.grid(row=7, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))

        actions = ctk.CTkFrame(panel, fg_color="transparent")
        actions.grid(row=8, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))
        for index in range(5):
            actions.grid_columnconfigure(index, weight=1)

        ctk.CTkButton(
            actions,
            text="Lưu app",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            command=self._save_app,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))

        ctk.CTkButton(
            actions,
            text="Chạy thử",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color="#22c55e",
            hover_color="#16a34a",
            text_color="#08130c",
            command=self._test_open,
        ).grid(row=0, column=1, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Xóa",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            command=self._delete_app,
        ).grid(row=0, column=2, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Reset",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._reset_form,
        ).grid(row=0, column=3, sticky="ew", padx=4)

        ctk.CTkButton(
            actions,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self.destroy,
        ).grid(row=0, column=4, sticky="ew", padx=(4, 0))

    def _refresh_list(self) -> None:
        for child in self.app_list.winfo_children():
            child.destroy()

        apps = self._service.list_apps()
        if not apps:
            ctk.CTkLabel(
                self.app_list,
                text="Chưa có ứng dụng đã lưu.",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
            ).grid(row=0, column=0, sticky="ew", padx=8, pady=8)
            return

        for index, item in enumerate(apps):
            summary = str(item.get("display_name") or item.get("alias") or "")
            alias = str(item.get("alias") or "")
            target = str(item.get("target_path") or "")
            button = ctk.CTkButton(
                self.app_list,
                text=f"{alias}\n{summary}\n{target}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                anchor="w",
                height=72,
                fg_color=self._palette["ACCENT"] if item.get("id") == self._selected_app_id else self._palette["BG_SECONDARY"],
                hover_color=self._palette["ACCENT_HOVER"] if item.get("id") == self._selected_app_id else self._palette["ACCENT_CHOICE_HOVER"],
                text_color="#ffffff" if item.get("id") == self._selected_app_id else self._palette["FG_PRIMARY"],
                command=lambda app_id=str(item.get("id") or ""): self._load_app(app_id),
            )
            button.grid(row=index, column=0, sticky="ew", padx=6, pady=(0, 8))

    def _load_app(self, app_id: str) -> None:
        item = self._service.get_app(app_id)
        if not item:
            return
        self._selected_app_id = str(item.get("id") or "")
        self.alias_entry.delete(0, "end")
        self.alias_entry.insert(0, str(item.get("alias") or ""))
        self.display_name_entry.delete(0, "end")
        self.display_name_entry.insert(0, str(item.get("display_name") or ""))
        self.path_entry.delete(0, "end")
        self.path_entry.insert(0, str(item.get("target_path") or ""))
        aliases = [alias for alias in list(item.get("aliases") or []) if alias != item.get("alias")]
        self.aliases_entry.delete(0, "end")
        if aliases:
            self.aliases_entry.insert(0, ", ".join(aliases))
        self.status_label.configure(text=f"Đang chỉnh: {item.get('alias')}", text_color=self._palette["FG_SECONDARY"])
        self._refresh_list()

    def _reset_form(self) -> None:
        self._selected_app_id = ""
        for entry in (self.alias_entry, self.display_name_entry, self.path_entry, self.aliases_entry):
            entry.delete(0, "end")
        self.status_label.configure(text="Chỉ hỗ trợ file .exe và .lnk.", text_color=self._palette["FG_SECONDARY"])
        self._refresh_list()

    def _browse_target(self) -> None:
        initial_dir = None
        current_path = (self.path_entry.get() or "").strip()
        if current_path:
            try:
                parent = Path(current_path).expanduser().resolve().parent
                if parent.exists():
                    initial_dir = str(parent)
            except Exception:
                initial_dir = None
        file_path = filedialog.askopenfilename(
            title="Chọn ứng dụng để lưu",
            initialdir=initial_dir,
            filetypes=[
                ("Ứng dụng Windows", "*.exe"),
                ("Windows Shortcut", "*.lnk"),
                ("Tất cả file hợp lệ", "*.exe *.lnk"),
            ],
        )
        if not file_path:
            return
        self.path_entry.delete(0, "end")
        self.path_entry.insert(0, file_path)
        if not (self.display_name_entry.get() or "").strip():
            self.display_name_entry.insert(0, Path(file_path).stem)
        if not (self.alias_entry.get() or "").strip():
            self.alias_entry.insert(0, Path(file_path).stem)

    def _save_app(self) -> None:
        alias = (self.alias_entry.get() or "").strip()
        display_name = (self.display_name_entry.get() or "").strip()
        target_path = (self.path_entry.get() or "").strip()
        extra_aliases = [item.strip() for item in (self.aliases_entry.get() or "").split(",") if item.strip()]
        try:
            if self._selected_app_id:
                record = self._service.update_app(
                    self._selected_app_id,
                    alias=alias,
                    target_path=target_path,
                    display_name=display_name,
                    extra_aliases=extra_aliases,
                )
                message = f"Đã cập nhật app đã lưu: {record['alias']}"
            else:
                record = self._service.save_app(
                    alias=alias,
                    target_path=target_path,
                    display_name=display_name,
                    extra_aliases=extra_aliases,
                )
                message = f"Đã lưu app: {record['alias']}"
            self._selected_app_id = str(record.get("id") or "")
            self.status_label.configure(text=message, text_color="#22c55e")
            self._refresh_list()
            if self._on_message:
                self._on_message(message, "success")
        except Exception as exc:
            self.status_label.configure(text=str(exc), text_color=self._palette["FG_ERROR"])

    def _delete_app(self) -> None:
        if not self._selected_app_id:
            self.status_label.configure(text="Hãy chọn một app đã lưu để xóa.", text_color=self._palette["FG_ERROR"])
            return
        try:
            deleted = self._service.delete_app(self._selected_app_id)
            message = f"Đã xóa app đã lưu: {deleted.get('alias')}"
            self._reset_form()
            if self._on_message:
                self._on_message(message, "success")
        except Exception as exc:
            self.status_label.configure(text=str(exc), text_color=self._palette["FG_ERROR"])

    def _test_open(self) -> None:
        target_path = (self.path_entry.get() or "").strip()
        if not target_path:
            self.status_label.configure(text="Hãy chọn đường dẫn app trước.", text_color=self._palette["FG_ERROR"])
            return
        try:
            from src.core import executor

            result = executor.open_app_target(
                target_path=target_path,
                display_name=(self.display_name_entry.get() or "").strip() or Path(target_path).stem,
                app_key=(self.alias_entry.get() or "").strip() or Path(target_path).stem,
            )
            color = "#22c55e" if result.status.value == "success" else self._palette["FG_ERROR"]
            self.status_label.configure(text=result.message, text_color=color)
            if self._on_message:
                self._on_message(result.message, "success" if result.status.value == "success" else "error")
        except Exception as exc:
            self.status_label.configure(text=str(exc), text_color=self._palette["FG_ERROR"])
