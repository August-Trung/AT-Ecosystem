from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import secrets
import socket
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlparse

from src.core.app_paths import ensure_app_data_dir
from src.core.engine import Engine
from src.core.result import ActionResult, ActionStatus, ErrorCode


DEFAULT_REMOTE_HOST = "0.0.0.0"
DEFAULT_REMOTE_PORT = 8765
PAIR_REQUEST_TTL_SECONDS = 10 * 60
MAX_COMMAND_LENGTH = 8000
MAX_IMAGE_EMBED_BYTES = 3 * 1024 * 1024


DEFAULT_MOBILE_REMOTE_SETTINGS: dict[str, Any] = {
    "enabled": False,
    "host": DEFAULT_REMOTE_HOST,
    "port": DEFAULT_REMOTE_PORT,
    "paired_devices": [],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _token_hash(token: str) -> str:
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def _public_device(device: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(device.get("id") or ""),
        "name": str(device.get("name") or ""),
        "approvedAt": str(device.get("approved_at") or ""),
        "lastSeen": str(device.get("last_seen") or ""),
    }


def _pair_identity(device_name: str, client_host: str) -> tuple[str, str]:
    return (str(device_name or "").strip().casefold(), str(client_host or "").strip())


def _request_response(request: "PairRequest", *, include_key: bool = False) -> dict[str, Any]:
    return {
        "ok": True,
        "requestId": request.id,
        **request.to_public(include_key=include_key),
    }


def _monorepo_root() -> Path | None:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "apps").is_dir() and (parent / "packages").is_dir():
            return parent
    return None


def _at_remote_dist_dir() -> Path | None:
    root = _monorepo_root()
    if not root:
        return None
    dist = root / "apps" / "at-remote" / "dist"
    return dist if dist.exists() else None


def lan_addresses() -> list[str]:
    values: list[str] = []

    def add(value: str) -> None:
        value = str(value or "").strip()
        if not value or value.startswith("127.") or value == "0.0.0.0":
            return
        if value not in values:
            values.append(value)

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            add(sock.getsockname()[0])
    except Exception:
        pass
    try:
        for value in socket.gethostbyname_ex(socket.gethostname())[2]:
            add(value)
    except Exception:
        pass
    if not values:
        values.append("127.0.0.1")
    return values


class MobileRemoteSettingsStore:
    def __init__(self) -> None:
        self._path = ensure_app_data_dir("settings") / "mobile_remote.json"

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> dict[str, Any]:
        data = dict(DEFAULT_MOBILE_REMOTE_SETTINGS)
        if self._path.exists():
            try:
                loaded = json.loads(self._path.read_text(encoding="utf-8"))
            except Exception:
                loaded = {}
            if isinstance(loaded, dict):
                for key in data:
                    if key in loaded:
                        data[key] = loaded[key]
        return self._normalize(data)

    def save(self, settings: dict[str, Any]) -> dict[str, Any]:
        data = dict(DEFAULT_MOBILE_REMOTE_SETTINGS)
        for key, value in (settings or {}).items():
            if key in data:
                data[key] = value
        data = self._normalize(data)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return data

    def _normalize(self, settings: dict[str, Any]) -> dict[str, Any]:
        data = dict(settings)
        data["enabled"] = bool(data.get("enabled", False))
        host = str(data.get("host") or DEFAULT_REMOTE_HOST).strip()
        data["host"] = host or DEFAULT_REMOTE_HOST
        try:
            port = int(data.get("port") or DEFAULT_REMOTE_PORT)
        except (TypeError, ValueError):
            port = DEFAULT_REMOTE_PORT
        data["port"] = max(1024, min(65535, port))

        devices: list[dict[str, Any]] = []
        for raw in list(data.get("paired_devices") or []):
            if not isinstance(raw, dict):
                continue
            device_id = str(raw.get("id") or "").strip()
            name = str(raw.get("name") or "").strip()
            key_hash = str(raw.get("key_hash") or "").strip()
            if not device_id or not name or not key_hash:
                continue
            devices.append(
                {
                    "id": device_id,
                    "name": name[:80],
                    "key_hash": key_hash,
                    "approved_at": str(raw.get("approved_at") or ""),
                    "last_seen": str(raw.get("last_seen") or ""),
                }
            )
        data["paired_devices"] = devices
        return data


@dataclass
class PairRequest:
    id: str
    device_name: str
    client_host: str
    created_at: float = field(default_factory=time.time)
    status: str = "pending"
    device_id: str = ""
    auth_key: str = ""
    message: str = ""

    def to_public(self, *, include_key: bool = False) -> dict[str, Any]:
        payload = {
            "id": self.id,
            "deviceName": self.device_name,
            "clientHost": self.client_host,
            "createdAt": datetime.fromtimestamp(self.created_at, timezone.utc).isoformat(),
            "status": self.status,
            "deviceId": self.device_id,
            "message": self.message,
        }
        if include_key and self.auth_key:
            payload["authKey"] = self.auth_key
        return payload


class _ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class MobileRemoteBridge:
    def __init__(
        self,
        engine: Engine | None = None,
        *,
        settings_store: MobileRemoteSettingsStore | None = None,
        on_event: Callable[[str, dict[str, Any]], None] | None = None,
    ) -> None:
        self.engine = engine or Engine()
        self.settings_store = settings_store or MobileRemoteSettingsStore()
        self.on_event = on_event
        self._settings = self.settings_store.load()
        self._pair_code = self._new_pair_code()
        self._pending: dict[str, PairRequest] = {}
        self._lock = threading.RLock()
        self._engine_lock = threading.Lock()
        self._server: _ReusableThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._bound_host = ""
        self._bound_port = 0

    @property
    def is_running(self) -> bool:
        return self._server is not None and self._thread is not None and self._thread.is_alive()

    @property
    def pair_code(self) -> str:
        return self._pair_code

    @property
    def port(self) -> int:
        return self._bound_port or int(self._settings.get("port") or DEFAULT_REMOTE_PORT)

    def start(self, *, host: str | None = None, port: int | None = None) -> None:
        with self._lock:
            if self.is_running:
                return
            self._settings = self.settings_store.load()
            bind_host = str(host or self._settings.get("host") or DEFAULT_REMOTE_HOST)
            bind_port = int(port if port is not None else self._settings.get("port") or DEFAULT_REMOTE_PORT)
            handler_cls = self._handler_class()
            server = _ReusableThreadingHTTPServer((bind_host, bind_port), handler_cls)
            self._server = server
            self._bound_host = bind_host
            self._bound_port = int(server.server_address[1])
            self._thread = threading.Thread(target=server.serve_forever, daemon=True)
            self._thread.start()
            self._settings["enabled"] = True
            self._settings["host"] = bind_host
            self._settings["port"] = self._bound_port
            self.settings_store.save(self._settings)
        self._emit("started", self.snapshot())

    def stop(self) -> None:
        with self._lock:
            server = self._server
            thread = self._thread
            self._server = None
            self._thread = None
            self._bound_host = ""
            self._bound_port = 0
            self._pending.clear()
            self._settings = self.settings_store.load()
            self._settings["enabled"] = False
            self.settings_store.save(self._settings)
        if server is not None:
            server.shutdown()
            server.server_close()
        if thread is not None:
            thread.join(timeout=2)
        self._emit("stopped", self.snapshot())

    def rotate_pair_code(self) -> str:
        with self._lock:
            self._pair_code = self._new_pair_code()
            self._pending.clear()
            return self._pair_code

    def urls(self) -> list[str]:
        return [f"http://{address}:{self.port}" for address in lan_addresses()]

    def pairing_urls(self) -> list[str]:
        return [f"{url}/?code={self._pair_code}" for url in self.urls()]

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            self._cleanup_pending_locked()
            return {
                "running": self.is_running,
                "host": self._bound_host or str(self._settings.get("host") or DEFAULT_REMOTE_HOST),
                "port": self.port,
                "pairCode": self._pair_code,
                "urls": self.urls(),
                "pairingUrls": self.pairing_urls(),
                "devices": [_public_device(item) for item in self._settings.get("paired_devices") or []],
                "pending": [item.to_public() for item in self._pending.values() if item.status == "pending"],
                "staticAppReady": _at_remote_dist_dir() is not None,
            }

    def request_pair(self, device_name: str, pair_code: str, client_host: str = "") -> dict[str, Any]:
        with self._lock:
            self._cleanup_pending_locked()
            if not self.is_running:
                return {"ok": False, "status": "offline", "message": "Máy tính chưa bật ATAssistant."}
            if not hmac.compare_digest(str(pair_code or "").strip(), self._pair_code):
                return {"ok": False, "status": "invalid_code", "message": "Mã kết nối không đúng."}
            name = str(device_name or "").strip()[:80] or "Điện thoại"
            client = str(client_host or "").strip()
            identity = _pair_identity(name, client)
            for request in self._pending.values():
                if _pair_identity(request.device_name, request.client_host) != identity:
                    continue
                if request.status == "pending":
                    return {
                        **_request_response(request),
                        "status": "pending",
                        "message": request.message or "Đang chờ xác nhận trên ATAssistant.",
                    }
                if request.status == "approved" and request.auth_key:
                    return {
                        **_request_response(request, include_key=True),
                        "status": "approved",
                        "message": request.message or "Đã kết nối.",
                    }
            request = PairRequest(
                id=secrets.token_urlsafe(12),
                device_name=name,
                client_host=client,
                message="Đang chờ xác nhận trên ATAssistant.",
            )
            self._pending[request.id] = request
        self._emit("pair_requested", request.to_public())
        return {
            **_request_response(request),
            "status": "pending",
            "message": "Đang chờ xác nhận trên ATAssistant.",
        }

    def pair_status(self, request_id: str) -> dict[str, Any]:
        with self._lock:
            self._cleanup_pending_locked()
            request = self._pending.get(str(request_id or "").strip())
            if not request:
                return {"ok": False, "status": "missing", "message": "Yêu cầu kết nối đã hết hạn."}
            return {"ok": True, **request.to_public(include_key=request.status == "approved")}

    def approve_pair_request(self, request_id: str) -> dict[str, Any]:
        with self._lock:
            self._cleanup_pending_locked()
            request = self._pending.get(str(request_id or "").strip())
            if not request or request.status != "pending":
                return {"ok": False, "message": "Không tìm thấy thiết bị đang chờ."}
            auth_key = secrets.token_urlsafe(32)
            device = {
                "id": secrets.token_urlsafe(10),
                "name": request.device_name,
                "key_hash": _token_hash(auth_key),
                "approved_at": _now_iso(),
                "last_seen": "",
            }
            self._settings = self.settings_store.load()
            devices = list(self._settings.get("paired_devices") or [])
            request_name = request.device_name.strip().casefold()
            devices = [
                item
                for item in devices
                if str(item.get("name") or "").strip().casefold() != request_name
            ]
            devices.append(device)
            self._settings["paired_devices"] = devices
            self.settings_store.save(self._settings)
            request.status = "approved"
            request.device_id = device["id"]
            request.auth_key = auth_key
            request.message = "Đã kết nối."
            identity = _pair_identity(request.device_name, request.client_host)
            for pending_id, pending in list(self._pending.items()):
                if pending_id == request_id:
                    continue
                if _pair_identity(pending.device_name, pending.client_host) == identity:
                    self._pending.pop(pending_id, None)
            public = _public_device(device)
        self._emit("pair_approved", public)
        return {"ok": True, "device": public}

    def reject_pair_request(self, request_id: str) -> dict[str, Any]:
        with self._lock:
            request = self._pending.get(str(request_id or "").strip())
            if not request or request.status != "pending":
                return {"ok": False, "message": "Không tìm thấy thiết bị đang chờ."}
            request.status = "rejected"
            request.message = "ATAssistant đã từ chối kết nối."
        self._emit("pair_rejected", request.to_public())
        return {"ok": True}

    def revoke_device(self, device_id: str) -> bool:
        with self._lock:
            self._settings = self.settings_store.load()
            before = list(self._settings.get("paired_devices") or [])
            after = [item for item in before if str(item.get("id") or "") != str(device_id or "")]
            if len(after) == len(before):
                return False
            self._settings["paired_devices"] = after
            self.settings_store.save(self._settings)
        self._emit("device_revoked", {"deviceId": device_id})
        return True

    def handle_command(self, auth_key: str, command: str) -> dict[str, Any]:
        device = self._authenticate(auth_key)
        if not device:
            return {
                "ok": False,
                "status": "unauthorized",
                "message": "Không kết nối được với máy tính.",
                "cards": [{"type": "error", "title": "Mất kết nối", "message": "Hãy kết nối lại với ATAssistant."}],
                "buttons": [{"label": "Thử lại", "command": "__retry__"}],
            }
        raw_text = str(command or "").strip()
        text = _strip_mobile_command_prefix(raw_text)
        if not text:
            return mobile_payload_from_result(ActionResult.err("Bạn chưa nhập yêu cầu.", code=ErrorCode.UNKNOWN))
        if len(text) > MAX_COMMAND_LENGTH:
            return mobile_payload_from_result(ActionResult.err("Yêu cầu quá dài.", code=ErrorCode.UNKNOWN))

        public_device = _public_device(device)
        self._emit(
            "command_received",
            {
                "device": public_device,
                "command": text,
                "displayCommand": raw_text or text,
            },
        )
        with self._engine_lock:
            try:
                result = self.engine.handle_turn(text, source="mobile")
            except TypeError:
                result = self.engine.handle_turn(text)
            except Exception as exc:
                result = ActionResult.err(f"Lỗi nội bộ: {exc}", code=ErrorCode.INTERNAL_ERROR)
        payload = mobile_payload_from_result(result)
        payload["device"] = public_device
        event_payload = {
            "device": public_device,
            "command": text,
            "displayCommand": raw_text or text,
            "status": payload.get("status"),
            "result": result,
            "payload": payload,
        }
        self._emit("command_result", event_payload)
        self._emit("command", event_payload)
        return payload

    def _authenticate(self, auth_key: str) -> dict[str, Any] | None:
        key_hash = _token_hash(str(auth_key or "").strip())
        if not key_hash:
            return None
        with self._lock:
            self._settings = self.settings_store.load()
            devices = list(self._settings.get("paired_devices") or [])
            matched: dict[str, Any] | None = None
            for item in devices:
                if hmac.compare_digest(str(item.get("key_hash") or ""), key_hash):
                    item["last_seen"] = _now_iso()
                    matched = item
                    break
            if matched:
                self._settings["paired_devices"] = devices
                self.settings_store.save(self._settings)
            return matched

    def _handler_class(self):
        bridge = self

        class MobileRemoteRequestHandler(SimpleHTTPRequestHandler):
            server_version = "ATRemote/0.1"

            def log_message(self, format: str, *args: Any) -> None:
                return

            def end_headers(self) -> None:
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-AT-Remote-Key")
                self.send_header("Cache-Control", "no-store")
                super().end_headers()

            def do_OPTIONS(self) -> None:
                self.send_response(HTTPStatus.NO_CONTENT)
                self.end_headers()

            def do_GET(self) -> None:
                parsed = urlparse(self.path)
                if parsed.path == "/api/health":
                    self._send_json(
                        {
                            "ok": True,
                            "name": "ATAssistant",
                            "status": "ready" if bridge.is_running else "offline",
                            **bridge.snapshot(),
                        }
                    )
                    return
                if parsed.path == "/api/pair/status":
                    query = parse_qs(parsed.query)
                    self._send_json(bridge.pair_status((query.get("requestId") or [""])[0]))
                    return
                if parsed.path.startswith("/api/"):
                    self._send_json({"ok": False, "message": "Not found"}, status=HTTPStatus.NOT_FOUND)
                    return
                self._serve_static(parsed.path)

            def do_POST(self) -> None:
                parsed = urlparse(self.path)
                if parsed.path == "/api/pair/request":
                    body = self._read_json()
                    self._send_json(
                        bridge.request_pair(
                            str(body.get("deviceName") or ""),
                            str(body.get("pairCode") or ""),
                            client_host=self.client_address[0] if self.client_address else "",
                        )
                    )
                    return
                if parsed.path == "/api/command":
                    body = self._read_json()
                    auth_key = self.headers.get("X-AT-Remote-Key") or ""
                    auth_header = self.headers.get("Authorization") or ""
                    if auth_header.lower().startswith("bearer "):
                        auth_key = auth_header[7:].strip()
                    self._send_json(bridge.handle_command(auth_key, str(body.get("command") or "")))
                    return
                self._send_json({"ok": False, "message": "Not found"}, status=HTTPStatus.NOT_FOUND)

            def _read_json(self) -> dict[str, Any]:
                try:
                    length = min(int(self.headers.get("Content-Length") or "0"), 1024 * 1024)
                except ValueError:
                    length = 0
                raw = self.rfile.read(length) if length else b"{}"
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except Exception:
                    payload = {}
                return payload if isinstance(payload, dict) else {}

            def _send_json(self, payload: dict[str, Any], *, status: HTTPStatus = HTTPStatus.OK) -> None:
                raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def _serve_static(self, request_path: str) -> None:
                root = _at_remote_dist_dir()
                if root is None:
                    self._send_json(
                        {
                            "ok": False,
                            "message": "AT Remote chưa được build. Chạy npm run build trong apps/at-remote.",
                        },
                        status=HTTPStatus.NOT_FOUND,
                    )
                    return
                safe_path = unquote(request_path or "/").lstrip("/")
                target = root / (safe_path or "index.html")
                try:
                    target = target.resolve()
                    root_resolved = root.resolve()
                except Exception:
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                if root_resolved not in target.parents and target != root_resolved:
                    self.send_error(HTTPStatus.NOT_FOUND)
                    return
                if not target.exists() or target.is_dir():
                    target = root / "index.html"
                content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
                raw = target.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(raw)))
                if target.name != "index.html":
                    self.send_header("Cache-Control", "public, max-age=3600")
                self.end_headers()
                self.wfile.write(raw)

        return MobileRemoteRequestHandler

    def _cleanup_pending_locked(self) -> None:
        now = time.time()
        for request_id, request in list(self._pending.items()):
            if now - request.created_at > PAIR_REQUEST_TTL_SECONDS:
                self._pending.pop(request_id, None)

    def _emit(self, event: str, payload: dict[str, Any]) -> None:
        if not self.on_event:
            return
        try:
            self.on_event(event, payload)
        except Exception:
            pass

    @staticmethod
    def _new_pair_code() -> str:
        return f"{secrets.randbelow(900000) + 100000}"


_MOBILE_TEXT_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("Ban muon tao QR cho noi dung gi?", "Bạn muốn tạo QR cho nội dung gì?"),
    ("Gui vi du: tao qr https://example.com trong mmo", "Gửi ví dụ: tạo qr https://example.com trong mmo"),
    ("Ban muon format JSON/XML nao?", "Bạn muốn format JSON/XML nào?"),
    ('Gui vi du: format json {"a":1} trong mmo', 'Gửi ví dụ: format json {"a":1} trong mmo'),
    ("Can van ban de phan tich.", "Cần văn bản để phân tích."),
    ("Vi du: readability Noi dung... trong mmo", "Ví dụ: readability Nội dung... trong mmo"),
    ("Da tao email tam:", "Đã tạo email tạm:"),
    ("Email tam hien tai:", "Email tạm hiện tại:"),
    (
        "Mailbox nay do ATAssistant quan ly cho Telegram. Web TempMail dung session rieng nen co the khac.",
        "Email tạm này do ATAssistant quản lý, giống luồng Telegram hiện tại.",
    ),
    ("Inbox hien chua co mail.", "Inbox hiện chưa có mail."),
    ("Inbox co ", "Inbox có "),
    ("Chua chon duoc email can doc.", "Chưa chọn được email cần đọc."),
    ("Khong tao duoc QR:", "Không tạo được QR:"),
    ("Da tao QR cho:", "Đã tạo QR cho:"),
    ("JSON/XML khong hop le:", "JSON/XML không hợp lệ:"),
    ("JSON da format", "JSON đã format"),
    ("JSON da minify", "JSON đã minify"),
    ("JSON string da parse", "JSON string đã parse"),
    ("XML da format", "XML đã format"),
)


def _mobile_text(value: Any) -> str:
    text = str(value or "")
    for before, after in _MOBILE_TEXT_REPLACEMENTS:
        text = text.replace(before, after)
    return text


def _strip_mobile_command_prefix(command: str) -> str:
    text = str(command or "").strip()
    if text.casefold().startswith("/at"):
        return text[3:].strip()
    return text


def _mobile_command_text(command: str) -> str:
    text = str(command or "").strip()
    lowered = text.casefold()
    if lowered == "mo temp mail":
        return "mở temp mail"
    if lowered == "tao temp mail moi":
        return "tạo temp mail mới"
    if lowered.startswith("doc temp mail so "):
        return "đọc temp mail số " + text[len("doc temp mail so ") :].strip()
    return _mobile_text(text)


def _mobile_button_label(label: str) -> str:
    text = str(label or "").strip()
    lowered = text.casefold()
    if lowered == "refresh inbox":
        return "Làm mới"
    if lowered == "new address":
        return "Tạo email mới"
    if lowered.startswith("read "):
        return "Đọc " + text[5:].strip()
    return _mobile_text(text)


def mobile_payload_from_result(result: ActionResult) -> dict[str, Any]:
    cards = _cards_from_result(result)
    buttons = _buttons_from_result(result)
    return {
        "ok": result.status != ActionStatus.ERROR,
        "status": result.status.value,
        "message": _friendly_message(result),
        "cards": cards,
        "buttons": buttons,
        "requiresConfirmation": result.status == ActionStatus.NEED_CONFIRM,
        "raw": {
            "status": result.status.value,
            "data": _safe_mobile_data(result.data),
            "errorCode": result.error_code.value if result.error_code else "",
        },
    }


def _friendly_message(result: ActionResult) -> str:
    data = result.data if isinstance(result.data, dict) else {}
    if data.get("mailbox_address"):
        return "Email tạm đã sẵn sàng."
    if {"cpu_percent", "ram_percent", "disk_percent"} & set(data.keys()):
        return "Trạng thái máy đã cập nhật."
    if data.get("telegram_photo_path") or data.get("image_path"):
        return "Đã tạo ảnh kết quả."
    if data.get("password"):
        return "Đã tạo mật khẩu."
    if data.get("hex") or data.get("base64"):
        return "Đã tạo hash."
    if result.status == ActionStatus.ERROR:
        return _mobile_text(result.message) or "Không xử lý được yêu cầu."
    return _mobile_text(result.message) or "Đã xong."


def _cards_from_result(result: ActionResult) -> list[dict[str, Any]]:
    data = result.data if isinstance(result.data, dict) else {}
    cards: list[dict[str, Any]] = []

    if result.status == ActionStatus.ERROR:
        return [{"type": "error", "title": "Có lỗi xảy ra", "message": _friendly_message(result)}]

    if result.status == ActionStatus.NEED_CONFIRM:
        return [
            {
                "type": "confirm",
                "title": "Cần xác nhận",
                "message": _friendly_message(result),
                "tone": "danger",
            }
        ]

    if result.status == ActionStatus.NEED_CLARIFY:
        return [
            {
                "type": "question",
                "title": "Cần thêm thông tin",
                "message": _mobile_text(data.get("question") or result.message or ""),
            }
        ]

    if result.status == ActionStatus.NEED_CHOICE:
        choices = [str(item) for item in list(data.get("choices") or [])]
        return [{"type": "choice", "title": "Chọn một mục", "message": _mobile_text(result.message), "choices": choices}]

    image_card = _image_card_from_data(data, result.message)
    if image_card:
        cards.append(image_card)

    if data.get("mailbox_address"):
        cards.append(
            {
                "type": "temp_mail",
                "title": "Email tạm",
                "email": str(data.get("mailbox_address") or ""),
                "messages": list(data.get("messages") or [])[:10],
                "message": "Email tạm đã sẵn sàng.",
            }
        )

    if {"cpu_percent", "ram_percent", "disk_percent"} & set(data.keys()):
        cards.append(
            {
                "type": "system_status",
                "title": "Trạng thái máy",
                "items": [
                    {"label": "CPU", "value": _percent(data.get("cpu_percent"))},
                    {"label": "RAM", "value": _percent(data.get("ram_percent"))},
                    {"label": "Ổ đĩa", "value": _percent(data.get("disk_percent"))},
                    {"label": "Pin", "value": _percent(data.get("battery_percent")) if data.get("battery_percent") is not None else "Không có thông tin"},
                    {"label": "Đang dùng", "value": str(data.get("foreground_window") or "Không rõ")},
                ],
                "message": _mobile_text(result.message),
            }
        )

    if data.get("hex") or data.get("base64"):
        items = []
        if data.get("hex"):
            items.append({"label": "Hex", "value": str(data.get("hex")), "copy": True})
        if data.get("base64"):
            items.append({"label": "Base64", "value": str(data.get("base64")), "copy": True})
        cards.append(
            {
                "type": "copy",
                "title": f"Hash {str(data.get('algorithm') or '').upper()}".strip(),
                "items": items,
                "message": _mobile_text(result.message),
            }
        )

    copy_candidates = [
        ("formatted", "Kết quả"),
        ("output", "Kết quả"),
        ("tags", "Kết quả"),
        ("short_url", "Đường dẫn rút gọn"),
        ("password", "Mật khẩu"),
        ("code", "Mã"),
        ("user_agent", "User-Agent"),
    ]
    copy_items = [
        {"label": label, "value": str(data.get(key) or ""), "copy": True}
        for key, label in copy_candidates
        if data.get(key)
    ]
    if copy_items and not any(card.get("type") == "copy" for card in cards):
        cards.append({"type": "copy", "title": "Kết quả", "items": copy_items, "message": _mobile_text(result.message)})

    if not cards:
        cards.append({"type": "message", "title": "Kết quả", "message": _mobile_text(result.message)})
    return cards


def _buttons_from_result(result: ActionResult) -> list[dict[str, Any]]:
    data = result.data if isinstance(result.data, dict) else {}
    if result.status == ActionStatus.NEED_CONFIRM:
        return [
            {"label": "Đồng ý", "command": "yes", "tone": "danger"},
            {"label": "Hủy", "command": "no", "tone": "neutral"},
        ]
    if result.status == ActionStatus.NEED_CHOICE:
        return [
            {"label": str(index), "command": str(index), "tone": "neutral"}
            for index, _item in enumerate(list(data.get("choices") or [])[:9], start=1)
        ]
    buttons: list[dict[str, Any]] = []
    if data.get("mailbox_address"):
        return [
            {"label": "Làm mới", "command": "mở temp mail", "tone": "neutral"},
            {"label": "Tạo email mới", "command": "tạo temp mail mới", "tone": "neutral"},
        ]
    for item in list(data.get("telegram_command_buttons") or [])[:8]:
        if not isinstance(item, dict):
            continue
        label = _mobile_button_label(str(item.get("text") or "").strip())
        command = _mobile_command_text(str(item.get("command") or "").strip())
        if label and command:
            buttons.append({"label": label, "command": command, "tone": "neutral"})
    for item in list(data.get("mobile_buttons") or [])[:4]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("text") or item.get("label") or "").strip()
        url = str(item.get("url") or "").strip()
        if label and url.startswith(("http://", "https://")):
            buttons.append({"label": label, "url": url, "tone": "neutral"})
    return buttons


def _image_card_from_data(data: dict[str, Any], message: str) -> dict[str, Any] | None:
    path = str(data.get("telegram_photo_path") or data.get("image_path") or "").strip()
    if not path:
        return None
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        return None
    try:
        if file_path.stat().st_size > MAX_IMAGE_EMBED_BYTES:
            return None
        raw = file_path.read_bytes()
    except Exception:
        return None
    mime = mimetypes.guess_type(str(file_path))[0] or "image/png"
    return {
        "type": "image",
        "title": "Ảnh kết quả",
        "message": _mobile_text(message),
        "image": {
            "src": f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}",
            "alt": "Kết quả",
        },
        "caption": str(data.get("qr_text") or data.get("url") or ""),
    }


def _safe_mobile_data(data: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in (data or {}).items():
        if key in {"telegram_photo_path", "telegram_document_path", "path"}:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[key] = value
        elif isinstance(value, list):
            safe[key] = value[:20]
        elif isinstance(value, dict):
            safe[key] = value
    return safe


def _percent(value: Any) -> str:
    try:
        return f"{float(value):.0f}%"
    except Exception:
        return "Không rõ"
