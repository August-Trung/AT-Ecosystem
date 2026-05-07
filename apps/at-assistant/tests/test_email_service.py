from __future__ import annotations

from src.plugins.email_service import GmailService


def _build_service() -> GmailService:
    return GmailService.__new__(GmailService)


def test_get_emails_uses_inbox_without_primary_filter(monkeypatch):
    service = _build_service()
    captured = {}

    def fake_fetch_emails_page(query="", max_results=100, page_token=""):
        captured["query"] = query
        captured["max_results"] = max_results
        captured["page_token"] = page_token
        return {"emails": [], "next_page_token": "", "result_size_estimate": 0}

    class HiddenStub:
        def filter_hidden(self, emails):
            return emails

    service.fetch_emails_page = fake_fetch_emails_page
    service.hidden_service = HiddenStub()

    service.get_emails(date="today", status="any")

    assert "in:inbox" in captured["query"]
    assert "category:primary" not in captured["query"]


def test_get_emails_latest_does_not_force_date_window(monkeypatch):
    service = _build_service()
    captured = {}

    def fake_fetch_emails_page(query="", max_results=100, page_token=""):
        captured["query"] = query
        captured["max_results"] = max_results
        return {"emails": [], "next_page_token": "", "result_size_estimate": 0}

    class HiddenStub:
        def filter_hidden(self, emails):
            return emails

    service.fetch_emails_page = fake_fetch_emails_page
    service.hidden_service = HiddenStub()

    service.get_emails(date="latest", status="unread")

    assert "is:unread" in captured["query"]
    assert "after:" not in captured["query"]
    assert "before:" not in captured["query"]


def test_get_emails_page_passes_page_token(monkeypatch):
    service = _build_service()
    captured = {}

    def fake_fetch_emails_page(query="", max_results=100, page_token=""):
        captured["query"] = query
        captured["max_results"] = max_results
        captured["page_token"] = page_token
        return {"emails": [], "next_page_token": "next-token", "result_size_estimate": 25}

    class HiddenStub:
        def filter_hidden(self, emails):
            return emails

    service.fetch_emails_page = fake_fetch_emails_page
    service.hidden_service = HiddenStub()

    page = service.get_emails_page(date="today", status="any", limit=20, page_token="abc")

    assert captured["page_token"] == "abc"
    assert captured["max_results"] == 20
    assert page["next_page_token"] == "next-token"
