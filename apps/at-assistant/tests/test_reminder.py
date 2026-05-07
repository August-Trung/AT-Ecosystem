from __future__ import annotations

from pathlib import Path
from datetime import datetime
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.core.router import RouteType, route
from src.core.engine import Engine
from src.core.result import ActionResult
from src.core import executor
import src.plugins.reminder_service as reminder_service
from src.plugins.reminder_service import ReminderService


def test_reminder_service_create_complete_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(reminder_service, "runtime_root", lambda: Path(tmp_path))

    service = ReminderService()
    created = service.create_reminder(
        title="Họp nhóm",
        message="Họp nhóm",
        due_at="2026-03-31T09:00:00+07:00",
    )

    assert created["id"].startswith("rem_")
    assert service.list_reminders()[0]["title"] == "Họp nhóm"

    completed = service.complete_reminder(created["id"])
    assert completed["status"] == "completed"

    deleted = service.delete_reminder(created["id"])
    assert deleted["id"] == created["id"]
    assert service.list_reminders() == []


def test_route_create_reminder():
    decision = route("Nhắc tôi họp nhóm lúc 9h sáng mai")
    assert decision.type == RouteType.CREATE_REMINDER
    assert decision.args["title"] == "họp nhóm"
    assert decision.args["due_at"]


def test_route_import_task_list():
    decision = route(
        "Nhập danh sách công việc\n"
        "Viết báo cáo - 2h - 14:00 12/04/2026 - Pending\n"
        "Gửi slide - 45m - 16:30 12/04/2026 - In progress"
    )
    assert decision.type == RouteType.IMPORT_TASK_LIST
    assert "Viết báo cáo" in decision.args["task_text"]


def test_route_import_task_list_single_line():
    decision = route(
        "nhập danh sách công việc viết báo cáo - 2h - 14:00 12/04/2026 - pending "
        "chuẩn bị slide - 45m - 16:30 12/04/2026 - in progress"
    )
    assert decision.type == RouteType.IMPORT_TASK_LIST


def test_reminder_service_import_task_list(tmp_path, monkeypatch):
    monkeypatch.setattr(reminder_service, "runtime_root", lambda: Path(tmp_path))

    service = ReminderService()
    payload = service.import_task_list(
        "Viết báo cáo - 2h - 14:00 12/04/2026 - Pending\n"
        "Gửi slide - 45m - 16:30 12/04/2026 - In progress\n"
        "Lưu hồ sơ - abc - 18:00 12/04/2026 - Completed"
    )

    assert len(payload["created"]) == 3
    reminders = service.list_reminders()
    assert reminders[0]["metadata"]["task_duration_minutes"] == 120
    assert reminders[1]["status"] == "in_progress"
    assert reminders[2]["status"] == "completed"


def test_reminder_service_import_task_list_single_line(tmp_path, monkeypatch):
    monkeypatch.setattr(reminder_service, "runtime_root", lambda: Path(tmp_path))

    service = ReminderService()
    payload = service.import_task_list(
        "nhập danh sách công việc viết báo cáo - 2h - 14:00 12/04/2026 - pending "
        "chuẩn bị slide - 45m - 16:30 12/04/2026 - in progress "
        "nộp bản cuối - 15m - 18:00 12/04/2026 - completed"
    )

    assert len(payload["created"]) == 3


def test_route_list_complete_delete_reminder():
    assert route("xem reminder").type == RouteType.LIST_REMINDERS
    complete = route("hoàn thành reminder 2")
    assert complete.type == RouteType.COMPLETE_REMINDER
    assert complete.args["index"] == 2

    delete = route("xóa reminder 1")
    assert delete.type == RouteType.DELETE_REMINDER
    assert delete.args["index"] == 1


def test_route_update_and_snooze_reminder():
    update = route("sua reminder 1 thanh nop bao cao luc 10h sang mai")
    assert update.type == RouteType.UPDATE_REMINDER
    assert update.args["index"] == 1
    assert update.args["title"] == "nop bao cao"
    assert update.args["due_at"]

    update_vn = route("sửa nhắc số 1 thành 7 giờ 34 phút tối hôm nay")
    assert update_vn.type == RouteType.UPDATE_REMINDER
    assert update_vn.args["index"] == 1
    assert update_vn.args["due_at"]
    assert update_vn.args["title"] == ""

    snooze = route("nhac lai reminder 1 sau 15 phut")
    assert snooze.type == RouteType.SNOOZE_REMINDER
    assert snooze.args["index"] == 1
    assert snooze.args["minutes"] == 15


def test_engine_can_interrupt_update_clarify_with_list_command(monkeypatch):
    engine = Engine()
    engine.state.pending_clarify_intent = "update_reminder"
    engine.state.pending_clarify_args = {
        "index": None,
        "reminder_id": "",
        "title": "sửa nhắc hẹn",
        "due_at": "",
    }

    reminders = [
        {
            "id": "rem_20260414_001",
            "title": "Viết báo cáo",
            "message": "Viết báo cáo",
            "due_at": "2026-04-14T20:00:00+07:00",
            "status": "pending",
        }
    ]

    monkeypatch.setattr(
        executor,
        "_handle_list_reminders",
        lambda status="": ActionResult.ok("Danh sách reminder:", reminders=reminders),
    )

    res = engine.handle_turn("danh sách nhắc hẹn")

    assert res.status.value == "success"
    assert "Danh sách reminder" in res.message
    assert engine.state.pending_clarify_intent == ""


def test_engine_update_clarify_accepts_followup_with_index(monkeypatch):
    engine = Engine()
    engine.state.pending_clarify_intent = "update_reminder"
    engine.state.pending_clarify_args = {
        "index": None,
        "reminder_id": "",
        "title": "",
        "due_at": "",
    }
    engine.state.last_reminder_results = [
        {
            "id": "rem_20260414_001",
            "title": "Viết báo cáo",
            "message": "Viết báo cáo",
            "due_at": "2026-04-14T20:00:00+07:00",
            "status": "pending",
        }
    ]

    captured: dict[str, str] = {}

    def fake_update(reminder_id: str, title: str = "", message: str = "", due_at: str = ""):
        captured["reminder_id"] = reminder_id
        captured["title"] = title
        captured["due_at"] = due_at
        return ActionResult.ok("Đã cập nhật reminder.", reminder={"id": reminder_id, "title": title, "due_at": due_at})

    monkeypatch.setattr(executor, "_handle_update_reminder", fake_update)
    monkeypatch.setattr(
        executor,
        "_handle_list_reminders",
        lambda status="": ActionResult.ok("Danh sách reminder:", reminders=engine.state.last_reminder_results),
    )

    res = engine.handle_turn("sửa nhắc số 1 thành 7 giờ 34 phút tối hôm nay")

    assert res.status.value == "success"
    assert captured["reminder_id"] == "rem_20260414_001"
    assert captured["due_at"]


def test_route_check_email_listing_commands():
    unread = route("xem email chưa đọc")
    assert unread.type == RouteType.CHECK_EMAIL
    assert unread.args["mode"] == "unread:latest"

    unread_mail = route("xem mail chưa đọc")
    assert unread_mail.type == RouteType.CHECK_EMAIL
    assert unread_mail.args["mode"] == "unread:latest"

    unread_gmail = route("xem gmail chưa đọc")
    assert unread_gmail.type == RouteType.CHECK_EMAIL
    assert unread_gmail.args["mode"] == "unread:latest"

    today = route("xem email hôm nay")
    assert today.type == RouteType.CHECK_EMAIL
    assert today.args["mode"] == "any:today"

    today_gmail = route("xem gmail hôm nay")
    assert today_gmail.type == RouteType.CHECK_EMAIL
    assert today_gmail.args["mode"] == "any:today"

    specific_day = route("check mail ngày 23/3/2026")
    assert specific_day.type == RouteType.CHECK_EMAIL
    assert specific_day.args["mode"] == "any:2026/03/23"

    current = route("check mail ngày 26")
    assert current.type == RouteType.CHECK_EMAIL
    now = datetime.now()
    assert current.args["mode"] == f"any:{now.year}/{now.month:02d}/26"


def test_route_load_more_email():
    more = route("xem thêm email")
    assert more.type == RouteType.LOAD_MORE_EMAILS
    assert more.args == {}

    more_mail = route("xem thêm mail")
    assert more_mail.type == RouteType.LOAD_MORE_EMAILS

    more_gmail = route("xem thêm gmail")
    assert more_gmail.type == RouteType.LOAD_MORE_EMAILS


def test_route_read_email_detail_command():
    detail = route("đọc email 1")
    assert detail.type == RouteType.READ_EMAIL
    assert detail.args["index"] == 1

    detail_mail = route("đọc mail 1")
    assert detail_mail.type == RouteType.READ_EMAIL
    assert detail_mail.args["index"] == 1

    detail_gmail = route("đọc gmail 1")
    assert detail_gmail.type == RouteType.READ_EMAIL
    assert detail_gmail.args["index"] == 1

    detail_en = route("read email 1")
    assert detail_en.type == RouteType.READ_EMAIL
    assert detail_en.args["index"] == 1

    open_en = route("open email 1")
    assert open_en.type == RouteType.READ_EMAIL
    assert open_en.args["index"] == 1


def test_route_email_aliases_for_send_reply_login_archive():
    assert route("gửi mail cho test@example.com").type == RouteType.SEND_EMAIL
    assert route("gửi gmail cho test@example.com").type == RouteType.SEND_EMAIL
    assert route("reply mail 1 nội dung ok").type == RouteType.REPLY_EMAIL
    assert route("reply gmail 1 nội dung ok").type == RouteType.REPLY_EMAIL
    assert route("đăng nhập mail").type == RouteType.EMAIL_LOGIN
    assert route("đăng nhập gmail").type == RouteType.EMAIL_LOGIN
    assert route("archive mail 1").type == RouteType.ARCHIVE_EMAIL
    assert route("archive gmail 1").type == RouteType.ARCHIVE_EMAIL


def test_route_drive_logout_aliases():
    assert route("đăng xuất gg drive").type == RouteType.DRIVE_LOGOUT
    assert route("đăng xuất google drive").type == RouteType.DRIVE_LOGOUT
    assert route("đăng xuất drive").type == RouteType.DRIVE_LOGOUT
    assert route("logout drive").type == RouteType.DRIVE_LOGOUT


def test_engine_load_more_email_uses_saved_pagination(monkeypatch):
    engine = Engine()
    calls = []

    def fake_check_email(mode: str, limit: int = 0, page_token: str = "", append: bool = False):
        calls.append(
            {
                "mode": mode,
                "limit": limit,
                "page_token": page_token,
                "append": append,
            }
        )
        payload = {
            "data": [{"id": "mail-2", "subject": "Mail 2"}],
            "pagination": {
                "mode": mode,
                "page_size": limit or 10,
                "next_page_token": "",
                "append": append,
                "has_more": False,
            },
        }
        return ActionResult.ok("Đã tải thêm email.", json=payload)

    monkeypatch.setattr(executor, "_handle_check_email", fake_check_email)

    engine.state.last_email_mode = "any:latest"
    engine.state.last_email_page_size = 10
    engine.state.last_email_next_page_token = "next-page"
    engine.state.last_email_results = [{"id": "mail-1", "subject": "Mail 1"}]

    res = engine.handle_turn("xem thêm email")

    assert res.status.value == "success"
    assert calls == [
        {
            "mode": "any:latest",
            "limit": 10,
            "page_token": "next-page",
            "append": True,
        }
    ]
    assert [item["id"] for item in engine.state.last_email_results] == ["mail-1", "mail-2"]
