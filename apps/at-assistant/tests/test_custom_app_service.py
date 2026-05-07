from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core import executor
from src.core.result import ActionResult, ActionStatus, ErrorCode
from src.core.router import RouteType, route
from src.core.engine import Engine
import src.plugins.custom_app_service as custom_app_module
from src.plugins.custom_app_service import CustomAppService


def test_custom_app_service_save_update_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(custom_app_module, "runtime_root", lambda: Path(tmp_path))

    exe_path = tmp_path / "Photoshop.exe"
    exe_path.write_text("", encoding="utf-8")

    service = CustomAppService()
    created = service.save_app(
        alias="pts",
        target_path=str(exe_path),
        display_name="Adobe Photoshop",
        extra_aliases=["photoshop", "adobe photoshop"],
    )

    assert created["alias"] == "pts"
    assert "photoshop" in created["aliases"]
    assert service.find_app("pts")["target_path"] == str(exe_path.resolve())
    assert service.find_app("photoshop")["id"] == created["id"]

    renamed_exe = tmp_path / "Photoshop 2024.exe"
    renamed_exe.write_text("", encoding="utf-8")
    updated = service.update_app(
        created["id"],
        alias="pts",
        target_path=str(renamed_exe),
        display_name="Adobe Photoshop 2024",
        extra_aliases=["photoshop 2024"],
    )

    assert updated["display_name"] == "Adobe Photoshop 2024"
    assert service.validate_target(updated) is True

    deleted = service.delete_app("pts")
    assert deleted["id"] == created["id"]
    assert service.list_apps() == []


def test_executor_open_app_uses_custom_mapping(tmp_path, monkeypatch):
    monkeypatch.setattr(custom_app_module, "runtime_root", lambda: Path(tmp_path))

    exe_path = tmp_path / "Notepad++.exe"
    exe_path.write_text("", encoding="utf-8")
    CustomAppService().save_app(alias="npp", target_path=str(exe_path), display_name="Notepad++")

    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(
        executor,
        "open_app_target",
        lambda target_path, **kwargs: calls.append((target_path, kwargs.get("app_key", "")))
        or ActionResult.ok("opened custom", app=kwargs.get("app_key", "")),
    )

    result = executor.open_app("npp")

    assert result.status == ActionStatus.SUCCESS
    assert calls == [(str(exe_path.resolve()), "npp")]


def test_executor_open_app_missing_prompts_custom_picker(monkeypatch):
    monkeypatch.setattr(executor, "resolve_office_app_path", lambda app_key: None)
    monkeypatch.setattr(executor, "resolve_app_path", lambda app_query: None)

    result = executor.open_app("my private tool")

    assert result.status == ActionStatus.ERROR
    assert result.error_code == ErrorCode.APP_NOT_FOUND
    assert result.data["prompt_custom_app_selection"] is True
    assert result.data["custom_app_alias"] == "my private tool"


def test_route_custom_app_commands():
    assert route("xem app da luu").type == RouteType.LIST_CUSTOM_APPS
    decision = route("xoa app da luu pts")
    assert decision.type == RouteType.DELETE_CUSTOM_APP
    assert decision.args["app_ref"] == "pts"


def test_route_unknown_open_app_still_routes_open_app(monkeypatch):
    monkeypatch.setattr(executor, "guess_app_name", lambda user_text, allow_prefix=False: None)
    decision = route("mở plarium play")
    assert decision.type == RouteType.OPEN_APP
    assert decision.args["app_name"] == "plarium play"
    assert decision.args["confirm_before_custom_picker"] is True


def test_route_explicit_open_app_skips_extra_confirm(monkeypatch):
    monkeypatch.setattr(executor, "guess_app_name", lambda user_text, allow_prefix=False: None)
    decision = route("mở app plarium play")
    assert decision.type == RouteType.OPEN_APP
    assert decision.args["app_name"] == "plarium play"
    assert decision.args["confirm_before_custom_picker"] is False


def test_engine_asks_before_picker_for_ambiguous_unknown_app(monkeypatch):
    engine = Engine()
    monkeypatch.setattr(executor, "guess_app_name", lambda user_text, allow_prefix=False: None)

    monkeypatch.setattr(
        executor,
        "open_app",
        lambda app_name, confirm_before_custom_picker=False: ActionResult.err(
            "Không tìm thấy ứng dụng.",
            code=ErrorCode.APP_NOT_FOUND,
            prompt_custom_app_selection=True,
            custom_app_alias=app_name,
            custom_app_reason="not_found",
            custom_app_target_path="",
            custom_app_display_name=app_name,
            custom_app_requires_confirmation=confirm_before_custom_picker,
        ),
    )
    monkeypatch.setattr(
        executor,
        "web_search",
        lambda query: ActionResult.ok(f"Đã mở web: {query}", query=query),
    )

    first = engine.handle_turn("mở plarium play")
    assert first.status == ActionStatus.NEED_CLARIFY
    assert "ứng dụng" in first.data["question"].lower()

    second = engine.handle_turn("ứng dụng")
    assert second.status == ActionStatus.ERROR
    assert second.error_code == ErrorCode.APP_NOT_FOUND
    assert second.data["prompt_custom_app_selection"] is True
    assert second.data["custom_app_requires_confirmation"] is False

    engine = Engine()
    monkeypatch.setattr(executor, "guess_app_name", lambda user_text, allow_prefix=False: None)
    monkeypatch.setattr(
        executor,
        "open_app",
        lambda app_name, confirm_before_custom_picker=False: ActionResult.err(
            "Không tìm thấy ứng dụng.",
            code=ErrorCode.APP_NOT_FOUND,
            prompt_custom_app_selection=True,
            custom_app_alias=app_name,
            custom_app_reason="not_found",
            custom_app_target_path="",
            custom_app_display_name=app_name,
            custom_app_requires_confirmation=confirm_before_custom_picker,
        ),
    )
    monkeypatch.setattr(
        executor,
        "web_search",
        lambda query: ActionResult.ok(f"Đã mở web: {query}", query=query),
    )
    first_web = engine.handle_turn("mở plarium play")
    second_web = engine.handle_turn("web")
    assert second_web.status == ActionStatus.SUCCESS
    assert "Đã mở web" in second_web.message
