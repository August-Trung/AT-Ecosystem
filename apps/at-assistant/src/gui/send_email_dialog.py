from __future__ import annotations

import customtkinter as ctk
import tkinter.filedialog as filedialog
import threading
from pathlib import Path
from typing import Callable

from src.core import executor
from src.core.result import ActionStatus
from src.plugins.google_auth_service import GoogleAuthService

from src.gui.theme import (
    FONT_FAMILY,
    FONT_SIZE_NORMAL,
    FONT_SIZE_SMALL,
    FONT_SIZE_TITLE,
)


class SendEmailDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        on_submit: Callable[[str, str, str, list[str]], None],
        on_auth_changed: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._on_submit = on_submit
        self._on_auth_changed = on_auth_changed
        self._is_logging_in = False
        self._attachment_paths: list[str] = []

        self.title("Gửi email")
        self.geometry("760x650")
        self.minsize(680, 580)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)
        shell.grid_rowconfigure(10, weight=1)

        ctk.CTkLabel(
            shell,
            text="Gửi email trực tiếp",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", pady=(0, 6))

        ctk.CTkLabel(
            shell,
            text="Nhập người nhận, tiêu đề và nội dung. App sẽ vẫn hỏi xác nhận trước khi gửi thật.",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=640,
        ).grid(row=1, column=0, sticky="ew", pady=(0, 14))

        self.gmail_status_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=640,
        )
        self.gmail_status_label.grid(row=2, column=0, sticky="ew", pady=(0, 12))

        self.to_entry = self._build_labeled_entry(shell, "Người nhận", row=3)
        self.to_entry.configure(
            placeholder_text="abc@gmail.com hoặc tên entity như anh Nam"
        )

        self.subject_entry = self._build_labeled_entry(shell, "Tiêu đề", row=5)
        self.subject_entry.configure(placeholder_text="Ví dụ: Báo cáo tuần")

        attachment_label = ctk.CTkLabel(
            shell,
            text="Tệp đính kèm",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        )
        attachment_label.grid(row=7, column=0, sticky="ew", pady=(0, 6))

        attachment_row = ctk.CTkFrame(shell, fg_color="transparent")
        attachment_row.grid(row=8, column=0, sticky="ew", pady=(0, 8))
        attachment_row.grid_columnconfigure(0, weight=1)
        attachment_row.grid_columnconfigure(1, weight=0)
        attachment_row.grid_columnconfigure(2, weight=0)

        self.attachment_summary_label = ctk.CTkLabel(
            attachment_row,
            text="Chưa chọn tệp đính kèm nào.",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=500,
        )
        self.attachment_summary_label.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self.pick_attachments_btn = ctk.CTkButton(
            attachment_row,
            text="Thêm tệp",
            height=36,
            corner_radius=11,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            command=self._pick_attachments,
        )
        self.pick_attachments_btn.grid(row=0, column=1, sticky="e", padx=(0, 6))

        self.clear_attachments_btn = ctk.CTkButton(
            attachment_row,
            text="Xóa",
            height=36,
            corner_radius=11,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            command=self._clear_attachments,
        )
        self.clear_attachments_btn.grid(row=0, column=2, sticky="e")

        body_label = ctk.CTkLabel(
            shell,
            text="Nội dung",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        )
        body_label.grid(row=9, column=0, sticky="ew", pady=(0, 6))

        self.body_text = ctk.CTkTextbox(
            shell,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_PRIMARY"],
            fg_color=palette["BG_INPUT"],
            border_width=0,
            corner_radius=12,
            activate_scrollbars=True,
        )
        self.body_text.grid(row=10, column=0, sticky="nsew")

        self.error_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_ERROR"],
            anchor="w",
        )
        self.error_label.grid(row=11, column=0, sticky="ew", pady=(10, 0))

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=12, column=0, sticky="ew", pady=(14, 0))
        actions.grid_columnconfigure(0, weight=1)
        actions.grid_columnconfigure(1, weight=0)
        actions.grid_columnconfigure(2, weight=0)

        self.send_btn = ctk.CTkButton(
            actions,
            text="Gửi",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._submit,
        )
        self.send_btn.grid(row=0, column=0, sticky="ew", padx=(0, 6))

        self.login_btn = ctk.CTkButton(
            actions,
            text="Đăng nhập Gmail",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._login_gmail,
        )
        self.login_btn.grid(row=0, column=1, sticky="e", padx=(0, 6))

        self.close_btn = ctk.CTkButton(
            actions,
            text="Đóng",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self.destroy,
        )
        self.close_btn.grid(row=0, column=2, sticky="e")

        self.to_entry.focus_set()
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self._refresh_gmail_state()

    def _build_labeled_entry(self, master, label: str, *, row: int) -> ctk.CTkEntry:
        ctk.CTkLabel(
            master,
            text=label,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=row, column=0, sticky="ew", pady=(0, 6))

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
        entry.grid(row=row + 1, column=0, sticky="ew", pady=(0, 12))
        return entry

    def _submit(self) -> None:
        if not self._has_authenticated_gmail():
            self.error_label.configure(
                text="Bạn cần đăng nhập Gmail trước khi gửi email."
            )
            return
        to = self.to_entry.get().strip()
        subject = self.subject_entry.get().strip()
        body = self.body_text.get("1.0", "end").strip()

        if not to:
            self.error_label.configure(text="Thiếu người nhận.")
            self.to_entry.focus_set()
            return
        if not subject:
            self.error_label.configure(text="Thiếu tiêu đề.")
            self.subject_entry.focus_set()
            return
        if not body:
            self.error_label.configure(text="Thiếu nội dung email.")
            self.body_text.focus_set()
            return

        self.error_label.configure(text="")
        self._on_submit(to, subject, body, list(self._attachment_paths))
        self.destroy()

    def _pick_attachments(self) -> None:
        selected = filedialog.askopenfilenames(
            parent=self,
            title="Chọn tệp đính kèm",
        )
        if not selected:
            return

        merged: list[str] = []
        for path in [*self._attachment_paths, *list(selected)]:
            normalized = str(Path(path).expanduser())
            if normalized not in merged:
                merged.append(normalized)
        self._attachment_paths = merged
        self._update_attachment_summary()

    def _clear_attachments(self) -> None:
        self._attachment_paths = []
        self._update_attachment_summary()

    def _update_attachment_summary(self) -> None:
        count = len(self._attachment_paths)
        if not count:
            self.attachment_summary_label.configure(text="Chưa chọn tệp đính kèm nào.")
            return
        names = [Path(path).name for path in self._attachment_paths]
        preview = ", ".join(names[:3])
        if count > 3:
            preview += f" và {count - 3} tệp khác"
        self.attachment_summary_label.configure(text=f"Đã chọn {count} tệp: {preview}")

    def _has_authenticated_gmail(self) -> bool:
        try:
            auth_service = GoogleAuthService("gmail")
            return bool(auth_service.get_active_account())
        except Exception:
            return False

    def _refresh_gmail_state(self) -> None:
        active_email = ""
        account_count = 0
        try:
            auth_service = GoogleAuthService("gmail")
            active_email = str(auth_service.get_active_account() or "").strip().lower()
            account_count = len(auth_service.list_accounts())
        except Exception:
            active_email = ""
            account_count = 0

        if active_email:
            suffix = f" | {account_count} tài khoản" if account_count > 1 else ""
            self.gmail_status_label.configure(
                text=f"Gmail đã đăng nhập: {active_email}{suffix}"
            )
            self.send_btn.configure(state="normal")
            self.login_btn.grid()
            self.login_btn.configure(text="Äá»•i Gmail", state="normal")
            if not self._is_logging_in:
                self.error_label.configure(text="")
        else:
            self.gmail_status_label.configure(
                text="Bạn chưa đăng nhập Gmail. Hãy đăng nhập trước khi gửi email."
            )
            self.send_btn.configure(state="disabled")
            self.login_btn.grid()
            self.login_btn.configure(text="Đăng nhập Gmail", state="normal")

        if self._on_auth_changed:
            self._on_auth_changed()

    def _login_gmail(self, prompt_select: bool = True) -> None:
        if self._is_logging_in:
            return
        self._is_logging_in = True
        self.login_btn.configure(state="disabled", text="Đang đăng nhập...")
        self.error_label.configure(text="")
        threading.Thread(
            target=lambda: self._run_login_worker(prompt_select=prompt_select),
            daemon=True,
        ).start()

    def _run_login_worker(self, prompt_select: bool = True) -> None:
        result = executor._handle_email_login(prompt_select=prompt_select)
        self.after(0, lambda: self._finish_login(result))

    def _finish_login(self, result) -> None:
        self._is_logging_in = False
        if not self.winfo_exists():
            return
        if result.status == ActionStatus.SUCCESS:
            self.error_label.configure(text="")
        else:
            message = (
                result.dev_message or result.message or "Không thể đăng nhập Gmail."
            )
            self.error_label.configure(text=message)
        self.login_btn.configure(state="normal")
        self._refresh_gmail_state()
