from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.engine import Engine
from src.core.router import RouteType, route
from src.core.result import ActionResult, ActionStatus
import src.core.executor as executor_module
import src.plugins.personal_memory_service as memory_service_module
from src.plugins.personal_memory_service import PersonalMemoryService


def test_personal_memory_service_set_delete_and_clear(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    service = PersonalMemoryService()
    service.set_value("gmail_default_account", "abc@gmail.com")
    service.set_value("favorite_report_folder", "Documents/BaoCao")
    service.set_value("name", "Khoa")

    payload = service.view_memory()
    assert payload["preferences"]["gmail_default_account"] == "abc@gmail.com"
    assert payload["preferences"]["favorite_report_folder"] == "Documents/BaoCao"
    assert payload["profile"]["name"] == "Khoa"
    assert len(payload["history"]) == 3

    deleted = service.delete_key("gmail_default_account")
    assert deleted["key"] == "preferences.gmail_default_account"
    assert service.view_memory()["preferences"].get("gmail_default_account") == ""

    service.append_recent_action(
        command="mở notepad",
        status="success",
        result_message="Đã mở notepad",
    )
    cleared = service.clear_history()
    assert cleared["history_cleared"] >= 1
    assert cleared["recent_actions_cleared"] == 1
    payload = service.view_memory()
    assert payload["history"] == []
    assert payload["recent_actions"] == []


def test_personal_memory_service_entities_and_pinned_knowledge(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    service = PersonalMemoryService()
    entity = service.set_entity("anh Nam", "nam@example.com", kind="person")
    pinned = service.add_pinned_knowledge("deadline demo", "Demo vào thứ 6")

    assert entity["value"] == "nam@example.com"
    assert service.get_entity("anh Nam")["kind"] == "person"
    assert service.list_pinned_knowledge()[0]["title"] == "deadline demo"

    deleted_entity = service.delete_entity("anh Nam")
    deleted_pinned = service.delete_pinned_knowledge("deadline demo")
    assert deleted_entity["alias"] == "anh Nam"
    assert deleted_pinned["title"] == "deadline demo"


def test_route_memory_commands():
    assert route("xem memory").type == RouteType.VIEW_MEMORY
    assert route("clear history").type == RouteType.CLEAR_MEMORY_HISTORY
    assert route("xem entity").type == RouteType.VIEW_ENTITY_MEMORY
    assert route("xem ghi chú ghim").type == RouteType.VIEW_PINNED_KNOWLEDGE

    delete_decision = route("xóa memory gmail_default_account")
    assert delete_decision.type == RouteType.DELETE_MEMORY_KEY
    assert delete_decision.args["key"] == "gmail_default_account"

    set_gmail = route("gmail mặc định là test@example.com")
    assert set_gmail.type == RouteType.SET_MEMORY
    assert set_gmail.args["key"] == "gmail_default_account"
    assert set_gmail.args["value"] == "test@example.com"

    set_name = route("tên tôi là Khoa")
    assert set_name.type == RouteType.SET_MEMORY
    assert set_name.args["key"] == "name"
    assert set_name.args["value"] == "Khoa"

    set_entity = route("nhớ anh Nam là nam@example.com")
    assert set_entity.type == RouteType.SET_ENTITY_MEMORY
    assert set_entity.args["alias"] == "anh Nam"

    set_pinned = route("ghim deadline demo: Demo vào thứ 6")
    assert set_pinned.type == RouteType.ADD_PINNED_KNOWLEDGE
    assert set_pinned.args["title"] == "deadline demo"


def test_engine_memory_commands_and_recent_actions(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    engine = Engine()

    res1 = engine.handle_turn("gmail mặc định là test@example.com")
    assert res1.status == ActionStatus.SUCCESS

    res2 = engine.handle_turn("tên tôi là Khoa")
    assert res2.status == ActionStatus.SUCCESS

    res3 = engine.handle_turn("xem memory")
    assert res3.status == ActionStatus.SUCCESS
    memory_payload = res3.data["memory"]
    assert memory_payload["preferences"]["gmail_default_account"] == "test@example.com"
    assert memory_payload["profile"]["name"] == "Khoa"

    res4 = engine.handle_turn("xóa memory gmail_default_account")
    assert res4.status == ActionStatus.SUCCESS

    res5 = engine.handle_turn("clear history")
    assert res5.status == ActionStatus.NEED_CONFIRM

    res6 = engine.handle_turn("yes")
    assert res6.status == ActionStatus.SUCCESS

    payload = PersonalMemoryService().view_memory()
    assert payload["history"] == []
    assert payload["recent_actions"] == []


def test_personal_memory_auto_learns_apps_folders_and_prompt_style(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    service = PersonalMemoryService()
    service.learn_from_action(
        command="mở word",
        status="success",
        result_message="Đã mở word",
        metadata={"app": "word"},
    )
    service.learn_from_action(
        command="mở file báo cáo tháng 3",
        status="success",
        result_message="Đã mở file",
        metadata={"path": r"D:\Reports\thang3\bao_cao.xlsx"},
    )
    service.learn_from_action(
        command="hãy mở file báo cáo mới nhất giúp tôi",
        status="success",
        result_message="Đã mở file",
        metadata={"path": r"D:\Reports\thang3\bao_cao.xlsx"},
    )

    payload = service.view_memory()
    assert payload["profile"]["preferred_apps"][0] == "word"
    assert r"D:\Reports\thang3" in payload["profile"]["frequent_folders"]
    assert payload["preferences"]["favorite_report_folder"] == r"D:\Reports\thang3"
    assert payload["profile"]["favorite_prompt_style"] in {"ngắn gọn", "tự nhiên"}
    assert len(payload["recent_actions"]) == 3


def test_engine_reopens_recent_file_from_personal_context(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    service = PersonalMemoryService()
    service.append_recent_action(
        command="mở báo cáo",
        status="success",
        result_message="Đã mở file: bao_cao.xlsx",
        metadata={"path": r"D:\Reports\bao_cao.xlsx"},
    )

    monkeypatch.setattr(
        executor_module,
        "open_file",
        lambda path: ActionResult.ok("Đã mở lại file", path=path),
    )

    engine = Engine()
    res = engine.handle_turn("mở lại file lúc nãy")
    assert res.status == ActionStatus.SUCCESS
    assert res.data["path"] == r"D:\Reports\bao_cao.xlsx"


def test_engine_resolves_entity_and_recent_recipient_for_email(tmp_path, monkeypatch):
    monkeypatch.setattr(memory_service_module, "runtime_root", lambda: Path(tmp_path))

    service = PersonalMemoryService()
    service.set_entity("anh Nam", "nam@example.com", kind="person")
    service.append_recent_action(
        command="gửi email cho anh Nam",
        status="success",
        result_message="Đã gửi email tới nam@example.com",
        metadata={"to": "nam@example.com", "subject": "Cũ"},
    )

    engine = Engine()

    res1 = engine.handle_turn("gửi email cho anh Nam tiêu đề Test nội dung Xin chào")
    assert res1.status == ActionStatus.NEED_CONFIRM
    assert res1.data["args"]["to"] == "nam@example.com"

    res2 = engine.handle_turn("gửi email cho người đó tiêu đề Lần 2 nội dung Follow up")
    assert res2.status == ActionStatus.NEED_CONFIRM
    assert res2.data["args"]["to"] == "nam@example.com"
