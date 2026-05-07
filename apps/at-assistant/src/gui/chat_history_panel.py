from __future__ import annotations

import customtkinter as ctk
from typing import Callable

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, get_theme_palette

MOUSEWHEEL_SCROLL_UNITS = 32


class ChatHistoryPanel(ctk.CTkFrame):
    def __init__(
        self,
        master,
        *,
        on_new_chat: Callable[[], None],
        on_open_session: Callable[[str], None],
        on_toggle_sidebar: Callable[[], None],
        **kwargs,
    ):
        palette = get_theme_palette("dark")
        super().__init__(master, fg_color=palette["BG_SECONDARY"], corner_radius=0, **kwargs)
        self._palette = palette
        self._on_new_chat = on_new_chat
        self._on_open_session = on_open_session
        self._on_toggle_sidebar = on_toggle_sidebar
        self._selected_session_id = ""
        self._session_buttons: dict[str, ctk.CTkButton] = {}
        self._collapsed = False
        self._expanded_width = 220
        self._collapsed_width = 44

        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)
        self.configure(width=self._expanded_width)

        self.header_row = ctk.CTkFrame(self, fg_color="transparent")
        self.header_row.grid(row=0, column=0, padx=8, pady=(10, 8), sticky="ew")
        self.header_row.grid_columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(
            self.header_row,
            text="Lịch sử chat",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 6, "bold"),
            text_color=palette["FG_PRIMARY"],
        )
        self.title_label.grid(row=0, column=0, padx=(4, 6), pady=0, sticky="w")

        self.toggle_btn = ctk.CTkButton(
            self.header_row,
            text="◀",
            width=30,
            height=30,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            command=self._toggle_sidebar,
        )
        self.toggle_btn.grid(row=0, column=1, padx=(0, 2), pady=0, sticky="e")

        self.new_chat_btn = ctk.CTkButton(
            self,
            text="✐ Mới",
            height=36,
            width=36,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            anchor="center",
            command=self._on_new_chat,
        )
        self.new_chat_btn.grid(row=1, column=0, padx=12, pady=(0, 10), sticky="ew")

        self.list_frame = ctk.CTkScrollableFrame(
            self,
            fg_color=palette["BG_PRIMARY"],
            scrollbar_button_color=palette["SCROLLBAR_COLOR"],
            scrollbar_button_hover_color=palette["SCROLLBAR_HOVER"],
        )
        self.list_frame.grid(row=2, column=0, padx=8, pady=(0, 8), sticky="nsew")
        self.list_frame.grid_columnconfigure(0, weight=1)
        self._bind_mousewheel_target(self.list_frame)

    def set_sessions(self, sessions: list[dict], selected_session_id: str = "") -> None:
        self._selected_session_id = selected_session_id or ""
        self._session_buttons = {}
        for child in self.list_frame.winfo_children():
            child.destroy()

        if not sessions:
            label = ctk.CTkLabel(
                self.list_frame,
                text="Chưa có đoạn chat nào.",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1),
                text_color=self._palette["FG_SECONDARY"],
                justify="left",
                wraplength=180,
            )
            label.grid(row=0, column=0, padx=10, pady=10, sticky="w")
            self._bind_mousewheel_target(label)
            return

        for index, item in enumerate(sessions):
            session_id = str(item.get("session_id") or "")
            title = str(item.get("title") or "Cuộc trò chuyện mới")
            preview = str(item.get("preview") or "").strip()
            button_text = title if not preview else f"{title}\n{preview}"
            is_selected = session_id == self._selected_session_id
            button = ctk.CTkButton(
                self.list_frame,
                text=button_text,
                anchor="w",
                height=78,
                corner_radius=10,
                font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1),
                fg_color=self._palette["ACCENT_CHOICE"] if not is_selected else self._palette["ACCENT"],
                hover_color=self._palette["ACCENT_CHOICE_HOVER"] if not is_selected else self._palette["ACCENT_HOVER"],
                text_color=self._palette["FG_PRIMARY"] if not is_selected else "#ffffff",
                command=lambda sid=session_id: self._on_open_session(sid),
            )
            button.grid(row=index, column=0, padx=6, pady=4, sticky="ew")
            self._bind_mousewheel_target(button)
            self._session_buttons[session_id] = button

    def apply_theme(self, palette: dict[str, str]) -> None:
        self._palette = palette
        self.configure(fg_color=palette["BG_SECONDARY"])
        self.title_label.configure(text_color=palette["FG_PRIMARY"])
        self.toggle_btn.configure(
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
        )
        self.new_chat_btn.configure(
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
        )
        self.list_frame.configure(
            fg_color=palette["BG_PRIMARY"],
            scrollbar_button_color=palette["SCROLLBAR_COLOR"],
            scrollbar_button_hover_color=palette["SCROLLBAR_HOVER"],
        )
        for session_id, button in list(self._session_buttons.items()):
            if not button.winfo_exists():
                self._session_buttons.pop(session_id, None)
                continue
            is_selected = session_id == self._selected_session_id
            button.configure(
                fg_color=palette["ACCENT"] if is_selected else palette["ACCENT_CHOICE"],
                hover_color=palette["ACCENT_HOVER"] if is_selected else palette["ACCENT_CHOICE_HOVER"],
                text_color="#ffffff" if is_selected else palette["FG_PRIMARY"],
            )

    def set_collapsed(self, collapsed: bool) -> None:
        self._collapsed = bool(collapsed)
        if self._collapsed:
            self.title_label.grid_remove()
            self.new_chat_btn.grid_remove()
            self.list_frame.grid_remove()
            self.configure(width=self._collapsed_width)
            self.toggle_btn.configure(text="▶")
        else:
            self.title_label.grid()
            self.new_chat_btn.grid()
            self.list_frame.grid()
            self.configure(width=self._expanded_width)
            self.toggle_btn.configure(text="◀")

    def _toggle_sidebar(self) -> None:
        self._on_toggle_sidebar()

    def _bind_mousewheel_target(self, widget) -> None:
        for sequence in ("<MouseWheel>", "<Button-4>", "<Button-5>"):
            widget.bind(sequence, self._on_mousewheel, add="+")

    def _on_mousewheel(self, event) -> str:
        canvas = getattr(self.list_frame, "_parent_canvas", None)
        if canvas is None:
            return "break"
        if getattr(event, "num", None) == 4:
            delta = -1
        elif getattr(event, "num", None) == 5:
            delta = 1
        else:
            raw_delta = int(getattr(event, "delta", 0) or 0)
            if raw_delta == 0:
                return "break"
            delta = -int(raw_delta / 120) if raw_delta % 120 == 0 else (-1 if raw_delta > 0 else 1)
        canvas.yview_scroll(delta * MOUSEWHEEL_SCROLL_UNITS, "units")
        return "break"
