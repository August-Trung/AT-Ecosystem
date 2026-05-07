from __future__ import annotations

from datetime import datetime, timedelta

from src.plugins.email_auto_check_service import EmailAutoCheckService
from src.gui.email_auto_check_dialog import QUERY_MODE_LABELS


def test_email_query_dropdown_modes_are_supported():
    service = EmailAutoCheckService()

    expected_modes = {
        "unread:today",
        "read:today",
        "any:today",
        "unread:yesterday",
        "read:yesterday",
        "any:yesterday",
        "any:latest",
        "unread:latest",
        "read:latest",
    }

    assert set(QUERY_MODE_LABELS.keys()) == expected_modes
    for mode in QUERY_MODE_LABELS.keys():
        normalized = service._normalize_query({"mode": mode, "limit": 10})
        assert normalized["mode"] == mode


def test_email_auto_check_service_create_and_find(tmp_path):
    service = EmailAutoCheckService()
    service.path = tmp_path / "email_auto_checks.json"

    created = service.create_check(
        name="Mail chưa đọc buổi sáng",
        query={"mode": "unread:today", "limit": 10},
        run_policy={"mode": "repeat", "repeat_count": 3, "repeat_interval_seconds": 15},
        delivery={"show_chat_result": True, "show_notification": True, "only_if_has_new_mail": True},
    )

    assert created["name"] == "Mail chưa đọc buổi sáng"
    assert created["query"]["mode"] == "unread:today"
    assert created["run_policy"]["mode"] == "repeat"
    assert created["run_policy"]["repeat_count"] == 3
    assert created["delivery"]["voice_detail_mode"] == "first_title"
    assert service.find_check("mail chưa đọc buổi sáng") is not None
    assert service.find_check(created["id"]) is not None


def test_email_auto_check_service_due_schedule_and_runtime_state(tmp_path):
    service = EmailAutoCheckService()
    service.path = tmp_path / "email_auto_checks.json"

    created = service.create_check(
        name="Mail theo lịch",
        query={"mode": "any:latest", "limit": 5},
        run_policy={
            "mode": "scheduled",
            "start_delay_seconds": 0,
            "schedule": {"type": "daily", "time": "08:00"},
        },
        delivery={"show_chat_result": False, "show_notification": True, "only_if_has_new_mail": True},
    )

    next_run_at = datetime.fromisoformat(created["state"]["next_run_at"])

    due_before = service.list_due_scheduled_checks(now=next_run_at - timedelta(minutes=1))
    assert due_before == []

    due_after = service.list_due_scheduled_checks(now=next_run_at + timedelta(minutes=1))
    assert len(due_after) == 1
    assert due_after[0]["id"] == created["id"]

    marked = service.mark_check_scheduled_run(created["id"], run_at=datetime(2026, 4, 12, 8, 1))
    assert marked["state"]["last_run_at"] != ""
    assert marked["state"]["next_run_at"] != ""

    updated = service.update_runtime_state(
        created["id"],
        last_run_at=datetime(2026, 4, 12, 8, 2),
        last_seen_message_ids=["a", "b", "a"],
    )
    assert updated["state"]["last_seen_message_ids"] == ["a", "b"]


def test_email_auto_check_service_recomputes_next_run_when_schedule_changes(tmp_path):
    service = EmailAutoCheckService()
    service.path = tmp_path / "email_auto_checks.json"

    created = service.create_check(
        name="Mail đổi giờ",
        query={"mode": "any:today", "limit": 10},
        run_policy={"mode": "scheduled", "schedule": {"type": "daily", "time": "09:24"}},
    )
    old_next_run = created["state"]["next_run_at"]

    updated = service.update_check(
        created["id"],
        run_policy={"mode": "scheduled", "schedule": {"type": "daily", "time": "09:27"}},
    )

    assert updated["state"]["next_run_at"] != old_next_run
    assert "T09:27:" in updated["state"]["next_run_at"]


def test_email_auto_check_service_keeps_supported_voice_mode(tmp_path):
    service = EmailAutoCheckService()
    service.path = tmp_path / "email_auto_checks.json"

    created = service.create_check(
        name="Mail voice",
        delivery={"speak_summary": True, "voice_detail_mode": "up_to_3_titles"},
    )

    assert created["delivery"]["speak_summary"] is True
    assert created["delivery"]["voice_detail_mode"] == "up_to_3_titles"
