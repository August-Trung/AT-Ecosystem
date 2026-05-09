from __future__ import annotations

import json
import sys
import types
from urllib.parse import parse_qs, unquote, urlparse

class _FakeFernet:
    @staticmethod
    def generate_key() -> bytes:
        return b"fake-fernet-key"

    def __init__(self, _key: bytes) -> None:
        pass

    def encrypt(self, value: bytes) -> bytes:
        return b"gAAAAA" + value

    def decrypt(self, value: bytes) -> bytes:
        return value.removeprefix(b"gAAAAA")


class _FakeInvalidToken(Exception):
    pass


sys.modules.setdefault(
    "keyring",
    types.SimpleNamespace(get_password=lambda *_args, **_kwargs: None, set_password=lambda *_args, **_kwargs: None),
)
sys.modules.setdefault("cryptography", types.SimpleNamespace())
sys.modules.setdefault(
    "cryptography.fernet",
    types.SimpleNamespace(Fernet=_FakeFernet, InvalidToken=_FakeInvalidToken),
)

from src.core.result import ActionResult, ActionStatus
from src.core.router import RouteType, route
from src.core.engine import Engine
from src.integrations import web_actions
from src.integrations import mmo_native
from src.integrations.telegram_bot import reply_markup_for_result


def _hash_query(url: str) -> dict[str, list[str]]:
    parsed = urlparse(url)
    hash_value = parsed.fragment
    _, _, query = hash_value.partition("?")
    return parse_qs(query)


def test_route_mmo_qr_action_with_url_payload():
    decision = route("tao qr https://example.com trong mmo")

    assert decision.type == RouteType.WEB_APP_ACTION
    assert decision.args["app_id"] == "mmo-web"
    assert decision.args["action_id"] == "mmo.openQrGenerator"
    assert decision.args["args"]["text"] == "https://example.com"


def test_route_mmo_temp_mail_action():
    decision = route("mo temp mail")

    assert decision.type == RouteType.WEB_APP_ACTION
    assert decision.args["action_id"] == "mmo.openTempMail"


def test_route_json_action_extracts_payload():
    decision = route('format json {"a":1} trong mmo')

    assert decision.type == RouteType.WEB_APP_ACTION
    assert decision.args["action_id"] == "mmo.openJsonFormatter"
    assert decision.args["args"]["text"] == '{"a":1}'


def test_invoke_mmo_web_action_builds_url_invocation(monkeypatch):
    monkeypatch.setenv("AT_MMO_WEB_URL", "http://localhost:3000")
    calls: list[tuple[str, str]] = []

    def fake_open_url(url: str, browser: str = "default") -> ActionResult:
        calls.append((url, browser))
        return ActionResult.ok("opened", url=url, browser=browser)

    monkeypatch.setattr(web_actions.executor, "open_url", fake_open_url)
    monkeypatch.setattr(web_actions, "_prepare_qr_telegram_photo", lambda args: "C:/tmp/qr.png")

    result = web_actions.invoke_web_action(
        "mmo-web",
        "mmo.openQrGenerator",
        {"text": "https://example.com"},
        browser="edge",
    )

    assert result.status == ActionStatus.SUCCESS
    assert calls
    opened_url, browser = calls[0]
    assert browser == "edge"
    assert opened_url.startswith("http://localhost:3000/#/qr-gen?")

    params = _hash_query(opened_url)
    assert params["atAction"] == ["mmo.openQrGenerator"]
    assert params["atSource"] == ["assistant"]
    payload = json.loads(unquote(params["atArgs"][0]))
    assert payload == {"text": "https://example.com"}
    assert result.data["telegram_photo_path"] == "C:/tmp/qr.png"
    assert result.data["telegram_url_buttons"][0]["url"] == opened_url


def test_telegram_delivery_uses_native_handler_without_opening_browser(monkeypatch):
    calls: list[str] = []
    monkeypatch.setenv("AT_MMO_WEB_URL", "http://localhost:3000")
    monkeypatch.setattr(web_actions.executor, "open_url", lambda url, browser="default": calls.append(url) or ActionResult.ok("opened"))
    monkeypatch.setattr(
        web_actions,
        "handle_native_mmo_action",
        lambda action_id, args: ActionResult.ok("native", native_action=action_id, native_args=args),
    )

    result = web_actions.invoke_web_action(
        "mmo-web",
        "mmo.openJsonFormatter",
        {"text": '{"a":1}'},
        delivery="telegram",
    )

    assert result.status == ActionStatus.SUCCESS
    assert result.message == "native"
    assert calls == []
    assert "telegram_url_buttons" not in result.data
    assert result.data["url"].startswith("http://localhost:3000/#/json-format?")


def test_telegram_temp_mail_native_result_does_not_offer_web_button(monkeypatch):
    calls: list[str] = []
    monkeypatch.setenv("AT_MMO_WEB_URL", "http://localhost:3000")
    monkeypatch.setattr(web_actions.executor, "open_url", lambda url, browser="default": calls.append(url) or ActionResult.ok("opened"))
    monkeypatch.setattr(
        web_actions,
        "handle_native_mmo_action",
        lambda action_id, args: ActionResult.ok(
            "Email tam hien tai:\nat@example.test",
            telegram_command_buttons=[{"text": "Refresh inbox", "command": "mo temp mail"}],
        ),
    )

    result = web_actions.invoke_web_action(
        "mmo-web",
        "mmo.openTempMail",
        {"operation": "inbox"},
        delivery="telegram",
    )

    assert result.status == ActionStatus.SUCCESS
    assert calls == []
    assert "telegram_url_buttons" not in result.data
    assert result.data["telegram_command_buttons"][0]["command"] == "mo temp mail"
    assert result.data["url"].startswith("http://localhost:3000/#/temp-mail?")


def test_engine_telegram_source_routes_mmo_action_to_native(monkeypatch):
    calls: list[str] = []
    monkeypatch.setattr(web_actions.executor, "open_url", lambda url, browser="default": calls.append(url) or ActionResult.ok("opened"))
    monkeypatch.setattr(
        web_actions,
        "handle_native_mmo_action",
        lambda action_id, args: ActionResult.ok("native telegram", telegram_photo_path="C:/tmp/qr.png"),
    )

    result = Engine().handle_turn("tạo qr https://example.com trong mmo", source="telegram")

    assert result.status == ActionStatus.SUCCESS
    assert result.message == "native telegram"
    assert calls == []
    assert result.data["telegram_photo_path"]


def test_native_json_formatter_returns_text():
    result = mmo_native.handle_native_mmo_action(
        "mmo.openJsonFormatter",
        {"text": '{"a":1}', "operation": "beautify"},
    )

    assert result is not None
    assert result.status == ActionStatus.SUCCESS
    assert '"a": 1' in result.data["formatted"]


def test_route_mmo_hash_action():
    decision = route("hash sha256 hello trong mmo")

    assert decision.type == RouteType.WEB_APP_ACTION
    assert decision.args["action_id"] == "mmo.openHashTool"
    assert decision.args["args"]["route"] == "/hash"


def test_invoke_new_native_mmo_action_without_browser(monkeypatch):
    calls: list[str] = []
    monkeypatch.setenv("AT_MMO_WEB_URL", "http://localhost:3000")
    monkeypatch.setattr(web_actions.executor, "open_url", lambda url, browser="default": calls.append(url) or ActionResult.ok("opened"))

    result = web_actions.invoke_web_action(
        "mmo-web",
        "mmo.openHashTool",
        {"text": "hello", "algo": "sha256"},
        delivery="telegram",
    )

    assert result.status == ActionStatus.SUCCESS
    assert calls == []
    assert result.data["hex"] == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    assert "telegram_url_buttons" not in result.data


def test_native_text_tools_base64_encode():
    result = mmo_native.handle_native_mmo_action(
        "mmo.openTextTools",
        {"text": "hello", "mode": "base64", "operation": "encode"},
    )

    assert result is not None
    assert result.status == ActionStatus.SUCCESS
    assert result.data["output"] == "aGVsbG8="


def test_native_regex_returns_matches():
    result = mmo_native.handle_native_mmo_action(
        "mmo.openRegexTester",
        {"pattern": r"\d+", "text": "abc123 xyz45"},
    )

    assert result is not None
    assert result.status == ActionStatus.SUCCESS
    assert result.data["matches"] == ["123", "45"]


def test_native_json_diff_reports_change():
    result = mmo_native.handle_native_mmo_action(
        "mmo.openJsonDiff",
        {"left": '{"a":1}', "right": '{"a":2,"b":3}'},
    )

    assert result is not None
    assert result.status == ActionStatus.SUCCESS
    assert len(result.data["diffs"]) == 2


def test_telegram_result_supports_url_buttons():
    result = ActionResult.ok(
        "Opened web action.",
        telegram_url_buttons=[
            {"text": "Open QR", "url": "https://mmo.augusttrung.com/#/qr-gen"}
        ],
    )

    markup = reply_markup_for_result(result)

    assert markup == {
        "inline_keyboard": [
            [{"text": "Open QR", "url": "https://mmo.augusttrung.com/#/qr-gen"}]
        ]
    }
