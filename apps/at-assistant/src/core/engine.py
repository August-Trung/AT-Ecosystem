from __future__ import annotations

from dataclasses import dataclass, field
import re
import unicodedata
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .result import ActionResult, ActionStatus, ErrorCode
from . import nlu_feedback
from .router import (
    route,
    RouteType,
    RouteDecision,
    _extract_reminder_content,
    _parse_reminder_datetime,
    _extract_snooze_minutes,
    _extract_reminder_index,
)
from . import executor
from .external_api_ai import CancelledError, parse_toolcall
from src.core.chat_ai import generate_chat_reply

from src.core.logging_setup import setup_logger
from src.core.workflow_parser import (
    apply_workflow_draft_command,
    format_workflow_draft,
    looks_like_create_workflow_request,
    parse_create_workflow_request,
)
from src.plugins.personal_memory_service import PersonalMemoryService
from src.plugins.chat_session_service import ChatSessionService
from src.plugins.installed_apps_service import InstalledAppsService
from src.plugins.recent_apps_service import RecentAppsService
from src.plugins.workflow_service import WorkflowService
from src.plugins.menu_data import MENU

RISKY_TOOLS = {
    "close_app",
    "delete_file",
    "delete_path",
    "move_path",
    "send_email",
    "send_bulk_email",
    "reply_email",
    "delete_reminder",
    "delete_workflow",
    "system_power",
    "schedule_close",
    "schedule_open",
    "smart_close",
    "lazy_idle_guard",
}

DANGEROUS_SUBSTRINGS = {
    "format c",
    "format ổ c",
    "format o c",
    "format ổ đĩa",
    "format o dia",
    "xóa ổ c",
    "xoa o c",
    "xóa ổ đĩa",
    "xoa o dia",
    "xóa ổ",
    "xoa o",
    "wipe disk",
    "erase disk",
    "delete drive",
    "clean disk",
    "clean all",
    "diskpart",
    "del /s",
    "rmdir /s",
    "rd /s",
    "rm -rf",
    "rm -r",
}

DELETE_INTENTS = {"xóa", "xoa", "delete", "remove", "del", "rm", "rmdir", "rd"}


@dataclass
class EngineState:
    last_choices: List[str] = None
    last_action: str = "open"
    last_action_meta: Dict[str, Any] = field(default_factory=dict)

    pending_tool: Optional[str] = None
    pending_args: Optional[Dict[str, Any]] = None
    last_email_results: List[Dict[str, Any]] = field(default_factory=list)
    selected_email_id: str = ""
    last_email_mode: str = ""
    last_email_next_page_token: str = ""
    last_email_page_size: int = 0
    last_drive_results: List[Dict[str, Any]] = field(default_factory=list)
    selected_drive_file_id: str = ""
    last_reminder_results: List[Dict[str, Any]] = field(default_factory=list)
    pending_clarify_intent: str = ""
    pending_clarify_args: Dict[str, Any] = field(default_factory=dict)
    pending_workflow_draft: Dict[str, Any] = field(default_factory=dict)
    remote_input_target: Dict[str, Any] = field(default_factory=dict)

    # lưu "identity" app đã mở (exe + proc_name + pid nếu có)
    opened_apps: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)

    # lịch sử hội thoại gửi cho LLM (tối đa 10 messages)
    history: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        if self.last_choices is None:
            self.last_choices = []

    def push_history(self, role: str, content: str) -> None:
        """Ghi thêm 1 message vào history; giới hạn 10 messages (= 5 turns)."""
        self.history.append({"role": role, "content": content})
        if len(self.history) > 10:
            self.history = self.history[-10:]

    def clear_conversation_context(self) -> None:
        """Reset chat-related state without forgetting running app ownership."""
        self.last_choices = []
        self.last_action = "open"
        self.last_action_meta = {}
        self.pending_tool = None
        self.pending_args = None
        self.last_email_results = []
        self.selected_email_id = ""
        self.last_email_mode = ""
        self.last_email_next_page_token = ""
        self.last_email_page_size = 0
        self.last_drive_results = []
        self.selected_drive_file_id = ""
        self.last_reminder_results = []
        self.pending_clarify_intent = ""
        self.pending_clarify_args = {}
        self.pending_workflow_draft = {}
        self.remote_input_target = {}
        self.history = []


class Engine:
    """
    Core brain: input text -> ActionResult
    UI/CLI chỉ gọi engine.handle_turn()
    """

    def __init__(self):
        self.state = EngineState()
        self.logger = setup_logger()
        self._current_user_text = ""
        self._current_route_decision: RouteDecision | None = None
        self.memory = PersonalMemoryService()
        self.chat_sessions = ChatSessionService()

    @staticmethod
    def _raise_if_cancelled(cancel_check: Optional[Callable[[], bool]]) -> None:
        if cancel_check and cancel_check():
            raise CancelledError("Current request cancelled.")

    def _consume_confirmation(self, user_text: str) -> Optional[ActionResult]:
        if not self.state.pending_tool:
            return None

        t = (user_text or "").strip().lower()
        yes = t in {
            "y",
            "yes",
            "ok",
            "đồng ý",
            "dong y",
            "ừ",
            "ua",
            "thực hiện",
            "lam di",
        }
        no = t in {"n", "no", "không", "khong", "hủy", "huy", "thôi", "stop"}

        if not (yes or no):
            return ActionResult.need_clarify(
                message="Mình cần bạn xác nhận.",
                question="Bạn đồng ý thực hiện không? (yes/no)",
                slots={"expect": "yes_no"},
            )

        if no:
            self.state.pending_tool = None
            self.state.pending_args = None
            return ActionResult.ok("OK, mình không thực hiện.")

        # yes -> execute pending tool
        tool = self.state.pending_tool
        args = self.state.pending_args or {}
        self.state.pending_tool = None
        self.state.pending_args = None
        return self._execute_tool(tool, args)

    @staticmethod
    def _is_confirmation_response(user_text: str) -> bool:
        t = (user_text or "").strip().lower()
        return t in {
            "y",
            "yes",
            "ok",
            "đồng ý",
            "dong y",
            "ừ",
            "ua",
            "thực hiện",
            "lam di",
            "n",
            "no",
            "không",
            "khong",
            "hủy",
            "huy",
            "thôi",
            "stop",
        }

    def _maybe_interrupt_confirmation(self, user_text: str) -> bool:
        if not self.state.pending_tool or self._is_confirmation_response(user_text):
            return False
        try:
            fresh_decision = route(user_text)
        except Exception:
            return False
        if fresh_decision.type in {
            RouteType.FALLBACK_TO_LLM,
            RouteType.CHAT,
            RouteType.WEB_SEARCH,
        }:
            return False
        self.state.pending_tool = None
        self.state.pending_args = None
        return True

    # Bảng tra cứu chữ số tiếng Việt → số nguyên.
    # Bao gồm cả dạng có dấu và không dấu (STT offline thường bỏ dấu).
    _VI_NUMBER_MAP: dict[str, int] = {
        # 1–9 có dấu
        "một": 1, "hai": 2, "ba": 3, "bốn": 4, "năm": 5,
        "sáu": 6, "bảy": 7, "tám": 8, "chín": 9,
        # 1–9 không dấu (STT offline)
        "mot": 1, "hai": 2, "ba": 3, "bon": 4, "nam": 5,
        "sau": 6, "bay": 7, "tam": 8, "chin": 9,
        # 10–19 có dấu
        "mười": 10, "mười một": 11, "mười hai": 12, "mười ba": 13,
        "mười bốn": 14, "mười lăm": 15, "mười sáu": 16,
        "mười bảy": 17, "mười tám": 18, "mười chín": 19,
        # 10–19 không dấu
        "muoi": 10, "muoi mot": 11, "muoi hai": 12, "muoi ba": 13,
        "muoi bon": 14, "muoi lam": 15, "muoi sau": 16,
        "muoi bay": 17, "muoi tam": 18, "muoi chin": 19,
        # Alias phổ biến
        "lăm": 5, "lam": 5,
    }

    @classmethod
    def _parse_choice_number(cls, text: str) -> Optional[int]:
        """Chuyển text người dùng nhập (digit hoặc chữ số tiếng Việt) thành số nguyên.

        Ví dụ: "3" → 3, "ba" → 3, "số ba" → 3, "số 3" → 3, "muoi hai" → 12.
        Trả về None nếu không parse được.
        """
        s = cls._normalize_choice_text(text)

        # Bỏ tiền tố "số" / "chọn" phổ biến khi nói bằng giọng
        for prefix in ("số ", "chọn số ", "chọn ", "so ", "chon so ", "chon "):
            if s.startswith(prefix):
                s = s[len(prefix):].strip()
                break

        # 1. Chữ số thuần túy
        if s.isdigit():
            return int(s)

        # 2. Tra bảng lookup tiếng Việt (ưu tiên trước để tránh phụ thuộc thư viện)
        mapped = cls._VI_NUMBER_MAP.get(s)
        if mapped is not None:
            return mapped

        # 3. Fallback: vietnam_number w2n (xử lý số lớn hoặc cú pháp phức tạp hơn)
        try:
            from vietnam_number import w2n  # type: ignore
            result = w2n(s)
            if isinstance(result, (int, float)) and result > 0:
                return int(result)
        except Exception:
            pass

        return None

    @staticmethod
    def _normalize_choice_text(text: str) -> str:
        lowered = (text or "").strip().lower()
        folded = unicodedata.normalize("NFD", lowered)
        folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
        folded = re.sub(r"[^a-z0-9\s]", " ", folded)
        return re.sub(r"\s+", " ", folded).strip()

    def _consume_choice(self, user_text: str) -> Optional[ActionResult]:
        if not self.state.last_choices:
            return None

        s = (user_text or "").strip()
        s_lower = s.lower()

        # Allow user to cancel the pending choice
        if s_lower in {
            "hủy",
            "huy",
            "cancel",
            "thôi",
            "thoi",
            "không",
            "khong",
            "bỏ qua",
            "bo qua",
            "stop",
            "no",
        }:
            self.state.last_choices = []
            self.state.last_action = "open"
            self.state.last_action_meta = {}
            return ActionResult.ok(
                "Đã hủy lựa chọn. Bạn có thể tiếp tục với yêu cầu khác."
            )

        parsed = self._parse_choice_number(s)
        if parsed is None:
            return None

        idx = parsed - 1
        if idx < 0 or idx >= len(self.state.last_choices):
            return ActionResult.err(
                "Số bạn chọn không hợp lệ.",
                code=ErrorCode.UNKNOWN,
                dev_message=f"choice_index={idx}, choices={len(self.state.last_choices)}",
            )

        chosen = self.state.last_choices[idx]
        action = self.state.last_action
        meta = dict(self.state.last_action_meta or {})
        # clear choice state after selection
        self.state.last_choices = []
        self.state.last_action_meta = {}

        if action == "delete":
            # Need confirm before delete
            self.state.pending_tool = "delete_path"
            self.state.pending_args = {"path": chosen}
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn xóa mục này?\n{chosen}",
                tool="delete_path",
                args={"path": chosen},
            )

        if action == "copy":
            return self._execute_tool(
                "copy_path",
                {"src": chosen, "dst": meta.get("destination", "")},
            )

        if action == "move":
            args = {"src": chosen, "dst": meta.get("destination", "")}
            self.state.pending_tool = "move_path"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn di chuyển mục này?\n{chosen}\n→ {meta.get('destination', '')}",
                tool="move_path",
                args=args,
            )

        if action == "bulk_email_file":
            return self._handle_send_bulk_email(file_ref=chosen)

        if action == "bulk_email_sender":
            return self._confirm_send_bulk_email(sender_email=chosen, meta=meta)

        if action == "drive_upload_local":
            return self._execute_tool(
                "upload_to_drive",
                {
                    "file_path": chosen,
                    "folder_ref": meta.get("folder_ref", ""),
                    "create_folder_if_missing": bool(
                        meta.get("create_folder_if_missing", False)
                    ),
                },
            )

        if action == "drive_get_link":
            return self._execute_tool(
                "get_drive_link",
                {
                    "file_id": chosen,
                    "make_public": bool(meta.get("make_public", False)),
                },
            )

        if action == "drive_download":
            return self._execute_tool(
                "download_drive_file",
                {"file_id": chosen, "destination": meta.get("destination", "")},
            )

        if action == "file_item":
            return self._build_file_action_menu(chosen)

        if action == "file_action":
            return self._handle_file_action(chosen, str(meta.get("path") or ""))

        if action == "email_item":
            emails = list(meta.get("emails") or [])
            email = emails[idx] if idx < len(emails) else {}
            return self._build_email_action_menu(email)

        if action == "email_action":
            return self._handle_email_action(chosen, dict(meta.get("email") or {}))

        if action == "drive_item":
            files = list(meta.get("drive_files") or [])
            drive_file = files[idx] if idx < len(files) else {}
            return self._build_drive_action_menu(drive_file)

        if action == "drive_action":
            return self._handle_drive_action(chosen, dict(meta.get("drive_file") or {}))

        if action == "reminder_item":
            reminders = list(meta.get("reminders") or [])
            reminder = reminders[idx] if idx < len(reminders) else {}
            return self._build_reminder_action_menu(reminder)

        if action == "reminder_action":
            return self._handle_reminder_action(chosen, dict(meta.get("reminder") or {}))

        if action == "open_installed_app":
            # chosen is the exe path selected by the user
            exe_path = chosen
            app_name = meta.get("app_name", "")
            try:
                import subprocess, os

                p = subprocess.Popen([exe_path])
                key = meta.get(
                    "app_key", os.path.splitext(os.path.basename(exe_path))[0].lower()
                )
                try:
                    RecentAppsService().record_app(
                        key, exe_path=exe_path, display_name=app_name
                    )
                except Exception:
                    pass
                return ActionResult.ok(
                    f"Đã mở {app_name or key}",
                    app=key,
                    exe=exe_path,
                    pid=p.pid,
                    process_name=os.path.basename(exe_path),
                )
            except Exception as e:
                return ActionResult.err(
                    f"Không thể mở '{app_name}': {e}",
                )

        if action == "running_app":
            processes = list(meta.get("processes") or [])
            proc = processes[idx] if idx < len(processes) else {}
            return self._build_running_app_action_menu(proc)

        if action == "running_app_action":
            selected_app = dict(meta.get("selected_app") or {})
            return self._handle_running_app_action(chosen, selected_app)

        if action == "open_window":
            windows = list(meta.get("windows") or [])
            window = windows[idx] if idx < len(windows) else {}
            return self._build_window_action_menu(window)

        if action == "window_action":
            selected_window = dict(meta.get("selected_window") or {})
            return self._handle_window_action(chosen, selected_window)

        if action == "browser_tab":
            tabs = list(meta.get("tabs") or [])
            tab = tabs[idx] if idx < len(tabs) else {}
            return self._build_browser_tab_action_menu(tab)

        if action == "browser_tab_action":
            selected_tab = dict(meta.get("selected_tab") or {})
            return self._handle_browser_tab_action(chosen, selected_tab)

        if action == "screen_action":
            return self._handle_screen_action(chosen)

        if action == "close_process":
            processes = list(meta.get("processes") or [])
            proc = processes[idx] if idx < len(processes) else {}
            pid = int(proc.get("pid") or 0)
            pids = list(proc.get("pids") or [])
            name = str(proc.get("display_name") or proc.get("name") or chosen).strip()
            if not pid and not pids:
                return ActionResult.err("Không tìm thấy process để tắt.")
            args = {"pid": pid, "name": name, "pids": pids}
            self.state.pending_tool = "close_process"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn đóng toàn bộ {name}? Việc này có thể đóng nhiều cửa sổ/process của ứng dụng.",
                tool="close_process",
                args=args,
            )

        if action == "menu":
            self.state.last_choices = list(MENU.keys())
            self.state.last_action = "menu"
            self.state.last_action_meta = {}
            return executor.build_menu_response(chosen)

        # default open
        return executor.open_file(path=chosen)

    @staticmethod
    def _mark_choice_buttons(result: ActionResult) -> ActionResult:
        result.data["choice_button_labels"] = True
        return result

    def _build_screen_action_menu(self, result: ActionResult) -> ActionResult:
        actions = [
            "mouse_click_center",
            "mouse_click_bottom_right",
            "keyboard_enter",
            "keyboard_escape",
            "remote_type_text",
            "remote_send_text",
        ]
        choices = ["Click giữa", "Click góc dưới phải", "Enter", "Esc", "Nhập text", "Nhập + Enter"]
        self.state.last_choices = actions
        self.state.last_action = "screen_action"
        self.state.last_action_meta = {}
        result.data["choices"] = choices
        result.data["action"] = "screen_action"
        result.data["telegram_choice_buttons"] = True
        result.data["choice_button_labels"] = True
        return result

    def _handle_screen_action(self, action: str) -> ActionResult:
        if action == "mouse_click_center":
            return executor.mouse_control("click_center")
        if action == "mouse_click_bottom_right":
            return executor.mouse_control("click_bottom_right")
        if action == "keyboard_enter":
            return executor.keyboard_control("enter")
        if action == "keyboard_escape":
            return executor.keyboard_control("escape")
        if action in {"remote_type_text", "remote_send_text"}:
            submit = action == "remote_send_text"
            self._set_clarify_context("remote_text_action", action="target_text", submit=submit)
            return ActionResult.need_clarify(
                message="Bạn muốn nhập nội dung gì?",
                question="Gửi đoạn text cần nhập.",
            )
        return ActionResult.err("Lựa chọn màn hình không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _handle_remote_target(self, action: str, target: str = "", text: str = "", submit: bool = False) -> ActionResult:
        action = (action or "").strip().lower()
        target = (target or "").strip().lower()
        text = str(text or "")

        if action == "set_target":
            if target == "tiktok_comment":
                res = executor.browser_control("tiktok_comment_focus")
                if res.status != ActionStatus.SUCCESS:
                    return res
                self.state.remote_input_target = {"target": target, "label": "ô comment TikTok"}
                return ActionResult.ok("Đã chọn ô comment TikTok làm mục tiêu nhập.")
            if target == "current_input":
                self.state.remote_input_target = {"target": target, "label": "ô đang focus"}
                return ActionResult.ok("Đã chọn ô đang focus làm mục tiêu nhập.")
            return ActionResult.err("Mục tiêu nhập không hợp lệ.", code=ErrorCode.UNKNOWN)

        if action == "clear_target":
            self.state.remote_input_target = {}
            return ActionResult.ok("Đã bỏ mục tiêu nhập hiện tại.")

        if action == "status":
            label = str(self.state.remote_input_target.get("label") or "").strip()
            if not label:
                return ActionResult.ok("Chưa chọn mục tiêu nhập. Bạn có thể gửi: chọn ô comment TikTok.")
            return ActionResult.ok(f"Mục tiêu nhập hiện tại: {label}.")

        if action in {"type_text", "send_text"}:
            if not text:
                return ActionResult.err("Bạn chưa nhập nội dung cần gửi.", code=ErrorCode.UNKNOWN)
            selected = str(self.state.remote_input_target.get("target") or "").strip()
            should_submit = bool(submit or action == "send_text")
            if selected == "tiktok_comment":
                return executor.browser_control(
                    "tiktok_comment_send" if should_submit else "tiktok_comment_text",
                    text=text,
                )
            return executor.browser_control(
                "type_text_enter" if should_submit else "type_text",
                text=text,
            )

        return ActionResult.err("Lệnh mục tiêu nhập không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _build_file_action_menu(self, path: str) -> ActionResult:
        name = Path(path).name or path
        actions = ["open_file", "send_telegram", "upload_drive", "show_path", "delete_file"]
        choices = ["Mở", "Gửi qua Telegram", "Upload Drive", "Lấy đường dẫn", "Xóa"]
        self.state.last_choices = actions
        self.state.last_action = "file_action"
        self.state.last_action_meta = {"path": path}
        return self._mark_choice_buttons(
            ActionResult.need_choice(
                message=f"Bạn muốn làm gì với file này?\n{name}",
                choices=choices,
                action="file_action",
            )
        )

    def _handle_file_action(self, action: str, path: str) -> ActionResult:
        if not path:
            return ActionResult.err("Không tìm thấy file đã chọn.", code=ErrorCode.FILE_NOT_FOUND)
        if action == "open_file":
            return executor.open_file(path=path)
        if action == "send_telegram":
            return executor.prepare_telegram_document(path)
        if action == "upload_drive":
            return self._handle_upload_to_drive(file_ref=path)
        if action == "show_path":
            return ActionResult.ok(f"Đường dẫn file:\n{path}", path=path)
        if action == "delete_file":
            args = {"path": path}
            self.state.pending_tool = "delete_path"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn xóa file này?\n{path}",
                tool="delete_path",
                args=args,
            )
        return ActionResult.err("Lựa chọn file không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _build_email_action_menu(self, email: Dict[str, Any]) -> ActionResult:
        if not email or not email.get("id"):
            return ActionResult.err("Không tìm thấy email đã chọn.", code=ErrorCode.UNKNOWN)
        subject = str(email.get("subject") or "(không tiêu đề)")
        actions = ["read_email", "reply_email", "mark_read", "mark_unread", "archive_email"]
        choices = ["Đọc", "Trả lời", "Đánh dấu đã đọc", "Đánh dấu chưa đọc", "Lưu trữ"]
        self.state.selected_email_id = str(email.get("id") or "")
        self.state.last_choices = actions
        self.state.last_action = "email_action"
        self.state.last_action_meta = {"email": dict(email)}
        return self._mark_choice_buttons(
            ActionResult.need_choice(
                message=f"Bạn muốn làm gì với email này?\n{subject}",
                choices=choices,
                action="email_action",
            )
        )

    def _handle_email_action(self, action: str, email: Dict[str, Any]) -> ActionResult:
        message_id = str(email.get("id") or "").strip()
        if not message_id:
            return ActionResult.err("Không tìm thấy email đã chọn.", code=ErrorCode.UNKNOWN)
        self.state.selected_email_id = message_id
        if action == "read_email":
            return executor._handle_read_email(message_id=message_id)
        if action == "reply_email":
            return ActionResult.need_clarify(
                message="Bạn muốn trả lời email nội dung gì?",
                question="Gửi nội dung theo dạng: trả lời email rằng <nội dung>",
            )
        if action == "mark_read":
            return executor._handle_mark_email(message_id=message_id, unread=False)
        if action == "mark_unread":
            return executor._handle_mark_email(message_id=message_id, unread=True)
        if action == "archive_email":
            return executor._handle_archive_email(message_id=message_id)
        return ActionResult.err("Lựa chọn email không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _build_drive_action_menu(self, drive_file: Dict[str, Any]) -> ActionResult:
        if not drive_file or not drive_file.get("id"):
            return ActionResult.err("Không tìm thấy file Drive đã chọn.", code=ErrorCode.UNKNOWN)
        name = str(drive_file.get("name") or drive_file.get("id"))
        actions = ["drive_link", "drive_public_link", "drive_download", "drive_trash"]
        choices = ["Lấy link", "Link công khai", "Tải về máy", "Xóa khỏi Drive"]
        self.state.selected_drive_file_id = str(drive_file.get("id") or "")
        self.state.last_choices = actions
        self.state.last_action = "drive_action"
        self.state.last_action_meta = {"drive_file": dict(drive_file)}
        return self._mark_choice_buttons(
            ActionResult.need_choice(
                message=f"Bạn muốn làm gì với file Drive này?\n{name}",
                choices=choices,
                action="drive_action",
            )
        )

    def _handle_drive_action(self, action: str, drive_file: Dict[str, Any]) -> ActionResult:
        file_id = str(drive_file.get("id") or "").strip()
        if not file_id:
            return ActionResult.err("Không tìm thấy file Drive đã chọn.", code=ErrorCode.UNKNOWN)
        self.state.selected_drive_file_id = file_id
        if action == "drive_link":
            return executor._handle_drive_get_link(file_id=file_id, make_public=False)
        if action == "drive_public_link":
            return executor._handle_drive_get_link(file_id=file_id, make_public=True)
        if action == "drive_download":
            return executor._handle_drive_download(file_id=file_id, destination="")
        if action == "drive_trash":
            args = {"file_id": file_id}
            self.state.pending_tool = "trash_drive_file"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn xóa file Drive này?\n{drive_file.get('name') or file_id}",
                tool="trash_drive_file",
                args=args,
            )
        return ActionResult.err("Lựa chọn Drive không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _build_reminder_action_menu(self, reminder: Dict[str, Any]) -> ActionResult:
        if not reminder or not reminder.get("id"):
            return ActionResult.err("Không tìm thấy reminder đã chọn.", code=ErrorCode.UNKNOWN)
        title = str(reminder.get("title") or reminder.get("message") or reminder.get("id"))
        actions = ["complete_reminder", "snooze_10", "snooze_60", "edit_reminder", "delete_reminder"]
        choices = ["Hoàn thành", "Nhắc lại 10 phút", "Nhắc lại 1 giờ", "Sửa", "Xóa"]
        self.state.last_choices = actions
        self.state.last_action = "reminder_action"
        self.state.last_action_meta = {"reminder": dict(reminder)}
        return self._mark_choice_buttons(
            ActionResult.need_choice(
                message=f"Bạn muốn làm gì với reminder này?\n{title}",
                choices=choices,
                action="reminder_action",
            )
        )

    def _handle_reminder_action(self, action: str, reminder: Dict[str, Any]) -> ActionResult:
        reminder_id = str(reminder.get("id") or "").strip()
        if not reminder_id:
            return ActionResult.err("Không tìm thấy reminder đã chọn.", code=ErrorCode.UNKNOWN)
        if action == "complete_reminder":
            return self._handle_complete_reminder(reminder_id=reminder_id)
        if action == "snooze_10":
            return self._handle_snooze_reminder(reminder_id=reminder_id, minutes=10)
        if action == "snooze_60":
            return self._handle_snooze_reminder(reminder_id=reminder_id, minutes=60)
        if action == "edit_reminder":
            self._set_clarify_context("update_reminder", reminder_id=reminder_id, title="", due_at="")
            return ActionResult.need_clarify(
                message="Bạn muốn sửa reminder này thế nào?",
                question="Gửi nội dung mới hoặc thời gian mới cho reminder.",
            )
        if action == "delete_reminder":
            return self._handle_delete_reminder(reminder_id=reminder_id)
        return ActionResult.err("Lựa chọn reminder không hợp lệ.", code=ErrorCode.UNKNOWN)

    @staticmethod
    def _is_browser_process(app: Dict[str, Any]) -> bool:
        name = str(app.get("name") or "").strip().lower()
        display_name = str(app.get("display_name") or "").strip().lower()
        return name in {"msedge.exe", "chrome.exe", "firefox.exe", "brave.exe", "opera.exe"} or any(
            browser in display_name
            for browser in ("edge", "chrome", "firefox", "brave", "opera", "cốc cốc", "coc coc")
        )

    def _running_app_action_items(self, app: Dict[str, Any]) -> tuple[list[str], list[str]]:
        actions = ["focus_app", "close_app"]
        choices = ["Chuyển sang ứng dụng", "Đóng toàn bộ ứng dụng"]
        if self._is_browser_process(app):
            actions.extend([
                "youtube_play_pause",
                "youtube_next",
                "youtube_previous",
                "youtube_volume_up",
                "youtube_volume_down",
                "youtube_mute",
                "browser_reload",
                "browser_hard_reload",
                "browser_stop_loading",
                "browser_back",
                "browser_forward",
                "browser_scroll_down",
                "browser_scroll_up",
                "browser_page_top",
                "browser_page_bottom",
                "browser_zoom_in",
                "browser_zoom_out",
                "browser_zoom_reset",
                "browser_reopen_closed_tab",
                "browser_duplicate_tab",
                "browser_address_bar",
                "browser_address_text",
                "browser_find_in_page",
                "browser_find_text",
                "browser_type_text",
                "browser_send_text",
                "browser_tiktok_comment",
                "browser_tiktok_send_comment",
                "browser_bookmark",
                "browser_close_tab",
                "browser_next_tab",
                "browser_previous_tab",
                "browser_new_tab",
            ])
            choices.extend([
                "YouTube phát/dừng",
                "YouTube bài tiếp",
                "YouTube bài trước",
                "YouTube tăng âm",
                "YouTube giảm âm",
                "YouTube tắt tiếng",
                "Tải lại trang",
                "Tải lại bỏ cache",
                "Dừng tải trang",
                "Quay lại",
                "Tiến tới",
                "Cuộn xuống",
                "Cuộn lên",
                "Đầu trang",
                "Cuối trang",
                "Phóng to",
                "Thu nhỏ",
                "Zoom mặc định",
                "Mở lại tab vừa đóng",
                "Nhân đôi tab",
                "Thanh địa chỉ",
                "Nhập địa chỉ",
                "Tìm trong trang",
                "Tìm text",
                "Nhập text",
                "Nhập + Enter",
                "Comment TikTok",
                "Gửi comment TikTok",
                "Bookmark",
                "Đóng tab hiện tại",
                "Tab kế tiếp",
                "Tab trước",
                "Mở tab mới",
            ])
        return actions, choices

    def _remember_running_app_action_menu(self, app: Dict[str, Any]) -> tuple[list[str], list[str]]:
        actions, choices = self._running_app_action_items(app)
        self.state.last_choices = actions
        self.state.last_action = "running_app_action"
        self.state.last_action_meta = {"selected_app": dict(app)}
        return actions, choices

    def _attach_repeat_action_menu(self, result: ActionResult, app: Dict[str, Any]) -> ActionResult:
        if result.status != ActionStatus.SUCCESS:
            return result
        _actions, choices = self._remember_running_app_action_menu(app)
        result.data["choices"] = choices
        result.data["action"] = "running_app_action"
        result.data["telegram_choice_buttons"] = True
        result.data["choice_button_labels"] = True
        return result

    def _build_running_app_action_menu(self, app: Dict[str, Any]) -> ActionResult:
        name = str(app.get("display_name") or app.get("name") or "ứng dụng").strip()
        _actions, choices = self._remember_running_app_action_menu(app)
        result = ActionResult.need_choice(
            message=f"Bạn muốn làm gì với {name}?",
            choices=choices,
            action="running_app_action",
        )
        result.data["choice_button_labels"] = True
        return result

    def _handle_running_app_action(self, action: str, app: Dict[str, Any]) -> ActionResult:
        name = str(app.get("display_name") or app.get("name") or "ứng dụng").strip()
        pid = int(app.get("pid") or 0)
        pids = list(app.get("pids") or [])

        if action == "focus_app":
            return self._attach_repeat_action_menu(
                executor.focus_process_window(pid=pid, pids=pids, name=name),
                app,
            )

        if action == "close_app":
            args = {"pid": pid, "name": name, "pids": pids}
            self.state.pending_tool = "close_process"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn đóng toàn bộ {name}? Việc này có thể đóng nhiều cửa sổ/process của ứng dụng.",
                tool="close_process",
                args=args,
            )

        youtube_actions = {
            "youtube_play_pause": "play_pause",
            "youtube_next": "next",
            "youtube_previous": "previous",
            "youtube_volume_up": "volume_up",
            "youtube_volume_down": "volume_down",
            "youtube_mute": "mute",
        }
        youtube_action = youtube_actions.get(action)
        if youtube_action:
            return self._attach_repeat_action_menu(
                executor.youtube_control(youtube_action, pid=pid, pids=pids, name=name),
                app,
            )

        browser_actions = {
            "browser_close_tab": "close_tab",
            "browser_next_tab": "next_tab",
            "browser_previous_tab": "previous_tab",
            "browser_new_tab": "new_tab",
            "browser_reload": "reload",
            "browser_hard_reload": "hard_reload",
            "browser_stop_loading": "stop_loading",
            "browser_back": "back",
            "browser_forward": "forward",
            "browser_scroll_down": "scroll_down",
            "browser_scroll_up": "scroll_up",
            "browser_page_top": "page_top",
            "browser_page_bottom": "page_bottom",
            "browser_zoom_in": "zoom_in",
            "browser_zoom_out": "zoom_out",
            "browser_zoom_reset": "zoom_reset",
            "browser_reopen_closed_tab": "reopen_closed_tab",
            "browser_duplicate_tab": "duplicate_tab",
            "browser_address_bar": "address_bar",
            "browser_find_in_page": "find_in_page",
            "browser_bookmark": "bookmark",
        }
        browser_action = browser_actions.get(action)
        if browser_action:
            return self._attach_repeat_action_menu(
                executor.browser_control(browser_action, pid=pid, pids=pids, name=name),
                app,
            )

        text_actions = {
            "browser_address_text": ("address_text", True, "Bạn muốn mở địa chỉ hoặc từ khóa nào?"),
            "browser_find_text": ("find_text", False, "Bạn muốn tìm text gì trong trang?"),
            "browser_type_text": ("type_text", False, "Bạn muốn nhập text gì?"),
            "browser_send_text": ("type_text", True, "Bạn muốn nhập text gì rồi nhấn Enter?"),
            "browser_tiktok_comment": ("tiktok_comment", False, "Bạn muốn nhập comment TikTok gì?"),
            "browser_tiktok_send_comment": ("tiktok_comment", True, "Bạn muốn gửi comment TikTok gì?"),
        }
        text_action = text_actions.get(action)
        if text_action:
            action_name, submit, question = text_action
            self._set_clarify_context(
                "remote_text_action",
                action=action_name,
                submit=submit,
                pid=pid,
                pids=pids,
                name=name,
            )
            return ActionResult.need_clarify(message=question, question="Gửi đoạn text cần dùng.")

        return ActionResult.err("Lựa chọn hành động không hợp lệ.", code=ErrorCode.UNKNOWN)

    @staticmethod
    def _is_browser_window(window: Dict[str, Any]) -> bool:
        return Engine._is_browser_process(window)

    def _window_action_items(self, window: Dict[str, Any]) -> tuple[list[str], list[str]]:
        actions = ["focus_window", "close_window", "screenshot"]
        choices = ["Chuyển sang cửa sổ", "Đóng cửa sổ này", "Chụp màn hình"]
        if self._is_browser_window(window):
            actions.extend(
                [
                    "browser_reload",
                    "browser_hard_reload",
                    "browser_stop_loading",
                    "browser_back",
                    "browser_forward",
                    "browser_close_tab",
                    "browser_next_tab",
                    "browser_previous_tab",
                    "browser_new_tab",
                    "youtube_play_pause",
                    "youtube_next",
                    "youtube_previous",
                    "youtube_volume_up",
                    "youtube_volume_down",
                    "youtube_mute",
                    "browser_address_text",
                    "browser_find_text",
                    "browser_type_text",
                    "browser_send_text",
                    "browser_tiktok_comment",
                    "browser_tiktok_send_comment",
                ]
            )
            choices.extend(
                [
                    "Tải lại trang",
                    "Tải lại bỏ cache",
                    "Dừng tải trang",
                    "Quay lại",
                    "Tiến tới",
                    "Đóng tab hiện tại",
                    "Tab kế tiếp",
                    "Tab trước",
                    "Mở tab mới",
                    "YouTube phát/dừng",
                    "YouTube bài tiếp",
                    "YouTube bài trước",
                    "YouTube tăng âm",
                    "YouTube giảm âm",
                    "YouTube tắt tiếng",
                    "Nhập địa chỉ",
                    "Tìm text",
                    "Nhập text",
                    "Nhập + Enter",
                    "Comment TikTok",
                    "Gửi comment TikTok",
                ]
            )
        return actions, choices

    def _remember_window_action_menu(self, window: Dict[str, Any]) -> tuple[list[str], list[str]]:
        actions, choices = self._window_action_items(window)
        self.state.last_choices = actions
        self.state.last_action = "window_action"
        self.state.last_action_meta = {"selected_window": dict(window)}
        return actions, choices

    def _attach_repeat_window_menu(self, result: ActionResult, window: Dict[str, Any]) -> ActionResult:
        if result.status != ActionStatus.SUCCESS:
            return result
        _actions, choices = self._remember_window_action_menu(window)
        result.data["choices"] = choices
        result.data["action"] = "window_action"
        result.data["telegram_choice_buttons"] = True
        result.data["choice_button_labels"] = True
        return result

    def _build_window_action_menu(self, window: Dict[str, Any]) -> ActionResult:
        if not window or not int(window.get("hwnd") or 0):
            return ActionResult.err("Không tìm thấy cửa sổ đã chọn.", code=ErrorCode.UNKNOWN)
        title = str(window.get("title") or "cửa sổ").strip()
        app_name = str(window.get("display_name") or window.get("name") or "ứng dụng").strip()
        _actions, choices = self._remember_window_action_menu(window)
        result = ActionResult.need_choice(
            message=f"Bạn muốn làm gì với cửa sổ này?\n{title}\nỨng dụng: {app_name}",
            choices=choices,
            action="window_action",
        )
        result.data["choice_button_labels"] = True
        return result

    def _handle_window_action(self, action: str, window: Dict[str, Any]) -> ActionResult:
        hwnd = int(window.get("hwnd") or 0)
        title = str(window.get("title") or "").strip()
        name = str(window.get("display_name") or window.get("name") or "").strip()
        if not hwnd:
            return ActionResult.err("Không tìm thấy cửa sổ đã chọn.", code=ErrorCode.UNKNOWN)

        if action == "focus_window":
            return self._attach_repeat_window_menu(
                executor.focus_window(hwnd=hwnd, title=title),
                window,
            )

        if action == "close_window":
            args = {"hwnd": hwnd, "title": title, "name": name}
            self.state.pending_tool = "close_window"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn đóng đúng cửa sổ này?\n{title}",
                tool="close_window",
                args=args,
            )

        if action == "screenshot":
            return self._attach_repeat_window_menu(executor.take_screenshot(), window)

        youtube_actions = {
            "youtube_play_pause": "play_pause",
            "youtube_next": "next",
            "youtube_previous": "previous",
            "youtube_volume_up": "volume_up",
            "youtube_volume_down": "volume_down",
            "youtube_mute": "mute",
        }
        youtube_action = youtube_actions.get(action)
        if youtube_action:
            return self._attach_repeat_window_menu(
                executor.youtube_control(youtube_action, hwnd=hwnd, name=name),
                window,
            )

        browser_actions = {
            "browser_close_tab": "close_tab",
            "browser_next_tab": "next_tab",
            "browser_previous_tab": "previous_tab",
            "browser_new_tab": "new_tab",
            "browser_reload": "reload",
            "browser_hard_reload": "hard_reload",
            "browser_stop_loading": "stop_loading",
            "browser_back": "back",
            "browser_forward": "forward",
        }
        browser_action = browser_actions.get(action)
        if browser_action:
            return self._attach_repeat_window_menu(
                executor.browser_control(browser_action, hwnd=hwnd, name=name),
                window,
            )

        text_actions = {
            "browser_address_text": ("address_text", True, "Bạn muốn mở địa chỉ hoặc từ khóa nào?"),
            "browser_find_text": ("find_text", False, "Bạn muốn tìm text gì trong trang?"),
            "browser_type_text": ("type_text", False, "Bạn muốn nhập text gì?"),
            "browser_send_text": ("type_text", True, "Bạn muốn nhập text gì rồi nhấn Enter?"),
            "browser_tiktok_comment": ("tiktok_comment", False, "Bạn muốn nhập comment TikTok gì?"),
            "browser_tiktok_send_comment": ("tiktok_comment", True, "Bạn muốn gửi comment TikTok gì?"),
        }
        text_action = text_actions.get(action)
        if text_action:
            action_name, submit, question = text_action
            self._set_clarify_context(
                "remote_text_action",
                action=action_name,
                submit=submit,
                hwnd=hwnd,
                name=name,
            )
            return ActionResult.need_clarify(message=question, question="Gửi đoạn text cần dùng.")

        return ActionResult.err("Lựa chọn cửa sổ không hợp lệ.", code=ErrorCode.UNKNOWN)

    def _remember_browser_tab_action_menu(self, tab: Dict[str, Any]) -> tuple[list[str], list[str]]:
        actions = ["activate_tab", "reload_tab", "close_tab"]
        choices = ["Chuyển sang tab", "Tải lại tab", "Đóng tab"]
        existing_tabs = list((self.state.last_action_meta or {}).get("tabs") or [])
        self.state.last_choices = actions
        self.state.last_action = "browser_tab_action"
        self.state.last_action_meta = {"selected_tab": dict(tab), "tabs": existing_tabs or [dict(tab)]}
        return actions, choices

    def _attach_repeat_browser_tab_menu(self, result: ActionResult, tab: Dict[str, Any]) -> ActionResult:
        if result.status != ActionStatus.SUCCESS:
            return result
        _actions, choices = self._remember_browser_tab_action_menu(tab)
        result.data["choices"] = choices
        result.data["action"] = "browser_tab_action"
        result.data["telegram_choice_buttons"] = True
        result.data["choice_button_labels"] = True
        return result

    def _build_browser_tab_action_menu(self, tab: Dict[str, Any]) -> ActionResult:
        if not tab or not tab.get("id"):
            return ActionResult.err("Không tìm thấy tab đã chọn.", code=ErrorCode.UNKNOWN)
        title = str(tab.get("title") or "tab").strip()
        url = str(tab.get("url") or "").strip()
        _actions, choices = self._remember_browser_tab_action_menu(tab)
        result = ActionResult.need_choice(
            message=f"Bạn muốn làm gì với tab này?\n{title}\n{url}",
            choices=choices,
            action="browser_tab_action",
        )
        result.data["choice_button_labels"] = True
        return result

    def _handle_browser_tab_action(self, action: str, tab: Dict[str, Any]) -> ActionResult:
        if not tab or not tab.get("id"):
            return ActionResult.err("Không tìm thấy tab đã chọn.", code=ErrorCode.UNKNOWN)
        mapped = {
            "activate_tab": "activate",
            "reload_tab": "reload",
            "close_tab": "close",
        }.get(action)
        if not mapped:
            return ActionResult.err("Lựa chọn tab không hợp lệ.", code=ErrorCode.UNKNOWN)
        result = executor.browser_tab_control(
            mapped,
            tab_id=str(tab.get("id") or ""),
            port=int(tab.get("port") or 0),
            title=str(tab.get("title") or ""),
            url=str(tab.get("url") or ""),
        )
        if mapped == "close" or result.status != ActionStatus.SUCCESS:
            return result
        return self._attach_repeat_browser_tab_menu(result, tab)

    def _current_browser_window_context(self) -> Dict[str, Any]:
        meta = dict(self.state.last_action_meta or {})
        if self.state.last_action == "window_action":
            window = dict(meta.get("selected_window") or {})
            if window and self._is_browser_window(window):
                return {"hwnd": int(window.get("hwnd") or 0), "name": str(window.get("display_name") or window.get("name") or "")}
        if self.state.last_action == "running_app_action":
            app = dict(meta.get("selected_app") or {})
            if app and self._is_browser_process(app):
                return {
                    "pid": int(app.get("pid") or 0),
                    "pids": list(app.get("pids") or []),
                    "name": str(app.get("display_name") or app.get("name") or ""),
                }
        return {}

    def _start_workflow_draft(self, draft: Dict[str, Any]) -> ActionResult:
        self.state.pending_workflow_draft = dict(draft)
        message = (
            "Mình đã dựng draft workflow như sau:\n"
            f"{format_workflow_draft(self.state.pending_workflow_draft)}\n\n"
            "Bạn có thể nói: lưu lại, thêm ..., xóa bước 2, đổi bước 1 thành ..., đổi tên thành ..., mô tả là ..., hủy."
        )
        return ActionResult.need_clarify(
            message=message,
            question="Bạn muốn chỉnh gì tiếp hay lưu lại?",
        )

    def _save_pending_workflow_draft(self) -> ActionResult:
        draft = dict(self.state.pending_workflow_draft or {})
        if not draft:
            return ActionResult.need_clarify(
                message="Hiện chưa có draft workflow nào để lưu.",
                question="Bạn hãy nói kiểu: tạo workflow buổi sáng gồm ...",
            )
        try:
            service = WorkflowService()
            workflow_id = str(draft.get("workflow_id") or "").strip()
            if workflow_id:
                workflow = service.update_workflow(
                    workflow_id,
                    name=str(draft.get("name") or ""),
                    description=str(draft.get("description") or ""),
                    steps=list(draft.get("steps") or []),
                    enabled=bool(draft.get("enabled", True)),
                    continue_on_error=bool(draft.get("continue_on_error", False)),
                )
                message = f"Đã cập nhật workflow '{workflow.get('name') or workflow.get('id')}'."
            else:
                workflow = service.create_workflow(
                    name=str(draft.get("name") or ""),
                    description=str(draft.get("description") or ""),
                    steps=list(draft.get("steps") or []),
                    enabled=bool(draft.get("enabled", True)),
                    continue_on_error=bool(draft.get("continue_on_error", False)),
                )
                message = (
                    f"Đã lưu workflow '{workflow.get('name') or workflow.get('id')}'."
                )
            self.state.pending_workflow_draft = {}
            return ActionResult.ok(message, workflow=workflow)
        except Exception as e:
            return ActionResult.err(
                f"Không thể lưu workflow: {e}",
                code=ErrorCode.UNKNOWN,
            )

    def _consume_pending_workflow_draft(self, user_text: str) -> Optional[ActionResult]:
        draft = self.state.pending_workflow_draft or {}
        if not draft:
            return None
        try:
            action, next_draft, feedback = apply_workflow_draft_command(
                draft, user_text
            )
        except Exception as e:
            return ActionResult.need_clarify(
                message=f"{e}\n\nDraft hiện tại:\n{format_workflow_draft(draft)}",
                question="Bạn muốn chỉnh gì tiếp hay lưu lại?",
            )

        if action == "cancel":
            self.state.pending_workflow_draft = {}
            return ActionResult.ok("Đã hủy draft workflow hiện tại.")

        if action == "save":
            return self._save_pending_workflow_draft()

        if action == "show":
            return ActionResult.need_clarify(
                message=f"Draft workflow hiện tại:\n{format_workflow_draft(draft)}",
                question="Bạn muốn chỉnh gì tiếp hay lưu lại?",
            )

        if action in {"updated", "replace_draft"}:
            self.state.pending_workflow_draft = next_draft
            prefix = f"{feedback}\n\n" if feedback else ""
            return ActionResult.need_clarify(
                message=prefix + format_workflow_draft(next_draft),
                question="Bạn muốn chỉnh gì tiếp hay lưu lại?",
            )

        return ActionResult.need_clarify(
            message=f"Draft workflow hiện tại:\n{format_workflow_draft(draft)}",
            question="Bạn muốn chỉnh gì tiếp hay lưu lại?",
        )

    def _normalize_text(self, text: str) -> str:
        return " ".join((text or "").strip().lower().split())

    def _set_clarify_context(self, intent: str = "", **args: Any) -> None:
        self.state.pending_clarify_intent = intent
        self.state.pending_clarify_args = dict(args)

    def _clear_clarify_context(self) -> None:
        self.state.pending_clarify_intent = ""
        self.state.pending_clarify_args = {}

    def _consume_pending_clarify(self, user_text: str) -> Optional[ActionResult]:
        intent = (self.state.pending_clarify_intent or "").strip()
        if not intent:
            return None

        draft = dict(self.state.pending_clarify_args or {})
        normalized = self._normalize_text(user_text)

        if intent == "remote_text_action":
            text = (user_text or "").strip()
            submit = bool(draft.get("submit", False))
            target = str(draft.get("target") or "").strip()
            action = str(draft.get("action") or "target_text").strip()
            pid = int(draft.get("pid") or 0)
            pids = list(draft.get("pids") or [])
            hwnd = int(draft.get("hwnd") or 0)
            name = str(draft.get("name") or "")
            self._clear_clarify_context()
            if action == "tiktok_comment":
                return executor.browser_control(
                    "tiktok_comment_send" if submit else "tiktok_comment_text",
                    text=text,
                    pid=pid,
                    pids=pids,
                    hwnd=hwnd,
                    name=name,
                )
            if action == "address_text":
                return executor.browser_control("address_text", text=text, submit=True, pid=pid, pids=pids, hwnd=hwnd, name=name)
            if action == "find_text":
                return executor.browser_control("find_text", text=text, pid=pid, pids=pids, hwnd=hwnd, name=name)
            if action == "type_text":
                return executor.browser_control(
                    "type_text_enter" if submit else "type_text",
                    text=text,
                    pid=pid,
                    pids=pids,
                    hwnd=hwnd,
                    name=name,
                )
            if target:
                return self._handle_remote_target(
                    "send_text" if submit else "type_text",
                    target=target,
                    text=text,
                    submit=submit,
                )
            return self._handle_remote_target(
                "send_text" if submit else "type_text",
                text=text,
                submit=submit,
            )

        if intent == "create_reminder":
            due_at = (draft.get("due_at") or "").strip() or (
                _parse_reminder_datetime(user_text) or ""
            )
            title = (draft.get("title") or "").strip()
            if not title:
                followup_title = (_extract_reminder_content(user_text) or "").strip()
                if followup_title:
                    title = followup_title
            self._clear_clarify_context()
            return self._handle_create_reminder(
                title=title,
                message=title,
                due_at=due_at,
                timezone_name=str(draft.get("timezone_name") or "Asia/Saigon"),
            )

        if intent == "import_task_list":
            task_text = (user_text or "").strip()
            self._clear_clarify_context()
            return self._handle_import_task_list(
                task_text=task_text,
                timezone_name=str(draft.get("timezone_name") or "Asia/Saigon"),
            )

        if intent == "update_reminder":
            due_at = (draft.get("due_at") or "").strip()
            title = (draft.get("title") or "").strip()
            index = draft.get("index")

            try:
                fresh_decision = route(user_text)
            except Exception:
                fresh_decision = None

            if fresh_decision is not None:
                # User switched intent while being asked for clarification.
                if fresh_decision.type in {
                    RouteType.LIST_REMINDERS,
                    RouteType.CREATE_REMINDER,
                    RouteType.COMPLETE_REMINDER,
                    RouteType.DELETE_REMINDER,
                    RouteType.SNOOZE_REMINDER,
                    RouteType.IMPORT_TASK_LIST,
                }:
                    self._clear_clarify_context()
                    return None
                if fresh_decision.type == RouteType.UPDATE_REMINDER:
                    parsed_args = fresh_decision.args or {}
                    parsed_index = parsed_args.get("index")
                    if parsed_index is not None:
                        index = parsed_index
                    parsed_due_at = str(parsed_args.get("due_at") or "").strip()
                    if parsed_due_at:
                        due_at = parsed_due_at
                    parsed_title = str(parsed_args.get("title") or "").strip()
                    if parsed_title:
                        title = parsed_title
                    elif parsed_due_at:
                        # Avoid carrying placeholder text like "sửa nhắc hẹn" as a new title.
                        title_norm = self._normalize_text(title)
                        if any(
                            token in title_norm
                            for token in {
                                "sua",
                                "sửa",
                                "doi",
                                "đổi",
                                "cap nhat",
                                "cập nhật",
                                "reminder",
                                "nhac",
                                "nhắc",
                                "hen",
                                "hẹn",
                            }
                        ):
                            title = ""

            if index is None:
                index = _extract_reminder_index(user_text)
            if index is None:
                match = re.search(r"\b(\d+)\b", normalized)
                if match:
                    index = int(match.group(1))

            new_due_at = _parse_reminder_datetime(user_text) or ""
            if new_due_at:
                due_at = new_due_at
            followup_title = (_extract_reminder_content(user_text) or "").strip()
            if followup_title:
                title = followup_title
            self._clear_clarify_context()
            return self._handle_update_reminder(
                index=index,
                reminder_id=str(draft.get("reminder_id") or ""),
                title=title,
                message=title,
                due_at=due_at,
            )

        if intent == "snooze_reminder":
            minutes = int(draft.get("minutes") or 0) or _extract_snooze_minutes(
                user_text
            )
            self._clear_clarify_context()
            return self._handle_snooze_reminder(
                index=draft.get("index"),
                reminder_id=str(draft.get("reminder_id") or ""),
                minutes=minutes,
            )

        if intent == "complete_reminder":
            match = re.search(r"\b(\d+)\b", normalized)
            index = int(match.group(1)) if match else draft.get("index")
            self._clear_clarify_context()
            return self._handle_complete_reminder(
                index=index, reminder_id=str(draft.get("reminder_id") or "")
            )

        if intent == "delete_reminder":
            match = re.search(r"\b(\d+)\b", normalized)
            index = int(match.group(1)) if match else draft.get("index")
            self._clear_clarify_context()
            return self._handle_delete_reminder(
                index=index, reminder_id=str(draft.get("reminder_id") or "")
            )

        if intent == "custom_app_missing":
            if any(
                token in normalized
                for token in {"ung dung", "ứng dụng", "app", "chon app", "chọn app"}
            ):
                self._clear_clarify_context()
                return ActionResult.err(
                    f"Không tìm thấy ứng dụng '{draft.get('app_name') or draft.get('alias') or ''}'. Hãy chọn file .exe hoặc .lnk để lưu cho lần sau.",
                    code=ErrorCode.APP_NOT_FOUND,
                    prompt_custom_app_selection=True,
                    custom_app_alias=str(
                        draft.get("alias") or draft.get("app_name") or ""
                    ).strip(),
                    custom_app_reason=str(draft.get("reason") or "not_found"),
                    custom_app_target_path=str(draft.get("target_path") or ""),
                    custom_app_display_name=str(
                        draft.get("display_name") or draft.get("app_name") or ""
                    ).strip(),
                    custom_app_requires_confirmation=False,
                )
            if any(
                token in normalized
                for token in {
                    "web",
                    "google",
                    "tim web",
                    "tìm web",
                    "trinh duyet",
                    "trình duyệt",
                }
            ):
                self._clear_clarify_context()
                return executor.web_search(str(draft.get("app_name") or "").strip())
            if normalized in {"khong", "không", "huy", "hủy", "thoi", "thôi", "cancel"}:
                self._clear_clarify_context()
                return ActionResult.ok("Đã hủy thao tác mở app.")
            return ActionResult.need_clarify(
                message="Mình chưa rõ bạn muốn mở ứng dụng trên máy hay tìm trên web.",
                question="Bạn muốn mở ứng dụng và chọn file .exe/.lnk, hay tìm trên web?",
            )

        return None

    def _looks_like_general_question(self, user_text: str) -> bool:
        t = self._normalize_text(user_text)
        if not t or len(t) < 4:
            return False

        command_hints = {
            "mở",
            "open",
            "đóng",
            "tắt",
            "thoát",
            "xóa",
            "delete",
            "remove",
            "tìm",
            "tìm kiếm",
            "search",
            "tra cứu",
            "google",
            "youtube",
            "file",
            "tệp",
            "tập tin",
            "thư mục",
            "folder",
            "desktop",
            "documents",
            "downloads",
        }
        if any(h in t for h in command_hints):
            return False

        question_starts = (
            "ai ",
            "gì ",
            "tại sao",
            "vì sao",
            "bao nhiêu",
            "ở đâu",
            "khi nào",
            "cách ",
            "how ",
            "what ",
            "why ",
            "who ",
            "where ",
            "when ",
        )
        if "?" in user_text or t.startswith(question_starts):
            return True

        # Detect "X là gì", "X là ai", "X nghĩa là gì", ... anywhere in sentence
        question_anywhere = (
            "là gì",
            "là ai",
            "là sao",
            "nghĩa là",
            "có nghĩa",
            "khác gì",
            "khác nhau",
            "bao lâu",
            "thế nào",
            "the nao",
            "như thế nào",
            "ra sao",
            "ở đâu",
            "bằng bao nhiêu",
        )
        if any(h in t for h in question_anywhere):
            return True

        # Phát hiện câu yêu cầu chatbot (giải thích, tóm tắt, dịch, viết, ...)
        chat_hints = (
            "giải thích",
            "giai thich",
            "tóm tắt",
            "tom tat",
            "dịch ",
            "dich ",
            "viết ",
            "viet ",
            "cho tôi",
            "cho mình ",
            "nói cho",
            "hãy ",
            "hay ",
            "so sánh",
            "so sanh",
            "liệt kê",
            "liet ke",
            "phân tích",
            "phan tich",
            "mô tả",
            "mo ta",
            "define ",
            "explain ",
            "describe ",
            "summarize ",
            "translate ",
            "write ",
            "compare ",
            "list ",
            "tell me",
            "give me",
            "help me",
            "can you",
            "could you",
            "please ",
        )
        return any(t.startswith(h) or f" {h}" in t for h in chat_hints)

    def _is_dangerous_input(self, user_text: str) -> bool:
        t = self._normalize_text(user_text)
        if not t:
            return False

        if any(s in t for s in DANGEROUS_SUBSTRINGS):
            return True

        has_delete_intent = any(v in t for v in DELETE_INTENTS)
        if has_delete_intent and re.search(r"[a-z]:\\", user_text, re.IGNORECASE):
            return True

        return False

    def _is_clear_conversation_command(self, user_text: str) -> bool:
        t = self._normalize_text(user_text)
        return t in {
            "xóa hội thoại",
            "xoa hoi thoai",
            "xóa chat",
            "xoa chat",
            "xóa đoạn chat",
            "xoa doan chat",
            "clear chat",
            "clear conversation",
            "reset chat",
        }

    def _clear_conversation(self) -> ActionResult:
        self.state.clear_conversation_context()
        return ActionResult.ok(
            "Đã xóa hội thoại hiện tại.",
            clear_chat=True,
        )

    def _append_similar_command_suggestions(
        self, res: ActionResult, user_text: str
    ) -> ActionResult:
        if res.status != ActionStatus.NEED_CLARIFY:
            return res

        message = str(res.message or "")
        question = str((res.data or {}).get("question") or "")
        target_text = f"{message}\n{question}".lower()
        generic_hints = (
            "chưa hiểu",
            "chưa hiểu rõ",
            "diễn đạt lại",
            "nói rõ hơn",
            "muốn mình làm gì",
        )
        if not any(hint in target_text for hint in generic_hints):
            return res

        try:
            suggestions = self.chat_sessions.suggest_successful_commands(
                user_text, limit=5
            )
        except Exception:
            return res

        if not suggestions:
            return res

        suggestion_lines = "\n".join(f"- {item}" for item in suggestions)
        enriched_message = (
            f"{message}\n\nCó thể bạn đang muốn làm:\n" f"{suggestion_lines}"
        )
        enriched_data = dict(res.data or {})
        enriched_data["suggestions"] = suggestions
        return ActionResult(
            status=res.status,
            message=enriched_message,
            data=enriched_data,
            error_code=res.error_code,
            dev_message=res.dev_message,
        )

    def _consume_personal_context(self, user_text: str) -> Optional[ActionResult]:
        normalized = self._normalize_text(user_text)

        if normalized in {
            "mở lại file lúc nãy",
            "mo lai file luc nay",
            "mở lại file vừa rồi",
            "mo lai file vua roi",
            "mở lại file trước",
            "mo lai file truoc",
        }:
            last_file = self.memory.get_latest_metadata_value("path")
            if last_file:
                return executor.open_file(path=str(last_file))
            return ActionResult.need_clarify(
                message="Mình chưa thấy file gần đây nào để mở lại.",
                question="Bạn muốn mở lại file nào?",
            )
        return None

    def _resolve_email_recipient(self, to: str) -> str:
        candidate = (to or "").strip()
        context_tokens = (
            "người đó",
            "nguoi do",
            "người vừa rồi",
            "nguoi vua roi",
            "mail trước",
            "mail truoc",
        )
        if not candidate:
            normalized = self._normalize_text(self._current_user_text)
            if any(token in normalized for token in context_tokens):
                return str(self.memory.get_latest_metadata_value("to") or "").strip()
            return ""
        normalized_candidate = self._normalize_text(candidate)
        if any(token in normalized_candidate for token in context_tokens):
            return str(self.memory.get_latest_metadata_value("to") or "").strip()
        if re.fullmatch(r"[\w\.-]+@[\w\.-]+", candidate):
            return candidate
        entity = self.memory.get_entity(candidate)
        if isinstance(entity, dict):
            value = str(entity.get("value") or "").strip()
            if value:
                return value
        return candidate

    def handle_turn(
        self,
        user_text: str,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> ActionResult:
        user_text = user_text or ""
        self._current_user_text = user_text
        self._current_route_decision = None
        self.logger.info(f"USER: {user_text}")

        try:
            self._raise_if_cancelled(cancel_check)

            if self._is_clear_conversation_command(user_text):
                res = self._clear_conversation()
                self._log_result(res)
                return res

            if not self._maybe_interrupt_confirmation(user_text):
                r1 = self._consume_confirmation(user_text)
                if r1:
                    self._log_result(r1)
                    return r1

            r2 = self._consume_choice(user_text)
            if r2:
                self._log_result(r2)
                return r2

            if self.state.pending_clarify_intent == "custom_app_missing":
                normalized_user = self._normalize_text(user_text)
                if len((user_text or "").strip().split()) >= 2:
                    try:
                        fresh_decision = route(user_text)
                    except Exception:
                        fresh_decision = None
                    if fresh_decision is not None and fresh_decision.type not in {
                        RouteType.WEB_SEARCH,
                        RouteType.FALLBACK_TO_LLM,
                    }:
                        self._clear_clarify_context()

            r3 = self._consume_pending_clarify(user_text)
            if r3:
                self._log_result(r3)
                return r3

            r3b = self._consume_pending_workflow_draft(user_text)
            if r3b:
                self._log_result(r3b)
                return r3b

            r4 = self._consume_personal_context(user_text)
            if r4:
                self._log_result(r4)
                return r4

            short_text = self._normalize_text(user_text)
            if len((user_text or "").strip()) < 4 and short_text not in {"esc", "tab", "f5"}:
                res = ActionResult.need_clarify(
                    message="Bạn có thể nói rõ hơn không?",
                    question="Bạn muốn mình làm gì?",
                )
                res = self._append_similar_command_suggestions(res, user_text)
                self._log_result(res)
                return res

            if self._is_dangerous_input(user_text):
                res = ActionResult.err(
                    "Mình không thể thực hiện yêu cầu có nguy cơ xóa dữ liệu hệ thống hoặc ổ đĩa.",
                    code=ErrorCode.NOT_ALLOWED,
                )
                self._log_result(res)
                return res

            if looks_like_create_workflow_request(user_text):
                try:
                    draft = parse_create_workflow_request(user_text)
                    res = self._start_workflow_draft(draft)
                except Exception as e:
                    res = ActionResult.need_clarify(
                        message=f"Không thể tạo draft workflow: {e}",
                        question="Bạn hãy nói kiểu: tạo workflow buổi sáng gồm mở edge, mở facebook, mở youtube.",
                    )
                self._log_result(res)
                return res

            self._raise_if_cancelled(cancel_check)
            decision = route(user_text)
            self._current_route_decision = decision

            self.logger.info(
                f"ROUTE: type={decision.type} confidence={getattr(decision, 'confidence', None)} "
                f"reason={getattr(decision, 'reason', None)} args={getattr(decision, 'args', None)}"
            )

            if decision.type == RouteType.CHAT:
                res = self._handle_chat(
                    decision.args.get("message") or user_text,
                    cancel_check=cancel_check,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.YOUTUBE_SEARCH:
                res = executor.youtube_play_first(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.OPEN_URL:
                res = executor.open_url(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.SCREENSHOT:
                res = executor.take_screenshot()
                if res.status == ActionStatus.SUCCESS:
                    res = self._build_screen_action_menu(res)
                self._log_result(res)
                return res

            if decision.type == RouteType.SYSTEM_STATUS:
                res = executor.system_status()
                self._log_result(res)
                return res

            if decision.type == RouteType.REMOTE_OVERVIEW:
                res = executor.remote_overview()
                self._log_result(res)
                return res

            if decision.type == RouteType.REMOTE_PRESET:
                action = str(decision.args.get("action") or "").strip()
                if action == "sleep":
                    args = {"action": action}
                    self.state.pending_tool = "remote_preset"
                    self.state.pending_args = args
                    res = ActionResult.need_confirm(
                        message="Bạn có chắc muốn bật preset đi ngủ? Máy sẽ mute, khóa màn hình, tắt màn hình và hẹn tắt máy sau 2 giờ. Windows sẽ không hỏi lại khi tới giờ.",
                        tool="remote_preset",
                        args=args,
                    )
                else:
                    res = executor.remote_preset(**decision.args)
                    if action == "cleanup" and res.status == ActionStatus.NEED_CHOICE:
                        processes = list(res.data.get("processes") or [])
                        self.state.last_choices = [str(item.get("pid") or "") for item in processes]
                        self.state.last_action = "running_app"
                        self.state.last_action_meta = {"processes": processes}
                self._log_result(res)
                return res

            if decision.type == RouteType.SCHEDULED_OPEN:
                args = dict(decision.args)
                action = str(args.get("action") or "").strip()
                if action in {"cancel", "status", "list"}:
                    res = executor.schedule_open(**args)
                    self._log_result(res)
                    return res

                delay_seconds = int(args.get("delay_seconds") or 0)
                target_at = str(args.get("target_at") or "")
                repeat = str(args.get("repeat") or "").strip().lower()
                warning_minutes = executor._coerce_warning_minutes(
                    args.get("warning_minutes"), delay_seconds
                )
                target_label = executor._format_power_target(target_at)
                delay_label = executor._format_power_delay(delay_seconds)
                action_label = executor._format_scheduled_open_action(action, args)
                when_label = f"lúc {target_label}" if target_label else f"sau {delay_label}"
                self.state.pending_tool = "schedule_open"
                self.state.pending_args = args
                extra = ""
                if repeat == "daily":
                    extra += " Lịch này sẽ lặp lại hàng ngày."
                if warning_minutes > 0:
                    extra += f" App sẽ chỉ cảnh báo trước {warning_minutes} phút."
                res = ActionResult.need_confirm(
                    message=(
                        f"Bạn có chắc muốn hẹn {action_label} {when_label}? "
                        "AT Assistant sẽ tự mở khi tới giờ nếu app còn đang chạy nền."
                        + extra
                    ),
                    tool="schedule_open",
                    args=args,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.SCHEDULED_CLOSE:
                args = dict(decision.args)
                action = str(args.get("action") or "").strip()
                if bool(args.get("missing_schedule")):
                    res = ActionResult.need_clarify(
                        message="Mình chưa rõ bạn muốn hẹn đóng app/web lúc nào.",
                        question="Bạn muốn đóng sau bao lâu hoặc vào giờ nào? Ví dụ: đóng chrome sau 30 phút, tắt web lúc 23h30.",
                    )
                    self._log_result(res)
                    return res
                if action in {"cancel", "status", "list"}:
                    res = executor.schedule_close(**args)
                    self._log_result(res)
                    return res

                delay_seconds = int(args.get("delay_seconds") or 0)
                target_at = str(args.get("target_at") or "")
                repeat = str(args.get("repeat") or "").strip().lower()
                warning_minutes = executor._coerce_warning_minutes(
                    args.get("warning_minutes"), delay_seconds
                )
                target_label = executor._format_power_target(target_at)
                delay_label = executor._format_power_delay(delay_seconds)
                action_label = executor._format_scheduled_close_action(action, args)
                when_label = f"lúc {target_label}" if target_label else f"sau {delay_label}"
                self.state.pending_tool = "schedule_close"
                self.state.pending_args = args
                extra = ""
                if repeat == "daily":
                    extra += " Lịch này sẽ lặp lại hàng ngày."
                if warning_minutes > 0:
                    extra += f" App sẽ chỉ cảnh báo trước {warning_minutes} phút."
                res = ActionResult.need_confirm(
                    message=(
                        f"Bạn có chắc muốn hẹn {action_label} {when_label}? "
                        "Sau khi bạn đồng ý, AT Assistant sẽ tự đóng khi tới giờ nếu app còn đang chạy nền."
                        + extra
                    ),
                    tool="schedule_close",
                    args=args,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.SMART_CLOSE:
                args = dict(decision.args)
                action = str(args.get("action") or "").strip()
                labels = {
                    "close_heavy_apps": "đóng các app đang dùng nhiều RAM",
                    "close_distracting_web": "đóng các tab web giải trí",
                    "close_except": "đóng các app đang mở trừ danh sách giữ lại",
                }
                if action == "close_except" and not list(args.get("except_apps") or []):
                    res = ActionResult.need_clarify(
                        message="Mình chưa rõ app nào cần giữ lại.",
                        question="Ví dụ: đóng tất cả trừ chrome và vscode.",
                    )
                    self._log_result(res)
                    return res
                self.state.pending_tool = "smart_close"
                self.state.pending_args = args
                res = ActionResult.need_confirm(
                    message=f"Bạn có chắc muốn {labels.get(action, action)}? Thao tác này có thể đóng cửa sổ/tab đang mở.",
                    tool="smart_close",
                    args=args,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.CLIPBOARD_BRIDGE:
                res = executor.clipboard_bridge(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.LAZY_IDLE_GUARD:
                args = dict(decision.args)
                action = str(args.get("action") or "").strip()
                if action in {"status", "disable", "cancel", "off"}:
                    res = executor.lazy_idle_guard(**args)
                    self._log_result(res)
                    return res
                self.state.pending_tool = "lazy_idle_guard"
                self.state.pending_args = args
                res = ActionResult.need_confirm(
                    message=(
                        "Bạn có chắc muốn bật chế độ ngủ quên? Khi tới khung giờ đã cấu hình, "
                        "nếu máy idle đủ lâu thì app sẽ cảnh báo, chờ thêm rồi tự xử lý theo cấu hình."
                    ),
                    tool="lazy_idle_guard",
                    args=args,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.MEDIA_CONTROL:
                res = executor.media_control(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.YOUTUBE_CONTROL:
                args = dict(decision.args)
                args.update({k: v for k, v in self._current_browser_window_context().items() if v})
                res = executor.youtube_control(**args)
                self._log_result(res)
                return res

            if decision.type == RouteType.BROWSER_CONTROL:
                args = dict(decision.args)
                args.update({k: v for k, v in self._current_browser_window_context().items() if v})
                res = executor.browser_control(**args)
                self._log_result(res)
                return res

            if decision.type == RouteType.KEYBOARD_CONTROL:
                res = executor.keyboard_control(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.MOUSE_CONTROL:
                res = executor.mouse_control(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.REMOTE_TARGET:
                res = self._handle_remote_target(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_RUNNING_APPS:
                res = executor.list_running_apps(**decision.args)
                if res.status == ActionStatus.NEED_CHOICE:
                    processes = list(res.data.get("processes") or [])
                    self.state.last_choices = [str(item.get("pid") or "") for item in processes]
                    self.state.last_action = "running_app"
                    self.state.last_action_meta = {"processes": processes}
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_OPEN_WINDOWS:
                res = executor.list_open_windows(**decision.args)
                if res.status == ActionStatus.NEED_CHOICE:
                    windows = list(res.data.get("windows") or [])
                    self.state.last_choices = [str(item.get("hwnd") or "") for item in windows]
                    self.state.last_action = "open_window"
                    self.state.last_action_meta = {"windows": windows}
                self._log_result(res)
                return res

            if decision.type == RouteType.WINDOW_CONTROL:
                action = str(decision.args.get("action") or "").strip()
                index = int(decision.args.get("index") or 0)
                windows = list(self.state.last_action_meta.get("windows") or [])
                if self.state.last_action not in {"open_window", "window_action"} or index < 1 or index > len(windows):
                    res = ActionResult.need_clarify(
                        message="Mình chưa có danh sách cửa sổ đang mở để chọn.",
                        question="Bạn hãy gửi: cửa sổ đang mở",
                    )
                    self._log_result(res)
                    return res
                window = dict(windows[index - 1])
                if action == "close_by_index":
                    args = {
                        "hwnd": int(window.get("hwnd") or 0),
                        "title": str(window.get("title") or ""),
                        "name": str(window.get("display_name") or window.get("name") or ""),
                    }
                    self.state.pending_tool = "close_window"
                    self.state.pending_args = args
                    res = ActionResult.need_confirm(
                        message=f"Bạn có chắc muốn đóng đúng cửa sổ này?\n{args['title']}",
                        tool="close_window",
                        args=args,
                    )
                    self._log_result(res)
                    return res
                res = ActionResult.err("Lệnh cửa sổ không hợp lệ.", code=ErrorCode.UNKNOWN)
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_BROWSER_TABS:
                res = executor.list_browser_tabs(**decision.args)
                if res.status == ActionStatus.NEED_CHOICE:
                    tabs = list(res.data.get("tabs") or [])
                    self.state.last_choices = [str(item.get("id") or "") for item in tabs]
                    self.state.last_action = "browser_tab"
                    self.state.last_action_meta = {"tabs": tabs}
                self._log_result(res)
                return res

            if decision.type == RouteType.BROWSER_TAB_CONTROL:
                index = int(decision.args.get("index") or 0)
                action = str(decision.args.get("action") or "").strip()
                tabs = list(self.state.last_action_meta.get("tabs") or [])
                if self.state.last_action not in {"browser_tab", "browser_tab_action"} or index < 1 or index > len(tabs):
                    res = ActionResult.need_clarify(
                        message="Mình chưa có danh sách tab để chọn.",
                        question="Bạn hãy gửi: tab edge đang mở",
                    )
                    self._log_result(res)
                    return res
                tab = dict(tabs[index - 1])
                if action == "close":
                    args = {
                        "action": "close",
                        "tab_id": str(tab.get("id") or ""),
                        "port": int(tab.get("port") or 0),
                        "title": str(tab.get("title") or ""),
                        "url": str(tab.get("url") or ""),
                    }
                    self.state.pending_tool = "browser_tab_control"
                    self.state.pending_args = args
                    res = ActionResult.need_confirm(
                        message=f"Bạn có chắc muốn đóng tab này?\n{args['title']}",
                        tool="browser_tab_control",
                        args=args,
                    )
                else:
                    res = executor.browser_tab_control(
                        action,
                        tab_id=str(tab.get("id") or ""),
                        port=int(tab.get("port") or 0),
                        title=str(tab.get("title") or ""),
                        url=str(tab.get("url") or ""),
                    )
                    if res.status == ActionStatus.SUCCESS:
                        res = self._attach_repeat_browser_tab_menu(res, tab)
                self._log_result(res)
                return res

            if decision.type == RouteType.CLOSE_RUNNING_APP:
                index = int(decision.args.get("index") or 0)
                processes = list(self.state.last_action_meta.get("processes") or [])
                if self.state.last_action not in {"running_app", "close_process"} or index < 1 or index > len(processes):
                    res = ActionResult.need_clarify(
                        message="Mình chưa có danh sách app đang chạy để chọn.",
                        question="Bạn hãy gửi: máy đang chạy gì",
                    )
                    self._log_result(res)
                    return res
                proc = processes[index - 1]
                args = {
                    "pid": int(proc.get("pid") or 0),
                    "name": str(proc.get("display_name") or proc.get("name") or ""),
                    "pids": list(proc.get("pids") or []),
                }
                self.state.pending_tool = "close_process"
                self.state.pending_args = args
                res = ActionResult.need_confirm(
                    message=f"Bạn có chắc muốn đóng toàn bộ {args['name']}? Việc này có thể đóng nhiều cửa sổ/process của ứng dụng.",
                    tool="close_process",
                    args=args,
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.SYSTEM_POWER:
                action = str(decision.args.get("action") or "").strip()
                labels = {
                    "shutdown": "tắt máy",
                    "restart": "khởi động lại máy",
                    "sleep": "chuyển máy sang sleep sâu",
                    "sleep_deep": "chuyển máy sang sleep sâu. Telegram có thể mất kết nối đến khi máy được bật lại",
                    "hibernate": "chuyển máy sang hibernate",
                    "light_sleep": "khóa máy và tắt màn hình",
                    "monitor_off": "tắt màn hình",
                    "lock": "khóa máy",
                    "night_sleep": "bật chế độ ngủ đêm",
                }
                args = dict(decision.args)
                if bool(args.get("missing_schedule")):
                    res = ActionResult.need_clarify(
                        message="Mình chưa rõ bạn muốn hẹn tắt máy lúc nào.",
                        question="Bạn muốn tắt máy sau bao lâu hoặc vào giờ nào? Ví dụ: tắt máy sau 30 phút, tắt máy lúc 23h30, ngủ đêm 2 tiếng.",
                    )
                    self._log_result(res)
                    return res

                if action in {"cancel_shutdown", "shutdown_status", "power_status"}:
                    res = executor.system_power(**args)
                    self._log_result(res)
                    return res

                delay_seconds = int(args.get("delay_seconds") or 0)
                target_at = str(args.get("target_at") or "")
                repeat = str(args.get("repeat") or "").strip().lower()
                warning_minutes = executor._coerce_warning_minutes(
                    args.get("warning_minutes"), delay_seconds
                )
                if delay_seconds > 0:
                    delay_label = executor._format_power_delay(delay_seconds)
                    target_label = executor._format_power_target(target_at)
                    if action == "night_sleep":
                        label = f"bật chế độ ngủ đêm và hẹn tắt máy sau {delay_label}"
                    elif target_label:
                        label = f"hẹn {labels.get(action, action)} lúc {target_label}"
                    else:
                        label = f"hẹn {labels.get(action, action)} sau {delay_label}"
                else:
                    label = labels.get(action, action)
                self.state.pending_tool = "system_power"
                self.state.pending_args = args
                confirm_message = f"Bạn có chắc muốn {label}?"
                if repeat == "daily":
                    confirm_message += " Lịch này sẽ lặp lại hàng ngày."
                if warning_minutes > 0:
                    confirm_message += f" App sẽ chỉ cảnh báo trước {warning_minutes} phút."
                if delay_seconds > 0:
                    if repeat == "daily":
                        confirm_message += " AT Assistant cần còn chạy nền tới giờ đó."
                    else:
                        confirm_message += " Sau khi bạn đồng ý, Windows sẽ tự thực hiện khi tới giờ và không hỏi lại."
                res = ActionResult.need_confirm(
                    message=confirm_message,
                    tool="system_power",
                    args=args,
                )
                if action == "shutdown" and delay_seconds <= 0:
                    res.data["telegram_command_buttons"] = [
                        {"text": "Sau 30p", "command": "tat may sau 30 phut"},
                        {"text": "Sau 1h", "command": "tat may sau 1 gio"},
                        {"text": "23:30", "command": "tat may luc 23h30"},
                        {"text": "Hang ngay 23:30", "command": "tat may luc 23h30 hang ngay canh bao truoc 15 phut"},
                        {"text": "Huy lich", "command": "huy hen gio tat may"},
                    ]
                self._log_result(res)
                return res

            if decision.type == RouteType.OPEN_APP:
                res = executor.open_app(**decision.args)
                if res.status == ActionStatus.SUCCESS:
                    app = (
                        res.data.get("app") or decision.args.get("app_name") or ""
                    ).lower()
                    exe = res.data.get("exe")
                    pid = res.data.get("pid")
                    proc = res.data.get("process_name")
                    if not proc and exe:
                        import os

                        proc = os.path.basename(exe)

                    if app:
                        self.state.opened_apps.setdefault(app, []).append(
                            {"exe": exe, "process_name": proc, "pid": pid}
                        )
                elif res.error_code == ErrorCode.APP_NOT_FOUND and not bool(
                    res.data.get("prompt_custom_app_selection")
                ):
                    # Unknown app — scan installed apps and suggest candidates (Option B)
                    app_query = decision.args.get("app_name", "")
                    try:
                        candidates = InstalledAppsService().search(app_query, limit=5)
                    except Exception:
                        candidates = []

                    if candidates:
                        display_choices = [
                            f"{c['name']} — {c['exe']}" for c in candidates
                        ]
                        # Store exe paths so _consume_choice can open them directly
                        self.state.last_choices = [c["exe"] for c in candidates]
                        self.state.last_action = "open_installed_app"
                        self.state.last_action_meta = {
                            "app_name": app_query,
                            "app_key": (app_query or "")
                            .strip()
                            .lower()
                            .replace(" ", "_"),
                        }
                        res = ActionResult.need_choice(
                            message=(
                                f"Không tìm thấy '{app_query}' trong danh sách ứng dụng đã cài."
                                f"\nTìm thấy {len(candidates)} kết quả gần đúng trên máy bạn:"
                            ),
                            choices=display_choices,
                            action="open_installed_app",
                        )
                if res.error_code == ErrorCode.APP_NOT_FOUND and bool(
                    res.data.get("custom_app_requires_confirmation")
                ):
                    app_query = str(
                        res.data.get("custom_app_alias")
                        or decision.args.get("app_name")
                        or ""
                    ).strip()
                    self._set_clarify_context(
                        "custom_app_missing",
                        app_name=app_query,
                        alias=str(
                            res.data.get("custom_app_alias") or app_query
                        ).strip(),
                        reason=str(res.data.get("custom_app_reason") or "not_found"),
                        target_path=str(res.data.get("custom_app_target_path") or ""),
                        display_name=str(
                            res.data.get("custom_app_display_name") or app_query
                        ).strip(),
                    )
                    res = ActionResult.need_clarify(
                        message=f"Mình chưa chắc '{app_query}' là tên ứng dụng trên máy.",
                        question="Bạn muốn mở ứng dụng này và chọn file .exe/.lnk nếu chưa có, hay muốn tìm trên web?",
                    )
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_CUSTOM_APPS:
                res = executor._handle_list_custom_apps()
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_CUSTOM_APP:
                res = executor._handle_delete_custom_app(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.WEB_SEARCH:
                res = executor.web_search(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.OPEN_FILE_PATH:
                if not executor.is_safe_path(decision.args.get("path", "")):
                    res = ActionResult.err(
                        "Không cho phép mở file ngoài thư mục an toàn (Desktop/Documents/Downloads).",
                        code=ErrorCode.NOT_ALLOWED,
                    )
                    self._log_result(res)
                    return res
                res = executor.open_file(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.FIND_FILE:
                res = self._handle_find_then_maybe_open(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_FILE_NAME:
                res = self._handle_find_then_delete(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.COPY_ENTRY:
                res = self._handle_find_then_copy(
                    query=decision.args.get("query", ""),
                    destination=decision.args.get("destination", ""),
                    extensions=decision.args.get("extensions"),
                    include_dirs=bool(decision.args.get("include_dirs", False)),
                    only_dirs=bool(decision.args.get("only_dirs", False)),
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.MOVE_ENTRY:
                res = self._handle_find_then_move(
                    query=decision.args.get("query", ""),
                    destination=decision.args.get("destination", ""),
                    extensions=decision.args.get("extensions"),
                    include_dirs=bool(decision.args.get("include_dirs", False)),
                    only_dirs=bool(decision.args.get("only_dirs", False)),
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.CLOSE_APP:
                app = (decision.args.get("app_name") or "").lower()
                close_all = bool(decision.args.get("close_all"))
                args = dict(decision.args)

                if close_all:
                    self.state.opened_apps.pop(app, None)
                else:
                    lst = self.state.opened_apps.get(app) or []
                    hint = None
                    if lst:
                        hint = lst.pop()
                    if not lst and app in self.state.opened_apps:
                        self.state.opened_apps.pop(app, None)
                    if hint:
                        args["_hint"] = hint

                self.state.pending_tool = "close_app"
                self.state.pending_args = args
                msg = (
                    f"Bạn có chắc muốn đóng TẤT CẢ ứng dụng này? {decision.args.get('app_name')}"
                    if close_all
                    else f"Bạn có chắc muốn đóng ứng dụng này? {decision.args.get('app_name')}"
                )
                res = ActionResult.need_confirm(
                    message=msg, tool="close_app", args=args
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.EMAIL_SETTINGS:
                res = executor._handle_email_settings(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.EMAIL_LOGIN:
                res = executor._handle_email_login(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DRIVE_LOGIN:
                res = executor._handle_drive_login(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DRIVE_LOGOUT:
                res = executor._handle_drive_logout(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_DRIVE_ACCOUNTS:
                res = executor._handle_drive_list_accounts()
                self._log_result(res)
                return res

            if decision.type == RouteType.SET_DRIVE_ACCOUNT:
                res = executor._handle_drive_set_account(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.CHECK_EMAIL:
                res = executor._handle_check_email(**decision.args)
                self._remember_email_results(res)
                self._log_result(res)
                return res

            if decision.type == RouteType.LOAD_MORE_EMAILS:
                res = self._handle_load_more_emails()
                self._remember_email_results(res)
                self._log_result(res)
                return res

            if decision.type == RouteType.SEARCH_DRIVE_FILES:
                res = executor._handle_search_drive_files(**decision.args)
                self._remember_drive_results(res)
                self._log_result(res)
                return res

            if decision.type == RouteType.UPLOAD_TO_DRIVE:
                res = self._handle_upload_to_drive(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.GET_DRIVE_LINK:
                res = self._handle_get_drive_link(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DOWNLOAD_DRIVE_FILE:
                res = self._handle_download_drive_file(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.READ_EMAIL:
                res = self._handle_read_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.MARK_EMAIL:
                res = self._handle_mark_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.ARCHIVE_EMAIL:
                res = self._handle_archive_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.SEND_EMAIL:
                res = self._handle_send_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.SEND_BULK_EMAIL:
                res = self._handle_send_bulk_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.REPLY_EMAIL:
                res = self._handle_reply_email(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.CREATE_REMINDER:
                res = self._handle_create_reminder(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.IMPORT_TASK_LIST:
                res = self._handle_import_task_list(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_REMINDERS:
                res = executor._handle_list_reminders(**decision.args)
                self._remember_reminder_results(res)
                self._log_result(res)
                return res

            if decision.type == RouteType.COMPLETE_REMINDER:
                res = self._handle_complete_reminder(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_REMINDER:
                res = self._handle_delete_reminder(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.UPDATE_REMINDER:
                res = self._handle_update_reminder(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.SNOOZE_REMINDER:
                res = self._handle_snooze_reminder(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.SET_MEMORY:
                res = executor._handle_set_memory(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.VIEW_MEMORY:
                res = executor._handle_view_memory()
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_MEMORY_KEY:
                res = executor._handle_delete_memory_key(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.CLEAR_MEMORY_HISTORY:
                self.state.pending_tool = "clear_memory_history"
                self.state.pending_args = {}
                res = ActionResult.need_confirm(
                    message="Bạn có chắc muốn xóa toàn bộ history personal memory không?",
                    tool="clear_memory_history",
                    args={},
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.SET_ENTITY_MEMORY:
                res = executor._handle_set_entity_memory(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.VIEW_ENTITY_MEMORY:
                res = executor._handle_view_entity_memory()
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_ENTITY_MEMORY:
                res = executor._handle_delete_entity_memory(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.ADD_PINNED_KNOWLEDGE:
                res = executor._handle_add_pinned_knowledge(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.VIEW_PINNED_KNOWLEDGE:
                res = executor._handle_view_pinned_knowledge()
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_PINNED_KNOWLEDGE:
                res = executor._handle_delete_pinned_knowledge(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.LIST_WORKFLOWS:
                res = executor._handle_list_workflows(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.RUN_WORKFLOW:
                res = executor._handle_run_workflow(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.DELETE_WORKFLOW:
                self.state.pending_tool = "delete_workflow"
                self.state.pending_args = dict(decision.args)
                res = ActionResult.need_confirm(
                    message=f"Bạn có chắc muốn xóa workflow '{decision.args.get('workflow_ref', '')}' không?",
                    tool="delete_workflow",
                    args=dict(decision.args),
                )
                self._log_result(res)
                return res

            if decision.type == RouteType.MENU:
                self.state.last_choices = list(MENU.keys())
                self.state.last_action = "menu"
                self.state.last_action_meta = {}

                res = executor.build_menu_response(**decision.args)
                self._log_result(res)
                return res

            if decision.type == RouteType.FALLBACK_TO_LLM:
                self._raise_if_cancelled(cancel_check)
                self.state.push_history("user", user_text)
                try:
                    tc = parse_toolcall(
                        user_text,
                        history=self.state.history,
                        cancel_check=cancel_check,
                    )
                    self.logger.info(
                        f"LLM_TOOLCALL: tool={tc.tool} args={tc.args} "
                        f"confidence={tc.confidence} note={tc.note}"
                    )
                except CancelledError:
                    raise
                except Exception as e:
                    self.logger.error(f"PARSE_TOOLCALL_FAILED: {e}")
                    res = ActionResult.need_clarify(
                        message="Mình chưa hiểu rõ yêu cầu. Bạn có thể diễn đạt lại không?",
                        question="Bạn muốn mình làm gì?",
                    )
                    res = self._append_similar_command_suggestions(res, user_text)
                    self._log_result(res)
                    return res

                self._raise_if_cancelled(cancel_check)

                if tc.tool == "ask_clarify":
                    res = ActionResult.need_clarify(
                        message=tc.note or "Bạn nói rõ hơn giúp mình nhé.",
                        question=tc.note or "Bạn có thể nói rõ hơn không?",
                    )
                    res = self._append_similar_command_suggestions(res, user_text)
                    self.state.push_history("assistant", res.message)
                    self._log_result(res)
                    return res

                if tc.tool in RISKY_TOOLS:
                    self.state.pending_tool = tc.tool
                    self.state.pending_args = tc.args
                    res = ActionResult.need_confirm(
                        message=f"Xác nhận thực hiện: {tc.tool} với {tc.args} ?",
                        tool=tc.tool,
                        args=tc.args,
                    )
                    self._log_result(res)
                    return res

                try:
                    res = self._execute_tool(tc.tool, tc.args, user_text=user_text)
                except Exception as e:
                    self.logger.error(
                        f"EXECUTE_TOOL_FAILED: tool={tc.tool} args={tc.args} err={e}"
                    )
                    res = ActionResult.need_clarify(
                        message="Mình chưa hiểu rõ yêu cầu. Bạn có thể diễn đạt lại không?",
                        question="Bạn muốn mình làm gì?",
                    )
                    res = self._append_similar_command_suggestions(res, user_text)
                self.state.push_history("assistant", res.message)
                self._log_result(res)
                return res

            res = ActionResult.need_clarify(
                message="Mình chưa hiểu rõ yêu cầu.",
                question="Bạn muốn mình làm gì?",
            )
            res = self._append_similar_command_suggestions(res, user_text)
            self._log_result(res)
            return res
        except CancelledError:
            res = ActionResult.cancelled()
            self._log_result(res)
            return res

    def _handle_chat(
        self,
        message: str,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> ActionResult:
        self._raise_if_cancelled(cancel_check)
        self.state.push_history("user", message)
        try:
            reply = generate_chat_reply(
                message,
                history=self.state.history,
                cancel_check=cancel_check,
            )
        except CancelledError:
            raise
        except Exception as e:
            return ActionResult.err(
                "Mình chưa trả lời chat được vì kết nối AI đang lỗi hoặc thiếu cấu hình.",
                code=ErrorCode.OPENROUTER_DOWN,
                dev_message=str(e),
                kind="chat",
            )
        self.state.push_history("assistant", reply)
        return ActionResult.ok(reply, kind="chat")

    def _execute_tool(
        self, tool: str, args: Dict[str, Any], user_text: str = ""
    ) -> ActionResult:
        if tool == "open_app":
            return executor.open_app(**args)
        if tool == "list_custom_apps":
            return executor._handle_list_custom_apps()
        if tool == "delete_custom_app":
            return executor._handle_delete_custom_app(**args)
        if tool == "close_app":
            return executor.close_app(**args)
        if tool == "close_process":
            return executor.close_process_id(**args)
        if tool == "close_window":
            return executor.close_window(**args)
        if tool == "browser_tab_control":
            return executor.browser_tab_control(**args)
        if tool == "remote_preset":
            return executor.remote_preset(**args)
        if tool == "system_power":
            return executor.system_power(**args)
        if tool == "schedule_close":
            return executor.schedule_close(**args)
        if tool == "schedule_open":
            return executor.schedule_open(**args)
        if tool == "smart_close":
            action = str(args.get("action") or "").strip()
            if action == "close_heavy_apps":
                return executor.close_heavy_apps()
            if action == "close_distracting_web":
                return executor.close_distracting_web()
            if action == "close_except":
                return executor.close_visible_running_apps_except(
                    except_apps=list(args.get("except_apps") or [])
                )
            return ActionResult.err("Lệnh đóng thông minh không hợp lệ.", code=ErrorCode.UNKNOWN)
        if tool == "lazy_idle_guard":
            return executor.lazy_idle_guard(**args)
        if tool == "clipboard_bridge":
            return executor.clipboard_bridge(**args)
        if tool == "trash_drive_file":
            return executor._handle_drive_trash(**args)
        if tool == "find_file":
            return self._handle_find_then_maybe_open(**args)
        if tool == "open_file":
            if not executor.is_safe_path(args.get("path", "")):
                return ActionResult.err(
                    "Không cho phép mở file ngoài thư mục an toàn (Desktop/Documents/Downloads).",
                    code=ErrorCode.NOT_ALLOWED,
                )
            return executor.open_file(**args)
        if tool == "delete_file":
            if not executor.is_safe_path(args.get("path", "")):
                return ActionResult.err(
                    "Không cho phép xóa file ngoài thư mục an toàn.",
                    code=ErrorCode.NOT_ALLOWED,
                )
            # always confirm in engine (already done), but still allow direct call (safe)
            return executor.delete_file(**args)
        if tool == "delete_path":
            if not executor.is_safe_path(args.get("path", "")):
                return ActionResult.err(
                    "Không cho phép xóa file/thư mục ngoài thư mục an toàn.",
                    code=ErrorCode.NOT_ALLOWED,
                )
            return executor.delete_path(**args)
        if tool == "copy_path":
            return executor.copy_path(**args)
        if tool == "move_path":
            return executor.move_path(**args)
        if tool == "web_search":
            query = args.get("query") or user_text or "unknown"
            return executor.web_search(query=query)
        if tool == "hide_email":
            return executor._handle_email_settings(**args)
        if tool == "check_email":
            return executor._handle_check_email(**args)
        if tool == "load_more_emails":
            return self._handle_load_more_emails()
        if tool == "email_login":
            return executor._handle_email_login(**args)
        if tool == "read_email":
            return executor._handle_read_email(**args)
        if tool == "send_email":
            return executor._handle_send_email(**args)
        if tool == "send_bulk_email":
            return executor._handle_send_bulk_email(**args)
        if tool == "reply_email":
            return executor._handle_reply_email(**args)
        if tool == "mark_email":
            return executor._handle_mark_email(**args)
        if tool == "archive_email":
            return executor._handle_archive_email(**args)
        if tool == "drive_login":
            return executor._handle_drive_login(**args)
        if tool == "list_drive_accounts":
            return executor._handle_drive_list_accounts()
        if tool == "set_drive_account":
            return executor._handle_drive_set_account(**args)
        if tool == "search_drive_files":
            res = executor._handle_search_drive_files(**args)
            self._remember_drive_results(res)
            return res
        if tool == "upload_to_drive":
            if args.get("file_path"):
                return executor._handle_drive_upload(
                    file_path=args.get("file_path", ""),
                    folder_id=args.get("folder_id", ""),
                    folder_ref=args.get("folder_ref", ""),
                    create_folder_if_missing=bool(
                        args.get("create_folder_if_missing", False)
                    ),
                )
            return self._handle_upload_to_drive(
                file_ref=args.get("file_ref", ""),
                folder_ref=args.get("folder_ref", ""),
                create_folder_if_missing=bool(
                    args.get("create_folder_if_missing", False)
                ),
            )
        if tool == "get_drive_link":
            if args.get("file_id"):
                return executor._handle_drive_get_link(
                    file_id=args.get("file_id", ""),
                    make_public=bool(args.get("make_public", False)),
                )
            return self._handle_get_drive_link(
                query=args.get("query", ""),
                index=args.get("index"),
                make_public=bool(args.get("make_public", False)),
            )
        if tool == "download_drive_file":
            if args.get("file_id"):
                return executor._handle_drive_download(
                    file_id=args.get("file_id", ""),
                    destination=args.get("destination", ""),
                )
            return self._handle_download_drive_file(
                query=args.get("query", ""),
                index=args.get("index"),
                destination=args.get("destination", ""),
            )
        if tool == "create_reminder":
            return self._handle_create_reminder(**args)
        if tool == "import_task_list":
            return self._handle_import_task_list(**args)
        if tool == "list_reminders":
            res = executor._handle_list_reminders(**args)
            self._remember_reminder_results(res)
            return res
        if tool == "complete_reminder":
            return self._handle_complete_reminder(**args)
        if tool == "delete_reminder":
            return self._handle_delete_reminder(**args)
        if tool == "update_reminder":
            return self._handle_update_reminder(**args)
        if tool == "snooze_reminder":
            return self._handle_snooze_reminder(**args)
        if tool == "set_memory":
            return executor._handle_set_memory(**args)
        if tool == "view_memory":
            return executor._handle_view_memory()
        if tool == "delete_memory_key":
            return executor._handle_delete_memory_key(**args)
        if tool == "clear_memory_history":
            return executor._handle_clear_memory_history()
        if tool == "set_entity_memory":
            return executor._handle_set_entity_memory(**args)
        if tool == "view_entity_memory":
            return executor._handle_view_entity_memory()
        if tool == "delete_entity_memory":
            return executor._handle_delete_entity_memory(**args)
        if tool == "add_pinned_knowledge":
            return executor._handle_add_pinned_knowledge(**args)
        if tool == "view_pinned_knowledge":
            return executor._handle_view_pinned_knowledge()
        if tool == "delete_pinned_knowledge":
            return executor._handle_delete_pinned_knowledge(**args)
        if tool == "list_workflows":
            return executor._handle_list_workflows(**args)
        if tool == "run_workflow":
            return executor._handle_run_workflow(**args)
        if tool == "delete_workflow":
            return executor._handle_delete_workflow(**args)

        # unknown tool -> fallback web
        return executor.web_search(query=f"{tool} {args}")

    def _remember_email_results(self, res: ActionResult) -> None:
        try:
            payload = (res.data or {}).get("json") or {}
            emails = payload.get("data") or []
            pagination = payload.get("pagination") or {}
            if isinstance(emails, list):
                if pagination.get("append"):
                    self.state.last_email_results.extend(emails)
                else:
                    self.state.last_email_results = emails
                if len(emails) == 1 and emails[0].get("id"):
                    self.state.selected_email_id = emails[0]["id"]
                if self.state.last_email_results:
                    self.state.last_choices = [str(item.get("id") or "") for item in self.state.last_email_results]
                    self.state.last_action = "email_item"
                    self.state.last_action_meta = {"emails": list(self.state.last_email_results)}
                    choices = [self._email_choice_label(item) for item in self.state.last_email_results]
                    res.data["choices"] = choices
                    res.data["action"] = "email_item"
                    res.data["telegram_choice_buttons"] = True
                    if not bool(res.data.get("choices_already_in_message")):
                        lines = [f"{idx}. {label}" for idx, label in enumerate(choices, 1)]
                        res.message = (res.message.rstrip() + "\n" + "\n".join(lines)).strip()
                        res.data["choices_already_in_message"] = True
            self.state.last_email_mode = str(pagination.get("mode") or "")
            self.state.last_email_next_page_token = str(
                pagination.get("next_page_token") or ""
            )
            self.state.last_email_page_size = int(pagination.get("page_size") or 0)
        except Exception:
            return

    def _handle_load_more_emails(self) -> ActionResult:
        mode = (self.state.last_email_mode or "").strip()
        page_token = (self.state.last_email_next_page_token or "").strip()
        if not mode:
            return ActionResult.need_clarify(
                message="Mình chưa có danh sách email nào gần đây để tải thêm.",
                question="Bạn hãy dùng lệnh như 'check mail' hoặc 'xem email hôm nay' trước.",
            )
        if not page_token:
            return ActionResult.ok(
                "Không còn email nào để tải thêm.",
                json={
                    "data": [],
                    "pagination": {
                        "mode": mode,
                        "page_size": self.state.last_email_page_size,
                        "next_page_token": "",
                        "append": True,
                        "has_more": False,
                    },
                },
            )

        return executor._handle_check_email(
            mode=mode,
            limit=self.state.last_email_page_size,
            page_token=page_token,
            append=True,
        )

    def _remember_drive_results(self, res: ActionResult) -> None:
        try:
            files = (res.data or {}).get("drive_files") or []
            if isinstance(files, list):
                self.state.last_drive_results = files
                if len(files) == 1 and files[0].get("id"):
                    self.state.selected_drive_file_id = files[0]["id"]
                if files:
                    self.state.last_choices = [str(item.get("id") or "") for item in files]
                    self.state.last_action = "drive_item"
                    self.state.last_action_meta = {"drive_files": list(files)}
                    res.data["choices"] = [str(item.get("name") or item.get("id") or "File") for item in files]
                    res.data["action"] = "drive_item"
                    res.data["telegram_choice_buttons"] = True
                    res.data["choices_already_in_message"] = True
        except Exception:
            return

    def _remember_reminder_results(self, res: ActionResult) -> None:
        try:
            reminders = (res.data or {}).get("reminders") or []
            if isinstance(reminders, list):
                self.state.last_reminder_results = reminders
                if reminders:
                    self.state.last_choices = [str(item.get("id") or "") for item in reminders]
                    self.state.last_action = "reminder_item"
                    self.state.last_action_meta = {"reminders": list(reminders)}
                    res.data["choices"] = [
                        str(item.get("title") or item.get("message") or item.get("id") or "Reminder")
                        for item in reminders
                    ]
                    res.data["action"] = "reminder_item"
                    res.data["telegram_choice_buttons"] = True
                    res.data["choices_already_in_message"] = True
        except Exception:
            return

    @staticmethod
    def _email_choice_label(email: Dict[str, Any]) -> str:
        sender = str(email.get("from") or "").strip()
        subject = str(email.get("subject") or "(không tiêu đề)").strip()
        prefix = "Chưa đọc - " if bool(email.get("is_unread")) else ""
        attachment = " [file]" if bool(email.get("has_attachment")) else ""
        if sender:
            return f"{prefix}{sender}: {subject}{attachment}"
        return f"{prefix}{subject}{attachment}"

    def _resolve_reminder_ref(
        self, index: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        reminders = self.state.last_reminder_results or []
        if index is not None:
            idx = int(index) - 1
            if 0 <= idx < len(reminders):
                return reminders[idx]
            return None
        if len(reminders) == 1:
            return reminders[0]
        return None

    def _handle_create_reminder(
        self,
        title: str = "",
        message: str = "",
        due_at: str = "",
        timezone_name: str = "Asia/Saigon",
    ) -> ActionResult:
        title = (title or "").strip()
        message = (message or title).strip()
        due_at = (due_at or "").strip()
        if not title:
            self._set_clarify_context(
                "create_reminder",
                title="",
                due_at=due_at,
                timezone_name=timezone_name,
            )
            return ActionResult.need_clarify(
                message="Mình chưa có nội dung reminder.",
                question="Bạn muốn mình nhắc việc gì?",
                slots={"intent": "create_reminder", "missing": "title"},
            )
        if not due_at:
            self._set_clarify_context(
                "create_reminder",
                title=title,
                due_at="",
                timezone_name=timezone_name,
            )
            return ActionResult.need_clarify(
                message="Mình chưa xác định được thời điểm nhắc.",
                question="Bạn muốn nhắc vào lúc nào?",
                slots={
                    "intent": "create_reminder",
                    "missing": "due_at",
                    "title": title,
                },
            )
        self._clear_clarify_context()
        res = executor._handle_create_reminder(
            title=title,
            message=message,
            due_at=due_at,
            timezone_name=timezone_name,
        )
        listed = executor._handle_list_reminders()
        self._remember_reminder_results(listed)
        return res

    def _handle_import_task_list(
        self,
        task_text: str = "",
        timezone_name: str = "Asia/Saigon",
    ) -> ActionResult:
        task_text = (task_text or "").strip()
        if not task_text:
            self._set_clarify_context(
                "import_task_list",
                task_text="",
                timezone_name=timezone_name,
            )
            return ActionResult.need_clarify(
                message="Mình chưa thấy danh sách công việc để nhập.",
                question="Bạn hãy gửi mỗi dòng theo dạng: Tên công việc - thời gian thực hiện - thời gian đến hạn - trạng thái.",
                slots={"intent": "import_task_list", "missing": "task_text"},
            )

        self._clear_clarify_context()
        res = executor._handle_import_task_list(
            task_text=task_text,
            timezone_name=timezone_name,
        )
        listed = executor._handle_list_reminders()
        self._remember_reminder_results(listed)
        return res

    def _handle_complete_reminder(
        self, index: Optional[int] = None, reminder_id: str = ""
    ) -> ActionResult:
        if reminder_id:
            res = executor._handle_complete_reminder(reminder_id)
            listed = executor._handle_list_reminders()
            self._remember_reminder_results(listed)
            self._clear_clarify_context()
            return res

        reminder = self._resolve_reminder_ref(index=index)
        if not reminder:
            listed = executor._handle_list_reminders()
            self._remember_reminder_results(listed)
            if not self.state.last_reminder_results:
                return listed
            self._set_clarify_context("complete_reminder", index=index, reminder_id="")
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn hoàn thành reminder nào.",
                question="Bạn hãy nói số reminder, ví dụ: hoàn thành reminder 2.",
                slots={"intent": "complete_reminder", "missing": "index"},
            )
        res = executor._handle_complete_reminder(reminder.get("id", ""))
        listed = executor._handle_list_reminders()
        self._remember_reminder_results(listed)
        self._clear_clarify_context()
        return res

    def _handle_delete_reminder(
        self, index: Optional[int] = None, reminder_id: str = ""
    ) -> ActionResult:
        if reminder_id:
            res = executor._handle_delete_reminder(reminder_id)
            listed = executor._handle_list_reminders()
            self._remember_reminder_results(listed)
            self._clear_clarify_context()
            return res

        reminder = self._resolve_reminder_ref(index=index)
        if not reminder:
            listed = executor._handle_list_reminders()
            self._remember_reminder_results(listed)
            if not self.state.last_reminder_results:
                return listed
            self._set_clarify_context("delete_reminder", index=index, reminder_id="")
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn xóa reminder nào.",
                question="Bạn hãy nói số reminder, ví dụ: xóa reminder 1.",
                slots={"intent": "delete_reminder", "missing": "index"},
            )
        args = {"reminder_id": reminder.get("id", "")}
        self.state.pending_tool = "delete_reminder"
        self.state.pending_args = args
        title = (
            reminder.get("title")
            or reminder.get("message")
            or reminder.get("id")
            or "reminder"
        )
        return ActionResult.need_confirm(
            message=f"Bạn có chắc muốn xóa reminder này?\n{title}",
            tool="delete_reminder",
            args=args,
        )

    def _handle_update_reminder(
        self,
        index: Optional[int] = None,
        reminder_id: str = "",
        title: str = "",
        message: str = "",
        due_at: str = "",
    ) -> ActionResult:
        if reminder_id:
            target_id = reminder_id
        else:
            reminder = self._resolve_reminder_ref(index=index)
            if not reminder:
                listed = executor._handle_list_reminders()
                self._remember_reminder_results(listed)
                if not self.state.last_reminder_results:
                    return listed
                self._set_clarify_context(
                    "update_reminder",
                    index=index,
                    reminder_id="",
                    title=title,
                    due_at=due_at,
                )
                return ActionResult.need_clarify(
                    message="Mình chưa biết bạn muốn sửa reminder nào.",
                    question="Bạn hãy nói số reminder, ví dụ: sửa reminder 1 thành họp lúc 10h sáng mai.",
                    slots={"intent": "update_reminder", "missing": "index"},
                )
            target_id = reminder.get("id", "")

        title = (title or "").strip()
        message = (message or title).strip()
        due_at = (due_at or "").strip()
        if not title and not due_at:
            self._set_clarify_context(
                "update_reminder",
                index=index,
                reminder_id=target_id,
                title="",
                due_at="",
            )
            return ActionResult.need_clarify(
                message="Mình chưa thấy thông tin mới để sửa reminder.",
                question="Bạn muốn đổi nội dung hay đổi thời gian reminder?",
                slots={"intent": "update_reminder", "missing": "content_or_due_at"},
            )

        self._clear_clarify_context()
        res = executor._handle_update_reminder(
            reminder_id=target_id,
            title=title,
            message=message,
            due_at=due_at,
        )
        listed = executor._handle_list_reminders()
        self._remember_reminder_results(listed)
        return res

    def _handle_snooze_reminder(
        self,
        index: Optional[int] = None,
        reminder_id: str = "",
        minutes: int = 0,
    ) -> ActionResult:
        if reminder_id:
            target_id = reminder_id
        else:
            reminder = self._resolve_reminder_ref(index=index)
            if not reminder:
                listed = executor._handle_list_reminders()
                self._remember_reminder_results(listed)
                if not self.state.last_reminder_results:
                    return listed
                self._set_clarify_context(
                    "snooze_reminder",
                    index=index,
                    reminder_id="",
                    minutes=minutes,
                )
                return ActionResult.need_clarify(
                    message="Mình chưa biết bạn muốn snooze reminder nào.",
                    question="Bạn hãy nói số reminder, ví dụ: nhắc lại reminder 1 sau 10 phút.",
                    slots={"intent": "snooze_reminder", "missing": "index"},
                )
            target_id = reminder.get("id", "")

        if int(minutes or 0) <= 0:
            self._set_clarify_context(
                "snooze_reminder",
                index=index,
                reminder_id=target_id,
                minutes=0,
            )
            return ActionResult.need_clarify(
                message="Mình chưa hiểu thời gian snooze.",
                question="Bạn muốn nhắc lại sau bao nhiêu phút?",
                slots={"intent": "snooze_reminder", "missing": "minutes"},
            )

        self._clear_clarify_context()
        res = executor._handle_snooze_reminder(target_id, int(minutes))
        listed = executor._handle_list_reminders()
        self._remember_reminder_results(listed)
        return res

    def _resolve_email_ref(
        self, index: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        if index is not None:
            idx = index - 1
            if idx < 0 or idx >= len(self.state.last_email_results):
                return None
            email = self.state.last_email_results[idx]
            if email.get("id"):
                self.state.selected_email_id = email["id"]
            return email

        if self.state.selected_email_id:
            for email in self.state.last_email_results:
                if email.get("id") == self.state.selected_email_id:
                    return email

        if len(self.state.last_email_results) == 1:
            email = self.state.last_email_results[0]
            if email.get("id"):
                self.state.selected_email_id = email["id"]
            return email

        return None

    def _resolve_drive_ref(
        self, index: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        if index is not None:
            idx = index - 1
            if idx < 0 or idx >= len(self.state.last_drive_results):
                return None
            drive_file = self.state.last_drive_results[idx]
            if drive_file.get("id"):
                self.state.selected_drive_file_id = drive_file["id"]
            return drive_file

        if self.state.selected_drive_file_id:
            for drive_file in self.state.last_drive_results:
                if drive_file.get("id") == self.state.selected_drive_file_id:
                    return drive_file

        if len(self.state.last_drive_results) == 1:
            drive_file = self.state.last_drive_results[0]
            if drive_file.get("id"):
                self.state.selected_drive_file_id = drive_file["id"]
            return drive_file

        return None

    def _handle_read_email(self, index: Optional[int] = None) -> ActionResult:
        email = self._resolve_email_ref(index=index)
        if not email:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn đọc email nào.",
                question="Bạn hãy nói số email, ví dụ: đọc email 1",
            )
        res = executor._handle_read_email(message_id=email["id"])
        if res.status == ActionStatus.SUCCESS:
            self.state.selected_email_id = email["id"]
        return res

    def _handle_mark_email(
        self, index: Optional[int] = None, unread: bool = False
    ) -> ActionResult:
        email = self._resolve_email_ref(index=index)
        if not email:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn cập nhật email nào.",
                question="Bạn hãy nói số email, ví dụ: đánh dấu email 2 đã đọc",
            )
        res = executor._handle_mark_email(message_id=email["id"], unread=unread)
        if res.status == ActionStatus.SUCCESS:
            email["is_unread"] = unread
        return res

    def _handle_archive_email(self, index: Optional[int] = None) -> ActionResult:
        email = self._resolve_email_ref(index=index)
        if not email:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn lưu trữ email nào.",
                question="Bạn hãy nói số email, ví dụ: lưu trữ email 1",
            )
        return executor._handle_archive_email(message_id=email["id"])

    def _handle_upload_to_drive(
        self,
        file_ref: str = "",
        folder_ref: str = "",
        create_folder_if_missing: bool = False,
    ) -> ActionResult:
        cleaned = (file_ref or "").strip()
        if not cleaned:
            return ActionResult.need_clarify(
                message="Mình chưa biết file nào cần upload lên Google Drive.",
                question="Bạn hãy nói rõ tên file hoặc đường dẫn file cần upload.",
            )

        if executor.is_safe_path(cleaned) and Path(cleaned).exists():
            return executor._handle_drive_upload(
                file_path=cleaned,
                folder_ref=folder_ref,
                create_folder_if_missing=create_folder_if_missing,
            )

        found = executor.find_file(query=cleaned)
        if found.status != ActionStatus.SUCCESS:
            return found
        files = found.data.get("files", [])
        if not files:
            return ActionResult.err(
                f"Không tìm thấy file '{cleaned}' để upload lên Google Drive.",
                code=ErrorCode.FILE_NOT_FOUND,
            )
        if len(files) == 1:
            return executor._handle_drive_upload(
                file_path=files[0],
                folder_ref=folder_ref,
                create_folder_if_missing=create_folder_if_missing,
            )

        self.state.last_choices = files
        self.state.last_action = "drive_upload_local"
        self.state.last_action_meta = {
            "folder_ref": folder_ref,
            "create_folder_if_missing": create_folder_if_missing,
        }
        lines = "\n".join([f"{i+1}) {p}" for i, p in enumerate(files)])
        return ActionResult.need_choice(
            message="Mình tìm thấy nhiều file để upload lên Google Drive:\n"
            + lines
            + "\n\nGõ số để chọn file cần upload.",
            choices=files,
            action="drive_upload_local",
        )

    def _search_drive_then_choose(
        self,
        *,
        query: str,
        choice_action: str,
        empty_message: str,
        empty_question: str | None = None,
        **meta: Any,
    ) -> ActionResult:
        search = executor._handle_search_drive_files(query=query)
        if search.status != ActionStatus.SUCCESS:
            return search
        self._remember_drive_results(search)
        files = (search.data or {}).get("drive_files") or []
        if not files:
            return ActionResult.need_clarify(
                message=empty_message,
                question=empty_question or "Bạn hãy nói rõ tên file trên Google Drive.",
            )
        if len(files) == 1:
            drive_file = files[0]
            self.state.selected_drive_file_id = drive_file.get("id", "")
            if choice_action == "drive_get_link":
                return executor._handle_drive_get_link(
                    file_id=drive_file["id"],
                    make_public=bool(meta.get("make_public", False)),
                )
            return executor._handle_drive_download(
                file_id=drive_file["id"],
                destination=str(meta.get("destination", "")),
            )

        self.state.last_choices = [item["id"] for item in files if item.get("id")]
        self.state.last_action = choice_action
        self.state.last_action_meta = meta
        lines = "\n".join(
            [
                f"{i+1}) {item.get('name', '(không tên)')} [{item.get('id', '')}]"
                for i, item in enumerate(files)
            ]
        )
        prompt = (
            "Gõ số để chọn file cần lấy link."
            if choice_action == "drive_get_link"
            else "Gõ số để chọn file cần tải về."
        )
        return ActionResult.need_choice(
            message="Mình tìm thấy nhiều file trên Google Drive:\n"
            + lines
            + "\n\n"
            + prompt,
            choices=self.state.last_choices,
            action=choice_action,
        )

    def _handle_get_drive_link(
        self,
        query: str = "",
        index: Optional[int] = None,
        make_public: bool = False,
    ) -> ActionResult:
        if query:
            return self._search_drive_then_choose(
                query=query,
                choice_action="drive_get_link",
                empty_message=f"Không tìm thấy file Google Drive phù hợp với '{query}'.",
                make_public=make_public,
            )

        drive_file = self._resolve_drive_ref(index=index)
        if not drive_file:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn lấy link file Google Drive nào.",
                question="Bạn hãy nói tên file hoặc số thứ tự file đã tìm trước đó.",
            )
        return executor._handle_drive_get_link(
            file_id=drive_file["id"],
            make_public=make_public,
        )

    def _handle_download_drive_file(
        self,
        query: str = "",
        index: Optional[int] = None,
        destination: str = "",
    ) -> ActionResult:
        if query:
            return self._search_drive_then_choose(
                query=query,
                choice_action="drive_download",
                empty_message=f"Không tìm thấy file Google Drive phù hợp với '{query}'.",
                destination=destination,
            )

        drive_file = self._resolve_drive_ref(index=index)
        if not drive_file:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn tải file Google Drive nào.",
                question="Bạn hãy nói tên file hoặc số thứ tự file đã tìm trước đó.",
            )
        return executor._handle_drive_download(
            file_id=drive_file["id"],
            destination=destination,
        )

    def _handle_send_email(
        self,
        to: str = "",
        subject: str = "",
        body: str = "",
        cc: str = "",
        bcc: str = "",
        attachments: list[str] | None = None,
    ) -> ActionResult:
        to = self._resolve_email_recipient(to)
        if not to:
            return ActionResult.need_clarify(
                message="Mình chưa có địa chỉ người nhận.",
                question="Bạn muốn gửi email cho ai?",
            )
        if not subject:
            return ActionResult.need_clarify(
                message="Mình chưa có tiêu đề email.",
                question="Tiêu đề email là gì?",
            )
        if not body:
            return ActionResult.need_clarify(
                message="Mình chưa có nội dung email.",
                question="Nội dung email là gì?",
            )

        args = {
            "to": to,
            "subject": subject,
            "body": body,
            "cc": cc,
            "bcc": bcc,
            "attachments": list(attachments or []),
        }
        self.state.pending_tool = "send_email"
        self.state.pending_args = args
        attachment_lines = []
        if attachments:
            names = [Path(path).name for path in attachments]
            attachment_lines.append(
                f"Attachments: {', '.join(names[:3])}"
                + (f" and {len(names) - 3} more" if len(names) > 3 else "")
            )
        return ActionResult.need_confirm(
            message=(
                "Xác nhận gửi email?\n"
                f"To: {to}\n"
                f"Subject: {subject}\n"
                f"Body: {body[:500]}"
                + ("\n" + "\n".join(attachment_lines) if attachment_lines else "")
            ),
            tool="send_email",
            args=args,
        )

    def _handle_send_bulk_email(self, file_ref: str = "") -> ActionResult:
        cleaned = (file_ref or "").strip().strip("\"'")
        if not cleaned:
            return ActionResult.need_clarify(
                message="Mình chưa có file Excel để gửi email hàng loạt.",
                question="Bạn hãy chọn hoặc nhập file .xlsx chứa danh sách ứng viên.",
            )

        resolved = self._resolve_bulk_email_file(cleaned)
        if isinstance(resolved, ActionResult):
            return resolved

        preview = executor._preview_bulk_email(file_path=resolved)
        if preview.status != ActionStatus.SUCCESS:
            return preview
        sender_info = executor._get_bulk_email_senders()
        if sender_info.status != ActionStatus.SUCCESS:
            return sender_info

        sender_choices = sender_info.data.get("senders") or []
        if len(sender_choices) > 1:
            display_choices = [item["email"] for item in sender_choices]
            self.state.last_choices = display_choices
            self.state.last_action = "bulk_email_sender"
            self.state.last_action_meta = {
                "message": preview.message,
                "file_path": resolved,
                "preview_rows": preview.data.get("preview_rows", []),
                "invalid_rows": preview.data.get("invalid_rows", []),
                "total_valid": preview.data.get("total_valid", 0),
                "total_invalid": preview.data.get("total_invalid", 0),
            }
            return ActionResult.need_choice(
                message="Chọn địa chỉ Gmail dùng để gửi email hàng loạt.",
                choices=display_choices,
                action="bulk_email_sender",
            )

        sender_email = (
            display_choices[0]
            if (display_choices := [item["email"] for item in sender_choices])
            else ""
        )
        return self._confirm_send_bulk_email(
            sender_email=sender_email,
            meta={
                "message": preview.message,
                "file_path": resolved,
                "preview_rows": preview.data.get("preview_rows", []),
                "invalid_rows": preview.data.get("invalid_rows", []),
                "total_valid": preview.data.get("total_valid", 0),
                "total_invalid": preview.data.get("total_invalid", 0),
            },
        )

    def _confirm_send_bulk_email(
        self, sender_email: str, meta: Dict[str, Any]
    ) -> ActionResult:
        args = {
            "file_path": meta.get("file_path", ""),
            "preview_rows": meta.get("preview_rows", []),
            "invalid_rows": meta.get("invalid_rows", []),
            "total_valid": meta.get("total_valid", 0),
            "total_invalid": meta.get("total_invalid", 0),
            "from_address": sender_email,
        }
        self.state.pending_tool = "send_bulk_email"
        self.state.pending_args = args
        return ActionResult.need_confirm(
            message=(
                f"Địa chỉ gửi đã chọn: {sender_email}\n"
                + (
                    meta.get("message")
                    or "Hãy xem lại toàn bộ email bên dưới. Chỉ khi bạn bấm Đồng ý thì hệ thống mới bắt đầu gửi."
                )
            ),
            tool="send_bulk_email",
            args=args,
        )

    def _resolve_bulk_email_file(self, file_ref: str) -> str | ActionResult:
        candidate = file_ref.strip()
        if re.search(r"[\\/]", candidate) or re.match(r"^[A-Za-z]:", candidate):
            if not executor.is_safe_path(candidate):
                return ActionResult.err(
                    "Chỉ cho phép dùng file Excel trong thư mục an toàn.",
                    code=ErrorCode.NOT_ALLOWED,
                )
            direct = executor._resolve_virtual_path(candidate)
            if not direct.exists():
                return ActionResult.err(
                    "File Excel không tồn tại.", code=ErrorCode.FILE_NOT_FOUND
                )
            if direct.suffix.lower() != ".xlsx":
                return ActionResult.err(
                    "Hiện chỉ hỗ trợ file .xlsx.", code=ErrorCode.NOT_ALLOWED
                )
            return str(direct)

        lookup = executor.find_file(query=candidate, extensions=["xlsx"])
        files = (lookup.data or {}).get("files") or []
        if not files:
            return ActionResult.err(
                "Không tìm thấy file Excel phù hợp.", code=ErrorCode.FILE_NOT_FOUND
            )
        if len(files) == 1:
            return files[0]

        self.state.last_choices = files
        self.state.last_action = "bulk_email_file"
        self.state.last_action_meta = {}
        return ActionResult.need_choice(
            message="Mình tìm thấy nhiều file Excel. Chọn số để gửi email theo file bạn muốn.",
            choices=files,
            action="bulk_email_file",
        )

    def _handle_reply_email(
        self,
        index: Optional[int] = None,
        body: str = "",
        reply_all: bool = False,
    ) -> ActionResult:
        email = self._resolve_email_ref(index=index)
        if not email:
            return ActionResult.need_clarify(
                message="Mình chưa biết bạn muốn trả lời email nào.",
                question="Bạn hãy nói số email, ví dụ: trả lời email 2 rằng ...",
            )
        if not body:
            return ActionResult.need_clarify(
                message="Mình chưa có nội dung trả lời.",
                question="Bạn muốn trả lời nội dung gì?",
            )

        args = {
            "message_id": email["id"],
            "body": body,
            "reply_all": reply_all,
        }
        subject = email.get("subject") or "(không tiêu đề)"
        self.state.pending_tool = "reply_email"
        self.state.pending_args = args
        return ActionResult.need_confirm(
            message=(
                "Xác nhận trả lời email?\n"
                f"Subject: {subject}\n"
                f"Reply: {body[:500]}"
            ),
            tool="reply_email",
            args=args,
        )

    def _handle_find_then_maybe_open(
        self,
        query: str,
        extensions: Optional[list[str]] = None,
        include_dirs: bool = False,
        only_dirs: bool = False,
    ) -> ActionResult:
        found = executor.find_file(
            query=query,
            extensions=extensions,
            include_dirs=include_dirs,
            only_dirs=only_dirs,
        )
        if found.status != ActionStatus.SUCCESS:
            return found

        files = found.data.get("files", [])
        if not files:
            return ActionResult.err(
                "Không tìm thấy file.", code=ErrorCode.FILE_NOT_FOUND
            )

        if len(files) == 1:
            # freeze behavior: auto open if 1
            return executor.open_file(path=files[0])

        # multiple -> NEED_CHOICE
        self.state.last_choices = files
        self.state.last_action = "file_item"
        self.state.last_action_meta = {}
        lines = "\n".join([f"{i+1}) {p}" for i, p in enumerate(files)])
        result = ActionResult.need_choice(
            message="Mình tìm thấy:\n" + lines + "\n\nGõ số (1,2,3...) để chọn.",
            choices=files,
            action="file_item",
        )
        result.data["choices_already_in_message"] = True
        return result

    def _handle_find_then_delete(
        self,
        query: str,
        extensions: Optional[list[str]] = None,
        include_dirs: bool = False,
        only_dirs: bool = False,
        path: str = "",
        direct_path: bool = False,
        target_dir: str = "",
    ) -> ActionResult:
        if direct_path and path:
            self.state.pending_tool = "delete_path"
            self.state.pending_args = {"path": path}
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn xóa mục này?\n{path}",
                tool="delete_path",
                args={"path": path},
            )

        search_dir = None
        if target_dir:
            search_dir = executor.resolve_destination_path(target_dir)
            if not search_dir:
                return ActionResult.err(
                    f"Không tìm thấy thư mục đích: '{target_dir}'",
                    code=ErrorCode.FILE_NOT_FOUND,
                )

        found = executor.find_file(
            query=query,
            extensions=extensions,
            include_dirs=include_dirs,
            only_dirs=only_dirs,
            search_dir=search_dir,
        )
        if found.status != ActionStatus.SUCCESS:
            return found

        files = found.data.get("files", [])
        if not files:
            return ActionResult.err(
                "Không tìm thấy mục để xóa.", code=ErrorCode.FILE_NOT_FOUND
            )

        if len(files) == 1:
            path = files[0]
            self.state.pending_tool = "delete_path"
            self.state.pending_args = {"path": path}
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn xóa mục này?\n{path}",
                tool="delete_path",
                args={"path": path},
            )

        self.state.last_choices = files
        self.state.last_action = "delete"
        self.state.last_action_meta = {}
        lines = "\n".join([f"{i+1}) {p}" for i, p in enumerate(files)])
        return ActionResult.need_choice(
            message="Mình tìm thấy các mục có thể xóa:\n"
            + lines
            + "\n\nGõ số để chọn mục muốn xóa.",
            choices=files,
            action="delete",
        )

    def _handle_find_then_copy(
        self,
        query: str,
        destination: str,
        extensions: Optional[list[str]] = None,
        include_dirs: bool = False,
        only_dirs: bool = False,
    ) -> ActionResult:
        dst = executor.resolve_destination_path(destination)
        if not dst:
            return ActionResult.need_clarify(
                message="Mình chưa xác định được thư mục đích để copy.",
                question="Bạn muốn copy vào thư mục nào trong vùng an toàn?",
            )

        found = executor.find_file(
            query=query,
            extensions=extensions,
            include_dirs=include_dirs,
            only_dirs=only_dirs,
        )
        if found.status != ActionStatus.SUCCESS:
            return found

        entries = found.data.get("files", [])
        if not entries:
            return ActionResult.err(
                "Không tìm thấy mục để copy.", code=ErrorCode.FILE_NOT_FOUND
            )

        if len(entries) == 1:
            return executor.copy_path(src=entries[0], dst=dst)

        self.state.last_choices = entries
        self.state.last_action = "copy"
        self.state.last_action_meta = {"destination": dst}
        lines = "\n".join([f"{i+1}) {p}" for i, p in enumerate(entries)])
        return ActionResult.need_choice(
            message="Mình tìm thấy các mục có thể copy:\n"
            + lines
            + f"\n\nĐích: {dst}\nGõ số để chọn mục muốn copy.",
            choices=entries,
            action="copy",
        )

    def _handle_find_then_move(
        self,
        query: str,
        destination: str,
        extensions: Optional[list[str]] = None,
        include_dirs: bool = False,
        only_dirs: bool = False,
    ) -> ActionResult:
        dst = executor.resolve_destination_path(destination)
        if not dst:
            return ActionResult.need_clarify(
                message="Mình chưa xác định được thư mục đích để di chuyển.",
                question="Bạn muốn chuyển vào thư mục nào trong vùng an toàn?",
            )

        found = executor.find_file(
            query=query,
            extensions=extensions,
            include_dirs=include_dirs,
            only_dirs=only_dirs,
        )
        if found.status != ActionStatus.SUCCESS:
            return found

        entries = found.data.get("files", [])
        if not entries:
            return ActionResult.err(
                "Không tìm thấy mục để di chuyển.", code=ErrorCode.FILE_NOT_FOUND
            )

        if len(entries) == 1:
            args = {"src": entries[0], "dst": dst}
            self.state.pending_tool = "move_path"
            self.state.pending_args = args
            return ActionResult.need_confirm(
                message=f"Bạn có chắc muốn di chuyển mục này?\n{entries[0]}\n→ {dst}",
                tool="move_path",
                args=args,
            )

        self.state.last_choices = entries
        self.state.last_action = "move"
        self.state.last_action_meta = {"destination": dst}
        lines = "\n".join([f"{i+1}) {p}" for i, p in enumerate(entries)])
        return ActionResult.need_choice(
            message="Mình tìm thấy các mục có thể di chuyển:\n"
            + lines
            + f"\n\nĐích: {dst}\nGõ số để chọn mục muốn di chuyển.",
            choices=entries,
            action="move",
        )

    def _log_result(self, res: ActionResult) -> None:
        try:
            if (
                res.status == ActionStatus.SUCCESS
                and not bool((res.data or {}).get("_skip_personal_history"))
                and (self._current_user_text or "").strip()
            ):
                metadata = {}
                for key in (
                    "path",
                    "url",
                    "query",
                    "to",
                    "subject",
                    "app",
                    "src",
                    "dst",
                    "file_path",
                ):
                    value = (res.data or {}).get(key)
                    if value:
                        metadata[key] = value
                bulk_email = (res.data or {}).get("bulk_email")
                if bulk_email:
                    metadata["bulk_email"] = bulk_email
                executor._record_personal_recent_action(
                    command=self._current_user_text,
                    status=str(res.status.value),
                    result_message=res.message,
                    metadata=metadata,
                )
            self.logger.info(
                f"RESULT: status={res.status} "
                f"error_code={res.error_code} "
                f"message={res.message} "
                f"data={res.data} "
                f"dev_message={res.dev_message!r}"
            )
            self._log_nlu_feedback(res)
        except Exception as e:
            self.logger.warning(f"RESULT_LOG_FAILED: {e}")

    def _log_nlu_feedback(self, res: ActionResult) -> None:
        try:
            text = (self._current_user_text or "").strip()
            if not text:
                return
            decision = self._current_route_decision
            route_type = ""
            route_confidence = None
            route_reason = ""
            route_args = {}
            if decision is not None:
                route_type = str(decision.type.value if hasattr(decision.type, "value") else decision.type)
                route_confidence = float(decision.confidence) if decision.confidence is not None else None
                route_reason = str(decision.reason or "")
                route_args = dict(decision.args or {})
            nlu_feedback.log_turn(
                text=text,
                route_type=route_type,
                route_confidence=route_confidence,
                route_reason=route_reason,
                route_args=route_args,
                result_status=str(res.status.value if hasattr(res.status, "value") else res.status),
                error_code=str(res.error_code.value if res.error_code and hasattr(res.error_code, "value") else (res.error_code or "")),
            )
        except Exception as exc:
            self.logger.warning(f"NLU_FEEDBACK_LOG_FAILED: {exc}")
