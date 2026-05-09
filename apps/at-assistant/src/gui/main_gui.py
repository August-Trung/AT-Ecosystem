# src/gui/main_gui.py
"""
ATAssistant — Desktop GUI entry point (CustomTkinter).

Usage:
    python -m src.gui.main_gui
"""

from __future__ import annotations

from src.core.env_loader import load_project_env

load_project_env()

import ctypes
import queue
import re
import sys
import threading
from datetime import datetime, timedelta
from pathlib import Path
import tkinter.filedialog as filedialog
import customtkinter as ctk

try:
    import winsound
except Exception:
    winsound = None

try:
    from PIL import Image
except ModuleNotFoundError:
    Image = None

from src.core.engine import Engine
from src.core.result import ActionResult, ActionStatus, ErrorCode
from src.core.scheduled_task_queue import ScheduledTask, ScheduledTaskQueue
from src.core import executor
from src.core.app_paths import resource_path
from src.core.system_settings import SystemSettingsStore
from src.core.voice_package_manager import VoiceEnvironmentStatus, VoicePackageManager
from src.core.voice_runtime import VoiceCaptureConfig, VoiceEventType, VoiceOrchestrator
from src.core.wakeword_runtime import WakewordEventType, WakewordService
from src.gui.drive_manager_dialog import DriveManagerDialog
from src.gui.reminder_popup import ReminderPopup
from src.gui.tray_icon import TrayIconManager
from src.gui.voice_package_manager_dialog import VoicePackageManagerDialog
from src.gui.chat_history_panel import ChatHistoryPanel
from src.gui.send_email_dialog import SendEmailDialog
from src.gui.reminder_dialog import ReminderDialog
from src.gui.workflow_dialog import WorkflowDialog
from src.gui.startup_dialog import StartupDialog
from src.gui.uninstall_dialog import UninstallDialog
from src.gui.pin_lock_dialog import PinLockDialog
from src.gui.pin_manage_dialog import PinManageDialog
from src.core.pin_service import PinService
from src.gui.factory_reset_dialog import FactoryResetDialog
from src.gui.system_settings_dialog import SystemSettingsDialog
from src.gui.telegram_bot_dialog import TelegramBotDialog
from src.gui.mobile_remote_dialog import MobileRemoteDialog
from src.gui.custom_apps_dialog import CustomAppsDialog
from src.gui.email_auto_check_dialog import EmailAutoCheckDialog
from src.plugins.email_summarizer import EmailSummarizer
from src.plugins.reminder_service import ReminderService
from src.plugins.personal_memory_service import PersonalMemoryService
from src.plugins.chat_session_service import ChatSessionService
from src.plugins.recent_apps_service import RecentAppsService
from src.plugins.google_auth_service import GoogleAuthService
from src.plugins.google_drive_service import GoogleDriveService
from src.plugins.workflow_service import WorkflowService
from src.plugins.startup_service import StartupService
from src.plugins.custom_app_service import CustomAppService
from src.plugins.email_auto_check_service import EmailAutoCheckService
from src.integrations.telegram_bot import TelegramBotBridge, TelegramBotConfig, format_result_for_telegram
from src.integrations.telegram_settings import TelegramSettingsStore
from src.integrations.mobile_remote import MobileRemoteBridge, MobileRemoteSettingsStore

from src.gui.theme import (
    BG_PRIMARY,
    BG_SECONDARY,
    FG_PRIMARY,
    FG_SECONDARY,
    ACCENT,
    ACCENT_CANCEL,
    ACCENT_CANCEL_HOVER,
    FONT_FAMILY,
    FONT_SIZE_TITLE,
    FONT_SIZE_SMALL,
    FONT_SIZE_NORMAL,
    WINDOW_TITLE,
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
    MIN_WIDTH,
    MIN_HEIGHT,
    get_theme_palette,
)
from src.gui.chat_frame import ChatFrame
from src.gui.input_frame import InputFrame
from src.gui.action_bar import ActionBar

from src.core.alias.normalize import normalize_text

# DPI awareness (Windows)
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass


def _update_startup_splash(message: str) -> None:
    try:
        import pyi_splash  # type: ignore
    except Exception:
        return
    try:
        if pyi_splash.is_alive():
            pyi_splash.update_text(message)
    except Exception:
        pass


def _close_startup_splash() -> None:
    try:
        import pyi_splash  # type: ignore
    except Exception:
        return
    try:
        if pyi_splash.is_alive():
            pyi_splash.close()
    except Exception:
        pass


class ATAssistantApp(ctk.CTk):
    """Main application window."""

    def __init__(self, *, start_hidden: bool = False):
        super().__init__()
        self.withdraw()
        self._settings_store = SystemSettingsStore()
        self._system_settings = self._settings_store.load()

        # ─── Window config ───
        self.title(WINDOW_TITLE)
        self.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}")
        self.minsize(MIN_WIDTH, MIN_HEIGHT)
        self.configure(fg_color=BG_PRIMARY)
        self._app_icon_path = resource_path("assests", "ATAssistant.ico")
        self._app_logo_path = resource_path("assests", "icon_64.png")
        self._app_logo_image = None
        self._apply_window_icon()
        self._prefer_zoomed_window = not start_hidden
        self._appearance_mode = str(
            self._system_settings.get("appearance_mode") or "dark"
        ).lower()
        self._palette = get_theme_palette(self._appearance_mode)
        ctk.set_widget_scaling(float(self._system_settings.get("widget_scale") or 1.0))
        ctk.set_appearance_mode(self._appearance_mode)
        self._theme_icons = self._load_theme_icons()

        # ─── Engine ───
        self.engine = Engine()
        self._result_queue: queue.Queue[tuple[int, int, ActionResult]] = queue.Queue()
        self._request_seq = 0
        self._conversation_epoch = 0
        self._active_request_id: int | None = None
        self._active_cancel_event: threading.Event | None = None
        self._cancelled_request_ids: set[int] = set()
        self._request_sources: dict[int, str] = {}
        self._request_epochs: dict[int, int] = {}

        # ─── Voice ───
        self._voice_status_queue: queue.Queue = queue.Queue()
        self._voice_packages = VoicePackageManager()
        self._voice_runtime = VoiceOrchestrator(self._voice_packages)
        self._wakeword_runtime = WakewordService(
            self._voice_packages,
            can_listen=self._wakeword_can_listen,
            settings_provider=self._get_system_settings,
        )
        self._voice_package_status: VoiceEnvironmentStatus | None = None
        self._voice_background_started = False
        self._voice_speaker_warmup_started = False
        self._wakeword_waiting_for_command = False
        self._voice_session_active = False
        self._voice_session_mode = "command"
        self._voice_session_retries = 0
        self._voice_manager_dialog: VoicePackageManagerDialog | None = None
        self._system_settings_dialog: SystemSettingsDialog | None = None
        self._drive_manager_dialog: DriveManagerDialog | None = None
        self._return_to_settings_hub = False
        self._voice_onboarding_shown = False
        self._reminder_service = ReminderService()
        self._active_reminder_popup: ReminderPopup | None = None
        self._active_popup_reminder_id = ""
        self._reminder_cooldowns: dict[str, datetime] = {}
        self._queued_due_reminders: list[dict] = []
        self._queued_due_ids: set[str] = set()
        self._email_summary_jobs: set[str] = set()
        self._tray_icon: TrayIconManager | None = None
        self._tray_active = False
        self._is_quitting = False
        self._after_ids: set[str] = set()
        self._chat_sessions = ChatSessionService()
        self._current_session_id = ""
        self._history_sidebar_collapsed = False
        self._upcoming_tasks_collapsed = True  # collapsed by default on startup
        self._send_email_dialog: SendEmailDialog | None = None
        self._reminder_dialog: ReminderDialog | None = None
        self._workflow_dialog: WorkflowDialog | None = None
        self._email_auto_check_dialog: EmailAutoCheckDialog | None = None
        self._startup_dialog: StartupDialog | None = None
        self._uninstall_dialog: UninstallDialog | None = None
        self._factory_reset_dialog: FactoryResetDialog | None = None
        self._custom_apps_dialog: CustomAppsDialog | None = None
        self._telegram_bot_dialog: TelegramBotDialog | None = None
        self._telegram_bridge_thread: threading.Thread | None = None
        self._telegram_bridge_stop: threading.Event | None = None
        self._telegram_bridge_config_key = ""
        self._mobile_remote_dialog: MobileRemoteDialog | None = None
        self._mobile_remote_bridge = MobileRemoteBridge(
            self.engine,
            on_event=self._handle_mobile_remote_event,
        )
        self._upcoming_task_labels: list[ctk.CTkLabel] = []
        self._workflow_service = WorkflowService()
        self._email_auto_check_service = EmailAutoCheckService()
        self._startup_service = StartupService()
        self._pin_service = PinService()
        self._pin_manage_dialog: PinManageDialog | None = None
        self._running_scheduled_workflows: set[str] = set()
        self._running_scheduled_email_checks: set[str] = set()
        self._scheduled_task_queue = ScheduledTaskQueue()
        self._start_hidden = start_hidden

        # ─── Layout ───
        self.grid_rowconfigure(1, weight=1)  # chat area expands
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_columnconfigure(2, weight=0)

        self._build_header()
        self._build_history_panel()
        self._build_chat()
        self._build_action_bar()
        self._build_input()
        self._apply_system_settings()
        self._refresh_gmail_status()
        self._refresh_upcoming_tasks_panel()

        # ─── Poll results from engine thread ───
        self._poll_results()

        # ─── Poll voice commands ───
        self._poll_voice()
        self._poll_wakeword()
        self._poll_voice_package_status()
        self._poll_internal_scheduled_tasks()
        self._safe_after(1500, self._start_voice_background_services)
        self._safe_after(2000, self._start_telegram_bridge_from_settings)
        self._safe_after(2300, self._start_mobile_remote_from_settings)

        # ─── Welcome message ───
        self._start_new_chat_session(show_notice=False)

        # ─── Focus input ───
        if not self._start_hidden:
            self._safe_after(100, self.input_bar.focus_input)
            self._safe_after(500, self.input_bar.focus_input)

        # ─── Keyboard shortcuts for confirm/choice ───
        self.bind_all("<Return>", self._handle_keyboard_confirm)
        self.bind_all("<KP_Enter>", self._handle_keyboard_confirm)
        self.bind_all("<Escape>", self._handle_keyboard_cancel)
        self.bind_all("y", self._handle_keyboard_yes)
        self.bind_all("Y", self._handle_keyboard_yes)
        self.bind_all("n", self._handle_keyboard_no)
        self.bind_all("N", self._handle_keyboard_no)
        for digit in "123456789":
            self.bind_all(digit, self._handle_keyboard_choice)
        self.bind_all("<MouseWheel>", self._route_global_mousewheel, add="+")
        self.bind_all("<Button-4>", self._route_global_mousewheel, add="+")
        self.bind_all("<Button-5>", self._route_global_mousewheel, add="+")
        self.bind("<Unmap>", self._handle_window_unmap)
        self.protocol("WM_DELETE_WINDOW", self._handle_close_window)
        if self._start_hidden:
            self._safe_after(0, self._enter_background_startup_mode)
        else:
            self._safe_after(0, self._show_initial_window)

    def _safe_after(self, delay_ms: int, callback) -> str | None:
        if self._is_quitting:
            return None
        holder: dict[str, str] = {}

        def runner() -> None:
            after_id = holder.get("id")
            if after_id:
                self._after_ids.discard(after_id)
            if self._is_quitting:
                return
            if not self.winfo_exists():
                return
            callback()

        after_id = self.after(delay_ms, runner)
        holder["id"] = after_id
        self._after_ids.add(after_id)
        return after_id

    def _cancel_pending_afters(self) -> None:
        for after_id in list(self._after_ids):
            try:
                self.after_cancel(after_id)
            except Exception:
                pass
        self._after_ids.clear()

    def _route_global_mousewheel(self, event) -> str | None:
        widget = self.winfo_containing(event.x_root, event.y_root)
        if widget is None:
            return None

        target_canvas = None
        current = widget
        chat_canvas = getattr(self.chat, "_parent_canvas", None)
        history_canvas = getattr(self.history_panel.list_frame, "_parent_canvas", None)

        while current is not None:
            if current == self.chat or current == chat_canvas:
                target_canvas = chat_canvas
                break
            if (
                current == self.history_panel
                or current == self.history_panel.list_frame
                or current == history_canvas
            ):
                target_canvas = history_canvas
                break
            current = getattr(current, "master", None)

        if target_canvas is None:
            return None

        if getattr(event, "num", None) == 4:
            delta = -1
        elif getattr(event, "num", None) == 5:
            delta = 1
        else:
            raw_delta = int(getattr(event, "delta", 0) or 0)
            if raw_delta == 0:
                return "break"
            delta = (
                -int(raw_delta / 120)
                if raw_delta % 120 == 0
                else (-1 if raw_delta > 0 else 1)
            )

        try:
            target_canvas.yview_scroll(delta, "units")
        except Exception:
            return None
        return "break"

    def _apply_preferred_window_state(self) -> None:
        if getattr(self, "_is_quitting", False):
            return
        if getattr(self, "_start_hidden", False) or not getattr(
            self, "_prefer_zoomed_window", False
        ):
            return
        try:
            self.state("zoomed")
        except Exception:
            pass

    # ═══════════════════════════════════════════════════
    #  BUILD UI
    # ═══════════════════════════════════════════════════

    def _show_initial_window(self) -> None:
        if getattr(self, "_is_quitting", False):
            return
        _close_startup_splash()
        if self._pin_service.is_pin_set():
            PinLockDialog(
                self,
                palette=self._palette,
                on_success=self._reveal_main_window,
                on_fail=self.quit,
            )
        else:
            self._reveal_main_window()

    def _reveal_main_window(self) -> None:
        if getattr(self, "_is_quitting", False):
            return
        self.deiconify()
        self._apply_preferred_window_state()
        self.lift()
        try:
            self.update_idletasks()
        except Exception:
            pass

    def _build_header(self) -> None:
        self.header = ctk.CTkFrame(
            self, fg_color=self._palette["BG_PRIMARY"], height=50
        )
        self.header.grid(row=0, column=0, columnspan=2, sticky="ew", padx=0, pady=0)
        self.header.grid_columnconfigure(0, weight=1)
        self.header_title_row = ctk.CTkFrame(self.header, fg_color="transparent")
        self.header_title_row.grid(row=0, column=0, padx=16, pady=(12, 8), sticky="w")
        self._app_logo_image = self._load_app_logo_image()
        self.header_logo_label = None
        if self._app_logo_image is not None:
            self.header_logo_label = ctk.CTkLabel(
                self.header_title_row,
                text="",
                image=self._app_logo_image,
            )
            self.header_logo_label.grid(row=0, column=0, padx=(0, 8), pady=0)

        self.header_title = ctk.CTkLabel(
            self.header_title_row,
            text="🤖  AT Assistant",
            font=(FONT_FAMILY, FONT_SIZE_TITLE, "bold"),
            text_color=self._palette["FG_PRIMARY"],
        )
        self.header_title.grid(row=0, column=1, pady=0, sticky="w")
        self.header_title.configure(text="AT Assistant")

        self.gmail_status_label = ctk.CTkLabel(
            self.header,
            text="",
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=self._palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
        )
        self.gmail_status_label.grid(row=1, column=0, padx=16, pady=(0, 8), sticky="w")

        self.voice_packages_btn = ctk.CTkButton(
            self.header,
            text="Gói giọng nói offline",
            height=30,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=8,
            command=self._open_voice_package_manager,
        )
        self.voice_packages_btn.grid(
            row=0, column=1, padx=(8, 8), pady=(10, 6), sticky="e"
        )

        self.settings_btn = ctk.CTkButton(
            self.header,
            text="⚙",
            height=30,
            width=30,
            font=(FONT_FAMILY, 14, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=8,
            anchor="center",
            command=self._open_system_settings_dialog,
        )
        self.settings_btn.grid(row=0, column=2, padx=(0, 8), pady=(10, 6), sticky="e")

        self.pin_btn = ctk.CTkButton(
            self.header,
            text="🔒",
            height=30,
            width=30,
            font=(FONT_FAMILY, 14, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            corner_radius=8,
            anchor="center",
            command=self._open_pin_manage_dialog,
        )
        self.pin_btn.grid(row=0, column=3, padx=(0, 8), pady=(10, 6), sticky="e")

        self.clear_chat_btn = ctk.CTkButton(
            self.header,
            text="✎",
            height=30,
            width=36,
            font=(FONT_FAMILY, 14, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=8,
            anchor="center",
            command=self._clear_conversation,
        )
        self.clear_chat_btn.grid(row=0, column=4, padx=(0, 8), pady=(10, 6), sticky="e")

        self.delete_chat_btn = ctk.CTkButton(
            self.header,
            text="🗑",
            width=36,
            height=30,
            font=(FONT_FAMILY, 14, "bold"),
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
            corner_radius=8,
            anchor="center",
            command=self._delete_current_chat_session,
        )
        self.delete_chat_btn.grid(
            row=0, column=5, padx=(0, 6), pady=(10, 6), sticky="e"
        )

        self.mode_btn = ctk.CTkButton(
            self.header,
            text=self._get_theme_button_text(),
            image=self._get_theme_button_image(),
            width=44,
            height=30,
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=8,
            command=self._toggle_appearance_mode,
        )
        self.mode_btn.grid(row=0, column=6, padx=(8, 16), pady=(10, 6), sticky="e")

        self.header_sep = ctk.CTkFrame(
            self.header, fg_color=self._palette["ACCENT"], height=2
        )
        self.header_sep.grid(row=2, column=0, columnspan=7, sticky="ew", padx=12)

    def _build_history_panel(self) -> None:
        self.history_panel = ChatHistoryPanel(
            self,
            on_new_chat=self._start_new_chat_session,
            on_open_session=self._open_chat_session,
            on_toggle_sidebar=self._toggle_history_sidebar,
            width=220,
        )
        self.history_panel.grid(
            row=1, column=0, rowspan=3, sticky="nsew", padx=(0, 4), pady=(6, 0)
        )

    def _build_chat(self) -> None:
        self.chat = ChatFrame(self)
        self.chat.grid(row=1, column=1, sticky="nsew", padx=(4, 8), pady=(6, 0))
        self._build_upcoming_tasks_panel()

    def _build_upcoming_tasks_panel(self) -> None:
        self.upcoming_tasks_frame = ctk.CTkFrame(
            self,
            fg_color=self._palette["BG_SECONDARY"],
            corner_radius=12,
            width=260,
        )
        self.upcoming_tasks_frame.grid_columnconfigure(0, weight=1)
        self.upcoming_tasks_frame.grid_propagate(False)
        self.upcoming_tasks_frame.grid_rowconfigure(1, weight=1)

        self.upcoming_tasks_header = ctk.CTkFrame(
            self.upcoming_tasks_frame, fg_color="transparent"
        )
        self.upcoming_tasks_header.grid(
            row=0, column=0, sticky="ew", padx=8, pady=(8, 4)
        )
        self.upcoming_tasks_header.grid_columnconfigure(0, weight=1)

        self.upcoming_tasks_title = ctk.CTkLabel(
            self.upcoming_tasks_header,
            text="Sắp đến hạn",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL + 3, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        )
        self.upcoming_tasks_title.grid(
            row=0, column=0, sticky="ew", padx=(4, 6), pady=0
        )

        self.upcoming_tasks_toggle_btn = ctk.CTkButton(
            self.upcoming_tasks_header,
            text="◀",
            width=30,
            height=30,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
            command=self._toggle_upcoming_tasks_panel,
        )
        self.upcoming_tasks_toggle_btn.grid(
            row=0, column=1, padx=(0, 2), pady=0, sticky="e"
        )

        self.upcoming_tasks_body = ctk.CTkFrame(
            self.upcoming_tasks_frame,
            fg_color="transparent",
        )
        self.upcoming_tasks_body.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        self.upcoming_tasks_body.grid_columnconfigure(0, weight=1)

        self._upcoming_task_labels = []
        for index in range(4):
            label = ctk.CTkLabel(
                self.upcoming_tasks_body,
                text="",
                font=(FONT_FAMILY, FONT_SIZE_NORMAL + 1),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
                justify="left",
                wraplength=220,
            )
            label.grid(row=index, column=0, sticky="ew", padx=12, pady=(0, 6))
            self._upcoming_task_labels.append(label)
        self.upcoming_tasks_frame.grid_remove()
        self._apply_upcoming_tasks_collapsed_state()

    def _build_action_bar(self) -> None:
        self.action_bar = ActionBar(self, on_action=self._on_action)
        # initially hidden — only shown when needed

    def _build_input(self) -> None:
        self.input_bar = InputFrame(
            self,
            on_send=self._on_send,
            on_stop=self._on_stop_current_request,
            on_mic_toggle=self._on_mic_toggle,
            on_pick_excel=self._pick_bulk_email_excel,
            on_open_send_email=self._open_send_email_dialog,
            on_open_reminder=self._open_reminder_dialog,
            on_manage_drive=self._open_drive_manager,
            on_manage_voice=self._open_voice_package_manager,
            on_manage_workflows=self._open_workflow_dialog,
            on_manage_email_auto_checks=self._open_email_auto_check_dialog,
            on_manage_startup=self._open_startup_dialog,
            on_manage_custom_apps=self._open_custom_apps_dialog,
            on_open_settings=self._open_system_settings_dialog,
            on_view_history=self._show_chat_sessions,
            on_stop_speech=self._on_stop_speech,
        )
        self.input_bar.grid(row=3, column=1, sticky="ew")

    def _toggle_appearance_mode(self) -> None:
        self._appearance_mode = "light" if self._appearance_mode == "dark" else "dark"
        self._system_settings["appearance_mode"] = self._appearance_mode
        self._settings_store.save(self._system_settings)
        self._apply_theme_mode()

    def _load_theme_icons(self) -> dict[str, ctk.CTkImage]:
        icons: dict[str, ctk.CTkImage] = {}
        if Image is None:
            return icons

        icon_specs = {
            "dark": resource_path("assests", "moon.png"),
            "light": resource_path("assests", "sun.png"),
        }

        for mode, path in icon_specs.items():
            try:
                image = Image.open(path).convert("RGBA")
                icons[mode] = ctk.CTkImage(
                    light_image=image.copy(),
                    dark_image=image.copy(),
                    size=(18, 18),
                )
            except Exception:
                continue

        return icons

    def _load_app_logo_image(self):
        if Image is None:
            return None
        try:
            image = Image.open(self._app_logo_path).convert("RGBA")
            return ctk.CTkImage(
                light_image=image.copy(),
                dark_image=image.copy(),
                size=(24, 24),
            )
        except Exception:
            return None

    def _apply_window_icon(self) -> None:
        try:
            if self._app_icon_path.exists():
                self.iconbitmap(str(self._app_icon_path))
                self.iconbitmap(default=str(self._app_icon_path))
        except Exception:
            pass

    def _get_theme_button_image(self):
        return self._theme_icons.get(self._appearance_mode)

    def _get_theme_button_text(self) -> str:
        return (
            ""
            if self._get_theme_button_image()
            else ("Dark" if self._appearance_mode == "light" else "Light")
        )

    def _apply_theme_mode(self) -> None:
        self._palette = get_theme_palette(self._appearance_mode)
        ctk.set_appearance_mode(self._appearance_mode)
        self.configure(fg_color=self._palette["BG_PRIMARY"])
        self.header.configure(fg_color=self._palette["BG_PRIMARY"])
        self.header_title.configure(text_color=self._palette["FG_PRIMARY"])
        self.header_sep.configure(fg_color=self._palette["ACCENT"])
        self._refresh_voice_package_button()
        button_image = self._get_theme_button_image()
        self.mode_btn.configure(
            text=self._get_theme_button_text(),
            image=button_image,
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
        )
        self.clear_chat_btn.configure(
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
        )
        self.settings_btn.configure(
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
        )
        self.delete_chat_btn.configure(
            fg_color=self._palette["ACCENT_CANCEL"],
            hover_color=self._palette["ACCENT_CANCEL_HOVER"],
            text_color="#1a1a2e",
        )
        self.chat.apply_theme(self._palette)
        self.history_panel.apply_theme(self._palette)
        self.input_bar.apply_theme(self._palette)
        self.action_bar.apply_theme(self._palette)
        self.gmail_status_label.configure(text_color=self._palette["FG_SECONDARY"])
        self._refresh_gmail_status()
        self._apply_upcoming_tasks_theme()
        self._refresh_upcoming_tasks_panel()
        if (
            self._active_reminder_popup is not None
            and self._active_reminder_popup.winfo_exists()
        ):
            self._active_reminder_popup.destroy()
        self._active_reminder_popup = None
        self._active_popup_reminder_id = ""

    def _get_system_settings(self) -> dict:
        return dict(self._system_settings)

    def _apply_system_settings(self) -> None:
        self._appearance_mode = str(
            self._system_settings.get("appearance_mode") or "dark"
        ).lower()
        ctk.set_widget_scaling(float(self._system_settings.get("widget_scale") or 1.0))
        self._apply_theme_mode()
        self._refresh_header_title()
        self._voice_runtime.update_capture_config(
            VoiceCaptureConfig(
                pre_speech_timeout_sec=float(
                    self._system_settings.get("voice_pre_speech_timeout_sec") or 4.0
                ),
                max_recording_sec=float(
                    self._system_settings.get("voice_max_recording_sec") or 8.0
                ),
            )
        )

    def _refresh_header_title(self) -> None:
        display_name = str(self._system_settings.get("display_name") or "").strip()
        title = "🤖  AT Assistant"
        title = "AT Assistant"
        if display_name:
            title = f"{title} · {display_name}"
        self.header_title.configure(text=title)

    def _apply_upcoming_tasks_theme(self) -> None:
        self.upcoming_tasks_frame.configure(fg_color=self._palette["BG_SECONDARY"])
        self.upcoming_tasks_header.configure(fg_color="transparent")
        self.upcoming_tasks_body.configure(fg_color="transparent")
        self.upcoming_tasks_title.configure(text_color=self._palette["FG_PRIMARY"])
        self.upcoming_tasks_toggle_btn.configure(
            fg_color=self._palette["ACCENT_CHOICE"],
            hover_color=self._palette["ACCENT_CHOICE_HOVER"],
            text_color=self._palette["FG_PRIMARY"],
        )
        for label in self._upcoming_task_labels:
            label.configure(text_color=self._palette["FG_SECONDARY"])
        self._apply_upcoming_tasks_collapsed_state()

    def _toggle_upcoming_tasks_panel(self) -> None:
        self._upcoming_tasks_collapsed = not self._upcoming_tasks_collapsed
        self._apply_upcoming_tasks_collapsed_state()

    def _apply_upcoming_tasks_collapsed_state(self) -> None:
        if self._upcoming_tasks_collapsed:
            self.upcoming_tasks_title.grid_remove()
            self.upcoming_tasks_body.grid_remove()
            self.upcoming_tasks_frame.configure(width=44)
            self.upcoming_tasks_toggle_btn.configure(text="▶")
        else:
            self.upcoming_tasks_title.grid()
            self.upcoming_tasks_body.grid()
            self.upcoming_tasks_frame.configure(width=260)
            self.upcoming_tasks_toggle_btn.configure(text="◀")

    def _start_voice_package_check(self) -> None:
        threading.Thread(
            target=self._refresh_voice_package_status_worker, daemon=True
        ).start()

    def _start_voice_background_services(self) -> None:
        if self._voice_background_started or self._is_quitting:
            return
        self._voice_background_started = True
        self._start_voice_package_check()
        self._wakeword_runtime.start()

    def _refresh_voice_package_status_worker(self) -> None:
        try:
            status = self._voice_packages.refresh_status()
            should_prompt = self._voice_packages.should_prompt_on_start(status)
            self._voice_status_queue.put(("status", status, should_prompt))
        except Exception as exc:
            self._voice_status_queue.put(("error", str(exc), False))

    def _poll_voice_package_status(self) -> None:
        try:
            while True:
                kind, payload, flag = self._voice_status_queue.get_nowait()
                if kind == "status":
                    self._handle_voice_package_status(payload, should_prompt=bool(flag))
                else:
                    self.chat.add_bot_message(
                        f"Không thể kiểm tra gói giọng nói offline: {payload}",
                        style="error",
                    )
        except queue.Empty:
            pass
        self._safe_after(150, self._poll_voice_package_status)

    def _handle_voice_package_status(
        self, status: VoiceEnvironmentStatus, *, should_prompt: bool
    ) -> None:
        self._voice_package_status = status
        self._refresh_voice_package_button()
        if status.speech_ready and not self._voice_speaker_warmup_started:
            self._voice_speaker_warmup_started = self._voice_packages.warm_up_speaker_async()
        if status.missing_any:
            parts: list[str] = []
            if not status.speech_ready:
                parts.append(
                    "gói đọc giọng nói offline chưa sẵn sàng nên reminder sẽ beep nếu chưa thể đọc"
                )
            if not status.control_ready:
                parts.append(
                    "gói nhận lệnh giọng nói offline chưa sẵn sàng nên app sẽ tiếp tục dùng text bình thường"
                )
            self.chat.add_system_message("App vẫn dùng được. " + "; ".join(parts) + ".")
        if should_prompt and not self._voice_onboarding_shown:
            self._voice_onboarding_shown = True
            self._voice_packages.mark_prompt_shown()
            self._safe_after(
                250, lambda: self._open_voice_package_manager(onboarding=True)
            )

    def _refresh_voice_package_button(self) -> None:
        status = self._voice_package_status
        if status is None:
            self.voice_packages_btn.configure(
                text="Đang kiểm tra gói giọng nói offline...",
                fg_color=self._palette["ACCENT_CHOICE"],
                hover_color=self._palette["ACCENT_CHOICE_HOVER"],
                text_color=self._palette["FG_PRIMARY"],
            )
            return
        if status.speech_ready and status.control_ready:
            self.voice_packages_btn.configure(
                text="Gói giọng nói offline sẵn sàng",
                fg_color=self._palette["ACCENT_CONFIRM"],
                hover_color=self._palette["ACCENT_CONFIRM_HOVER"],
                text_color="#ffffff",
            )
            return
        self.voice_packages_btn.configure(
            text="Cài gói giọng nói offline",
            fg_color=self._palette["ACCENT"],
            hover_color=self._palette["ACCENT_HOVER"],
            text_color="#ffffff",
        )

    def _open_voice_package_manager(self, onboarding: bool = False) -> None:
        status = self._voice_package_status or self._voice_packages.refresh_status()
        if (
            self._voice_manager_dialog is not None
            and self._voice_manager_dialog.winfo_exists()
        ):
            self._voice_manager_dialog.focus()
            self._voice_manager_dialog.lift()
            return
        dialog = VoicePackageManagerDialog(
            self,
            palette=self._palette,
            manager=self._voice_packages,
            status=status,
            onboarding=onboarding,
            on_status_updated=self._on_voice_package_status_updated,
        )
        dialog.bind("<Destroy>", self._on_voice_manager_dialog_destroy, add="+")
        self._voice_manager_dialog = dialog

    def _on_voice_package_status_updated(self, status: VoiceEnvironmentStatus) -> None:
        self._voice_package_status = status
        self._refresh_voice_package_button()

    def _on_voice_manager_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._voice_manager_dialog:
            self._voice_manager_dialog = None
            self._voice_package_status = self._voice_packages.refresh_status()
            self._refresh_voice_package_button()
            self._maybe_reopen_system_settings_hub()

    # ═══════════════════════════════════════════════════
    #  VOICE INTEGRATION
    # ═══════════════════════════════════════════════════

    def _on_mic_toggle(self, is_on: bool) -> None:
        """Called when user toggles mic button."""
        if is_on:
            self._start_voice()
        else:
            self._stop_voice()

    def _start_voice(self, *, announce: bool = True) -> None:
        """Start one-shot voice listening without blocking the GUI."""
        if self._active_request_id is not None:
            self.chat.add_system_message(
                "Đang có một yêu cầu khác chạy nên chưa thể bật mic cho lượt mới."
            )
            self.input_bar.set_mic_state(False)
            self.input_bar.set_status("")
            return

        self._wakeword_runtime.pause()
        started = self._voice_runtime.start_listen_once()
        if started:
            if not self._voice_session_active:
                self._voice_session_active = True
                self._voice_session_mode = "command"
                self._voice_session_retries = 0
            self.input_bar.set_mic_state(True)
            if announce:
                self.chat.add_system_message(
                    "Mic đã bật cho một lượt nói. Hãy nói một câu lệnh ngắn."
                )
            self.input_bar.set_status("Đang nghe câu lệnh...", "#e94560")
        elif not self._voice_runtime.is_busy():
            if not self._wakeword_waiting_for_command:
                self._wakeword_runtime.resume()
            self.input_bar.set_mic_state(False)
            self.input_bar.set_status("")

    def _stop_voice(self) -> None:
        self._voice_runtime.cancel()
        self.input_bar.set_status("")
        self._apply_wakeword_cooldown("cancel")
        self.chat.add_system_message("Đã tắt mic.")

    def _poll_voice(self) -> None:
        """Poll voice command queue and send to engine."""
        try:
            while True:
                event = self._voice_runtime.event_queue.get_nowait()
                if event.type == VoiceEventType.STARTED:
                    self.input_bar.set_mic_state(True)
                    continue
                if event.type == VoiceEventType.LISTENING:
                    self.input_bar.set_mic_state(True)
                    self.input_bar.set_status("Đang nghe câu lệnh...", "#e94560")
                    continue
                if event.type == VoiceEventType.SPEECH_DETECTED:
                    self.input_bar.set_mic_state(True)
                    self.input_bar.set_status("Đã ghi nhận giọng nói...", "#e94560")
                    continue
                if event.type == VoiceEventType.TRANSCRIBING:
                    self.input_bar.set_mic_state(True)
                    self.input_bar.set_status(
                        "Đang nhận diện bằng Zipformer...", "#e94560"
                    )
                    continue
                if event.type == VoiceEventType.TRANSCRIPT:
                    transcript = normalize_text(event.transcript)
                    self.input_bar.set_mic_state(False)
                    self.input_bar.set_status(f"Transcript: {transcript}", "#e94560")
                    if transcript:
                        self._submit_request(transcript, source="voice")
                    continue
                if event.type == VoiceEventType.COMPLETED:
                    self.input_bar.set_mic_state(False)
                    continue
                if event.type == VoiceEventType.CANCELLED:
                    self.input_bar.set_mic_state(False)
                    self.input_bar.set_status("")
                    self._apply_wakeword_cooldown("cancel")
                    self._resume_wakeword_after_voice()
                    if event.message:
                        self.chat.add_system_message(event.message)
                    continue
                if event.type == VoiceEventType.UNAVAILABLE:
                    self.input_bar.set_mic_state(False)
                    self.input_bar.set_status("")
                    self._apply_wakeword_cooldown("cancel")
                    self._resume_wakeword_after_voice()
                    self.chat.add_system_message(
                        event.message
                        or "Gói nhận lệnh giọng nói offline chưa sẵn sàng, app chuyển về text."
                    )
                    continue
                if event.type == VoiceEventType.ERROR:
                    self.input_bar.set_mic_state(False)
                    self.input_bar.set_status("")
                    no_speech_error = "không nhận được câu lệnh giọng nói rõ ràng" in (
                        event.message or ""
                    ).lower()
                    if no_speech_error:
                        if self._handle_voice_session_no_speech(event.message):
                            continue
                    if not no_speech_error:
                        self._apply_wakeword_cooldown("cancel")
                    self._resume_wakeword_after_voice()
                    self.chat.add_bot_message(
                        event.message or "Voice runtime lỗi.", style="error"
                    )
        except queue.Empty:
            pass
        self._safe_after(100, self._poll_voice)

    def _poll_wakeword(self) -> None:
        try:
            while True:
                event = self._wakeword_runtime.event_queue.get_nowait()
                if event.type == WakewordEventType.STATUS:
                    continue
                if event.type == WakewordEventType.UNAVAILABLE:
                    continue
                if event.type == WakewordEventType.ERROR:
                    self.chat.add_bot_message(
                        event.message or "Wakeword runtime lỗi.", style="error"
                    )
                    continue
                if event.type == WakewordEventType.DETECTED:
                    self._handle_wakeword_detected(event.transcript)
        except queue.Empty:
            pass
        self._safe_after(120, self._poll_wakeword)

    def _handle_wakeword_detected(self, transcript: str) -> None:
        if self._active_request_id is not None:
            self._wakeword_runtime.resume()
            return
        self._wakeword_waiting_for_command = True
        self._voice_session_active = True
        self._voice_session_mode = "command"
        self._voice_session_retries = 0
        _ww_phrase = str(
            self._system_settings.get("wakeword_phrase") or "Hải ơi"
        ).strip()
        self.input_bar.set_mic_state(False)
        self.input_bar.set_status(f"Wakeword: {_ww_phrase}. Chuẩn bị nghe lệnh...", "#e94560")
        normalized_transcript = normalize_text(transcript) or "không rõ transcript"
        self.chat.add_system_message(
            f"Đã nghe wakeword '{_ww_phrase}' ({normalized_transcript})."
        )
        prompt_text = str(
            self._system_settings.get("wakeword_prompt_normal") or "Dạ, mời bạn nói."
        ).strip()
        self._play_prompt_feedback(
            prompt_text,
            tray_title="Wakeword",
            on_done=self._start_wakeword_command_listen,
        )

    def _start_wakeword_command_listen(self) -> None:
        self.input_bar.hide_stop_speech()
        self._start_voice(announce=False)

    def _continue_voice_session(
        self, prompt_text: str, *, mode: str, reset_retries: bool = True
    ) -> None:
        prompt = " ".join((prompt_text or "").split()).strip()
        self._voice_session_active = True
        self._voice_session_mode = mode or "command"
        if reset_retries:
            self._voice_session_retries = 0
        if not prompt:
            self._start_voice(announce=False)
            return
        self.input_bar.set_mic_state(False)
        self.input_bar.set_status(prompt, "#e94560")
        self._play_prompt_feedback(
            prompt,
            tray_title="AT Assistant",
            on_done=self._start_wakeword_command_listen,
        )

    def _build_voice_followup_prompt(self, res: ActionResult) -> str:
        if res.status == ActionStatus.NEED_CONFIRM:
            return str(
                self._system_settings.get("wakeword_prompt_confirm")
                or "Bạn đang ở bước xác nhận. Hãy nói đồng ý hoặc hủy."
            ).strip()
        if res.status == ActionStatus.NEED_CHOICE:
            choices = list(res.data.get("choices", []) or [])
            custom_prompt = str(
                self._system_settings.get("wakeword_prompt_choice")
                or "Bạn đang ở bước lựa chọn. Hãy nói số thứ tự hoặc hủy."
            ).strip()
            if len(choices) <= 1:
                return custom_prompt
            return f"{custom_prompt} Có {len(choices)} phương án."
        if res.status == ActionStatus.NEED_CLARIFY:
            question = " ".join(str(res.data.get("question") or "").split()).strip()
            if question:
                return question
            return str(
                self._system_settings.get("wakeword_prompt_retry")
                or "Mình cần bạn nói rõ hơn. Hãy nói lại ngắn gọn."
            ).strip()
        return ""

    def _build_voice_retry_prompt(self) -> str:
        retry_prompt = str(
            self._system_settings.get("wakeword_prompt_retry")
            or "Mình chưa nghe rõ. Hãy nói lại."
        ).strip()
        if self._voice_session_mode == "confirm":
            return str(
                self._system_settings.get("wakeword_prompt_confirm")
                or "Bạn đang ở bước xác nhận. Hãy nói đồng ý hoặc hủy."
            ).strip()
        if self._voice_session_mode == "choice":
            return str(
                self._system_settings.get("wakeword_prompt_choice")
                or "Bạn đang ở bước lựa chọn. Hãy nói số thứ tự hoặc hủy."
            ).strip()
        return retry_prompt

    def _handle_voice_session_no_speech(self, message: str) -> bool:
        if not self._voice_session_active:
            return False
        max_retries = int(self._system_settings.get("voice_session_max_retries") or 0)
        if self._voice_session_retries >= max_retries:
            self.chat.add_system_message(message)
            wakeword_phrase = str(
                self._system_settings.get("wakeword_phrase") or "Hải ơi"
            ).strip()
            self.chat.add_system_message(
                f"Mình chưa nghe rõ. Tạm dừng phiên nói và quay về chờ {wakeword_phrase}."
            )
            self.input_bar.set_mic_state(False)
            self.input_bar.set_status("")
            self._apply_wakeword_cooldown("no_speech")
            return False
        self._voice_session_retries += 1
        self.chat.add_system_message(message)
        self._continue_voice_session(
            self._build_voice_retry_prompt(),
            mode=self._voice_session_mode,
            reset_retries=False,
        )
        return True

    def _resume_wakeword_after_voice(self) -> None:
        self._voice_session_active = False
        self._voice_session_mode = "command"
        self._voice_session_retries = 0
        self._wakeword_waiting_for_command = False
        self._wakeword_runtime.resume()

    def _set_wakeword_cooldown(self, seconds: float) -> None:
        self._wakeword_runtime.set_cooldown(seconds)

    def _apply_wakeword_cooldown(self, reason: str) -> None:
        defaults = {
            "success": float(
                self._system_settings.get("wakeword_cooldown_success_sec") or 2.5
            ),
            "no_speech": float(
                self._system_settings.get("wakeword_cooldown_no_speech_sec") or 1.0
            ),
            "cancel": float(
                self._system_settings.get("wakeword_cooldown_cancel_sec") or 1.2
            ),
        }
        self._set_wakeword_cooldown(defaults.get(reason, defaults["success"]))

    def _wakeword_can_listen(self) -> bool:
        if self._is_quitting:
            return False
        if not bool(self._system_settings.get("wakeword_enabled", True)):
            return False
        if self._voice_packages.is_speaking:
            return False
        if self._active_request_id is not None:
            return False
        if self._voice_runtime.is_busy():
            return False
        return True

    def _can_speak(self) -> bool:
        return bool(self._system_settings.get("speaker_enabled", True))

    def _speak_text(
        self,
        text: str,
        *,
        on_start=None,
        on_done=None,
        on_error=None,
    ) -> bool:
        if not self._can_speak():
            return False
        return self._voice_packages.speak_async(
            text,
            on_start=on_start,
            on_done=on_done,
            on_error=on_error,
        )

    def _play_wakeword_beep(self, *, on_done=None) -> bool:
        if not bool(self._system_settings.get("wakeword_beep_enabled", True)):
            return False
        if winsound is None:
            return False
        frequency = int(self._system_settings.get("wakeword_beep_frequency_hz") or 1046)
        duration = int(self._system_settings.get("wakeword_beep_duration_ms") or 90)

        def worker() -> None:
            try:
                winsound.Beep(max(120, frequency), max(20, duration))
            except Exception:
                pass
            if on_done:
                self._safe_after(0, on_done)

        threading.Thread(target=worker, daemon=True).start()
        return True

    def _play_prompt_feedback(
        self,
        prompt_text: str,
        *,
        tray_title: str,
        on_done,
    ) -> None:
        prompt = " ".join((prompt_text or "").split()).strip()
        if not prompt:
            self._safe_after(0, on_done)
            return
        self._notify_background_voice_activity(tray_title, prompt, timeout=4)

        def start_prompt() -> None:
            started_prompt = self._speak_text(
                prompt,
                on_start=lambda: self._safe_after(0, self.input_bar.show_stop_speech),
                on_done=lambda: self._safe_after(0, on_done),
            )
            if not started_prompt:
                self._safe_after(0, on_done)

        if not self._play_wakeword_beep(on_done=start_prompt):
            start_prompt()

    def _notify_background_voice_activity(
        self, title: str, message: str, *, timeout: int = 5
    ) -> None:
        if not (self._tray_active or not self.winfo_viewable()):
            return
        if self._tray_icon is None:
            self._ensure_tray_icon()
        if self._tray_icon is None:
            return
        clean_title = " ".join((title or "").split()).strip() or "AT Assistant"
        clean_message = " ".join((message or "").split()).strip()
        if not clean_message:
            return
        self._tray_icon.notify(clean_title[:63], clean_message[:255], timeout=timeout)

    def _pick_bulk_email_excel(self) -> None:
        initial_dir = executor.SAFE_DIRS[0] if executor.SAFE_DIRS else None
        file_path = filedialog.askopenfilename(
            title="Chọn file Excel danh sách ứng viên",
            initialdir=initial_dir,
            filetypes=[("Excel Workbook", "*.xlsx")],
        )
        if not file_path:
            return
        if not executor.is_safe_path(file_path):
            self.chat.add_bot_message(
                "Chỉ cho phép chọn file Excel trong thư mục an toàn.",
                style="error",
            )
            return
        self._on_send(f'gửi email theo file "{file_path}"')

    def _pick_custom_app_target(self, *, initial_path: str = "") -> str:
        initial_dir = None
        if initial_path:
            try:
                parent = Path(initial_path).expanduser().resolve().parent
                if parent.exists():
                    initial_dir = str(parent)
            except Exception:
                initial_dir = None
        if not initial_dir:
            try:
                desktop = Path.home() / "Desktop"
                if desktop.exists():
                    initial_dir = str(desktop)
            except Exception:
                initial_dir = None
        return filedialog.askopenfilename(
            title="Chọn ứng dụng để lưu",
            initialdir=initial_dir,
            filetypes=[
                ("Executable", "*.exe"),
                ("Windows Shortcut", "*.lnk"),
                ("Ứng dụng hợp lệ", "*.exe *.lnk"),
            ],
        )

    def _prompt_custom_app_selection(self, res: ActionResult) -> bool:
        alias = str(res.data.get("custom_app_alias") or "").strip()
        if not alias:
            return False
        chosen_path = self._pick_custom_app_target(
            initial_path=str(res.data.get("custom_app_target_path") or "")
        )
        if not chosen_path:
            self.chat.add_system_message(f"Đã hủy chọn ứng dụng cho alias '{alias}'.")
            return True

        suffix = Path(chosen_path).suffix.lower()
        if suffix not in {".exe", ".lnk"}:
            self.chat.add_bot_message(
                "Chỉ hỗ trợ chọn file .exe hoặc .lnk.", style="error"
            )
            return True

        service = CustomAppService()
        display_name = (
            str(
                res.data.get("custom_app_display_name") or Path(chosen_path).stem
            ).strip()
            or Path(chosen_path).stem
        )
        extra_aliases = [Path(chosen_path).stem]
        try:
            record = service.save_app(
                alias=alias,
                target_path=chosen_path,
                display_name=display_name,
                extra_aliases=extra_aliases,
            )
        except Exception as exc:
            self.chat.add_bot_message(
                f"Không thể lưu app đã chọn: {exc}", style="error"
            )
            return True

        self.chat.add_system_message(
            f"Đã lưu alias '{record['alias']}' -> {record['target_path']}"
        )
        rerun = executor.open_app(alias)
        style = "success" if rerun.status == ActionStatus.SUCCESS else "error"
        self.chat.add_bot_message(rerun.message, style=style)
        return True

    def _open_drive_manager(self) -> None:
        if (
            self._drive_manager_dialog is not None
            and self._drive_manager_dialog.winfo_exists()
        ):
            self._drive_manager_dialog.focus()
            self._drive_manager_dialog.lift()
            return
        dialog = DriveManagerDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
        )
        dialog.bind("<Destroy>", self._on_drive_manager_dialog_destroy, add="+")
        self._drive_manager_dialog = dialog
        dialog.lift()
        dialog.focus_force()

    def _on_drive_manager_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._drive_manager_dialog:
            self._drive_manager_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_send_email_dialog(self) -> None:
        if (
            self._send_email_dialog is not None
            and self._send_email_dialog.winfo_exists()
        ):
            self._send_email_dialog.focus()
            self._send_email_dialog.lift()
            return
        dialog = SendEmailDialog(
            self,
            palette=self._palette,
            on_submit=self._submit_send_email_form,
            on_auth_changed=self._refresh_gmail_status,
        )
        dialog.bind("<Destroy>", self._on_send_email_dialog_destroy, add="+")
        self._send_email_dialog = dialog

    def _on_send_email_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._send_email_dialog:
            self._send_email_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_reminder_dialog(self) -> None:
        if self._active_request_id is not None:
            self.chat.add_system_message(
                "Đang có một yêu cầu khác chạy. Hãy đợi xong rồi tạo reminder."
            )
            return
        if self._reminder_dialog is not None and self._reminder_dialog.winfo_exists():
            self._reminder_dialog.focus()
            self._reminder_dialog.lift()
            return
        dialog = ReminderDialog(
            self,
            palette=self._palette,
            on_submit=self._submit_reminder_form,
        )
        dialog.bind("<Destroy>", self._on_reminder_dialog_destroy, add="+")
        self._reminder_dialog = dialog
        dialog.lift()
        dialog.focus_force()

    def _on_reminder_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._reminder_dialog:
            self._reminder_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_workflow_dialog(self) -> None:
        if self._workflow_dialog is not None and self._workflow_dialog.winfo_exists():
            self._workflow_dialog.focus()
            self._workflow_dialog.lift()
            return
        dialog = WorkflowDialog(
            self,
            palette=self._palette,
            on_run=self._run_workflow_from_dialog,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
        )
        dialog.bind("<Destroy>", self._on_workflow_dialog_destroy, add="+")
        self._workflow_dialog = dialog

    def _on_workflow_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._workflow_dialog:
            self._workflow_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_email_auto_check_dialog(self) -> None:
        if (
            self._email_auto_check_dialog is not None
            and self._email_auto_check_dialog.winfo_exists()
        ):
            self._email_auto_check_dialog.focus()
            self._email_auto_check_dialog.lift()
            return
        dialog = EmailAutoCheckDialog(
            self,
            palette=self._palette,
            on_run=self._run_email_auto_check_from_dialog,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
        )
        dialog.bind("<Destroy>", self._on_email_auto_check_dialog_destroy, add="+")
        self._email_auto_check_dialog = dialog

    def _on_email_auto_check_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._email_auto_check_dialog:
            self._email_auto_check_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_startup_dialog(self) -> None:
        if self._startup_dialog is not None and self._startup_dialog.winfo_exists():
            self._startup_dialog.focus()
            self._startup_dialog.lift()
            return
        dialog = StartupDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
        )
        dialog.bind("<Destroy>", self._on_startup_dialog_destroy, add="+")
        self._startup_dialog = dialog

    def _on_startup_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._startup_dialog:
            self._startup_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _open_uninstall_dialog(self) -> None:
        if (
            self._uninstall_dialog is not None
            and self._uninstall_dialog.winfo_exists()
        ):
            self._uninstall_dialog.focus()
            self._uninstall_dialog.lift()
            return
        dialog = UninstallDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
            on_complete=self._complete_uninstall,
        )
        dialog.bind("<Destroy>", self._on_uninstall_dialog_destroy, add="+")
        self._uninstall_dialog = dialog

    def _on_uninstall_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._uninstall_dialog:
            self._uninstall_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _complete_uninstall(self, result: dict | None = None) -> None:
        self._return_to_settings_hub = False
        self._handle_close_window()

    def _open_factory_reset_dialog(self) -> None:
        if (
            self._factory_reset_dialog is not None
            and self._factory_reset_dialog.winfo_exists()
        ):
            self._factory_reset_dialog.focus()
            self._factory_reset_dialog.lift()
            return
        dialog = FactoryResetDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
            on_complete=self._complete_factory_reset,
        )
        dialog.bind("<Destroy>", self._on_factory_reset_dialog_destroy, add="+")
        self._factory_reset_dialog = dialog

    def _on_factory_reset_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._factory_reset_dialog:
            self._factory_reset_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _complete_factory_reset(self, result: dict | None = None) -> None:
        self._return_to_settings_hub = False
        self._handle_close_window()

    def _open_system_settings_dialog(self) -> None:
        if (
            self._system_settings_dialog is not None
            and self._system_settings_dialog.winfo_exists()
        ):
            self._system_settings_dialog.focus()
            self._system_settings_dialog.lift()
            return
        dialog = SystemSettingsDialog(
            self,
            palette=self._palette,
            settings=self._system_settings,
            module_sections=self._build_system_settings_hub_sections(),
            on_open_module=self._open_settings_module_from_hub,
            on_save=self._save_system_settings,
        )
        dialog.bind("<Destroy>", self._on_system_settings_dialog_destroy, add="+")
        self._system_settings_dialog = dialog

    def _on_system_settings_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._system_settings_dialog:
            self._system_settings_dialog = None

    def _save_system_settings(self, payload: dict) -> None:
        self._system_settings = self._settings_store.save(payload)
        self._apply_system_settings()
        if not bool(self._system_settings.get("speaker_enabled", True)):
            self._on_stop_speech()
        self.chat.add_system_message("Đã lưu cài đặt hệ thống.")

    def _open_settings_module_from_hub(self, command) -> None:
        if not callable(command):
            return
        self._return_to_settings_hub = True
        self.after(0, command)

    def _maybe_reopen_system_settings_hub(self) -> None:
        if self._is_quitting:
            return
        if not self._return_to_settings_hub:
            return
        self._return_to_settings_hub = False
        self._safe_after(0, self._open_system_settings_dialog)

    def _get_gmail_hub_summary(self) -> str:
        status_text = ""
        if hasattr(self, "gmail_status_label"):
            status_text = str(self.gmail_status_label.cget("text") or "").strip()
        return status_text or "Gmail: chưa kết nối"

    def _get_drive_hub_summary(self) -> str:
        try:
            drive_service = GoogleDriveService()
            active_email = str(drive_service.get_active_account() or "").strip().lower()
            accounts = drive_service.list_connected_accounts()
        except Exception:
            return "Google Drive: chưa kết nối"
        count = len(accounts)
        if active_email and count > 1:
            return f"Google Drive đang dùng: {active_email} | {count} tài khoản"
        if active_email:
            return f"Google Drive đang dùng: {active_email}"
        if count:
            return f"Google Drive đã kết nối {count} tài khoản"
        return "Google Drive: chưa kết nối"

    def _get_wakeword_hub_summary(self) -> str:
        enabled = bool(self._system_settings.get("wakeword_enabled", True))
        phrase = str(self._system_settings.get("wakeword_phrase") or "Hải ơi").strip()
        if not enabled:
            return f"Wakeword đang tắt | cụm hiện tại: {phrase}"
        if self._voice_package_status and not self._voice_package_status.control_ready:
            return f"Wakeword bật nhưng gói nhận lệnh offline chưa sẵn sàng | cụm: {phrase}"
        if self._wakeword_runtime.is_running():
            return f"Wakeword đang bật | cụm hiện tại: {phrase}"
        return f"Wakeword đã bật nhưng runtime chưa khởi chạy | cụm: {phrase}"

    def _get_voice_package_hub_summary(self) -> str:
        status = self._voice_package_status or self._voice_packages.refresh_status()
        if status.speech_ready and status.control_ready:
            return "Voice package đã sẵn sàng cho cả đọc và nhận lệnh offline"
        missing = []
        if not status.speech_ready:
            missing.append("đọc giọng nói")
        if not status.control_ready:
            missing.append("nhận lệnh")
        if not missing:
            return "Voice package đang kiểm tra trạng thái"
        return "Voice package chưa sẵn sàng: thiếu " + " và ".join(missing)

    def _get_startup_hub_summary(self) -> str:
        try:
            status = self._startup_service.get_status()
        except Exception:
            return "Startup cùng Windows: không đọc được trạng thái"
        if status.get("enabled"):
            return "Startup cùng Windows đang bật"
        return "Startup cùng Windows đang tắt"

    def _get_uninstall_hub_summary(self) -> str:
        return "Tắt startup, xóa dữ liệu và gỡ file exe khi chạy bản đã build"

    def _get_factory_reset_hub_summary(self) -> str:
        return "Xóa dữ liệu và khôi phục cài đặt gốc!"

    def _get_pin_hub_summary(self) -> str:
        if self._pin_service.is_pin_set():
            return "PIN đang bật — app sẽ yêu cầu xác thực khi khởi động"
        return "Chưa đặt PIN — app mở không cần xác thực"

    def _open_pin_manage_dialog(self) -> None:
        if (
            self._pin_manage_dialog is not None
            and self._pin_manage_dialog.winfo_exists()
        ):
            self._pin_manage_dialog.focus()
            self._pin_manage_dialog.lift()
            return
        dialog = PinManageDialog(
            self,
            palette=self._palette,
            on_message=lambda msg, _kind: self.chat.add_system_message(msg),
        )
        dialog.bind(
            "<Destroy>",
            lambda _e: setattr(self, "_pin_manage_dialog", None),
            add="+",
        )
        self._pin_manage_dialog = dialog

    def _get_custom_apps_hub_summary(self) -> str:
        try:
            apps = CustomAppService().list_apps()
        except Exception:
            return "Ứng dụng đã lưu: không đọc được dữ liệu"
        count = len(apps)
        if count == 0:
            return "Ứng dụng đã lưu: chưa có mục nào"
        return f"Ứng dụng đã lưu: {count} mục"

    def _get_reminder_hub_summary(self) -> str:
        try:
            pending = self._reminder_service.list_reminders(status="pending")
        except Exception:
            return "Reminder: không đọc được dữ liệu"
        count = len(pending)
        if count == 0:
            return "Reminder: không có việc đang chờ"
        return f"Reminder đang chờ: {count}"

    def _get_workflow_hub_summary(self) -> str:
        try:
            workflows = self._workflow_service.list_workflows()
        except Exception:
            return "Workflow: không đọc được dữ liệu"
        count = len(workflows)
        enabled_count = sum(1 for item in workflows if bool(item.get("enabled", True)))
        if count == 0:
            return "Workflow: chưa có kịch bản nào"
        return f"Workflow: {enabled_count}/{count} đang bật"

    def _get_email_auto_check_hub_summary(self) -> str:
        try:
            checks = self._email_auto_check_service.list_checks()
        except Exception:
            return "Auto-check mail: không đọc được dữ liệu"
        count = len(checks)
        enabled_count = sum(1 for item in checks if bool(item.get("enabled", True)))
        if count == 0:
            return "Auto-check mail: chưa có cấu hình nào"
        return f"Auto-check mail: {enabled_count}/{count} đang bật"

    def _get_telegram_bot_hub_summary(self) -> str:
        try:
            settings = TelegramSettingsStore().load()
        except Exception:
            return "Telegram bot: không đọc được cấu hình"
        bot_name = str(settings.get("bot_name") or "").strip()
        has_token = bool(str(settings.get("bot_token") or "").strip())
        has_user_ids = bool(str(settings.get("allowed_user_ids") or "").strip())
        has_chat_ids = bool(str(settings.get("allowed_chat_ids") or "").strip())
        if not has_token:
            return "Telegram bot: chưa cấu hình token"
        if not has_user_ids or not has_chat_ids:
            return "Telegram bot: thiếu allowlist user/chat"
        return f"Telegram bot: {bot_name or 'đã cấu hình'}"

    def _get_mobile_remote_hub_summary(self) -> str:
        try:
            snapshot = self._mobile_remote_bridge.snapshot()
        except Exception:
            return "Kết nối điện thoại: chưa sẵn sàng"
        if not snapshot.get("running"):
            return "Kết nối điện thoại: đang tắt"
        count = len(snapshot.get("devices") or [])
        return f"Kết nối điện thoại: đang bật, {count} thiết bị"

    def _build_system_settings_hub_sections(self) -> list[dict]:
        return [
            {
                "title": "Tài khoản & tích hợp",
                "description": "Các kết nối bên ngoài và luồng cần cấu hình tài khoản hoặc dữ liệu tích hợp.",
                "items": [
                    {
                        "title": "Gmail & gửi email",
                        "summary": self._get_gmail_hub_summary(),
                        "button_text": "Mở email",
                        "command": self._open_send_email_dialog,
                    },
                    {
                        "title": "Google Drive",
                        "summary": self._get_drive_hub_summary(),
                        "button_text": "Quản lý Drive",
                        "command": self._open_drive_manager,
                    },
                    {
                        "title": "Telegram Bot Bridge",
                        "summary": self._get_telegram_bot_hub_summary(),
                        "button_text": "Cấu hình Telegram",
                        "command": self._open_telegram_bot_dialog,
                    },
                ],
            },
            {
                "title": "Tự động hóa & công việc",
                "description": "Các luồng nhắc việc, workflow và những tác vụ chạy lặp theo lịch.",
                "items": [
                    {
                        "title": "Reminder",
                        "summary": self._get_reminder_hub_summary(),
                        "button_text": "Mở reminder",
                        "command": self._open_reminder_dialog,
                    },
                    {
                        "title": "Workflow",
                        "summary": self._get_workflow_hub_summary(),
                        "button_text": "Mở workflow",
                        "command": self._open_workflow_dialog,
                    },
                    {
                        "title": "Kiểm tra mail tự động",
                        "summary": self._get_email_auto_check_hub_summary(),
                        "button_text": "Mở auto-check",
                        "command": self._open_email_auto_check_dialog,
                    },
                ],
            },
            {
                "title": "Thiết bị & ứng dụng",
                "description": "Những thành phần gắn với máy hiện tại như voice offline, startup và app tùy chỉnh.",
                "items": [
                    {
                        "title": "Kết nối điện thoại",
                        "summary": self._get_mobile_remote_hub_summary(),
                        "button_text": "Mở kết nối",
                        "command": self._open_mobile_remote_dialog,
                    },
                    {
                        "title": "Gói giọng nói offline",
                        "summary": self._get_voice_package_hub_summary(),
                        "button_text": "Mở voice package",
                        "command": self._open_voice_package_manager,
                    },
                    {
                        "title": "Ứng dụng đã lưu",
                        "summary": self._get_custom_apps_hub_summary(),
                        "button_text": "Mở custom apps",
                        "command": self._open_custom_apps_dialog,
                    },
                    {
                        "title": "Khởi động cùng Windows",
                        "summary": self._get_startup_hub_summary(),
                        "button_text": "Mở startup",
                        "command": self._open_startup_dialog,
                    },
                    {
                        "title": "Wakeword & voice session",
                        "summary": self._get_wakeword_hub_summary(),
                        "button_text": "Đang mở",
                        "command": None,
                    },
                    {
                        "title": "Gỡ cài đặt AT Assistant",
                        "title": "Khôi phục cài đặt gốc",
                        "summary": self._get_factory_reset_hub_summary(),
                        "button_text": "Khôi phục",
                        "command": self._open_factory_reset_dialog,
                        "danger": True,
                    },
                    {
                        "title": "Khôi phục cài đặt gốc",
                        "title": "Gỡ cài đặt AT Assistant",
                        "summary": self._get_uninstall_hub_summary(),
                        "button_text": "Gỡ cài đặt",
                        "command": self._open_uninstall_dialog,
                        "danger": True,
                    },
                ],
            },
            {
                "title": "Bảo mật",
                "description": "Quản lý PIN xác thực khi khởi động ứng dụng.",
                "items": [
                    {
                        "title": "PIN khởi động",
                        "summary": self._get_pin_hub_summary(),
                        "button_text": "Quản lý PIN",
                        "command": self._open_pin_manage_dialog,
                    },
                ],
            },
        ]

    def _open_custom_apps_dialog(self) -> None:
        if (
            self._custom_apps_dialog is not None
            and self._custom_apps_dialog.winfo_exists()
        ):
            self._custom_apps_dialog.focus()
            self._custom_apps_dialog.lift()
            return
        dialog = CustomAppsDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
        )
        dialog.bind("<Destroy>", self._on_custom_apps_dialog_destroy, add="+")
        self._custom_apps_dialog = dialog

    def _open_telegram_bot_dialog(self) -> None:
        if (
            self._telegram_bot_dialog is not None
            and self._telegram_bot_dialog.winfo_exists()
        ):
            self._telegram_bot_dialog.focus()
            self._telegram_bot_dialog.lift()
            return
        dialog = TelegramBotDialog(
            self,
            palette=self._palette,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
            on_saved=self._restart_telegram_bridge_from_settings,
        )
        dialog.bind("<Destroy>", self._on_telegram_bot_dialog_destroy, add="+")
        self._telegram_bot_dialog = dialog

    def _open_mobile_remote_dialog(self) -> None:
        if (
            self._mobile_remote_dialog is not None
            and self._mobile_remote_dialog.winfo_exists()
        ):
            self._mobile_remote_dialog.focus()
            self._mobile_remote_dialog.lift()
            return
        dialog = MobileRemoteDialog(
            self,
            palette=self._palette,
            bridge=self._mobile_remote_bridge,
            on_message=lambda message, style="normal": self.chat.add_bot_message(
                message, style=style
            ),
            on_changed=self._refresh_mobile_remote_settings_hub,
        )
        dialog.bind("<Destroy>", self._on_mobile_remote_dialog_destroy, add="+")
        self._mobile_remote_dialog = dialog

    def _on_mobile_remote_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._mobile_remote_dialog:
            self._mobile_remote_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _refresh_mobile_remote_settings_hub(self) -> None:
        if (
            self._system_settings_dialog is not None
            and self._system_settings_dialog.winfo_exists()
        ):
            return

    def _on_telegram_bot_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._telegram_bot_dialog:
            self._telegram_bot_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _telegram_config_key(self, config: TelegramBotConfig) -> str:
        users = ",".join(str(item) for item in sorted(config.allowed_user_ids))
        chats = ",".join(str(item) for item in sorted(config.allowed_chat_ids))
        return f"{config.token}|{users}|{chats}|{config.command_prefix}|{config.poll_timeout}"

    def _start_telegram_bridge_from_settings(self) -> None:
        if self._is_quitting:
            return
        config = TelegramBotConfig.from_env()
        if not config.token or not config.allowed_user_ids or not config.allowed_chat_ids:
            return
        config_key = self._telegram_config_key(config)
        if (
            self._telegram_bridge_thread is not None
            and self._telegram_bridge_thread.is_alive()
            and self._telegram_bridge_config_key == config_key
        ):
            return

        self._stop_telegram_bridge()
        stop_event = threading.Event()
        bridge_config = TelegramBotConfig(
            bot_name=config.bot_name,
            token=config.token,
            allowed_user_ids=set(config.allowed_user_ids),
            allowed_chat_ids=set(config.allowed_chat_ids),
            command_prefix=config.command_prefix,
            poll_timeout=min(max(1, int(config.poll_timeout or 5)), 5),
        )

        def worker() -> None:
            try:
                TelegramBotBridge(
                    bridge_config,
                    engine=self.engine,
                    on_user_message=self._mirror_telegram_user_message,
                    on_result=self._mirror_telegram_result,
                ).run_until_stopped(stop_event)
            except Exception as exc:
                error_name = exc.__class__.__name__
                self._safe_after(
                    0,
                    lambda: self.chat.add_bot_message(
                        f"Telegram bridge lỗi: {error_name}", style="error"
                    ),
                )

        self._telegram_bridge_stop = stop_event
        self._telegram_bridge_config_key = config_key
        self._telegram_bridge_thread = threading.Thread(target=worker, daemon=True)
        self._telegram_bridge_thread.start()
        self.chat.add_system_message(
            f"Telegram bridge đang chạy nền. Dùng {config.command_prefix} <lệnh> trong chat/group đã allowlist."
        )

    def _mirror_telegram_user_message(self, command: str, chat_id: int, user_id: int) -> None:
        def append() -> None:
            self._ensure_active_chat_session()
            self.chat.add_user_message(f"Telegram user {user_id} / chat {chat_id}: {command}")
            self._persist_current_chat_session()
            self._reload_chat_session_list()

        self._safe_after(0, append)

    def _mirror_telegram_result(self, result: ActionResult, chat_id: int) -> None:
        def append() -> None:
            self._ensure_active_chat_session()
            message = format_result_for_telegram(result, TelegramBotConfig.from_env().command_prefix)
            message = self._sanitize_user_message(message)
            if result.status == ActionStatus.ERROR:
                self.chat.add_bot_message(message, style="error")
            elif result.status == ActionStatus.SUCCESS:
                self.chat.add_bot_message(message, style="success")
            else:
                self.chat.add_bot_message(message)
            self._show_email_data(result)
            self._persist_current_chat_session()
            self._reload_chat_session_list()

        self._safe_after(0, append)

    def _send_telegram_document_from_desktop(self, result: ActionResult) -> None:
        if not isinstance(result.data, dict):
            return
        document_path = str(result.data.get("telegram_document_path") or "").strip()
        if not document_path:
            return
        path = Path(document_path)
        if not path.exists() or not path.is_file():
            self.chat.add_bot_message("Không tìm thấy file để gửi qua Telegram.", style="error")
            return

        config = TelegramBotConfig.from_env()
        if not config.token or not config.allowed_chat_ids:
            self.chat.add_bot_message(
                "Chưa cấu hình Telegram token hoặc chat/group được phép để gửi file.",
                style="error",
            )
            return

        caption_result = ActionResult.ok(
            result.message or f"Gửi file: {path.name}",
            telegram_document_path=str(path),
        )

        def worker() -> None:
            sent: list[int] = []
            failures: list[str] = []
            bridge = TelegramBotBridge(config, engine=self.engine)
            for chat_id in sorted(config.allowed_chat_ids):
                try:
                    bridge.send_result(chat_id, caption_result)
                    sent.append(chat_id)
                except Exception as exc:
                    failures.append(f"{chat_id}: {exc.__class__.__name__}")

            def append_status() -> None:
                if sent:
                    self.chat.add_system_message(
                        f"Đã gửi file qua Telegram tới {len(sent)} chat/group."
                    )
                if failures:
                    self.chat.add_bot_message(
                        "Không gửi được file qua Telegram tới: " + ", ".join(failures),
                        style="error",
                    )
                self._persist_current_chat_session()
                self._reload_chat_session_list()

            self._safe_after(0, append_status)

        threading.Thread(target=worker, daemon=True).start()

    def _restart_telegram_bridge_from_settings(self) -> None:
        self._stop_telegram_bridge()
        self._safe_after(0, self._start_telegram_bridge_from_settings)

    def _stop_telegram_bridge(self) -> None:
        if self._telegram_bridge_stop is not None:
            self._telegram_bridge_stop.set()
        self._telegram_bridge_stop = None
        self._telegram_bridge_thread = None
        self._telegram_bridge_config_key = ""

    def _start_mobile_remote_from_settings(self) -> None:
        if self._is_quitting:
            return
        try:
            settings = MobileRemoteSettingsStore().load()
        except Exception:
            return
        if not bool(settings.get("enabled", False)):
            return
        try:
            self._mobile_remote_bridge.start(
                host=str(settings.get("host") or "0.0.0.0"),
                port=int(settings.get("port") or 8765),
            )
        except Exception as exc:
            self.chat.add_bot_message(
                f"Không bật được kết nối điện thoại: {exc}", style="error"
            )

    def _stop_mobile_remote_bridge(self) -> None:
        try:
            self._mobile_remote_bridge.stop()
        except Exception:
            pass

    def _handle_mobile_remote_event(self, event: str, payload: dict) -> None:
        def append() -> None:
            if event == "started":
                urls = payload.get("urls") or []
                url_text = str(urls[0]) if urls else ""
                self.chat.add_system_message(
                    f"Kết nối điện thoại đang bật. Mở AT Remote trên điện thoại: {url_text}"
                )
            elif event == "pair_requested":
                name = payload.get("deviceName") or "Điện thoại"
                self.chat.add_system_message(
                    f"{name} đang chờ xác nhận trong Kết nối điện thoại."
                )
            elif event == "pair_approved":
                self.chat.add_system_message(
                    f"Đã kết nối điện thoại: {payload.get('name') or 'Thiết bị'}."
                )

        self._safe_after(0, append)

    def _on_custom_apps_dialog_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._custom_apps_dialog:
            self._custom_apps_dialog = None
            self._maybe_reopen_system_settings_hub()

    def _run_workflow_from_dialog(self, workflow_ref: str) -> None:
        if self._active_request_id is not None:
            self.chat.add_system_message(
                "Đang có một yêu cầu khác chạy. Hãy đợi xong rồi chạy workflow."
            )
            return
        self._submit_request(f"chạy workflow {workflow_ref}", source="workflow")

    def _run_email_auto_check_from_dialog(self, check_ref: str) -> None:
        check = self._email_auto_check_service.find_check(check_ref)
        if not check:
            self.chat.add_bot_message(
                "Không tìm thấy cấu hình kiểm tra mail tự động để chạy.", style="error"
            )
            return
        check_id = str(check.get("id") or "").strip()
        if not check_id:
            self.chat.add_bot_message(
                "Cấu hình kiểm tra mail tự động không hợp lệ.", style="error"
            )
            return
        if check_id in self._running_scheduled_email_checks:
            self.chat.add_system_message(
                "Cấu hình mail này đang chạy. Hãy đợi lượt hiện tại xong."
            )
            return
        self._running_scheduled_email_checks.add(check_id)
        self.chat.add_system_message(
            f"Kiểm tra mail tự động đang chạy: {check.get('name') or check_id}"
        )
        threading.Thread(
            target=self._run_email_auto_check_worker,
            args=(check_id, "manual"),
            daemon=True,
        ).start()

    def _poll_internal_scheduled_tasks(self) -> None:
        self._refresh_upcoming_tasks_panel()
        self._collect_due_scheduled_email_checks()
        self._collect_due_scheduled_workflows()
        self._collect_due_reminders()
        self._dispatch_next_internal_scheduled_task()
        self._safe_after(1000, self._poll_internal_scheduled_tasks)

    def _enqueue_internal_scheduled_task(
        self, *, kind: str, task_id: str, priority: int, payload: dict | None = None
    ) -> bool:
        payload = payload or {}
        return self._scheduled_task_queue.enqueue(
            ScheduledTask(
                kind=kind,
                task_id=task_id,
                priority=priority,
                payload=payload,
            )
        )

    def _dispatch_next_internal_scheduled_task(self) -> None:
        task = self._scheduled_task_queue.pop_next()
        if task is None:
            return

        if task.kind == "email":
            check_id = task.task_id
            check_name = str(task.payload.get("name") or check_id)
            self.chat.add_system_message(
                f"Kiểm tra mail tự động theo lịch đang chạy: {check_name}"
            )
            threading.Thread(
                target=self._run_email_auto_check_worker,
                args=(check_id, "scheduled"),
                daemon=True,
            ).start()
            return

        if task.kind == "workflow":
            workflow_id = task.task_id
            workflow_name = str(task.payload.get("name") or workflow_id)
            self.chat.add_system_message(
                f"Workflow theo lịch đang chạy: {workflow_name}"
            )
            threading.Thread(
                target=self._run_scheduled_workflow_worker,
                args=(workflow_id,),
                daemon=True,
            ).start()
            return

        if task.kind == "reminder":
            reminder = (
                task.payload.get("reminder") if isinstance(task.payload, dict) else None
            )
            if isinstance(reminder, dict):
                self._enqueue_due_reminders([reminder])
                self._dispatch_next_due_reminder()
            self._scheduled_task_queue.complete_active(task.key)
            self._safe_after(50, self._dispatch_next_internal_scheduled_task)
            return

        self._scheduled_task_queue.complete_active(task.key)
        self._safe_after(0, self._dispatch_next_internal_scheduled_task)

    def _collect_due_scheduled_workflows(self) -> None:
        try:
            due_workflows = self._workflow_service.list_due_scheduled_workflows()
        except Exception:
            due_workflows = []

        for workflow in due_workflows:
            workflow_id = str(workflow.get("id") or "").strip()
            if not workflow_id or workflow_id in self._running_scheduled_workflows:
                continue
            try:
                updated = self._workflow_service.mark_workflow_scheduled_run(
                    workflow_id
                )
            except Exception:
                continue
            self._running_scheduled_workflows.add(workflow_id)
            self._enqueue_internal_scheduled_task(
                kind="workflow",
                task_id=workflow_id,
                priority=20,
                payload={"name": str(updated.get("name") or workflow_id)},
            )

    def _run_scheduled_workflow_worker(self, workflow_id: str) -> None:
        result = executor._handle_run_workflow(workflow_id)
        self._safe_after(
            0, lambda: self._handle_scheduled_workflow_result(workflow_id, result)
        )

    def _handle_scheduled_workflow_result(
        self, workflow_id: str, result: ActionResult
    ) -> None:
        self._running_scheduled_workflows.discard(workflow_id)
        self._scheduled_task_queue.complete_active(f"workflow:{workflow_id}")
        workflow = (result.data or {}).get("workflow") or {}
        workflow_name = str(workflow.get("name") or workflow_id)
        if result.status == ActionStatus.SUCCESS:
            self.chat.add_bot_message(
                f"[Lịch chạy] {workflow_name}\n{result.message}", style="success"
            )
        else:
            self.chat.add_bot_message(
                f"[Lịch chạy] {workflow_name}\n{result.message}", style="error"
            )
        self._safe_after(50, self._dispatch_next_internal_scheduled_task)

    def _collect_due_scheduled_email_checks(self) -> None:
        try:
            due_checks = self._email_auto_check_service.list_due_scheduled_checks()
        except Exception:
            due_checks = []

        for check in due_checks:
            check_id = str(check.get("id") or "").strip()
            if not check_id or check_id in self._running_scheduled_email_checks:
                continue
            try:
                updated = self._email_auto_check_service.mark_check_scheduled_run(
                    check_id
                )
            except Exception:
                continue
            self._running_scheduled_email_checks.add(check_id)
            self._enqueue_internal_scheduled_task(
                kind="email",
                task_id=check_id,
                priority=10,
                payload={"name": str(updated.get("name") or check_id)},
            )

    def _run_email_auto_check_worker(self, check_id: str, trigger: str) -> None:
        try:
            payload = self._execute_email_auto_check(check_id, trigger=trigger)
        except Exception as exc:
            payload = {
                "check_id": check_id,
                "trigger": trigger,
                "messages": [f"Lỗi khi chạy kiểm tra mail tự động: {exc}"],
                "styles": ["error"],
                "notifications": [],
                "speech_texts": [],
            }
        self._safe_after(0, lambda: self._handle_email_auto_check_result(payload))

    def _execute_email_auto_check(self, check_id: str, *, trigger: str) -> dict:
        check = self._email_auto_check_service.get_check(check_id)
        if not check:
            raise FileNotFoundError("Không tìm thấy cấu hình kiểm tra mail tự động.")

        query = check.get("query") or {}
        delivery = check.get("delivery") or {}
        run_policy = check.get("run_policy") or {}
        state = check.get("state") or {}
        seen_ids = [
            str(item).strip()
            for item in list(state.get("last_seen_message_ids") or [])
            if str(item).strip()
        ]
        seen_set = set(seen_ids)
        current_seen = list(seen_ids)
        messages: list[str] = []
        styles: list[str] = []
        notifications: list[tuple[str, str]] = []
        speech_texts: list[str] = []
        result_payloads: list[ActionResult] = []

        try:
            start_delay = float(run_policy.get("start_delay_seconds") or 0)
        except (TypeError, ValueError):
            start_delay = 0.0
        if start_delay > 0:
            threading.Event().wait(start_delay)

        total_cycles = (
            int(run_policy.get("repeat_count") or 1)
            if run_policy.get("mode") == "repeat" and trigger != "scheduled"
            else 1
        )
        repeat_interval = (
            float(run_policy.get("repeat_interval_seconds") or 0)
            if total_cycles > 1
            else 0.0
        )
        last_run_at = datetime.now()

        for cycle_index in range(total_cycles):
            result = executor._handle_check_email(
                mode=str(query.get("mode") or "unread:today"),
                limit=int(query.get("limit") or 10),
            )
            payload = result.data if isinstance(result.data, dict) else {}
            json_payload = (
                payload.get("json")
                if isinstance(payload.get("json"), dict)
                else payload.get("json") or {}
            )
            if not isinstance(json_payload, dict):
                json_payload = {}
            mails = list(json_payload.get("data") or [])
            current_ids = [
                str(item.get("id") or "").strip()
                for item in mails
                if str(item.get("id") or "").strip()
            ]
            new_ids = [mail_id for mail_id in current_ids if mail_id not in seen_set]
            new_mails = [
                item
                for item in mails
                if str(item.get("id") or "").strip() in set(new_ids)
            ]
            for mail_id in current_ids:
                if mail_id not in seen_set:
                    seen_set.add(mail_id)
                    current_seen.append(mail_id)
            if len(current_seen) > 200:
                current_seen = current_seen[-200:]
                seen_set = set(current_seen)

            new_count = len(new_ids)
            should_suppress = (
                trigger == "scheduled"
                and bool(delivery.get("only_if_has_new_mail", True))
                and new_count == 0
            )
            prefix = "[Kiểm tra mail tự động]"
            if trigger == "scheduled":
                prefix = "[Kiểm tra mail tự động theo lịch]"
            elif total_cycles > 1:
                prefix = f"[Kiểm tra mail tự động {cycle_index + 1}/{total_cycles}]"

            if result.status == ActionStatus.SUCCESS:
                if not should_suppress:
                    result_payloads.append(result)
                    summary_suffix = ""
                    if mails:
                        summary_suffix = (
                            f"\nMail mới: {new_count} / Tổng lấy về: {len(mails)}"
                        )
                    elif trigger != "scheduled":
                        summary_suffix = "\nKhông có mail nào trong lượt này."
                    messages.append(
                        f"{prefix} {check.get('name')}\n{result.message}{summary_suffix}"
                    )
                    styles.append("success")
                    if bool(delivery.get("show_notification", True)) and (
                        new_count > 0
                        or not bool(delivery.get("only_if_has_new_mail", True))
                    ):
                        title = "Mail mới" if new_count > 0 else "Kiểm tra mail"
                        body = (
                            f"{check.get('name')}: {new_count} mail mới."
                            if new_count > 0
                            else f"{check.get('name')}: không có mail mới."
                        )
                        notifications.append((title, body))
                    if bool(delivery.get("speak_summary", False)) and new_count > 0:
                        speech_texts.append(
                            self._build_email_auto_check_speech_text(
                                check_name=str(check.get("name") or check_id),
                                new_mails=new_mails,
                                voice_detail_mode=str(
                                    delivery.get("voice_detail_mode") or "first_title"
                                ),
                            )
                        )
                elif trigger != "scheduled":
                    messages.append(f"{prefix} {check.get('name')}\nKhông có mail mới.")
                    styles.append("normal")
            else:
                messages.append(f"{prefix} {check.get('name')}\n{result.message}")
                styles.append("error")
                if bool(delivery.get("show_notification", True)):
                    notifications.append(
                        ("Lỗi kiểm tra mail", f"{check.get('name')}: {result.message}")
                    )

            if (
                total_cycles > 1
                and cycle_index < total_cycles - 1
                and repeat_interval > 0
            ):
                threading.Event().wait(repeat_interval)
            last_run_at = datetime.now()

        self._email_auto_check_service.update_runtime_state(
            check_id,
            last_run_at=last_run_at,
            last_seen_message_ids=current_seen,
        )
        return {
            "check_id": check_id,
            "trigger": trigger,
            "check_name": str(check.get("name") or check_id),
            "messages": messages,
            "styles": styles,
            "notifications": notifications,
            "speech_texts": speech_texts,
            "delivery": delivery,
            "results": result_payloads,
        }

    def _handle_email_auto_check_result(self, payload: dict) -> None:
        check_id = str(payload.get("check_id") or "").strip()
        if check_id:
            self._running_scheduled_email_checks.discard(check_id)
            if str(payload.get("trigger") or "").strip().lower() == "scheduled":
                self._scheduled_task_queue.complete_active(f"email:{check_id}")

        delivery = payload.get("delivery") or {}
        show_chat = bool(delivery.get("show_chat_result", True))
        messages = list(payload.get("messages") or [])
        styles = list(payload.get("styles") or [])
        if show_chat:
            for index, message in enumerate(messages):
                style = styles[index] if index < len(styles) else "normal"
                self.chat.add_bot_message(message, style=style)
            for result in list(payload.get("results") or []):
                if isinstance(result, ActionResult):
                    self._show_email_data(result)

        notifications = list(payload.get("notifications") or [])
        if notifications:
            self._ensure_tray_icon()
            for title, body in notifications[:3]:
                if self._tray_icon is not None:
                    self._tray_icon.notify(title, body, timeout=6)

        for text in list(payload.get("speech_texts") or []):
            launched = self._speak_text(
                text,
                on_error=lambda message: self._safe_after(
                    0,
                    lambda m=message: self.chat.add_system_message(
                        f"Không thể đọc mail bằng giọng nói: {m}"
                    ),
                ),
            )
            if not launched:
                self.chat.add_system_message(
                    "Không thể đọc mail bằng giọng nói. Hãy kiểm tra lại gói đọc giọng nói offline."
                )
        if str(payload.get("trigger") or "").strip().lower() == "scheduled":
            self._safe_after(50, self._dispatch_next_internal_scheduled_task)

    def _build_email_auto_check_speech_text(
        self,
        *,
        check_name: str,
        new_mails: list[dict],
        voice_detail_mode: str,
    ) -> str:
        new_count = len(new_mails)
        if new_count <= 0:
            return f"{check_name}: không có mail mới."

        mode = (voice_detail_mode or "first_title").strip().lower()
        if mode == "count_only":
            return f"{check_name}: có {new_count} mail mới."

        if mode == "up_to_3_titles":
            titles: list[str] = []
            for item in new_mails[:3]:
                sender = str(item.get("from") or "").strip()
                subject = str(item.get("subject") or "").strip() or "(không có tiêu đề)"
                if sender:
                    titles.append(f"từ {sender}, tiêu đề {subject}")
                else:
                    titles.append(f"tiêu đề {subject}")
            joined = "; ".join(titles)
            return f"{check_name}: có {new_count} mail mới. {joined}."

        first_mail = new_mails[0]
        sender = str(first_mail.get("from") or "").strip()
        subject = str(first_mail.get("subject") or "").strip() or "(không có tiêu đề)"
        if sender:
            return f"{check_name}: có {new_count} mail mới. Mail đầu tiên từ {sender}, tiêu đề {subject}."
        return f"{check_name}: có {new_count} mail mới. Tiêu đề mail đầu tiên là {subject}."

    def _submit_send_email_form(
        self, to: str, subject: str, body: str, attachments: list[str] | None = None
    ) -> None:
        normalized_body = " ".join((body or "").split())
        normalized_subject = " ".join((subject or "").split())
        if attachments:
            summary = ", ".join(Path(path).name for path in attachments[:3])
            if len(attachments) > 3:
                summary += f" và {len(attachments) - 3} tệp khác"
            self.chat.add_system_message(
                f"Gửi email kèm {len(attachments)} tệp đính kèm: {summary}"
            )
        result = self.engine._handle_send_email(
            to=to,
            subject=normalized_subject,
            body=normalized_body,
            attachments=list(attachments or []),
        )
        self._handle_result(result, source="gui")

    def _submit_reminder_form(self, title: str, message: str, due_at: str) -> None:
        self._ensure_active_chat_session()
        self.chat.add_system_message(
            f"Tạo reminder từ form GUI: {title} - {self._format_reminder_due_label(due_at)}"
        )
        self._persist_current_chat_session()
        self._reload_chat_session_list()
        self.input_bar.set_enabled(False)
        self.chat.show_loading()
        threading.Thread(
            target=self._run_create_reminder_worker,
            args=(title, message, due_at),
            daemon=True,
        ).start()

    def _run_create_reminder_worker(
        self, title: str, message: str, due_at: str
    ) -> None:
        try:
            result = self.engine._handle_create_reminder(
                title=title,
                message=message,
                due_at=due_at,
                timezone_name="Asia/Saigon",
            )
        except Exception as exc:
            result = ActionResult.err(f"Không thể tạo reminder: {exc}")
        self._safe_after(0, lambda: self._handle_result(result, source="text"))

    def _format_reminder_due_label(self, due_at: str) -> str:
        raw_due_at = str(due_at or "").strip()
        if not raw_due_at:
            return "(không có thời gian)"
        try:
            parsed = datetime.fromisoformat(raw_due_at)
        except ValueError:
            return raw_due_at
        return parsed.strftime("%H:%M - %d/%m/%Y")

    def _show_personal_history(self) -> None:
        try:
            service = PersonalMemoryService()
            payload = service.view_memory()
        except Exception as exc:
            self.chat.add_bot_message(f"Không thể đọc lịch sử: {exc}", style="error")
            return
        self.chat.add_bot_message(
            executor._format_memory_message(payload, include_history_details=True)
        )

    def _refresh_gmail_status(self) -> None:
        active_email = ""
        connected_count = 0
        try:
            auth_service = GoogleAuthService("gmail")
            active_email = str(auth_service.get_active_account() or "").strip().lower()
            connected_count = len(auth_service.list_accounts())
        except Exception:
            active_email = ""
            connected_count = 0

        default_email = ""
        try:
            memory = PersonalMemoryService()
            default_email = (
                str(memory.get_preference("gmail_default_account", "") or "")
                .strip()
                .lower()
            )
        except Exception:
            default_email = ""

        if active_email and default_email and active_email != default_email:
            text = f"Gmail đang dùng: {active_email} | Gmail mặc định: {default_email}"
        elif active_email:
            text = f"Gmail đang dùng: {active_email}"
        elif default_email:
            text = f"Gmail mặc định: {default_email}"
        else:
            text = "Gmail: chưa kết nối"

        if connected_count > 1:
            text += f" | {connected_count} tài khoản"

        self.gmail_status_label.configure(text=text)

    def _show_chat_sessions(self) -> None:
        self._reload_chat_session_list()
        self.chat.add_system_message(
            "Danh sách lịch sử chat đã được làm mới ở cột bên trái."
        )

    def _ensure_active_chat_session(self) -> None:
        if self._current_session_id:
            return
        session = self._chat_sessions.create_session()
        self._current_session_id = str(session.get("session_id") or "")

    def _start_new_chat_session(self, show_notice: bool = True) -> None:
        if self._active_request_id is not None:
            self._on_stop_current_request()
        if self._current_session_id:
            transcript = self.chat.export_transcript()
            if not self._chat_sessions.has_user_messages(transcript):
                try:
                    self._chat_sessions.delete_session(self._current_session_id)
                except Exception:
                    pass
        self._current_session_id = ""
        self._conversation_epoch += 1
        self.engine.state.clear_conversation_context()
        self.chat.clear()
        self.action_bar.hide()
        self.input_bar.set_enabled(True)
        self._append_welcome_message()
        if show_notice:
            self.chat.add_system_message("Đã tạo cuộc trò chuyện mới.")
        self._reload_chat_session_list()
        self._resume_wakeword_after_voice()
        self.input_bar.focus_input()

    def _open_chat_session(self, session_id: str) -> None:
        try:
            payload = self._chat_sessions.load_session(session_id)
        except Exception as exc:
            self.chat.add_bot_message(
                f"Không thể mở lịch sử chat: {exc}", style="error"
            )
            return
        self._current_session_id = str(payload.get("session_id") or session_id)
        self._conversation_epoch += 1
        self.engine.state.clear_conversation_context()
        self.action_bar.hide()
        self.input_bar.set_enabled(True)
        messages = payload.get("messages") or []
        self.chat.load_transcript(messages)
        self._restore_engine_history_from_session(messages)
        self._reload_chat_session_list()
        self.input_bar.focus_input()

    def _reload_chat_session_list(self) -> None:
        sessions = self._chat_sessions.list_sessions(limit=100)
        self.history_panel.set_sessions(
            sessions, selected_session_id=self._current_session_id
        )

    def _persist_current_chat_session(self) -> None:
        transcript = self.chat.export_transcript()
        if not self._chat_sessions.has_user_messages(transcript):
            if self._current_session_id:
                try:
                    self._chat_sessions.delete_session(self._current_session_id)
                except Exception:
                    pass
                self._current_session_id = ""
            return
        self._ensure_active_chat_session()
        title = self._chat_sessions.build_title_from_messages(transcript)
        self._chat_sessions.save_session(
            self._current_session_id,
            title=title,
            messages=transcript,
        )

    def _restore_engine_history_from_session(self, messages: list[dict]) -> None:
        self.engine.state.clear_conversation_context()
        for item in messages:
            role = str(item.get("role") or "")
            kind = str(item.get("kind") or "")
            text = str(item.get("text") or "")
            if kind != "text":
                continue
            if role == "user":
                self.engine.state.push_history("user", text)
            elif role == "assistant":
                self.engine.state.push_history("assistant", text)

    def _append_welcome_message(self) -> None:
        display_name = str(self._system_settings.get("display_name") or "").strip()
        greeting = "Xin chào!"
        if display_name:
            greeting = f"Xin chào {display_name}!"
        base_msg = (
            f"{greeting} Mình là AT Assistant 🤖\n"
            "Gõ lệnh tiếng Việt hoặc tiếng Anh để bắt đầu.\n"
            "Ví dụ: mở notepad, tìm file báo cáo, email hôm nay, ...\n"
            "Bấm 🎤 để dùng giọng nói, ⬆⬇ để xem lệnh cũ."
        )
        # Append recent apps line if available
        try:
            recent = RecentAppsService().get_recent_app_names(limit=5)
        except Exception:
            recent = []
        if recent:
            recent_line = (
                "\n===============================\n 👁️Ứng dụng đã mở gần đây:\n"
                + "\n".join(recent)
            )
            full_msg = base_msg + "\n" + recent_line
        else:
            full_msg = base_msg
        self.chat.add_bot_message(full_msg)

    def _ensure_tray_icon(self) -> None:
        if self._tray_icon is None:
            self._tray_icon = TrayIconManager(
                on_restore=lambda: self._safe_after(0, self._restore_from_tray),
                on_exit=lambda: self._safe_after(0, self._quit_from_tray),
                icon_path=str(self._app_icon_path),
            )
        self._tray_icon.start()

    def _enter_background_startup_mode(self) -> None:
        if self._is_quitting:
            return
        self._minimize_to_tray(
            notify=False,
            message="AT Assistant đang chạy nền sau khi đăng nhập Windows.",
        )
        _close_startup_splash()

    def _handle_window_unmap(self, event=None) -> None:
        if self._is_quitting:
            return
        try:
            is_iconic = self.state() == "iconic"
        except Exception:
            is_iconic = False
        if not is_iconic:
            return
        self._safe_after(0, self._minimize_to_tray)

    def _minimize_to_tray(
        self,
        *,
        notify: bool = True,
        message: str = "Ứng dụng đang chạy nền. Reminder sẽ tiếp tục nhắc việc.",
    ) -> None:
        if self._tray_active or self._is_quitting:
            return
        self._ensure_tray_icon()
        self.withdraw()
        self._tray_active = True
        if notify and self._tray_icon is not None:
            self._tray_icon.notify(
                "AT Assistant",
                message,
                timeout=5,
            )

    def _restore_from_tray(self) -> None:
        if self._is_quitting:
            return
        self.deiconify()
        if self._prefer_zoomed_window:
            self._apply_preferred_window_state()
        else:
            self.state("normal")
        self.lift()
        self.focus_force()
        self._tray_active = False

    def _handle_close_window(self) -> None:
        if self._is_quitting:
            return
        self._is_quitting = True
        self._stop_telegram_bridge()
        self._stop_mobile_remote_bridge()
        self._cancel_pending_afters()
        self._wakeword_runtime.stop()
        if (
            self._voice_manager_dialog is not None
            and self._voice_manager_dialog.winfo_exists()
        ):
            try:
                self._voice_manager_dialog.destroy()
            except Exception:
                pass
        if (
            self._system_settings_dialog is not None
            and self._system_settings_dialog.winfo_exists()
        ):
            try:
                self._system_settings_dialog.destroy()
            except Exception:
                pass
        if (
            self._mobile_remote_dialog is not None
            and self._mobile_remote_dialog.winfo_exists()
        ):
            try:
                self._mobile_remote_dialog.destroy()
            except Exception:
                pass
        if (
            self._uninstall_dialog is not None
            and self._uninstall_dialog.winfo_exists()
        ):
            try:
                self._uninstall_dialog.destroy()
            except Exception:
                pass
        if (
            self._factory_reset_dialog is not None
            and self._factory_reset_dialog.winfo_exists()
        ):
            try:
                self._factory_reset_dialog.destroy()
            except Exception:
                pass
        if (
            self._active_reminder_popup is not None
            and self._active_reminder_popup.winfo_exists()
        ):
            try:
                self._active_reminder_popup.destroy()
            except Exception:
                pass
        if self._tray_icon is not None:
            self._tray_icon.stop()
        try:
            self.withdraw()
        except Exception:
            pass
        try:
            self.quit()
        except Exception:
            pass
        self.destroy()

    def _quit_from_tray(self) -> None:
        self._handle_close_window()

    # ═══════════════════════════════════════════════════
    #  ENGINE INTEGRATION
    # ═══════════════════════════════════════════════════
    def _collect_due_reminders(self) -> None:
        now = datetime.now()
        self._cleanup_reminder_cooldowns(now)

        try:
            reminders = self._reminder_service.list_reminders(status="pending")
        except Exception:
            return

        due_reminders: list[dict] = []
        for reminder in reminders:
            reminder_id = str(reminder.get("id") or "").strip()
            due_at = self._parse_reminder_due_at(reminder)
            if not reminder_id or due_at is None or due_at > now:
                continue
            if reminder_id == self._active_popup_reminder_id:
                continue
            if reminder_id in self._queued_due_ids:
                continue
            cooldown_until = self._reminder_cooldowns.get(reminder_id)
            if cooldown_until and cooldown_until > now:
                continue
            due_reminders.append(reminder)

        if due_reminders:
            for reminder in due_reminders:
                reminder_id = str(reminder.get("id") or "").strip()
                if not reminder_id:
                    continue
                self._enqueue_internal_scheduled_task(
                    kind="reminder",
                    task_id=reminder_id,
                    priority=30,
                    payload={"reminder": reminder},
                )

    def _parse_reminder_due_at(self, reminder: dict) -> datetime | None:
        raw_due = str(reminder.get("due_at") or "").strip()
        if not raw_due:
            return None
        try:
            due_at = datetime.fromisoformat(raw_due)
        except ValueError:
            return None
        return due_at.replace(tzinfo=None) if due_at.tzinfo else due_at

    def _cleanup_reminder_cooldowns(self, now: datetime) -> None:
        expired_ids = [
            reminder_id
            for reminder_id, expires_at in self._reminder_cooldowns.items()
            if expires_at <= now
        ]
        for reminder_id in expired_ids:
            self._reminder_cooldowns.pop(reminder_id, None)

    def _enqueue_due_reminders(self, reminders: list[dict]) -> None:
        for reminder in reminders:
            reminder_id = str(reminder.get("id") or "").strip()
            if not reminder_id:
                continue
            if reminder_id == self._active_popup_reminder_id:
                continue
            if reminder_id in self._queued_due_ids:
                continue
            self._queued_due_reminders.append(reminder)
            self._queued_due_ids.add(reminder_id)

    def _dispatch_next_due_reminder(self) -> None:
        if (
            self._active_reminder_popup is not None
            and self._active_reminder_popup.winfo_exists()
        ):
            return
        if not self._queued_due_reminders:
            return
        reminder = self._queued_due_reminders.pop(0)
        reminder_id = str(reminder.get("id") or "").strip()
        self._queued_due_ids.discard(reminder_id)
        remaining = len(self._queued_due_reminders)
        if self._tray_active or not self.winfo_viewable():
            self._notify_due_reminders_in_background(
                [reminder], extra_due_count=remaining
            )
            return
        self._open_reminder_popup(reminder, extra_due_count=remaining)

    def _open_reminder_popup(self, reminder: dict, extra_due_count: int = 0) -> None:
        self._active_popup_reminder_id = str(reminder.get("id") or "").strip()
        reminder_title = (
            reminder.get("title") or reminder.get("message") or "Reminder"
        ).strip()
        if extra_due_count > 0:
            self.chat.add_system_message(
                f"Reminder đến hạn: {reminder_title} (và {extra_due_count} reminder khác)."
            )
        else:
            self.chat.add_system_message(f"Reminder đến hạn: {reminder_title}")
        self._announce_due_reminder(reminder)
        popup = ReminderPopup(
            self,
            palette=self._palette,
            reminder=reminder,
            extra_due_count=extra_due_count,
            on_done=self._complete_popup_reminder,
            on_snooze=self._snooze_popup_reminder,
            on_open_list=self._open_reminder_list_from_popup,
            on_dismiss=self._dismiss_popup_reminder,
        )
        popup.bind("<Destroy>", self._on_popup_destroy, add="+")
        self._active_reminder_popup = popup

    def _notify_due_reminders_in_background(
        self, reminders: list[dict], extra_due_count: int = 0
    ) -> None:
        if not reminders:
            return
        primary = reminders[0]
        self._active_popup_reminder_id = str(primary.get("id") or "").strip()
        primary_title = (
            primary.get("title") or primary.get("message") or "Reminder"
        ).strip()
        message = primary_title
        total_others = extra_due_count + max(len(reminders) - 1, 0)
        if total_others > 0:
            message = f"{primary_title} và {total_others} reminder khác"
        self._ensure_tray_icon()
        if self._tray_icon is not None:
            self._tray_icon.notify("Reminder đến hạn", message, timeout=8)
        if self._tray_active or not self.winfo_viewable():
            self._restore_from_tray()
            self._safe_after(
                120,
                lambda: self._open_reminder_popup(
                    primary, extra_due_count=total_others
                ),
            )
        elif (
            self._active_reminder_popup is None
            or not self._active_reminder_popup.winfo_exists()
        ):
            self._open_reminder_popup(primary, extra_due_count=total_others)
        until = datetime.now() + timedelta(minutes=1)
        for reminder in reminders:
            reminder_id = str(reminder.get("id") or "").strip()
            if reminder_id:
                self._reminder_cooldowns[reminder_id] = until

    def _announce_due_reminder(self, reminder: dict) -> None:
        reminder_text = self._build_reminder_announcement(reminder)
        launched = self._speak_text(
            reminder_text,
            on_error=lambda _message: self._safe_after(0, self._play_reminder_sound),
        )
        if not launched:
            self._play_reminder_sound()

    def _build_reminder_announcement(self, reminder: dict) -> str:
        title = (reminder.get("title") or reminder.get("message") or "reminder").strip()
        return f"Nhắc bạn: {title}"

    def _refresh_upcoming_tasks_panel(self) -> None:
        try:
            reminders = self._reminder_service.list_upcoming_reminders(
                limit=len(self._upcoming_task_labels)
            )
        except Exception:
            reminders = []

        if not reminders:
            if self.upcoming_tasks_frame.winfo_manager():
                self.upcoming_tasks_frame.grid_remove()
            return

        self.upcoming_tasks_frame.grid(
            row=1,
            column=2,
            rowspan=3,
            sticky="nsew",
            padx=(0, 8),
            pady=(6, 0),
        )
        self._apply_upcoming_tasks_collapsed_state()

        lines = [self._format_upcoming_task_line(item) for item in reminders]
        for index, label in enumerate(self._upcoming_task_labels):
            label.configure(text=lines[index] if index < len(lines) else "")

    def _format_upcoming_task_line(self, reminder: dict) -> str:
        title = (
            reminder.get("title") or reminder.get("message") or "Công việc"
        ).strip()
        due_at = self._parse_reminder_due_at(reminder)
        if due_at is None:
            due_label = "không rõ hạn"
        else:
            due_label = due_at.strftime("%H:%M %d/%m")
        status = str(reminder.get("status") or "pending").strip().lower()
        status_label = "Pending"
        if status == "in_progress":
            status_label = "In progress"
        elif status == "completed":
            status_label = "Completed"
        duration_label = self._describe_task_duration(reminder)
        parts = [f"{title} • {due_label} • {status_label}"]
        if duration_label:
            parts.append(duration_label)
        return " | ".join(parts)

    def _describe_task_duration(self, reminder: dict) -> str:
        metadata = reminder.get("metadata") or {}
        duration_minutes = metadata.get("task_duration_minutes")
        if not isinstance(duration_minutes, int) or duration_minutes <= 0:
            return ""
        hours, minutes = divmod(duration_minutes, 60)
        if hours and minutes:
            return f"{hours}h{minutes:02d}"
        if hours:
            return f"{hours}h"
        return f"{minutes}m"

    def _play_reminder_sound(self) -> None:
        if winsound is None:
            return

        def ring() -> None:
            try:
                for tone, duration in ((1046, 180), (1318, 180), (1568, 220)):
                    winsound.Beep(tone, duration)
            except Exception:
                try:
                    winsound.PlaySound(
                        "SystemExclamation", winsound.SND_ALIAS | winsound.SND_ASYNC
                    )
                except Exception:
                    try:
                        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
                    except Exception:
                        return

        threading.Thread(target=ring, daemon=True).start()

    def _on_popup_destroy(self, event=None) -> None:
        widget = getattr(event, "widget", None)
        if widget is self._active_reminder_popup:
            self._active_reminder_popup = None
            self._active_popup_reminder_id = ""
            self._safe_after(50, self._dispatch_next_due_reminder)

    def _complete_popup_reminder(self, reminder: dict) -> None:
        reminder_id = str(reminder.get("id") or "").strip()
        if not reminder_id:
            return
        try:
            updated = self._reminder_service.complete_reminder(reminder_id)
        except Exception as exc:
            self.chat.add_bot_message(
                f"Không thể hoàn thành reminder: {exc}", style="error"
            )
            return
        title = (updated.get("title") or updated.get("message") or reminder_id).strip()
        self.chat.add_bot_message(f"Đã hoàn thành reminder: {title}", style="success")
        self._reminder_cooldowns.pop(reminder_id, None)
        self._active_reminder_popup = None
        self._active_popup_reminder_id = ""

    def _snooze_popup_reminder(self, reminder: dict, minutes: int) -> None:
        reminder_id = str(reminder.get("id") or "").strip()
        if not reminder_id:
            return
        try:
            updated = self._reminder_service.snooze_reminder(
                reminder_id, minutes=minutes
            )
        except Exception as exc:
            self.chat.add_bot_message(
                f"Không thể snooze reminder: {exc}", style="error"
            )
            return
        title = (updated.get("title") or updated.get("message") or reminder_id).strip()
        self.chat.add_system_message(
            f"Đã nhắc lại reminder '{title}' sau {minutes} phút."
        )
        self._reminder_cooldowns.pop(reminder_id, None)
        self._active_reminder_popup = None
        self._active_popup_reminder_id = ""

    def _dismiss_popup_reminder(self, reminder: dict) -> None:
        reminder_id = str(reminder.get("id") or "").strip()
        if reminder_id:
            self._reminder_cooldowns[reminder_id] = datetime.now() + timedelta(
                minutes=5
            )
        self._active_reminder_popup = None
        self._active_popup_reminder_id = ""

    def _open_reminder_list_from_popup(self, reminder: dict) -> None:
        reminder_id = str(reminder.get("id") or "").strip()
        if reminder_id:
            self._reminder_cooldowns[reminder_id] = datetime.now() + timedelta(
                minutes=2
            )
        self._active_reminder_popup = None
        self._active_popup_reminder_id = ""
        self.chat.add_system_message("Đang mở danh sách reminder...")
        self._on_send("xem reminder")

    def _set_processing_state(self, processing: bool) -> None:
        self.input_bar.set_processing(processing)
        self.input_bar.set_enabled(not processing)
        if processing:
            self.chat.show_loading()
        else:
            self.chat.hide_loading()

    def _start_engine_request(self, text: str, *, source: str = "text") -> None:
        self._request_seq += 1
        request_id = self._request_seq
        epoch = self._conversation_epoch
        cancel_event = threading.Event()
        self._active_request_id = request_id
        self._active_cancel_event = cancel_event
        self._request_sources[request_id] = source
        self._request_epochs[request_id] = epoch
        self._set_processing_state(True)
        threading.Thread(
            target=self._run_engine,
            args=(request_id, epoch, text, cancel_event),
            daemon=True,
        ).start()

    def _submit_request(self, text: str, *, source: str = "text") -> None:
        text = normalize_text(text)
        if not text:
            return
        self._ensure_active_chat_session()
        self.chat.add_user_message(text)
        self._persist_current_chat_session()
        self._reload_chat_session_list()
        self._start_engine_request(text, source=source)

    def _on_send(self, text: str) -> None:
        """Handle user text input."""
        self._submit_request(text, source="text")

    def _clear_conversation(self) -> None:
        self._start_new_chat_session(show_notice=True)

    def _delete_current_chat_session(self) -> None:
        current_session_id = self._current_session_id
        if current_session_id:
            try:
                self._chat_sessions.delete_session(current_session_id)
            except Exception as exc:
                self.chat.add_bot_message(
                    f"Không thể xóa cuộc trò chuyện: {exc}", style="error"
                )
                return
        self._start_new_chat_session(show_notice=False)
        self.chat.add_system_message("Đã xóa cuộc trò chuyện hiện tại.")

    def _toggle_history_sidebar(self) -> None:
        self._history_sidebar_collapsed = not self._history_sidebar_collapsed
        self.history_panel.set_collapsed(self._history_sidebar_collapsed)

    def _on_stop_current_request(self) -> None:
        request_id = self._active_request_id
        if request_id is None:
            return
        if self._active_cancel_event is not None:
            self._active_cancel_event.set()
        self._cancelled_request_ids.add(request_id)
        self._request_sources.pop(request_id, None)
        self._request_epochs.pop(request_id, None)
        self._active_request_id = None
        self._active_cancel_event = None
        self._set_processing_state(False)
        self.action_bar.hide()
        self.chat.add_system_message(
            "Đã dừng yêu cầu hiện tại. Nếu tác vụ nền đã chạy tới bước không thể huỷ, kết quả trả về sẽ bị bỏ qua."
        )
        self._resume_wakeword_after_voice()
        self.input_bar.focus_input()

    def _on_action(self, value: str) -> None:
        """Handle action bar button clicks (confirm yes/no, choice number)."""
        self._submit_request(value, source="text")

    def _on_stop_speech(self) -> None:
        """Stop any ongoing TTS playback."""
        if self._voice_packages:
            self._voice_packages.stop_speaking()
        # Also try to stop runtime speaker if one exists
        if self._voice_runtime:
            # We don't have a direct cancel on speaker, but we can stop packages
            pass

    def _handle_keyboard_confirm(self, event=None) -> str | None:
        mode = self.action_bar.current_mode()
        if mode == "confirm":
            self.action_bar.trigger_yes()
            return "break"
        return None

    def _handle_keyboard_cancel(self, event=None) -> str | None:
        # Always try to stop speech first if it is playing
        if self._voice_packages.is_speaking:
            self._on_stop_speech()
            return "break"
        mode = self.action_bar.current_mode()
        if mode == "confirm":
            self.action_bar.trigger_no()
            return "break"
        if mode == "choice":
            self._on_action("hủy")
            return "break"
        if self._active_request_id is not None:
            self._on_stop_current_request()
            return "break"
        return None

    def _handle_keyboard_yes(self, event=None) -> str | None:
        focused = self.focus_get()
        if focused == self.input_bar.entry:
            return None
        if self.action_bar.current_mode() == "confirm":
            self.action_bar.trigger_yes()
            return "break"
        return None

    def _handle_keyboard_no(self, event=None) -> str | None:
        focused = self.focus_get()
        if focused == self.input_bar.entry:
            return None
        if self.action_bar.current_mode() == "confirm":
            self.action_bar.trigger_no()
            return "break"
        return None

    def _handle_keyboard_choice(self, event=None) -> str | None:
        focused = self.focus_get()
        if focused == self.input_bar.entry:
            return None
        if self.action_bar.current_mode() != "choice":
            return None
        if not event or not getattr(event, "char", ""):
            return None
        self.action_bar.trigger_choice(event.char)
        return "break"

    def _run_engine(
        self, request_id: int, epoch: int, text: str, cancel_event: threading.Event
    ) -> None:
        """Execute engine.handle_turn() in a worker thread."""
        try:
            result = self.engine.handle_turn(text, cancel_check=cancel_event.is_set)
        except Exception as e:
            result = ActionResult.err(f"Lỗi nội bộ: {e}")
        self._result_queue.put((request_id, epoch, result))

    def _poll_results(self) -> None:
        """Poll result queue and update GUI (runs on main thread)."""
        try:
            while True:
                request_id, epoch, result = self._result_queue.get_nowait()
                if request_id in self._cancelled_request_ids:
                    self._cancelled_request_ids.discard(request_id)
                    continue
                expected_epoch = self._request_epochs.pop(request_id, epoch)
                if epoch != expected_epoch or epoch != self._conversation_epoch:
                    continue
                if (
                    self._active_request_id is not None
                    and request_id != self._active_request_id
                ):
                    continue
                source = self._request_sources.pop(request_id, "text")
                self._active_request_id = None
                self._active_cancel_event = None
                self._handle_result(result, source=source)
        except queue.Empty:
            pass
        self._safe_after(50, self._poll_results)

    def _handle_result(self, res: ActionResult, *, source: str = "text") -> None:
        """Process ActionResult and update GUI accordingly."""

        self._set_processing_state(False)
        self._refresh_gmail_status()
        self._refresh_upcoming_tasks_panel()
        skip_voice_response = False
        continue_voice_session = False
        display_message = self._sanitize_user_message(res.message)

        if bool(res.data.get("clear_chat")):
            self.chat.clear()

        # ─── SUCCESS ───
        if res.status == ActionStatus.SUCCESS:
            self.chat.add_bot_message(display_message, style="success")
            self._show_email_data(res)
            self._send_telegram_document_from_desktop(res)
            self.action_bar.hide()
            self.input_bar.set_enabled(True)
            self.input_bar.focus_input()

        # ─── ERROR ───
        elif res.status == ActionStatus.ERROR:
            if res.error_code == ErrorCode.APP_NOT_FOUND and bool(
                res.data.get("prompt_custom_app_selection")
            ):
                skip_voice_response = True
                self._prompt_custom_app_selection(res)
            else:
                self.chat.add_bot_message(display_message, style="error")
            self.action_bar.hide()
            self.input_bar.set_enabled(True)
            self.input_bar.focus_input()

        # ─── CANCELLED ───
        elif res.status == ActionStatus.CANCELLED:
            self.chat.add_system_message(display_message)
            self.action_bar.hide()
            self.input_bar.set_enabled(True)
            self.input_bar.focus_input()

        # ─── NEED_CONFIRM ───
        elif res.status == ActionStatus.NEED_CONFIRM:
            self.chat.add_bot_message(display_message)
            self._show_confirm_preview(res)
            self.chat.add_bot_message("Bạn đồng ý thực hiện không?")
            self.action_bar.show_confirm()
            # Keep input disabled — user must use buttons
            self.input_bar.set_enabled(False)
            if source == "voice":
                continue_voice_session = True

        # ─── NEED_CHOICE ───
        elif res.status == ActionStatus.NEED_CHOICE:
            self.chat.add_bot_message(display_message)
            choices = res.data.get("choices", [])
            if choices:
                self.action_bar.show_choices(choices)
            # Keep input disabled — user must use buttons
            self.input_bar.set_enabled(False)
            if source == "voice":
                continue_voice_session = True

        # ─── NEED_CLARIFY ───
        elif res.status == ActionStatus.NEED_CLARIFY:
            self.chat.add_bot_message(display_message)
            question = res.data.get("question", "")
            if question and question != res.message:
                self.chat.add_bot_message(question)
            self.action_bar.hide()
            self.input_bar.set_enabled(True)
            self.input_bar.focus_input()
            if source == "voice":
                continue_voice_session = True

        else:
            self.chat.add_bot_message(display_message)
            self.input_bar.set_enabled(True)

        self._persist_current_chat_session()
        self._reload_chat_session_list()

        if display_message and not skip_voice_response and source != "voice":
            self._speak_text(
                display_message,
                on_start=lambda: self._safe_after(0, self.input_bar.show_stop_speech),
                on_done=lambda: self._safe_after(0, self.input_bar.hide_stop_speech),
            )

        if source == "voice":
            if continue_voice_session:
                prompt_text = self._build_voice_followup_prompt(res)
                mode = {
                    ActionStatus.NEED_CONFIRM: "confirm",
                    ActionStatus.NEED_CHOICE: "choice",
                    ActionStatus.NEED_CLARIFY: "clarify",
                }.get(res.status, "command")
                self._continue_voice_session(prompt_text, mode=mode)
            else:
                if display_message:
                    self._notify_background_voice_activity(
                        "Kết quả giọng nói",
                        display_message,
                        timeout=6,
                    )
                if self._can_speak():
                    self._voice_runtime.speak_for_result(res)
                if res.status == ActionStatus.SUCCESS:
                    self._apply_wakeword_cooldown("success")
                else:
                    self._apply_wakeword_cooldown("cancel")
                self._resume_wakeword_after_voice()

    def _show_email_data(self, res: ActionResult) -> None:
        """Render email cards if result contains email JSON data."""
        if not isinstance(res.data, dict):
            return

        json_data = res.data.get("json")
        if not json_data:
            return

        mails = json_data.get("data", [])
        for mail in mails:
            self.chat.add_email_card(mail)
        if mails and json_data.get("summary_pending"):
            pagination = json_data.get("pagination") or {}
            self._start_email_summary_job(
                mails=mails,
                mode=str(pagination.get("mode") or ""),
                append=bool(pagination.get("append")),
            )

        detail = json_data.get("detail")
        if detail:
            self.chat.add_email_detail(detail)

        # Hidden email list
        hidden = json_data.get("hidden", [])
        if hidden:
            self.chat.add_bot_message("\n".join(f"• {e}" for e in hidden))

    def _sanitize_user_message(self, message: str) -> str:
        text = str(message or "")
        text = re.sub(r"\s+\(foreground pid=\d+\)\.?", ".", text, flags=re.IGNORECASE)
        text = re.sub(r"\s+\(pid=\d+\)\.?", ".", text, flags=re.IGNORECASE)
        return text

    def _start_email_summary_job(
        self, mails: list[dict], mode: str, append: bool
    ) -> None:
        if not mails:
            return
        email_ids = [
            str(item.get("id") or "").strip() for item in mails if item.get("id")
        ]
        if not email_ids:
            return
        job_key = f"{mode}|{','.join(email_ids)}|{int(append)}"
        if job_key in self._email_summary_jobs:
            return
        self._email_summary_jobs.add(job_key)

        def worker() -> None:
            try:
                payload = []
                for item in mails[:10]:
                    payload.append(
                        {
                            "id": item.get("id"),
                            "from": item.get("from", ""),
                            "subject": item.get("subject", ""),
                            "snippet": item.get("snippet", ""),
                            "is_unread": bool(item.get("is_unread")),
                            "has_attachment": bool(item.get("has_attachment")),
                            "ai_note": list(item.get("ai_note") or []),
                        }
                    )
                summarized = EmailSummarizer.summarize(payload)
            except Exception:
                summarized = []
            finally:
                self._email_summary_jobs.discard(job_key)

            if not summarized:
                return
            self._safe_after(0, lambda: self._apply_email_summary_updates(summarized))

        threading.Thread(target=worker, daemon=True).start()

    def _apply_email_summary_updates(self, mails: list[dict]) -> None:
        for mail in mails:
            email_id = str(mail.get("id") or "").strip()
            notes = list(mail.get("ai_note") or [])
            if not email_id or not notes:
                continue
            self.chat.update_email_card_notes(email_id, notes)

    def _show_confirm_preview(self, res: ActionResult) -> None:
        """Render richer previews for send/reply email confirmations."""
        if not isinstance(res.data, dict):
            return

        tool = res.data.get("tool")
        args = res.data.get("args") or {}
        if tool == "send_email":
            self.chat.add_email_preview(args, mode="send")
            return

        if tool == "reply_email":
            preview = {
                "to": "",
                "subject": "Trả lời email đã chọn",
                "body": args.get("body") or "",
            }
            self.chat.add_email_preview(preview, mode="reply")
            return

        if tool == "send_bulk_email":
            sender = (
                args.get("from_address") or "(mặc định của tài khoản Gmail hiện tại)"
            )
            self.chat.add_bot_message(
                f"Chế độ: Gửi mail thư mời\nĐịa chỉ gửi đã chọn: {sender}"
            )
            preview_rows = args.get("preview_rows") or []
            for item in preview_rows:
                candidate = item.get("candidate_name") or "(không có tên)"
                row_number = item.get("row_number") or "?"
                attachment_paths = item.get("attachment_paths") or []
                attachment_line = ""
                if attachment_paths:
                    attachment_line = "\nFile đính kèm:\n" + "\n".join(
                        f"- {path}" for path in attachment_paths
                    )
                self.chat.add_bot_message(
                    f"Dòng {row_number} • Ứng viên: {candidate}\nEmail nhận: {item.get('to') or ''}{attachment_line}"
                )
                preview = {
                    "to": item.get("to") or "",
                    "cc": item.get("cc") or "",
                    "bcc": item.get("bcc") or "",
                    "subject": item.get("subject") or "",
                    "body": item.get("body") or "",
                }
                self.chat.add_email_preview(preview, mode="invite")
            invalid_rows = args.get("invalid_rows") or []
            if invalid_rows:
                self.chat.add_bot_message(
                    "\n".join(
                        f"Dòng {item['row_number']}: {item['reason']}"
                        for item in invalid_rows[:3]
                    )
                )


def run(argv=None):
    argv = list(argv if argv is not None else sys.argv[1:])
    start_hidden = "--background-startup" in argv
    _update_startup_splash("Đang tải thư viện...")
    app = ATAssistantApp(start_hidden=start_hidden)
    app.mainloop()


if __name__ == "__main__":
    run()
