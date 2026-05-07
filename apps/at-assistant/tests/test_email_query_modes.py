from __future__ import annotations

from datetime import datetime, timedelta, timezone

from src.core import executor
from src.plugins.email_service import GmailService, VN_TZ


class _FakeGmailService:
    captured_queries: list[tuple[str | None, str | None, int]]

    def __init__(self):
        self.captured_queries = []

    def get_emails_page(self, *, date=None, status=None, limit=100, page_token=""):
        self.captured_queries.append((date, status, limit))
        return {
            "emails": [],
            "next_page_token": "",
            "result_size_estimate": 0,
        }


def test_all_email_query_modes_dispatch_to_expected_gmail_filters(monkeypatch):
    fake = _FakeGmailService()
    monkeypatch.setattr(executor, "GmailService", lambda: fake)

    cases = [
        ("unread:today", ("today", "unread")),
        ("read:today", ("today", "read")),
        ("any:today", ("today", "any")),
        ("unread:yesterday", ("yesterday", "unread")),
        ("read:yesterday", ("yesterday", "read")),
        ("any:yesterday", ("yesterday", "any")),
        ("any:latest", ("latest", "any")),
        ("unread:latest", ("latest", "unread")),
        ("read:latest", ("latest", "read")),
    ]

    for mode, expected in cases:
        fake.captured_queries.clear()
        result = executor._handle_check_email(mode=mode, limit=10)
        assert result.status.value == "success"
        assert fake.captured_queries == [(expected[0], expected[1], 10)]


def test_gmail_today_query_uses_vietnam_time_boundaries_as_timestamps():
    service = GmailService.__new__(GmailService)

    captured: dict[str, object] = {}

    class _HiddenService:
        def filter_hidden(self, emails):
            return emails

    def _fake_fetch(*, query="", max_results=100, page_token=""):
        captured["query"] = query
        captured["max_results"] = max_results
        captured["page_token"] = page_token
        return {
            "emails": [],
            "next_page_token": "",
            "result_size_estimate": 0,
        }

    service.hidden_service = _HiddenService()
    service.fetch_emails_page = _fake_fetch

    class _FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            base = datetime(2026, 4, 12, 10, 15, 0, tzinfo=VN_TZ)
            if tz is None:
                return base.replace(tzinfo=None)
            return base.astimezone(tz)

    try:
        import src.plugins.email_service as email_service_module

        email_service_module.datetime = _FixedDateTime
        page = service.get_emails_page(date="today", status="any", limit=10)
    finally:
        import src.plugins.email_service as email_service_module

        email_service_module.datetime = datetime

    assert page["emails"] == []
    start_ts = int(datetime(2026, 4, 12, 0, 0, 0, tzinfo=VN_TZ).astimezone(timezone.utc).timestamp())
    end_ts = int((datetime(2026, 4, 12, 0, 0, 0, tzinfo=VN_TZ) + timedelta(days=1)).astimezone(timezone.utc).timestamp())
    assert captured["query"] == f"in:inbox after:{start_ts} before:{end_ts}"
