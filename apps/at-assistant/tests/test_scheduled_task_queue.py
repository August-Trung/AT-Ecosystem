from __future__ import annotations

from src.core.scheduled_task_queue import ScheduledTask, ScheduledTaskQueue


def test_scheduled_task_queue_orders_by_priority_then_sequence():
    queue = ScheduledTaskQueue()

    assert queue.enqueue(ScheduledTask(kind="workflow", task_id="wf_1", priority=20))
    assert queue.enqueue(ScheduledTask(kind="reminder", task_id="rem_1", priority=30))
    assert queue.enqueue(ScheduledTask(kind="email", task_id="mail_1", priority=10))

    first = queue.pop_next()
    assert first is not None
    assert first.key == "email:mail_1"
    queue.complete_active(first.key)

    second = queue.pop_next()
    assert second is not None
    assert second.key == "workflow:wf_1"
    queue.complete_active(second.key)

    third = queue.pop_next()
    assert third is not None
    assert third.key == "reminder:rem_1"
    queue.complete_active(third.key)


def test_scheduled_task_queue_deduplicates_pending_and_active_keys():
    queue = ScheduledTaskQueue()

    assert queue.enqueue(ScheduledTask(kind="email", task_id="mail_1", priority=10))
    assert not queue.enqueue(ScheduledTask(kind="email", task_id="mail_1", priority=10))

    active = queue.pop_next()
    assert active is not None
    assert active.key == "email:mail_1"
    assert not queue.enqueue(ScheduledTask(kind="email", task_id="mail_1", priority=10))

    queue.complete_active(active.key)
    assert queue.enqueue(ScheduledTask(kind="email", task_id="mail_1", priority=10))
