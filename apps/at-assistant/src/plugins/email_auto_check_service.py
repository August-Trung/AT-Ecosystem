from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, time as dt_time, timedelta, timezone
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root


VN_TZ = timezone(timedelta(hours=7))
ALLOWED_RUN_MODES = {"manual", "repeat", "scheduled"}
ALLOWED_SCHEDULE_TYPES = {"daily", "weekly"}
WEEKDAY_INDEX = {
    "mon": 0,
    "tue": 1,
    "wed": 2,
    "thu": 3,
    "fri": 4,
    "sat": 5,
    "sun": 6,
}
ALLOWED_QUERY_MODES = {
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
ALLOWED_VOICE_DETAIL_MODES = {"count_only", "first_title", "up_to_3_titles"}


class EmailAutoCheckService:
    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "email_auto_checks.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def list_checks(self, *, enabled_only: bool = False) -> list[dict[str, Any]]:
        checks = self._load()["checks"]
        if enabled_only:
            checks = [item for item in checks if bool(item.get("enabled", True))]
        return self._sort_checks(checks)

    def get_check(self, check_id: str) -> dict[str, Any] | None:
        check_id = (check_id or "").strip()
        if not check_id:
            return None
        for item in self._load()["checks"]:
            if str(item.get("id") or "").strip() == check_id:
                return item
        return None

    def find_check(self, ref: str) -> dict[str, Any] | None:
        lowered = (ref or "").strip().lower()
        if not lowered:
            return None
        for item in self._load()["checks"]:
            if str(item.get("id") or "").strip().lower() == lowered:
                return item
        for item in self._load()["checks"]:
            if str(item.get("name") or "").strip().lower() == lowered:
                return item
        for item in self._load()["checks"]:
            name = str(item.get("name") or "").strip().lower()
            if lowered in name:
                return item
        return None

    def create_check(
        self,
        *,
        name: str,
        query: dict[str, Any] | None = None,
        enabled: bool = True,
        run_policy: dict[str, Any] | None = None,
        delivery: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ValueError("Thiếu tên kiểm tra mail.")

        payload = self._load()
        checks = payload["checks"]
        if self._name_exists(checks, normalized_name):
            raise ValueError("Tên kiểm tra mail đã tồn tại.")

        normalized_query = self._normalize_query(query or {})
        normalized_policy = self._normalize_run_policy(run_policy or {})
        normalized_delivery = self._normalize_delivery(delivery or {})
        now = self._now_iso()
        check = {
            "id": self._next_check_id(checks),
            "name": normalized_name,
            "enabled": bool(enabled),
            "query": normalized_query,
            "run_policy": normalized_policy,
            "delivery": normalized_delivery,
            "state": self._build_state(normalized_policy),
            "created_at": now,
            "updated_at": now,
        }
        checks.append(check)
        payload["checks"] = self._sort_checks(checks)
        self._save(payload)
        return deepcopy(check)

    def update_check(
        self,
        check_id: str,
        *,
        name: str | None = None,
        query: dict[str, Any] | None = None,
        enabled: bool | None = None,
        run_policy: dict[str, Any] | None = None,
        delivery: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        checks = payload["checks"]
        check_id = (check_id or "").strip()
        for item in checks:
            if str(item.get("id") or "").strip() != check_id:
                continue
            if name is not None:
                normalized_name = (name or "").strip()
                if not normalized_name:
                    raise ValueError("Thiếu tên kiểm tra mail.")
                if self._name_exists(checks, normalized_name, exclude_id=check_id):
                    raise ValueError("Tên kiểm tra mail đã tồn tại.")
                item["name"] = normalized_name
            if query is not None:
                item["query"] = self._normalize_query(query)
            else:
                item["query"] = self._normalize_query(item.get("query") or {})
            if enabled is not None:
                item["enabled"] = bool(enabled)
            if run_policy is not None:
                previous_state = dict(item.get("state") or {})
                normalized_policy = self._normalize_run_policy(run_policy)
                item["run_policy"] = normalized_policy
                preserved_state = {
                    "last_run_at": previous_state.get("last_run_at", ""),
                    "last_seen_message_ids": list(previous_state.get("last_seen_message_ids") or []),
                }
                item["state"] = self._build_state(
                    normalized_policy,
                    previous_state=preserved_state,
                    next_run_seed=datetime.now(VN_TZ),
                )
            else:
                item["run_policy"] = self._normalize_run_policy(item.get("run_policy") or {})
                item["state"] = self._build_state(item["run_policy"], previous_state=item.get("state") or {})
            if delivery is not None:
                item["delivery"] = self._normalize_delivery(delivery)
            else:
                item["delivery"] = self._normalize_delivery(item.get("delivery") or {})
            item["updated_at"] = self._now_iso()
            payload["checks"] = self._sort_checks(checks)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy cấu hình kiểm tra mail để cập nhật.")

    def delete_check(self, check_id: str) -> dict[str, Any]:
        payload = self._load()
        checks = payload["checks"]
        check_id = (check_id or "").strip()
        for index, item in enumerate(checks):
            if str(item.get("id") or "").strip() != check_id:
                continue
            deleted = checks.pop(index)
            payload["checks"] = checks
            self._save(payload)
            return deepcopy(deleted)
        raise FileNotFoundError("Không tìm thấy cấu hình kiểm tra mail để xóa.")

    def list_due_scheduled_checks(self, *, now: datetime | None = None) -> list[dict[str, Any]]:
        current = self._ensure_tz(now or datetime.now(VN_TZ))
        due: list[dict[str, Any]] = []
        for item in self.list_checks(enabled_only=True):
            policy = item.get("run_policy") or {}
            if policy.get("mode") != "scheduled":
                continue
            next_run_at = self._parse_iso(item.get("state", {}).get("next_run_at", ""))
            if next_run_at is not None and next_run_at <= current:
                due.append(item)
        return due

    def mark_check_scheduled_run(self, check_id: str, *, run_at: datetime | None = None) -> dict[str, Any]:
        payload = self._load()
        checks = payload["checks"]
        current = self._ensure_tz(run_at or datetime.now(VN_TZ))
        check_id = (check_id or "").strip()
        for item in checks:
            if str(item.get("id") or "").strip() != check_id:
                continue
            policy = self._normalize_run_policy(item.get("run_policy") or {})
            item["run_policy"] = policy
            item["state"] = self._build_state(
                policy,
                previous_state=item.get("state") or {},
                last_run_at=current,
                next_run_seed=current,
            )
            item["updated_at"] = self._now_iso()
            payload["checks"] = self._sort_checks(checks)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy cấu hình kiểm tra mail để cập nhật lịch chạy.")

    def update_runtime_state(
        self,
        check_id: str,
        *,
        last_run_at: datetime | None = None,
        last_seen_message_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        checks = payload["checks"]
        check_id = (check_id or "").strip()
        for item in checks:
            if str(item.get("id") or "").strip() != check_id:
                continue
            previous_state = dict(item.get("state") or {})
            state = self._build_state(
                item.get("run_policy") or {},
                previous_state=previous_state,
                last_run_at=last_run_at,
            )
            seen_ids = []
            for raw_id in list(last_seen_message_ids or []):
                value = str(raw_id or "").strip()
                if value and value not in seen_ids:
                    seen_ids.append(value)
            if len(seen_ids) > 200:
                seen_ids = seen_ids[-200:]
            state["last_seen_message_ids"] = seen_ids
            item["state"] = state
            item["updated_at"] = self._now_iso()
            payload["checks"] = self._sort_checks(checks)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy cấu hình kiểm tra mail để cập nhật trạng thái.")

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"checks": []}
        with self.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        checks = data.get("checks")
        if not isinstance(checks, list):
            checks = []
        normalized: list[dict[str, Any]] = []
        for item in checks:
            if not isinstance(item, dict):
                continue
            copied = dict(item)
            copied["id"] = str(copied.get("id") or "").strip()
            copied["name"] = str(copied.get("name") or "").strip()
            copied["enabled"] = bool(copied.get("enabled", True))
            copied["query"] = self._normalize_query(copied.get("query") or {})
            copied["run_policy"] = self._normalize_run_policy(copied.get("run_policy") or {})
            copied["delivery"] = self._normalize_delivery(copied.get("delivery") or {})
            copied["state"] = self._build_state(
                copied["run_policy"],
                previous_state=copied.get("state") or {},
            )
            normalized.append(copied)
        return {"checks": self._sort_checks(normalized)}

    def _save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _normalize_query(self, raw_query: dict[str, Any]) -> dict[str, Any]:
        raw_query = dict(raw_query) if isinstance(raw_query, dict) else {}
        mode = str(raw_query.get("mode") or "unread:today").strip().lower() or "unread:today"
        if mode not in ALLOWED_QUERY_MODES:
            raise ValueError(f"Kiểu lọc email không hỗ trợ: {mode}")
        limit = self._coerce_positive_int(raw_query.get("limit", 10), field_name="Số email tối đa")
        return {
            "mode": mode,
            "limit": limit,
        }

    def _normalize_delivery(self, raw_delivery: dict[str, Any]) -> dict[str, Any]:
        raw_delivery = dict(raw_delivery) if isinstance(raw_delivery, dict) else {}
        speak_summary = bool(raw_delivery.get("speak_summary", False))
        voice_detail_mode = str(raw_delivery.get("voice_detail_mode") or "first_title").strip().lower() or "first_title"
        if voice_detail_mode not in ALLOWED_VOICE_DETAIL_MODES:
            voice_detail_mode = "first_title"
        return {
            "show_chat_result": bool(raw_delivery.get("show_chat_result", True)),
            "show_notification": bool(raw_delivery.get("show_notification", True)),
            "speak_summary": speak_summary,
            "voice_detail_mode": voice_detail_mode,
            "only_if_has_new_mail": bool(raw_delivery.get("only_if_has_new_mail", True)),
        }

    def _normalize_run_policy(self, raw_policy: dict[str, Any]) -> dict[str, Any]:
        raw_policy = dict(raw_policy) if isinstance(raw_policy, dict) else {}
        mode = str(raw_policy.get("mode") or "manual").strip().lower() or "manual"
        if mode not in ALLOWED_RUN_MODES:
            raise ValueError(f"Mode kiểm tra mail không hỗ trợ: {mode}")
        repeat_count = self._coerce_positive_int(raw_policy.get("repeat_count", 1), field_name="Số lần lặp")
        repeat_interval_seconds = self._coerce_non_negative_float(
            raw_policy.get("repeat_interval_seconds", 0),
            field_name="Khoảng nghỉ giữa các lần chạy",
        )
        start_delay_seconds = self._coerce_non_negative_float(
            raw_policy.get("start_delay_seconds", 0),
            field_name="Độ trễ trước khi chạy",
        )
        if mode != "repeat":
            repeat_count = 1
            repeat_interval_seconds = 0.0
        schedule = self._normalize_schedule(raw_policy.get("schedule"), mode=mode)
        return {
            "mode": mode,
            "repeat_count": repeat_count,
            "repeat_interval_seconds": repeat_interval_seconds,
            "start_delay_seconds": start_delay_seconds,
            "schedule": schedule,
        }

    def _normalize_schedule(self, raw_schedule: Any, *, mode: str) -> dict[str, Any] | None:
        if mode != "scheduled":
            return None
        schedule = dict(raw_schedule) if isinstance(raw_schedule, dict) else {}
        schedule_type = str(schedule.get("type") or "daily").strip().lower() or "daily"
        if schedule_type not in ALLOWED_SCHEDULE_TYPES:
            raise ValueError(f"Lịch chạy không hỗ trợ: {schedule_type}")
        time_value = self._normalize_time_string(str(schedule.get("time") or "08:00").strip() or "08:00")
        normalized = {"type": schedule_type, "time": time_value}
        if schedule_type == "weekly":
            raw_days = schedule.get("days")
            if not isinstance(raw_days, list):
                raw_days = []
            days = [str(item).strip().lower() for item in raw_days if str(item).strip().lower() in WEEKDAY_INDEX]
            if not days:
                raise ValueError("Lịch tuần cần chọn ít nhất 1 ngày chạy.")
            normalized["days"] = sorted(set(days), key=lambda item: WEEKDAY_INDEX[item])
        return normalized

    def _build_state(
        self,
        run_policy: dict[str, Any],
        *,
        previous_state: dict[str, Any] | None = None,
        last_run_at: datetime | None = None,
        next_run_seed: datetime | None = None,
    ) -> dict[str, Any]:
        previous_state = dict(previous_state) if isinstance(previous_state, dict) else {}
        previous_last_run = self._parse_iso(previous_state.get("last_run_at", ""))
        effective_last_run = self._ensure_tz(last_run_at) if last_run_at is not None else previous_last_run
        seen_ids = [str(item).strip() for item in list(previous_state.get("last_seen_message_ids") or []) if str(item).strip()]
        if run_policy.get("mode") != "scheduled":
            return {
                "last_run_at": self._format_iso(effective_last_run),
                "next_run_at": "",
                "last_seen_message_ids": seen_ids[-200:],
            }
        seed = self._ensure_tz(next_run_seed) if next_run_seed is not None else None
        previous_next_run = self._parse_iso(previous_state.get("next_run_at", ""))
        next_run_at = previous_next_run
        now = datetime.now(VN_TZ)
        if seed is not None:
            next_run_at = self._compute_next_run_at(run_policy, after=seed)
        elif next_run_at is None:
            next_run_at = self._compute_next_run_at(run_policy, after=seed or effective_last_run or now)
        return {
            "last_run_at": self._format_iso(effective_last_run),
            "next_run_at": self._format_iso(next_run_at),
            "last_seen_message_ids": seen_ids[-200:],
        }

    def _compute_next_run_at(self, run_policy: dict[str, Any], *, after: datetime) -> datetime:
        schedule = run_policy.get("schedule") or {}
        schedule_type = schedule.get("type")
        target_time = self._parse_time_string(schedule.get("time", "08:00"))
        anchor = self._ensure_tz(after)
        current_day = anchor.date()
        if schedule_type == "daily":
            candidate = datetime.combine(current_day, target_time, VN_TZ)
            if candidate <= anchor:
                candidate += timedelta(days=1)
            return candidate

        allowed_days = [WEEKDAY_INDEX[item] for item in schedule.get("days") or [] if item in WEEKDAY_INDEX]
        if not allowed_days:
            raise ValueError("Lịch tuần cần ít nhất một ngày hợp lệ.")
        for offset in range(0, 8):
            candidate_day = current_day + timedelta(days=offset)
            if candidate_day.weekday() not in allowed_days:
                continue
            candidate = datetime.combine(candidate_day, target_time, VN_TZ)
            if candidate > anchor:
                return candidate
        return datetime.combine(current_day + timedelta(days=7), target_time, VN_TZ)

    def _next_check_id(self, checks: list[dict[str, Any]]) -> str:
        prefix = datetime.now(VN_TZ).strftime("mail_%Y%m%d_")
        used: set[int] = set()
        for item in checks:
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

    def _sort_checks(self, checks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            checks,
            key=lambda item: (
                0 if bool(item.get("enabled", True)) else 1,
                str(item.get("name") or "").lower(),
                str(item.get("id") or ""),
            ),
        )

    def _name_exists(self, checks: list[dict[str, Any]], name: str, *, exclude_id: str = "") -> bool:
        normalized = name.strip().lower()
        exclude_id = exclude_id.strip()
        for item in checks:
            if exclude_id and str(item.get("id") or "").strip() == exclude_id:
                continue
            if str(item.get("name") or "").strip().lower() == normalized:
                return True
        return False

    def _coerce_positive_int(self, raw_value: Any, *, field_name: str) -> int:
        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} không hợp lệ.") from exc
        if value <= 0:
            raise ValueError(f"{field_name} phải lớn hơn 0.")
        return value

    def _coerce_non_negative_float(self, raw_value: Any, *, field_name: str) -> float:
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} không hợp lệ.") from exc
        if value < 0:
            raise ValueError(f"{field_name} phải lớn hơn hoặc bằng 0.")
        return value

    def _normalize_time_string(self, value: str) -> str:
        try:
            parsed = self._parse_time_string(value)
        except ValueError as exc:
            raise ValueError("Giờ chạy phải theo dạng HH:MM.") from exc
        return parsed.strftime("%H:%M")

    def _parse_time_string(self, value: str) -> dt_time:
        parts = (value or "").split(":")
        if len(parts) != 2:
            raise ValueError("invalid time")
        hour = int(parts[0])
        minute = int(parts[1])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("invalid time")
        return dt_time(hour=hour, minute=minute)

    def _parse_iso(self, raw_value: str | None) -> datetime | None:
        value = str(raw_value or "").strip()
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        return self._ensure_tz(parsed)

    def _ensure_tz(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=VN_TZ)
        return value.astimezone(VN_TZ)

    def _format_iso(self, value: datetime | None) -> str:
        if value is None:
            return ""
        return self._ensure_tz(value).isoformat()

    def _now_iso(self) -> str:
        return datetime.now(VN_TZ).isoformat()
