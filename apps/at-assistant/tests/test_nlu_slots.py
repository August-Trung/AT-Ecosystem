from __future__ import annotations

from datetime import datetime

from src.core.router import RouteType, route


def test_open_app_slot_strips_polite_suffix():
    decision = route("mở word giúp tôi")

    assert decision.type == RouteType.OPEN_APP
    assert decision.args["app_name"] == "word"


def test_find_file_slot_cleans_natural_question():
    decision = route("tài liệu kế hoạch nằm đâu rồi")

    assert decision.type == RouteType.FIND_FILE
    assert decision.args["query"] == "kế hoạch"


def test_find_file_slot_cleans_search_phrase_and_date_noise():
    decision = route("kiếm file hợp đồng hôm qua")

    assert decision.type == RouteType.FIND_FILE
    assert decision.args["query"] == "hợp đồng"


def test_create_reminder_relative_time_slots():
    decision = route("30 phút nữa nhắc tôi nghỉ mắt")

    assert decision.type == RouteType.CREATE_REMINDER
    assert decision.args["title"] == "nghỉ mắt"
    assert decision.args["due_at"]


def test_create_reminder_absolute_time_slots():
    decision = route("ngày mai lúc 7h30 nhắc tôi đi khám")

    due_at = datetime.fromisoformat(decision.args["due_at"])
    assert decision.type == RouteType.CREATE_REMINDER
    assert decision.args["title"] == "đi khám"
    assert due_at.hour == 7
    assert due_at.minute == 30


def test_create_reminder_evening_time_does_not_confuse_toi_pronoun():
    decision = route("8 giờ tối nay nhắc tôi uống thuốc")

    due_at = datetime.fromisoformat(decision.args["due_at"])
    assert decision.type == RouteType.CREATE_REMINDER
    assert decision.args["title"] == "uống thuốc"
    assert due_at.hour == 20
