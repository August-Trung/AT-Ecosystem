from __future__ import annotations

import src.core.engine as engine_module
import src.core.chat_ai as chat_ai
from src.core.engine import Engine
from src.core.result import ActionStatus
from src.core.router import RouteType, route


def test_stable_question_routes_to_natural_chat():
    decision = route("Python la gi?")

    assert decision.type == RouteType.CHAT
    assert decision.args["message"] == "Python la gi?"


def test_fresh_question_routes_to_web_search():
    decision = route("Python phien ban moi nhat hien tai la gi?")

    assert decision.type == RouteType.WEB_SEARCH
    assert decision.args["query"] == "Python phien ban moi nhat hien tai la gi?"


def test_tool_request_still_routes_to_tool():
    decision = route("mo chrome")

    assert decision.type == RouteType.OPEN_APP
    assert decision.args["app_name"] == "chrome"


def test_engine_natural_chat_uses_chat_model(monkeypatch):
    captured: dict[str, object] = {}

    def fake_generate_chat_reply(message, history=None, cancel_check=None):
        captured["message"] = message
        captured["history"] = history
        return "Python la mot ngon ngu lap trinh."

    monkeypatch.setattr(engine_module, "generate_chat_reply", fake_generate_chat_reply)

    engine = Engine()
    res = engine.handle_turn("Python la gi?")

    assert res.status == ActionStatus.SUCCESS
    assert res.data["kind"] == "chat"
    assert res.message == "Python la mot ngon ngu lap trinh."
    assert captured["message"] == "Python la gi?"
    assert engine.state.history[-1]["role"] == "assistant"


def test_chat_provider_auto_falls_back_to_gemini(monkeypatch):
    calls: list[str] = []

    def fake_openrouter(*args, **kwargs):
        calls.append("openrouter")
        raise chat_ai.ChatProviderError("openrouter", "429 rate limited")

    def fake_gemini(*args, **kwargs):
        calls.append("gemini")
        return "Gemini fallback ok"

    monkeypatch.setenv("AI_PROVIDER", "auto")
    monkeypatch.setattr(chat_ai, "_generate_openrouter_reply", fake_openrouter)
    monkeypatch.setattr(chat_ai, "_generate_gemini_reply", fake_gemini)

    assert chat_ai.generate_chat_reply("hello") == "Gemini fallback ok"
    assert calls == ["openrouter", "gemini"]


def test_chat_provider_can_use_gemini_directly(monkeypatch):
    calls: list[str] = []

    def fake_openrouter(*args, **kwargs):
        calls.append("openrouter")
        return "should not be used"

    def fake_gemini(*args, **kwargs):
        calls.append("gemini")
        return "Gemini direct ok"

    monkeypatch.setenv("AI_PROVIDER", "gemini")
    monkeypatch.setattr(chat_ai, "_generate_openrouter_reply", fake_openrouter)
    monkeypatch.setattr(chat_ai, "_generate_gemini_reply", fake_gemini)

    assert chat_ai.generate_chat_reply("hello") == "Gemini direct ok"
    assert calls == ["gemini"]
