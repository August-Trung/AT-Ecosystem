from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pytest

from src.core.result import ActionResult
from src.integrations.telegram_bot import (
    TELEGRAM_MESSAGE_LIMIT,
    TelegramBotBridge,
    TelegramBotConfig,
    check_telegram_connection,
    format_result_for_telegram,
    reply_markup_for_result,
    sanitize_telegram_message,
    split_telegram_message,
)
from src.integrations.telegram_settings import TelegramSettingsStore


@dataclass
class _FakeResponse:
    payload: dict | None = None
    content: bytes = b""

    def json(self):
        return self.payload or {"ok": True, "result": []}

    def raise_for_status(self):
        return None


class _FakeEngine:
    def __init__(self, result: ActionResult | None = None) -> None:
        self.calls: list[str] = []
        self.result = result or ActionResult.ok("done")

    def handle_turn(self, command: str) -> ActionResult:
        self.calls.append(command)
        return self.result


def _config() -> TelegramBotConfig:
    return TelegramBotConfig(
        bot_name="AT Bot",
        token="test-token",
        allowed_user_ids={111},
        allowed_chat_ids={-222},
        command_prefix="/at",
        poll_timeout=1,
    )


def _update(*, user_id: int = 111, chat_id: int = -222, text: str = "/at mo notepad") -> dict:
    return {
        "update_id": 10,
        "message": {
            "from": {"id": user_id},
            "chat": {"id": chat_id},
            "text": text,
        },
    }


def _callback_update(*, user_id: int = 111, chat_id: int = -222, data: str = "at:yes") -> dict:
    return {
        "update_id": 11,
        "callback_query": {
            "id": "cb-1",
            "from": {"id": user_id},
            "message": {"chat": {"id": chat_id}},
            "data": data,
        },
    }


def _document_update(*, user_id: int = 111, chat_id: int = -222, caption: str = "", file_name: str = "note.txt") -> dict:
    message = {
        "from": {"id": user_id},
        "chat": {"id": chat_id},
        "document": {"file_id": "file-1", "file_name": file_name},
    }
    if caption:
        message["caption"] = caption
    return {"update_id": 12, "message": message}


def test_parse_env_allowlist():
    config = TelegramBotConfig.from_env(
        {
            "TELEGRAM_BOT_TOKEN": "abc",
            "TELEGRAM_BOT_NAME": "Assistant Bot",
            "TELEGRAM_ALLOWED_USER_IDS": "1, 2;3",
            "TELEGRAM_ALLOWED_CHAT_IDS": "-10,20",
            "TELEGRAM_COMMAND_PREFIX": "/bot",
            "TELEGRAM_POLL_TIMEOUT": "12",
        }
    )

    assert config.bot_name == "Assistant Bot"
    assert config.token == "abc"
    assert config.allowed_user_ids == {1, 2, 3}
    assert config.allowed_chat_ids == {-10, 20}
    assert config.command_prefix == "/bot"
    assert config.poll_timeout == 12


def test_empty_allowlists_deny_all(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine()
    bridge = TelegramBotBridge(
        TelegramBotConfig(bot_name="", token="test-token", allowed_user_ids=set(), allowed_chat_ids=set()),
        engine=engine,
    )

    bridge.process_update(_update())

    assert engine.calls == []
    assert posted == []


def test_deny_user_outside_allowlist(monkeypatch, caplog):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine()
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(user_id=999))

    assert engine.calls == []
    assert posted == []
    assert "user_id=999 chat_id=-222" in caplog.text


def test_deny_chat_outside_allowlist(monkeypatch, caplog):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine()
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(chat_id=-999))

    assert engine.calls == []
    assert posted == []
    assert "user_id=111 chat_id=-999" in caplog.text


def test_ignore_message_without_prefix(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine()
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(text="mo notepad"))

    assert engine.calls == []
    assert posted == []


def test_help_command_replies_without_engine(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine()
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(text="/at help"))

    assert engine.calls == []
    assert "Các lệnh hay dùng" in posted[0]["json"]["text"]


def test_calls_engine_when_valid(monkeypatch):
    posted: list[dict] = []
    mirrored_users: list[tuple[str, int, int]] = []
    mirrored_results: list[tuple[ActionResult, int]] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine(ActionResult.ok("opened"))
    bridge = TelegramBotBridge(
        _config(),
        engine=engine,
        on_user_message=lambda command, chat_id, user_id: mirrored_users.append((command, chat_id, user_id)),
        on_result=lambda result, chat_id: mirrored_results.append((result, chat_id)),
    )

    bridge.process_update(_update(text="/at mo notepad"))

    assert engine.calls == ["mo notepad"]
    assert posted[0]["json"] == {"chat_id": -222, "text": "opened"}
    assert mirrored_users == [("mo notepad", -222, 111)]
    assert mirrored_results[0][0].message == "opened"
    assert mirrored_results[0][1] == -222


def test_valid_confirm_result_includes_inline_buttons(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine(ActionResult.need_confirm("Run it?", "tool", {}))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(text="/at close notepad"))

    payload = posted[0]["json"]
    assert payload["reply_markup"]["inline_keyboard"][0][0] == {"text": "Đồng ý", "callback_data": "at:yes"}
    assert payload["reply_markup"]["inline_keyboard"][0][1] == {"text": "Hủy", "callback_data": "at:no"}


def test_confirm_result_can_include_quick_command_buttons(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    result = ActionResult.need_confirm("Shutdown?", "system_power", {"action": "shutdown"})
    result.data["telegram_command_buttons"] = [{"text": "Sau 30p", "command": "tat may sau 30 phut"}]
    engine = _FakeEngine(result)
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_update(text="/at tat may"))

    rows = posted[0]["json"]["reply_markup"]["inline_keyboard"]
    assert rows[0][0]["callback_data"] == "at:yes"
    assert rows[1][0] == {"text": "Sau 30p", "callback_data": "at:cmd:tat may sau 30 phut"}


def test_callback_yes_calls_engine_and_answers_callback(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append({"url": a[0], **kw}) or _FakeResponse())
    engine = _FakeEngine(ActionResult.ok("done"))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_callback_update(data="at:yes"))

    assert engine.calls == ["yes"]
    assert posted[0]["url"].endswith("/answerCallbackQuery")
    assert posted[1]["json"] == {"chat_id": -222, "text": "done"}


def test_callback_choice_calls_engine_with_number(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append({"url": a[0], **kw}) or _FakeResponse())
    engine = _FakeEngine(ActionResult.ok("picked"))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_callback_update(data="at:choice:2"))

    assert engine.calls == ["2"]
    assert posted[1]["json"]["text"] == "picked"


def test_callback_command_button_calls_engine(monkeypatch):
    posted: list[dict] = []
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append({"url": a[0], **kw}) or _FakeResponse())
    engine = _FakeEngine(ActionResult.ok("scheduled"))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_callback_update(data="at:cmd:tat may sau 30 phut"))

    assert engine.calls == ["tat may sau 30 phut"]
    assert posted[1]["json"]["text"] == "scheduled"


def test_send_result_sends_photo_when_present(monkeypatch, tmp_path):
    posted: list[dict] = []
    image_path = tmp_path / "screen.png"
    image_path.write_bytes(b"fake-png")

    def fake_post(url, **kwargs):
        posted.append({"url": url, **kwargs})
        return _FakeResponse({"ok": True, "result": {}})

    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", fake_post)
    bridge = TelegramBotBridge(_config(), engine=_FakeEngine())

    bridge.send_result(-222, ActionResult.ok("Đã chụp màn hình.", telegram_photo_path=str(image_path)))

    assert posted[0]["url"].endswith("/sendPhoto")
    assert posted[0]["data"]["chat_id"] == -222


def test_send_result_sends_document_when_present(monkeypatch, tmp_path):
    posted: list[dict] = []
    document_path = tmp_path / "report.txt"
    document_path.write_text("hello", encoding="utf-8")

    def fake_post(url, **kwargs):
        posted.append({"url": url, **kwargs})
        return _FakeResponse({"ok": True, "result": {}})

    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", fake_post)
    bridge = TelegramBotBridge(_config(), engine=_FakeEngine())

    bridge.send_result(-222, ActionResult.ok("File", telegram_document_path=str(document_path)))

    assert posted[0]["url"].endswith("/sendDocument")
    assert posted[0]["data"]["chat_id"] == -222


def test_document_message_downloads_to_downloads_without_engine(monkeypatch, tmp_path):
    posted: list[dict] = []

    def fake_get(url, params=None, timeout=None):
        if url.endswith("/getFile"):
            return _FakeResponse({"ok": True, "result": {"file_path": "documents/note.txt"}})
        assert "/file/bot" in url
        return _FakeResponse(content=b"hello")

    def fake_post(url, **kwargs):
        posted.append({"url": url, **kwargs})
        return _FakeResponse({"ok": True, "result": {}})

    monkeypatch.setattr("src.integrations.telegram_bot.requests.get", fake_get)
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", fake_post)
    monkeypatch.setattr("src.core.executor.resolve_destination_path", lambda destination: str(tmp_path))
    engine = _FakeEngine(ActionResult.ok("should not run"))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.process_update(_document_update(file_name="note.txt"))

    assert engine.calls == []
    assert (tmp_path / "note.txt").read_bytes() == b"hello"
    assert "Đã lưu file Telegram" in posted[0]["json"]["text"]


def test_poll_once_uses_requests_get(monkeypatch):
    posted: list[dict] = []

    def fake_get(url, params=None, timeout=None):
        assert url.endswith("/getUpdates")
        assert params == {"timeout": 1}
        return _FakeResponse({"ok": True, "result": [_update(text="/at ping")]})

    monkeypatch.setattr("src.integrations.telegram_bot.requests.get", fake_get)
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", lambda *a, **kw: posted.append(kw) or _FakeResponse())
    engine = _FakeEngine(ActionResult.ok("pong"))
    bridge = TelegramBotBridge(_config(), engine=engine)

    bridge.poll_once()

    assert bridge.offset == 11
    assert engine.calls == ["ping"]
    assert posted[0]["json"]["text"] == "pong"


def test_check_connection_sends_test_message(monkeypatch):
    posted: list[dict] = []

    def fake_get(url, timeout=None):
        assert url.endswith("/getMe")
        return _FakeResponse({"ok": True, "result": {"username": "at_bot"}})

    def fake_post(url, json=None, timeout=None):
        posted.append({"url": url, "json": json})
        return _FakeResponse({"ok": True, "result": {}})

    monkeypatch.setattr("src.integrations.telegram_bot.requests.get", fake_get)
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", fake_post)

    result = check_telegram_connection(_config())

    assert result.ok is True
    assert result.bot_username == "at_bot"
    assert result.sent_chat_ids == (-222,)
    assert posted[0]["json"]["chat_id"] == -222
    assert "/at <lệnh>" in posted[0]["json"]["text"]


def test_check_connection_reports_send_failure(monkeypatch):
    def fake_get(url, timeout=None):
        return _FakeResponse({"ok": True, "result": {"username": "at_bot"}})

    def fake_post(url, json=None, timeout=None):
        raise RuntimeError("no access")

    monkeypatch.setattr("src.integrations.telegram_bot.requests.get", fake_get)
    monkeypatch.setattr("src.integrations.telegram_bot.requests.post", fake_post)

    result = check_telegram_connection(_config())

    assert result.ok is False
    assert "không gửi được tin test" in result.message


@pytest.mark.parametrize(
    ("result", "expected"),
    [
        (ActionResult.ok("OK"), "OK"),
        (
            ActionResult.need_confirm("Run it?", "tool", {}),
            "Run it?\n\nTrả lời `/at yes` hoặc `/at no` để xác nhận.",
        ),
        (
            ActionResult.need_choice("Pick one", ["A", "B"]),
            "Pick one\n\n1. A\n2. B\n\nTrả lời `/at <số>` để chọn.",
        ),
        (
            ActionResult.need_clarify("Need time", "When?"),
            "Need time\n\nWhen?",
        ),
        (
            ActionResult.err("Broken"),
            "Lỗi: Broken",
        ),
    ],
)
def test_format_result_statuses(result, expected):
    assert format_result_for_telegram(result, "/at") == expected


def test_reply_markup_for_choice_result():
    markup = reply_markup_for_result(ActionResult.need_choice("Pick one", ["A", "B", "C"]))

    assert markup == {
        "inline_keyboard": [
            [
                {"text": "1", "callback_data": "at:choice:1"},
                {"text": "2", "callback_data": "at:choice:2"},
                {"text": "3", "callback_data": "at:choice:3"},
            ]
        ]
    }


def test_reply_markup_can_use_choice_labels():
    result = ActionResult.need_choice("Pick one", ["Chuyển sang", "Tắt ứng dụng", "Đóng tab"])
    result.data["choice_button_labels"] = True

    assert reply_markup_for_result(result) == {
        "inline_keyboard": [
            [
                {"text": "Chuyển sang", "callback_data": "at:choice:1"},
                {"text": "Tắt ứng dụng", "callback_data": "at:choice:2"},
            ],
            [
                {"text": "Đóng tab", "callback_data": "at:choice:3"},
            ],
        ]
    }


def test_reply_markup_for_success_with_telegram_choices():
    result = ActionResult.ok("List", choices=["A", "B"], telegram_choice_buttons=True)

    assert reply_markup_for_result(result) == {
        "inline_keyboard": [
            [
                {"text": "1", "callback_data": "at:choice:1"},
                {"text": "2", "callback_data": "at:choice:2"},
            ]
        ]
    }


def test_format_result_does_not_duplicate_embedded_choices():
    result = ActionResult.need_choice("Máy đang mở:\n1. Edge\n2. Zalo", ["Edge", "Zalo"])
    result.data["choices_already_in_message"] = True

    assert format_result_for_telegram(result, "/at") == "Máy đang mở:\n1. Edge\n2. Zalo\n\nTrả lời `/at <số>` để chọn."


def test_sanitize_telegram_message_hides_process_metadata():
    assert sanitize_telegram_message("Đã đóng notepad (pid=17320).") == "Đã đóng notepad."
    assert sanitize_telegram_message("Đã đóng notepad (foreground pid=12472).") == "Đã đóng notepad."
    assert sanitize_telegram_message("Đã đóng TẤT CẢ chrome. (3 process)") == "Đã đóng TẤT CẢ chrome."


def test_format_result_hides_process_metadata():
    assert format_result_for_telegram(ActionResult.ok("Đã đóng notepad (pid=17320).")) == "Đã đóng notepad."


def test_split_message_long_text():
    text = "x" * (TELEGRAM_MESSAGE_LIMIT * 2 + 3)

    chunks = split_telegram_message(text)

    assert [len(chunk) for chunk in chunks] == [TELEGRAM_MESSAGE_LIMIT, TELEGRAM_MESSAGE_LIMIT, 3]


def test_config_from_default_env_loads_saved_settings(monkeypatch, tmp_path):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    for key in (
        "TELEGRAM_BOT_NAME",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_ALLOWED_USER_IDS",
        "TELEGRAM_ALLOWED_CHAT_IDS",
        "TELEGRAM_COMMAND_PREFIX",
        "TELEGRAM_POLL_TIMEOUT",
    ):
        monkeypatch.delenv(key, raising=False)
    TelegramSettingsStore().save(
        {
            "bot_name": "Saved Bot",
            "bot_token": "saved-token",
            "allowed_user_ids": "10,11",
            "allowed_chat_ids": "-100",
            "command_prefix": "/saved",
            "poll_timeout": 7,
        }
    )

    config = TelegramBotConfig.from_env()

    assert config.bot_name == "Saved Bot"
    assert config.token == "saved-token"
    assert config.allowed_user_ids == {10, 11}
    assert config.allowed_chat_ids == {-100}
    assert config.command_prefix == "/saved"
    assert config.poll_timeout == 7
