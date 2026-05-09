from __future__ import annotations

import base64
import binascii
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import difflib
import hashlib
import hmac
import json
import math
import random
import re
import secrets
import string
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote, quote_plus, unquote, urlparse

import requests

from src.core.app_paths import ensure_app_data_dir
from src.core.result import ActionResult, ErrorCode


MAIL_TM_API = "https://api.mail.tm"
TELEGRAM_TEXT_LIMIT = 3500
ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
NANOID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-"
PASSWORD_SYMBOLS = "!@#$%^&*()_+~`|}{[]:;?><,./-="


VIET_BANKS = {
    "vcb": "970436",
    "vietcombank": "970436",
    "mb": "970422",
    "mbbank": "970422",
    "tcb": "970407",
    "techcombank": "970407",
    "acb": "970416",
    "bidv": "970418",
    "vietinbank": "970415",
    "vtb": "970415",
    "vpb": "970432",
    "vpbank": "970432",
    "tpb": "970423",
    "tpbank": "970423",
    "msb": "970426",
    "sacombank": "970403",
    "stb": "970403",
    "agribank": "970405",
    "shb": "970443",
    "hdbank": "970437",
    "ocb": "970448",
}


USER_AGENTS = {
    "windows": [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124.0.0.0 Safari/537.36",
    ],
    "mac": [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ],
    "ios": [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    ],
    "android": [
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    ],
}


STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "are",
    "was",
    "were",
    "you",
    "your",
    "have",
    "has",
    "had",
    "but",
    "not",
    "can",
    "will",
    "just",
    "into",
    "than",
    "then",
    "them",
    "they",
    "all",
    "any",
    "mot",
    "hai",
    "cac",
    "cho",
    "voi",
    "trong",
    "ngoai",
    "nhung",
    "khong",
}


def _telegram_runtime_dir() -> Path:
    return ensure_app_data_dir("telegram")


def _mmo_runtime_dir() -> Path:
    return ensure_app_data_dir("mmo_native")


def _temp_mail_state_path() -> Path:
    return _mmo_runtime_dir() / "tempmail.json"


def _clip(value: str, limit: int = TELEGRAM_TEXT_LIMIT) -> str:
    text = str(value or "")
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[trimmed]"


def _code(label: str, value: str) -> str:
    return f"{label}:\n```\n{_clip(value)}\n```"


def _raw(args: dict[str, Any]) -> str:
    return str(args.get("raw") or "").strip()


def _strip_noise(text: str, terms: list[str] | tuple[str, ...] = ()) -> str:
    cleaned = str(text or "")
    fenced = re.search(r"```(?:\w+)?\s*(.*?)```", cleaned, re.IGNORECASE | re.DOTALL)
    if fenced:
        return fenced.group(1).strip()
    colon = re.search(r":\s+", cleaned)
    if colon:
        prefix = cleaned[: colon.start()]
        if len(prefix) < 80 and "://" not in cleaned[: colon.end() + 3] and not any(ch in prefix for ch in "{[<"):
            cleaned = cleaned[colon.end() :]
    for phrase in (
        "trong mmo",
        "mmo tools",
        "at tools",
        "mmo",
        "tool",
        "cong cu",
        "giup toi",
        "dum toi",
        "nhe",
        "please",
    ):
        cleaned = re.sub(re.escape(phrase), " ", cleaned, flags=re.IGNORECASE)
    for term in sorted(terms, key=len, reverse=True):
        cleaned = re.sub(rf"(?<!\w){re.escape(term)}(?!\w)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _text_arg(args: dict[str, Any], terms: list[str] | tuple[str, ...] = ()) -> str:
    explicit = args.get("text") or args.get("data") or args.get("input")
    if explicit is not None:
        return str(explicit).strip()
    return _strip_noise(_raw(args), terms)


def _int_from_args(args: dict[str, Any], key: str, default: int, min_value: int, max_value: int) -> int:
    raw_value = args.get(key)
    if raw_value is None:
        match = re.search(rf"\b{re.escape(key)}\s*[:=]?\s*(\d+)\b", _raw(args), re.IGNORECASE)
        raw_value = match.group(1) if match else None
    if raw_value is None and key == "count":
        match = re.search(r"\b(\d{1,3})\b", _raw(args))
        raw_value = match.group(1) if match else None
    try:
        value = int(raw_value)
    except Exception:
        value = default
    return max(min_value, min(max_value, value))


def _split_pair(args: dict[str, Any], terms: list[str] | tuple[str, ...] = ()) -> tuple[str, str]:
    left = str(args.get("left") or args.get("a") or args.get("original") or "").strip()
    right = str(args.get("right") or args.get("b") or args.get("modified") or "").strip()
    if left or right:
        return left, right
    payload = _text_arg(args, terms)
    for sep in ("\n---\n", "\n===\n", "|||", "\n###\n"):
        if sep in payload:
            a, b = payload.split(sep, 1)
            return a.strip(), b.strip()
    return "", ""


def _load_temp_mail_state() -> dict[str, Any]:
    path = _temp_mail_state_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _save_temp_mail_state(data: dict[str, Any]) -> None:
    path = _temp_mail_state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _format_json_value(value: str, operation: str) -> str:
    parsed = json.loads(value)
    if operation == "parse_string":
        if not isinstance(parsed, str):
            raise ValueError("Input is not a JSON string.")
        nested = parsed.strip()
        if not nested.startswith(("{", "[")):
            raise ValueError("JSON string does not contain an object or array.")
        parsed = json.loads(nested)
    indent = None if operation == "minify" else 2
    return json.dumps(parsed, ensure_ascii=False, indent=indent)


def _format_xml(value: str) -> str:
    xml = re.sub(r"(>)(<)(/*)", r"\1\n\2\3", value.strip())
    pad = 0
    lines: list[str] = []
    for node in xml.splitlines():
        stripped = node.strip()
        if not stripped:
            continue
        if re.match(r"^</\w", stripped):
            pad = max(0, pad - 1)
        lines.append(("  " * pad) + stripped)
        if re.match(r"^<\w[^>]*[^/]>", stripped) and not re.match(r".+</\w[^>]*>$", stripped):
            pad += 1
    return "\n".join(lines)


def _handle_qr(args: dict[str, Any]) -> ActionResult:
    text = str(args.get("text") or args.get("data") or "").strip()
    if not text:
        text = _strip_noise(_raw(args), ("tao", "qr", "ma qr"))
    if not text:
        return ActionResult.need_clarify(
            "Ban muon tao QR cho noi dung gi?",
            "Gui vi du: tao qr https://example.com trong mmo",
            {"action_id": "mmo.openQrGenerator"},
        )

    try:
        url = (
            "https://api.qrserver.com/v1/create-qr-code/"
            f"?size=512x512&data={quote(text, safe='')}&color=000000&bgcolor=ffffff"
        )
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        path = _telegram_runtime_dir() / f"mmo_qr_{int(time.time() * 1000)}.png"
        path.write_bytes(response.content)
        return ActionResult.ok(
            f"Da tao QR cho:\n{text}",
            telegram_photo_path=str(path),
            qr_text=text,
        )
    except Exception as exc:
        return ActionResult.err(f"Khong tao duoc QR: {exc}", code=ErrorCode.UNKNOWN, qr_text=text)


def _handle_json(args: dict[str, Any]) -> ActionResult:
    text = str(args.get("text") or args.get("data") or "").strip()
    operation = str(args.get("operation") or "beautify").strip().lower()
    if operation not in {"beautify", "minify", "parse_string", "xml"}:
        operation = "beautify"

    if not text:
        text = _text_arg(args, ("format", "json", "xml", "minify", "beautify", "parse", "string"))
    if not text:
        return ActionResult.need_clarify(
            "Ban muon format JSON/XML nao?",
            'Gui vi du: format json {"a":1} trong mmo',
            {"action_id": "mmo.openJsonFormatter"},
        )

    try:
        formatted = _format_xml(text) if operation == "xml" else _format_json_value(text, operation)
    except Exception as exc:
        return ActionResult.err(f"JSON/XML khong hop le: {exc}", code=ErrorCode.UNKNOWN, input=text[:1000])

    title = {
        "beautify": "JSON da format",
        "minify": "JSON da minify",
        "parse_string": "JSON string da parse",
        "xml": "XML da format",
    }[operation]
    return ActionResult.ok(f"{title}:\n```json\n{_clip(formatted)}\n```", formatted=formatted, operation=operation)


def _random_mail_username() -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"at{int(time.time())}{suffix}"


def _get_mail_token(address: str, password: str) -> str:
    response = requests.post(f"{MAIL_TM_API}/token", json={"address": address, "password": password}, timeout=20)
    response.raise_for_status()
    payload = response.json()
    return str(payload.get("token") or "").strip()


def _create_mailbox() -> dict[str, Any]:
    domains_response = requests.get(f"{MAIL_TM_API}/domains", timeout=20)
    domains_response.raise_for_status()
    domains = domains_response.json().get("hydra:member") or []
    if not domains:
        raise RuntimeError("mail.tm has no available domains.")
    domain = str(domains[0].get("domain") or "").strip()
    if not domain:
        raise RuntimeError("mail.tm returned an empty domain.")

    password = "P" + "".join(random.choice(string.ascii_letters + string.digits) for _ in range(14)) + "!"
    address = f"{_random_mail_username()}@{domain}"
    account_response = requests.post(f"{MAIL_TM_API}/accounts", json={"address": address, "password": password}, timeout=20)
    account_response.raise_for_status()
    token = _get_mail_token(address, password)
    state = {"address": address, "password": password, "token": token, "created_at": time.time(), "last_messages": []}
    _save_temp_mail_state(state)
    return state


def _get_mailbox(force_new: bool = False) -> dict[str, Any]:
    state = {} if force_new else _load_temp_mail_state()
    address = str(state.get("address") or "").strip()
    password = str(state.get("password") or "").strip()
    if address and password:
        try:
            state["token"] = _get_mail_token(address, password)
            _save_temp_mail_state(state)
            return state
        except Exception:
            if not force_new:
                return _create_mailbox()
    return _create_mailbox()


def _fetch_messages(token: str) -> list[dict[str, Any]]:
    response = requests.get(f"{MAIL_TM_API}/messages?page=1", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    response.raise_for_status()
    raw_messages = response.json().get("hydra:member") or []
    messages: list[dict[str, Any]] = []
    for item in raw_messages:
        sender = item.get("from") if isinstance(item.get("from"), dict) else {}
        messages.append(
            {
                "id": str(item.get("id") or ""),
                "from": f"{sender.get('name') or ''} <{sender.get('address') or ''}>".strip(),
                "subject": str(item.get("subject") or "(No subject)"),
                "intro": str(item.get("intro") or ""),
                "date": str(item.get("createdAt") or ""),
                "seen": bool(item.get("seen")),
                "hasAttachments": bool(item.get("hasAttachments")),
            }
        )
    return messages


def _fetch_message_detail(token: str, message_id: str) -> dict[str, Any]:
    response = requests.get(f"{MAIL_TM_API}/messages/{message_id}", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    response.raise_for_status()
    data = response.json()
    sender = data.get("from") if isinstance(data.get("from"), dict) else {}
    return {
        "id": str(data.get("id") or ""),
        "from": f"{sender.get('name') or ''} <{sender.get('address') or ''}>".strip(),
        "subject": str(data.get("subject") or "(No subject)"),
        "date": str(data.get("createdAt") or ""),
        "body": str(data.get("text") or data.get("intro") or "No text content"),
        "attachments": data.get("attachments") or [],
    }


def _format_mailbox_result(state: dict[str, Any], messages: list[dict[str, Any]], created_new: bool) -> ActionResult:
    address = str(state.get("address") or "")
    state["last_messages"] = messages
    _save_temp_mail_state(state)

    lines = [
        ("Da tao email tam:" if created_new else "Email tam hien tai:"),
        address,
        "",
        "Mailbox nay do ATAssistant quan ly cho Telegram. Web TempMail dung session rieng nen co the khac.",
        "",
    ]
    if not messages:
        lines.append("Inbox hien chua co mail.")
    else:
        lines.append(f"Inbox co {len(messages)} mail:")
        for index, msg in enumerate(messages[:10], start=1):
            lines.append(f"{index}. {msg['subject']}")
            lines.append(f"   From: {msg['from']}")
            if msg.get("intro"):
                lines.append(f"   {msg['intro'][:160]}")

    command_buttons = [
        {"text": "Refresh inbox", "command": "mo temp mail"},
        {"text": "New address", "command": "tao temp mail moi"},
    ]
    for index, _msg in enumerate(messages[:6], start=1):
        command_buttons.append({"text": f"Read {index}", "command": f"doc temp mail so {index}"})

    return ActionResult.ok(
        "\n".join(lines).strip(),
        mailbox_address=address,
        messages=messages,
        telegram_command_buttons=command_buttons,
    )


def _handle_temp_mail(args: dict[str, Any]) -> ActionResult:
    operation = str(args.get("operation") or "inbox").strip().lower()
    try:
        if operation == "read":
            index = int(args.get("index") or 0)
            state = _get_mailbox(force_new=False)
            messages = list(state.get("last_messages") or [])
            if not messages:
                messages = _fetch_messages(str(state.get("token") or ""))
                state["last_messages"] = messages
                _save_temp_mail_state(state)
            if index < 1 or index > len(messages):
                return ActionResult.need_clarify(
                    "Chua chon duoc email can doc.",
                    "Gui: doc temp mail so 1",
                    {"action_id": "mmo.openTempMail"},
                )
            detail = _fetch_message_detail(str(state.get("token") or ""), str(messages[index - 1].get("id") or ""))
            return ActionResult.ok(
                "\n".join(
                    [
                        f"From: {detail['from']}",
                        f"Subject: {detail['subject']}",
                        f"Date: {detail['date']}",
                        "",
                        _clip(detail["body"].strip()),
                    ]
                ).strip(),
                message_id=detail["id"],
            )

        force_new = operation == "new"
        state = _get_mailbox(force_new=force_new)
        messages = _fetch_messages(str(state.get("token") or ""))
        return _format_mailbox_result(state, messages, created_new=force_new)
    except Exception as exc:
        return ActionResult.err(f"Khong xu ly duoc Temp Mail: {exc}", code=ErrorCode.UNKNOWN)


def _handle_hash(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    algo = str(args.get("algo") or args.get("algorithm") or "").lower()
    for candidate in ("md5", "sha1", "sha256", "sha384", "sha512"):
        if candidate in raw or candidate == algo:
            algo = candidate
            break
    algo = algo or "sha256"
    text = _text_arg(args, ("hash", "compute", "md5", "sha1", "sha256", "sha384", "sha512"))
    if not text:
        return ActionResult.need_clarify("Can text de bam hash.", "Vi du: hash sha256 hello trong mmo", {"action_id": "mmo.openHashTool"})
    digest = hashlib.new(algo.replace("sha", "sha"), text.encode("utf-8")).digest()
    hex_value = digest.hex()
    b64_value = base64.b64encode(digest).decode("ascii")
    return ActionResult.ok(
        f"{algo.upper()}:\nhex: {hex_value}\nbase64: {b64_value}",
        algorithm=algo,
        hex=hex_value,
        base64=b64_value,
    )


def _handle_text_tools(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    mode = str(args.get("mode") or "").lower()
    if not mode:
        mode = "hex" if "hex" in raw else "url" if "url" in raw or "uri" in raw else "base64"
    operation = str(args.get("operation") or args.get("action") or "").lower()
    if not operation:
        operation = "decode" if any(token in raw for token in ("decode", "giai ma", "unescape")) else "encode"
    text = _text_arg(args, ("base64", "url", "uri", "hex", "encode", "decode", "giai ma", "ma hoa"))
    if not text:
        return ActionResult.need_clarify("Can text de encode/decode.", "Vi du: base64 encode hello trong mmo", {"action_id": "mmo.openTextTools"})
    try:
        if mode == "base64":
            output = base64.b64encode(text.encode("utf-8")).decode("ascii") if operation == "encode" else base64.b64decode(text).decode("utf-8")
        elif mode == "url":
            output = quote(text, safe="") if operation == "encode" else unquote(text)
        elif mode == "hex":
            output = text.encode("utf-8").hex() if operation == "encode" else bytes.fromhex(re.sub(r"\s+", "", text)).decode("utf-8")
        else:
            raise ValueError("Unsupported mode")
    except Exception as exc:
        return ActionResult.err(f"Khong {operation} duoc {mode}: {exc}", code=ErrorCode.UNKNOWN)
    return ActionResult.ok(_code(f"{mode} {operation}", output), mode=mode, operation=operation, output=output)


def _outputs_for_date(date: datetime) -> dict[str, str]:
    if date.tzinfo is None:
        date = date.astimezone()
    millis = int(date.timestamp() * 1000)
    return {
        "iso": date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "local": date.astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"),
        "unixSeconds": str(millis // 1000),
        "unixMillis": str(millis),
    }


def _handle_timestamp(args: dict[str, Any]) -> ActionResult:
    text = _text_arg(args, ("timestamp", "unix", "epoch", "convert", "time"))
    try:
        if not text or text.lower() in {"now", "hien tai"}:
            date = datetime.now().astimezone()
        elif re.fullmatch(r"\d{13}", text):
            date = datetime.fromtimestamp(int(text) / 1000).astimezone()
        elif re.fullmatch(r"\d{10}", text):
            date = datetime.fromtimestamp(int(text)).astimezone()
        else:
            date = datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone()
    except Exception as exc:
        return ActionResult.err(f"Timestamp/date khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    result = _outputs_for_date(date)
    return ActionResult.ok(
        "\n".join(
            [
                f"ISO: {result['iso']}",
                f"Local: {result['local']}",
                f"Unix (s): {result['unixSeconds']}",
                f"Unix (ms): {result['unixMillis']}",
            ]
        ),
        **result,
    )


def _encode_ulid_time(ms: int) -> str:
    out = ""
    for _ in range(10):
        out = ULID_ALPHABET[ms % 32] + out
        ms //= 32
    return out


def _generate_ulid() -> str:
    random_part = "".join(ULID_ALPHABET[secrets.randbelow(32)] for _ in range(16))
    return _encode_ulid_time(int(time.time() * 1000)) + random_part


def _generate_nanoid(size: int = 21) -> str:
    return "".join(NANOID_ALPHABET[secrets.randbelow(len(NANOID_ALPHABET))] for _ in range(size))


def _handle_id(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    kind = str(args.get("kind") or "").lower()
    if not kind:
        kind = "ulid" if "ulid" in raw else "nanoid" if "nanoid" in raw else "uuid"
    count = _int_from_args(args, "count", 5, 1, 50)
    size = _int_from_args(args, "size", 21, 8, 64)
    if kind == "uuid":
        values = [str(uuid.uuid4()) for _ in range(count)]
    elif kind == "ulid":
        values = [_generate_ulid() for _ in range(count)]
    elif kind == "nanoid":
        values = [_generate_nanoid(size) for _ in range(count)]
    else:
        return ActionResult.err(f"Loai ID khong ho tro: {kind}", code=ErrorCode.UNKNOWN)
    output = "\n".join(values)
    return ActionResult.ok(_code(f"{kind} ({count})", output), kind=kind, values=values)


def _handle_password(args: dict[str, Any]) -> ActionResult:
    length = _int_from_args(args, "length", 16, 6, 128)
    raw = _raw(args).lower()
    if "khong ky tu" in raw or "no symbol" in raw:
        include_symbols = False
    else:
        include_symbols = bool(args.get("symbols", True))
    charset = string.ascii_lowercase + string.ascii_uppercase + string.digits
    if include_symbols:
        charset += PASSWORD_SYMBOLS
    password = "".join(secrets.choice(charset) for _ in range(length))
    return ActionResult.ok(f"Password ({length}):\n`{password}`", password=password, length=length)


def _handle_regex(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args)
    pattern = str(args.get("pattern") or "").strip()
    flags_raw = str(args.get("flags") or "").strip()
    text = str(args.get("text") or args.get("data") or "").strip()
    if not pattern:
        match = re.search(r"/(.+?)/([a-z]*)\s*(?:text|in|:)?\s*(.*)$", raw, re.IGNORECASE | re.DOTALL)
        if match:
            pattern, flags_raw, text = match.group(1), match.group(2), text or match.group(3).strip()
    if not pattern:
        match = re.search(r"pattern\s*[:=]\s*(.+?)\s+text\s*[:=]\s*(.+)$", raw, re.IGNORECASE | re.DOTALL)
        if match:
            pattern, text = match.group(1).strip(), match.group(2).strip()
    if not text:
        text = _strip_noise(raw, ("regex", "regexp", pattern, flags_raw, "text", "in"))
    if not pattern or not text:
        return ActionResult.need_clarify("Can pattern va text de test regex.", r"Vi du: regex /\d+/ text abc123 trong mmo", {"action_id": "mmo.openRegexTester"})
    flags = 0
    if "i" in flags_raw:
        flags |= re.IGNORECASE
    if "m" in flags_raw:
        flags |= re.MULTILINE
    try:
        matches = list(re.finditer(pattern, text, flags))[:50]
    except Exception as exc:
        return ActionResult.err(f"Regex khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    lines = [f"Matches: {len(matches)}"]
    for idx, match in enumerate(matches, start=1):
        lines.append(f"{idx}. {match.group(0)}")
        if match.groups():
            lines.extend(f"   group {gidx}: {group or '(empty)'}" for gidx, group in enumerate(match.groups(), start=1))
    return ActionResult.ok("\n".join(lines), matches=[m.group(0) for m in matches])


def _handle_extractor(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    extract_type = str(args.get("type") or "").lower()
    if not extract_type:
        extract_type = "proxy" if "proxy" in raw else "ip" if re.search(r"\bip\b", raw) else "email"
    text = _text_arg(args, ("extract", "tach", "email", "ip", "proxy", "list"))
    patterns = {
        "email": r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        "ip": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "proxy": r"\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b",
    }
    if extract_type not in patterns:
        extract_type = "email"
    values = list(dict.fromkeys(re.findall(patterns[extract_type], text)))
    output = "\n".join(values) if values else "No matches found."
    return ActionResult.ok(_code(f"{extract_type} extracted ({len(values)})", output), values=values, type=extract_type)


def _trim_trailing_comma(value: str) -> str:
    return re.sub(r",+$", "", value).strip()


def _parse_inline_pair(line: str) -> tuple[str, str] | None:
    match = re.match(r"^([^:]+?)\s*:\s*(.*)$", line)
    if not match:
        return None
    return _trim_trailing_comma(match.group(1)), _trim_trailing_comma(match.group(2))


def _parse_value(value: str) -> Any:
    trimmed = value.strip()
    if trimmed == "null":
        return None
    if trimmed == "true":
        return True
    if trimmed == "false":
        return False
    if re.fullmatch(r"-?\d+(?:\.\d+)?", trimmed):
        return float(trimmed) if "." in trimmed else int(trimmed)
    if len(trimmed) >= 2 and trimmed[0] == trimmed[-1] and trimmed[0] in {"'", '"'}:
        return trimmed[1:-1]
    return trimmed


def _kv_lines(raw: str) -> list[str]:
    return [line.strip() for line in raw.splitlines() if line.strip()]


def _transform_kv_lines(raw: str) -> str:
    lines = _kv_lines(raw)
    result: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line == ":":
            i += 1
            continue
        inline = _parse_inline_pair(line)
        if inline:
            key, value = inline
            if value:
                result.append(f"{key}: {value}".strip())
                i += 1
                continue
            nxt = lines[i + 2] if i + 1 < len(lines) and lines[i + 1] == ":" and i + 2 < len(lines) else lines[i + 1] if i + 1 < len(lines) else None
            if nxt is not None:
                result.append(f"{key}: {_trim_trailing_comma(nxt)}".strip())
                i += 3 if i + 1 < len(lines) and lines[i + 1] == ":" else 2
                continue
        if i + 1 < len(lines) and lines[i + 1] == ":" and i + 2 < len(lines):
            result.append(f"{_trim_trailing_comma(line)}: {_trim_trailing_comma(lines[i + 2])}".strip())
            i += 3
            continue
        if i + 1 < len(lines) and lines[i + 1] != ":":
            result.append(f"{_trim_trailing_comma(line)}: {_trim_trailing_comma(lines[i + 1])}".strip())
            i += 2
            continue
        result.append(_trim_trailing_comma(line))
        i += 1
    return "\n".join(result)


def _kv_to_object(raw: str) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for line in _transform_kv_lines(raw).splitlines():
        pair = _parse_inline_pair(line)
        if pair:
            output[pair[0]] = _parse_value(pair[1])
    return output


def _handle_kv(args: dict[str, Any]) -> ActionResult:
    raw = _text_arg(args, ("key", "value", "kv", "line", "format", "json"))
    if not raw:
        return ActionResult.need_clarify("Can du lieu key/value.", "Vi du: key value name\\n:\\nAT trong mmo", {"action_id": "mmo.openKeyValueFormatter"})
    operation = str(args.get("operation") or "").lower()
    if not operation:
        operation = "json" if "json" in _raw(args).lower() else "transform"
    try:
        output = json.dumps(_kv_to_object(raw), ensure_ascii=False, indent=2) if operation == "json" else _transform_kv_lines(raw)
    except Exception as exc:
        return ActionResult.err(f"Khong format duoc key/value: {exc}", code=ErrorCode.UNKNOWN)
    return ActionResult.ok(_code("Key/value output", output), output=output)


def _handle_diff(args: dict[str, Any]) -> ActionResult:
    left, right = _split_pair(args, ("diff", "compare", "text", "so sanh"))
    if not left and not right:
        return ActionResult.need_clarify("Can 2 doan text, ngan cach bang |||.", "Vi du: diff foo ||| foo bar trong mmo", {"action_id": "mmo.openDiffChecker"})
    diff = "\n".join(difflib.unified_diff(left.splitlines(), right.splitlines(), fromfile="A", tofile="B", lineterm=""))
    if not diff:
        diff = "No differences found."
    return ActionResult.ok(_code("Diff", diff), diff=diff)


def _diff_json(a: Any, b: Any, path: str = "$") -> list[dict[str, Any]]:
    diffs: list[dict[str, Any]] = []
    if a == b:
        return diffs
    if isinstance(a, dict) and isinstance(b, dict):
        for key in sorted(set(a.keys()) | set(b.keys())):
            next_path = f"{path}.{key}"
            if key not in a:
                diffs.append({"path": next_path, "type": "added", "after": b[key]})
            elif key not in b:
                diffs.append({"path": next_path, "type": "removed", "before": a[key]})
            else:
                diffs.extend(_diff_json(a[key], b[key], next_path))
        return diffs
    if isinstance(a, list) and isinstance(b, list):
        for idx in range(max(len(a), len(b))):
            next_path = f"{path}[{idx}]"
            if idx >= len(a):
                diffs.append({"path": next_path, "type": "added", "after": b[idx]})
            elif idx >= len(b):
                diffs.append({"path": next_path, "type": "removed", "before": a[idx]})
            else:
                diffs.extend(_diff_json(a[idx], b[idx], next_path))
        return diffs
    return [{"path": path, "type": "changed", "before": a, "after": b}]


def _handle_json_diff(args: dict[str, Any]) -> ActionResult:
    left, right = _split_pair(args, ("json diff", "compare json", "json", "diff", "so sanh"))
    if not left or not right:
        return ActionResult.need_clarify("Can 2 JSON, ngan cach bang |||.", 'Vi du: json diff {"a":1} ||| {"a":2} trong mmo', {"action_id": "mmo.openJsonDiff"})
    try:
        diffs = _diff_json(json.loads(left), json.loads(right))
    except Exception as exc:
        return ActionResult.err(f"JSON khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    if not diffs:
        return ActionResult.ok("JSON giong nhau. Khong co khac biet.", diffs=[])
    lines = [f"Differences: {len(diffs)}"]
    for item in diffs[:30]:
        lines.append(f"- {item['path']} {item['type']}")
        if "before" in item:
            lines.append(f"  before: {json.dumps(item['before'], ensure_ascii=False)}")
        if "after" in item:
            lines.append(f"  after: {json.dumps(item['after'], ensure_ascii=False)}")
    return ActionResult.ok("\n".join(lines), diffs=diffs)


def _to_yaml(obj: Any, indent: int = 0) -> str:
    pad = "  " * indent
    if isinstance(obj, list):
        return "\n".join(f"{pad}- {_to_yaml(item, indent + 1).lstrip()}" for item in obj)
    if isinstance(obj, dict):
        lines = []
        for key, value in obj.items():
            if isinstance(value, (dict, list)):
                lines.append(f"{pad}{key}:\n{_to_yaml(value, indent + 1)}")
            else:
                lines.append(f"{pad}{key}: {value}")
        return "\n".join(lines)
    return f"{pad}{obj}"


def _parse_yaml_basic(input_text: str) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-1, root)]
    for raw in input_text.splitlines():
        if not raw.strip() or raw.strip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.strip()
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        current = stack[-1][1]
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value == "":
            current[key] = {}
            stack.append((indent, current[key]))
        else:
            current[key] = _parse_value(value)
    return root


def _handle_yaml_json(args: dict[str, Any]) -> ActionResult:
    raw_lower = _raw(args).lower()
    text = _text_arg(args, ("yaml", "json", "convert", "to"))
    if not text:
        return ActionResult.need_clarify("Can YAML hoac JSON de chuyen doi.", "Vi du: yaml-json name: AT trong mmo", {"action_id": "mmo.openYamlJson"})
    try:
        if "json-yaml" in raw_lower or "to yaml" in raw_lower:
            output = _to_yaml(json.loads(text))
            mode = "json-yaml"
        elif text.lstrip().startswith(("{", "[")):
            output = _to_yaml(json.loads(text))
            mode = "json-yaml"
        else:
            output = json.dumps(_parse_yaml_basic(text), ensure_ascii=False, indent=2)
            mode = "yaml-json"
    except Exception as exc:
        return ActionResult.err(f"YAML/JSON khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    return ActionResult.ok(_code(mode, output), mode=mode, output=output)


SQL_KEYWORDS = [
    "SELECT",
    "FROM",
    "WHERE",
    "GROUP BY",
    "ORDER BY",
    "HAVING",
    "LIMIT",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "LEFT JOIN",
    "RIGHT JOIN",
    "INNER JOIN",
    "OUTER JOIN",
    "JOIN",
    "ON",
    "AND",
    "OR",
]


def _format_sql(input_text: str) -> str:
    sql = re.sub(r"\s+", " ", input_text).strip()
    if not sql:
        return ""
    for kw in SQL_KEYWORDS:
        kw_pattern = kw.replace(" ", r"\s+")
        pattern = re.compile(rf"\b{kw_pattern}\b", re.IGNORECASE)
        sql = pattern.sub(kw, sql)
    newline_before = [
        "SELECT",
        "FROM",
        "WHERE",
        "GROUP BY",
        "ORDER BY",
        "HAVING",
        "LIMIT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "VALUES",
        "SET",
        "LEFT JOIN",
        "RIGHT JOIN",
        "INNER JOIN",
        "OUTER JOIN",
        "JOIN",
        "ON",
    ]
    for kw in newline_before:
        kw_pattern = kw.replace(" ", r"\s+")
        sql = re.sub(rf"\s*{kw_pattern}\s*", f"\n{kw} ", sql)
    sql = re.sub(r"\s+(AND|OR)\s+", r"\n  \1 ", sql)
    sql = re.sub(r",\s*", ", ", sql)
    return sql.strip()


def _handle_sql(args: dict[str, Any]) -> ActionResult:
    text = _text_arg(args, ("sql", "format", "dinh dang"))
    if not text:
        return ActionResult.need_clarify("Can SQL de format.", "Vi du: format sql SELECT * FROM users WHERE id=1 trong mmo", {"action_id": "mmo.openSqlFormatter"})
    output = _format_sql(text)
    return ActionResult.ok(_code("SQL formatted", output), formatted=output)


def _count_syllables(word: str) -> int:
    cleaned = re.sub(r"[^a-z]", "", word.lower())
    if not cleaned:
        return 0
    matches = re.findall(r"[aeiouy]+", cleaned)
    return len(matches) if matches else 1


def _readability_stats(text: str) -> dict[str, int]:
    stripped = text.strip()
    words = len(stripped.split()) if stripped else 0
    chars = len(text)
    sentences = len(re.findall(r"[.!?]+", stripped)) or (1 if stripped else 0)
    syllables = sum(_count_syllables(word) for word in stripped.split()) if stripped else 0
    flesch = round(206.835 - 1.015 * (words / max(sentences, 1)) - 84.6 * (syllables / max(words, 1))) if words else 0
    reading_time = math.ceil(words / 200) if words else 0
    return {"words": words, "chars": chars, "sentences": sentences, "syllables": syllables, "flesch": flesch, "readingTime": reading_time}


def _handle_readability(args: dict[str, Any]) -> ActionResult:
    text = _text_arg(args, ("readability", "word count", "dem tu"))
    if not text:
        return ActionResult.need_clarify("Can van ban de phan tich.", "Vi du: readability Noi dung... trong mmo", {"action_id": "mmo.openReadability"})
    stats = _readability_stats(text)
    return ActionResult.ok(
        "\n".join(
            [
                f"Words: {stats['words']}",
                f"Characters: {stats['chars']}",
                f"Sentences: {stats['sentences']}",
                f"Syllables: {stats['syllables']}",
                f"Flesch score: {stats['flesch']}",
                f"Reading time: {stats['readingTime']} min",
            ]
        ),
        **stats,
    )


def _handle_keywords(args: dict[str, Any]) -> ActionResult:
    count = _int_from_args(args, "count", 10, 3, 50)
    text = _text_arg(args, ("keyword", "keywords", "top", "tu khoa"))
    if not text:
        return ActionResult.need_clarify("Can van ban de tach keyword.", "Vi du: keyword top 5 noi dung... trong mmo", {"action_id": "mmo.openKeywordExtractor"})
    tokens = [token.lower() for token in re.findall(r"[\w]+", text, re.UNICODE) if len(token) > 2 and token.lower() not in STOPWORDS]
    freq: dict[str, int] = {}
    for token in tokens:
        freq[token] = freq.get(token, 0) + 1
    items = sorted(freq.items(), key=lambda item: item[1], reverse=True)[:count]
    lines = [f"{word}: {amount}" for word, amount in items] or ["No keywords."]
    return ActionResult.ok("Top keywords:\n" + "\n".join(lines), keywords=items)


def _grams(text: str, size: int = 3) -> set[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    joined = " ".join(cleaned.split())
    return {joined[i : i + size] for i in range(0, max(0, len(joined) - size + 1))}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _handle_similarity(args: dict[str, Any]) -> ActionResult:
    left, right = _split_pair(args, ("similarity", "jaccard", "tuong dong"))
    if not left or not right:
        return ActionResult.need_clarify("Can 2 doan text, ngan cach bang |||.", "Vi du: similarity foo ||| foo bar trong mmo", {"action_id": "mmo.openSimilarityChecker"})
    score = round(_jaccard(_grams(left), _grams(right)) * 100)
    return ActionResult.ok(f"Jaccard similarity (3-grams): {score}%", score=score)


UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE)


def _handle_uuid(args: dict[str, Any]) -> ActionResult:
    text = _text_arg(args, ("uuid", "check", "validate", "kiem tra"))
    is_valid = bool(UUID_RE.fullmatch(text))
    if not is_valid:
        return ActionResult.ok(f"Invalid UUID: {text}", valid=False)
    return ActionResult.ok(f"Valid UUID\nVersion: v{text[14]}\nVariant: {text[19]}", valid=True, version=text[14], variant=text[19])


def _b64url_decode(value: str) -> bytes:
    padded = value.replace("-", "+").replace("_", "/")
    padded += "=" * ((4 - len(padded) % 4) % 4)
    return base64.b64decode(padded)


def _b64url_encode(raw_bytes: bytes) -> str:
    return base64.urlsafe_b64encode(raw_bytes).decode("ascii").rstrip("=")


def _handle_jwt(args: dict[str, Any]) -> ActionResult:
    token = str(args.get("token") or "").strip() or _text_arg(args, ("jwt", "decode", "verify", "token"))
    secret = str(args.get("secret") or "").strip()
    if not token or token.count(".") < 1:
        return ActionResult.need_clarify("Can JWT token.", "Vi du: decode jwt <token> trong mmo", {"action_id": "mmo.openJwtTool"})
    try:
        parts = token.split(".")
        header = json.loads(_b64url_decode(parts[0]).decode("utf-8"))
        payload = json.loads(_b64url_decode(parts[1]).decode("utf-8"))
        status = "Decoded"
        if secret and len(parts) == 3 and header.get("alg") == "HS256":
            signed = f"{parts[0]}.{parts[1]}".encode("ascii")
            expected = _b64url_encode(hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).digest())
            status = "Signature valid" if hmac.compare_digest(expected, parts[2]) else "Signature mismatch"
    except Exception as exc:
        return ActionResult.err(f"JWT khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    output = f"{status}\nHeader:\n{json.dumps(header, ensure_ascii=False, indent=2)}\nPayload:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    return ActionResult.ok(_clip(output), header=header, payload=payload, jwt_status=status)


def _schema_type(value: Any) -> str:
    if isinstance(value, list):
        return "array"
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int) and not isinstance(value, bool):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, dict):
        return "object"
    return "string"


def _type_matches(schema_type: Any, value: Any) -> bool:
    if not schema_type:
        return True
    actual = _schema_type(value)
    if actual == "integer" and schema_type == "number":
        return True
    if isinstance(schema_type, list):
        return actual in schema_type or ("number" in schema_type and actual == "integer")
    return schema_type == actual or (schema_type == "number" and actual == "integer")


def _validate_schema(schema: dict[str, Any], data: Any, path: str = "$") -> list[dict[str, str]]:
    errors: list[dict[str, str]] = []
    if not _type_matches(schema.get("type"), data):
        errors.append({"path": path, "message": f"Expected {schema.get('type')}, got {_schema_type(data)}"})
        return errors
    if "enum" in schema and data not in schema.get("enum", []):
        errors.append({"path": path, "message": "Value not in enum"})
    if schema.get("type") == "string" and isinstance(data, str):
        if schema.get("minLength") is not None and len(data) < int(schema["minLength"]):
            errors.append({"path": path, "message": f"Min length {schema['minLength']}"})
        if schema.get("maxLength") is not None and len(data) > int(schema["maxLength"]):
            errors.append({"path": path, "message": f"Max length {schema['maxLength']}"})
        if schema.get("pattern") and not re.search(str(schema["pattern"]), data):
            errors.append({"path": path, "message": f"Pattern {schema['pattern']} not matched"})
    if schema.get("type") in {"number", "integer"} and isinstance(data, (int, float)):
        if schema.get("minimum") is not None and data < schema["minimum"]:
            errors.append({"path": path, "message": f"Minimum {schema['minimum']}"})
        if schema.get("maximum") is not None and data > schema["maximum"]:
            errors.append({"path": path, "message": f"Maximum {schema['maximum']}"})
    if schema.get("type") == "object" and isinstance(data, dict):
        for key in schema.get("required") or []:
            if key not in data:
                errors.append({"path": f"{path}.{key}", "message": "Required property missing"})
        for key, child_schema in (schema.get("properties") or {}).items():
            if key in data and isinstance(child_schema, dict):
                errors.extend(_validate_schema(child_schema, data[key], f"{path}.{key}"))
    if schema.get("type") == "array" and isinstance(data, list) and isinstance(schema.get("items"), dict):
        for idx, item in enumerate(data):
            errors.extend(_validate_schema(schema["items"], item, f"{path}[{idx}]"))
    return errors


def _handle_json_schema(args: dict[str, Any]) -> ActionResult:
    schema_text = str(args.get("schema") or "").strip()
    data_text = str(args.get("data") or "").strip()
    if not schema_text or not data_text:
        schema_text, data_text = _split_pair(args, ("json schema", "schema validate", "schema", "validate"))
    if not schema_text or not data_text:
        return ActionResult.need_clarify("Can schema va data JSON, ngan cach bang |||.", 'Vi du: json schema {"type":"object"} ||| {} trong mmo', {"action_id": "mmo.openJsonSchemaValidator"})
    try:
        errors = _validate_schema(json.loads(schema_text), json.loads(data_text))
    except Exception as exc:
        return ActionResult.err(f"Schema/data khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    if not errors:
        return ActionResult.ok("JSON data hop le theo schema.", valid=True, errors=[])
    lines = [f"JSON schema co {len(errors)} loi:"]
    lines.extend(f"- {err['path']}: {err['message']}" for err in errors[:30])
    return ActionResult.ok("\n".join(lines), valid=False, errors=errors)


def _handle_canonical(args: dict[str, Any]) -> ActionResult:
    canonical = str(args.get("canonical") or args.get("url") or "").strip() or _text_arg(args, ("canonical", "hreflang"))
    hreflang = str(args.get("hreflang") or "").strip()
    if not canonical:
        return ActionResult.need_clarify("Can canonical URL.", "Vi du: canonical https://example.com/page trong mmo", {"action_id": "mmo.openCanonicalBuilder"})
    lines = [f'<link rel="canonical" href="{canonical}" />']
    for line in hreflang.splitlines():
        if "|" not in line:
            continue
        lang, url = [part.strip() for part in line.split("|", 1)]
        if lang and url:
            lines.append(f'<link rel="alternate" hreflang="{lang}" href="{url}" />')
    output = "\n".join(lines)
    return ActionResult.ok(_code("Canonical tags", output), tags=output)


def _handle_shortener(args: dict[str, Any]) -> ActionResult:
    url = str(args.get("url") or "").strip()
    if not url:
        match = re.search(r"https?://\S+|www\.\S+", _raw(args), re.IGNORECASE)
        url = match.group(0).strip() if match else _text_arg(args, ("shorten", "short url", "rut gon link", "rut gon url"))
    if url.startswith("www."):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ActionResult.need_clarify("Can URL hop le de rut gon.", "Vi du: shorten https://example.com trong mmo", {"action_id": "mmo.openUrlShortener"})
    provider = str(args.get("provider") or "tinyurl").lower()
    try:
        if provider in {"is.gd", "isgd"}:
            api = f"https://is.gd/create.php?format=simple&url={quote_plus(url)}"
        elif provider in {"v.gd", "vgd"}:
            api = f"https://v.gd/create.php?format=simple&url={quote_plus(url)}"
        else:
            provider = "tinyurl"
            api = f"https://tinyurl.com/api-create.php?url={quote_plus(url)}"
        response = requests.get(api, timeout=20)
        response.raise_for_status()
        short_url = response.text.strip()
        if not short_url.startswith("http"):
            raise RuntimeError(short_url)
    except Exception as exc:
        return ActionResult.err(f"Khong rut gon duoc URL: {exc}", code=ErrorCode.UNKNOWN, url=url)
    return ActionResult.ok(f"Short URL ({provider}):\n{short_url}", url=url, short_url=short_url, provider=provider)


def _handle_vietqr(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args)
    lowered = raw.lower()
    bank_code = str(args.get("bank") or "").lower()
    if not bank_code:
        for key in sorted(VIET_BANKS, key=len, reverse=True):
            if re.search(rf"(?<!\w){re.escape(key)}(?!\w)", lowered):
                bank_code = key
                break
    bank_bin = str(args.get("bank_bin") or VIET_BANKS.get(bank_code) or "").strip()
    account_no = str(args.get("account") or args.get("accountNo") or "").strip()
    if not account_no:
        numbers = re.findall(r"\b\d{6,20}\b", raw)
        account_no = numbers[0] if numbers else ""
    amount = str(args.get("amount") or "").strip()
    if not amount:
        numbers = re.findall(r"\b\d{4,15}\b", raw)
        amount = numbers[1] if len(numbers) > 1 else ""
    account_name = str(args.get("account_name") or args.get("accountName") or "").strip()
    content = str(args.get("content") or args.get("note") or "").strip()
    if not bank_bin or not account_no:
        return ActionResult.need_clarify(
            "Can bank code va so tai khoan de tao VietQR.",
            "Vi du: vietqr mb 0000865706803 100000 Donate AT trong mmo",
            {"action_id": "mmo.openVietQR"},
        )
    params = []
    if amount:
        params.append(("amount", amount))
    if content:
        params.append(("addInfo", content))
    if account_name:
        params.append(("accountName", account_name))
    query = "&".join(f"{key}={quote_plus(value)}" for key, value in params)
    url = f"https://img.vietqr.io/image/{bank_bin}-{account_no}-compact2.png" + (f"?{query}" if query else "")
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        path = _telegram_runtime_dir() / f"vietqr_{int(time.time() * 1000)}.png"
        path.write_bytes(response.content)
    except Exception as exc:
        return ActionResult.err(f"Khong tao duoc VietQR: {exc}", code=ErrorCode.UNKNOWN, url=url)
    return ActionResult.ok(
        f"VietQR: {bank_code or bank_bin} / {account_no}" + (f" / {amount} VND" if amount else ""),
        telegram_photo_path=str(path),
        url=url,
        bank_bin=bank_bin,
        account_no=account_no,
        amount=amount,
    )


def _handle_crypto(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    text = _text_arg(args, ("crypto", "convert", "eth", "gwei", "wei"))
    match = re.search(r"(-?\d+(?:\.\d+)?)", text or raw)
    if not match:
        return ActionResult.need_clarify("Can so ETH/Gwei/Wei de chuyen doi.", "Vi du: crypto 0.01 eth trong mmo", {"action_id": "mmo.openCryptoConverter"})
    try:
        value = Decimal(match.group(1))
    except InvalidOperation as exc:
        return ActionResult.err(f"So khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    unit = "wei" if re.search(r"\bwei\b", raw) and "gwei" not in raw else "gwei" if "gwei" in raw else "eth"
    if unit == "eth":
        eth = value
    elif unit == "gwei":
        eth = value / Decimal("1000000000")
    else:
        eth = value / Decimal("1000000000000000000")
    gwei = eth * Decimal("1000000000")
    wei = eth * Decimal("1000000000000000000")
    return ActionResult.ok(f"ETH: {eth}\nGwei: {gwei}\nWei: {wei:.0f}", eth=str(eth), gwei=str(gwei), wei=str(wei.quantize(Decimal('1'))))


def _handle_user_agent(args: dict[str, Any]) -> ActionResult:
    raw = _raw(args).lower()
    os_key = str(args.get("os") or "").lower()
    if not os_key:
        os_key = "android" if "android" in raw else "ios" if "ios" in raw or "iphone" in raw else "mac" if "mac" in raw else "windows"
    values = USER_AGENTS.get(os_key) or USER_AGENTS["windows"]
    ua = secrets.choice(values)
    return ActionResult.ok(f"User-Agent ({os_key}):\n{ua}", os=os_key, user_agent=ua)


def _parse_cron_field(field: str, min_value: int, max_value: int) -> set[int]:
    values: set[int] = set()
    for part in field.split(","):
        part = part.strip()
        if not part:
            continue
        step = 1
        if "/" in part:
            part, step_raw = part.split("/", 1)
            step = max(1, int(step_raw))
        if part == "*":
            start, end = min_value, max_value
        elif "-" in part:
            start_raw, end_raw = part.split("-", 1)
            start, end = int(start_raw), int(end_raw)
        else:
            start = end = int(part)
        for value in range(max(min_value, start), min(max_value, end) + 1, step):
            values.add(value)
    return values


def _handle_cron(args: dict[str, Any]) -> ActionResult:
    expr = str(args.get("expression") or "").strip() or _text_arg(args, ("cron", "crontab", "next"))
    if not expr:
        return ActionResult.need_clarify("Can cron expression.", "Vi du: cron */5 * * * * trong mmo", {"action_id": "mmo.openCronParser"})
    fields = expr.split()
    if len(fields) != 5:
        return ActionResult.err("Cron phai co 5 field: minute hour day month weekday.", code=ErrorCode.UNKNOWN)
    try:
        minutes = _parse_cron_field(fields[0], 0, 59)
        hours = _parse_cron_field(fields[1], 0, 23)
        dom = _parse_cron_field(fields[2], 1, 31)
        months = _parse_cron_field(fields[3], 1, 12)
        dow = _parse_cron_field(fields[4], 0, 7)
    except Exception as exc:
        return ActionResult.err(f"Cron khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    cursor = datetime.now().astimezone().replace(second=0, microsecond=0)
    hits: list[str] = []
    for _ in range(366 * 24 * 60):
        cursor = cursor.fromtimestamp(cursor.timestamp() + 60, cursor.tzinfo)
        weekday = cursor.weekday() + 1
        weekday_alt = 0 if weekday == 7 else weekday
        if (
            cursor.minute in minutes
            and cursor.hour in hours
            and cursor.day in dom
            and cursor.month in months
            and (weekday in dow or weekday_alt in dow)
        ):
            hits.append(cursor.strftime("%Y-%m-%d %H:%M"))
            if len(hits) >= 5:
                break
    return ActionResult.ok("Next cron runs:\n" + "\n".join(hits), expression=expr, next_runs=hits)


def _base32_decode(secret: str) -> bytes:
    cleaned = re.sub(r"\s+", "", secret).upper().replace("=", "")
    if not re.fullmatch(r"[A-Z2-7]+", cleaned):
        raise ValueError("Invalid base32 secret.")
    cleaned += "=" * ((8 - len(cleaned) % 8) % 8)
    return base64.b32decode(cleaned)


def _handle_totp(args: dict[str, Any]) -> ActionResult:
    secret = str(args.get("secret") or "").strip() or _text_arg(args, ("2fa", "totp", "code", "secret"))
    if not secret:
        return ActionResult.need_clarify("Can secret TOTP.", "Vi du: 2fa JBSWY3DPEHPK3PXP trong mmo", {"action_id": "mmo.openTwoFAGenerator"})
    try:
        key = _base32_decode(secret)
        counter = int(time.time() // 30)
        msg = counter.to_bytes(8, "big")
        digest = hmac.new(key, msg, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        binary = int.from_bytes(digest[offset : offset + 4], "big") & 0x7FFFFFFF
        code = str(binary % 1_000_000).zfill(6)
        remaining = 30 - (int(time.time()) % 30)
    except Exception as exc:
        return ActionResult.err(f"Secret TOTP khong hop le: {exc}", code=ErrorCode.UNKNOWN)
    return ActionResult.ok(f"2FA code: {code}\nCon lai: {remaining}s", code=code, remaining=remaining)


def handle_native_mmo_action(action_id: str, args: dict[str, Any] | None = None) -> ActionResult | None:
    action_id = (action_id or "").strip()
    payload = dict(args or {})
    handlers = {
        "mmo.openQrGenerator": _handle_qr,
        "mmo.openJsonFormatter": _handle_json,
        "mmo.openTempMail": _handle_temp_mail,
        "mmo.openHashTool": _handle_hash,
        "mmo.openTextTools": _handle_text_tools,
        "mmo.openTimestampTool": _handle_timestamp,
        "mmo.openIdGenerator": _handle_id,
        "mmo.openPasswordGenerator": _handle_password,
        "mmo.openRegexTester": _handle_regex,
        "mmo.openListExtractor": _handle_extractor,
        "mmo.openKeyValueFormatter": _handle_kv,
        "mmo.openDiffChecker": _handle_diff,
        "mmo.openJsonDiff": _handle_json_diff,
        "mmo.openYamlJson": _handle_yaml_json,
        "mmo.openSqlFormatter": _handle_sql,
        "mmo.openReadability": _handle_readability,
        "mmo.openKeywordExtractor": _handle_keywords,
        "mmo.openSimilarityChecker": _handle_similarity,
        "mmo.openUuidTool": _handle_uuid,
        "mmo.openJwtTool": _handle_jwt,
        "mmo.openJsonSchemaValidator": _handle_json_schema,
        "mmo.openCanonicalBuilder": _handle_canonical,
        "mmo.openUrlShortener": _handle_shortener,
        "mmo.openVietQR": _handle_vietqr,
        "mmo.openCryptoConverter": _handle_crypto,
        "mmo.openUserAgentGenerator": _handle_user_agent,
        "mmo.openCronParser": _handle_cron,
        "mmo.openTwoFAGenerator": _handle_totp,
    }
    handler = handlers.get(action_id)
    if not handler:
        return None
    return handler(payload)
