from __future__ import annotations

import customtkinter as ctk

from src.core.voice_package_manager import (
    PACKAGE_CONTROL,
    PACKAGE_SPEECH,
    InstallProgress,
    VoiceEnvironmentStatus,
    VoicePackageManager,
)
from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE


class VoicePackageManagerDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        manager: VoicePackageManager,
        status: VoiceEnvironmentStatus,
        onboarding: bool = False,
        on_status_updated=None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._manager = manager
        self._status = status
        self._onboarding = onboarding
        self._on_status_updated = on_status_updated
        self._busy = False

        self.title("Gói giọng nói offline")
        self.geometry("720x560")
        self.minsize(660, 520)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        shell = ctk.CTkFrame(self, fg_color=palette["BG_PRIMARY"])
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure((0, 1), weight=1)

        title = "Gói giọng nói offline"
        subtitle = (
            "Tải một lần để app đọc phản hồi và nhận lệnh giọng nói ngay trên máy, không cần internet sau khi cài."
            if onboarding
            else "Quản lý gói đọc giọng nói và gói nhận lệnh. Khi đã cài đủ, voice chạy offline trên máy này."
        )

        ctk.CTkLabel(
            shell,
            text=title,
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 2, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 6))

        ctk.CTkLabel(
            shell,
            text=subtitle,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            justify="left",
            wraplength=660,
            anchor="w",
        ).grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 16))

        self._speech_card = self._build_package_card(shell, row=2, column=0)
        self._control_card = self._build_package_card(shell, row=2, column=1)

        note_frame = ctk.CTkFrame(
            shell,
            fg_color=palette["BG_SECONDARY"],
            border_width=1,
            border_color=palette["BORDER_COLOR"],
            corner_radius=16,
        )
        note_frame.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(14, 0))
        note_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            note_frame,
            text="Nguồn tải chính thức",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(14, 4))

        ctk.CTkLabel(
            note_frame,
            text=(
                "Offline nghĩa là app chỉ cần internet để tải gói lần đầu. "
                "Sau khi cài, model được lưu trong LocalAppData và các chức năng voice dùng trực tiếp trên máy."
            ),
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            justify="left",
            wraplength=650,
            anchor="w",
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))

        self._progress_label = ctk.CTkLabel(
            shell,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
        )
        self._progress_label.grid(row=4, column=0, columnspan=2, sticky="ew", pady=(14, 6))

        self._progress_bar = ctk.CTkProgressBar(shell, progress_color=palette["ACCENT"], fg_color=palette["ACCENT_CHOICE"])
        self._progress_bar.grid(row=5, column=0, columnspan=2, sticky="ew")
        self._progress_bar.set(0)

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=6, column=0, columnspan=2, sticky="ew", pady=(18, 0))
        actions.grid_columnconfigure((0, 1, 2), weight=1)

        self._install_all_btn = ctk.CTkButton(
            actions,
            text="Cài cả hai gói",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=lambda: self._install_packages([PACKAGE_SPEECH, PACKAGE_CONTROL]),
        )
        self._install_all_btn.grid(row=0, column=0, sticky="ew", padx=(0, 6))

        self._test_btn = ctk.CTkButton(
            actions,
            text="Nghe thử giọng đọc",
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._test_voice,
        )
        self._test_btn.grid(row=0, column=1, sticky="ew", padx=6)

        close_text = "Bỏ qua lúc này" if onboarding else "Đóng"
        self._close_btn = ctk.CTkButton(
            actions,
            text=close_text,
            height=40,
            corner_radius=12,
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            command=self._close_dialog,
        )
        self._close_btn.grid(row=0, column=2, sticky="ew", padx=(6, 0))

        self.protocol("WM_DELETE_WINDOW", self._close_dialog)
        self._apply_status(status)

    def _build_package_card(self, master, *, row: int, column: int) -> dict[str, ctk.CTkBaseClass]:
        card = ctk.CTkFrame(
            master,
            fg_color=self._palette["BG_SECONDARY"],
            border_width=1,
            border_color=self._palette["BORDER_COLOR"],
            corner_radius=18,
        )
        card.grid(row=row, column=column, sticky="nsew", padx=(0, 8) if column == 0 else (8, 0), pady=0)
        card.grid_columnconfigure(0, weight=1)

        title = ctk.CTkLabel(
            card,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        )
        title.grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 6))

        summary = ctk.CTkLabel(
            card,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            justify="left",
            wraplength=280,
            anchor="w",
        )
        summary.grid(row=1, column=0, sticky="ew", padx=16)

        badge = ctk.CTkLabel(
            card,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            corner_radius=999,
            fg_color=self._palette["ACCENT_CHOICE"],
            text_color=self._palette["FG_PRIMARY"],
            padx=10,
            pady=6,
        )
        badge.grid(row=2, column=0, sticky="w", padx=16, pady=(12, 8))

        detail = ctk.CTkLabel(
            card,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            justify="left",
            wraplength=280,
            anchor="w",
        )
        detail.grid(row=3, column=0, sticky="ew", padx=16)

        install_btn = ctk.CTkButton(
            card,
            text="",
            height=38,
            corner_radius=12,
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
        )
        install_btn.grid(row=4, column=0, sticky="ew", padx=16, pady=(16, 16))

        return {
            "card": card,
            "title": title,
            "summary": summary,
            "badge": badge,
            "detail": detail,
            "button": install_btn,
        }

    def _apply_status(self, status: VoiceEnvironmentStatus) -> None:
        self._status = status
        self._paint_card(self._speech_card, status.speech, lambda: self._install_packages([PACKAGE_SPEECH]))
        self._paint_card(self._control_card, status.control, lambda: self._install_packages([PACKAGE_CONTROL]))
        self._test_btn.configure(state="normal" if status.speech_ready and not self._busy else "disabled")
        missing_count = int(not status.speech_ready) + int(not status.control_ready)
        ready_count = 2 - missing_count
        install_all_text = "Tải và cài đủ 2 gói" if missing_count else "Đã cài đủ"
        self._install_all_btn.configure(
            text=install_all_text,
            fg_color=self._palette["ACCENT_CONFIRM"] if missing_count == 0 else self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_CONFIRM"] if missing_count == 0 else self._palette["ACCENT_HOVER"],
            state="disabled" if missing_count == 0 or self._busy else "normal",
        )
        if not self._busy:
            self._progress_bar.set(ready_count / 2)
            if missing_count == 0:
                self._progress_label.configure(text="Đã cài đủ 2/2 gói. Voice có thể dùng offline trên máy này.")
            elif missing_count == 2:
                self._progress_label.configure(text="Chưa cài gói nào. Cần internet để tải lần đầu.")
            else:
                self._progress_label.configure(text=f"Đã cài {ready_count}/2 gói. Cài thêm gói còn thiếu để dùng đủ voice offline.")

    def _paint_card(self, widgets: dict[str, ctk.CTkBaseClass], package_status, command) -> None:
        widgets["title"].configure(text=package_status.title)
        widgets["summary"].configure(text=package_status.summary)
        widgets["detail"].configure(text=package_status.detail)
        if package_status.ready:
            widgets["badge"].configure(
                text="Sẵn sàng",
                fg_color=self._palette["ACCENT_CONFIRM"],
                text_color="#ffffff",
            )
            widgets["button"].configure(
                text="Cài lại gói này",
                command=command,
                state="disabled" if self._busy else "normal",
            )
        else:
            widgets["badge"].configure(
                text="Chưa cài",
                fg_color=self._palette["ACCENT_CHOICE"],
                text_color=self._palette["FG_PRIMARY"],
            )
            widgets["button"].configure(
                text="Tải và cài",
                command=command,
                state="disabled" if self._busy else "normal",
            )

    def _install_packages(self, package_ids: list[str]) -> None:
        if self._busy:
            return
        started = self._manager.install_packages_async(
            package_ids,
            on_progress=self._handle_progress,
            on_done=self._handle_install_done,
        )
        if not started:
            self._progress_label.configure(text="Đang có một tác vụ cài đặt khác chạy.")
            return
        self._busy = True
        self._set_actions_state()
        self._progress_bar.set(0)
        self._progress_label.configure(text="Đang bắt đầu cài gói giọng nói offline...")

    def _set_actions_state(self) -> None:
        buttons = [
            self._speech_card["button"],
            self._control_card["button"],
            self._install_all_btn,
            self._test_btn,
        ]
        for button in buttons:
            button.configure(state="disabled" if self._busy else "normal")
        self._apply_status(self._status)

    def _handle_progress(self, progress: InstallProgress) -> None:
        self.after(0, lambda: self._apply_progress(progress))

    def _apply_progress(self, progress: InstallProgress) -> None:
        self._progress_label.configure(text=progress.message)
        if progress.fraction > 0:
            self._progress_bar.set(min(progress.fraction, 1.0))
        elif progress.stage == "done":
            self._progress_bar.set(1.0)

    def _handle_install_done(self, success: bool, status: VoiceEnvironmentStatus, message: str) -> None:
        self.after(0, lambda: self._finish_install(success, status, message))

    def _finish_install(self, success: bool, status: VoiceEnvironmentStatus, message: str) -> None:
        self._busy = False
        self._progress_label.configure(text=message)
        self._progress_bar.set(1.0 if success else 0.0)
        if success:
            self._manager.mark_onboarding_seen("installed")
        self._apply_status(status)
        if self._on_status_updated:
            self._on_status_updated(status)

    def _test_voice(self) -> None:
        launched = self._manager.speak_async("Nhắc bạn: đây là bản đọc thử từ gói giọng nói offline.")
        if launched:
            self._progress_label.configure(text="Đang phát thử giọng nói offline...")
        else:
            self._progress_label.configure(text="Chưa thể thử đọc vì gói đọc giọng nói offline chưa sẵn sàng.")

    def _close_dialog(self) -> None:
        if self._onboarding and self._status.missing_any:
            self._manager.mark_onboarding_seen("skipped")
        self.destroy()
