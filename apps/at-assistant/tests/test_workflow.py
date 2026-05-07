from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core import executor
from src.core.result import ActionResult
from src.core.router import RouteType, route
from src.core.engine import Engine
from src.core.workflow_parser import parse_create_workflow_request
import src.plugins.workflow_service as workflow_module
from src.plugins.workflow_service import WorkflowService


def test_workflow_service_crud(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))

    service = WorkflowService()
    created = service.create_workflow(
        name="Morning",
        description="Open tools for work",
        steps=[
            {"type": "open_app", "params": {"app_name": "edge"}},
            {"type": "open_url", "params": {"url": "https://facebook.com", "browser": "edge"}},
            {"type": "wait", "params": {"seconds": 1}},
        ],
        continue_on_error=True,
    )

    assert created["id"].startswith("wf_")
    assert len(created["steps"]) == 3
    assert service.find_workflow("Morning")["id"] == created["id"]
    assert created["run_policy"]["mode"] == "manual"

    updated = service.update_workflow(
        created["id"],
        description="Updated description",
        steps=[
            {"type": "open_app", "params": {"app_name": "notepad"}},
        ],
        enabled=False,
        run_policy={
            "mode": "repeat",
            "repeat_count": 3,
            "repeat_interval_seconds": 5,
            "start_delay_seconds": 2,
        },
    )
    assert updated["description"] == "Updated description"
    assert updated["steps"][0]["params"]["app_name"] == "notepad"
    assert updated["enabled"] is False
    assert updated["run_policy"]["mode"] == "repeat"
    assert updated["run_policy"]["repeat_count"] == 3

    deleted = service.delete_workflow(created["id"])
    assert deleted["id"] == created["id"]
    assert service.list_workflows() == []


def test_route_workflow_commands():
    assert route("xem workflow").type == RouteType.LIST_WORKFLOWS

    run_decision = route("chạy workflow Morning")
    assert run_decision.type == RouteType.RUN_WORKFLOW
    assert run_decision.args["workflow_ref"] == "Morning"

    delete_decision = route("xóa workflow Morning")
    assert delete_decision.type == RouteType.DELETE_WORKFLOW
    assert delete_decision.args["workflow_ref"] == "Morning"


def test_executor_run_workflow_success(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))
    service = WorkflowService()
    service.create_workflow(
        name="Morning",
        steps=[
            {"type": "open_app", "params": {"app_name": "edge"}},
            {"type": "open_url", "params": {"url": "https://youtube.com", "browser": "edge"}},
            {"type": "wait", "params": {"seconds": 0.2}},
        ],
    )

    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(executor, "open_app", lambda app_name: calls.append(("open_app", app_name)) or ActionResult.ok("opened"))
    monkeypatch.setattr(executor, "open_url", lambda url, browser="default": calls.append(("open_url", f"{browser}:{url}")) or ActionResult.ok("opened url"))
    monkeypatch.setattr(executor.time, "sleep", lambda seconds: calls.append(("wait", str(seconds))))

    result = executor._handle_run_workflow("Morning")

    assert result.status.value == "success"
    assert calls == [
        ("open_app", "edge"),
        ("open_url", "edge:https://youtube.com"),
        ("wait", "0.2"),
    ]


def test_executor_run_workflow_repeat_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))
    service = WorkflowService()
    service.create_workflow(
        name="Repeat flow",
        steps=[
            {"type": "open_app", "params": {"app_name": "edge"}},
        ],
        run_policy={
            "mode": "repeat",
            "repeat_count": 3,
            "repeat_interval_seconds": 1.5,
            "start_delay_seconds": 2,
        },
    )

    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(executor, "open_app", lambda app_name: calls.append(("open_app", app_name)) or ActionResult.ok("opened"))
    monkeypatch.setattr(executor.time, "sleep", lambda seconds: calls.append(("sleep", str(seconds))))

    result = executor._handle_run_workflow("Repeat flow")

    assert result.status.value == "success"
    assert calls == [
        ("sleep", "2.0"),
        ("open_app", "edge"),
        ("sleep", "1.5"),
        ("open_app", "edge"),
        ("sleep", "1.5"),
        ("open_app", "edge"),
    ]


def test_workflow_service_due_scheduled(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))
    service = WorkflowService()
    created = service.create_workflow(
        name="Daily flow",
        steps=[
            {"type": "open_app", "params": {"app_name": "notepad"}},
        ],
        run_policy={
            "mode": "scheduled",
            "start_delay_seconds": 0,
            "schedule": {"type": "daily", "time": "08:00"},
        },
    )

    due_before = service.list_due_scheduled_workflows(now=datetime.fromisoformat("2026-04-11T07:59:00+07:00"))
    assert due_before == []

    payload = service._load()
    payload["workflows"][0]["run_state"]["next_run_at"] = "2026-04-11T08:00:00+07:00"
    service._save(payload)

    due_after = service.list_due_scheduled_workflows(now=datetime.fromisoformat("2026-04-11T08:01:00+07:00"))
    assert [item["id"] for item in due_after] == [created["id"]]

    marked = service.mark_workflow_scheduled_run(created["id"], run_at=datetime.fromisoformat("2026-04-11T08:01:00+07:00"))
    assert marked["run_state"]["last_run_at"].startswith("2026-04-11T08:01:00")
    assert marked["run_state"]["next_run_at"].startswith("2026-04-12T08:00:00")


def test_executor_run_workflow_stop_on_error(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))
    service = WorkflowService()
    service.create_workflow(
        name="Broken flow",
        steps=[
            {"type": "open_app", "params": {"app_name": "missing-app"}},
            {"type": "open_app", "params": {"app_name": "notepad"}},
        ],
        continue_on_error=False,
    )

    calls: list[str] = []

    def fake_open_app(app_name: str):
        calls.append(app_name)
        if app_name == "missing-app":
            return ActionResult.err("missing app")
        return ActionResult.ok("opened")

    monkeypatch.setattr(executor, "open_app", fake_open_app)

    result = executor._handle_run_workflow("Broken flow")

    assert result.status.value == "error"
    assert calls == ["missing-app"]


def test_parse_create_workflow_request():
    draft = parse_create_workflow_request(
        "tạo workflow buổi sáng gồm mở edge, mở facebook, mở youtube, chờ 2 giây, mở word"
    )
    assert draft["name"] == "buổi sáng"
    assert [item["type"] for item in draft["steps"]] == [
        "open_app",
        "open_url",
        "open_url",
        "wait",
        "open_app",
    ]
    assert draft["steps"][1]["params"]["url"] == "https://facebook.com"


def test_engine_workflow_draft_create_edit_save(tmp_path, monkeypatch):
    monkeypatch.setattr(workflow_module, "runtime_root", lambda: Path(tmp_path))

    engine = Engine()

    res1 = engine.handle_turn("tạo workflow buổi sáng gồm mở edge, mở facebook")
    assert res1.status.value == "need_clarify"
    assert "Tên workflow: buổi sáng" in res1.message

    res2 = engine.handle_turn("thêm chờ 2 giây")
    assert res2.status.value == "need_clarify"
    assert "Chờ 2.0 giây" in res2.message

    res3 = engine.handle_turn("đổi bước 2 thành mở youtube")
    assert res3.status.value == "need_clarify"
    assert "https://youtube.com" in res3.message

    res4 = engine.handle_turn("lưu lại")
    assert res4.status.value == "success"
    assert "Đã lưu workflow" in res4.message

    service = WorkflowService()
    workflows = service.list_workflows()
    assert len(workflows) == 1
    assert workflows[0]["name"] == "buổi sáng"
    assert workflows[0]["steps"][1]["params"]["url"] == "https://youtube.com"
