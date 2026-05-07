from __future__ import annotations

from enum import Enum
import re
import unicodedata


class IntentKind(str, Enum):
    TOOL = "tool"
    CHAT = "chat"
    WEB = "web"
    CLARIFY = "clarify"


def normalize_intent_text(text: str) -> str:
    lowered = (text or "").strip().lower()
    folded = unicodedata.normalize("NFD", lowered)
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    folded = re.sub(r"[^a-z0-9@._:/\\\-\s?]", " ", folded)
    return re.sub(r"\s+", " ", folded).strip()


COMMAND_HINTS = {
    "mo",
    "open",
    "dong",
    "tat",
    "thoat",
    "xoa",
    "delete",
    "remove",
    "copy",
    "sao chep",
    "move",
    "di chuyen",
    "gui email",
    "send email",
    "reply email",
    "tra loi email",
    "gmail",
    "drive",
    "google drive",
    "upload",
    "download",
    "nhac toi",
    "nhac minh",
    "reminder",
    "workflow",
    "pin",
    "menu",
}

EXPLICIT_WEB_HINTS = {
    "tim tren web",
    "tim tren google",
    "tra cuu",
    "google giup",
    "search web",
    "web search",
    "mo web",
}

FRESHNESS_HINTS = {
    "moi nhat",
    "hom nay",
    "hien tai",
    "bay gio",
    "gan day",
    "vua cong bo",
    "tin moi",
    "tin tuc",
    "gia",
    "ty gia",
    "lich",
    "thoi tiet",
    "phien ban moi",
    "version moi",
    "latest",
    "current",
    "today",
    "news",
    "price",
    "weather",
    "schedule",
    "release date",
}

CHAT_HINTS = {
    "giai thich",
    "tom tat",
    "viet giup",
    "viet cho",
    "dich",
    "so sanh",
    "phan tich",
    "mo ta",
    "theo ban",
    "minh nen",
    "tu van",
    "brainstorm",
    "noi chuyen",
    "ke chuyen",
    "giup toi hieu",
    "explain",
    "summarize",
    "translate",
    "write",
    "compare",
    "describe",
    "brainstorm",
    "what do you think",
}

QUESTION_STARTS = (
    "ai ",
    "cai gi ",
    "la gi",
    "tai sao",
    "vi sao",
    "bao nhieu",
    "o dau",
    "khi nao",
    "nhu the nao",
    "the nao",
    "lam sao",
    "cach ",
    "what ",
    "why ",
    "who ",
    "where ",
    "when ",
    "how ",
)

QUESTION_PATTERNS = {
    " la gi",
    " la ai",
    " nghia la",
    " co nghia",
    " khac gi",
    " khac nhau",
    " nhu the nao",
    " ra sao",
}


def looks_like_tool_request(text: str) -> bool:
    t = normalize_intent_text(text)
    if not t:
        return False
    return any(hint in t for hint in COMMAND_HINTS)


def should_use_web(text: str) -> bool:
    t = normalize_intent_text(text)
    if not t:
        return False
    return any(hint in t for hint in EXPLICIT_WEB_HINTS | FRESHNESS_HINTS)


def looks_like_chat(text: str) -> bool:
    t = normalize_intent_text(text)
    if not t:
        return False
    if looks_like_tool_request(text):
        return False
    if any(hint in t for hint in CHAT_HINTS):
        return True
    if "?" in (text or ""):
        return not should_use_web(text)
    if t.startswith(QUESTION_STARTS):
        return not should_use_web(text)
    return any(pattern in f" {t}" for pattern in QUESTION_PATTERNS) and not should_use_web(text)


def classify_non_tool_text(text: str) -> IntentKind:
    if should_use_web(text):
        return IntentKind.WEB
    if looks_like_chat(text):
        return IntentKind.CHAT
    return IntentKind.TOOL
