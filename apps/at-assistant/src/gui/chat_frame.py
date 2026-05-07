# src/gui/chat_frame.py
"""Scrollable chat area with message bubbles."""

from __future__ import annotations

import customtkinter as ctk
import tkinter as tk
import tkinter.font as tkfont
from datetime import datetime, timezone, timedelta
from typing import Literal

from src.gui.theme import (
    BG_SECONDARY, BG_BUBBLE_USER, BG_BUBBLE_BOT, BG_BUBBLE_ERROR,
    FG_USER, FG_BOT, FG_ERROR, FG_SUCCESS, FG_SECONDARY,
    FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL,
    BUBBLE_PADX, BUBBLE_PADY, CHAT_PADX, CHAT_PADY,
    SCROLLBAR_COLOR, SCROLLBAR_HOVER,
    get_theme_palette,
)

MOUSEWHEEL_SCROLL_UNITS = 32


class ChatFrame(ctk.CTkScrollableFrame):
    """Scrollable frame that displays chat message bubbles."""

    def __init__(self, master, **kwargs):
        super().__init__(
            master,
            fg_color=BG_SECONDARY,
            scrollbar_button_color=SCROLLBAR_COLOR,
            scrollbar_button_hover_color=SCROLLBAR_HOVER,
            **kwargs,
        )
        self._msg_count = 0
        self._palette = get_theme_palette("dark")
        self._text_widgets: list[dict[str, object]] = []
        self._email_note_widgets: dict[str, tk.Text] = {}
        self._email_subject_widgets: dict[str, tk.Text] = {}
        self._transcript: list[dict[str, object]] = []
        self._bind_mousewheel_target(self)

    # ─── Public API ──────────────────────────────────

    def add_user_message(self, text: str) -> None:
        self._record_transcript(role="user", kind="text", text=text, style="normal")
        self._add_bubble(text, side="user")

    def add_bot_message(self, text: str, style: Literal["normal", "success", "error"] = "normal") -> None:
        self._record_transcript(role="assistant", kind="text", text=text, style=style)
        self._add_bubble(text, side="bot", style=style)

    def add_email_card(self, mail: dict) -> None:
        """Render a compact email card inside the chat."""
        self._record_transcript(role="assistant", kind="email_card", text=self._describe_email_card(mail), payload=mail)
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(
            anchor="w",
            padx=(CHAT_PADX, CHAT_PADX + 60),
            pady=(2, 2),
            fill="x",
        )

        # From
        sender = mail.get("from", "")
        self._create_selectable_text(
            frame,
            text=f"📧 {sender}",
            text_color="#40C4FF",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(BUBBLE_PADY, 0),
        )

        # AI notes
        notes = mail.get("ai_note", [])
        email_id = str(mail.get("id") or "").strip()
        tags_widget = self._create_selectable_text(
            frame,
            text="  ".join(f"[{n}]" for n in notes) if notes else "",
            text_color="#FACC15",
            font=(FONT_FAMILY, FONT_SIZE_SMALL - 1, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(2, 0),
            fill=False,
        )
        if not notes:
            tags_widget.pack_forget()
        if email_id:
            self._email_note_widgets[email_id] = tags_widget

        # Subject
        subject = mail.get("subject", "")
        has_attach = mail.get("has_attachment", False)
        subj_text = f"📎 {subject}" if has_attach else subject
        subject_widget = self._create_selectable_text(
            frame,
            text=subj_text,
            text_color="#FFAB40",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(2, 0),
        )
        if email_id:
            self._email_subject_widgets[email_id] = subject_widget

        # Snippet
        snippet = mail.get("snippet", "")
        if snippet:
            self._create_selectable_text(
                frame,
                text=snippet,
                text_color=self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                wraplength=380,
                padx=BUBBLE_PADX,
                pady=(2, BUBBLE_PADY),
            )

        self._scroll_to_bottom()

    def update_email_card_notes(self, email_id: str, notes: list[str]) -> None:
        key = str(email_id or "").strip()
        widget = self._email_note_widgets.get(key)
        subject_widget = self._email_subject_widgets.get(key)

        if not key or widget is None or not widget.winfo_exists():
            return

        text = "  ".join(f"[{item}]" for item in notes if item)

        if not text:
            if widget.winfo_manager():
                widget.pack_forget()
            return

        if not widget.winfo_manager():
            pack_kwargs = {
                "padx": BUBBLE_PADX,
                "pady": (2, 0),
                "anchor": "w",
                "fill": "none",
            }
            if subject_widget is not None and subject_widget.winfo_exists():
                widget.pack(before=subject_widget, **pack_kwargs)
            else:
                widget.pack(**pack_kwargs)

        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", text)
        widget.configure(state="disabled")
        
    def add_email_detail(self, detail: dict) -> None:
        """Render a detailed email view inside the chat."""
        self._record_transcript(role="assistant", kind="email_detail", text=self._describe_email_detail(detail), payload=detail)
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(
            anchor="w",
            padx=(CHAT_PADX, CHAT_PADX + 40),
            pady=(4, 4),
            fill="x",
        )

        rows = [
            ("Từ", detail.get("from") or "N/A"),
            ("Đến", detail.get("to") or "N/A"),
            ("Cc", detail.get("cc") or "—"),
            ("Tiêu đề", detail.get("subject") or "(không tiêu đề)"),
        ]
        for label, value in rows:
            self._create_selectable_text(
                frame,
                text=f"{label}: {value}",
                text_color=self._palette["FG_BOT"] if label == "Tiêu đề" else self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold" if label == "Tiêu đề" else "normal"),
                wraplength=420,
                padx=BUBBLE_PADX,
                pady=(BUBBLE_PADY if label == "Từ" else 2, 0),
            )

        body = detail.get("body") or detail.get("snippet") or "(không có nội dung)"
        self._create_selectable_text(
            frame,
            text=body,
            text_color=self._palette["FG_BOT"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            wraplength=440,
            padx=BUBBLE_PADX,
            pady=(8, BUBBLE_PADY),
        )

        self._scroll_to_bottom()

    def add_email_preview(self, payload: dict, mode: str = "send") -> None:
        """Render send/reply confirmation preview for email actions."""
        self._record_transcript(
            role="assistant",
            kind="email_preview",
            text=self._describe_email_preview(payload, mode=mode),
            payload={"mode": mode, **payload},
        )
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(
            anchor="w",
            padx=(CHAT_PADX, CHAT_PADX + 40),
            pady=(4, 4),
            fill="x",
        )

        if mode == "invite":
            title = "Gửi mail thư mời"
        elif mode == "send":
            title = "Xác nhận gửi email"
        else:
            title = "Xác nhận trả lời email"
        self._create_selectable_text(
            frame,
            text=title,
            text_color=self._palette["FG_SUCCESS"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=420,
            padx=BUBBLE_PADX,
            pady=(BUBBLE_PADY, 2),
        )

        preview_rows = [
            ("To", payload.get("to") or "N/A"),
            ("Cc", payload.get("cc") or "—"),
            ("Bcc", payload.get("bcc") or "—"),
            ("Subject", payload.get("subject") or "(không tiêu đề)"),
        ]
        for label, value in preview_rows:
            if label in {"Cc", "Bcc"} and value == "—":
                continue
            self._create_selectable_text(
                frame,
                text=f"{label}: {value}",
                text_color=self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                wraplength=420,
                padx=BUBBLE_PADX,
                pady=(2, 0),
            )

        body = payload.get("body") or ""
        if body:
            self._create_selectable_text(
                frame,
                text=body,
                text_color=self._palette["FG_BOT"],
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                wraplength=440,
                padx=BUBBLE_PADX,
                pady=(8, BUBBLE_PADY),
            )

        self._scroll_to_bottom()

    def add_system_message(self, text: str) -> None:
        """Small centered system message (e.g. "Voice mode kích hoạt")."""
        self._record_transcript(role="system", kind="text", text=text, style="normal")
        self._create_selectable_text(
            self,
            text=text,
            text_color=self._palette["FG_SECONDARY"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            wraplength=420,
            padx=CHAT_PADX,
            pady=(4, 4),
            fill=False,
        )
        self._scroll_to_bottom()

    def show_loading(self) -> None:
        """Hiển thị indicator đang xử lý."""
        self.hide_loading()
        self._loading_bubble = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        self._loading_bubble.pack(
            anchor="w",
            padx=(CHAT_PADX, CHAT_PADX + 60),
            pady=(CHAT_PADY, CHAT_PADY),
            fill="x",
        )
        loading_label = ctk.CTkLabel(
            self._loading_bubble,
            text="⏳ Đang xử lý...",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "italic"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        loading_label.pack(padx=BUBBLE_PADX, pady=(BUBBLE_PADY, BUBBLE_PADY), anchor="w")
        self._scroll_to_bottom()

    def hide_loading(self) -> None:
        """Ẩn indicator đang xử lý."""
        if hasattr(self, "_loading_bubble") and self._loading_bubble:
            self._loading_bubble.destroy()
            self._loading_bubble = None

    def clear(self) -> None:
        """Remove all rendered chat content and reset widget bookkeeping."""
        self.hide_loading()
        for child in self.winfo_children():
            child.destroy()
        self._msg_count = 0
        self._text_widgets.clear()
        self._email_note_widgets.clear()
        self._email_subject_widgets.clear()
        self._transcript = []
        self.update_idletasks()
        canvas = getattr(self, "_parent_canvas", None)
        if canvas is not None:
            try:
                # Prevent inheriting stale scroll region/offset from the previous session.
                canvas.configure(scrollregion=(0, 0, 0, 0))
                canvas.yview_moveto(0.0)
            except tk.TclError:
                pass

    def export_transcript(self) -> list[dict[str, object]]:
        return [dict(item) for item in self._transcript]

    def load_transcript(self, messages: list[dict[str, object]]) -> None:
        self.clear()
        for item in messages:
            self._render_saved_message(item)

    def apply_theme(self, palette: dict[str, str]) -> None:
        self._palette = palette
        self.configure(
            fg_color=palette["BG_SECONDARY"],
            scrollbar_button_color=palette["SCROLLBAR_COLOR"],
            scrollbar_button_hover_color=palette["SCROLLBAR_HOVER"],
        )
        if self._transcript:
            messages = self.export_transcript()
            self.load_transcript(messages)
            return
        alive_widgets: list[dict[str, object]] = []
        for meta in self._text_widgets:
            widget = meta["widget"]
            if not isinstance(widget, tk.Text) or not widget.winfo_exists():
                continue
            self._apply_text_theme(
                widget,
                bg=meta["bg"],
                fg=meta["fg"],
                font=meta["font"],
            )
            alive_widgets.append(meta)
        self._text_widgets = alive_widgets

    # ─── Internal ────────────────────────────────────

    def _add_bubble(
        self,
        text: str,
        side: Literal["user", "bot"],
        style: Literal["normal", "success", "error"] = "normal",
    ) -> None:
        is_user = side == "user"

        if is_user:
            bg = self._palette["BG_BUBBLE_USER"]
            fg = self._palette["FG_USER"]
        elif style == "error":
            bg = self._palette["BG_BUBBLE_ERROR"]
            fg = self._palette["FG_ERROR"]
        elif style == "success":
            bg = self._palette["BG_BUBBLE_BOT"]
            fg = self._palette["FG_SUCCESS"]
        else:
            bg = self._palette["BG_BUBBLE_BOT"]
            fg = self._palette["FG_BOT"]

        anchor = "e" if is_user else "w"
        padx_left = CHAT_PADX + 60 if is_user else CHAT_PADX
        padx_right = CHAT_PADX if is_user else CHAT_PADX + 60

        bubble = ctk.CTkFrame(self, fg_color=bg, corner_radius=10)
        bubble.pack(
            anchor=anchor,
            padx=(padx_left, padx_right),
            pady=(CHAT_PADY, CHAT_PADY),
            fill="x",
        )
        self._bind_mousewheel_target(bubble)

        # Role label
        role_text = "Bạn" if is_user else "🤖 Bot"
        role_label = ctk.CTkLabel(
            bubble,
            text=role_text,
            font=(FONT_FAMILY, FONT_SIZE_SMALL - 1, "bold"),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
        )
        role_label.pack(padx=BUBBLE_PADX, pady=(BUBBLE_PADY - 2, 0), anchor="w")
        self._bind_mousewheel_target(role_label)

        # Message text
        self._create_selectable_text(
            bubble,
            text=text,
            text_color=fg,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(2, BUBBLE_PADY),
            background=bg,
        )

        self._msg_count += 1
        self._scroll_to_bottom()

    def _create_selectable_text(
        self,
        master,
        text: str,
        text_color: str,
        font: tuple,
        wraplength: int,
        padx,
        pady,
        background: str | None = None,
        fill: bool = True,
    ) -> tk.Text:
        bg = self._resolve_color(background or master.cget("fg_color"))
        text_widget = tk.Text(
            master,
            wrap="word",
            relief="flat",
            borderwidth=0,
            highlightthickness=0,
            cursor="xterm",
            undo=False,
            exportselection=True,
            padx=0,
            pady=0,
        )
        text_widget.insert("1.0", text)
        self._configure_text_dimensions(text_widget, text, wraplength, font)
        self._apply_text_theme(text_widget, bg=bg, fg=text_color, font=font)
        text_widget.configure(state="disabled")
        text_widget.bind("<Button-3>", lambda _e, value=text: self._copy_to_clipboard(value))
        text_widget.pack(
            padx=padx,
            pady=pady,
            anchor="w",
            fill="x" if fill else "none",
        )
        self._text_widgets.append(
            {
                "widget": text_widget,
                "bg": bg,
                "fg": text_color,
                "font": font,
            }
        )
        self._bind_mousewheel_target(text_widget)
        return text_widget

    def _record_transcript(
        self,
        *,
        role: str,
        kind: str,
        text: str,
        style: str = "normal",
        payload: dict | None = None,
    ) -> None:
        self._transcript.append(
            {
                "role": role,
                "kind": kind,
                "text": text,
                "style": style,
                "payload": payload or {},
                "created_at": datetime.now(timezone(timedelta(hours=7))).isoformat(),
            }
        )

    def _render_saved_message(self, item: dict[str, object]) -> None:
        role = str(item.get("role") or "assistant")
        kind = str(item.get("kind") or "text")
        text = str(item.get("text") or "")
        style = str(item.get("style") or "normal")
        payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
        self._transcript.append(
            {
                "role": role,
                "kind": kind,
                "text": text,
                "style": style,
                "payload": payload,
                "created_at": str(item.get("created_at") or ""),
            }
        )
        if kind == "email_card":
            self._render_email_card(payload)
            return
        if kind == "email_detail":
            self._render_email_detail(payload)
            return
        if kind == "email_preview":
            self._render_email_preview(payload, mode=str(payload.get("mode") or "send"))
            return
        if role == "user":
            self._add_bubble(text, side="user")
            return
        if role == "system":
            self._create_selectable_text(
                self,
                text=text,
                text_color=self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                wraplength=420,
                padx=CHAT_PADX,
                pady=(4, 4),
                fill=False,
            )
            self._scroll_to_bottom()
            return
        self._add_bubble(text, side="bot", style=style if style in {"normal", "success", "error"} else "normal")

    def _render_email_card(self, mail: dict) -> None:
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(anchor="w", padx=(CHAT_PADX, CHAT_PADX + 60), pady=(2, 2), fill="x")
        sender = mail.get("from", "")
        self._create_selectable_text(
            frame,
            text=f"📧 {sender}",
            text_color="#40C4FF",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(BUBBLE_PADY, 0),
        )
        notes = mail.get("ai_note", [])
        email_id = str(mail.get("id") or "").strip()
        tags_widget = self._create_selectable_text(
            frame,
            text="Ghi chú: " + "  ".join(f"[{n}]" for n in notes) if notes else "",
            text_color="#FACC15",
            font=(FONT_FAMILY, FONT_SIZE_SMALL - 1, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(2, 0),
            fill=False,
        )
        
        if not notes:
            tags_widget.pack_forget()
        if email_id:
            self._email_note_widgets[email_id] = tags_widget
        subject = mail.get("subject", "")
        has_attach = mail.get("has_attachment", False)
        subj_text = f"📎 {subject}" if has_attach else subject
        self._create_selectable_text(
            frame,
            text=subj_text,
            text_color="#FFAB40",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=380,
            padx=BUBBLE_PADX,
            pady=(2, 0),
        )
        snippet = mail.get("snippet", "")
        if snippet:
            self._create_selectable_text(
                frame,
                text=snippet,
                text_color=self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                wraplength=380,
                padx=BUBBLE_PADX,
                pady=(2, BUBBLE_PADY),
            )
        self._scroll_to_bottom()

    def _render_email_detail(self, detail: dict) -> None:
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(anchor="w", padx=(CHAT_PADX, CHAT_PADX + 40), pady=(4, 4), fill="x")
        rows = [
            ("Từ", detail.get("from") or "N/A"),
            ("Đến", detail.get("to") or "N/A"),
            ("Cc", detail.get("cc") or "—"),
            ("Tiêu đề", detail.get("subject") or "(không tiêu đề)"),
        ]
        for label, value in rows:
            self._create_selectable_text(
                frame,
                text=f"{label}: {value}",
                text_color=self._palette["FG_BOT"] if label == "Tiêu đề" else self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold" if label == "Tiêu đề" else "normal"),
                wraplength=420,
                padx=BUBBLE_PADX,
                pady=(BUBBLE_PADY if label == "Từ" else 2, 0),
            )
        body = detail.get("body") or detail.get("snippet") or "(không có nội dung)"
        self._create_selectable_text(
            frame,
            text=body,
            text_color=self._palette["FG_BOT"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            wraplength=440,
            padx=BUBBLE_PADX,
            pady=(8, BUBBLE_PADY),
        )
        self._scroll_to_bottom()

    def _render_email_preview(self, payload: dict, mode: str = "send") -> None:
        frame = ctk.CTkFrame(self, fg_color=self._palette["BG_BUBBLE_BOT"], corner_radius=10)
        frame.pack(anchor="w", padx=(CHAT_PADX, CHAT_PADX + 40), pady=(4, 4), fill="x")
        title = "Gửi mail thư mời" if mode == "invite" else ("Xác nhận gửi email" if mode == "send" else "Xác nhận trả lời email")
        self._create_selectable_text(
            frame,
            text=title,
            text_color=self._palette["FG_SUCCESS"],
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            wraplength=420,
            padx=BUBBLE_PADX,
            pady=(BUBBLE_PADY, 2),
        )
        preview_rows = [
            ("To", payload.get("to") or "N/A"),
            ("Cc", payload.get("cc") or "—"),
            ("Bcc", payload.get("bcc") or "—"),
            ("Subject", payload.get("subject") or "(không tiêu đề)"),
        ]
        for label, value in preview_rows:
            if label in {"Cc", "Bcc"} and value == "—":
                continue
            self._create_selectable_text(
                frame,
                text=f"{label}: {value}",
                text_color=self._palette["FG_SECONDARY"],
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                wraplength=420,
                padx=BUBBLE_PADX,
                pady=(2, 0),
            )
        body = payload.get("body") or ""
        if body:
            self._create_selectable_text(
                frame,
                text=body,
                text_color=self._palette["FG_BOT"],
                font=(FONT_FAMILY, FONT_SIZE_NORMAL),
                wraplength=440,
                padx=BUBBLE_PADX,
                pady=(8, BUBBLE_PADY),
            )
        self._scroll_to_bottom()

    def _describe_email_card(self, mail: dict) -> str:
        return f"{mail.get('subject') or '(không tiêu đề)'} — từ {mail.get('from') or 'N/A'}"

    def _describe_email_detail(self, detail: dict) -> str:
        return f"Email chi tiết: {detail.get('subject') or '(không tiêu đề)'}"

    def _describe_email_preview(self, payload: dict, mode: str) -> str:
        prefix = "Gửi mail thư mời" if mode == "invite" else ("Xác nhận gửi email" if mode == "send" else "Xác nhận trả lời email")
        return f"{prefix}: {payload.get('subject') or '(không tiêu đề)'}"

    def _resolve_color(self, color) -> str:
        if isinstance(color, (tuple, list)):
            return str(color[0])
        return str(color)

    def _configure_text_dimensions(
        self,
        widget: tk.Text,
        text: str,
        wraplength: int,
        font: tuple,
    ) -> None:
        tk_font = tkfont.Font(font=font)
        widget.configure(font=tk_font)
        avg_char_width = max(tk_font.measure("n"), 1)
        width_chars = max(12, wraplength // avg_char_width)
        display_lines = 0
        for line in text.splitlines() or [""]:
            line = line or " "
            display_lines += max(1, (len(line) + width_chars - 1) // width_chars)
        widget.configure(width=width_chars, height=max(1, display_lines))

    def _apply_text_theme(
        self,
        widget: tk.Text,
        bg: str | None = None,
        fg: str | None = None,
        font: tuple | None = None,
    ) -> None:
        widget.configure(
            bg=bg or self._palette["BG_SECONDARY"],
            fg=fg or self._palette["FG_PRIMARY"],
            insertbackground=fg or self._palette["FG_PRIMARY"],
            selectbackground=self._palette["ACCENT"],
            selectforeground="#ffffff",
            font=tkfont.Font(font=font) if font else widget.cget("font"),
        )

    def _copy_to_clipboard(self, text: str) -> None:
        try:
            self.clipboard_clear()
            self.clipboard_append(text)
            self.update_idletasks()
        except tk.TclError:
            return

    def _scroll_to_bottom(self) -> None:
        self.update_idletasks()
        self._parent_canvas.yview_moveto(1.0)

    def _bind_mousewheel_target(self, widget) -> None:
        for sequence in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            widget.bind(sequence, self._on_mousewheel, add="+")

    def _on_mousewheel(self, event) -> str:
        if getattr(event, "num", None) == 4:
            delta = -1
        elif getattr(event, "num", None) == 5:
            delta = 1
        else:
            raw_delta = int(getattr(event, "delta", 0) or 0)
            if raw_delta == 0:
                return "break"
            delta = -int(raw_delta / 120) if raw_delta % 120 == 0 else (-1 if raw_delta > 0 else 1)
        self._parent_canvas.yview_scroll(delta * MOUSEWHEEL_SCROLL_UNITS, "units")
        return "break"
