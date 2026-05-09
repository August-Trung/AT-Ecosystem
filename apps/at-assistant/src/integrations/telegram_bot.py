from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import os
from pathlib import Path
import re
import threading
import time
from typing import TYPE_CHECKING, Any, Callable, Iterable

import requests

from src.core.result import ActionResult, ActionStatus
from src.integrations.telegram_settings import TelegramSettingsStore

if TYPE_CHECKING:
    from src.core.engine import Engine


TELEGRAM_MESSAGE_LIMIT = 4096
DEFAULT_COMMAND_PREFIX = "/at"
DEFAULT_POLL_TIMEOUT = 30
CALLBACK_YES = "at:yes"
CALLBACK_NO = "at:no"
CALLBACK_CHOICE_PREFIX = "at:choice:"
CALLBACK_COMMAND_PREFIX = "at:cmd:"

logger = logging.getLogger(__name__)


REMOTE_HELP_TEXT = """Các lệnh hay dùng khi điều khiển từ xa:

Ứng dụng
- /at đang mở gì
- /at trạng thái máy
- /at mở notepad
- /at tắt notepad
- /at mở chrome
- /at tắt chrome
- /at mở lại file lúc nãy
- /at máy đang chạy gì
- /at tắt app số 1
- Khi xem danh sách app: bấm số app để chọn Chuyển sang / Đóng toàn bộ ứng dụng / thao tác tab

Cửa sổ
- /at cửa sổ đang mở
- /at đóng cửa sổ số 1
- Dùng nhóm lệnh cửa sổ nếu chỉ muốn đóng đúng một cửa sổ File Explorer/Edge/Zalo đang chọn.

Tab browser thật
- /at mở edge remote
- /at tab edge đang mở
- /at chuyển tab số 2
- /at reload tab số 2
- /at đóng tab số 2

Preset nhanh
- /at im lặng
- /at đi ngủ
- /at ra ngoài
- /at về nhà
- /at tập trung
- /at dọn máy

Lười dùng / dọn máy
- /at đóng app nặng
- /at đóng web giải trí
- /at đóng tất cả trừ chrome và vscode
- /at bật chế độ ngủ quên sau 45 phút từ 23 đến 6
- /at trạng thái chế độ ngủ quên
- /at tắt chế độ ngủ quên
- /at copy vào máy Nội dung cần dán
- /at gửi clipboard
- Gửi file trực tiếp cho bot để máy lưu vào Downloads.

Nhạc / YouTube
- /at mở youtube nhạc đường 1 chiều
- /at tìm youtube nhạc chill
- /at mở youtube
- /at chuyển bài youtube
- /at bài trước youtube
- /at tạm dừng youtube
- /at tăng âm lượng youtube
- /at giảm âm lượng youtube
- /at tắt tiếng youtube
- /at chuyển bài
- /at bài trước
- /at tạm dừng nhạc
- /at tăng âm lượng
- /at giảm âm lượng
- /at tắt tiếng
- /at mute máy
- /at unmute máy

Email / Drive
- /at xem email hôm nay
- /at xem email chưa đọc
- /at tìm file báo cáo trên drive

Trình duyệt / màn hình
- /at tải lại trang
- /at nhập text Xin chào
- /at gửi text Xin chào
- /at nhập địa chỉ https://example.com
- /at tìm trong trang báo cáo
- /at nhập comment Chào mọi người
- /at gửi comment Chào mọi người
- /at chọn ô comment TikTok
- /at nhắn Chào mọi người
- /at click giữa màn hình
- /at click góc dưới phải
- /at click 70 96
- /at enter
- /at esc
- /at tab
- /at ctrl a
- /at giữ ctrl shift
- /at thả ctrl shift
- /at giữ space 3 giây
- /at thả hết phím
- /at nhấn tổ hợp ctrl shift esc
- /at copy
- /at paste
- /at backspace 5
- /at quay lại trang
- /at tiến trang
- /at cuộn xuống
- /at phóng to trang
- /at mở lại tab vừa đóng
- /at đóng tab hiện tại
- /at tab kế tiếp
- /at tab trước
- /at mở tab mới
- /at chụp màn hình
- /at trạng thái máy

Máy tính
- /at tắt máy
- Khi hỏi tắt máy, có thể bấm nút nhanh Sau 30p / Sau 1h / 23:30 / Hằng ngày 23:30 / Hủy lịch.
- /at tắt máy lúc 23h30 hàng ngày cảnh báo trước 15 phút
- /at mở chrome lúc 8h hàng ngày
- /at khởi động lại máy
- /at hibernate
- /at sleep máy
- /at khóa máy

Reminder / công việc
- /at nhắc tôi họp lúc 9h sáng mai
- /at xem reminder
- /at hoàn thành reminder 1

Xác nhận
- Bấm nút Đồng ý / Hủy hoặc nút số trên Telegram, không cần gõ tay."""


@dataclass(frozen=True)
class TelegramConnectionCheck:
    ok: bool
    message: str
    bot_username: str = ""
    sent_chat_ids: tuple[int, ...] = ()


def _parse_int_set(value: str | None) -> set[int]:
    items: set[int] = set()
    for raw in (value or "").replace(";", ",").split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            items.add(int(raw))
        except ValueError:
            logger.warning("Ignoring invalid Telegram allowlist id: %s", raw)
    return items


@dataclass(frozen=True)
class TelegramBotConfig:
    bot_name: str
    token: str
    allowed_user_ids: set[int]
    allowed_chat_ids: set[int]
    command_prefix: str = DEFAULT_COMMAND_PREFIX
    poll_timeout: int = DEFAULT_POLL_TIMEOUT

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "TelegramBotConfig":
        source = env if env is not None else os.environ
        stored = TelegramSettingsStore().load() if env is None else {}
        token = (source.get("TELEGRAM_BOT_TOKEN") or stored.get("bot_token") or "").strip()
        prefix = (source.get("TELEGRAM_COMMAND_PREFIX") or stored.get("command_prefix") or DEFAULT_COMMAND_PREFIX).strip()
        poll_timeout_raw = (
            source.get("TELEGRAM_POLL_TIMEOUT") or stored.get("poll_timeout") or str(DEFAULT_POLL_TIMEOUT)
        )
        poll_timeout_raw = str(poll_timeout_raw).strip()
        try:
            poll_timeout = int(poll_timeout_raw)
        except ValueError:
            logger.warning("Invalid TELEGRAM_POLL_TIMEOUT=%s; using %s", poll_timeout_raw, DEFAULT_POLL_TIMEOUT)
            poll_timeout = DEFAULT_POLL_TIMEOUT
        if poll_timeout <= 0:
            poll_timeout = DEFAULT_POLL_TIMEOUT
        return cls(
            bot_name=(source.get("TELEGRAM_BOT_NAME") or stored.get("bot_name") or "").strip(),
            token=token,
            allowed_user_ids=_parse_int_set(
                source.get("TELEGRAM_ALLOWED_USER_IDS") or stored.get("allowed_user_ids")
            ),
            allowed_chat_ids=_parse_int_set(
                source.get("TELEGRAM_ALLOWED_CHAT_IDS") or stored.get("allowed_chat_ids")
            ),
            command_prefix=prefix or DEFAULT_COMMAND_PREFIX,
            poll_timeout=poll_timeout,
        )


def check_telegram_connection(config: TelegramBotConfig) -> TelegramConnectionCheck:
    if not config.token:
        return TelegramConnectionCheck(False, "Thiếu token bot.")
    if not config.allowed_chat_ids:
        return TelegramConnectionCheck(False, "Thiếu Group/Chat ID được phép.")

    base_url = f"https://api.telegram.org/bot{config.token}"
    try:
        response = requests.get(f"{base_url}/getMe", timeout=15)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        return TelegramConnectionCheck(False, f"Không gọi được Telegram getMe: {exc.__class__.__name__}")

    if not payload.get("ok"):
        return TelegramConnectionCheck(False, "Telegram không chấp nhận token bot.")

    result = payload.get("result") if isinstance(payload.get("result"), dict) else {}
    username = str(result.get("username") or "").strip()
    display_name = config.bot_name or username or "AT Assistant bot"
    test_message = (
        f"{display_name} đã kết nối với AT Assistant.\n"
        f"Gửi {config.command_prefix} <lệnh> để điều khiển từ Telegram."
    )

    sent: list[int] = []
    failures: list[str] = []
    for chat_id in sorted(config.allowed_chat_ids):
        try:
            response = requests.post(
                f"{base_url}/sendMessage",
                json={"chat_id": chat_id, "text": test_message},
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get("ok", True):
                failures.append(str(chat_id))
                continue
            sent.append(chat_id)
        except Exception as exc:
            failures.append(f"{chat_id} ({exc.__class__.__name__})")

    if failures:
        return TelegramConnectionCheck(
            False,
            "Token hợp lệ nhưng không gửi được tin test tới: " + ", ".join(failures),
            bot_username=username,
            sent_chat_ids=tuple(sent),
        )
    return TelegramConnectionCheck(
        True,
        f"Kết nối Telegram thành công. Đã gửi tin test tới {len(sent)} chat/group.",
        bot_username=username,
        sent_chat_ids=tuple(sent),
    )


def split_telegram_message(message: str, limit: int = TELEGRAM_MESSAGE_LIMIT) -> list[str]:
    text = str(message or "")
    if not text:
        return [""]
    return [text[i : i + limit] for i in range(0, len(text), limit)]


class TelegramBotBridge:
    def __init__(
        self,
        config: TelegramBotConfig,
        engine: "Engine | None" = None,
        on_user_message: Callable[[str, int, int], None] | None = None,
        on_result: Callable[[ActionResult, int], None] | None = None,
    ) -> None:
        if not config.token:
            raise ValueError("TELEGRAM_BOT_TOKEN is required.")
        self.config = config
        if engine is None:
            from src.core.engine import Engine

            engine = Engine()
        self.engine = engine
        self.base_url = f"https://api.telegram.org/bot{config.token}"
        self.offset: int | None = None
        self.on_user_message = on_user_message
        self.on_result = on_result

    def poll_once(self) -> None:
        params: dict[str, Any] = {"timeout": self.config.poll_timeout}
        if self.offset is not None:
            params["offset"] = self.offset
        response = requests.get(f"{self.base_url}/getUpdates", params=params, timeout=self.config.poll_timeout + 10)
        response.raise_for_status()
        payload = response.json()
        if not payload.get("ok"):
            logger.warning("Telegram getUpdates returned ok=false")
            return
        for update in payload.get("result", []):
            update_id = update.get("update_id")
            if isinstance(update_id, int):
                self.offset = update_id + 1
            self.process_update(update)

    def run_forever(self) -> None:
        self.run_until_stopped()

    def run_until_stopped(self, stop_event: threading.Event | None = None) -> None:
        logger.info(
            "Telegram bot bridge started with prefix=%s, allowed_users=%s, allowed_chats=%s",
            self.config.command_prefix,
            len(self.config.allowed_user_ids),
            len(self.config.allowed_chat_ids),
        )
        while stop_event is None or not stop_event.is_set():
            try:
                self.poll_once()
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                logger.error("Telegram polling error: %s", exc.__class__.__name__)
                if stop_event is None:
                    time.sleep(3)
                else:
                    stop_event.wait(3)

    def process_update(self, update: dict[str, Any]) -> None:
        callback_query = update.get("callback_query")
        if isinstance(callback_query, dict):
            self.process_callback_query(callback_query)
            return

        message = update.get("message")
        if not isinstance(message, dict):
            return
        text = message.get("text")
        caption = message.get("caption")
        document = message.get("document")
        if not isinstance(text, str) and not isinstance(caption, str) and not isinstance(document, dict):
            return

        chat = message.get("chat") or {}
        sender = message.get("from") or {}
        chat_id = chat.get("id")
        user_id = sender.get("id")
        if not isinstance(chat_id, int) or not isinstance(user_id, int):
            return

        if user_id not in self.config.allowed_user_ids:
            logger.warning("Denied Telegram user_id=%s chat_id=%s: user not allowlisted", user_id, chat_id)
            return
        if chat_id not in self.config.allowed_chat_ids:
            logger.warning("Denied Telegram user_id=%s chat_id=%s: chat not allowlisted", user_id, chat_id)
            return

        command_source = text if isinstance(text, str) else (caption if isinstance(caption, str) else "")
        if isinstance(document, dict) and (not command_source or command_source.startswith(self.config.command_prefix)):
            command = command_source[len(self.config.command_prefix) :].strip() if command_source.startswith(self.config.command_prefix) else ""
            result = self.handle_document_message(document, command)
            self._notify_result(result, chat_id)
            self.send_result(chat_id, result)
            return

        if not isinstance(command_source, str) or not command_source.startswith(self.config.command_prefix):
            return

        command = command_source[len(self.config.command_prefix) :].strip()
        if not command:
            self.send_message(chat_id, f"Nhập lệnh sau `{self.config.command_prefix}`.")
            return
        if _is_help_command(command):
            self.send_message(chat_id, REMOTE_HELP_TEXT)
            return

        self._notify_user_message(command, chat_id, user_id)
        try:
            result = self._handle_engine_command(command)
        except Exception as exc:
            logger.exception("Engine error for Telegram user_id=%s chat_id=%s", user_id, chat_id)
            result = ActionResult.err(f"Lỗi nội bộ: {exc}")
        self._notify_result(result, chat_id)
        self.send_result(chat_id, result)

    def process_callback_query(self, callback_query: dict[str, Any]) -> None:
        sender = callback_query.get("from") or {}
        message = callback_query.get("message") or {}
        chat = message.get("chat") if isinstance(message, dict) else {}
        data = callback_query.get("data")
        callback_id = callback_query.get("id")

        user_id = sender.get("id")
        chat_id = chat.get("id") if isinstance(chat, dict) else None
        if not isinstance(chat_id, int) or not isinstance(user_id, int) or not isinstance(data, str):
            return

        if user_id not in self.config.allowed_user_ids:
            logger.warning("Denied Telegram callback user_id=%s chat_id=%s: user not allowlisted", user_id, chat_id)
            self.answer_callback(callback_id, "Bạn không được phép dùng bot này.")
            return
        if chat_id not in self.config.allowed_chat_ids:
            logger.warning("Denied Telegram callback user_id=%s chat_id=%s: chat not allowlisted", user_id, chat_id)
            self.answer_callback(callback_id, "Chat này không được phép dùng bot.")
            return

        command = ""
        if data == CALLBACK_YES:
            command = "yes"
        elif data == CALLBACK_NO:
            command = "no"
        elif data.startswith(CALLBACK_CHOICE_PREFIX):
            command = data[len(CALLBACK_CHOICE_PREFIX) :].strip()
        elif data.startswith(CALLBACK_COMMAND_PREFIX):
            command = data[len(CALLBACK_COMMAND_PREFIX) :].strip()

        if not command:
            self.answer_callback(callback_id, "Nút không hợp lệ.")
            return

        self.answer_callback(callback_id, "Đang xử lý...")
        self._notify_user_message(command, chat_id, user_id)
        try:
            result = self._handle_engine_command(command)
        except Exception as exc:
            logger.exception("Engine error for Telegram callback user_id=%s chat_id=%s", user_id, chat_id)
            result = ActionResult.err(f"Lỗi nội bộ: {exc}")
        self._notify_result(result, chat_id)
        self.send_result(chat_id, result)

    def _handle_engine_command(self, command: str) -> ActionResult:
        try:
            return self.engine.handle_turn(command, source="telegram")
        except TypeError:
            return self.engine.handle_turn(command)

    def _notify_user_message(self, command: str, chat_id: int, user_id: int) -> None:
        if not self.on_user_message:
            return
        try:
            self.on_user_message(command, chat_id, user_id)
        except Exception:
            logger.warning("Telegram user-message callback failed")

    def _notify_result(self, result: ActionResult, chat_id: int) -> None:
        if not self.on_result:
            return
        try:
            self.on_result(result, chat_id)
        except Exception:
            logger.warning("Telegram result callback failed")

    def answer_callback(self, callback_query_id: Any, text: str = "") -> None:
        if not callback_query_id:
            return
        try:
            requests.post(
                f"{self.base_url}/answerCallbackQuery",
                json={"callback_query_id": callback_query_id, "text": text},
                timeout=10,
            ).raise_for_status()
        except Exception:
            logger.warning("Failed to answer Telegram callback query")

    def send_result(self, chat_id: int, result: ActionResult) -> None:
        photo_path = ""
        document_path = ""
        if isinstance(result.data, dict):
            photo_path = str(result.data.get("telegram_photo_path") or "").strip()
            document_path = str(result.data.get("telegram_document_path") or "").strip()
        if photo_path and Path(photo_path).exists():
            self.send_photo(
                chat_id,
                photo_path,
                sanitize_telegram_message(result.message or ""),
                reply_markup=reply_markup_for_result(result),
            )
            return
        if document_path and Path(document_path).exists():
            self.send_document(chat_id, document_path, sanitize_telegram_message(result.message or ""))
            return
        self.send_message(
            chat_id,
            format_result_for_telegram(result, self.config.command_prefix),
            reply_markup=reply_markup_for_result(result),
        )

    def handle_document_message(self, document: dict[str, Any], command: str = "") -> ActionResult:
        file_id = str(document.get("file_id") or "").strip()
        file_name = str(document.get("file_name") or "telegram_file").strip()
        if not file_id:
            return ActionResult.err("Telegram không gửi file_id hợp lệ.")

        try:
            from src.core import executor
            from src.core.app_paths import ensure_app_data_dir

            safe_name = Path(file_name).name or "telegram_file"
            target_dir = executor.resolve_destination_path("downloads")
            base_dir = Path(target_dir) if target_dir else ensure_app_data_dir("telegram_downloads")
            base_dir.mkdir(parents=True, exist_ok=True)
            target = base_dir / safe_name
            if target.exists():
                stem = target.stem or "telegram_file"
                suffix = target.suffix
                target = base_dir / f"{stem}_{int(time.time())}{suffix}"

            meta_response = requests.get(f"{self.base_url}/getFile", params={"file_id": file_id}, timeout=20)
            meta_response.raise_for_status()
            payload = meta_response.json()
            file_path = str((payload.get("result") or {}).get("file_path") or "").strip()
            if not payload.get("ok", True) or not file_path:
                return ActionResult.err("Không lấy được đường dẫn file từ Telegram.")

            file_response = requests.get(f"{self.base_url.replace('/bot', '/file/bot')}/{file_path}", timeout=60)
            file_response.raise_for_status()
            target.write_bytes(getattr(file_response, "content", b""))

            normalized = (command or "").strip().lower()
            if any(token in normalized for token in ("mo", "mở", "open")):
                opened = executor.open_file(str(target))
                if opened.status == ActionStatus.SUCCESS:
                    return ActionResult.ok(f"Đã lưu và mở file Telegram: {target}", path=str(target))
                return ActionResult.ok(f"Đã lưu file Telegram vào: {target}\n{opened.message}", path=str(target))
            return ActionResult.ok(f"Đã lưu file Telegram vào: {target}", path=str(target))
        except Exception as exc:
            logger.exception("Failed to download Telegram document")
            return ActionResult.err(f"Không tải được file Telegram: {exc}")

    def send_photo(self, chat_id: int, path: str, caption: str = "", reply_markup: dict[str, Any] | None = None) -> None:
        data: dict[str, Any] = {"chat_id": chat_id, "caption": caption[:1024]}
        if reply_markup:
            data["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)
        with open(path, "rb") as handle:
            requests.post(
                f"{self.base_url}/sendPhoto",
                data=data,
                files={"photo": handle},
                timeout=30,
            ).raise_for_status()

    def send_document(self, chat_id: int, path: str, caption: str = "") -> None:
        with open(path, "rb") as handle:
            requests.post(
                f"{self.base_url}/sendDocument",
                data={"chat_id": chat_id, "caption": caption[:1024]},
                files={"document": handle},
                timeout=60,
            ).raise_for_status()

    def send_message(self, chat_id: int, text: str, reply_markup: dict[str, Any] | None = None) -> None:
        chunks = split_telegram_message(text)
        for index, chunk in enumerate(chunks):
            payload: dict[str, Any] = {"chat_id": chat_id, "text": chunk}
            if index == 0 and reply_markup:
                payload["reply_markup"] = reply_markup
            requests.post(
                f"{self.base_url}/sendMessage",
                json=payload,
                timeout=20,
            ).raise_for_status()


def _format_choices(choices: Iterable[Any]) -> str:
    lines = []
    for index, choice in enumerate(choices, 1):
        lines.append(f"{index}. {choice}")
    return "\n".join(lines)


def _is_help_command(command: str) -> bool:
    normalized = (command or "").strip().lower()
    return normalized in {"help", "tro giup", "trợ giúp", "huong dan", "hướng dẫn", "lenh", "lệnh"}


def sanitize_telegram_message(message: str) -> str:
    text = str(message or "")
    # Hide low-level metadata such as "(pid=123)", "(foreground pid=123)", "(2 process)".
    text = re.sub(r"\s*\((?:foreground\s+)?pid\s*=\s*\d+\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\(\d+\s+process(?:es)?\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\((?:scan exact|foreground|process|pid)[^)]*\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def reply_markup_for_result(result: ActionResult) -> dict[str, Any] | None:
    command_buttons = []
    url_buttons = []
    if isinstance(result.data, dict):
        raw_url_buttons = result.data.get("telegram_url_buttons") or []
        if isinstance(raw_url_buttons, list):
            for item in raw_url_buttons[:6]:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text") or "").strip()[:48]
                url = str(item.get("url") or "").strip()
                if text and url.startswith(("http://", "https://")):
                    url_buttons.append({"text": text, "url": url})

        raw_buttons = result.data.get("telegram_command_buttons") or []
        if isinstance(raw_buttons, list):
            for item in raw_buttons[:12]:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text") or "").strip()[:32]
                command = str(item.get("command") or "").strip()
                if text and command:
                    command_buttons.append({"text": text, "callback_data": f"{CALLBACK_COMMAND_PREFIX}{command}"[:64]})
    url_rows = [[button] for button in url_buttons]
    command_rows = [command_buttons[i : i + 2] for i in range(0, len(command_buttons), 2)]

    if result.status == ActionStatus.NEED_CONFIRM:
        rows = [
                [
                    {"text": "Đồng ý", "callback_data": CALLBACK_YES},
                    {"text": "Hủy", "callback_data": CALLBACK_NO},
                ]
            ]
        rows.extend(url_rows)
        rows.extend(command_rows)
        return {"inline_keyboard": rows}

    has_telegram_choices = bool(result.data.get("telegram_choice_buttons")) if isinstance(result.data, dict) else False
    if result.status == ActionStatus.NEED_CHOICE or has_telegram_choices:
        choices = result.data.get("choices", []) if isinstance(result.data, dict) else []
        use_choice_labels = bool(result.data.get("choice_button_labels")) if isinstance(result.data, dict) else False
        buttons: list[dict[str, str]] = []
        for index, choice in enumerate(list(choices)[:20], 1):
            label = str(choice)[:32] if use_choice_labels else str(index)
            buttons.append({"text": label, "callback_data": f"{CALLBACK_CHOICE_PREFIX}{index}"})
        per_row = 2 if use_choice_labels else 5
        rows = [buttons[i : i + per_row] for i in range(0, len(buttons), per_row)]
        if rows:
            rows.extend(url_rows)
            rows.extend(command_rows)
            return {"inline_keyboard": rows}
    if url_rows:
        rows = list(url_rows)
        rows.extend(command_rows)
        return {"inline_keyboard": rows}
    if command_rows:
        return {"inline_keyboard": command_rows}
    return None


def format_result_for_telegram(result: ActionResult, command_prefix: str = DEFAULT_COMMAND_PREFIX) -> str:
    message = sanitize_telegram_message(result.message or "")
    has_telegram_choices = bool(result.data.get("telegram_choice_buttons")) if isinstance(result.data, dict) else False

    if result.status == ActionStatus.SUCCESS:
        if has_telegram_choices:
            return f"{message}\n\nTrả lời `{command_prefix} <số>` để chọn."
        return message

    if result.status == ActionStatus.NEED_CONFIRM:
        return f"{message}\n\nTrả lời `{command_prefix} yes` hoặc `{command_prefix} no` để xác nhận."

    if result.status == ActionStatus.NEED_CHOICE:
        choices = result.data.get("choices", []) if isinstance(result.data, dict) else []
        choices_already_in_message = bool(result.data.get("choices_already_in_message")) if isinstance(result.data, dict) else False
        formatted = "" if choices_already_in_message else _format_choices(choices)
        parts = [message]
        if formatted:
            parts.append(formatted)
        parts.append(f"Trả lời `{command_prefix} <số>` để chọn.")
        return "\n\n".join(part for part in parts if part)

    if result.status == ActionStatus.NEED_CLARIFY:
        question = result.data.get("question") if isinstance(result.data, dict) else None
        if question and question != message:
            return f"{message}\n\n{question}"
        return message

    if result.status == ActionStatus.ERROR:
        return f"Lỗi: {message}" if message else "Lỗi: Không thể xử lý lệnh."

    return message


def main() -> None:
    from src.core.env_loader import load_project_env

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    load_project_env()
    config = TelegramBotConfig.from_env()
    if not config.token:
        raise SystemExit("TELEGRAM_BOT_TOKEN is required.")
    TelegramBotBridge(config).run_forever()


if __name__ == "__main__":
    main()
