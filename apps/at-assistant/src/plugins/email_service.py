# ========== Email service ===========
# GmailService: giao tiếp với Gmail API
# HiddenEmailService: quản lý email bị ẩn
# ====================================

from __future__ import annotations

import base64
import html
import json
import mimetypes
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Optional

from googleapiclient.discovery import build
from googleapiclient.http import BatchHttpRequest

from src.core.app_paths import ensure_runtime_dir, runtime_root
from src.plugins.google_auth_service import GoogleAuthService


VN_TZ = timezone(timedelta(hours=7))


# ================================
# Hidden Email Service
# ================================


class HiddenEmailService:

    def __init__(self):
        self._cache = None
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "hidden_emails.json"

    def list_hidden(self):
        if self._cache is not None:
            return self._cache

        if not self.path.exists():
            self._cache = []
            return self._cache

        with self.path.open("r", encoding="utf8") as f:
            data = json.load(f)
            self._cache = data.get("hidden", [])

        return self._cache

    def filter_hidden(self, emails):
        hidden = set(self.list_hidden())
        return [e for e in emails if e.get("sender") not in hidden]

    def add(self, email: str) -> bool:
        lst = self.list_hidden()
        email = email.lower().strip()

        if email in lst:
            return False

        lst.append(email)
        self._save(lst)
        return True

    def remove(self, email: str) -> bool:
        lst = self.list_hidden()
        email = email.lower().strip()

        if email not in lst:
            return False

        lst.remove(email)
        self._save(lst)
        return True

    def _save(self, lst):
        with self.path.open("w", encoding="utf8") as f:
            json.dump({"hidden": lst}, f, ensure_ascii=False, indent=2)

        self._cache = lst[:]


# ================================
# Gmail Service
# ================================


class GmailService:

    SCOPES = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.compose",
    ]

    def __init__(self, account_email: str | None = None):
        ensure_runtime_dir("app_settings")
        self.account_email = (account_email or "").strip().lower()
        self.auth_service = GoogleAuthService("gmail")
        self.service = self._get_gmail_service()
        self.hidden_service = HiddenEmailService()

    # ================================
    # AUTH
    # ================================

    def _get_gmail_service(self):
        creds, email = self.auth_service.get_credentials(
            scopes=self.SCOPES,
            account_email=self.account_email or None,
            legacy_token_names=["token.json"],
        )
        self.account_email = email
        return build("gmail", "v1", credentials=creds)

    def get_profile(self) -> dict[str, Any]:
        return self.service.users().getProfile(userId="me").execute()

    def list_sender_aliases(self) -> list[dict[str, Any]]:
        profile = self.get_profile()
        primary_email = (profile.get("emailAddress") or "").strip().lower()
        try:
            response = (
                self.service.users().settings().sendAs().list(userId="me").execute()
            )
            aliases = response.get("sendAs", []) or []
        except Exception:
            aliases = []

        normalized: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in aliases:
            address = (item.get("sendAsEmail") or "").strip().lower()
            if not address or address in seen:
                continue
            seen.add(address)
            normalized.append(
                {
                    "email": address,
                    "display_name": (item.get("displayName") or "").strip(),
                    "is_primary": bool(item.get("isPrimary")),
                    "is_default": bool(item.get("isDefault")),
                    "treat_as_alias": bool(item.get("treatAsAlias", True)),
                }
            )

        if primary_email and primary_email not in seen:
            normalized.insert(
                0,
                {
                    "email": primary_email,
                    "display_name": "",
                    "is_primary": True,
                    "is_default": True,
                    "treat_as_alias": True,
                },
            )

        if not normalized:
            raise RuntimeError("Không lấy được danh sách địa chỉ gửi từ Gmail.")
        return normalized

    def get_sender_signature(self, from_address: str | None = None) -> str:
        aliases = self.list_sender_aliases()
        selected_email = (from_address or "").strip().lower()

        chosen = None
        if selected_email:
            chosen = next(
                (item for item in aliases if item.get("email") == selected_email), None
            )
        if chosen is None:
            chosen = (
                next((item for item in aliases if item.get("is_default")), None)
                or aliases[0]
            )

        alias_email = (chosen.get("email") or "").strip()
        if not alias_email:
            return ""

        try:
            detail = (
                self.service.users()
                .settings()
                .sendAs()
                .get(
                    userId="me",
                    sendAsEmail=alias_email,
                )
                .execute()
            )
        except Exception:
            return ""

        return (detail.get("signature") or "").strip()

    # ================================
    # FETCH EMAILS
    # ================================

    def fetch_emails_page(
        self, query: str = "", max_results: int = 100, page_token: str = ""
    ) -> dict[str, Any]:

        request_kwargs: dict[str, Any] = {
            "userId": "me",
            "q": query,
            "maxResults": max_results,
        }
        if page_token:
            request_kwargs["pageToken"] = page_token

        results = self.service.users().messages().list(**request_kwargs).execute()

        messages = results.get("messages", [])

        if not messages:
            return {
                "emails": [],
                "next_page_token": str(results.get("nextPageToken") or ""),
                "result_size_estimate": int(results.get("resultSizeEstimate") or 0),
            }

        emails = []

        def callback(request_id, response, exception):
            if exception is None and response:
                sender = self.extract_sender(response)
                response["sender"] = sender
                emails.append(response)

        batch = BatchHttpRequest(
            callback=callback, batch_uri="https://gmail.googleapis.com/batch/gmail/v1"
        )

        for msg in messages:

            batch.add(
                self.service.users()
                .messages()
                .get(userId="me", id=msg["id"], format="full")
            )

        batch.execute()

        return {
            "emails": emails,
            "next_page_token": str(results.get("nextPageToken") or ""),
            "result_size_estimate": int(results.get("resultSizeEstimate") or 0),
        }

    def fetch_emails(self, query="", max_results=100):
        page = self.fetch_emails_page(query=query, max_results=max_results)
        return page["emails"]

    def search_emails(
        self, query: str = "", max_results: int = 20
    ) -> list[dict[str, Any]]:
        return self.fetch_emails(query=query, max_results=max_results)

    # ================================
    # QUERY BUILDER
    # ================================

    def get_emails(
        self,
        date: str = None,
        status: str = None,
        limit=100,
        primary_only: bool = False,
    ):
        page = self.get_emails_page(
            date=date,
            status=status,
            limit=limit,
            primary_only=primary_only,
        )
        return page["emails"]

    def get_emails_page(
        self,
        date: str = None,
        status: str = None,
        limit: int = 100,
        primary_only: bool = False,
        page_token: str = "",
    ) -> dict[str, Any]:

        parts = []

        now_vn = datetime.now(timezone.utc).astimezone(VN_TZ)

        def _to_gmail_boundary(dt: datetime) -> str:
            return str(int(dt.astimezone(timezone.utc).timestamp()))

        if date == "today":

            day_start = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            start = _to_gmail_boundary(day_start)
            end = _to_gmail_boundary(day_end)

        elif date == "yesterday":

            day_end = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
            day_start = day_end - timedelta(days=1)
            start = _to_gmail_boundary(day_start)
            end = _to_gmail_boundary(day_end)

        elif date == "latest":
            start = None
            end = None

        elif date and re.fullmatch(r"\d{4}/\d{2}", date):

            month_start = datetime.strptime(f"{date}/01", "%Y/%m/%d")
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)

            month_start = month_start.replace(tzinfo=VN_TZ)
            month_end = month_end.replace(tzinfo=VN_TZ)

            start = _to_gmail_boundary(month_start)
            end = _to_gmail_boundary(month_end)

        elif date:

            d = datetime.strptime(date, "%Y/%m/%d")
            d = d.replace(tzinfo=VN_TZ)

            start = _to_gmail_boundary(d)
            end = _to_gmail_boundary(d + timedelta(days=1))

        else:
            start = None
            end = None

        parts.append("in:inbox")
        if primary_only:
            parts.append("category:primary")

        if start and end:
            parts.append(f"after:{start}")
            parts.append(f"before:{end}")

        if status and status != "any":
            parts.append(f"is:{status}")

        query = " ".join(parts).strip()

        page = self.fetch_emails_page(
            query=query, max_results=limit, page_token=page_token
        )
        emails = self.hidden_service.filter_hidden(page["emails"])
        return {
            "emails": emails,
            "query": query,
            "next_page_token": page["next_page_token"],
            "result_size_estimate": page["result_size_estimate"],
        }

    def get_message(self, message_id: str, format: str = "full") -> dict[str, Any]:
        return (
            self.service.users()
            .messages()
            .get(
                userId="me",
                id=message_id,
                format=format,
            )
            .execute()
        )

    def get_message_detail(self, message_id: str) -> dict[str, Any]:
        msg = self.get_message(message_id, format="full")
        return {
            "id": msg.get("id"),
            "threadId": msg.get("threadId"),
            "from": self.extract_header(msg, "from"),
            "to": self.extract_header(msg, "to"),
            "cc": self.extract_header(msg, "cc"),
            "subject": self.extract_header(msg, "subject"),
            "snippet": msg.get("snippet", ""),
            "body": self.extract_body(msg),
            "labelIds": msg.get("labelIds", []),
            "is_unread": "UNREAD" in (msg.get("labelIds") or []),
        }

    def mark_as_read(self, message_id: str) -> dict[str, Any]:
        return (
            self.service.users()
            .messages()
            .modify(
                userId="me",
                id=message_id,
                body={"removeLabelIds": ["UNREAD"]},
            )
            .execute()
        )

    def mark_as_unread(self, message_id: str) -> dict[str, Any]:
        return (
            self.service.users()
            .messages()
            .modify(
                userId="me",
                id=message_id,
                body={"addLabelIds": ["UNREAD"]},
            )
            .execute()
        )

    def archive_message(self, message_id: str) -> dict[str, Any]:
        return (
            self.service.users()
            .messages()
            .modify(
                userId="me",
                id=message_id,
                body={"removeLabelIds": ["INBOX"]},
            )
            .execute()
        )

    def trash_message(self, message_id: str) -> dict[str, Any]:
        return (
            self.service.users()
            .messages()
            .trash(
                userId="me",
                id=message_id,
            )
            .execute()
        )

    def create_draft(
        self,
        to: str,
        subject: str,
        body: str,
        cc: str | None = None,
        bcc: str | None = None,
    ) -> dict[str, Any]:
        raw = self._build_raw_message(to=to, subject=subject, body=body, cc=cc, bcc=bcc)
        return (
            self.service.users()
            .drafts()
            .create(
                userId="me",
                body={"message": {"raw": raw}},
            )
            .execute()
        )

    def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        cc: str | None = None,
        bcc: str | None = None,
        attachments: list[str] | None = None,
        from_address: str | None = None,
        thread_id: str | None = None,
        in_reply_to: str | None = None,
        references: str | None = None,
        include_signature: bool = False,
    ) -> dict[str, Any]:
        signature_html = (
            self.get_sender_signature(from_address) if include_signature else ""
        )
        raw = self._build_raw_message(
            to=to,
            subject=subject,
            body=body,
            cc=cc,
            bcc=bcc,
            attachments=attachments,
            from_address=from_address,
            in_reply_to=in_reply_to,
            references=references,
            signature_html=signature_html,
        )
        payload: dict[str, Any] = {"raw": raw}
        if thread_id:
            payload["threadId"] = thread_id

        return (
            self.service.users()
            .messages()
            .send(
                userId="me",
                body=payload,
            )
            .execute()
        )

    def reply_email(
        self, message_id: str, body: str, reply_all: bool = False
    ) -> dict[str, Any]:
        original = self.get_message(message_id, format="metadata")
        subject = self.extract_header(original, "subject") or ""
        if not subject.lower().startswith("re:"):
            subject = f"Re: {subject}"

        to = self.extract_header(original, "reply-to") or self.extract_header(
            original, "from"
        )
        cc = self.extract_header(original, "cc") if reply_all else None
        return self.send_email(
            to=to,
            subject=subject,
            body=body,
            cc=cc,
            thread_id=original.get("threadId"),
            in_reply_to=self.extract_header(original, "message-id"),
            references=self.extract_header(original, "references")
            or self.extract_header(original, "message-id"),
        )

    # ================================
    # LOGOUT
    # ================================

    def logout(self):
        removed = False
        for account in self.auth_service.list_accounts():
            token_path = self.auth_service.tokens_dir / Path(account["token_path"]).name
            if token_path.exists():
                token_path.unlink()
                removed = True
        legacy_token = runtime_root() / "app_settings" / "token.json"
        if legacy_token.exists():
            legacy_token.unlink()
            removed = True
        if self.auth_service.active_accounts_path.exists():
            self.auth_service.active_accounts_path.unlink()
            removed = True
        return removed

    # ================================
    # EXTRACT SENDER
    # ================================

    def extract_header(self, msg, name):
        headers = msg.get("payload", {}).get("headers", [])

        for h in headers:
            if h.get("name", "").lower() == name.lower():
                return h.get("value", "")
        return ""

    def extract_sender(self, msg):
        value = self.extract_header(msg, "from")
        if value:
            m = re.search(r"<(.+?)>", value)
            if m:
                return m.group(1).lower().strip()
            return value.lower().strip()
        return None

    def extract_body(self, msg) -> str:
        payload = msg.get("payload") or {}
        body = self._extract_part_body(payload)
        if not body:
            body = msg.get("snippet", "")
        return self._normalize_email_text(body)

    def _extract_part_body(self, part: dict[str, Any]) -> str:
        mime_type = (part.get("mimeType") or "").lower()
        body_data = ((part.get("body") or {}).get("data")) or ""
        if mime_type == "text/plain" and body_data:
            return self._decode_base64url(body_data)

        if mime_type == "text/html" and body_data:
            html_body = self._decode_base64url(body_data)
            return self._html_to_text(html_body)

        # Prefer plain text parts before falling back to HTML parts.
        parts = part.get("parts") or []
        for preferred in ("text/plain", "text/html"):
            for child in parts:
                child_type = (child.get("mimeType") or "").lower()
                if child_type != preferred:
                    continue
                extracted = self._extract_part_body(child)
                if extracted:
                    return extracted

        for child in parts:
            extracted = self._extract_part_body(child)
            if extracted:
                return extracted

        return ""

    def _decode_base64url(self, value: str) -> str:
        padded = value + "=" * (-len(value) % 4)
        try:
            decoded = base64.urlsafe_b64decode(padded.encode("utf-8"))
            return decoded.decode("utf-8", errors="replace")
        except Exception:
            return ""

    def _html_to_text(self, html_body: str) -> str:
        text = html_body or ""
        text = re.sub(
            r"(?is)<(script|style|head|title|meta|link)[^>]*>.*?</\1>", " ", text
        )
        text = re.sub(r"(?i)<br\s*/?>", "\n", text)
        text = re.sub(r"(?i)</p\s*>", "\n\n", text)
        text = re.sub(r"(?i)</div\s*>", "\n", text)
        text = re.sub(r"(?i)</tr\s*>", "\n", text)
        text = re.sub(r"(?i)</td\s*>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = html.unescape(text)
        return self._normalize_email_text(text)

    def _normalize_email_text(self, text: str) -> str:
        cleaned = html.unescape(text or "")
        cleaned = cleaned.replace("\xa0", " ")
        cleaned = cleaned.replace("\r", "\n")
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"(?m)^[ \t]*$", "", cleaned)
        cleaned = re.sub(r"(?m)^\s*(?:\d+\s*)?$", "", cleaned)
        lines = [line.strip() for line in cleaned.split("\n")]
        lines = [line for line in lines if line]
        return "\n".join(lines).strip()

    def _build_raw_message(
        self,
        to: str,
        subject: str,
        body: str,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        attachments: Optional[list[str]] = None,
        from_address: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
        signature_html: Optional[str] = None,
    ) -> str:
        msg = MIMEMultipart("mixed")
        if from_address:
            msg["From"] = from_address
        msg["To"] = to
        msg["Subject"] = subject
        if cc:
            msg["Cc"] = cc
        if bcc:
            msg["Bcc"] = bcc
        if in_reply_to:
            msg["In-Reply-To"] = in_reply_to
        if references:
            msg["References"] = references

        plain_body = body.strip()
        html_body = self._plain_text_to_html(plain_body)
        if signature_html:
            signature_html = signature_html.strip()
            plain_signature = self._html_to_text(signature_html)
            if plain_signature:
                plain_body = f"{plain_body}\n\n{plain_signature}".strip()
            html_body = (
                f"{html_body}<br><br>{signature_html}" if html_body else signature_html
            )

        alternative = MIMEMultipart("alternative")
        alternative.attach(MIMEText(plain_body, "plain", "utf-8"))
        alternative.attach(MIMEText(html_body, "html", "utf-8"))
        msg.attach(alternative)

        for attachment_path in attachments or []:
            self._attach_file(msg, attachment_path)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
        return raw

    def _plain_text_to_html(self, text: str) -> str:
        escaped = html.escape(text or "")
        return escaped.replace("\n", "<br>")

    def _attach_file(self, msg: MIMEMultipart, attachment_path: str) -> None:
        path = os.path.abspath(attachment_path)
        content_type, encoding = mimetypes.guess_type(path)
        if content_type is None or encoding is not None:
            content_type = "application/octet-stream"
        maintype, subtype = content_type.split("/", 1)
        part = MIMEBase(maintype, subtype)
        with open(path, "rb") as f:
            part.set_payload(f.read())
        encoders.encode_base64(part)
        filename = os.path.basename(path)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)
