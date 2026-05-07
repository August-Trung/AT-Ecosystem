from __future__ import annotations

from src.core import executor
from src.core.engine import Engine
from src.core.result import ActionResult, ActionStatus, ErrorCode


def test_engine_new_open_command_clears_custom_app_clarify_context(monkeypatch):
    engine = Engine()

    def fake_guess_app_name(user_text, allow_prefix=False):
        normalized = str(user_text or "").strip().lower()
        if normalized in {"edge", "notepad"}:
            return normalized
        return None

    def fake_open_app(app_name, confirm_before_custom_picker=False):
        normalized = str(app_name or "").strip().lower()
        if normalized in {"edge", "notepad"}:
            return ActionResult.ok(f"Đã mở {normalized}")
        return ActionResult.err(
            "Không tìm thấy ứng dụng.",
            code=ErrorCode.APP_NOT_FOUND,
            prompt_custom_app_selection=True,
            custom_app_alias=normalized,
            custom_app_reason="not_found",
            custom_app_target_path="",
            custom_app_display_name=normalized,
            custom_app_requires_confirmation=confirm_before_custom_picker,
        )

    monkeypatch.setattr(executor, "guess_app_name", fake_guess_app_name)
    monkeypatch.setattr(executor, "open_app", fake_open_app)
    monkeypatch.setattr(
        executor,
        "web_search",
        lambda query: ActionResult.ok(f"Đã mở web: {query}", query=query),
    )

    first = engine.handle_turn("mở plarium play")
    assert first.status == ActionStatus.NEED_CLARIFY

    second = engine.handle_turn("mở edge")
    assert second.status == ActionStatus.SUCCESS
    assert "Đã mở edge" in second.message
