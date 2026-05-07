from __future__ import annotations

from dataclasses import dataclass, field
from itertools import count
from typing import Any


_sequence = count()


@dataclass(order=True)
class ScheduledTask:
    priority: int
    sequence: int = field(default_factory=lambda: next(_sequence))
    kind: str = field(compare=False, default="")
    task_id: str = field(compare=False, default="")
    payload: dict[str, Any] = field(compare=False, default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.kind}:{self.task_id}"


class ScheduledTaskQueue:
    def __init__(self) -> None:
        self._tasks: list[ScheduledTask] = []
        self._keys: set[str] = set()
        self._active: ScheduledTask | None = None

    @property
    def active(self) -> ScheduledTask | None:
        return self._active

    def enqueue(self, task: ScheduledTask) -> bool:
        if task.key in self._keys:
            return False
        if self._active is not None and self._active.key == task.key:
            return False
        self._tasks.append(task)
        self._tasks.sort()
        self._keys.add(task.key)
        return True

    def pop_next(self) -> ScheduledTask | None:
        if self._active is not None:
            return None
        if not self._tasks:
            return None
        task = self._tasks.pop(0)
        self._keys.discard(task.key)
        self._active = task
        return task

    def complete_active(self, key: str | None = None) -> ScheduledTask | None:
        if self._active is None:
            return None
        if key is not None and self._active.key != key:
            return None
        task = self._active
        self._active = None
        return task

    def pending_keys(self) -> list[str]:
        keys = [task.key for task in self._tasks]
        if self._active is not None:
            keys.append(self._active.key)
        return keys
