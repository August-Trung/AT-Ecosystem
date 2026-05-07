from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, time as dt_time, timedelta, timezone
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root


VN_TZ = timezone(timedelta(hours=7))
ALLOWED_STEP_TYPES = {"open_app", "open_url", "open_file", "wait"}
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


class WorkflowService:
    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self.path = runtime_root() / "app_settings" / "workflows.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def list_workflows(self, *, enabled_only: bool = False) -> list[dict[str, Any]]:
        workflows = self._load()["workflows"]
        if enabled_only:
            workflows = [item for item in workflows if bool(item.get("enabled", True))]
        return self._sort_workflows(workflows)

    def get_workflow(self, workflow_id: str) -> dict[str, Any] | None:
        workflow_id = (workflow_id or "").strip()
        if not workflow_id:
            return None
        for item in self._load()["workflows"]:
            if str(item.get("id") or "").strip() == workflow_id:
                return item
        return None

    def find_workflow(self, ref: str) -> dict[str, Any] | None:
        cleaned = (ref or "").strip()
        if not cleaned:
            return None
        lowered = cleaned.lower()
        for item in self._load()["workflows"]:
            if str(item.get("id") or "").strip().lower() == lowered:
                return item
        for item in self._load()["workflows"]:
            if str(item.get("name") or "").strip().lower() == lowered:
                return item
        for item in self._load()["workflows"]:
            name = str(item.get("name") or "").strip().lower()
            if lowered in name:
                return item
        return None

    def create_workflow(
        self,
        *,
        name: str,
        description: str = "",
        steps: list[dict[str, Any]] | None = None,
        enabled: bool = True,
        continue_on_error: bool = False,
        run_policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ValueError("Thiếu tên workflow.")

        payload = self._load()
        workflows = payload["workflows"]
        if self._name_exists(workflows, normalized_name):
            raise ValueError("Tên workflow đã tồn tại.")

        now = self._now_iso()
        policy = self._normalize_run_policy(run_policy or {})
        workflow = {
            "id": self._next_workflow_id(workflows),
            "name": normalized_name,
            "description": (description or "").strip(),
            "enabled": bool(enabled),
            "continue_on_error": bool(continue_on_error),
            "created_at": now,
            "updated_at": now,
            "steps": self._normalize_steps(steps or []),
            "run_policy": policy,
            "run_state": self._build_run_state(policy),
        }
        workflows.append(workflow)
        payload["workflows"] = self._sort_workflows(workflows)
        self._save(payload)
        return deepcopy(workflow)

    def update_workflow(
        self,
        workflow_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        steps: list[dict[str, Any]] | None = None,
        enabled: bool | None = None,
        continue_on_error: bool | None = None,
        run_policy: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload = self._load()
        workflows = payload["workflows"]
        workflow_id = (workflow_id or "").strip()
        for item in workflows:
            if str(item.get("id") or "").strip() != workflow_id:
                continue
            if name is not None:
                normalized_name = name.strip()
                if not normalized_name:
                    raise ValueError("Thiếu tên workflow.")
                if self._name_exists(workflows, normalized_name, exclude_id=workflow_id):
                    raise ValueError("Tên workflow đã tồn tại.")
                item["name"] = normalized_name
            if description is not None:
                item["description"] = description.strip()
            if steps is not None:
                item["steps"] = self._normalize_steps(steps)
            if enabled is not None:
                item["enabled"] = bool(enabled)
            if continue_on_error is not None:
                item["continue_on_error"] = bool(continue_on_error)
            if run_policy is not None:
                policy = self._normalize_run_policy(run_policy)
                item["run_policy"] = policy
                item["run_state"] = self._build_run_state(
                    policy,
                    previous_state={},
                )
            else:
                item["run_policy"] = self._normalize_run_policy(item.get("run_policy") or {})
                item["run_state"] = self._build_run_state(
                    item["run_policy"],
                    previous_state=item.get("run_state") or {},
                )
            item["updated_at"] = self._now_iso()
            payload["workflows"] = self._sort_workflows(workflows)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy workflow để cập nhật.")

    def delete_workflow(self, workflow_id: str) -> dict[str, Any]:
        payload = self._load()
        workflows = payload["workflows"]
        workflow_id = (workflow_id or "").strip()
        for index, item in enumerate(workflows):
            if str(item.get("id") or "").strip() != workflow_id:
                continue
            deleted = workflows.pop(index)
            payload["workflows"] = workflows
            self._save(payload)
            return deepcopy(deleted)
        raise FileNotFoundError("Không tìm thấy workflow để xóa.")

    def list_due_scheduled_workflows(self, *, now: datetime | None = None) -> list[dict[str, Any]]:
        current = self._ensure_tz(now or datetime.now(VN_TZ))
        due: list[dict[str, Any]] = []
        for workflow in self.list_workflows(enabled_only=True):
            policy = workflow.get("run_policy") or {}
            if policy.get("mode") != "scheduled":
                continue
            next_run_at = self._parse_iso(workflow.get("run_state", {}).get("next_run_at", ""))
            if next_run_at is not None and next_run_at <= current:
                due.append(workflow)
        return due

    def mark_workflow_scheduled_run(self, workflow_id: str, *, run_at: datetime | None = None) -> dict[str, Any]:
        payload = self._load()
        workflows = payload["workflows"]
        current = self._ensure_tz(run_at or datetime.now(VN_TZ))
        workflow_id = (workflow_id or "").strip()
        for item in workflows:
            if str(item.get("id") or "").strip() != workflow_id:
                continue
            policy = self._normalize_run_policy(item.get("run_policy") or {})
            item["run_policy"] = policy
            item["run_state"] = self._build_run_state(
                policy,
                previous_state=item.get("run_state") or {},
                last_run_at=current,
                next_run_seed=current,
            )
            item["updated_at"] = self._now_iso()
            payload["workflows"] = self._sort_workflows(workflows)
            self._save(payload)
            return deepcopy(item)
        raise FileNotFoundError("Không tìm thấy workflow để cập nhật lịch chạy.")

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"workflows": []}
        with self.path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        workflows = data.get("workflows")
        if not isinstance(workflows, list):
            workflows = []
        normalized: list[dict[str, Any]] = []
        for item in workflows:
            if not isinstance(item, dict):
                continue
            copied = dict(item)
            copied["id"] = str(copied.get("id") or "").strip()
            copied["name"] = str(copied.get("name") or "").strip()
            copied["description"] = str(copied.get("description") or "").strip()
            copied["enabled"] = bool(copied.get("enabled", True))
            copied["continue_on_error"] = bool(copied.get("continue_on_error", False))
            copied["steps"] = self._normalize_steps(copied.get("steps") or [])
            copied["run_policy"] = self._normalize_run_policy(copied.get("run_policy") or {})
            copied["run_state"] = self._build_run_state(
                copied["run_policy"],
                previous_state=copied.get("run_state") or {},
            )
            normalized.append(copied)
        return {"workflows": self._sort_workflows(normalized)}

    def _save(self, payload: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _normalize_steps(self, raw_steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not isinstance(raw_steps, list):
            raise ValueError("Danh sách step không hợp lệ.")
        steps: list[dict[str, Any]] = []
        for index, item in enumerate(raw_steps, start=1):
            if not isinstance(item, dict):
                raise ValueError(f"Step {index} không hợp lệ.")
            step_type = str(item.get("type") or "").strip().lower()
            if step_type not in ALLOWED_STEP_TYPES:
                raise ValueError(f"Step {index} có loại không hỗ trợ: {step_type or '(trống)'}")
            params = item.get("params")
            params = dict(params) if isinstance(params, dict) else {}
            normalized_params = self._normalize_step_params(step_type, params, index=index)
            step_id = str(item.get("id") or "").strip() or f"step_{index:03d}"
            steps.append({"id": step_id, "type": step_type, "params": normalized_params})
        return steps

    def _normalize_step_params(self, step_type: str, params: dict[str, Any], *, index: int) -> dict[str, Any]:
        if step_type == "open_app":
            app_name = str(params.get("app_name") or "").strip()
            if not app_name:
                raise ValueError(f"Step {index} thiếu tên ứng dụng.")
            return {"app_name": app_name}
        if step_type == "open_url":
            url = str(params.get("url") or "").strip()
            if not url:
                raise ValueError(f"Step {index} thiếu URL.")
            browser = str(params.get("browser") or "default").strip().lower() or "default"
            return {"url": url, "browser": browser}
        if step_type == "open_file":
            path = str(params.get("path") or "").strip()
            if not path:
                raise ValueError(f"Step {index} thiếu đường dẫn file.")
            return {"path": path}
        if step_type == "wait":
            raw_seconds = params.get("seconds", 0)
            try:
                seconds = float(raw_seconds)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Step {index} có số giây chờ không hợp lệ.") from exc
            if seconds < 0:
                raise ValueError(f"Step {index} có số giây chờ phải lớn hơn hoặc bằng 0.")
            return {"seconds": seconds}
        raise ValueError(f"Loại step không hỗ trợ: {step_type}")

    def _normalize_run_policy(self, raw_policy: dict[str, Any]) -> dict[str, Any]:
        raw_policy = dict(raw_policy) if isinstance(raw_policy, dict) else {}
        mode = str(raw_policy.get("mode") or "manual").strip().lower() or "manual"
        if mode not in ALLOWED_RUN_MODES:
            raise ValueError(f"Mode workflow không hỗ trợ: {mode}")
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

    def _build_run_state(
        self,
        run_policy: dict[str, Any],
        *,
        previous_state: dict[str, Any] | None = None,
        last_run_at: datetime | None = None,
        next_run_seed: datetime | None = None,
    ) -> dict[str, str]:
        previous_state = dict(previous_state) if isinstance(previous_state, dict) else {}
        previous_last_run = self._parse_iso(previous_state.get("last_run_at", ""))
        effective_last_run = self._ensure_tz(last_run_at) if last_run_at is not None else previous_last_run
        if run_policy.get("mode") != "scheduled":
            return {
                "last_run_at": self._format_iso(effective_last_run),
                "next_run_at": "",
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

    def _next_workflow_id(self, workflows: list[dict[str, Any]]) -> str:
        prefix = datetime.now(VN_TZ).strftime("wf_%Y%m%d_")
        used: set[int] = set()
        for item in workflows:
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

    def _sort_workflows(self, workflows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(
            workflows,
            key=lambda item: (
                0 if bool(item.get("enabled", True)) else 1,
                str(item.get("name") or "").lower(),
                str(item.get("id") or ""),
            ),
        )

    def _name_exists(
        self,
        workflows: list[dict[str, Any]],
        name: str,
        *,
        exclude_id: str = "",
    ) -> bool:
        normalized = name.strip().lower()
        exclude_id = exclude_id.strip()
        for item in workflows:
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
