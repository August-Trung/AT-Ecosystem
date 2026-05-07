# src/gui/action_bar.py
"""Dynamic action bar for confirm/choice/clarify states."""

from __future__ import annotations

import customtkinter as ctk
from typing import Callable, List

from src.gui.theme import (
    BG_PRIMARY,
    ACCENT_CONFIRM, ACCENT_CONFIRM_HOVER,
    ACCENT_CANCEL, ACCENT_CANCEL_HOVER,
    ACCENT_CHOICE, ACCENT_CHOICE_HOVER,
    FG_PRIMARY,
    FG_SECONDARY,
    FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL,
    BUTTON_HEIGHT,
    get_theme_palette,
)


class ActionBar(ctk.CTkFrame):
    """
    Shows dynamic buttons based on ActionResult status:
    - NEED_CONFIRM → ✓ Đồng ý / ✗ Hủy
    - NEED_CHOICE  → numbered buttons (1, 2, 3...)
    """

    def __init__(self, master, on_action: Callable[[str], None], **kwargs):
        super().__init__(master, fg_color=BG_PRIMARY, **kwargs)
        self._on_action = on_action
        self._buttons: List[ctk.CTkButton] = []
        self._palette = get_theme_palette("dark")
        self._mode: str = "hidden"
        self._choice_values: set[str] = set()

    # ─── Public API ──────────────────────────────────

    def show_confirm(self) -> None:
        """Show ✓ Đồng ý / ✗ Hủy buttons."""
        self._clear()
        self._mode = "confirm"

        hint = ctk.CTkLabel(
            self,
            text="Enter = Đồng ý, Esc = Hủy",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=FG_SECONDARY,
            anchor="center",
        )
        hint.pack(fill="x", padx=10, pady=(6, 0))

        yes_btn = ctk.CTkButton(
            self,
            text="✓ Đồng ý",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            height=BUTTON_HEIGHT,
            fg_color=self._palette["ACCENT_CONFIRM"],
            hover_color=self._palette["ACCENT_CONFIRM_HOVER"],
            text_color="#1a1a2e",
            corner_radius=8,
            command=lambda: self._fire("yes"),
        )
        yes_btn.pack(side="left", padx=(10, 4), pady=8, expand=True, fill="x")
        self._buttons.append(yes_btn)

        no_btn = ctk.CTkButton(
            self,
            text="✗ Hủy",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            height=BUTTON_HEIGHT,
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            corner_radius=8,
            command=lambda: self._fire("no"),
        )
        no_btn.pack(side="left", padx=(4, 10), pady=8, expand=True, fill="x")
        self._buttons.append(no_btn)

        self.grid(row=2, column=1, sticky="ew", padx=(4, 8), pady=(0, 6))

    def show_choices(self, choices: List[str]) -> None:
        """Show numbered choice buttons."""
        self._clear()
        self._mode = "choice"
        self._choice_values = {str(i + 1) for i in range(len(choices))}

        # Use a scrollable inner frame if many choices
        inner = ctk.CTkScrollableFrame(
            self,
            fg_color=self._palette["BG_PRIMARY"],
            height=min(len(choices) * 38, 180),
            scrollbar_button_color=self._palette["BG_PRIMARY"],
        )
        inner.pack(fill="x", padx=6, pady=4)

        for i, choice in enumerate(choices):
            # Show short label: just the filename from path
            label = choice.split("\\")[-1] if "\\" in choice else choice
            label = choice.split("/")[-1] if "/" in label else label
            display = f"{i + 1}) {label}"

            btn = ctk.CTkButton(
                inner,
                text=display,
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                height=32,
                fg_color=self._palette["ACCENT_CHOICE"],
                hover_color=self._palette["ACCENT_CHOICE_HOVER"],
                text_color=self._palette["FG_PRIMARY"],
                corner_radius=6,
                anchor="w",
                command=lambda idx=i + 1: self._fire(str(idx)),
            )
            btn.pack(fill="x", padx=6, pady=2)
            self._buttons.append(btn)

        # Cancel button — always visible below the scrollable list
        cancel_btn = ctk.CTkButton(
            self,
            text="✗ Hủy lựa chọn",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            height=32,
            width=100,
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            corner_radius=6,
            command=lambda: self._fire("hủy"),
        )
        cancel_btn.pack(padx=12, pady=(4, 6), anchor="center")
        self._buttons.append(cancel_btn)

        self.grid(row=2, column=1, sticky="ew", padx=(4, 8), pady=(0, 6))

    def hide(self) -> None:
        """Hide the action bar."""
        self._clear()
        self.grid_forget()
        self._mode = "hidden"
        self._choice_values.clear()

    def apply_theme(self, palette: dict[str, str]) -> None:
        self._palette = palette
        self.configure(fg_color=palette["BG_PRIMARY"])

    def current_mode(self) -> str:
        return self._mode

    def trigger_yes(self) -> None:
        if self._mode == "confirm":
            self._fire("yes")

    def trigger_no(self) -> None:
        if self._mode == "confirm":
            self._fire("no")

    def trigger_choice(self, value: str) -> None:
        if self._mode == "choice" and value in self._choice_values:
            self._fire(value)

    # ─── Internal ────────────────────────────────────

    def _clear(self) -> None:
        for btn in self._buttons:
            btn.destroy()
        self._buttons.clear()
        self._choice_values.clear()
        # Destroy any scrollable frames
        for child in self.winfo_children():
            child.destroy()

    def _fire(self, value: str) -> None:
        self.hide()
        self._on_action(value)
