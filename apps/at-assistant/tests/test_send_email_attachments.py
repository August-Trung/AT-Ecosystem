from __future__ import annotations

import base64
from email import message_from_bytes

from src.core import executor
from src.plugins.email_service import GmailService


def _decode_raw_message(raw: str):
    padded = raw + "=" * (-len(raw) % 4)
    return message_from_bytes(base64.urlsafe_b64decode(padded.encode("utf-8")))


def test_gmail_service_build_raw_message_supports_multiple_attachments(tmp_path):
    first = tmp_path / "alpha.txt"
    second = tmp_path / "beta.pdf"
    first.write_text("alpha", encoding="utf-8")
    second.write_text("beta", encoding="utf-8")

    service = GmailService.__new__(GmailService)
    raw = service._build_raw_message(
        to="recipient@example.com",
        subject="Test",
        body="Hello",
        attachments=[str(first), str(second)],
    )
    message = _decode_raw_message(raw)

    attachments = [
        part
        for part in message.walk()
        if part.get_content_disposition() == "attachment"
    ]
    filenames = [part.get_filename() for part in attachments]

    assert len(attachments) == 2
    assert filenames == ["alpha.txt", "beta.pdf"]


def test_executor_send_email_forwards_attachments(monkeypatch):
    captured: dict[str, object] = {}

    class FakeMemoryService:
        def get_preference(self, key: str, default: str = "") -> str:
            return "sender@example.com" if key == "gmail_default_account" else default

    class FakeGmailService:
        def __init__(self, account_email: str | None = None):
            captured["account_email"] = account_email

        def send_email(self, **kwargs):
            captured["send_email_kwargs"] = kwargs
            return {"id": "msg-1"}

    monkeypatch.setattr(executor, "PersonalMemoryService", FakeMemoryService)
    monkeypatch.setattr(executor, "GmailService", FakeGmailService)

    result = executor._handle_send_email(
        to="recipient@example.com",
        subject="Hello",
        body="Body",
        attachments=["C:/tmp/a.txt", "C:/tmp/b.pdf"],
    )

    assert result.status.name == "SUCCESS"
    assert captured["account_email"] == "sender@example.com"
    assert captured["send_email_kwargs"]["attachments"] == [
        "C:/tmp/a.txt",
        "C:/tmp/b.pdf",
    ]
