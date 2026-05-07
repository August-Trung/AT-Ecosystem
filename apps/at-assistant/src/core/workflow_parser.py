from __future__ import annotations

import re
from copy import deepcopy
from typing import Any

from src.core import executor


KNOWN_URLS = {
    "facebook": "https://facebook.com",
    "youtube": "https://youtube.com",
    "gmail": "https://mail.google.com",
    "google": "https://google.com",
    "chatgpt": "https://chatgpt.com",
    "zalo": "https://chat.zalo.me",
}

CREATE_PATTERNS = [
    r"^(?:tạo|tao|tạo mới|tao moi|create)\s+(?:workflow|quy trình|quy trinh)\s+(.+)$",
]

SAVE_WORKFLOW_HINTS = {"lưu", "luu", "lưu lại", "luu lai", "lưu workflow", "luu workflow", "save", "ok lưu", "ok luu"}
CANCEL_WORKFLOW_HINTS = {"hủy", "huy", "thôi", "thoi", "cancel", "bỏ", "bo"}
SHOW_WORKFLOW_HINTS = {"xem lại", "xem workflow", "show draft", "xem draft"}


def looks_like_create_workflow_request(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    return any(re.search(pattern, raw, re.IGNORECASE) for pattern in CREATE_PATTERNS)


def parse_create_workflow_request(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Thiếu nội dung tạo workflow.")

    body = ""
    for pattern in CREATE_PATTERNS:
        match = re.search(pattern, raw, re.IGNORECASE)
        if match:
            body = match.group(1).strip()
            break
    if not body:
        raise ValueError("Không đọc được yêu cầu tạo workflow.")

    name, description, steps_text = _extract_name_description_and_steps(body)
    if not name:
        raise ValueError("Mình chưa đọc được tên workflow.")
    steps = parse_steps_text(steps_text)
    if not steps:
        raise ValueError("Mình chưa đọc được bước nào trong workflow.")

    return {
        "mode": "create",
        "workflow_id": "",
        "name": name,
        "description": description,
        "enabled": True,
        "continue_on_error": False,
        "steps": steps,
    }


def parse_steps_text(text: str) -> list[dict[str, Any]]:
    clauses = split_step_clauses(text)
    steps: list[dict[str, Any]] = []
    for clause in clauses:
        step = parse_step_clause(clause)
        if step:
            steps.append(step)
    return steps


def split_step_clauses(text: str) -> list[str]:
    normalized = " ".join((text or "").replace("\n", ", ").split()).strip(" ,;")
    if not normalized:
        return []
    replaced = re.sub(r"\s+(?:rồi|roi|sau đó|sau do|tiếp theo|tiep theo)\s+", ", ", normalized, flags=re.IGNORECASE)
    replaced = re.sub(r"\s+và\s+(?=(?:mở|mo|open|chờ|cho|đợi|doi|wait)\b)", ", ", replaced, flags=re.IGNORECASE)
    parts = [part.strip(" ,;") for part in re.split(r"\s*,\s*|\s*;\s*", replaced) if part.strip(" ,;")]
    return parts


def parse_step_clause(clause: str) -> dict[str, Any] | None:
    raw = (clause or "").strip()
    lowered = raw.lower()
    if not raw:
        return None

    wait_match = re.search(r"(?:chờ|cho|đợi|doi|wait)\s+(\d+(?:[.,]\d+)?)\s*(?:giây|giay|s|seconds?|sec)?", lowered, re.IGNORECASE)
    if wait_match:
        seconds = float(wait_match.group(1).replace(",", "."))
        return {"type": "wait", "params": {"seconds": seconds}}

    explicit_url = re.search(r"(https?://\S+)", raw, re.IGNORECASE)
    if explicit_url:
        return {"type": "open_url", "params": {"url": explicit_url.group(1).strip().rstrip(".,;"), "browser": _extract_browser(lowered)}}

    domain_match = re.search(r"\b([a-z0-9-]+\.[a-z]{2,}(?:/[^\s,;]*)?)\b", lowered, re.IGNORECASE)
    if domain_match:
        url = domain_match.group(1)
        if not url.startswith("http"):
            url = "https://" + url
        return {"type": "open_url", "params": {"url": url, "browser": _extract_browser(lowered)}}

    for keyword, url in KNOWN_URLS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", lowered):
            return {"type": "open_url", "params": {"url": url, "browser": _extract_browser(lowered)}}

    path_match = re.search(r"([A-Za-z]:\\[^\n\r,;]+)", raw)
    if path_match:
        return {"type": "open_file", "params": {"path": path_match.group(1).strip().strip("\"'")}}

    file_match = re.search(r"(?:mở|mo|open)\s+(?:file|tệp|tep|tập tin|tai lieu|tài liệu)\s+(.+)$", raw, re.IGNORECASE)
    if file_match:
        return {"type": "open_file", "params": {"path": file_match.group(1).strip().strip("\"'")}}

    cleaned = re.sub(r"^(?:mở|mo|open)\s+", "", lowered, flags=re.IGNORECASE).strip()
    app_key, remainder = executor.extract_app_and_remainder(cleaned)
    if app_key and not remainder:
        return {"type": "open_app", "params": {"app_name": app_key}}
    if cleaned:
        return {"type": "open_app", "params": {"app_name": cleaned}}
    return None


def apply_workflow_draft_command(draft: dict[str, Any], text: str) -> tuple[str, dict[str, Any], str]:
    updated = deepcopy(draft)
    raw = (text or "").strip()
    normalized = " ".join(raw.lower().split())
    if not raw:
        return "noop", updated, ""

    if normalized in SAVE_WORKFLOW_HINTS:
        return "save", updated, ""
    if normalized in CANCEL_WORKFLOW_HINTS:
        return "cancel", updated, ""
    if normalized in SHOW_WORKFLOW_HINTS:
        return "show", updated, ""

    rename_match = re.search(r"(?:đổi tên|doi ten|rename)\s+(?:thành|thanh|là|la)?\s+(.+)$", raw, re.IGNORECASE)
    if rename_match:
        updated["name"] = rename_match.group(1).strip().strip("\"'")
        return "updated", updated, "Đã cập nhật tên workflow."

    desc_match = re.search(r"(?:mô tả|mo ta|description)\s+(?:là|la|:)?\s+(.+)$", raw, re.IGNORECASE)
    if desc_match:
        updated["description"] = desc_match.group(1).strip().strip("\"'")
        return "updated", updated, "Đã cập nhật mô tả workflow."

    if re.search(r"(?:bật|bat)\s+(?:continue on error|continue_on_error)", normalized):
        updated["continue_on_error"] = True
        return "updated", updated, "Đã bật continue_on_error."
    if re.search(r"(?:tắt|tat)\s+(?:continue on error|continue_on_error)", normalized):
        updated["continue_on_error"] = False
        return "updated", updated, "Đã tắt continue_on_error."
    if re.search(r"^(?:bật|bat)\s+workflow$", normalized):
        updated["enabled"] = True
        return "updated", updated, "Đã bật workflow."
    if re.search(r"^(?:tắt|tat)\s+workflow$", normalized):
        updated["enabled"] = False
        return "updated", updated, "Đã tắt workflow."

    delete_match = re.search(r"(?:xóa|xoa|delete|remove)\s+bước\s+(\d+)", raw, re.IGNORECASE)
    if delete_match:
        index = int(delete_match.group(1)) - 1
        if index < 0 or index >= len(updated.get("steps") or []):
            raise ValueError("Số bước cần xóa không hợp lệ.")
        removed = updated["steps"].pop(index)
        return "updated", updated, f"Đã xóa bước {index + 1}: {format_step(removed, index + 1)}"

    replace_match = re.search(r"(?:đổi|doi|sửa|sua|replace)\s+bước\s+(\d+)\s+(?:thành|thanh|là|la)\s+(.+)$", raw, re.IGNORECASE)
    if replace_match:
        index = int(replace_match.group(1)) - 1
        if index < 0 or index >= len(updated.get("steps") or []):
            raise ValueError("Số bước cần sửa không hợp lệ.")
        new_step = parse_step_clause(replace_match.group(2).strip())
        if not new_step:
            raise ValueError("Không đọc được nội dung bước mới.")
        updated["steps"][index] = new_step
        return "updated", updated, f"Đã cập nhật bước {index + 1}."

    insert_match = re.search(r"(?:thêm|them|add)\s+(.+?)\s+(?:sau bước|sau buoc)\s+(\d+)$", raw, re.IGNORECASE)
    if insert_match:
        step = parse_step_clause(insert_match.group(1).strip())
        if not step:
            raise ValueError("Không đọc được bước cần thêm.")
        index = int(insert_match.group(2)) 
        if index < 0 or index > len(updated.get("steps") or []):
            raise ValueError("Vị trí chèn bước không hợp lệ.")
        updated["steps"].insert(index, step)
        return "updated", updated, f"Đã thêm bước mới sau bước {index}."

    add_match = re.search(r"^(?:thêm|them|add)\s+(.+)$", raw, re.IGNORECASE)
    if add_match:
        step = parse_step_clause(add_match.group(1).strip())
        if not step:
            raise ValueError("Không đọc được bước cần thêm.")
        updated.setdefault("steps", []).append(step)
        return "updated", updated, "Đã thêm bước mới vào cuối workflow."

    if looks_like_create_workflow_request(raw):
        return "replace_draft", parse_create_workflow_request(raw), "Đã thay draft workflow theo câu mới."

    raise ValueError("Mình chưa hiểu lệnh chỉnh workflow. Bạn có thể nói: thêm..., xóa bước 2, đổi bước 1 thành..., đổi tên thành..., lưu lại.")


def format_workflow_draft(draft: dict[str, Any]) -> str:
    lines = [
        f"Tên workflow: {draft.get('name') or '(chưa có tên)'}",
        f"Mô tả: {draft.get('description') or '(chưa có mô tả)'}",
        f"Trạng thái: {'bật' if bool(draft.get('enabled', True)) else 'tắt'}",
        f"Continue on error: {'bật' if bool(draft.get('continue_on_error', False)) else 'tắt'}",
        "Các bước:",
    ]
    steps = draft.get("steps") or []
    if not steps:
        lines.append("(chưa có bước nào)")
    else:
        for index, step in enumerate(steps, start=1):
            lines.append(format_step(step, index))
    return "\n".join(lines)


def format_step(step: dict[str, Any], index: int) -> str:
    params = step.get("params") or {}
    step_type = str(step.get("type") or "")
    if step_type == "open_app":
        return f"{index}. Mở ứng dụng: {params.get('app_name') or ''}"
    if step_type == "open_url":
        browser = str(params.get("browser") or "default")
        suffix = "" if browser == "default" else f" bằng {browser}"
        return f"{index}. Mở URL{suffix}: {params.get('url') or ''}"
    if step_type == "open_file":
        return f"{index}. Mở file: {params.get('path') or ''}"
    if step_type == "wait":
        return f"{index}. Chờ {params.get('seconds', 0)} giây"
    return f"{index}. {step_type}"


def _extract_name_description_and_steps(body: str) -> tuple[str, str, str]:
    text = (body or "").strip()
    description = ""
    patterns = [
        r"^(.*?)\s+(?:gồm|gom|bao gồm|bao gom)\s+(.+)$",
        r"^(.*?):\s*(.+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name_part = match.group(1).strip()
            steps_part = match.group(2).strip()
            name, description = _split_name_and_description(name_part)
            return name, description, steps_part
    name, description = _split_name_and_description(text)
    return name, description, ""


def _split_name_and_description(text: str) -> tuple[str, str]:
    raw = (text or "").strip().strip("\"'")
    if not raw:
        return "", ""
    match = re.search(r"(.+?)\s+(?:mô tả|mo ta)\s+(.+)$", raw, re.IGNORECASE)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return raw, ""


def _extract_browser(text: str) -> str:
    lowered = (text or "").lower()
    if "edge" in lowered:
        return "edge"
    if "chrome" in lowered:
        return "chrome"
    return "default"
