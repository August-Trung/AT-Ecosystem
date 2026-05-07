from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ActionStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    CANCELLED = "cancelled"
    NEED_CONFIRM = "need_confirm"
    NEED_CHOICE = "need_choice"
    NEED_CLARIFY = "need_clarify"


class ErrorCode(str, Enum):
    # generic
    UNKNOWN = "UNKNOWN"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    OPENROUTER_DOWN = "OPENROUTER_DOWN"

    # safety / permission
    NOT_ALLOWED = "NOT_ALLOWED"

    # app ops
    APP_NOT_FOUND = "APP_NOT_FOUND"
    PROCESS_UNKNOWN = "PROCESS_UNKNOWN"
    APP_NOT_RUNNING = "APP_NOT_RUNNING"

    # file ops
    INVALID_PATH = "INVALID_PATH"
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    NOT_A_FILE = "NOT_A_FILE"
    NOT_A_DIRECTORY = "NOT_A_DIRECTORY"
    PATH_ALREADY_EXISTS = "PATH_ALREADY_EXISTS"
    TOO_MANY_RESULTS = "TOO_MANY_RESULTS"


class ActionResult(BaseModel):
    status: ActionStatus
    message: str

    # data is for UI + state machine
    data: Dict[str, Any] = Field(default_factory=dict)

    # error info (when status == ERROR)
    error_code: Optional[ErrorCode] = None
    dev_message: Optional[str] = None

    @staticmethod
    def ok(message: str, **data: Any) -> "ActionResult":
        return ActionResult(status=ActionStatus.SUCCESS, message=message, data=data)

    @staticmethod
    def err(
        message: str,
        code: ErrorCode = ErrorCode.UNKNOWN,
        dev_message: str | None = None,
        **data: Any,
    ) -> "ActionResult":
        return ActionResult(
            status=ActionStatus.ERROR,
            message=message,
            error_code=code,
            dev_message=dev_message,
            data=data,
        )

    @staticmethod
    def cancelled(message: str = "Đã dừng yêu cầu hiện tại.", **data: Any) -> "ActionResult":
        return ActionResult(
            status=ActionStatus.CANCELLED,
            message=message,
            data=data,
        )

    @staticmethod
    def need_confirm(message: str, tool: str, args: Dict[str, Any]) -> "ActionResult":
        return ActionResult(
            status=ActionStatus.NEED_CONFIRM,
            message=message,
            data={"tool": tool, "args": args},
        )

    @staticmethod
    def need_choice(
        message: str, choices: list[str], action: str = "open"
    ) -> "ActionResult":
        return ActionResult(
            status=ActionStatus.NEED_CHOICE,
            message=message,
            data={"choices": choices, "action": action},
        )

    @staticmethod
    def need_clarify(
        message: str, question: str, slots: Optional[Dict[str, Any]] = None
    ) -> "ActionResult":
        return ActionResult(
            status=ActionStatus.NEED_CLARIFY,
            message=message,
            data={"question": question, "slots": slots or {}},
        )
