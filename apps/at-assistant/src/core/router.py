"""
Router: quyết định nên xử lý lệnh theo rule-first (không gọi LLM)
hay chuyển qua LLM tool-calling.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional

from PIL.ImagePalette import raw
from src.core import executor
from src.core import nlu_ml
from src.core.config_store import load_aliases
from src.core.intent_classifier import (
    classify_non_tool_text,
    IntentKind,
    normalize_intent_text,
    should_use_web,
)
from datetime import datetime, timedelta, timezone
from vietnam_number import w2n

class RouteType(str, Enum):
    CHAT = "chat"
    WEB_SEARCH = "web_search"
    OPEN_URL = "open_url"
    YOUTUBE_SEARCH = "youtube_search"
    YOUTUBE_CONTROL = "youtube_control"
    FIND_FILE = "find_file"
    OPEN_FILE_PATH = "open_file"
    FALLBACK_TO_LLM = "fallback_to_llm"
    DELETE_FILE_NAME = "delete_file_name"
    COPY_ENTRY = "copy_entry"
    MOVE_ENTRY = "move_entry"
    OPEN_APP = "open_app"
    CLOSE_APP = "close_app"
    EMAIL_LOGIN = "email_login"
    CHECK_EMAIL = "check_email"
    LOAD_MORE_EMAILS = "load_more_emails"
    READ_EMAIL = "read_email"
    SEND_EMAIL = "send_email"
    SEND_BULK_EMAIL = "send_bulk_email"
    REPLY_EMAIL = "reply_email"
    MARK_EMAIL = "mark_email"
    ARCHIVE_EMAIL = "archive_email"
    EMAIL_SETTINGS = "email_settings"
    DRIVE_LOGIN = "drive_login"
    DRIVE_LOGOUT = "drive_logout"
    LIST_DRIVE_ACCOUNTS = "list_drive_accounts"
    SET_DRIVE_ACCOUNT = "set_drive_account"
    UPLOAD_TO_DRIVE = "upload_to_drive"
    SEARCH_DRIVE_FILES = "search_drive_files"
    GET_DRIVE_LINK = "get_drive_link"
    DOWNLOAD_DRIVE_FILE = "download_drive_file"
    CREATE_REMINDER = "create_reminder"
    IMPORT_TASK_LIST = "import_task_list"
    LIST_REMINDERS = "list_reminders"
    COMPLETE_REMINDER = "complete_reminder"
    DELETE_REMINDER = "delete_reminder"
    UPDATE_REMINDER = "update_reminder"
    SNOOZE_REMINDER = "snooze_reminder"
    SET_MEMORY = "set_memory"
    VIEW_MEMORY = "view_memory"
    DELETE_MEMORY_KEY = "delete_memory_key"
    CLEAR_MEMORY_HISTORY = "clear_memory_history"
    SET_ENTITY_MEMORY = "set_entity_memory"
    VIEW_ENTITY_MEMORY = "view_entity_memory"
    DELETE_ENTITY_MEMORY = "delete_entity_memory"
    ADD_PINNED_KNOWLEDGE = "add_pinned_knowledge"
    VIEW_PINNED_KNOWLEDGE = "view_pinned_knowledge"
    DELETE_PINNED_KNOWLEDGE = "delete_pinned_knowledge"
    LIST_WORKFLOWS = "list_workflows"
    RUN_WORKFLOW = "run_workflow"
    DELETE_WORKFLOW = "delete_workflow"
    LIST_CUSTOM_APPS = "list_custom_apps"
    DELETE_CUSTOM_APP = "delete_custom_app"
    SYSTEM_POWER = "system_power"
    LIST_RUNNING_APPS = "list_running_apps"
    CLOSE_RUNNING_APP = "close_running_app"
    LIST_OPEN_WINDOWS = "list_open_windows"
    WINDOW_CONTROL = "window_control"
    LIST_BROWSER_TABS = "list_browser_tabs"
    BROWSER_TAB_CONTROL = "browser_tab_control"
    REMOTE_OVERVIEW = "remote_overview"
    REMOTE_PRESET = "remote_preset"
    SCHEDULED_CLOSE = "scheduled_close"
    SCHEDULED_OPEN = "scheduled_open"
    SMART_CLOSE = "smart_close"
    CLIPBOARD_BRIDGE = "clipboard_bridge"
    LAZY_IDLE_GUARD = "lazy_idle_guard"
    MEDIA_CONTROL = "media_control"
    BROWSER_CONTROL = "browser_control"
    KEYBOARD_CONTROL = "keyboard_control"
    MOUSE_CONTROL = "mouse_control"
    REMOTE_TARGET = "remote_target"
    SCREENSHOT = "screenshot"
    SYSTEM_STATUS = "system_status"
    MENU = "menu"


@dataclass
class RouteDecision:
    type: RouteType
    args: Dict[str, Any]
    reason: str = ""
    confidence: float = 0.8


ML_NLU_CONFIDENCE_THRESHOLD = 0.82
ML_NLU_RISKY_CONFIDENCE_THRESHOLD = 0.9
ML_NLU_INTENT_THRESHOLDS = {
    "chat": 0.65,
    "web_search": 0.7,
    "youtube_search": 0.7,
    "find_file": 0.5,
    "create_reminder": 0.55,
    "list_reminders": 0.5,
    "check_email": 0.55,
    "open_app": 0.65,
    "complete_reminder": 0.72,
    "update_reminder": 0.72,
    "snooze_reminder": 0.65,
}
ML_NLU_RISKY_INTENTS = {
    "close_app",
    "delete_file_name",
    "copy_entry",
    "move_entry",
    "send_email",
    "reply_email",
    "delete_reminder",
}

POLITE_SUFFIXES = (
    "giup toi",
    "ho toi",
    "dum toi",
    "duoc khong",
    "duoc khong?",
    "nhe",
    "nha",
    "please",
    "voi",
)


# ---------- Heuristics / rules ----------


def _with_email_aliases(*phrases: str) -> set[str]:
    aliases: set[str] = set()
    for phrase in phrases:
        cleaned = (phrase or "").strip()
        if not cleaned:
            continue
        aliases.add(cleaned)
        for source in ("email", "mail", "gmail"):
            if source not in cleaned:
                continue
            for target in ("email", "mail", "gmail"):
                aliases.add(cleaned.replace(source, target))
    return aliases

WEB_HINTS = {
    "google",
    "tra cứu",
    "search",
    "tìm kiếm",
    "wiki",
    "wikipedia",
    "tin tức",
    "news",
    "review",
    "hướng dẫn",
    "tutorial",
    "cách làm",
    "là gì",
    "định nghĩa",
    "giá bao nhiêu",
    "mua ở đâu",
    "ở đâu",
    "near me",
}

MEDIA_HINTS = {
    "nhạc",
    "bài hát",
    "song",
    "mv",
    "video",
    "youtube",
    "lyric",
    "lyrics",
    "mp3",
    "spotify",
    "soundcloud",
}

FILE_HINTS = {
    "file",
    "tệp",
    "tập tin",
    "thư mục",
    "folder",
    "tài liệu",
    "document",
    "trong máy",
    "trên máy",
    "desktop",
    "documents",
    "downloads",
}

FOLDER_HINTS = {"thư mục", "folder", "dir", "directory"}

EXT_HINTS = {
    "pdf",
    "doc",
    "docx",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "csv",
    "png",
    "jpg",
    "jpeg",
    "mp4",
    "mp3",
    "zip",
    "rar",
}

YOUTUBE_HINTS = {"ytb", "youtube", "yt", "youtub"}

# Email hints
EMAIL_HINTS = {
    "email",
    "gmail",
    "mail",
    "thư",
    "thư đến",
    "hộp thư",
    "inbox",
    "thu",
    "thu den",
    "hop thu",
    "hop thu den",
    "check email",
    "check mail",
    "open email",
    "open mail",
    "read email",
    "read mail",
}

EMAIL_STATUS_KEYWORDS = {
    "unread": ["chưa đọc", "chưa xem", "unread", "mới", "mới đến", "mới nhận", "chưa mở"],
    "read": ["đã đọc", "xem rồi", "đọc rồi", "đã xem", "coi rồi", "read"],
}

EMAIL_DATE_KEYWORDS = {
    "today": ["hôm nay", "nay", "today", "bữa nay", "bửa nay"],
    "yesterday": ["hôm qua", "yesterday", "bữa qua", "hôm trước"],
}

EMAIL_SETTINGS_HINTS = _with_email_aliases(
    # hide
    "ẩn email",
    "hide email",
    "email ẩn",
    "email an",
    "hide",

    # unhide
    "unhide",
    "bỏ ẩn",
    "bo an",

    # show hidden
    "show email ẩn",
    "show email an",
    "danh sách email ẩn",
    "list email ẩn",

    # logout gmail
    "logout email",
    "log out email",
    "đăng xuất email",
    "đăng xuất gmail",
    "đăng xuất mail",
    "dang xuat email",
    "dang xuat email",
    "dang xuat mail",
    "thoát email",
)

EMAIL_SEND_HINTS = _with_email_aliases("gửi email", "gui email", "send email")
EMAIL_REPLY_HINTS = _with_email_aliases("trả lời email", "tra loi email", "reply email")
EMAIL_COMPOSE_HINTS = _with_email_aliases("soạn thư", "soan thu", "viết thư", "viet thu", "soạn email", "soan email")
EMAIL_RESPONSE_HINTS = _with_email_aliases("phản hồi thư", "phan hoi thu", "phản hồi email", "phan hoi email")
EMAIL_READ_HINTS = _with_email_aliases(
    "đọc email",
    "doc email",
    "mở email",
    "mo email",
    "xem email",
    "read email",
    "open email",
)
EMAIL_ARCHIVE_HINTS = _with_email_aliases("lưu trữ email", "luu tru email", "archive email")
EMAIL_LOGIN_HINTS = _with_email_aliases("đăng nhập email", "dang nhap email", "login email")
EMAIL_LOAD_MORE_HINTS = _with_email_aliases("xem thêm email", "xem them email", "thêm email", "them email", "more email", "load more email")

EMAIL_ACCOUNT_LIST_HINTS = {
    "tai khoan gmail",
    "tai khoan email",
    "tai khoan mail",
    "account gmail",
    "gmail account",
    "danh sach tai khoan gmail",
    "list gmail account",
}
EMAIL_ACCOUNT_SELECT_HINTS = {"chon", "chọn", "set", "dung", "dùng", "use"}
EMAIL_ACCOUNT_ADD_HINTS = {"them", "thêm", "dang nhap them", "đăng nhập thêm", "add"}

DRIVE_HINTS = {"google drive", "gg drive", "drive google"}
DRIVE_CONNECT_HINTS = {"kết nối", "ket noi", "đăng nhập", "dang nhap", "login", "connect"}
DRIVE_LOGOUT_HINTS = {"đăng xuất", "dang xuat", "logout", "log out", "thoát", "disconnect"}
DRIVE_ACCOUNT_LIST_HINTS = {"danh sách tài khoản", "list tài khoản", "list account", "danh sach tai khoan"}
DRIVE_SELECT_ACCOUNT_HINTS = {"chọn tài khoản", "chon tai khoan", "set tài khoản", "set account", "dùng tài khoản", "use account"}
DRIVE_UPLOAD_HINTS = {"upload", "tải lên", "tai len", "đưa lên", "dua len"}
DRIVE_LINK_HINTS = {"lấy link", "lay link", "get link", "link chia sẻ", "link chia se", "share link"}
DRIVE_DOWNLOAD_HINTS = {"tải về", "tai ve", "download", "tải file", "tai file"}

REMINDER_HINTS = {"reminder", "nhắc việc", "nhac viec", "nhắc", "nhac", "việc cần nhắc", "viec can nhac"}
TASK_LIST_HINTS = {
    "danh sách công việc",
    "danh sach cong viec",
    "task list",
    "công việc",
    "cong viec",
    "deadline",
}
REMINDER_LIST_HINTS = {"danh sách", "list", "liệt kê", "liet ke", "xem", "show"}
REMINDER_COMPLETE_HINTS = {"hoàn thành", "hoan thanh", "xong", "done"}
REMINDER_DELETE_HINTS = {"xóa", "xoa", "delete", "remove", "hủy", "huy"}
REMINDER_UPDATE_HINTS = {"sửa", "sua", "đổi", "doi", "dời", "doi", "chuyển", "chuyen", "cập nhật", "cap nhat"}
REMINDER_SNOOZE_HINTS = {"nhắc lại", "nhac lai", "snooze", "hoãn", "hoan"}
MEMORY_VIEW_HINTS = {"xem memory", "xem bo nho", "xem bộ nhớ", "xem preference", "xem hồ sơ", "xem ho so"}
MEMORY_CLEAR_HINTS = {"clear history", "xóa lịch sử memory", "xoa lich su memory", "xóa lịch sử bộ nhớ", "xoa lich su bo nho"}
ENTITY_VIEW_HINTS = {"xem entity", "xem entities", "xem danh bạ assistant", "xem thuc the", "xem thực thể"}
PINNED_VIEW_HINTS = {"xem ghi chú ghim", "xem ghi chu ghim", "xem pinned knowledge", "xem ghi nhớ ghim"}
WORKFLOW_HINTS = {"workflow", "quy trình", "quy trinh"}
WORKFLOW_LIST_HINTS = {"xem", "list", "liệt kê", "liet ke", "danh sách", "danh sach"}
WORKFLOW_RUN_HINTS = {"chạy", "chay", "run", "thực thi", "thuc thi"}
WORKFLOW_DELETE_HINTS = {"xóa", "xoa", "delete", "remove"}
VN_FIXED_TZ = timezone(timedelta(hours=7))

CUSTOM_APP_HINTS = {
    "app da luu",
    "app đã lưu",
    "ung dung da luu",
    "ứng dụng đã lưu",
    "custom app",
    "ung dung custom",
}
CUSTOM_APP_LIST_HINTS = {"xem", "list", "liet ke", "liệt kê", "danh sach", "danh sách"}
CUSTOM_APP_DELETE_HINTS = {"xoa", "xóa", "delete", "remove"}

MENU_HINTS = {
    "menu",
    "mở menu",
    "help",
    "tro giup",
    "trợ giúp",
    "huong dan",
    "hướng dẫn",
    "tính năng",
    "tinh nang",
    "chức năng",
    "chuc nang",
}


WEB_PLATFORM_URLS = {
    "youtube": "https://www.youtube.com",
    "yt": "https://www.youtube.com",
    "ytb": "https://www.youtube.com",
    "facebook": "https://www.facebook.com",
    "fb": "https://www.facebook.com",
    "email": "https://mail.google.com",
    "gmail": "https://mail.google.com",
}

# Verbs
OPEN_FILE_VERBS = {"mở", "mo", "open"}

DELETE_VERBS = {"xóa", "delete", "remove"}
COPY_VERBS = {"copy", "sao chép", "sao chep", "chép", "chep"}
MOVE_VERBS = {"cut", "move", "di chuyển", "di chuyen", "cắt", "cat"}

MEDIA_VERBS = {"mở", "nghe", "bật", "phát", "xem", "play", "open"}

CLOSE_APP_VERBS = {"đóng", "thoát", "tắt", "quit", "exit", "close"}

PATH_PATTERNS = [
    r"[A-Za-z]:\\",  # C:\...
    r"\\\\",  # \\server\share
]

COPY_MOVE_SEPARATORS = [
    " vào ",
    " vao ",
    " sang ",
    " tới ",
    " toi ",
    " đến ",
    " den ",
    " to ",
]

DELETE_LOCATION_SEPARATORS = [
    " khỏi ", " khoi ",
    " từ ", " tu ",
    " trong ", " ở ", " o ",
    " from ", " in ", " on ",
]

QUESTION_STARTS = (
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

QUESTION_PATTERNS = (
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

ALL_HINTS = {"tất cả", "toàn bộ", "hết", "all"}


def _wants_close_all(text: str) -> bool:
    t = _normalize(text)
    return any(h in t for h in ALL_HINTS)


def _strip_telegram_mirror_prefix(text: str) -> str:
    match = re.match(
        r"^\s*telegram\s+user\s+\d+\s*/\s*chat\s+-?\d+\s*:\s*(.+?)\s*$",
        text or "",
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return text


KEYBOARD_MULTIWORD_KEYS = {
    "page up": "pageup",
    "page down": "pagedown",
    "arrow up": "up",
    "arrow down": "down",
    "arrow left": "left",
    "arrow right": "right",
    "mui ten len": "up",
    "mui ten xuong": "down",
    "mui ten trai": "left",
    "mui ten phai": "right",
    "caps lock": "capslock",
}

KEYBOARD_KEY_ALIASES = {
    "control": "ctrl",
    "ctrl": "ctrl",
    "shift": "shift",
    "alt": "alt",
    "windows": "win",
    "window": "win",
    "win": "win",
    "enter": "enter",
    "return": "enter",
    "esc": "escape",
    "escape": "escape",
    "tab": "tab",
    "space": "space",
    "backspace": "backspace",
    "delete": "delete",
    "del": "delete",
    "insert": "insert",
    "home": "home",
    "end": "end",
    "pageup": "pageup",
    "pagedown": "pagedown",
    "up": "up",
    "down": "down",
    "left": "left",
    "right": "right",
    "capslock": "capslock",
}


def _extract_keyboard_duration_seconds(text: str) -> float:
    folded = nlu_ml.normalize_nlu_text(text)
    match = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(?:giay|s|second|seconds)\b", folded)
    if not match:
        return 0.0
    try:
        return max(0.0, min(30.0, float(match.group(1).replace(",", "."))))
    except ValueError:
        return 0.0


def _extract_keyboard_keys(text: str) -> list[str]:
    folded = nlu_ml.normalize_nlu_text(text)
    folded = re.sub(r"\b\d+(?:[.,]\d+)?\s*(?:giay|s|second|seconds)\b", " ", folded)
    folded = folded.replace("+", " ")
    folded = re.sub(
        r"\b(?:phim|nut|to hop|ban phim|trong|khoang|giay|seconds?|key|keys)\b",
        " ",
        folded,
    )
    for phrase, key in sorted(KEYBOARD_MULTIWORD_KEYS.items(), key=lambda item: len(item[0]), reverse=True):
        folded = re.sub(rf"(?<!\w){re.escape(phrase)}(?!\w)", f" {key} ", folded)
    tokens = re.findall(r"[a-z0-9]+", folded)
    keys: list[str] = []
    for token in tokens:
        key = KEYBOARD_KEY_ALIASES.get(token)
        if key:
            keys.append(key)
            continue
        if re.fullmatch(r"f(?:[1-9]|1\d|2[0-4])", token):
            keys.append(token)
            continue
        if re.fullmatch(r"[a-z0-9]", token):
            keys.append(token)
    return keys


def _extract_remote_control_decision(raw: str) -> RouteDecision | None:
    raw = _strip_telegram_mirror_prefix(raw)
    t = _normalize(raw)
    folded_t = nlu_ml.normalize_nlu_text(raw)

    target_text_match = re.match(r"^\s*(?:nhắn|nhan|nhập vào mục tiêu|nhap vao muc tieu|gửi vào mục tiêu|gui vao muc tieu)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if target_text_match:
        submit = any(p in t for p in ["nhan ", "nhắn", "gui vao muc tieu", "gửi vào mục tiêu"])
        return RouteDecision(
            type=RouteType.REMOTE_TARGET,
            args={"action": "send_text" if submit else "type_text", "text": target_text_match.group(1).strip(), "submit": submit},
            reason="Type text into selected remote input target.",
            confidence=0.95,
        )

    if any(p in t for p in ["chon o comment tiktok", "chọn ô comment tiktok", "chon muc tieu tiktok", "chọn mục tiêu tiktok", "chon o live", "chọn ô live"]):
        return RouteDecision(
            type=RouteType.REMOTE_TARGET,
            args={"action": "set_target", "target": "tiktok_comment"},
            reason="Set TikTok comment input as remote target.",
            confidence=0.96,
        )

    if any(p in t for p in ["chon o dang focus", "chọn ô đang focus", "chon muc tieu hien tai", "chọn mục tiêu hiện tại", "chon o hien tai", "chọn ô hiện tại"]):
        return RouteDecision(
            type=RouteType.REMOTE_TARGET,
            args={"action": "set_target", "target": "current_input"},
            reason="Set current focused input as remote target.",
            confidence=0.95,
        )

    if any(p in t for p in ["bo muc tieu", "bỏ mục tiêu", "xoa muc tieu", "xóa mục tiêu", "clear target"]):
        return RouteDecision(
            type=RouteType.REMOTE_TARGET,
            args={"action": "clear_target"},
            reason="Clear remote input target.",
            confidence=0.95,
        )

    if any(p in t for p in ["muc tieu hien tai", "mục tiêu hiện tại", "target hien tai", "target hiện tại"]):
        return RouteDecision(
            type=RouteType.REMOTE_TARGET,
            args={"action": "status"},
            reason="Show current remote input target.",
            confidence=0.95,
        )

    mouse_match = re.match(r"^\s*(?:click|bấm|bam)\s+(\d{1,3})\s+(\d{1,3})\s*$", raw, flags=re.IGNORECASE)
    if mouse_match:
        return RouteDecision(
            type=RouteType.MOUSE_CONTROL,
            args={"action": "click_ratio", "x": int(mouse_match.group(1)), "y": int(mouse_match.group(2))},
            reason="Click screen by percentage coordinates.",
            confidence=0.95,
        )

    if any(p in t for p in ["click giua man hinh", "click giữa màn hình", "bam giua man hinh", "bấm giữa màn hình"]):
        return RouteDecision(type=RouteType.MOUSE_CONTROL, args={"action": "click_center"}, reason="Click screen center.", confidence=0.95)
    if any(p in t for p in ["click goc duoi phai", "click góc dưới phải", "bam goc duoi phai", "bấm góc dưới phải"]):
        return RouteDecision(type=RouteType.MOUSE_CONTROL, args={"action": "click_bottom_right"}, reason="Click bottom-right screen.", confidence=0.95)
    if any(p in t for p in ["double click", "click dup", "click đúp", "nhap dup", "nhấp đúp"]):
        return RouteDecision(type=RouteType.MOUSE_CONTROL, args={"action": "double_click"}, reason="Double click current mouse position.", confidence=0.94)
    if any(p in t for p in ["chuot phai", "chuột phải", "right click"]):
        return RouteDecision(type=RouteType.MOUSE_CONTROL, args={"action": "right_click"}, reason="Right click current mouse position.", confidence=0.94)

    backspace_match = re.search(r"(?:backspace|xoa lui|xóa lùi)\s+(\d+)", t)
    if backspace_match:
        return RouteDecision(type=RouteType.KEYBOARD_CONTROL, args={"action": "backspace", "count": int(backspace_match.group(1))}, reason="Press Backspace repeatedly.", confidence=0.95)

    if any(p in t for p in ["tha het phim", "thả hết phím", "nha het phim", "nhả hết phím", "release all keys"]) or any(
        p in folded_t for p in ["tha het phim", "nha het phim", "release all keys"]
    ):
        return RouteDecision(
            type=RouteType.KEYBOARD_CONTROL,
            args={"action": "release_all"},
            reason="Release all held keyboard keys.",
            confidence=0.97,
        )

    hold_match = re.match(r"^\s*(?:nhấn giữ|nhan giu|giữ|giu|hold|key down)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if hold_match:
        keys = _extract_keyboard_keys(hold_match.group(1))
        if keys:
            args: Dict[str, Any] = {"action": "hold", "keys": keys}
            duration = _extract_keyboard_duration_seconds(raw)
            if duration > 0:
                args["duration_seconds"] = duration
            return RouteDecision(
                type=RouteType.KEYBOARD_CONTROL,
                args=args,
                reason="Hold keyboard key or key combo.",
                confidence=0.96,
            )

    release_match = re.match(r"^\s*(?:thả|tha|nhả|nha|release|key up)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if release_match:
        keys = _extract_keyboard_keys(release_match.group(1))
        if keys:
            return RouteDecision(
                type=RouteType.KEYBOARD_CONTROL,
                args={"action": "release", "keys": keys},
                reason="Release held keyboard key or key combo.",
                confidence=0.96,
            )

    combo_match = re.match(r"^\s*(?:nhấn tổ hợp|nhan to hop|bấm tổ hợp|bam to hop|hotkey|nhấn phím|nhan phim|bấm phím|bam phim)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if combo_match:
        keys = _extract_keyboard_keys(combo_match.group(1))
        if keys:
            return RouteDecision(
                type=RouteType.KEYBOARD_CONTROL,
                args={"action": "press_combo", "keys": keys},
                reason="Press keyboard key combo.",
                confidence=0.95,
            )

    keyboard_exact = {
        "enter": "enter",
        "nhan enter": "enter",
        "nhấn enter": "enter",
        "esc": "escape",
        "escape": "escape",
        "tab": "tab",
        "backspace": "backspace",
        "delete": "delete",
        "space": "space",
        "ctrl a": "select_all",
        "ctrl+a": "select_all",
        "chon tat ca": "select_all",
        "chọn tất cả": "select_all",
        "copy": "copy",
        "ctrl c": "copy",
        "ctrl+c": "copy",
        "paste": "paste",
        "dan": "paste",
        "dán": "paste",
        "ctrl v": "paste",
        "ctrl+v": "paste",
        "cut": "cut",
        "cat": "cut",
        "cắt": "cut",
        "undo": "undo",
        "redo": "redo",
        "xoa dong": "delete_line",
        "xóa dòng": "delete_line",
    }
    keyboard_action = keyboard_exact.get(t)
    if keyboard_action:
        return RouteDecision(
            type=RouteType.KEYBOARD_CONTROL,
            args={"action": keyboard_action},
            reason="Keyboard remote control intent.",
            confidence=0.94,
        )

    if any(p in t for p in ["chup man hinh", "chụp màn hình", "screenshot", "screen shot"]):
        return RouteDecision(
            type=RouteType.SCREENSHOT,
            args={},
            reason="Remote screenshot intent.",
            confidence=0.98,
        )

    if t in {"status", "pc", "may", "máy"} or any(p in t for p in ["trang thai may", "trạng thái máy", "may the nao", "máy thế nào", "bao cao may", "báo cáo máy", "system status", "pc status"]):
        return RouteDecision(
            type=RouteType.SYSTEM_STATUS,
            args={},
            reason="System status intent.",
            confidence=0.98,
        )

    if any(p in folded_t for p in ["gui clipboard", "lay clipboard", "clipboard may", "clipboard cua may", "send clipboard"]):
        return RouteDecision(
            type=RouteType.CLIPBOARD_BRIDGE,
            args={"action": "get"},
            reason="Send PC clipboard text back to user.",
            confidence=0.96,
        )
    if any(p in folded_t for p in ["xoa clipboard", "clear clipboard"]):
        return RouteDecision(
            type=RouteType.CLIPBOARD_BRIDGE,
            args={"action": "clear"},
            reason="Clear PC clipboard.",
            confidence=0.95,
        )
    clipboard_match = re.match(
        r"^\s*(?:copy vào máy|copy vao may|copy đoạn này vào máy|copy doan nay vao may|set clipboard|đưa vào clipboard|dua vao clipboard)\s+(.+?)\s*$",
        raw,
        flags=re.IGNORECASE,
    )
    if clipboard_match:
        return RouteDecision(
            type=RouteType.CLIPBOARD_BRIDGE,
            args={"action": "set", "text": clipboard_match.group(1).strip()},
            reason="Set PC clipboard from remote text.",
            confidence=0.96,
        )

    if any(p in folded_t for p in ["tat che do ngu quen", "huy che do ngu quen", "disable sleep guard", "sleep guard off"]):
        return RouteDecision(
            type=RouteType.LAZY_IDLE_GUARD,
            args={"action": "disable"},
            reason="Disable lazy idle sleep guard.",
            confidence=0.96,
        )
    if any(p in folded_t for p in ["trang thai che do ngu quen", "ngu quen dang", "sleep guard status"]):
        return RouteDecision(
            type=RouteType.LAZY_IDLE_GUARD,
            args={"action": "status"},
            reason="Lazy idle sleep guard status.",
            confidence=0.95,
        )
    if any(p in folded_t for p in ["che do ngu quen", "bat ngu quen", "ngu quen", "sleep guard", "idle sleep"]):
        args = {"action": "enable"}
        args.update(_extract_idle_guard_args(raw))
        return RouteDecision(
            type=RouteType.LAZY_IDLE_GUARD,
            args=args,
            reason="Enable lazy idle sleep guard.",
            confidence=0.94,
        )

    has_youtube_target = any(p in t for p in ["youtube", "ytb", "yt"])
    if has_youtube_target:
        if any(p in t for p in ["tam dung", "tạm dừng", "dung phat", "dừng phát", "pause", "play", "phat tiep", "phát tiếp"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "play_pause"},
                reason="YouTube play/pause intent.",
                confidence=0.96,
            )
        if any(p in t for p in ["chuyen bai", "chuyển bài", "bai tiep", "bài tiếp", "video tiep", "video tiếp", "next"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "next"},
                reason="YouTube next video intent.",
                confidence=0.96,
            )
        if any(p in t for p in ["lui bai", "lùi bài", "bai truoc", "bài trước", "video truoc", "video trước", "previous"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "previous"},
                reason="YouTube previous video intent.",
                confidence=0.96,
            )
        if any(p in t for p in ["tat tieng", "tắt tiếng", "mute"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "mute"},
                reason="YouTube mute intent.",
                confidence=0.96,
            )
        if any(p in t for p in ["tang am luong", "tăng âm lượng", "volume up"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "volume_up"},
                reason="YouTube volume up intent.",
                confidence=0.96,
            )
        if any(p in t for p in ["giam am luong", "giảm âm lượng", "volume down"]):
            return RouteDecision(
                type=RouteType.YOUTUBE_CONTROL,
                args={"action": "volume_down"},
                reason="YouTube volume down intent.",
                confidence=0.96,
            )

    if any(p in t for p in ["dang mo gi", "đang mở gì", "may dang lam gi", "máy đang làm gì", "tong quan may", "tổng quan máy", "remote overview"]):
        return RouteDecision(
            type=RouteType.REMOTE_OVERVIEW,
            args={},
            reason="Remote overview intent.",
            confidence=0.98,
        )

    if any(p in t for p in ["im lang", "im lặng", "che do im lang", "chế độ im lặng", "quiet mode"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "quiet"},
            reason="Quiet preset intent.",
            confidence=0.96,
        )
    if any(p in t for p in ["ra ngoai", "ra ngoài", "toi ra ngoai", "tôi ra ngoài", "away mode"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "away"},
            reason="Away preset intent.",
            confidence=0.96,
        )
    if any(p in t for p in ["ve nha", "về nhà", "ve may", "về máy", "back to pc", "home mode"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "back"},
            reason="Back-to-PC preset intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["tap trung", "tập trung", "focus mode", "che do tap trung", "chế độ tập trung"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "focus"},
            reason="Focus preset intent.",
            confidence=0.95,
        )
    if any(p in t for p in ["di ngu", "đi ngủ", "che do di ngu", "chế độ đi ngủ", "ngu nhe", "ngủ nhẹ"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "sleep"},
            reason="Sleep preset intent.",
            confidence=0.96,
        )
    if any(p in t for p in ["don may", "dọn máy", "don dep may", "dọn dẹp máy", "cleanup pc"]):
        return RouteDecision(
            type=RouteType.REMOTE_PRESET,
            args={"action": "cleanup"},
            reason="Cleanup preset intent.",
            confidence=0.95,
        )

    if any(
        p in folded_t
        for p in [
            "huy hen gio tat may",
            "huy lich tat may",
            "huy tat may",
            "cancel shutdown",
            "abort shutdown",
            "shutdown abort",
        ]
    ):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "cancel_shutdown"},
            reason="Cancel scheduled shutdown intent.",
            confidence=0.98,
        )

    if any(
        p in folded_t
        for p in [
            "lich tat may",
            "hen gio tat may dang",
            "xem hen gio tat may",
            "kiem tra hen gio tat may",
            "shutdown status",
        ]
    ):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "shutdown_status"},
            reason="Scheduled shutdown status intent.",
            confidence=0.96,
        )

    if any(p in folded_t for p in ["ngu dem", "che do ngu dem", "sleep timer", "night sleep"]):
        args = {"action": "night_sleep"}
        if _looks_like_power_schedule(raw):
            args.update(_extract_power_schedule_args(raw, default_delay_seconds=2 * 60 * 60))
        else:
            args.update(_extract_power_schedule_args("", default_delay_seconds=2 * 60 * 60))
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args=args,
            reason="Night sleep timer intent.",
            confidence=0.97,
        )

    if any(p in t for p in ["tat may", "tắt máy", "shutdown", "shut down"]):
        if _looks_like_power_schedule(raw):
            args = {"action": "shutdown"}
            args.update(_extract_power_schedule_args(raw))
            return RouteDecision(
                type=RouteType.SYSTEM_POWER,
                args=args,
                reason="Scheduled system shutdown intent.",
                confidence=0.98,
            )
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "shutdown"},
            reason="System shutdown intent.",
            confidence=0.98,
        )
    if any(p in t for p in ["khoi dong lai", "khởi động lại", "restart", "reboot"]):
        if _looks_like_power_schedule(raw):
            args = {"action": "restart"}
            args.update(_extract_power_schedule_args(raw))
            return RouteDecision(
                type=RouteType.SYSTEM_POWER,
                args=args,
                reason="Scheduled system restart intent.",
                confidence=0.97,
            )
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "restart"},
            reason="System restart intent.",
            confidence=0.98,
        )
    if any(p in t for p in ["sleep sau", "sleep sâu", "ngu sau", "ngủ sâu", "sleep may", "ngu may", "ngủ máy", "dua may vao sleep", "đưa máy vào sleep", "che do sleep sau", "chế độ sleep sâu"]):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "sleep_deep"},
            reason="System deep sleep intent.",
            confidence=0.97,
        )
    if any(p in t for p in ["hibernate", "ngu dong", "ngủ đông"]):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "hibernate"},
            reason="System hibernate intent.",
            confidence=0.97,
        )
    if any(p in t for p in ["tat man hinh", "tắt màn hình", "tat monitor", "turn off monitor", "turn off screen"]):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "monitor_off"},
            reason="Turn monitor off intent.",
            confidence=0.97,
        )
    if any(p in t for p in ["ngu nhe", "ngủ nhẹ", "sleep nhe", "sleep nhẹ", "sleep"]):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "light_sleep"},
            reason="Light sleep intent.",
            confidence=0.96,
        )
    if any(p in t for p in ["khoa may", "khóa máy", "lock may", "lock screen", "khoa man hinh", "khóa màn hình"]):
        return RouteDecision(
            type=RouteType.SYSTEM_POWER,
            args={"action": "lock"},
            reason="Lock workstation intent.",
            confidence=0.97,
        )

    if any(p in t for p in ["may dang chay gi", "máy đang chạy gì", "app dang chay", "app đang chạy", "ung dung dang chay", "ứng dụng đang chạy", "process dang chay", "running apps"]):
        return RouteDecision(
            type=RouteType.LIST_RUNNING_APPS,
            args={},
            reason="List running apps intent.",
            confidence=0.96,
        )

    if any(p in t for p in ["cua so dang mo", "cửa sổ đang mở", "window dang mo", "windows dang mo", "list windows", "open windows"]):
        return RouteDecision(
            type=RouteType.LIST_OPEN_WINDOWS,
            args={},
            reason="List open windows intent.",
            confidence=0.96,
        )

    if any(p in t for p in ["tab edge dang mo", "tab edge đang mở", "tab chrome dang mo", "tab chrome đang mở", "tab browser dang mo", "tab browser đang mở", "tab dang mo", "tab đang mở", "list tabs", "browser tabs"]):
        return RouteDecision(
            type=RouteType.LIST_BROWSER_TABS,
            args={"browser": _extract_browser(raw)},
            reason="List browser tabs intent.",
            confidence=0.96,
        )

    m = re.search(r"(?:dong|đóng|tat|tắt|close)\s+tab\s*(?:so|số)?\s*(\d+)\b", t)
    if m:
        return RouteDecision(
            type=RouteType.BROWSER_TAB_CONTROL,
            args={"action": "close", "index": int(m.group(1))},
            reason="Close browser tab by numbered list intent.",
            confidence=0.96,
        )
    m = re.search(r"(?:chuyen|chuyển|mo|mở|activate|switch)\s+tab\s*(?:so|số)?\s*(\d+)\b", t)
    if m:
        return RouteDecision(
            type=RouteType.BROWSER_TAB_CONTROL,
            args={"action": "activate", "index": int(m.group(1))},
            reason="Activate browser tab by numbered list intent.",
            confidence=0.96,
        )
    m = re.search(r"(?:reload|refresh|tai lai|tải lại|f5)\s+tab\s*(?:so|số)?\s*(\d+)\b", t)
    if m:
        return RouteDecision(
            type=RouteType.BROWSER_TAB_CONTROL,
            args={"action": "reload", "index": int(m.group(1))},
            reason="Reload browser tab by numbered list intent.",
            confidence=0.95,
        )

    m = re.search(r"(?:dong|đóng|tat|tắt|close)\s+(?:cua so|cửa sổ|window)\s*(?:so|số)?\s*(\d+)\b", t)
    if m:
        return RouteDecision(
            type=RouteType.WINDOW_CONTROL,
            args={"action": "close_by_index", "index": int(m.group(1))},
            reason="Close selected window by numbered list intent.",
            confidence=0.96,
        )

    m = re.search(r"(?:tat|tắt|dong|đóng|close)\s+(?:app|ung dung|ứng dụng|process)?\s*(?:so|số)?\s*(\d+)\b", t)
    if m:
        return RouteDecision(
            type=RouteType.CLOSE_RUNNING_APP,
            args={"index": int(m.group(1))},
            reason="Close running app by numbered list intent.",
            confidence=0.95,
        )

    if any(p in t for p in ["tam dung nhac", "tạm dừng nhạc", "pause nhac", "pause", "play pause"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "play_pause"},
            reason="Media play/pause intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["chuyen bai", "chuyển bài", "bai tiep", "bài tiếp", "next song", "next track"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "next"},
            reason="Media next intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["lui bai", "lùi bài", "bai truoc", "bài trước", "previous song", "previous track"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "previous"},
            reason="Media previous intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["unmute", "bat tieng", "bật tiếng", "mo tieng", "mở tiếng", "bo mute", "bỏ mute"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "unmute"},
            reason="System unmute intent.",
            confidence=0.95,
        )
    if any(p in t for p in ["toggle mute", "dao mute", "đảo mute", "bat tat mute", "bật tắt mute"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "mute_toggle"},
            reason="Media mute toggle intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["mute may", "mute máy", "mute", "tat tieng may", "tắt tiếng máy", "tat tieng", "tắt tiếng"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "mute"},
            reason="System mute intent.",
            confidence=0.95,
        )
    if any(p in t for p in ["tang am luong", "tăng âm lượng", "volume up"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "volume_up"},
            reason="Volume up intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["giam am luong", "giảm âm lượng", "volume down"]):
        return RouteDecision(
            type=RouteType.MEDIA_CONTROL,
            args={"action": "volume_down"},
            reason="Volume down intent.",
            confidence=0.94,
        )

    if any(p in folded_t for p in ["dong app nang", "tat app nang", "dong ung dung nang", "tat ung dung nang", "close heavy apps"]):
        return RouteDecision(
            type=RouteType.SMART_CLOSE,
            args={"action": "close_heavy_apps"},
            reason="Close high-memory visible apps.",
            confidence=0.95,
        )
    if any(p in folded_t for p in ["dong web giai tri", "tat web giai tri", "dong tab giai tri", "tat tab giai tri", "close distracting web"]):
        return RouteDecision(
            type=RouteType.SMART_CLOSE,
            args={"action": "close_distracting_web"},
            reason="Close distracting browser tabs.",
            confidence=0.95,
        )
    if any(p in folded_t for p in ["dong tat ca tru", "tat tat ca tru", "dong het tru", "tat het tru", "close all except"]):
        except_apps = _extract_except_app_keys(raw)
        return RouteDecision(
            type=RouteType.SMART_CLOSE,
            args={"action": "close_except", "except_apps": except_apps},
            reason="Close visible apps except an allowlist.",
            confidence=0.93,
        )

    scheduled_close_decision = _extract_scheduled_close_decision(raw)
    if scheduled_close_decision is not None:
        return scheduled_close_decision

    if any(p in t for p in ["dong tab", "đóng tab", "tat tab", "tắt tab", "close tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "close_tab"},
            reason="Browser close tab intent.",
            confidence=0.94,
        )

    text_match = re.match(r"^\s*(?:nhập text|nhap text|dán text|dan text|gõ text|go text|gõ|go|type)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if text_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "type_text", "text": text_match.group(1).strip()},
            reason="Type/paste text into current focused input.",
            confidence=0.95,
        )

    text_enter_match = re.match(r"^\s*(?:gửi text|gui text|nhập rồi enter|nhap roi enter|type enter)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if text_enter_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "type_text_enter", "text": text_enter_match.group(1).strip()},
            reason="Type/paste text and press Enter.",
            confidence=0.94,
        )

    address_match = re.match(r"^\s*(?:nhập địa chỉ|nhap dia chi|mở địa chỉ|mo dia chi|address|go to)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if address_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "address_text", "text": address_match.group(1).strip(), "submit": True},
            reason="Open address/search text in browser address bar.",
            confidence=0.95,
        )

    find_match = re.match(r"^\s*(?:tìm trong trang|tim trong trang|find in page|find)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if find_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "find_text", "text": find_match.group(1).strip()},
            reason="Find text in current page.",
            confidence=0.95,
        )

    tiktok_comment_match = re.match(r"^\s*(?:nhập comment|nhap comment|comment tiktok|comment live|nhập live|nhap live)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if tiktok_comment_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "tiktok_comment_text", "text": tiktok_comment_match.group(1).strip()},
            reason="Type TikTok live comment.",
            confidence=0.94,
        )

    tiktok_send_match = re.match(r"^\s*(?:gửi comment|gui comment|gửi live|gui live)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    if tiktok_send_match:
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "tiktok_comment_send", "text": tiktok_send_match.group(1).strip()},
            reason="Type and send TikTok live comment.",
            confidence=0.94,
        )

    if any(p in t for p in ["tai lai trang", "tải lại trang", "reload trang", "refresh trang", "f5", "lam moi trang", "làm mới trang"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "reload"},
            reason="Browser reload intent.",
            confidence=0.95,
        )
    if any(p in t for p in ["hard reload", "tai lai manh", "tải lại mạnh", "ctrl f5", "ctrl+f5"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "hard_reload"},
            reason="Browser hard reload intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["dung tai trang", "dừng tải trang", "stop loading", "dung load", "dừng load"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "stop_loading"},
            reason="Browser stop loading intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["quay lai trang", "quay lại trang", "back trang", "browser back", "trang truoc", "trang trước"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "back"},
            reason="Browser back intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["tien trang", "tiến trang", "forward trang", "browser forward", "trang sau"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "forward"},
            reason="Browser forward intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["cuon xuong", "cuộn xuống", "scroll down", "page down"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "scroll_down"},
            reason="Browser scroll down intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["cuon len", "cuộn lên", "scroll up", "page up"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "scroll_up"},
            reason="Browser scroll up intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["ve dau trang", "về đầu trang", "dau trang", "đầu trang", "home trang"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "page_top"},
            reason="Browser page top intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["ve cuoi trang", "về cuối trang", "cuoi trang", "cuối trang", "end trang"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "page_bottom"},
            reason="Browser page bottom intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["phong to trang", "phóng to trang", "zoom in", "zoom to"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "zoom_in"},
            reason="Browser zoom in intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["thu nho trang", "thu nhỏ trang", "zoom out"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "zoom_out"},
            reason="Browser zoom out intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["reset zoom", "zoom mac dinh", "zoom mặc định"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "zoom_reset"},
            reason="Browser zoom reset intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["mo lai tab vua dong", "mở lại tab vừa đóng", "reopen tab", "khoi phuc tab", "khôi phục tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "reopen_closed_tab"},
            reason="Browser reopen closed tab intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["nhan doi tab", "nhân đôi tab", "duplicate tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "duplicate_tab"},
            reason="Browser duplicate tab intent.",
            confidence=0.94,
        )
    if any(p in t for p in ["thanh dia chi", "thanh địa chỉ", "address bar", "nhap dia chi", "nhập địa chỉ"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "address_bar"},
            reason="Browser address bar intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["tim trong trang", "tìm trong trang", "find in page", "ctrl f", "ctrl+f"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "find_in_page"},
            reason="Browser find in page intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["bookmark trang", "danh dau trang", "đánh dấu trang", "luu bookmark", "lưu bookmark"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "bookmark"},
            reason="Browser bookmark intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["tab ke tiep", "tab kế tiếp", "tab tiep", "tab tiếp", "next tab", "chuyen tab", "chuyển tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "next_tab"},
            reason="Browser next tab intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["tab truoc", "tab trước", "previous tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "previous_tab"},
            reason="Browser previous tab intent.",
            confidence=0.93,
        )
    if any(p in t for p in ["mo tab moi", "mở tab mới", "new tab"]):
        return RouteDecision(
            type=RouteType.BROWSER_CONTROL,
            args={"action": "new_tab"},
            reason="Browser new tab intent.",
            confidence=0.93,
        )
    return None


def _has_path(text: str) -> bool:
    return any(re.search(p, text) for p in PATH_PATTERNS)


def _extract_first_path(text: str) -> str:
    m = re.search(r"([A-Za-z]:\\[^\n\r]+)", text)
    return (m.group(1).strip().strip('"') if m else text.strip().strip('"'))


def _normalize(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _strip_leading_action(text: str) -> str:
    """
    Cắt phần động từ đầu câu dựa trên configs/aliases.json (verb_prefixes)
    Ví dụ: "đóng notepad" -> "notepad"
    """
    t = _normalize(text)
    cfg = load_aliases()
    prefixes = cfg.get("verb_prefixes") or []

    # ưu tiên match prefix dài trước để tránh "tìm" ăn mất "tìm kiếm"
    prefixes = sorted(
        [p.strip().lower() for p in prefixes if p.strip()], key=len, reverse=True
    )

    for p in prefixes:
        if t.startswith(p + " "):
            return t[len(p) :].strip()
        if t == p:
            return ""
    return t


def _strip_polite_suffix(text: str) -> str:
    value = (text or "").strip()
    if not value:
        return ""
    while True:
        folded = nlu_ml.normalize_nlu_text(value).strip()
        removed = False
        for suffix in sorted(POLITE_SUFFIXES, key=len, reverse=True):
            if folded == suffix:
                return ""
            if folded.endswith(" " + suffix):
                value = value[: -len(suffix)].strip(" ,.!?")
                removed = True
                break
        if not removed:
            return value.strip()


def _extract_extensions(text: str) -> Optional[list[str]]:
    t = _normalize(text)
    found = []
    for ext in EXT_HINTS:
        if re.search(rf"(\.{ext}\b)|(\b{ext}\b)", t):
            found.append(ext)
    return found or None


def _strip_entry_prefix(text: str) -> str:
    t = _normalize(text)
    for k in ["file", "tệp", "tập tin", "thư mục", "folder", "dir", "directory"]:
        if t.startswith(k + " "):
            return t[len(k):].strip()
        if t == k:
            return ""
    return t


def _split_copy_move_command(text: str) -> tuple[str, str] | tuple[None, None]:
    q = _strip_leading_action(text)
    q = " ".join(q.split()).strip()
    q_lower = q.lower()
    for sep in COPY_MOVE_SEPARATORS:
        idx = q_lower.find(sep)
        if idx == -1:
            continue
        src = q[:idx].strip()
        dst = q[idx + len(sep):].strip()
        if src and dst:
            return _strip_entry_prefix(src), _strip_entry_prefix(dst)
    return None, None


def _looks_like_question(text: str) -> bool:
    t = _normalize(text)
    if not t:
        return False
    if "?" in text:
        return True
    if t.startswith(QUESTION_STARTS):
        return True
    return any(p in t for p in QUESTION_PATTERNS)


def _has_youtube_hint(text: str) -> bool:
    t = _normalize(text)
    folded = nlu_ml.normalize_nlu_text(text)
    return any(
        re.search(rf"(?<!\w){re.escape(h)}(?!\w)", t)
        or re.search(rf"(?<!\w){re.escape(h)}(?!\w)", folded)
        for h in YOUTUBE_HINTS
    )


def _extract_browser(text: str) -> str:
    t = _normalize(text)
    if "chrome" in t:
        return "chrome"
    if "edge" in t:
        return "edge"
    if "default" in t:
        return "default"
    return "default"

def _extract_web_platform_url(text: str) -> str | None:
    t = _normalize(text)
    for alias, url in WEB_PLATFORM_URLS.items():
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", t):
            return url
    return None


def _extract_first_url(text: str) -> str:
    match = re.search(r"\bhttps?://[^\s]+|\bwww\.[^\s]+", text or "", flags=re.IGNORECASE)
    if not match:
        return ""
    url = match.group(0).strip().rstrip(".,;)")
    if url.lower().startswith("www."):
        url = "https://" + url
    return url

def _clean_youtube_query(text: str) -> str:
    q = _strip_leading_action(text)
    for k in ["trên ytb", "trên youtube", "ytb", "youtube", "yt"]:
        q = q.replace(k, " ")
    for k in [
        "bằng chrome",
        "bằng edge",
        "bằng default",
        "mở bằng chrome",
        "mở bằng edge",
    ]:
        q = q.replace(k, " ")
    return " ".join(q.split()).strip()


def _looks_like_filename(text: str) -> bool:
    t = _normalize(text)
    if any(re.search(rf"(\.{ext}\b)|(\b{ext}\b)", t) for ext in EXT_HINTS):
        return True
    if any(h in t for h in ["file", "tệp", "tập tin"]):
        return True
    return False


def _strip_folder_prefix(text: str) -> str:
    t = _normalize(text)
    for k in ["thư mục", "folder", "dir", "directory"]:
        if t.startswith(k + " "):
            return t[len(k) :].strip()
        if t == k:
            return ""
    return t


def _strip_app_prefix(text: str) -> str:
    t = _normalize(text)
    for k in ["cái", "cai", "app", "ứng dụng", "ung dung", "application", "program"]:
        if t.startswith(k + " "):
            return t[len(k):].strip()
        if t == k:
            return ""
    return t


def _token_contains(text: str, needle: str) -> bool:
    return bool(re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", _normalize(text)))


def _looks_like_app_command(text: str) -> tuple[str | None, str]:
    stripped = _strip_app_prefix(_strip_leading_action(text))
    app_key, remainder = executor.extract_app_and_remainder(stripped)
    return app_key, _strip_polite_suffix(remainder)


def _build_open_file_args(query: str) -> tuple[str, Optional[list[str]]]:
    cleaned = re.sub(r"^(file|tệp|tập tin)\s+", "", query).strip()
    cleaned = _strip_polite_suffix(cleaned)
    exts = _extract_extensions(cleaned)

    app_key, remainder = executor.extract_app_and_remainder(cleaned)
    remainder = _strip_polite_suffix(remainder)
    if app_key in executor.APP_OPEN_FILE_HINTS and remainder:
        return remainder, executor.APP_OPEN_FILE_HINTS[app_key]

    return cleaned, exts


def _extract_email_index(text: str) -> Optional[int]:
    patterns = [
        r"(?:mail|email|gmail|thư)\s*(?:số\s*)?(\d+)",
        r"số\s+(\d+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, _normalize(text))
        if m:
            try:
                return int(m.group(1))
            except Exception:
                return None
    return None


def _extract_email_body(text: str) -> str:
    t = (text or "").strip()
    patterns = [
        r"(?:nội dung|noi dung|body)\s*[:\-]?\s*(.+)$",
        r"(?:rằng|rang)\s+(.+)$",
    ]
    for pattern in patterns:
        m = re.search(pattern, t, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def _extract_memory_set_args(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()

    email_match = re.search(r"([\w\.-]+@[\w\.-]+)", raw)
    if re.search(r"(gmail|mail).*(mặc định|mac dinh)|(mặc định|mac dinh).*(gmail|mail)", raw, re.IGNORECASE) and email_match:
        return {"key": "gmail_default_account", "value": email_match.group(1).strip().lower()}
    if re.search(r"(gửi|gui|send).*(mail|email|gmail).*(bằng|bang|from)", raw, re.IGNORECASE) and email_match:
        return {"key": "gmail_default_account", "value": email_match.group(1).strip().lower()}

    patterns: list[tuple[str, str]] = [
        (r"(?:folder|thư mục|thu muc)\s+báo cáo\s+y(?:êu|ếu)\s+thích\s+là\s+(.+)$", "favorite_report_folder"),
        (r"(?:lưu|luu)\s+báo cáo\s+vào\s+(.+)$", "favorite_report_folder"),
        (r"(?:mở|mo|open)\s+file\s+bằng\s+(.+)$", "open_file_app"),
        (r"(?:tên tôi là|ten toi la)\s+(.+)$", "name"),
        (r"(?:múi giờ của tôi là|mui gio cua toi la)\s+(.+)$", "timezone"),
        (r"(?:công việc của tôi là|cong viec cua toi la)\s+(.+)$", "job"),
        (r"(?:thư mục hay dùng là|thu muc hay dung la)\s+(.+)$", "frequent_folders"),
        (r"(?:app hay dùng là|app hay dung la|ứng dụng hay dùng là|ung dung hay dung la)\s+(.+)$", "preferred_apps"),
        (r"(?:mẫu câu ưa thích là|mau cau ua thich la)\s+(.+)$", "favorite_prompt_style"),
    ]
    for pattern, key in patterns:
        m = re.search(pattern, raw, re.IGNORECASE)
        if not m:
            continue
        value = m.group(1).strip()
        if key in {"frequent_folders", "preferred_apps"}:
            parts = re.split(r"\s*,\s*|\s+và\s+|\s+va\s+", value)
            value = [item.strip() for item in parts if item.strip()]
        return {"key": key, "value": value}
    return {}


def _is_email_list_command(text: str) -> bool:
    t = _normalize(text)
    if _extract_email_index(text) is not None and any(token in t for token in EMAIL_READ_HINTS):
        return False
    if not any(word in t for word in EMAIL_HINTS):
        return False
    if any(word in t for words in EMAIL_STATUS_KEYWORDS.values() for word in words):
        return True
    if any(word in t for words in EMAIL_DATE_KEYWORDS.values() for word in words):
        return True
    if re.search(r"\bngay\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?\b", t):
        return True
    if re.search(r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?\b", t):
        return True
    if "thang" in t or "tháng" in text.lower():
        return True
    return any(token in t for token in ["xem email", "xem mail", "check email", "check mail", "liet ke", "liệt kê"])


def _extract_labeled_field(text: str, labels: list[str], stop_labels: list[str]) -> str:
    t = (text or "").strip()
    start = "|".join(re.escape(label) for label in labels)
    stop = "|".join(re.escape(label) for label in stop_labels) if stop_labels else ""
    if stop:
        pattern = rf"(?:{start})\s*[:\-]?\s*(.+?)(?=\s+(?:{stop})\s*[:\-]?|$)"
    else:
        pattern = rf"(?:{start})\s*[:\-]?\s*(.+)$"
    m = re.search(pattern, t, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _extract_workflow_ref(text: str) -> str:
    raw = (text or "").strip()
    patterns = [
        r"(?:chạy|chay|run|thực thi|thuc thi|xóa|xoa|delete|remove)\s+workflow\s+(.+)$",
        r"(?:chạy|chay|run|thực thi|thuc thi|xóa|xoa|delete|remove)\s+quy trình\s+(.+)$",
        r"(?:chạy|chay|run|thực thi|thuc thi|xóa|xoa|delete|remove)\s+quy trinh\s+(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if match:
            return match.group(1).strip().strip("\"'")
    return ""


def _extract_custom_app_ref(text: str) -> str:
    raw = (text or "").strip()
    patterns = [
        r"(?:xoa|xóa|delete|remove)\s+(?:app đã lưu|ứng dụng đã lưu)\s+(?:ten\s+)?(.+)$",
        r"(?:xoa|xóa|delete|remove)\s+(?:app da luu|ung dung da luu|custom app|ung dung custom)\s+(?:ten\s+)?(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if match:
            return match.group(1).strip().strip("\"'")
    return ""


def _parse_send_email_args(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    match = re.search(r"([\w\.-]+@[\w\.-]+)", raw)
    to = match.group(1).strip() if match else ""
    if not to:
        recipient_match = re.search(
            r"(?:gửi|gui|send)\s+(?:email|mail|gmail)?\s*(?:cho|toi)\s+(.+?)(?=\s+(?:tiêu đề|tieu de|subject|nội dung|noi dung|body)\b|$)",
            raw,
            re.IGNORECASE,
        )
        if recipient_match:
            to = recipient_match.group(1).strip(" ,.:;")
    subject = _extract_labeled_field(raw, ["tiêu đề", "tieu de", "subject"], ["nội dung", "noi dung", "body"])
    body = _extract_labeled_field(raw, ["nội dung", "noi dung", "body"], [])
    return {
        "to": to,
        "subject": subject,
        "body": body,
    }


def _has_send_email_intent(text: str) -> bool:
    raw = (text or "").strip()
    t = _normalize(raw)
    if any(w in t for w in EMAIL_SEND_HINTS):
        return True
    # Guard against cases like:
    # "gửi email cho a@b.com tiêu đề [nhắc nhở] ..."
    # where reminder keywords appear inside the subject/body.
    return bool(
        re.search(r"\b(gửi|gui|send)\s+(email|mail|gmail)\b", t, re.IGNORECASE)
        or re.search(
            r"\b(gửi|gui|send)\b.*\b(email|mail|gmail)\b.*\b(cho|toi|to)\b",
            t,
            re.IGNORECASE,
        )
    )


def _extract_entity_set_args(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    patterns = [
        r"(?:nhớ|nho|lưu|luu)\s+(.+?)\s+là\s+(.+)$",
        r"(?:đặt|dat)\s+entity\s+(.+?)\s+là\s+(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if not match:
            continue
        alias = match.group(1).strip(" \"'")
        value = match.group(2).strip()
        if not alias or not value:
            continue
        lowered_alias = alias.lower()
        kind = "generic"
        if any(token in lowered_alias for token in ("team", "nhóm", "nhom")):
            kind = "group"
        elif any(token in lowered_alias for token in ("folder", "thư mục", "thu muc")):
            kind = "folder"
        elif any(token in lowered_alias for token in ("cv", "ứng viên", "ung vien", "hồ sơ", "ho so", "file")):
            kind = "document"
        elif any(token in lowered_alias for token in ("anh ", "chị ", "chi ", "em ", "ông ", "ba ", "cô ", "co ")):
            kind = "person"
        return {"alias": alias, "value": value, "kind": kind}
    return {}


def _extract_pinned_knowledge_args(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    patterns = [
        r"(?:ghim|gim|pin)\s+(?:ghi chú|ghi chu|note)?\s*(.+?)\s*[:\-]\s*(.+)$",
        r"(?:ghim|gim|pin)\s+(?:rằng|rang)\s+(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, raw, re.IGNORECASE)
        if not match:
            continue
        if len(match.groups()) == 2:
            title = match.group(1).strip(" \"'")
            content = match.group(2).strip()
        else:
            content = match.group(1).strip()
            title = content[:40].strip()
        if title and content:
            return {"title": title, "content": content}
    return {}


def _extract_bulk_email_file_ref(text: str) -> str:
    raw = (text or "").strip()
    patterns = [
        r'(?:theo|từ|tu)\s+file\s+"([^"]+)"',
        r"(?:theo|từ|tu)\s+file\s+'([^']+)'",
        r'file\s+"([^"]+)"',
        r"file\s+'([^']+)'",
        r"([A-Za-z]:[\\/][^\n]+?\.xlsx)\b",
        r"(?:theo|từ|tu)\s+file\s+(.+)$",
    ]
    for pattern in patterns:
        m = re.search(pattern, raw, re.IGNORECASE)
        if not m:
            continue
        value = m.group(1).strip().strip("\"'")
        value = re.sub(r"\s+(giúp tôi|giúp toi|please)$", "", value, flags=re.IGNORECASE)
        if value:
            return value

    m = re.search(r"([\w\-. ]+\.xlsx)\b", raw, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return ""


def _has_google_drive_hint(text: str) -> bool:
    t = _normalize(text)
    if any(h in t for h in DRIVE_HINTS):
        return True
    if "drive" not in t:
        return False
    control_hints = (
        DRIVE_CONNECT_HINTS
        | DRIVE_LOGOUT_HINTS
        | DRIVE_ACCOUNT_LIST_HINTS
        | DRIVE_SELECT_ACCOUNT_HINTS
    )
    return any(h in t for h in control_hints)


def _extract_drive_index(text: str) -> Optional[int]:
    patterns = [
        r"(?:file|tệp|tep)\s*(?:số\s*)?(\d+)",
        r"số\s+(\d+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, _normalize(text))
        if not m:
            continue
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _clean_drive_query(text: str) -> str:
    q = _strip_leading_action(text)
    replacements = [
        "trên google drive",
        "tren google drive",
        "từ google drive",
        "tu google drive",
        "trong google drive",
        "google drive",
        "gg drive",
        "drive google",
        "lấy link",
        "lay link",
        "get link",
        "link chia sẻ",
        "link chia se",
        "share link",
        "tìm file",
        "tim file",
        "search file",
        "tìm",
        "tim",
        "search",
        "download",
        "tải về",
        "tai ve",
        "upload",
        "tải lên",
        "tai len",
    ]
    for token in replacements:
        q = q.replace(token, " ")
    q = re.sub(r"^(file|tệp|tep)\s+", "", q).strip()
    q = re.sub(r"\s+", " ", q).strip()
    return q


def _extract_drive_local_file_ref(text: str) -> str:
    raw = (text or "").strip()
    path_match = re.search(r"([A-Za-z]:[\\/][^\n\r]+)", raw)
    if path_match:
        return path_match.group(1).strip().strip("\"'")

    cleaned = _clean_drive_query(raw)
    for sep in [" lên ", " len ", " vào ", " vao ", " trong ", " to ", " into "]:
        idx = cleaned.lower().find(sep)
        if idx != -1:
            cleaned = cleaned[:idx].strip()
            break
    cleaned = re.sub(r"^(file|tệp|tep)\s+", "", cleaned).strip()
    return cleaned


def _extract_drive_upload_folder_ref(text: str) -> str:
    raw = _normalize(text)
    patterns = [
        r"(?:tạo|tao|create)\s+(?:folder|thư mục|thu muc)\s+(.+?)(?:\s+(?:rồi|roi|de|để|va|và)\b.*|$)",
        r"(?:google drive)\s+(?:vào|vao|trong|lên|len|to|into)\s+(?:folder|thư mục|thu muc)\s+(.+)$",
        r"(?:vào|vao|trong|lên|len|to|into)\s+(?:folder|thư mục|thu muc)\s+(.+?)(?:\s+(?:trên|tren|trong|của|cua|on)\s+google drive)?$",
    ]
    for pattern in patterns:
        m = re.search(pattern, raw)
        if not m:
            continue
        candidate = m.group(1).strip().strip("\"'")
        candidate = re.sub(
            r"\s+(?:nếu chưa có thì tạo|neu chua co thi tao|nếu không có thì tạo|neu khong co thi tao)$",
            "",
            candidate,
        ).strip()
        if candidate:
            return candidate
    return ""


def _should_create_drive_folder(text: str) -> bool:
    raw = _normalize(text)
    hints = (
        "tạo folder",
        "tao folder",
        "tạo thư mục",
        "tao thu muc",
        "nếu chưa có thì tạo",
        "neu chua co thi tao",
        "nếu không có thì tạo",
        "neu khong co thi tao",
        "create folder",
    )
    return any(hint in raw for hint in hints)


def _extract_drive_download_destination(text: str) -> str:
    raw = _normalize(text)
    patterns = [
        r"(?:về|ve|to|into|save to)\s+(.+)$",
        r"(?:vào|vao|đến|den)\s+(.+)$",
    ]
    for pattern in patterns:
        m = re.search(pattern, raw)
        if m:
            return m.group(1).strip()
    return ""


def _has_reminder_hint(text: str) -> bool:
    t = _normalize(text)
    return any(h in t for h in REMINDER_HINTS)


def _extract_reminder_index(text: str) -> Optional[int]:
    patterns = [
        r"(?:reminder|nhắc việc|nhac viec|nhắc|nhac)\s*(?:số\s*)?(\d+)",
        r"số\s+(\d+)",
    ]
    normalized = _normalize(text)
    for pattern in patterns:
        m = re.search(pattern, normalized)
        if not m:
            continue
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _parse_relative_duration(raw: str) -> Optional[timedelta]:
    if "nua tieng" in raw or "nua gio" in raw:
        return timedelta(minutes=30)
    if not any(token in raw for token in ("sau", "nua", "trong")):
        return None

    tail = raw
    if "sau" in raw:
        tail = raw.split("sau", 1)[1].strip()
    elif "trong" in raw:
        tail = raw.split("trong", 1)[1].strip()
    token_pattern = re.compile(r"(\d+)\s*(h|gio|tieng|m|phut|p|s|sec|secs|second|seconds|giay)")
    matches = list(token_pattern.finditer(tail))
    if not matches:
        return None

    total_seconds = 0
    for match in matches:
        amount = int(match.group(1))
        unit = match.group(2)
        if unit in {"h", "gio", "tieng"}:
            total_seconds += amount * 3600
        elif unit in {"m", "phut", "p"}:
            total_seconds += amount * 60
        else:
            total_seconds += amount

    if total_seconds <= 0:
        return None
    return timedelta(seconds=total_seconds)


def _parse_duration_anywhere(raw: str) -> Optional[timedelta]:
    token_pattern = re.compile(r"(\d+)\s*(h|gio|tieng|m|phut|p|s|sec|secs|second|seconds|giay)")
    matches = list(token_pattern.finditer(raw))
    if not matches:
        return None
    total_seconds = 0
    for match in matches:
        amount = int(match.group(1))
        unit = match.group(2)
        if unit in {"h", "gio", "tieng"}:
            total_seconds += amount * 3600
        elif unit in {"m", "phut", "p"}:
            total_seconds += amount * 60
        else:
            total_seconds += amount
    if total_seconds <= 0:
        return None
    return timedelta(seconds=total_seconds)


def _extract_repeat_value(text: str) -> str:
    folded = nlu_ml.normalize_nlu_text(text)
    if any(token in folded for token in ["hang ngay", "moi ngay", "daily", "every day", "everyday"]):
        return "daily"
    return ""


def _extract_warning_minutes(text: str) -> Optional[int]:
    folded = nlu_ml.normalize_nlu_text(text)
    if any(token in folded for token in ["khong canh bao", "khong bao truoc", "khong nhac truoc", "no warning"]):
        return 0
    match = re.search(
        r"(?:canh bao|bao truoc|nhac truoc|warning|warn)\s*(?:truoc)?\s*(\d+)\s*(h|gio|tieng|m|phut|p)",
        folded,
    )
    if match:
        amount = int(match.group(1))
        unit = match.group(2)
        minutes = amount * 60 if unit in {"h", "gio", "tieng"} else amount
        return max(0, min(minutes, 24 * 60))
    if any(token in folded for token in ["canh bao", "bao truoc", "nhac truoc", "warning", "warn"]):
        return 15
    return None


def _strip_warning_clause(text: str) -> str:
    return re.sub(
        r"\b(?:canh bao|cảnh báo|bao truoc|báo trước|nhac truoc|nhắc trước|warning|warn)\s*(?:truoc|trước)?\s*\d*\s*(?:h|gio|giờ|tieng|tiếng|m|phut|phút|p)?",
        " ",
        text or "",
        flags=re.IGNORECASE,
    )


def _apply_schedule_options(args: Dict[str, Any], text: str) -> Dict[str, Any]:
    repeat = _extract_repeat_value(text)
    if repeat:
        args["repeat"] = repeat
    warning_minutes = _extract_warning_minutes(text)
    if warning_minutes is not None:
        args["warning_minutes"] = warning_minutes
    return args


def _seconds_until(target_at: str) -> int:
    try:
        target = datetime.fromisoformat(target_at)
    except ValueError:
        return 0
    if target.tzinfo is None:
        target = target.replace(tzinfo=VN_FIXED_TZ)
    now = datetime.now(target.tzinfo)
    if target <= now:
        target = target + timedelta(days=1)
    delta_seconds = (target - now).total_seconds()
    seconds = int(delta_seconds)
    if delta_seconds > seconds:
        seconds += 1
    return max(1, seconds)


def _looks_like_power_schedule(text: str) -> bool:
    folded = nlu_ml.normalize_nlu_text(_strip_warning_clause(text))
    if any(token in folded for token in ("hen", "timer", "sau", "trong", "nua", "luc", "vao", "khung gio", "hang ngay", "moi ngay", "daily")):
        return True
    return bool(
        _parse_duration_anywhere(folded)
        or re.search(r"\b\d{1,2}:\d{1,2}\b", folded)
        or re.search(r"\b\d{1,2}h(?:\d{1,2})?\b", folded)
        or re.search(r"\b\d{1,2}\s*gio\b", folded)
    )


def _extract_power_schedule_args(
    text: str,
    *,
    default_delay_seconds: int = 0,
) -> Dict[str, Any]:
    clean_text = _strip_warning_clause(text)
    folded = nlu_ml.normalize_nlu_text(clean_text)
    relative_duration = _parse_relative_duration(folded)
    if relative_duration is not None:
        seconds = max(1, int(relative_duration.total_seconds()))
        target = datetime.now(VN_FIXED_TZ) + timedelta(seconds=seconds)
        return _apply_schedule_options({
            "delay_seconds": seconds,
            "target_at": target.isoformat(),
            "schedule_kind": "delay",
        }, text)

    target_at = _parse_reminder_datetime(clean_text)
    if target_at:
        seconds = _seconds_until(target_at)
        try:
            target = datetime.fromisoformat(target_at)
            if target.tzinfo is None:
                target = target.replace(tzinfo=VN_FIXED_TZ)
            now = datetime.now(target.tzinfo)
            if target <= now:
                target = target + timedelta(days=1)
            target_at = target.isoformat()
        except ValueError:
            pass
        return _apply_schedule_options({
            "delay_seconds": seconds,
            "target_at": target_at,
            "schedule_kind": "at",
        }, text)

    relative_duration = _parse_duration_anywhere(folded)
    if relative_duration is not None:
        seconds = max(1, int(relative_duration.total_seconds()))
        target = datetime.now(VN_FIXED_TZ) + timedelta(seconds=seconds)
        return _apply_schedule_options({
            "delay_seconds": seconds,
            "target_at": target.isoformat(),
            "schedule_kind": "delay",
        }, text)

    if default_delay_seconds > 0:
        target = datetime.now(VN_FIXED_TZ) + timedelta(seconds=default_delay_seconds)
        return _apply_schedule_options({
            "delay_seconds": default_delay_seconds,
            "target_at": target.isoformat(),
            "schedule_kind": "default",
        }, text)

    return {"missing_schedule": True}


def _strip_schedule_tail(text: str) -> str:
    value = (text or "").strip()
    if not value:
        return ""
    value = re.sub(
        r"\s+(?:sau|trong|luc|lúc|vao|vào|at)\b.+$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip()
    value = re.sub(
        r"\s+\d+\s*(?:h|gio|giờ|tieng|tiếng|m|phut|phút|p|s|giay|giây)\s*(?:nua|nữa)?\s*$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip()
    return value


def _extract_app_keys_from_text(text: str) -> list[str]:
    folded = nlu_ml.normalize_nlu_text(text)
    keys: list[str] = []
    candidates = []
    for app_key in executor.ALLOWED_APPS:
        candidates.append((app_key, app_key))
    for alias, app_key in executor.APP_ALIASES.items():
        candidates.append((alias, app_key))
    for app_key, aliases in executor.APP_QUERY_ALIASES.items():
        for alias in aliases:
            candidates.append((alias, app_key))
    for alias, app_key in sorted(candidates, key=lambda item: len(item[0]), reverse=True):
        alias_folded = nlu_ml.normalize_nlu_text(alias)
        if alias_folded and re.search(rf"(?<!\w){re.escape(alias_folded)}(?!\w)", folded):
            if app_key not in keys:
                keys.append(app_key)
    if not keys:
        guessed = executor.guess_app_name(text, allow_prefix=True)
        if guessed:
            keys.append(guessed)
    return keys


def _extract_except_app_keys(raw: str) -> list[str]:
    folded = nlu_ml.normalize_nlu_text(raw)
    match = re.search(r"\b(?:tru|ngoai|except|giu lai|giu|khong dong)\b\s+(.+)$", folded)
    if not match:
        return []
    tail = match.group(1)
    tail = re.sub(r"\b(?:va|and|voi|cung)\b", " ", tail)
    return _extract_app_keys_from_text(tail)


def _extract_idle_guard_args(raw: str) -> dict[str, Any]:
    folded = nlu_ml.normalize_nlu_text(raw)
    start_minutes = 23 * 60
    end_minutes = 6 * 60

    def parse_clock_minutes(value: str) -> int:
        value = (value or "").strip()
        clock = re.fullmatch(r"(\d{1,2})(?:(?:h|:| gio\s+)(\d{1,2}))?(?:\s*gio)?", value)
        if not clock:
            return 0
        hour = max(0, min(23, int(clock.group(1))))
        minute = max(0, min(59, int(clock.group(2) or 0)))
        return hour * 60 + minute

    time_expr = r"\d{1,2}(?:(?:h|:| gio\s+)\d{1,2})?(?:\s*gio)?"
    duration_text = re.sub(
        rf"\b(?:tu|from)\s+{time_expr}\s*(?:den|toi|to|-)\s*{time_expr}",
        " ",
        folded,
    )
    duration = _parse_relative_duration(duration_text) or _parse_duration_anywhere(duration_text)
    idle_minutes = 45
    if duration is not None:
        idle_minutes = max(1, int(duration.total_seconds() // 60) or 1)

    match = re.search(rf"\b(?:tu|from)\s+({time_expr})\s*(?:den|toi|to|-)\s*({time_expr})", folded)
    if match:
        start_minutes = parse_clock_minutes(match.group(1))
        end_minutes = parse_clock_minutes(match.group(2))
    power_action = "hibernate"
    if any(p in folded for p in ["chi khoa", "khoa may", "lock"]):
        power_action = "lock"
    elif any(p in folded for p in ["tat man hinh", "monitor"]):
        power_action = "monitor_off"
    elif any(p in folded for p in ["tat may", "shutdown"]):
        power_action = "shutdown"
    elif any(p in folded for p in ["sleep nhe", "ngu nhe"]):
        power_action = "light_sleep"
    return {
        "idle_minutes": idle_minutes,
        "start_hour": start_minutes // 60,
        "end_hour": end_minutes // 60,
        "start_minutes": start_minutes,
        "end_minutes": end_minutes,
        "grace_minutes": 10,
        "power_action": power_action,
    }


def _extract_scheduled_open_decision(raw: str) -> RouteDecision | None:
    folded = nlu_ml.normalize_nlu_text(raw)
    cancel_hints = [
        "huy hen mo app",
        "huy hen mo web",
        "huy lich mo app",
        "huy lich mo web",
        "cancel open app",
        "cancel open web",
    ]
    if any(p in folded for p in cancel_hints):
        return RouteDecision(
            type=RouteType.SCHEDULED_OPEN,
            args={"action": "cancel"},
            reason="Cancel scheduled app/web open intent.",
            confidence=0.96,
        )

    status_hints = [
        "lich mo app",
        "lich mo web",
        "xem hen mo app",
        "xem hen mo web",
        "scheduled open app",
    ]
    if any(p in folded for p in status_hints):
        return RouteDecision(
            type=RouteType.SCHEDULED_OPEN,
            args={"action": "status"},
            reason="Scheduled app/web open status intent.",
            confidence=0.94,
        )

    has_open_hint = any(p in folded for p in ["mo", "open", "bat", "hen mo"])
    if not has_open_hint or not _looks_like_power_schedule(raw):
        return None
    schedule_args = _extract_power_schedule_args(raw)
    if bool(schedule_args.get("missing_schedule")):
        return None

    open_match = re.search(r"(?:mo|mở|open|bat|bật)\s+(.+?)\s*$", raw, flags=re.IGNORECASE)
    query = open_match.group(1).strip() if open_match else _strip_leading_action(raw)
    query = _strip_schedule_tail(query)
    query = re.sub(r"^(?:app|ung dung|ứng dụng|web|trang)\s+", "", query, flags=re.IGNORECASE).strip()
    query = _strip_warning_clause(query).strip()
    query = re.sub(r"\b(?:hang ngay|hàng ngày|moi ngay|mỗi ngày|daily|every day)\b", " ", query, flags=re.IGNORECASE)
    query = " ".join(query.split()).strip()

    url = _extract_first_url(query) or _extract_web_platform_url(query)
    if url:
        args = {"action": "open_url", "url": url, "browser": _extract_browser(raw)}
        args.update(schedule_args)
        return RouteDecision(
            type=RouteType.SCHEDULED_OPEN,
            args=args,
            reason="Scheduled open URL intent.",
            confidence=0.95,
        )

    app_key = executor.guess_app_name(query, allow_prefix=True) if query else ""
    if not app_key:
        app_key = _extract_known_app_from_text(query)
    if not app_key:
        return None
    args = {"action": "open_app", "app_name": app_key}
    args.update(schedule_args)
    return RouteDecision(
        type=RouteType.SCHEDULED_OPEN,
        args=args,
        reason="Scheduled open app intent.",
        confidence=0.95,
    )


def _extract_scheduled_close_decision(raw: str) -> RouteDecision | None:
    folded = nlu_ml.normalize_nlu_text(raw)
    if any(p in folded for p in ["tat may", "shutdown", "khoi dong lai", "restart", "reboot"]):
        return None

    cancel_hints = [
        "huy hen dong app",
        "huy hen tat app",
        "huy hen dong web",
        "huy hen tat web",
        "huy lich dong app",
        "huy lich tat web",
        "cancel close app",
        "cancel close web",
    ]
    if any(p in folded for p in cancel_hints):
        return RouteDecision(
            type=RouteType.SCHEDULED_CLOSE,
            args={"action": "cancel"},
            reason="Cancel scheduled app/web close intent.",
            confidence=0.96,
        )

    status_hints = [
        "lich dong app",
        "lich tat app",
        "lich dong web",
        "lich tat web",
        "xem hen dong app",
        "xem hen tat web",
        "scheduled close app",
    ]
    if any(p in folded for p in status_hints):
        return RouteDecision(
            type=RouteType.SCHEDULED_CLOSE,
            args={"action": "status"},
            reason="Scheduled app/web close status intent.",
            confidence=0.94,
        )

    close_or_schedule_hint = any(
        p in folded
        for p in ["dong", "tat", "thoat", "close", "exit", "hen", "timer"]
    )
    if not close_or_schedule_hint or not _looks_like_power_schedule(raw):
        return None

    schedule_args = _extract_power_schedule_args(raw)
    if bool(schedule_args.get("missing_schedule")):
        return None

    if any(p in folded for p in ["dong tab", "tat tab", "close tab", "tab hien tai", "tab hiện tại"]):
        args = {"action": "close_current_tab"}
        args.update(schedule_args)
        return RouteDecision(
            type=RouteType.SCHEDULED_CLOSE,
            args=args,
            reason="Scheduled close current browser tab intent.",
            confidence=0.94,
        )

    if any(p in folded for p in ["web", "browser", "trinh duyet", "trinh duyet web", "edge chrome"]):
        args = {"action": "close_browsers"}
        args.update(schedule_args)
        return RouteDecision(
            type=RouteType.SCHEDULED_CLOSE,
            args=args,
            reason="Scheduled close browsers intent.",
            confidence=0.95,
        )

    if any(
        p in folded
        for p in [
            "cac ung dung dang chay",
            "cac ung dung dang mo",
            "tat cac ung dung",
            "dong cac ung dung",
            "tat app dang chay",
            "dong app dang chay",
            "all apps",
            "running apps",
        ]
    ):
        args = {"action": "close_running_apps"}
        args.update(schedule_args)
        return RouteDecision(
            type=RouteType.SCHEDULED_CLOSE,
            args=args,
            reason="Scheduled close visible running apps intent.",
            confidence=0.93,
        )

    has_close_verb = any(re.search(rf"\b{re.escape(v)}\b", _normalize(raw)) for v in CLOSE_APP_VERBS)
    if has_close_verb:
        query = _strip_leading_action(raw)
    else:
        query = re.sub(r"^\s*(?:hen|hẹn|timer)\s+", "", raw, flags=re.IGNORECASE).strip()
        query = _strip_leading_action(query)
    query = _strip_schedule_tail(query)
    query = re.sub(r"^(?:app|ung dung|ứng dụng)\s+", "", query, flags=re.IGNORECASE).strip()
    for token in ["tat ca", "tất cả", "toan bo", "toàn bộ", "het", "hết", "all"]:
        query = query.replace(token, " ")
    query = " ".join(query.split()).strip()
    if not query:
        return None

    app_key = executor.guess_app_name(query, allow_prefix=True)
    if not app_key:
        app_key = _extract_known_app_from_text(query)
    if not app_key:
        return None

    args = {
        "action": "close_app",
        "app_name": app_key,
        "close_all": _wants_close_all(raw) or app_key in {"edge", "chrome"},
    }
    args.update(schedule_args)
    return RouteDecision(
        type=RouteType.SCHEDULED_CLOSE,
        args=args,
        reason="Scheduled close app intent.",
        confidence=0.94,
    )


def _parse_reminder_datetime(text: str) -> Optional[str]:
    raw = nlu_ml.normalize_nlu_text(text)
    now = datetime.now(VN_FIXED_TZ)
    target_date = None
    relative_duration = _parse_relative_duration(raw)
    if relative_duration is not None:
        return (now + relative_duration).isoformat()

    if "ngay kia" in raw:
        target_date = (now + timedelta(days=2)).date()
    elif any(token in raw for token in ["mai", "ngay mai", "tomorrow"]):
        target_date = (now + timedelta(days=1)).date()
    elif any(token in raw for token in ["hom nay", "today", "chieu nay", "toi nay", "sang nay", "trua nay"]):
        target_date = now.date()

    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b", raw)
    if m:
        day = int(m.group(1))
        month = int(m.group(2))
        year = int(m.group(3)) if m.group(3) else now.year
        try:
            target_date = datetime(year, month, day, tzinfo=VN_FIXED_TZ).date()
        except ValueError:
            return None
    else:
        m = re.search(r"ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?", raw)
        if m:
            day = int(m.group(1))
            month = int(m.group(2))
            year = int(m.group(3)) if m.group(3) else now.year
            try:
                target_date = datetime(year, month, day, tzinfo=VN_FIXED_TZ).date()
            except ValueError:
                return None

    hour = None
    minute = 0
    m = re.search(r"\b(\d{1,2}):(\d{1,2})\b", raw)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2))
    else:
        m = re.search(r"\b(\d{1,2})h\s*(\d{1,2})\s*(?:p|phut)?\b", raw)
        if m:
            hour = int(m.group(1))
            minute = int(m.group(2) or 0)
        else:
            m = re.search(r"\b(\d{1,2})h(?:(\d{1,2}))?\b", raw)
            if m:
                hour = int(m.group(1))
                minute = int(m.group(2) or 0)
            else:
                m = re.search(r"\b(\d{1,2})\s*gio(?:\s*(\d{1,2}))?\b", raw)
                if m:
                    hour = int(m.group(1))
                    minute = int(m.group(2) or 0)
                else:
                    m = re.search(r"\bluc\s+(\d{1,2})\b", raw)
                    if m:
                        hour = int(m.group(1))

    if hour is None:
        if re.search(r"\bsang\b", raw):
            hour = 8
        elif re.search(r"\btrua\b", raw):
            hour = 12
        elif re.search(r"\bchieu\b", raw):
            hour = 15
        elif "toi nay" in raw or "toi mai" in raw or "buoi toi" in raw or re.search(r"\bdem\b", raw) or "dem nay" in raw:
            hour = 19

    if hour is None:
        return None

    if (
        re.search(r"\b(chieu|dem|pm)\b", raw)
        or "toi nay" in raw
        or "toi mai" in raw
        or "buoi toi" in raw
        or "dem nay" in raw
    ) and 1 <= hour <= 11:
        hour += 12

    if target_date is None:
        target_date = now.date()
        candidate = datetime(
            target_date.year, target_date.month, target_date.day, hour, minute, tzinfo=VN_FIXED_TZ
        )
        if candidate <= now:
            target_date = (now + timedelta(days=1)).date()

    try:
        return datetime(
            target_date.year,
            target_date.month,
            target_date.day,
            hour,
            minute,
            tzinfo=VN_FIXED_TZ,
        ).isoformat()
    except ValueError:
        return None


def _extract_reminder_content(text: str) -> str:
    content = (text or "").strip()
    folded = nlu_ml.normalize_nlu_text(content)

    prefix_patterns = [
        r"^hay nhac toi\s+",
        r"^nhac toi\s+",
        r"^bao toi\s+",
        r"^nho nhac toi\s+",
        r"^dung quen nhac toi\s+",
        r"^tao reminder\s+",
        r"^tao nhac viec\s+",
        r"^them reminder\s+",
        r"^them nhac viec\s+",
    ]
    for pattern in prefix_patterns:
        m = re.match(pattern, folded, flags=re.IGNORECASE)
        if m:
            content = content[m.end():].strip()
            folded = folded[m.end():].strip()
            break

    leading_time_patterns = [
        r"^ngay mai\s+luc\s+\d{1,2}(?::?\d{0,2}|h\d{0,2})?\s+",
        r"^\d{1,2}\s*(?:h|gio)(?:\s*\d{1,2})?\s*(?:phut)?\s*(?:toi nay|sang mai|chieu mai|hom nay|ngay mai)?\s+",
        r"^(?:sau|trong)\s+\d+\s*(?:h|gio|tieng|m|phut|p|giay|s)\s*(?:nua)?\s+",
        r"^\d+\s*(?:h|gio|tieng|m|phut|p|giay|s)\s+nua\s+",
        r"^(?:ngay mai|mai|hom nay|toi nay|sang mai|chieu mai|sang thu hai|today|tomorrow)\s+",
    ]
    for pattern in leading_time_patterns:
        m = re.match(pattern, folded, flags=re.IGNORECASE)
        if m:
            content = content[m.end():].strip()
            folded = folded[m.end():].strip()
            break

    folded = re.sub(r"^(?:nhac toi|bao toi)\s+", "", folded, flags=re.IGNORECASE)
    content = re.sub(r"^(?:nhắc tôi|nhac toi|báo tôi|bao toi)\s+", "", content, flags=re.IGNORECASE).strip()

    cut_markers = [
        " sau ",
        " luc ",
        " vao ",
        " mai",
        " ngay mai",
        " hom nay",
        " ngay kia",
        " today",
        " tomorrow",
        " toi nay",
        " sang mai",
        " chieu mai",
    ]
    cut_positions = [folded.find(marker) for marker in cut_markers if folded.find(marker) != -1]
    if cut_positions:
        content = content[: min(cut_positions)]

    content = re.sub(r"\b(reminder|nhắc việc|nhac viec)\b", "", content, flags=re.IGNORECASE)
    content = re.sub(r"\s+", " ", content).strip(" .,-:")
    return content


def _extract_create_reminder_args(text: str) -> Dict[str, Any]:
    due_at = _parse_reminder_datetime(text)
    content = _extract_reminder_content(text)
    return {
        "title": content,
        "message": content,
        "due_at": due_at or "",
        "timezone_name": "Asia/Saigon",
    }


def _extract_import_task_list_args(text: str) -> Dict[str, Any]:
    raw = text or ""
    lines = raw.splitlines()
    if len(lines) <= 1:
        task_text = raw
    else:
        first_line = lines[0].strip().lower()
        if any(hint in first_line for hint in TASK_LIST_HINTS):
            task_text = "\n".join(lines[1:]).strip()
        else:
            task_text = raw.strip()
    return {
        "task_text": task_text,
        "timezone_name": "Asia/Saigon",
    }


def _looks_like_task_list_import(text: str) -> bool:
    raw = text or ""
    normalized = _normalize(raw)
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    structured_lines = 0
    for line in lines:
        cleaned = re.sub(r"^(?:[-*•]|\d+[.)])\s*", "", line).strip()
        if "|" in cleaned and len([part for part in cleaned.split("|") if part.strip()]) >= 4:
            structured_lines += 1
            continue
        if " - " in cleaned and len([part for part in cleaned.split(" - ") if part.strip()]) >= 4:
            structured_lines += 1
    has_task_hint = any(hint in normalized for hint in TASK_LIST_HINTS)
    status_mentions = len(
        re.findall(r"\b(?:pending|in progress|in_progress|completed|done)\b", normalized, flags=re.IGNORECASE)
    )
    separator_count = normalized.count(" - ")
    if has_task_hint and status_mentions >= 2 and separator_count >= 6:
        return True
    return structured_lines >= 2 and has_task_hint

def _extract_snooze_minutes(text: str) -> int:
    raw = nlu_ml.normalize_nlu_text(text)
    relative_duration = _parse_relative_duration(raw)
    if relative_duration is not None:
        total_seconds = int(relative_duration.total_seconds())
        return max(1, (total_seconds + 59) // 60)
    return 0


def _extract_update_reminder_args(text: str) -> Dict[str, Any]:
    raw = text or ""
    due_at = _parse_reminder_datetime(raw) or ""
    content = raw.strip()
    patterns = [
        r"^(?:sửa|sua|đổi|doi|dời|chuyển|chuyen|cap nhat|cập nhật)\s+(?:reminder|nhắc việc|nhac viec|nhắc hẹn|nhac hen|nhắc nhở|nhac nho|nhắc|nhac)\s*(?:số\s*)?(?:thứ\s*)?\d*\s*",
        r"^(?:sửa|sua|đổi|doi|dời|chuyển|chuyen|cap nhat|cập nhật)\s*(?:số\s*)?(?:thứ\s*)?\d+\s*",
    ]
    for pattern in patterns:
        content = re.sub(pattern, "", content, flags=re.IGNORECASE)
    content = re.sub(r"^(thành|thanh|thành:|thanh:|sang)\s*", "", content, flags=re.IGNORECASE)
    if due_at:
        folded_content = normalize_intent_text(content)
        if re.match(r"^(?:luc\s+)?\d{1,2}\s*(?:h|gio)\b", folded_content) or folded_content.startswith(
            ("hom nay", "toi nay", "sang nay", "ngay mai", "sang mai", "toi mai")
        ):
            content = ""
        else:
            content = _extract_reminder_content(content)
    else:
        content = content.strip().strip(" .,:-")
    return {
        "index": _extract_reminder_index(raw),
        "title": content,
        "message": content,
        "due_at": due_at,
    }


def _extract_menu_key(text: str) -> str:
    t = _normalize(text)

    if t in MENU_HINTS:
        return ""

    m = re.fullmatch(r"(?:menu|help|tro giup|trợ giúp|huong dan|hướng dẫn)\s+(\d+)", t)
    if m:
        return m.group(1)

    m = re.fullmatch(r"(?:menu|help|tro giup|trợ giúp|huong dan|hướng dẫn)\s+0*(\d+)", t)
    if m:
        return m.group(1)

    return ""

def _is_menu_command(text: str) -> bool:
    raw = (text or "").strip()
    t = _normalize(raw)

    if t in MENU_HINTS:
        return True

    if re.fullmatch(r"(?:menu|help|tro giup|trợ giúp|huong dan|hướng dẫn)\s+\d+", t):
        return True

    return False


def _strip_generic_file_words(text: str) -> str:
    q = (text or "").strip()
    q = re.sub(
        r"^(file|tệp|tập tin|tai lieu|tài liệu|thu muc|thư mục|folder)\s+",
        "",
        q,
        flags=re.IGNORECASE,
    ).strip()
    return q


def _clean_find_file_query(text: str) -> str:
    q = _strip_folder_prefix(_strip_leading_action(text))
    folded = nlu_ml.normalize_nlu_text(q)
    for prefix in (
        "kiem giup toi",
        "kiem dum toi",
        "kiem",
        "tim giup toi",
        "tim dum toi",
        "tim",
        "cho toi xem",
        "tai lieu",
    ):
        if folded.startswith(prefix + " "):
            q = q[len(prefix):].strip()
            folded = folded[len(prefix):].strip()
            break
    q = _strip_generic_file_words(q)
    q = _strip_polite_suffix(q)
    folded = nlu_ml.normalize_nlu_text(q)
    for suffix in (" hom qua", " hom nay", " moi tai", " gan day", " nam dau roi", " o dau roi"):
        if folded.endswith(suffix):
            q = q[: -len(suffix)].strip()
            folded = folded[: -len(suffix)].strip()
            break
    return q.strip(" .,-:")


def _extract_known_app_from_text(text: str) -> str | None:
    folded = nlu_ml.normalize_nlu_text(text)
    aliases = [
        ("visual studio code", "vscode"),
        ("vs code", "vscode"),
        ("vscode", "vscode"),
        ("bang tinh", "excel"),
        ("excel", "excel"),
        ("microsoft word", "word"),
        ("word", "word"),
        ("trinh duyet chrome", "chrome"),
        ("google chrome", "chrome"),
        ("chrome", "chrome"),
        ("microsoft edge", "edge"),
        ("edge", "edge"),
        ("ghi chu", "notepad"),
        ("notepad", "notepad"),
        ("zalo", "zalo"),
    ]
    for alias, app_key in aliases:
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", folded):
            return app_key
    return None


def _build_ml_nlu_args(intent: str, raw: str) -> Dict[str, Any] | None:
    stripped = _strip_leading_action(raw)
    normalized_raw = _normalize(raw)
    normalized_stripped = _normalize(stripped)

    if intent == "chat":
        return {"message": raw.strip()}

    if intent == "web_search":
        query = stripped if stripped and stripped != raw else raw.strip()
        return {"query": query}

    if intent == "youtube_search":
        return {
            "query": _clean_youtube_query(raw),
            "browser": _extract_browser(raw),
        }

    if intent == "open_app":
        query = _strip_app_prefix(stripped)
        app_key = executor.guess_app_name(query, allow_prefix=True)
        if not app_key:
            app_key = _extract_known_app_from_text(raw)
        app_name = app_key or query.strip()
        if not app_name:
            return None
        if not app_key and nlu_ml.normalize_nlu_text(app_name) in {"cai do", "do", "do len", "cai nay", "nay", "no"}:
            return None
        args: Dict[str, Any] = {"app_name": app_name}
        if not app_key:
            args["confirm_before_custom_picker"] = True
        return args

    if intent == "close_app":
        query = _strip_app_prefix(stripped)
        for h in ["tất cả", "toàn bộ", "hết", "all"]:
            query = query.replace(h, " ")
        query = " ".join(query.split()).strip()
        app_key = executor.guess_app_name(query, allow_prefix=True)
        if not app_key:
            app_key = _extract_known_app_from_text(raw)
        if not app_key:
            return None
        args = {"app_name": app_key}
        if _wants_close_all(raw):
            args["close_all"] = True
        return args

    if intent == "find_file":
        query = _clean_find_file_query(raw)
        args: Dict[str, Any] = {"query": query or raw.strip()}
        exts = _extract_extensions(raw)
        if exts:
            args["extensions"] = exts
        if any(h in normalized_raw for h in FOLDER_HINTS):
            args["include_dirs"] = True
        return args

    if intent == "delete_file_name":
        query = _strip_entry_prefix(stripped)
        query = _strip_generic_file_words(query)
        if not query:
            return None
        args = {"query": query}
        exts = _extract_extensions(query)
        if exts:
            args["extensions"] = exts
        if any(h in normalized_raw for h in FOLDER_HINTS):
            args["include_dirs"] = True
            args["only_dirs"] = True
        return args

    if intent in {"copy_entry", "move_entry"}:
        src, dst = _split_copy_move_command(raw)
        if not src or not dst:
            return None
        args = {"query": src, "destination": dst}
        exts = _extract_extensions(src)
        if exts:
            args["extensions"] = exts
        if any(_token_contains(src, h) for h in FOLDER_HINTS):
            args["include_dirs"] = True
            args["only_dirs"] = True
        return args

    if intent == "create_reminder":
        return _extract_create_reminder_args(raw)

    if intent == "list_reminders":
        return {}

    if intent == "complete_reminder":
        return {"index": _extract_reminder_index(raw)}

    if intent == "delete_reminder":
        return {"index": _extract_reminder_index(raw)}

    if intent == "update_reminder":
        return _extract_update_reminder_args(raw)

    if intent == "snooze_reminder":
        return {"index": _extract_reminder_index(raw), "minutes": _extract_snooze_minutes(raw)}

    if intent == "check_email":
        return {"mode": "any:latest"}

    if intent == "send_email":
        return _parse_send_email_args(raw)

    if intent == "reply_email":
        return {
            "index": _extract_email_index(raw),
            "body": _extract_email_body(raw),
            "reply_all": "reply all" in normalized_stripped or "trả lời tất cả" in normalized_stripped,
        }

    return None


def _ml_nlu_route_decision(raw: str) -> RouteDecision | None:
    prediction = nlu_ml.predict_intent(raw)
    if prediction is None:
        return None

    intent_to_route: dict[str, RouteType] = {
        "chat": RouteType.CHAT,
        "web_search": RouteType.WEB_SEARCH,
        "youtube_search": RouteType.YOUTUBE_SEARCH,
        "open_app": RouteType.OPEN_APP,
        "close_app": RouteType.CLOSE_APP,
        "find_file": RouteType.FIND_FILE,
        "delete_file_name": RouteType.DELETE_FILE_NAME,
        "copy_entry": RouteType.COPY_ENTRY,
        "move_entry": RouteType.MOVE_ENTRY,
        "create_reminder": RouteType.CREATE_REMINDER,
        "list_reminders": RouteType.LIST_REMINDERS,
        "complete_reminder": RouteType.COMPLETE_REMINDER,
        "delete_reminder": RouteType.DELETE_REMINDER,
        "update_reminder": RouteType.UPDATE_REMINDER,
        "snooze_reminder": RouteType.SNOOZE_REMINDER,
        "check_email": RouteType.CHECK_EMAIL,
        "send_email": RouteType.SEND_EMAIL,
        "reply_email": RouteType.REPLY_EMAIL,
    }
    route_type = intent_to_route.get(prediction.intent)
    if route_type is None:
        return None

    threshold = ML_NLU_INTENT_THRESHOLDS.get(prediction.intent, ML_NLU_CONFIDENCE_THRESHOLD)
    if prediction.intent in ML_NLU_RISKY_INTENTS:
        threshold = max(threshold, ML_NLU_RISKY_CONFIDENCE_THRESHOLD)
    if prediction.confidence < threshold:
        return None

    args = _build_ml_nlu_args(prediction.intent, raw)
    if args is None:
        return None

    return RouteDecision(
        type=route_type,
        args=args,
        reason=f"ML NLU fallback matched intent={prediction.intent}.",
        confidence=prediction.confidence,
    )


def route(user_text: str) -> RouteDecision:
    raw = user_text or ""
    t = _normalize(raw)

    remote_decision = _extract_remote_control_decision(raw)
    if remote_decision is not None:
        return remote_decision

    scheduled_open_decision = _extract_scheduled_open_decision(raw)
    if scheduled_open_decision is not None:
        return scheduled_open_decision

    if _is_menu_command(raw):
        return RouteDecision(
            type=RouteType.MENU,
            args={"key": _extract_menu_key(raw)},
            reason="Menu navigation intent.",
            confidence=0.99,
        )

    if t in MEMORY_VIEW_HINTS:
        return RouteDecision(
            type=RouteType.VIEW_MEMORY,
            args={},
            reason="View personal memory intent.",
            confidence=0.97,
        )

    if t in MEMORY_VIEW_HINTS:
        return RouteDecision(
            type=RouteType.VIEW_MEMORY,
            args={},
            reason="View personal memory intent.",
            confidence=0.97,
        )

    if t in ENTITY_VIEW_HINTS:
        return RouteDecision(
            type=RouteType.VIEW_ENTITY_MEMORY,
            args={},
            reason="View entity memory intent.",
            confidence=0.97,
        )

    if t in PINNED_VIEW_HINTS:
        return RouteDecision(
            type=RouteType.VIEW_PINNED_KNOWLEDGE,
            args={},
            reason="View pinned knowledge intent.",
            confidence=0.97,
        )

    if any(hint in t for hint in WORKFLOW_HINTS):
        workflow_ref = _extract_workflow_ref(raw)
        if any(hint in t for hint in WORKFLOW_DELETE_HINTS) and workflow_ref:
            return RouteDecision(
                type=RouteType.DELETE_WORKFLOW,
                args={"workflow_ref": workflow_ref},
                reason="Delete workflow intent.",
                confidence=0.97,
            )
        if any(hint in t for hint in WORKFLOW_RUN_HINTS) and workflow_ref:
            return RouteDecision(
                type=RouteType.RUN_WORKFLOW,
                args={"workflow_ref": workflow_ref},
                reason="Run workflow intent.",
                confidence=0.98,
            )
        if any(hint in t for hint in WORKFLOW_LIST_HINTS):
            return RouteDecision(
                type=RouteType.LIST_WORKFLOWS,
                args={},
                reason="List workflows intent.",
                confidence=0.97,
            )

    if any(hint in t for hint in CUSTOM_APP_HINTS):
        custom_app_ref = _extract_custom_app_ref(raw)
        if any(hint in t for hint in CUSTOM_APP_DELETE_HINTS) and custom_app_ref:
            return RouteDecision(
                type=RouteType.DELETE_CUSTOM_APP,
                args={"app_ref": custom_app_ref},
                reason="Delete saved custom app intent.",
                confidence=0.97,
            )
        if any(hint in t for hint in CUSTOM_APP_LIST_HINTS):
            return RouteDecision(
                type=RouteType.LIST_CUSTOM_APPS,
                args={},
                reason="List saved custom apps intent.",
                confidence=0.97,
            )

    if _has_google_drive_hint(raw):
        email_match = re.search(r"([\w\.-]+@[\w\.-]+)", raw)
        drive_email = email_match.group(1).strip().lower() if email_match else ""
        if any(h in t for h in DRIVE_LOGOUT_HINTS):
            args = {}
            if drive_email:
                args["account_email"] = drive_email
            return RouteDecision(
                type=RouteType.DRIVE_LOGOUT,
                args=args,
                reason="Logout Google Drive account.",
                confidence=0.97,
            )

    if t in MEMORY_CLEAR_HINTS:
        return RouteDecision(
            type=RouteType.CLEAR_MEMORY_HISTORY,
            args={},
            reason="Clear personal memory history intent.",
            confidence=0.97,
        )

    delete_memory_match = re.search(r"(?:xóa|xoa|delete|remove)\s+memory\s+(.+)$", raw, re.IGNORECASE)
    if delete_memory_match:
        return RouteDecision(
            type=RouteType.DELETE_MEMORY_KEY,
            args={"key": delete_memory_match.group(1).strip()},
            reason="Delete memory key intent.",
            confidence=0.96,
        )

    delete_entity_match = re.search(r"(?:xóa|xoa|delete|remove)\s+entity\s+(.+)$", raw, re.IGNORECASE)
    if delete_entity_match:
        return RouteDecision(
            type=RouteType.DELETE_ENTITY_MEMORY,
            args={"alias": delete_entity_match.group(1).strip()},
            reason="Delete entity memory intent.",
            confidence=0.96,
        )

    delete_pinned_match = re.search(
        r"(?:xóa|xoa|delete|remove)\s+(?:ghi chú ghim|ghi chu ghim|pinned knowledge)\s+(.+)$",
        raw,
        re.IGNORECASE,
    )
    if delete_pinned_match:
        return RouteDecision(
            type=RouteType.DELETE_PINNED_KNOWLEDGE,
            args={"title": delete_pinned_match.group(1).strip()},
            reason="Delete pinned knowledge intent.",
            confidence=0.96,
        )

    memory_args = _extract_memory_set_args(raw)
    if memory_args:
        return RouteDecision(
            type=RouteType.SET_MEMORY,
            args=memory_args,
            reason="Set personal memory value intent.",
            confidence=0.94,
        )

    entity_args = _extract_entity_set_args(raw)
    if entity_args:
        return RouteDecision(
            type=RouteType.SET_ENTITY_MEMORY,
            args=entity_args,
            reason="Set entity memory value intent.",
            confidence=0.93,
        )

    pinned_args = _extract_pinned_knowledge_args(raw)
    if pinned_args:
        return RouteDecision(
            type=RouteType.ADD_PINNED_KNOWLEDGE,
            args=pinned_args,
            reason="Add pinned knowledge intent.",
            confidence=0.93,
        )

    has_delete_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in DELETE_VERBS)
    has_copy_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in COPY_VERBS)
    has_move_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in MOVE_VERBS)
    folded_t = nlu_ml.normalize_nlu_text(raw)

    if any(h in t for h in EMAIL_COMPOSE_HINTS):
        return RouteDecision(
            type=RouteType.SEND_EMAIL,
            args=_parse_send_email_args(raw),
            reason="Email compose intent.",
            confidence=0.9,
        )

    if any(h in t for h in EMAIL_RESPONSE_HINTS):
        return RouteDecision(
            type=RouteType.REPLY_EMAIL,
            args={
                "index": _extract_email_index(raw),
                "body": _extract_email_body(raw),
                "reply_all": "reply all" in t or "trả lời tất cả" in t or "tra loi tat ca" in t,
            },
            reason="Email response intent.",
            confidence=0.9,
        )

    if "lich nhac" in folded_t and any(token in folded_t for token in ["nao khong", "danh sach", "xem", "con "]):
        return RouteDecision(
            type=RouteType.LIST_REMINDERS,
            args={},
            reason="List reminders via schedule/reminder wording.",
            confidence=0.9,
        )
    email_index = _extract_email_index(raw)
    if email_index is not None and any(w in t for w in EMAIL_READ_HINTS) and not _is_email_list_command(raw):
        return RouteDecision(
            type=RouteType.READ_EMAIL,
            args={"index": email_index},
            reason="Read email detail intent before open_app fallback.",
            confidence=0.94,
        )

    has_open_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in OPEN_FILE_VERBS)

    # (1) Nếu user đưa path rõ ràng -> mở file luôn
    if _has_path(raw):
        path = _extract_first_path(raw)
        if has_delete_verb:
            return RouteDecision(
                type=RouteType.DELETE_FILE_NAME,
                args={"path": path, "direct_path": True},
                reason="Detected Windows path for delete.",
                confidence=0.98,
            )
        return RouteDecision(
            type=RouteType.OPEN_FILE_PATH,
            args={"path": path},
            reason="Detected Windows path.",
            confidence=0.95,
        )

    has_search_word = any(
        w in t for w in ["tìm", "tìm kiếm", "search", "google", "tra cứu", "kiếm"]
    ) or any(
        w in folded_t for w in ["tim", "tim kiem", "kiem", "search", "google", "tra cuu"]
    )
    has_email_send_intent = _has_send_email_intent(raw)
    has_media_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in MEDIA_VERBS) or any(
        re.search(rf"\b{re.escape(v)}\b", folded_t) for v in ["bat", "nghe", "play", "mo", "xem"]
    )

    has_media = any(w in t for w in MEDIA_HINTS) or any(
        re.search(rf"\b{re.escape(w)}\b", folded_t) for w in ["nhac", "video", "bai hat", "phim"]
    )
    has_web_hint = any(w in t for w in WEB_HINTS)
    has_drive_hint = _has_google_drive_hint(raw)
    has_file_hint = any(w in t for w in FILE_HINTS) or any(
        w in folded_t
        for w in ["file", "tep", "tap tin", "tai lieu", "bao cao", "hop dong", "hoa don", "slide", "ban "]
    )
    exts = _extract_extensions(t)
    has_ext_hint = exts is not None

    app_key, app_remainder = _looks_like_app_command(raw)
    known_app_key = _extract_known_app_from_text(raw)
    if (
        known_app_key
        and any(token in folded_t for token in ["can dung", "muon dung", "su dung", "dung ", "vao ", "chay ", "bat ", "mo "])
        and not _has_youtube_hint(raw)
        and not any(token in folded_t for token in ["dong", "tat", "thoat", "close"])
    ):
        return RouteDecision(
            type=RouteType.OPEN_APP,
            args={"app_name": known_app_key},
            reason="Known app alias with usage/open wording.",
            confidence=0.93,
        )

    # (A0) OPEN_URL: mở thẳng các web platform cố định
    web_platform_url = _extract_web_platform_url(raw)
    clean_query = _strip_leading_action(raw)

    if (
        has_open_verb
        and web_platform_url
        and not _has_path(raw)
        and len(clean_query.split()) <= 1
    ):
        return RouteDecision(
            type=RouteType.OPEN_URL,
            args={
                "url": web_platform_url,
                "browser": _extract_browser(raw),
            },
            reason="Open fixed web platform URL.",
            confidence=0.98,
        )

    direct_url = _extract_first_url(raw)
    if direct_url and (has_open_verb or raw.strip() == direct_url):
        return RouteDecision(
            type=RouteType.OPEN_URL,
            args={"url": direct_url, "browser": _extract_browser(raw)},
            reason="Open explicit URL.",
            confidence=0.98,
        )
    
    # (A) YouTube intent: tìm/mở/nghe/bật ... trên ytb/youtube/yt
    if (has_search_word or has_media_verb or has_media) and _has_youtube_hint(raw):
        browser = _extract_browser(raw)
        query = _clean_youtube_query(raw)
        return RouteDecision(
            type=RouteType.YOUTUBE_SEARCH,
            args={"query": query, "browser": browser},
            reason="YouTube intent (search/open/play) + YouTube hints.",
            confidence=0.97,
        )

    # (B) OPEN APP ưu tiên nếu phần đầu câu match app rõ ràng và không kèm query file
    if has_open_verb and app_key and not app_remainder and not _has_path(raw):
        return RouteDecision(
            type=RouteType.OPEN_APP,
            args={"app_name": app_key},
            reason="Open app by alias or canonical app name.",
            confidence=0.97,
        )

    # (C) MỞ FILE theo tên (không cần chữ 'tìm')
    if has_open_verb and (_looks_like_filename(raw) or (app_key in executor.APP_OPEN_FILE_HINTS and app_remainder)) and not _has_path(raw):
        q = _strip_leading_action(raw)
        q, exts2 = _build_open_file_args(q)
        args: Dict[str, Any] = {"query": q}
        if exts2:
            args["extensions"] = exts2
        return RouteDecision(
            type=RouteType.FIND_FILE,
            args=args,
            reason="Open file by name -> find_file then main auto-opens if 1 result",
            confidence=0.95,
        )

    if _looks_like_question(raw) and not should_use_web(raw):
        ml_question_decision = _ml_nlu_route_decision(raw)
        if ml_question_decision is not None and ml_question_decision.type not in {RouteType.CHAT, RouteType.WEB_SEARCH}:
            return ml_question_decision

    if _looks_like_question(raw) and not has_file_hint and not has_ext_hint and not app_key and not has_drive_hint and not has_email_send_intent:
        if not should_use_web(raw):
            return RouteDecision(
                type=RouteType.CHAT,
                args={"message": raw.strip()},
                reason="Detected stable/general question -> natural chat.",
                confidence=0.9,
            )
        return RouteDecision(
            type=RouteType.WEB_SEARCH,
            args={"query": raw.strip()},
            reason="Detected fresh/current question -> redirect to web_search.",
            confidence=0.95,
        )

    if has_search_word and any(token in folded_t for token in ["file", "tai lieu", "ban ", "hop dong", "bao cao", "hoa don", "slide"]):
        query = _clean_find_file_query(raw)
        args_file: Dict[str, Any] = {"query": query or _strip_leading_action(raw)}
        if any(h in t for h in FOLDER_HINTS):
            args_file["include_dirs"] = True
        if exts:
            args_file["extensions"] = exts
        return RouteDecision(
            type=RouteType.FIND_FILE,
            args=args_file,
            reason="Search wording with local document hints.",
            confidence=0.82,
        )

    # (C2) WEB_SEARCH standalone: wiki/news/review/tutorial/... không cần từ "tìm"
    if has_web_hint and not has_file_hint and not has_ext_hint and not app_key and not has_drive_hint and not has_email_send_intent:
        return RouteDecision(
            type=RouteType.WEB_SEARCH,
            args={"query": raw.strip()},
            reason="Standalone web hint -> redirect to web_search.",
            confidence=0.93,
        )

    # (D) WEB_SEARCH: "tìm ..." + media/web hints và không có file hints
    if (
        has_search_word
        and (has_media or has_web_hint)
        and not has_file_hint
        and not has_ext_hint
        and not has_drive_hint
        and not has_email_send_intent
    ):
        query = _strip_leading_action(raw)
        return RouteDecision(
            type=RouteType.WEB_SEARCH,
            args={"query": query},
            reason="Search intent + web/media hints.",
            confidence=0.9,
        )

    # (E) FIND_FILE: có "tìm" + hint file hoặc extension
    if has_search_word and (has_file_hint or has_ext_hint):
        query = _strip_leading_action(raw)
        query = _strip_folder_prefix(query)
        # bỏ chữ file/tệp ở đầu query (ví dụ: "file báo cáo.docx" → "báo cáo.docx")
        query = re.sub(r"^(file|tệp|tập tin)\s+", "", query).strip()
        args2: Dict[str, Any] = {"query": query}
        if exts:
            args2["extensions"] = exts
        if any(h in t for h in FOLDER_HINTS):
            args2["include_dirs"] = True
        return RouteDecision(
            type=RouteType.FIND_FILE,
            args=args2,
            reason="Search intent + file/extension hints.",
            confidence=0.9,
        )

    # (E2) DELETE FILE by name — không cần "tìm", chỉ cần động từ xóa + tên file
    if has_delete_verb and _looks_like_filename(raw) and not _has_path(raw):
        q = _strip_leading_action(raw)                  # bỏ “xóa” (nếu có trong aliases)
        # Bảo vệ: bỏ thủ công nếu _strip_leading_action chưa loại hết
        for dv in sorted(DELETE_VERBS, key=len, reverse=True):
            if q.startswith(dv + " "):
                q = q[len(dv):].strip()
                break
        q = re.sub(r"^(file|tệp|tập tin)\s+", "", q).strip()

        # Strip location suffix: "khoaluan.docx khỏi ổ d nhé" → query="khoaluan.docx", target_dir="ổ d"
        target_dir = None
        q_lower = q.lower()
        for sep in DELETE_LOCATION_SEPARATORS:
            idx = q_lower.find(sep)
            if idx != -1:
                target_dir = q[idx + len(sep):].strip()
                q = q[:idx].strip()

                # Clean up typical trailing words "nhé", "nha", "đi"
                for word in [" nhé", " nha", " đi", " nhe"]:
                    if target_dir.endswith(word):
                        target_dir = target_dir[:-len(word)].strip()
                break

        exts_del = _extract_extensions(q)
        args_del: Dict[str, Any] = {"query": q}
        if exts_del:
            args_del["extensions"] = exts_del
        if target_dir:
            args_del["target_dir"] = target_dir
        return RouteDecision(
            type=RouteType.DELETE_FILE_NAME,
            args=args_del,
            reason="Delete file by name → find_file then confirm.",
            confidence=0.95,
        )

    if has_copy_verb:
        src, dst = _split_copy_move_command(raw)
        if src and dst:
            exts_copy = _extract_extensions(src)
            is_folder = any(_token_contains(src, h) for h in FOLDER_HINTS)
            args_copy: Dict[str, Any] = {
                "query": src,
                "destination": dst,
            }
            if exts_copy:
                args_copy["extensions"] = exts_copy
            if is_folder:
                args_copy["include_dirs"] = True
                args_copy["only_dirs"] = True
            return RouteDecision(
                type=RouteType.COPY_ENTRY,
                args=args_copy,
                reason="Copy intent with source and destination.",
                confidence=0.95,
            )

    if has_move_verb:
        src, dst = _split_copy_move_command(raw)
        if src and dst:
            exts_move = _extract_extensions(src)
            is_folder = any(_token_contains(src, h) for h in FOLDER_HINTS)
            args_move: Dict[str, Any] = {
                "query": src,
                "destination": dst,
            }
            if exts_move:
                args_move["extensions"] = exts_move
            if is_folder:
                args_move["include_dirs"] = True
                args_move["only_dirs"] = True
            return RouteDecision(
                type=RouteType.MOVE_ENTRY,
                args=args_move,
                reason="Move intent with source and destination.",
                confidence=0.95,
            )

    # (F) "tìm ..." mơ hồ -> ưu tiên web nếu query đủ dài
    if has_search_word and not has_file_hint and not has_ext_hint:
        query = _strip_leading_action(raw)
        if len(query.split()) >= 3:
            return RouteDecision(
                type=RouteType.WEB_SEARCH,
                args={"query": query},
                reason="Ambiguous 'tìm ...' but looks like natural web query.",
                confidence=0.75,
            )

        if has_delete_verb and _looks_like_filename(raw) and not _has_path(raw):
            q = _strip_leading_action(raw)
            q = re.sub(r"^(file|tệp|tập tin)\s+", "", q).strip()
            exts2 = _extract_extensions(q)
            args: Dict[str, Any] = {"query": q}
            if exts2:
                args["extensions"] = exts2

            return RouteDecision(
                type=RouteType.DELETE_FILE_NAME,
                args=args,
                reason="Delete file by name -> find_file then confirm delete",
                confidence=0.95,
            )

    if has_delete_verb and any(h in t for h in FOLDER_HINTS):
        q = _strip_entry_prefix(_strip_leading_action(raw))
        return RouteDecision(
            type=RouteType.DELETE_FILE_NAME,
            args={"query": q, "include_dirs": True, "only_dirs": True},
            reason="Delete folder by name -> find path then confirm.",
            confidence=0.95,
        )

    # (X) OPEN APP: "mở notepad", "open chrome", "mở vs code"
    has_open_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in OPEN_FILE_VERBS)
    if has_open_verb and not _has_path(raw) and not _looks_like_filename(raw):
        stripped_q = _strip_leading_action(raw)
        q = _strip_app_prefix(stripped_q)  # lấy phần sau "mở ..." và bỏ tiền tố "app/ứng dụng"
        app_key = executor.guess_app_name(q, allow_prefix=True)
        if not app_key:
            app_key = _extract_known_app_from_text(raw)
        if app_key:
            return RouteDecision(
                type=RouteType.OPEN_APP,
                args={"app_name": app_key},
                reason="Rule-first open_app via executor.guess_app_name",
                confidence=0.95,
            )
        q_folded = nlu_ml.normalize_nlu_text(q)
        ambiguous_pronouns = {"cai do", "do", "do len", "cai nay", "nay", "no"}
        if q_folded in ambiguous_pronouns:
            q = ""
        document_terms = ["bao cao", "hop dong", "hoa don", "tai lieu", "slide", "bang ke", "file"]
        if q and any(term in q_folded for term in document_terms):
            return RouteDecision(
                type=RouteType.FIND_FILE,
                args={"query": _clean_find_file_query(raw) or q},
                reason="Open verb with document wording -> find file instead of custom app.",
                confidence=0.86,
            )
        if q and q != stripped_q:
            return RouteDecision(
                type=RouteType.OPEN_APP,
                args={"app_name": q, "confirm_before_custom_picker": False},
                reason="Explicit app/applications prefix -> treat as open_app even if app is unknown.",
                confidence=0.93,
            )
        if (
            q
            and q_folded not in ambiguous_pronouns
            and len(q.split()) <= 4
            and not any(hint in q for hint in WEB_HINTS | MEDIA_HINTS | DRIVE_HINTS)
        ):
            return RouteDecision(
                type=RouteType.OPEN_APP,
                args={"app_name": q, "confirm_before_custom_picker": True},
                reason="Open verb + compact unknown noun phrase -> treat as open_app for custom-app fallback.",
                confidence=0.88,
            )

    # (Y) CLOSE APP: "đóng notepad", "tắt chrome", "thoát vscode"
    has_close_verb = any(re.search(rf"\b{re.escape(v)}\b", t) for v in CLOSE_APP_VERBS)
    if has_close_verb and not _has_path(raw) and not _looks_like_filename(raw):
        q = _strip_leading_action(raw)  # phần sau "đóng/tắt/thoát ..."
        close_all = _wants_close_all(raw)

        # loại bỏ từ chỉ "all" ra khỏi query để guess_app_name dễ hơn
        q2 = q
        for h in ["tất cả", "toàn bộ", "hết", "all"]:
            q2 = q2.replace(h, " ")
        q2 = " ".join(q2.split()).strip()

        app_key = executor.guess_app_name(q2, allow_prefix=True)
        if not app_key:
            app_key = _extract_known_app_from_text(raw)
        if app_key:
            args = {"app_name": app_key}
            if close_all:
                args["close_all"] = True
            return RouteDecision(
                type=RouteType.CLOSE_APP,
                args=args,
                reason="Rule-first close_app via executor.guess_app_name",
                confidence=0.95,
            )

    bulk_email_file = _extract_bulk_email_file_ref(raw)
    if has_email_send_intent and bulk_email_file:
        return RouteDecision(
            type=RouteType.SEND_BULK_EMAIL,
            args={"file_ref": bulk_email_file},
            reason="Bulk email send from Excel intent.",
            confidence=0.95,
        )

    if has_email_send_intent and (" file " in f" {t} " or "excel" in t or ".xlsx" in t):
        return RouteDecision(
            type=RouteType.SEND_BULK_EMAIL,
            args={"file_ref": bulk_email_file},
            reason="Bulk email send from Excel intent without resolved file.",
            confidence=0.9,
        )

    if has_email_send_intent:
        return RouteDecision(
            type=RouteType.SEND_EMAIL,
            args=_parse_send_email_args(raw),
            reason="Email send intent.",
            confidence=0.92,
        )

    if (_has_reminder_hint(raw) or (any(h in t for h in REMINDER_SNOOZE_HINTS) and "sau " in t)) and not has_email_send_intent:
        reminder_index = _extract_reminder_index(raw)

        if any(h in t for h in REMINDER_SNOOZE_HINTS):
            return RouteDecision(
                type=RouteType.SNOOZE_REMINDER,
                args={"index": reminder_index, "minutes": _extract_snooze_minutes(raw)},
                reason="Snooze reminder intent.",
                confidence=0.92,
            )

        if any(h in t for h in REMINDER_UPDATE_HINTS):
            return RouteDecision(
                type=RouteType.UPDATE_REMINDER,
                args=_extract_update_reminder_args(raw),
                reason="Update reminder intent.",
                confidence=0.9,
            )

        if any(h in t for h in REMINDER_DELETE_HINTS):
            return RouteDecision(
                type=RouteType.DELETE_REMINDER,
                args={"index": reminder_index},
                reason="Delete reminder intent.",
                confidence=0.93,
            )

        if any(h in t for h in REMINDER_COMPLETE_HINTS):
            return RouteDecision(
                type=RouteType.COMPLETE_REMINDER,
                args={"index": reminder_index},
                reason="Complete reminder intent.",
                confidence=0.93,
            )

        if any(h in t for h in REMINDER_LIST_HINTS):
            return RouteDecision(
                type=RouteType.LIST_REMINDERS,
                args={},
                reason="List reminders intent.",
                confidence=0.92,
            )

        return RouteDecision(
            type=RouteType.CREATE_REMINDER,
            args=_extract_create_reminder_args(raw),
            reason="Create reminder intent.",
            confidence=0.9,
        )

    if _looks_like_task_list_import(raw):
        return RouteDecision(
            type=RouteType.IMPORT_TASK_LIST,
            args=_extract_import_task_list_args(raw),
            reason="Import task list intent.",
            confidence=0.94,
        )

    has_gmail_account_hint = (
        ("gmail" in t or "email" in t or "mail" in t)
        and (
            "tĂ i khoáº£n" in t
            or "tai khoan" in t
            or "account" in t
        )
    )
    if has_gmail_account_hint:
        email_match = re.search(r"([\w\.-]+@[\w\.-]+)", raw)
        selected_email = email_match.group(1).strip().lower() if email_match else ""
        if any(h in t for h in EMAIL_ACCOUNT_ADD_HINTS):
            return RouteDecision(
                type=RouteType.EMAIL_LOGIN,
                args={"prompt_select": True},
                reason="Add another Gmail account.",
                confidence=0.95,
            )
        if selected_email and any(h in t for h in EMAIL_ACCOUNT_SELECT_HINTS):
            return RouteDecision(
                type=RouteType.EMAIL_SETTINGS,
                args={"mode": "set_account", "email": selected_email},
                reason="Select active Gmail account.",
                confidence=0.96,
            )
        if any(w in t for w in ["logout", "Ä‘Äƒng xuáº¥t", "dang xuat", "thoĂ¡t"]):
            return RouteDecision(
                type=RouteType.EMAIL_SETTINGS,
                args={"mode": "logout_account", "email": selected_email},
                reason="Logout one Gmail account.",
                confidence=0.94,
            )
        return RouteDecision(
            type=RouteType.EMAIL_SETTINGS,
            args={"mode": "accounts", "email": None},
            reason="List Gmail accounts.",
            confidence=0.95,
        )

    # (V) EMAIL_SETTINGS
    has_email_settings = any(w in t for w in EMAIL_SETTINGS_HINTS)
    if has_email_settings:

        # logout
        if any(w in t for w in ["logout", "đăng xuất", "dang xuat", "thoát gmail"]):
            mode = "logout"
            email = None

        else:
            # detect email
            m = re.search(r"([\w\.-]+@[\w\.-]+)", t)
            email = m.group(1).lower() if m else None

            # detect operation
            if any(w in t for w in ["bỏ ẩn", "unhide", "bo an"]):
                mode = "unhide"
            elif any(w in t for w in ["ẩn email", "hide email", "hide"]):
                mode = "hide"
            else:
                mode = "show"

        return RouteDecision(
            type=RouteType.EMAIL_SETTINGS,
            args={"mode": mode, "email": email},
            reason=f"Email settings operation: {mode}",
            confidence=0.95,
        )

    if any(w in t for w in EMAIL_LOGIN_HINTS):
        return RouteDecision(
            type=RouteType.EMAIL_LOGIN,
            args={},
            reason="Email login intent.",
            confidence=0.97,
        )

    if _has_google_drive_hint(raw):
        email_match = re.search(r"([\w\.-]+@[\w\.-]+)", raw)
        drive_email = email_match.group(1).strip().lower() if email_match else ""
        drive_index = _extract_drive_index(raw)

        if any(h in t for h in DRIVE_LOGOUT_HINTS):
            args = {}
            if drive_email:
                args["account_email"] = drive_email
            return RouteDecision(
                type=RouteType.DRIVE_LOGOUT,
                args=args,
                reason="Logout Google Drive account.",
                confidence=0.97,
            )

        if any(h in t for h in DRIVE_ACCOUNT_LIST_HINTS):
            return RouteDecision(
                type=RouteType.LIST_DRIVE_ACCOUNTS,
                args={},
                reason="List connected Google Drive accounts.",
                confidence=0.96,
            )

        if any(h in t for h in DRIVE_SELECT_ACCOUNT_HINTS) and drive_email:
            return RouteDecision(
                type=RouteType.SET_DRIVE_ACCOUNT,
                args={"email": drive_email},
                reason="Select active Google Drive account.",
                confidence=0.97,
            )

        if any(h in t for h in DRIVE_CONNECT_HINTS):
            args = {}
            if drive_email:
                args["account_email"] = drive_email
            return RouteDecision(
                type=RouteType.DRIVE_LOGIN,
                args=args,
                reason="Connect Google Drive account.",
                confidence=0.96,
            )

        if any(h in t for h in DRIVE_UPLOAD_HINTS):
            return RouteDecision(
                type=RouteType.UPLOAD_TO_DRIVE,
                args={
                    "file_ref": _extract_drive_local_file_ref(raw),
                    "folder_ref": _extract_drive_upload_folder_ref(raw),
                    "create_folder_if_missing": _should_create_drive_folder(raw),
                },
                reason="Upload local file to Google Drive.",
                confidence=0.95,
            )

        if any(h in t for h in DRIVE_LINK_HINTS):
            return RouteDecision(
                type=RouteType.GET_DRIVE_LINK,
                args={
                    "query": _clean_drive_query(raw),
                    "index": drive_index,
                    "make_public": any(k in t for k in ["công khai", "cong khai", "public", "anyone"]),
                },
                reason="Get Google Drive share link.",
                confidence=0.94,
            )

        if any(h in t for h in DRIVE_DOWNLOAD_HINTS):
            return RouteDecision(
                type=RouteType.DOWNLOAD_DRIVE_FILE,
                args={
                    "query": _clean_drive_query(raw),
                    "index": drive_index,
                    "destination": _extract_drive_download_destination(raw),
                },
                reason="Download file from Google Drive.",
                confidence=0.94,
            )

        return RouteDecision(
            type=RouteType.SEARCH_DRIVE_FILES,
            args={"query": _clean_drive_query(raw)},
            reason="Search file on Google Drive.",
            confidence=0.9,
        )

    if any(w in t for w in EMAIL_REPLY_HINTS):
        return RouteDecision(
            type=RouteType.REPLY_EMAIL,
            args={
                "index": _extract_email_index(raw),
                "body": _extract_email_body(raw),
                "reply_all": "reply all" in t or "trả lời tất cả" in t or "tra loi tat ca" in t,
            },
            reason="Email reply intent.",
            confidence=0.92,
        )

    if any(w in t for w in EMAIL_ARCHIVE_HINTS):
        return RouteDecision(
            type=RouteType.ARCHIVE_EMAIL,
            args={"index": _extract_email_index(raw)},
            reason="Archive email intent.",
            confidence=0.92,
        )

    if re.fullmatch(r"xem th[eê]m(\s+(n[uữ]a|thêm|them))?|th[eê]m n[uữ]a|them nua|load more", t):
        return RouteDecision(
            type=RouteType.LOAD_MORE_EMAILS,
            args={},
            reason="Short-form load more emails intent (exact phrase).",
            confidence=0.88,
        )

    if ("gmail" in t or "email" in t or "mail" in t) and any(
        h in t for h in EMAIL_ACCOUNT_ADD_HINTS
    ) and any(h in t for h in ["dang nhap", "Ä‘Äƒng nháº­p", "login"]):
        return RouteDecision(
            type=RouteType.EMAIL_LOGIN,
            args={"prompt_select": True},
            reason="Add another Gmail account.",
            confidence=0.95,
        )

    if any(w in t for w in EMAIL_LOAD_MORE_HINTS):
        return RouteDecision(
            type=RouteType.LOAD_MORE_EMAILS,
            args={},
            reason="Load more emails intent.",
            confidence=0.95,
        )

    if "đánh dấu" in t or "danh dau" in t:
        if "đã đọc" in t or "da doc" in t:
            return RouteDecision(
                type=RouteType.MARK_EMAIL,
                args={"index": _extract_email_index(raw), "unread": False},
                reason="Mark email as read.",
                confidence=0.92,
            )
        if "chưa đọc" in t or "chua doc" in t:
            return RouteDecision(
                type=RouteType.MARK_EMAIL,
                args={"index": _extract_email_index(raw), "unread": True},
                reason="Mark email as unread.",
                confidence=0.92,
            )

    email_index = _extract_email_index(raw)
    if any(w in t for w in EMAIL_READ_HINTS) and not _is_email_list_command(raw):
        return RouteDecision(
            type=RouteType.READ_EMAIL,
            args={"index": email_index},
            reason="Read email detail intent.",
            confidence=0.9,
        )

    # (W) CHECK_EMAIL
    has_email_word = any(w in t for w in EMAIL_HINTS)
    if has_email_word:

        # --- Detect status ---
        status = "any"
        for key, words in EMAIL_STATUS_KEYWORDS.items():
            if any(w in t for w in words):
                status = key
                break

        # --- Detect date ---
        date = None
        for key, words in EMAIL_DATE_KEYWORDS.items():
            if any(w in t for w in words):
                date = key
                break

        # =====================================================
        # 🟦 PARSE TIẾNG VIỆT: ngày / tháng / năm
        # =====================================================
        def parse_vietnamese_date(text: str):
            now = datetime.now()
            t = text.lower()

            # Helper convert tiếng Việt → số
            def to_number(s):
                s = s.strip()
                try:
                    return w2n(s)   # dùng vietnam-number
                except:
                    return None

            # ============================================
            # Case 1: "ngày X tháng Y năm Z"
            # ============================================
            m = re.search(r"ngày (.+?) tháng (.+?) năm (.+?)($| )", t)

            if m:
                d = to_number(m.group(1))
                mth = to_number(m.group(2))
                y = to_number(m.group(3))
                if d and mth and y:
                    return f"{y}/{mth:02d}/{d:02d}"

            # ============================================
            # Case 2: "ngày X tháng Y"
            # ============================================
            m = re.search(r"ngày (.+?) tháng (.+?)($| )", t)
            if m:
                d = to_number(m.group(1))
                mth = to_number(m.group(2))
                if d and mth:
                    return f"{now.year}/{mth:02d}/{d:02d}"

            # ============================================
            # Case 3: "tháng Y năm Z"
            # ============================================
            m = re.search(r"tháng (.+?) năm (.+?)($| )", t)
            if m:
                mth = to_number(m.group(1))
                y = to_number(m.group(2))
                if mth and y:
                    return f"{y}/{mth:02d}/01"

            # ============================================
            # Case 4a: "ngày DD/MM" hoặc "ngày DD/MM/YYYY" (dạng số)
            # ============================================
            m = re.search(r"ngày\s+(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{4}))?\b", t)
            if m:
                d = int(m.group(1))
                mth = int(m.group(2))
                y = int(m.group(3)) if m.group(3) else now.year
                try:
                    return f"{y}/{mth:02d}/{d:02d}"
                except ValueError:
                    pass

            # ============================================
            # Case 4: "ngày X" (dạng chữ số)
            # ============================================
            m = re.search(r"ngày (.+?)($| )", t)
            if m:
                d = to_number(m.group(1))
                if d:
                    return f"{now.year}/{now.month:02d}/{d:02d}"

            # ============================================
            # Case 5: "tháng Y"
            # ============================================
            m = re.search(r"tháng (.+?)($| )", t)









            if m:
                mth = to_number(m.group(1))
                if mth:
                    return f"{now.year}/{mth:02d}/01"

            return None
        # --- Nếu không match keyword today/yesterday → thử tiếng Việt
        if not date:
            vn_date = parse_vietnamese_date(t)
            if vn_date:
                date = vn_date

        # =====================================================
        # 🟦 FALLBACK: dạng 01/02/2026 hoặc 2026/02/01 hoặc 27/3
        # =====================================================
        if not date:
            m = re.search(r"\b(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})\b", t)

            if m:
                a, b, c = map(int, m.groups())

                if a > 999:         # YYYY/MM/DD
                    year, month, day = a, b, c
                elif c > 999:       # DD/MM/YYYY
                    day, month, year = a, b, c
                else:
                    date = "latest"

                if a > 999 or c > 999:
                    date = datetime(year, month, day).strftime("%Y/%m/%d")

            else:
                # Thử dạng DD/MM không có năm (vd: "27/3", "27-3")
                m2 = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b", t)
                if m2:
                    _day, _month = int(m2.group(1)), int(m2.group(2))
                    _now = datetime.now()
                    try:
                        date = datetime(_now.year, _month, _day).strftime("%Y/%m/%d")
                    except ValueError:
                        date = "latest"
                else:
                    date = "latest"

        # --- Build unified mode ---
        mode = f"{status}:{date}"

        return RouteDecision(
            type=RouteType.CHECK_EMAIL,
            args={"mode": mode},
            reason=f"Check email with status={status}, date={date}",
            confidence=0.95,
        )

    ml_decision = _ml_nlu_route_decision(raw)
    if ml_decision is not None:
        return ml_decision
    
    fallback_kind = classify_non_tool_text(raw)
    if fallback_kind == IntentKind.CHAT:
        return RouteDecision(
            type=RouteType.CHAT,
            args={"message": raw.strip()},
            reason="No strong tool matched; natural chat heuristic matched.",
            confidence=0.72,
        )
    if fallback_kind == IntentKind.WEB:
        return RouteDecision(
            type=RouteType.WEB_SEARCH,
            args={"query": raw.strip()},
            reason="No strong tool matched; web/freshness heuristic matched.",
            confidence=0.78,
        )

    # (Z) Fallback — luôn phải có để route() không bao giờ trả None
    return RouteDecision(
        type=RouteType.FALLBACK_TO_LLM,
        args={},
        reason="No strong rule matched; fallback to LLM.",
        confidence=0.6,
    )
