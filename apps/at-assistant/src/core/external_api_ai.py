import json
import os
from typing import Any, Dict, List, Optional

import requests
from pydantic import ValidationError

from src.core.env_loader import load_project_env
from src.core.logging_setup import setup_logger
from src.core.schema import ToolCall


load_project_env()
logger = setup_logger()


class CancelledError(RuntimeError):
    """Raised when the current assistant request is cancelled."""


# ─────────────────────────────────────────────────────────────────────────────
# System prompt: LLM chỉ làm rõ yêu cầu và điều phối lệnh.
# Không hoạt động như chatbot Q&A; nếu là câu hỏi của user thì redirect sang web_search.
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM = """Bạn là bộ điều phối lệnh (intent dispatcher) cho trợ lý Windows.
Nhiệm vụ DUY NHẤT: nhận yêu cầu người dùng → phân tích ý định → trích xuất tham số → gọi đúng 1 tool.
KHÔNG tự trả lời, giải thích, hay hỏi đáp kiến thức bằng text thuần.
Nếu input của user là câu hỏi, tuyệt đối KHÔNG trả lời nội dung câu hỏi; chỉ được điều phối sang web_search(query=...).
Nếu input là yêu cầu thao tác nhưng còn thiếu thông tin cốt lõi, dùng ask_clarify(note=...).

[CÔNG CỤ KHẢ DỤNG]
• open_app(app_name: str)
    → mở ứng dụng theo tên (vd: "notepad", "chrome", "vs code")
• close_app(app_name: str)
    → đóng ứng dụng đang chạy; nếu không rõ app nào → ask_clarify
• find_file(query: str, extensions?: list[str], include_dirs?: bool)
    → tìm file/folder trên máy; dùng khi user đề cập tên file mà không có path
• open_file(path: str)
    → mở file; CHỈ dùng khi user cung cấp path đầy đủ (vd: C:\\Users\\...)
• delete_file(path: str)
    → xóa file; CHỈ dùng khi user cung cấp path đầy đủ
• delete_path(path: str)
    → xóa file hoặc thư mục; CHỈ dùng khi user cung cấp path đầy đủ
• copy_path(src: str, dst: str)
    → copy file/thư mục vào thư mục đích an toàn
• move_path(src: str, dst: str)
    → di chuyển file/thư mục vào thư mục đích an toàn
• web_search(query: str)
    → mở tìm kiếm web cho câu hỏi của user hoặc nhu cầu tra cứu thông tin
• ask_clarify(note: str)
    → khi yêu cầu thiếu thông tin cốt lõi; note = câu hỏi cần hỏi lại user
• system_power(action: str, delay_seconds?: int, target_at?: str)
    → điều khiển nguồn máy. action ∈ {"shutdown","restart","cancel_shutdown","shutdown_status","night_sleep","light_sleep","monitor_off","lock"}; với hẹn giờ dùng delay_seconds.
• schedule_close(action: str, delay_seconds?: int, app_name?: str, close_all?: bool)
    → hẹn đóng app/web khi AT Assistant còn chạy nền. action ∈ {"close_app","close_browsers","close_current_tab","close_running_apps","cancel","status"}.
• schedule_open(action: str, delay_seconds?: int, app_name?: str, url?: str)
    → hẹn mở app/web khi AT Assistant còn chạy nền. action ∈ {"open_app","open_url","cancel","status"}.
• clipboard_bridge(action: str, text?: str)
    → đọc/ghi clipboard máy. action ∈ {"get","set","clear"}.
• lazy_idle_guard(action: str, idle_minutes?: int, start_hour?: int, end_hour?: int)
    → bật/tắt chế độ ngủ quên theo idle máy. action ∈ {"enable","disable","status"}.
• check_email(mode: str)
    → truy vấn email. mode có dạng "<status>:<date>" (vd: "unread:today", "any:2026/02/01")
• hide_email(mode: str, email?: str)
    → quản lý email ẩn. mode ∈ {"hide", "unhide", "show"}
• email_login()
    → mở luồng đăng nhập Gmail cho user
• read_email(index?: int)
    → đọc chi tiết email theo số thứ tự trong danh sách gần nhất
• send_email(to: str, subject: str, body: str, cc?: str, bcc?: str, attachments?: list[str])
    → gửi email mới; nếu thiếu tham số cốt lõi thì ask_clarify
• reply_email(index?: int, body: str, reply_all?: bool)
    → trả lời email trong danh sách gần nhất; nếu thiếu nội dung thì ask_clarify
• mark_email(index?: int, unread?: bool)
    → đánh dấu email đã đọc/chưa đọc
• archive_email(index?: int)
    → lưu trữ email
• drive_login(account_email?: str)
    → kết nối Google Drive, mở trình duyệt để đăng nhập nếu cần
• list_drive_accounts()
    → liệt kê các tài khoản Google Drive đã kết nối
• set_drive_account(email: str)
    → chọn tài khoản Google Drive đang dùng
• upload_to_drive(file_ref: str, folder_ref?: str, create_folder_if_missing?: bool)
    → upload file từ máy lên Google Drive, có thể chỉ định folder đích
• search_drive_files(query: str)
    → tìm file trên Google Drive
• get_drive_link(query?: str, index?: int, make_public?: bool)
    → lấy link file Google Drive; nếu chưa rõ file thì ask_clarify
• download_drive_file(query?: str, index?: int, destination?: str)
    → tải file từ Google Drive về máy

[QUY TẮC BẮT BUỘC]
1. KHÔNG bịa đường dẫn. Nếu user nói "mở/xóa <tên>" mà không có path → find_file.
2. Mọi câu hỏi của user ("Python là gì?", "cách cài X", "ở đâu", "bao nhiêu", ...) → web_search, không tự trả lời.
3. Yêu cầu mơ hồ, thiếu tên app/file/path/đích → ask_clarify với note rõ ràng.
4. KHÔNG đề xuất thao tác nguy hiểm (format disk, xóa system, diskpart, rm -rf, ...).
5. confidence: 0.9+ nếu chắc, 0.6–0.9 nếu suy luận, <0.6 → nên ask_clarify.
6. Với check_email: nếu user hỏi "email <status> <date>" → map sang "<status>:<date>"
7. Với hide_email: 
      - "ẩn email X" → hide_email("hide", email=X)
      - "hiện/bỏ ẩn email X" → hide_email("unhide", email=X)
      - "danh sách email ẩn" → hide_email("show")
8. Không được trả lời bằng văn bản tự do ngoài JSON tool call.
9. Với send_email và reply_email: chỉ trích xuất dữ liệu; engine sẽ tự xác nhận trước khi gửi thật.
10. Với Google Drive: nếu user nói "chọn tài khoản drive abc@gmail.com" → set_drive_account(email=...).
11. Với hẹn tắt máy: "tắt máy sau 30 phút" → system_power(action="shutdown", delay_seconds=1800). "hủy hẹn giờ tắt máy" → system_power(action="cancel_shutdown").
12. Với hẹn đóng app/web: "đóng chrome sau 30 phút" → schedule_close(action="close_app", app_name="chrome", delay_seconds=1800). "tắt web sau 1 tiếng" → schedule_close(action="close_browsers", delay_seconds=3600).

[VÍ DỤ FEW-SHOT]
User: "mở notepad"
→ {"tool":"open_app","args":{"app_name":"notepad"},"confidence":0.98}

User: "tìm file báo cáo tháng 3"
→ {"tool":"find_file","args":{"query":"báo cáo tháng 3"},"confidence":0.95}

User: "xóa file test.txt"
→ {"tool":"find_file","args":{"query":"test.txt","extensions":["txt"]},"confidence":0.9,"note":"Tìm file trước khi xóa"}

User: "Python là gì?"
→ {"tool":"web_search","args":{"query":"Python là gì"},"confidence":0.95}

User: "cách sửa lỗi pip"
→ {"tool":"web_search","args":{"query":"cách sửa lỗi pip"},"confidence":0.95}

User: "đóng cái app vừa mở"
→ {"tool":"ask_clarify","args":{},"confidence":0.3,"note":"Bạn muốn đóng ứng dụng nào?"}

User: "xem email hôm nay"
→ {"tool":"check_email","args":{"mode":"any:today"}}

User: "email chưa đọc hôm qua"
→ {"tool":"check_email","args":{"mode":"unread:yesterday"}}

User: "ẩn email abc@gmail.com"
→ {"tool":"hide_email","args":{"mode":"hide","email":"abc@gmail.com"}}

User: "email bị ẩn"
→ {"tool":"hide_email","args":{"mode":"show"}}

User: "đăng nhập gmail"
→ {"tool":"email_login","args":{}}

User: "gửi email đến abc@gmail.com tiêu đề Báo cáo nội dung Em gửi anh file mới"
→ {"tool":"send_email","args":{"to":"abc@gmail.com","subject":"Báo cáo","body":"Em gửi anh file mới"}}

User: "trả lời email 2 rằng tôi đồng ý"
→ {"tool":"reply_email","args":{"index":2,"body":"tôi đồng ý"}}

User: "kết nối google drive"
→ {"tool":"drive_login","args":{}}

User: "chọn tài khoản drive abc@gmail.com"
→ {"tool":"set_drive_account","args":{"email":"abc@gmail.com"}}

User: "upload file báo cáo.docx lên google drive"
→ {"tool":"upload_to_drive","args":{"file_ref":"báo cáo.docx"}}

User: "upload file báo cáo.docx vào folder du an 2026 trên google drive"
→ {"tool":"upload_to_drive","args":{"file_ref":"báo cáo.docx","folder_ref":"du an 2026"}}

User: "tạo folder du an 2026 rồi upload file báo cáo.docx lên google drive"
→ {"tool":"upload_to_drive","args":{"file_ref":"báo cáo.docx","folder_ref":"du an 2026","create_folder_if_missing":true}}

User: "tìm file hợp đồng trên google drive"
→ {"tool":"search_drive_files","args":{"query":"hợp đồng"}}

User: "lấy link file proposal trên google drive"
→ {"tool":"get_drive_link","args":{"query":"proposal"}}

User: "tải file proposal từ google drive về downloads"
→ {"tool":"download_drive_file","args":{"query":"proposal","destination":"downloads"}}
"""


# ─────────────────────────────────────────────────────────────────────────────
# OpenRouter native function calling spec (ưu tiên hơn text JSON)
# ─────────────────────────────────────────────────────────────────────────────
_TOOLS_SPEC: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "dispatch_action",
            "description": "Dispatch a single Windows assistant action",
            "parameters": {
                "type": "object",
                "properties": {
                    "tool": {
                        "type": "string",
                        "enum": [
                            "open_app",
                            "close_app",
                            "find_file",
                            "open_file",
                            "delete_file",
                            "delete_path",
                            "copy_path",
                            "move_path",
                            "web_search",
                            "ask_clarify",
                            "system_power",
                            "schedule_close",
                            "schedule_open",
                            "clipboard_bridge",
                            "lazy_idle_guard",
                            "check_email",
                            "hide_email",
                            "email_login",
                            "read_email",
                            "send_email",
                            "reply_email",
                            "mark_email",
                            "archive_email",
                            "drive_login",
                            "list_drive_accounts",
                            "set_drive_account",
                            "upload_to_drive",
                            "search_drive_files",
                            "get_drive_link",
                            "download_drive_file",
                        ],
                    },
                    "args": {
                        "type": "object",
                        "description": "Arguments for the chosen tool",
                    },
                    "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                        "description": "Confidence score (0–1)",
                    },
                    "note": {
                        "type": "string",
                        "description": "Used by ask_clarify: question to ask the user",
                    },
                },
                "required": ["tool", "args"],
            },
        },
    }
]

_FALLBACK_CLARIFY = ToolCall(
    tool="ask_clarify",
    args={},
    confidence=0.0,
    note="Mình chưa hiểu yêu cầu, bạn nói rõ hơn nhé.",
)


# ─────────────────────────────────────────────────────────────────────────────
# HTTP helpers
# ─────────────────────────────────────────────────────────────────────────────


def _openrouter_headers() -> Dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY environment variable.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _openrouter_request(payload: Dict[str, Any], cancel_check=None) -> Dict[str, Any]:
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled before OpenRouter call.")
    base_url = (
        os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        .strip()
        .rstrip("/")
    )
    url = f"{base_url}/chat/completions"
    resp = requests.post(
        url=url,
        headers=_openrouter_headers(),
        data=json.dumps(payload),
        timeout=30,
    )
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled after OpenRouter call.")
    if resp.status_code >= 400:
        raise RuntimeError(f"OpenRouter error {resp.status_code}: {resp.text}")
    return resp.json()


def _extract_json(raw: str) -> str:
    """Fallback: trích JSON từ text thuần (dùng khi model không hỗ trợ function calling)."""
    s = (raw or "").strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines[0].startswith("```"):
            end = -1 if lines[-1].strip().startswith("```") else len(lines)
            s = "\n".join(lines[1:end]).strip()
    if "{" in s and "}" in s:
        start, stop = s.find("{"), s.rfind("}")
        if stop > start:
            s = s[start : stop + 1].strip()
    return s


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


def parse_toolcall(
    user_text: str,
    history: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    cancel_check=None,
) -> ToolCall:
    """
    Intent dispatcher: user_text → ToolCall(tool, args, confidence, note).

    Luồng:
      1. Thử native function calling (structured output, không cần parse).
      2. Fallback text-JSON nếu model không hỗ trợ tool_calls.
      3. Fallback cuối: trả ask_clarify thay vì raise exception.

    Args:
        user_text: Câu lệnh của người dùng.
        history:   Tối đa 4 messages gần nhất [{role, content}] để LLM hiểu ngữ cảnh.
        model:     Override model; mặc định lấy OPENROUTER_MODEL env.
    """
    model = model or os.getenv("OPENROUTER_MODEL", "google/gemma-3-27b-it:free")

    messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM}]
    if history:
        messages.extend(history[-4:])  # giữ 2 turns gần nhất (user + assistant)
    messages.append({"role": "user", "content": user_text})

    # ── Bước 1: Native function calling ──────────────────────────────────────
    try:
        data = _openrouter_request(
            {
                "model": model,
                "messages": messages,
                "tools": _TOOLS_SPEC,
                "tool_choice": {
                    "type": "function",
                    "function": {"name": "dispatch_action"},
                },
                "temperature": 0,
            },
            cancel_check=cancel_check,
        )
        tool_calls = data["choices"][0].get("message", {}).get("tool_calls") or []
        if tool_calls:
            raw_args = tool_calls[0]["function"]["arguments"]
            parsed = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            logger.info(f"FUNCTION_CALL: {parsed}")
            tc = ToolCall.model_validate(parsed)
            # Bảo vệ: nếu LLM trả args rỗng nhưng nhét param vào top-level
            if not tc.args:
                extra = {
                    k: v
                    for k, v in parsed.items()
                    if k not in ("tool", "args", "confidence", "note")
                }
                if extra:
                    tc.args = extra
            return tc
    except Exception as e:
        logger.warning(
            f"FUNCTION_CALL_FAILED ({type(e).__name__}): {e} — fallback to text JSON"
        )

    # ── Bước 2: Text JSON (model không hỗ trợ tool_calls) ────────────────────
    try:
        data2 = _openrouter_request(
            {
                "model": model,
                "messages": messages
                + [
                    {
                        "role": "system",
                        "content": (
                            "Trả về DUY NHẤT 1 JSON object hợp lệ, không thêm text:\n"
                            '{"tool": "<tên tool>", "args": {<tham số>}, "confidence": <0-1>, "note": "<nếu có>"}'
                        ),
                    }
                ],
                "temperature": 0,
            },
            cancel_check=cancel_check,
        )
        raw_text = data2["choices"][0]["message"]["content"]
        cleaned = _extract_json(raw_text)
        logger.info(f"TEXT_JSON: {cleaned}")
        tc2 = ToolCall.model_validate_json(cleaned)
        if not tc2.args:
            raw_dict = json.loads(cleaned)
            extra = {
                k: v
                for k, v in raw_dict.items()
                if k not in ("tool", "args", "confidence", "note")
            }
            if extra:
                tc2.args = extra
        return tc2
    except Exception as e:
        logger.error(
            f"TEXT_JSON_FAILED ({type(e).__name__}): {e} — returning ask_clarify"
        )

    # ── Bước 3: Cuối cùng trả ask_clarify, không raise ───────────────────────
    return _FALLBACK_CLARIFY
