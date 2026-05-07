from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root


VN_TZ = timezone(timedelta(hours=7))
VN_TZ_NAME = "Asia/Saigon"
ACTIVE_STATUSES = {"pending", "in_progress"}
COMPLETED_STATUSES = {"done", "completed"}


@dataclass
class ReminderRecord:
    id: str
    title: str
    message: str
    due_at: str
    timezone: str
    status: str
    created_at: str
    updated_at: str
    priority: str
    tags: list[str]
    repeat: dict[str, Any] | None
    notify_before_minutes: list[int]
    delivery_channels: list[str]
    source: str
    metadata: dict[str, Any]


class ReminderService:
    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "reminders.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def create_reminder(
        self,
        *,
        title: str,
        message: str,
        due_at: str,
        timezone_name: str = VN_TZ_NAME,
        status: str = "pending",
        priority: str = "normal",
        tags: list[str] | None = None,
        repeat: dict[str, Any] | None = None,
        notify_before_minutes: list[int] | None = None,
        delivery_channels: list[str] | None = None,
        source: str = "chat",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        title = (title or "").strip()
        message = (message or title).strip()
        due_at = (due_at or "").strip()
        if not title:
            raise ValueError("Thiếu tiêu đề reminder.")
        if not due_at:
            raise ValueError("Thiếu thời điểm nhắc.")

        payload = self._load()
        reminders = payload["reminders"]
        now = self._now_iso()
        reminder_id = self._next_id(reminders)
        record = ReminderRecord(
            id=reminder_id,
            title=title,
            message=message,
            due_at=due_at,
            timezone=timezone_name,
            status=self._normalize_status(status),
            created_at=now,
            updated_at=now,
            priority=(priority or "normal").strip().lower(),
            tags=tags or [],
            repeat=repeat,
            notify_before_minutes=notify_before_minutes or [10],
            delivery_channels=delivery_channels or ["gui"],
            source=source or "chat",
            metadata=metadata or {},
        )
        reminders.append(record.__dict__)
        payload["reminders"] = self._sort_reminders(reminders)
        self._save(payload)
        return record.__dict__

    def list_reminders(self, *, status: str | None = None) -> list[dict[str, Any]]:
        reminders = self._load()["reminders"]
        if status:
            status = self._normalize_status(status)
            if status == "active":
                reminders = [item for item in reminders if self._normalize_status(item.get("status")) in ACTIVE_STATUSES]
            else:
                reminders = [item for item in reminders if self._normalize_status(item.get("status")) == status]
        return self._sort_reminders(reminders)

    def get_reminder(self, reminder_id: str) -> dict[str, Any] | None:
        reminder_id = (reminder_id or "").strip()
        if not reminder_id:
            return None
        for item in self._load()["reminders"]:
            if item.get("id") == reminder_id:
                return item
        return None

    def complete_reminder(self, reminder_id: str) -> dict[str, Any]:
        payload = self._load()
        for item in payload["reminders"]:
            if item.get("id") != reminder_id:
                continue
            item["status"] = "completed"
            item["updated_at"] = self._now_iso()
            self._save(payload)
            return item
        raise FileNotFoundError("Không tìm thấy reminder để hoàn thành.")

    def update_reminder(
        self,
        reminder_id: str,
        *,
        title: str | None = None,
        message: str | None = None,
        due_at: str | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        for item in payload["reminders"]:
            if item.get("id") != reminder_id:
                continue
            if title is not None and title.strip():
                item["title"] = title.strip()
            if message is not None and message.strip():
                item["message"] = message.strip()
            if due_at is not None and due_at.strip():
                item["due_at"] = due_at.strip()
            item["updated_at"] = self._now_iso()
            self._save(payload)
            return item
        raise FileNotFoundError("Không tìm thấy reminder để cập nhật.")

    def snooze_reminder(self, reminder_id: str, *, minutes: int) -> dict[str, Any]:
        if minutes <= 0:
            raise ValueError("Số phút snooze phải lớn hơn 0.")
        payload = self._load()
        for item in payload["reminders"]:
            if item.get("id") != reminder_id:
                continue
            new_due = datetime.now(VN_TZ) + timedelta(minutes=minutes)
            item["due_at"] = new_due.isoformat()
            item["status"] = "pending"
            item["updated_at"] = self._now_iso()
            metadata = item.get("metadata") or {}
            metadata["snoozed_minutes"] = minutes
            item["metadata"] = metadata
            self._save(payload)
            return item
        raise FileNotFoundError("Không tìm thấy reminder để snooze.")

    def delete_reminder(self, reminder_id: str) -> dict[str, Any]:
        payload = self._load()
        reminders = payload["reminders"]
        for idx, item in enumerate(reminders):
            if item.get("id") != reminder_id:
                continue
            deleted = reminders.pop(idx)
            payload["reminders"] = reminders
            self._save(payload)
            return deleted
        raise FileNotFoundError("Không tìm thấy reminder để xóa.")

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"reminders": []}
        with self.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        reminders = data.get("reminders")
        if not isinstance(reminders, list):
            reminders = []
        normalized_reminders: list[dict[str, Any]] = []
        for item in reminders:
            if not isinstance(item, dict):
                continue
            copied = dict(item)
            copied["status"] = self._normalize_status(copied.get("status"))
            metadata = copied.get("metadata")
            copied["metadata"] = metadata if isinstance(metadata, dict) else {}
            normalized_reminders.append(copied)
        return {"reminders": normalized_reminders}

    def list_upcoming_reminders(self, *, limit: int = 5) -> list[dict[str, Any]]:
        reminders = self.list_reminders(status="active")
        upcoming: list[tuple[datetime, dict[str, Any]]] = []
        now = datetime.now(VN_TZ).replace(tzinfo=None)
        for item in reminders:
            due_at = self._parse_due_at(item.get("due_at"))
            if due_at is None:
                continue
            due_sort = due_at.replace(tzinfo=None) if due_at.tzinfo else due_at
            if due_sort < now:
                upcoming.append((due_sort, item))
                continue
            upcoming.append((due_sort, item))
        upcoming.sort(key=lambda pair: (pair[0], str(pair[1].get("id") or "")))
        return [item for _, item in upcoming[: max(limit, 0)]]

    def import_task_list(self, raw_text: str, *, timezone_name: str = VN_TZ_NAME) -> dict[str, Any]:
        lines = self._extract_task_lines(raw_text)
        if not lines:
            raise ValueError("Không tìm thấy dòng công việc hợp lệ để nhập.")

        created: list[dict[str, Any]] = []
        skipped: list[dict[str, Any]] = []
        for index, line in enumerate(lines, start=1):
            try:
                parsed = self._parse_task_line(line)
                duration_minutes = parsed.pop("duration_minutes")
                record = self.create_reminder(
                    title=parsed["title"],
                    message=parsed["message"],
                    due_at=parsed["due_at"],
                    timezone_name=timezone_name,
                    status=parsed["status"],
                    source="task_list",
                    metadata={
                        "task_duration_minutes": duration_minutes,
                        "task_status_input": parsed["status"],
                        "task_line": line,
                    },
                )
                created.append(record)
            except Exception as exc:
                skipped.append({"line_number": index, "line": line, "error": str(exc)})
        return {"created": created, "skipped": skipped}

    def _save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _next_id(self, reminders: list[dict[str, Any]]) -> str:
        prefix = datetime.now(VN_TZ).strftime("rem_%Y%m%d_")
        used: set[int] = set()
        for item in reminders:
            raw_id = str(item.get("id") or "")
            if not raw_id.startswith(prefix):
                continue
            suffix = raw_id.removeprefix(prefix)
            if suffix.isdigit():
                used.add(int(suffix))
        next_num = 1
        while next_num in used:
            next_num += 1
        return f"{prefix}{next_num:03d}"

    def _sort_reminders(self, reminders: list[dict[str, Any]]) -> list[dict[str, Any]]:
        def sort_key(item: dict[str, Any]) -> tuple[int, str, str]:
            status = self._normalize_status(item.get("status"))
            done_rank = 1 if status in COMPLETED_STATUSES else 0
            return (done_rank, str(item.get("due_at") or ""), str(item.get("id") or ""))

        return sorted(reminders, key=sort_key)

    def _now_iso(self) -> str:
        return datetime.now(VN_TZ).isoformat()

    def _normalize_status(self, status: Any) -> str:
        value = str(status or "").strip().lower()
        mapping = {
            "active": "active",
            "pending": "pending",
            "todo": "pending",
            "to do": "pending",
            "to-do": "pending",
            "in progress": "in_progress",
            "in_progress": "in_progress",
            "doing": "in_progress",
            "processing": "in_progress",
            "completed": "completed",
            "complete": "completed",
            "done": "completed",
            "finished": "completed",
        }
        return mapping.get(value, "pending")

    def _extract_task_lines(self, raw_text: str) -> list[str]:
        text = str(raw_text or "").strip()
        if not text:
            return []
        text = re.sub(
            r"^(?:nhập danh sách công việc|nhap danh sach cong viec|danh sách công việc|danh sach cong viec|import task list)\s*[:.]?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        # GUI chat hiện là ô nhập một dòng; tách các task theo trạng thái kết thúc.
        text = re.sub(
            r"\s+(pending|in progress|in_progress|completed|done)(?=\s+\S)",
            lambda match: f" {match.group(1)}\n",
            text,
            flags=re.IGNORECASE,
        )
        raw_lines = [line.strip(" .") for line in text.splitlines() if line.strip(" .")]
        lines: list[str] = []
        for line in raw_lines:
            cleaned = re.sub(r"^(?:[-*•]|\d+[.)])\s*", "", line).strip()
            if not cleaned:
                continue
            lower = cleaned.lower()
            if "tên công việc" in lower and "đến hạn" in lower:
                continue
            if any(token in lower for token in ("nhập danh sách công việc", "danh sách công việc", "task list", "import task")):
                continue
            lines.append(cleaned)
        return lines

    def _parse_task_line(self, line: str) -> dict[str, Any]:
        if "|" in line:
            parts = [part.strip() for part in line.split("|")]
        else:
            parts = [part.strip() for part in line.split(" - ")]
        if len(parts) != 4:
            raise ValueError("Mỗi dòng phải có 4 phần: tên - thời gian thực hiện - thời gian đến hạn - trạng thái.")

        title, duration_text, due_text, status_text = parts
        if not title:
            raise ValueError("Thiếu tên công việc.")
        due_at = self._parse_task_due_at(due_text)
        if not due_at:
            raise ValueError("Không đọc được thời gian đến hạn.")
        return {
            "title": title,
            "message": title,
            "due_at": due_at,
            "status": self._normalize_status(status_text),
            "duration_minutes": self._parse_duration_minutes(duration_text),
        }

    def _parse_duration_minutes(self, raw_duration: str) -> int:
        text = str(raw_duration or "").strip().lower()
        if not text:
            return 0
        if text.isdigit():
            return int(text)
        matches = re.findall(r"(\d+)\s*(h|hr|hrs|hour|hours|gio|ti[eê]ng|m|min|mins|minute|minutes|phut|p)", text)
        total_minutes = 0
        for amount_text, unit in matches:
            amount = int(amount_text)
            if unit in {"h", "hr", "hrs", "hour", "hours", "gio", "tiếng", "tieng"}:
                total_minutes += amount * 60
            else:
                total_minutes += amount
        return total_minutes

    def _parse_task_due_at(self, raw_due_at: str) -> str:
        value = str(raw_due_at or "").strip()
        if not value:
            return ""
        parsed = self._parse_due_at(value)
        if parsed is None:
            return ""
        return parsed.isoformat()

    def _parse_due_at(self, raw_due_at: Any) -> datetime | None:
        value = str(raw_due_at or "").strip()
        if not value:
            return None
        formats = (
            None,
            "%d/%m/%Y %H:%M",
            "%H:%M %d/%m/%Y",
            "%d-%m-%Y %H:%M",
            "%H:%M %d-%m-%Y",
            "%d/%m/%Y %H:%M:%S",
            "%Y-%m-%d %H:%M",
        )
        for fmt in formats:
            try:
                if fmt is None:
                    parsed = datetime.fromisoformat(value)
                else:
                    parsed = datetime.strptime(value, fmt)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=VN_TZ)
                return parsed
            except ValueError:
                continue
        return None
