from __future__ import annotations

from types import SimpleNamespace

from src.core import executor
from src.core.engine import Engine
from src.core.result import ActionResult, ActionStatus
from src.core.router import RouteType, route


def test_remote_power_routes_to_system_power():
    decision = route("tắt máy")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args == {"action": "shutdown"}


def test_shutdown_timer_routes_to_scheduled_system_power():
    decision = route("hẹn giờ tắt máy sau 30 phút")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args["action"] == "shutdown"
    assert decision.args["delay_seconds"] == 30 * 60
    assert decision.args["schedule_kind"] == "delay"
    assert decision.args["target_at"]


def test_shutdown_at_clock_time_routes_to_scheduled_system_power():
    decision = route("tắt máy lúc 23h30")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args["action"] == "shutdown"
    assert decision.args["delay_seconds"] > 0
    assert decision.args["schedule_kind"] == "at"
    assert decision.args["target_at"]


def test_daily_shutdown_with_warning_routes_to_scheduled_system_power():
    decision = route("tắt máy lúc 23h30 hàng ngày cảnh báo trước 15 phút")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args["action"] == "shutdown"
    assert decision.args["repeat"] == "daily"
    assert decision.args["warning_minutes"] == 15
    assert decision.args["schedule_kind"] == "at"


def test_shutdown_timer_without_time_asks_for_schedule():
    decision = route("hẹn giờ tắt máy")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args == {"action": "shutdown", "missing_schedule": True}


def test_cancel_shutdown_timer_routes_to_cancel():
    decision = route("hủy hẹn giờ tắt máy")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args == {"action": "cancel_shutdown"}


def test_night_sleep_uses_default_shutdown_timer():
    decision = route("ngủ đêm")

    assert decision.type == RouteType.SYSTEM_POWER
    assert decision.args["action"] == "night_sleep"
    assert decision.args["delay_seconds"] == 2 * 60 * 60
    assert decision.args["schedule_kind"] == "default"


def test_schedule_close_app_routes_to_scheduled_close():
    decision = route("đóng chrome sau 30 phút")

    assert decision.type == RouteType.SCHEDULED_CLOSE
    assert decision.args["action"] == "close_app"
    assert decision.args["app_name"] == "chrome"
    assert decision.args["delay_seconds"] == 30 * 60
    assert decision.args["close_all"] is True


def test_schedule_close_web_and_tab_routes():
    web = route("tắt web sau 1 tiếng")
    assert web.type == RouteType.SCHEDULED_CLOSE
    assert web.args["action"] == "close_browsers"
    assert web.args["delay_seconds"] == 60 * 60

    tab = route("đóng tab sau 10 phút")
    assert tab.type == RouteType.SCHEDULED_CLOSE
    assert tab.args["action"] == "close_current_tab"
    assert tab.args["delay_seconds"] == 10 * 60


def test_daily_schedule_close_with_warning_routes():
    decision = route("đóng chrome lúc 23h30 hàng ngày cảnh báo trước 10 phút")

    assert decision.type == RouteType.SCHEDULED_CLOSE
    assert decision.args["action"] == "close_app"
    assert decision.args["app_name"] == "chrome"
    assert decision.args["repeat"] == "daily"
    assert decision.args["warning_minutes"] == 10


def test_schedule_close_status_and_cancel_routes():
    status = route("xem lịch đóng app")
    assert status.type == RouteType.SCHEDULED_CLOSE
    assert status.args == {"action": "status"}

    cancel = route("hủy hẹn đóng app")
    assert cancel.type == RouteType.SCHEDULED_CLOSE
    assert cancel.args == {"action": "cancel"}


def test_engine_asks_before_scheduling_close_app():
    engine = Engine()

    result = engine.handle_turn("đóng chrome sau 30 phút")

    assert result.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "schedule_close"
    assert engine.state.pending_args["action"] == "close_app"
    assert engine.state.pending_args["app_name"] == "chrome"


def test_schedule_close_creates_status_and_cancel(monkeypatch):
    timers = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False
            self.cancelled = False

        def start(self):
            self.started = True

        def cancel(self):
            self.cancelled = True

    executor._SCHEDULED_CLOSE_TASKS.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )

    scheduled = executor.schedule_close("close_app", app_name="notepad", delay_seconds=60)
    status = executor.schedule_close("status")
    cancelled = executor.schedule_close("cancel")

    assert scheduled.status == ActionStatus.SUCCESS
    assert scheduled.data["scheduled_close_task"]["delay_seconds"] == 60
    assert timers[0].started is True
    assert status.status == ActionStatus.SUCCESS
    assert status.data["scheduled_close_tasks"]
    assert cancelled.status == ActionStatus.SUCCESS
    assert timers[0].cancelled is True


def test_schedule_close_creates_warning_timer(monkeypatch):
    timers = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False
            self.cancelled = False

        def start(self):
            self.started = True

        def cancel(self):
            self.cancelled = True

    executor._SCHEDULED_CLOSE_TASKS.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )

    scheduled = executor.schedule_close(
        "close_app",
        app_name="notepad",
        delay_seconds=20 * 60,
        warning_minutes=15,
    )
    cancelled = executor.schedule_close("cancel")

    assert scheduled.status == ActionStatus.SUCCESS
    assert scheduled.data["scheduled_close_task"]["warning_minutes"] == 15
    assert len(timers) == 2
    assert timers[0].delay == 20 * 60
    assert timers[1].delay == 5 * 60
    assert cancelled.status == ActionStatus.SUCCESS
    assert timers[0].cancelled is True
    assert timers[1].cancelled is True


def test_engine_asks_before_scheduling_shutdown():
    engine = Engine()

    result = engine.handle_turn("tắt máy sau 30 phút")

    assert result.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "system_power"
    assert engine.state.pending_args["action"] == "shutdown"
    assert engine.state.pending_args["delay_seconds"] == 30 * 60


def test_engine_clarifies_shutdown_timer_without_time():
    engine = Engine()

    result = engine.handle_turn("hẹn giờ tắt máy")

    assert result.status == ActionStatus.NEED_CLARIFY
    assert engine.state.pending_tool is None


def test_system_power_schedules_and_cancels_shutdown(monkeypatch):
    calls = []

    class Completed:
        returncode = 0
        stdout = ""
        stderr = ""

    def fake_run(args, capture_output=False, text=False, check=False):
        calls.append(args)
        return Completed()

    executor._SCHEDULED_POWER_STATE.clear()
    monkeypatch.setattr(executor.subprocess, "run", fake_run)

    scheduled = executor.system_power("shutdown", delay_seconds=90)
    cancelled = executor.system_power("cancel_shutdown")

    assert scheduled.status == ActionStatus.SUCCESS
    assert scheduled.data["delay_seconds"] == 90
    assert calls[0] == ["shutdown", "/s", "/t", "90"]
    assert cancelled.status == ActionStatus.SUCCESS
    assert calls[1] == ["shutdown", "/a"]
    assert executor._SCHEDULED_POWER_STATE == {}


def test_system_power_daily_warning_uses_internal_timer(monkeypatch):
    timers = []
    run_calls = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False
            self.cancelled = False

        def start(self):
            self.started = True

        def cancel(self):
            self.cancelled = True

    executor._SCHEDULED_POWER_STATE.clear()
    executor._SCHEDULED_POWER_TIMERS.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )
    monkeypatch.setattr(executor, "_run_shutdown_command", lambda args: run_calls.append(args))

    scheduled = executor.system_power(
        "shutdown",
        delay_seconds=20 * 60,
        repeat="daily",
        warning_minutes=15,
    )
    cancelled = executor.system_power("cancel_shutdown")

    assert scheduled.status == ActionStatus.SUCCESS
    assert scheduled.data["scheduled_power"]["repeat"] == "daily"
    assert scheduled.data["scheduled_power"]["warning_minutes"] == 15
    assert len(timers) == 2
    assert timers[0].delay == 20 * 60
    assert timers[1].delay == 5 * 60
    assert run_calls == [["shutdown", "/a"]]
    assert cancelled.status == ActionStatus.SUCCESS


def test_remote_media_and_browser_routes():
    assert route("chuyển bài").type == RouteType.MEDIA_CONTROL
    youtube = route("chuyển bài youtube")
    assert youtube.type == RouteType.YOUTUBE_CONTROL
    assert youtube.args == {"action": "next"}
    reload_page = route("tải lại trang")
    assert reload_page.type == RouteType.BROWSER_CONTROL
    assert reload_page.args == {"action": "reload"}
    assert route("đóng tab hiện tại").type == RouteType.BROWSER_CONTROL
    assert route("chụp màn hình").type == RouteType.SCREENSHOT
    assert route("trạng thái máy").type == RouteType.SYSTEM_STATUS
    assert route("mute máy").args == {"action": "mute"}
    assert route("unmute máy").args == {"action": "unmute"}
    assert route("bật tiếng").args == {"action": "unmute"}
    assert route("cửa sổ đang mở").type == RouteType.LIST_OPEN_WINDOWS
    assert route("đang mở gì").type == RouteType.REMOTE_OVERVIEW
    assert route("im lặng").args == {"action": "quiet"}
    assert route("đi ngủ").args == {"action": "sleep"}
    assert route("sleep").args == {"action": "light_sleep"}
    assert route("tắt màn hình").args == {"action": "monitor_off"}
    assert route("sleep sâu").args == {"action": "sleep_deep"}
    assert route("dọn máy").args == {"action": "cleanup"}
    tabs = route("tab edge đang mở")
    assert tabs.type == RouteType.LIST_BROWSER_TABS
    assert tabs.args == {"browser": "edge"}
    close_tab = route("đóng tab số 2")
    assert close_tab.type == RouteType.BROWSER_TAB_CONTROL
    assert close_tab.args == {"action": "close", "index": 2}
    close_window = route("đóng cửa sổ số 2")
    assert close_window.type == RouteType.WINDOW_CONTROL
    assert close_window.args == {"action": "close_by_index", "index": 2}


def test_remote_text_input_routes_preserve_unicode_text():
    typed = route("nhập text Xin chào tiếng Việt")
    assert typed.type == RouteType.BROWSER_CONTROL
    assert typed.args == {"action": "type_text", "text": "Xin chào tiếng Việt"}

    entered = route("gửi text Xin chào")
    assert entered.type == RouteType.BROWSER_CONTROL
    assert entered.args == {"action": "type_text_enter", "text": "Xin chào"}

    address = route("nhập địa chỉ https://example.com?q=tiếng Việt")
    assert address.type == RouteType.BROWSER_CONTROL
    assert address.args == {
        "action": "address_text",
        "text": "https://example.com?q=tiếng Việt",
        "submit": True,
    }

    find = route("tìm trong trang báo cáo")
    assert find.type == RouteType.BROWSER_CONTROL
    assert find.args == {"action": "find_text", "text": "báo cáo"}

    comment = route("gửi comment Chào live nhé")
    assert comment.type == RouteType.BROWSER_CONTROL
    assert comment.args == {"action": "tiktok_comment_send", "text": "Chào live nhé"}


def test_remote_target_mouse_and_keyboard_routes():
    target = route("chọn ô comment TikTok")
    assert target.type == RouteType.REMOTE_TARGET
    assert target.args == {"action": "set_target", "target": "tiktok_comment"}

    message = route("nhắn Chào live")
    assert message.type == RouteType.REMOTE_TARGET
    assert message.args == {"action": "send_text", "text": "Chào live", "submit": True}

    click = route("click 70 96")
    assert click.type == RouteType.MOUSE_CONTROL
    assert click.args == {"action": "click_ratio", "x": 70, "y": 96}

    assert route("click giữa màn hình").args == {"action": "click_center"}
    assert route("esc").args == {"action": "escape"}
    assert route("ctrl a").args == {"action": "select_all"}
    assert route("backspace 5").args == {"action": "backspace", "count": 5}


def test_keyboard_hold_release_and_combo_routes():
    hold = route("giữ ctrl shift")
    assert hold.type == RouteType.KEYBOARD_CONTROL
    assert hold.args == {"action": "hold", "keys": ["ctrl", "shift"]}

    timed_hold = route("nhấn giữ space 3 giây")
    assert timed_hold.type == RouteType.KEYBOARD_CONTROL
    assert timed_hold.args == {"action": "hold", "keys": ["space"], "duration_seconds": 3.0}

    release = route("thả ctrl shift")
    assert release.type == RouteType.KEYBOARD_CONTROL
    assert release.args == {"action": "release", "keys": ["ctrl", "shift"]}

    release_all = route("thả hết phím")
    assert release_all.type == RouteType.KEYBOARD_CONTROL
    assert release_all.args == {"action": "release_all"}
    assert route("thả hết phim").args == {"action": "release_all"}
    assert route("Telegram user 6049486497 / chat -5198702606: thả hết phim").args == {
        "action": "release_all"
    }

    combo = route("nhấn tổ hợp ctrl shift esc")
    assert combo.type == RouteType.KEYBOARD_CONTROL
    assert combo.args == {"action": "press_combo", "keys": ["ctrl", "shift", "escape"]}


def test_keyboard_control_can_hold_release_and_press_combo(monkeypatch):
    events = []
    monkeypatch.setattr(executor.win32api, "keybd_event", lambda vk, scan, flags, extra: events.append((vk, flags)))
    monkeypatch.setattr(executor.time, "sleep", lambda seconds: None)
    executor._HELD_KEY_CODES.clear()
    executor._HELD_KEY_REPEAT_STOPS.clear()

    hold = executor.keyboard_control("hold", keys=["ctrl", "shift"])
    assert hold.status == ActionStatus.SUCCESS
    assert events == [
        (executor.win32con.VK_CONTROL, 0),
        (executor.win32con.VK_SHIFT, 0),
    ]

    release = executor.keyboard_control("release", keys=["ctrl", "shift"])
    assert release.status == ActionStatus.SUCCESS
    assert events[-2:] == [
        (executor.win32con.VK_SHIFT, executor.win32con.KEYEVENTF_KEYUP),
        (executor.win32con.VK_CONTROL, executor.win32con.KEYEVENTF_KEYUP),
    ]

    events.clear()
    combo = executor.keyboard_control("press_combo", keys=["ctrl", "shift", "escape"])
    assert combo.status == ActionStatus.SUCCESS
    assert events == [
        (executor.win32con.VK_CONTROL, 0),
        (executor.win32con.VK_SHIFT, 0),
        (executor.win32con.VK_ESCAPE, 0),
        (executor.win32con.VK_ESCAPE, executor.win32con.KEYEVENTF_KEYUP),
        (executor.win32con.VK_SHIFT, executor.win32con.KEYEVENTF_KEYUP),
        (executor.win32con.VK_CONTROL, executor.win32con.KEYEVENTF_KEYUP),
    ]
    executor._HELD_KEY_CODES.clear()
    executor._HELD_KEY_REPEAT_STOPS.clear()


def test_keyboard_hold_printable_key_starts_repeat_until_release(monkeypatch):
    events = []

    class FakeEvent:
        def __init__(self):
            self.stopped = False

        def wait(self, seconds):
            return True

        def set(self):
            self.stopped = True

    class FakeThread:
        def __init__(self, target, daemon=False):
            self.target = target
            self.daemon = daemon

        def start(self):
            self.target()

    monkeypatch.setattr(executor.win32api, "keybd_event", lambda vk, scan, flags, extra: events.append((vk, flags)))
    monkeypatch.setattr(executor.threading, "Event", FakeEvent)
    monkeypatch.setattr(executor.threading, "Thread", FakeThread)
    executor._HELD_KEY_CODES.clear()
    executor._HELD_KEY_REPEAT_STOPS.clear()

    hold = executor.keyboard_control("hold", keys=["l"])
    assert hold.status == ActionStatus.SUCCESS
    assert events == [(ord("L"), 0), (ord("L"), 0)]
    assert "l" in executor._HELD_KEY_REPEAT_STOPS

    release = executor.keyboard_control("release", keys=["l"])
    assert release.status == ActionStatus.SUCCESS
    assert events[-1] == (ord("L"), executor.win32con.KEYEVENTF_KEYUP)
    assert "l" not in executor._HELD_KEY_REPEAT_STOPS
    executor._HELD_KEY_CODES.clear()
    executor._HELD_KEY_REPEAT_STOPS.clear()


def test_engine_confirms_shutdown(monkeypatch):
    engine = Engine()

    result = engine.handle_turn("tắt máy")

    assert result.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "system_power"


def test_engine_confirms_light_sleep_instead_of_deep_sleep():
    engine = Engine()

    result = engine.handle_turn("sleep")

    assert result.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "system_power"
    assert engine.state.pending_args == {"action": "light_sleep"}


def test_remote_preset_sleep_uses_light_sleep(monkeypatch):
    calls = []
    monkeypatch.setattr(executor, "system_power", lambda action: calls.append(("power", action)) or ActionResult.ok(action))

    result = executor.remote_preset("sleep")

    assert result.status == ActionStatus.SUCCESS
    assert calls == [("power", "night_sleep")]


def test_monitor_off_posts_message_without_waiting(monkeypatch):
    posted = []
    monkeypatch.setattr(executor.win32gui, "PostMessage", lambda *args: posted.append(args))

    result = executor.system_power("monitor_off")

    assert result.status == ActionStatus.SUCCESS
    assert posted == [
        (
            executor.win32con.HWND_BROADCAST,
            executor.win32con.WM_SYSCOMMAND,
            executor.win32con.SC_MONITORPOWER,
            2,
        )
    ]


def test_engine_dispatches_media_control(monkeypatch):
    monkeypatch.setattr(executor, "media_control", lambda **kwargs: ActionResult.ok(f"media {kwargs['action']}"))
    engine = Engine()

    result = engine.handle_turn("chuyển bài")

    assert result.status == ActionStatus.SUCCESS
    assert result.message == "media next"


def test_media_control_can_set_mute_state(monkeypatch):
    states = []
    monkeypatch.setattr(executor, "_set_system_mute", lambda muted: states.append(muted))

    muted = executor.media_control("mute")
    unmuted = executor.media_control("unmute")

    assert muted.status == ActionStatus.SUCCESS
    assert unmuted.status == ActionStatus.SUCCESS
    assert states == [True, False]


def test_list_browser_tabs_uses_devtools(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return [
                {"id": "tab-1", "type": "page", "title": "YouTube", "url": "https://youtube.com"},
                {"id": "worker-1", "type": "worker", "title": "Worker", "url": ""},
            ]

    called = {}
    monkeypatch.setattr(executor.requests, "get", lambda url, timeout=0.8: called.setdefault("url", url) and Response())

    result = executor.list_browser_tabs(browser="edge")

    assert result.status == ActionStatus.NEED_CHOICE
    assert result.data["tabs"][0]["id"] == "tab-1"
    assert result.data["tabs"][0]["port"] == 9222
    assert "YouTube" in result.message


def test_engine_browser_tab_flow_can_activate_and_confirm_close(monkeypatch):
    tabs = [{"id": "tab-1", "title": "YouTube", "url": "https://youtube.com", "browser": "edge", "port": 9222}]

    def fake_list_browser_tabs(**kwargs):
        result = ActionResult.need_choice("Tab Edge:\n1. YouTube", ["YouTube"], action="browser_tab")
        result.data["tabs"] = tabs
        return result

    calls = []
    monkeypatch.setattr(executor, "list_browser_tabs", fake_list_browser_tabs)
    monkeypatch.setattr(
        executor,
        "browser_tab_control",
        lambda action, **kwargs: calls.append((action, kwargs)) or ActionResult.ok(action),
    )
    engine = Engine()

    listed = engine.handle_turn("tab edge đang mở")
    menu = engine.handle_turn("1")
    activated = engine.handle_turn("1")
    close_confirm = engine.handle_turn("đóng tab số 1")

    assert listed.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == ["Chuyển sang tab", "Tải lại tab", "Đóng tab"]
    assert activated.status == ActionStatus.SUCCESS
    assert calls[0][0] == "activate"
    assert close_confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "browser_tab_control"


def test_browser_context_reuses_selected_window_for_short_browser_command(monkeypatch):
    windows = [{"hwnd": 1001, "title": "Edge", "name": "msedge.exe", "display_name": "Microsoft Edge"}]

    def fake_list_open_windows(**kwargs):
        result = ActionResult.need_choice("Cửa sổ đang mở:\n1. Edge", ["Edge"], action="open_window")
        result.data["windows"] = windows
        return result

    called = {}
    monkeypatch.setattr(executor, "list_open_windows", fake_list_open_windows)
    monkeypatch.setattr(executor, "focus_window", lambda **kwargs: ActionResult.ok("focused"))
    monkeypatch.setattr(
        executor,
        "browser_control",
        lambda **kwargs: called.setdefault("kwargs", kwargs) and ActionResult.ok("browser"),
    )
    engine = Engine()

    engine.handle_turn("cửa sổ đang mở")
    engine.handle_turn("1")
    engine.handle_turn("1")
    result = engine.handle_turn("tải lại trang")

    assert result.status == ActionStatus.SUCCESS
    assert called["kwargs"]["action"] == "reload"
    assert called["kwargs"]["hwnd"] == 1001


def test_engine_dispatches_youtube_control(monkeypatch):
    monkeypatch.setattr(executor, "youtube_control", lambda **kwargs: ActionResult.ok(f"youtube {kwargs['action']}"))
    engine = Engine()

    result = engine.handle_turn("chuyển bài youtube")

    assert result.status == ActionStatus.SUCCESS
    assert result.message == "youtube next"


def test_engine_dispatches_text_input_control(monkeypatch):
    called = {}
    monkeypatch.setattr(
        executor,
        "browser_control",
        lambda **kwargs: called.setdefault("kwargs", kwargs) and ActionResult.ok(f"text {kwargs['text']}"),
    )
    engine = Engine()

    result = engine.handle_turn("nhập text Xin chào")

    assert result.status == ActionStatus.SUCCESS
    assert result.message == "text Xin chào"
    assert called["kwargs"] == {"action": "type_text", "text": "Xin chào"}


def test_browser_control_pastes_text_and_address(monkeypatch):
    pasted = []
    pressed = []
    monkeypatch.setattr(executor, "_paste_text", lambda text: pasted.append(text))
    monkeypatch.setattr(executor, "_press_vk", lambda vk, modifiers=None: pressed.append((vk, modifiers or [])))

    typed = executor.browser_control("type_text", text="Xin chào")
    address = executor.browser_control("address_text", text="https://example.com", submit=True)

    assert typed.status == ActionStatus.SUCCESS
    assert address.status == ActionStatus.SUCCESS
    assert pasted == ["Xin chào", "https://example.com"]
    assert (executor.win32con.VK_RETURN, []) in pressed


def test_engine_remote_target_can_send_to_tiktok(monkeypatch):
    called = []
    monkeypatch.setattr(
        executor,
        "browser_control",
        lambda action, **kwargs: called.append((action, kwargs)) or ActionResult.ok(action),
    )
    engine = Engine()

    selected = engine.handle_turn("chọn ô comment TikTok")
    sent = engine.handle_turn("nhắn Chào live")

    assert selected.status == ActionStatus.SUCCESS
    assert sent.status == ActionStatus.SUCCESS
    assert called[0][0] == "tiktok_comment_focus"
    assert called[1] == ("tiktok_comment_send", {"text": "Chào live"})


def test_screenshot_result_has_remote_action_buttons(monkeypatch):
    monkeypatch.setattr(executor, "take_screenshot", lambda: ActionResult.ok("shot", telegram_photo_path="C:/shot.png"))
    monkeypatch.setattr(executor, "mouse_control", lambda action, **kwargs: ActionResult.ok(action))
    engine = Engine()

    result = engine.handle_turn("chụp màn hình")
    clicked = engine.handle_turn("1")

    assert result.status == ActionStatus.SUCCESS
    assert result.data["telegram_choice_buttons"] is True
    assert result.data["choices"][:2] == ["Click giữa", "Click góc dưới phải"]
    assert clicked.message == "click_center"


def test_engine_lists_running_apps_and_can_open_action_menu(monkeypatch):
    processes = [{"pid": 123, "pids": [123, 456], "name": "Demo.exe", "display_name": "Demo", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Demo.exe", ["Demo.exe - 10 MB"], action="running_app")
        result.data["processes"] = processes
        return result

    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    engine = Engine()

    listed = engine.handle_turn("máy đang chạy gì")
    assert listed.status == ActionStatus.NEED_CHOICE

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert "Demo" in menu.message
    assert engine.state.last_action == "running_app_action"

    confirm = engine.handle_turn("2")
    assert confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "close_process"
    assert engine.state.pending_args == {"pid": 123, "name": "Demo", "pids": [123, 456]}


def test_engine_can_still_close_running_app_by_text_index(monkeypatch):
    processes = [{"pid": 123, "pids": [123, 456], "name": "Demo.exe", "display_name": "Demo", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Demo.exe", ["Demo"], action="running_app")
        result.data["processes"] = processes
        return result

    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    engine = Engine()

    listed = engine.handle_turn("máy đang chạy gì")
    assert listed.status == ActionStatus.NEED_CHOICE

    confirm = engine.handle_turn("tắt app số 1")
    assert confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "close_process"


def test_running_browser_choice_menu_can_switch_tabs(monkeypatch):
    processes = [{"pid": 22, "pids": [22, 23], "name": "msedge.exe", "display_name": "Microsoft Edge", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Edge", ["Edge"], action="running_app")
        result.data["processes"] = processes
        return result

    called = {}
    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    monkeypatch.setattr(
        executor,
        "browser_control",
        lambda action, **kwargs: called.setdefault("value", (action, kwargs)) and ActionResult.ok("tab"),
    )
    engine = Engine()

    engine.handle_turn("máy đang chạy gì")
    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == [
        "Chuyển sang ứng dụng",
        "Đóng toàn bộ ứng dụng",
        "YouTube phát/dừng",
        "YouTube bài tiếp",
        "YouTube bài trước",
        "YouTube tăng âm",
        "YouTube giảm âm",
        "YouTube tắt tiếng",
        "Tải lại trang",
        "Tải lại bỏ cache",
        "Dừng tải trang",
        "Quay lại",
        "Tiến tới",
        "Cuộn xuống",
        "Cuộn lên",
        "Đầu trang",
        "Cuối trang",
        "Phóng to",
        "Thu nhỏ",
        "Zoom mặc định",
        "Mở lại tab vừa đóng",
        "Nhân đôi tab",
        "Thanh địa chỉ",
        "Nhập địa chỉ",
        "Tìm trong trang",
        "Tìm text",
        "Nhập text",
        "Nhập + Enter",
        "Comment TikTok",
        "Gửi comment TikTok",
        "Bookmark",
        "Đóng tab hiện tại",
        "Tab kế tiếp",
        "Tab trước",
        "Mở tab mới",
    ]

    result = engine.handle_turn("33")

    assert result.status == ActionStatus.SUCCESS
    assert called["value"][0] == "next_tab"


def test_running_browser_choice_menu_can_control_youtube(monkeypatch):
    processes = [{"pid": 22, "pids": [22, 23], "name": "msedge.exe", "display_name": "Microsoft Edge", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Edge", ["Edge"], action="running_app")
        result.data["processes"] = processes
        return result

    called = {}
    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    monkeypatch.setattr(
        executor,
        "youtube_control",
        lambda action, **kwargs: called.setdefault("value", (action, kwargs)) and ActionResult.ok("yt"),
    )
    engine = Engine()

    engine.handle_turn("máy đang chạy gì")
    engine.handle_turn("1")
    result = engine.handle_turn("3")

    assert result.status == ActionStatus.SUCCESS
    assert called["value"][0] == "play_pause"
    assert called["value"][1]["pids"] == [22, 23]


def test_running_browser_choice_menu_can_reload_page(monkeypatch):
    processes = [{"pid": 22, "pids": [22, 23], "name": "msedge.exe", "display_name": "Microsoft Edge", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Edge", ["Edge"], action="running_app")
        result.data["processes"] = processes
        return result

    called = {}
    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    monkeypatch.setattr(
        executor,
        "browser_control",
        lambda action, **kwargs: called.setdefault("value", (action, kwargs)) and ActionResult.ok("browser"),
    )
    engine = Engine()

    engine.handle_turn("máy đang chạy gì")
    engine.handle_turn("1")
    result = engine.handle_turn("9")

    assert result.status == ActionStatus.SUCCESS
    assert called["value"][0] == "reload"


def test_file_choice_opens_action_menu(monkeypatch):
    monkeypatch.setattr(
        executor,
        "find_file",
        lambda **kwargs: ActionResult.ok("found", files=["C:/Users/ADMIN/Desktop/a.txt", "C:/Users/ADMIN/Desktop/b.txt"]),
    )
    engine = Engine()

    listed = engine.handle_turn("tìm file báo cáo.txt")
    assert listed.status == ActionStatus.NEED_CHOICE
    assert listed.data["action"] == "file_item"

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == ["Mở", "Gửi qua Telegram", "Upload Drive", "Lấy đường dẫn", "Xóa"]


def test_email_list_choice_opens_action_menu(monkeypatch):
    def fake_check_email(**kwargs):
        return ActionResult.ok(
            "Tìm thấy email:",
            json={
                "data": [{"id": "mail-1", "from": "a@example.com", "subject": "Hello", "is_unread": True}],
                "pagination": {"mode": "any:latest", "page_size": 10},
            },
        )

    monkeypatch.setattr(executor, "_handle_check_email", fake_check_email)
    engine = Engine()

    listed = engine.handle_turn("xem email")
    assert listed.status == ActionStatus.SUCCESS
    assert listed.data["telegram_choice_buttons"] is True
    assert engine.state.last_action == "email_item"

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == ["Đọc", "Trả lời", "Đánh dấu đã đọc", "Đánh dấu chưa đọc", "Lưu trữ"]


def test_drive_list_choice_opens_action_menu(monkeypatch):
    monkeypatch.setattr(
        executor,
        "_handle_search_drive_files",
        lambda **kwargs: ActionResult.ok("Drive list:\n1. Report", drive_files=[{"id": "drive-1", "name": "Report.pdf"}]),
    )
    engine = Engine()

    listed = engine.handle_turn("google drive report")
    assert listed.status == ActionStatus.SUCCESS
    assert listed.data["telegram_choice_buttons"] is True

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == ["Lấy link", "Link công khai", "Tải về máy", "Xóa khỏi Drive"]


def test_reminder_list_choice_opens_action_menu(monkeypatch):
    reminders = [{"id": "rem-1", "title": "Họp", "message": "Họp", "status": "pending"}]
    monkeypatch.setattr(
        executor,
        "_handle_list_reminders",
        lambda status="": ActionResult.ok("Danh sách reminder:\n1. Họp", reminders=reminders),
    )
    engine = Engine()

    listed = engine.handle_turn("xem reminder")
    assert listed.status == ActionStatus.SUCCESS
    assert listed.data["telegram_choice_buttons"] is True

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"] == ["Hoàn thành", "Nhắc lại 10 phút", "Nhắc lại 1 giờ", "Sửa", "Xóa"]


def test_list_running_apps_groups_processes_and_hides_system(monkeypatch):
    memory_edge = SimpleNamespace(rss=300 * 1024 * 1024)
    memory_system = SimpleNamespace(rss=900 * 1024 * 1024)
    processes = [
        SimpleNamespace(info={"pid": 10, "name": "msedge.exe", "exe": "C:/Edge/msedge.exe", "memory_info": memory_edge}),
        SimpleNamespace(info={"pid": 11, "name": "msedge.exe", "exe": "C:/Edge/msedge.exe", "memory_info": memory_edge}),
        SimpleNamespace(info={"pid": 12, "name": "MsMpEng.exe", "exe": "C:/Windows/MsMpEng.exe", "memory_info": memory_system}),
    ]
    monkeypatch.setattr(executor.psutil, "process_iter", lambda _attrs: processes)
    monkeypatch.setattr(executor, "_collect_visible_window_titles", lambda: {10: ["YouTube - Microsoft Edge"]})
    monkeypatch.setattr(executor, "_get_foreground_pid", lambda: 10)

    result = executor.list_running_apps()

    assert result.status == ActionStatus.NEED_CHOICE
    assert "Microsoft Edge [đang dùng]" in result.message
    assert "2 tiến trình" in result.message
    assert "MsMpEng" not in result.message
    assert result.data["action"] == "running_app"
    assert result.data["choices_already_in_message"] is True
    assert "Bấm số bên dưới để chọn ứng dụng" in result.message
    assert "Bấm số bên dưới để tắt ứng dụng" not in result.message
    assert result.data["processes"][0]["pids"] == [10, 11]


def test_list_open_windows_returns_window_choices(monkeypatch):
    monkeypatch.setattr(
        executor,
        "_collect_visible_windows",
        lambda: [
            {
                "hwnd": 1001,
                "pid": 10,
                "title": "Downloads",
                "name": "explorer.exe",
                "display_name": "File Explorer",
                "memory_mb": 42,
                "is_foreground": True,
            }
        ],
    )

    result = executor.list_open_windows()

    assert result.status == ActionStatus.NEED_CHOICE
    assert "Cửa sổ đang mở" in result.message
    assert "Downloads [đang dùng]" in result.message
    assert result.data["windows"][0]["hwnd"] == 1001
    assert result.data["action"] == "open_window"


def test_engine_window_choice_can_focus_and_close_one_window(monkeypatch):
    windows = [
        {
            "hwnd": 1001,
            "pid": 10,
            "title": "Downloads",
            "name": "explorer.exe",
            "display_name": "File Explorer",
            "memory_mb": 42,
        }
    ]

    def fake_list_open_windows(**kwargs):
        result = ActionResult.need_choice("Cửa sổ đang mở:\n1. Downloads", ["Downloads"], action="open_window")
        result.data["windows"] = windows
        return result

    focused = {}
    monkeypatch.setattr(executor, "list_open_windows", fake_list_open_windows)
    monkeypatch.setattr(
        executor,
        "focus_window",
        lambda **kwargs: focused.setdefault("kwargs", kwargs) and ActionResult.ok("focused"),
    )
    engine = Engine()

    listed = engine.handle_turn("cửa sổ đang mở")
    assert listed.status == ActionStatus.NEED_CHOICE

    menu = engine.handle_turn("1")
    assert menu.status == ActionStatus.NEED_CHOICE
    assert menu.data["choices"][:3] == ["Chuyển sang cửa sổ", "Đóng cửa sổ này", "Chụp màn hình"]

    switched = engine.handle_turn("1")
    assert switched.status == ActionStatus.SUCCESS
    assert focused["kwargs"] == {"hwnd": 1001, "title": "Downloads"}
    assert engine.state.last_action == "window_action"

    confirm = engine.handle_turn("2")
    assert confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "close_window"
    assert engine.state.pending_args["hwnd"] == 1001


def test_engine_can_close_window_by_text_index(monkeypatch):
    windows = [{"hwnd": 1001, "title": "Downloads", "name": "explorer.exe", "display_name": "File Explorer"}]

    def fake_list_open_windows(**kwargs):
        result = ActionResult.need_choice("Cửa sổ đang mở:\n1. Downloads", ["Downloads"], action="open_window")
        result.data["windows"] = windows
        return result

    monkeypatch.setattr(executor, "list_open_windows", fake_list_open_windows)
    engine = Engine()

    engine.handle_turn("cửa sổ đang mở")
    confirm = engine.handle_turn("đóng cửa sổ số 1")

    assert confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "close_window"
    assert engine.state.pending_args == {"hwnd": 1001, "title": "Downloads", "name": "File Explorer"}


def test_running_app_action_menu_persists_after_success(monkeypatch):
    processes = [{"pid": 22, "pids": [22], "name": "Zalo.exe", "display_name": "Zalo", "memory_mb": 10}]

    def fake_list_running_apps(**kwargs):
        result = ActionResult.need_choice("Máy đang chạy:\n1. Zalo", ["Zalo"], action="running_app")
        result.data["processes"] = processes
        return result

    monkeypatch.setattr(executor, "list_running_apps", fake_list_running_apps)
    monkeypatch.setattr(executor, "focus_process_window", lambda **kwargs: ActionResult.ok("Đã chuyển sang Zalo."))
    engine = Engine()

    engine.handle_turn("máy đang chạy gì")
    menu = engine.handle_turn("1")
    focused = engine.handle_turn("1")
    confirm = engine.handle_turn("2")

    assert menu.status == ActionStatus.NEED_CHOICE
    assert focused.status == ActionStatus.SUCCESS
    assert focused.data["telegram_choice_buttons"] is True
    assert engine.state.last_action == "running_app_action"
    assert confirm.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "close_process"


def test_lazy_user_preset_and_clipboard_routes():
    assert route("ra ngoai").type == RouteType.REMOTE_PRESET
    assert route("ra ngoai").args == {"action": "away"}
    assert route("ve nha").args == {"action": "back"}
    assert route("tap trung").args == {"action": "focus"}

    set_clipboard = route("copy vao may hello from phone")
    assert set_clipboard.type == RouteType.CLIPBOARD_BRIDGE
    assert set_clipboard.args == {"action": "set", "text": "hello from phone"}

    assert route("gui clipboard").args == {"action": "get"}
    assert route("xoa clipboard").args == {"action": "clear"}


def test_smart_close_and_idle_guard_routes():
    heavy = route("dong app nang")
    assert heavy.type == RouteType.SMART_CLOSE
    assert heavy.args == {"action": "close_heavy_apps"}

    distracting = route("dong web giai tri")
    assert distracting.type == RouteType.SMART_CLOSE
    assert distracting.args == {"action": "close_distracting_web"}

    close_except = route("dong tat ca tru chrome va vscode")
    assert close_except.type == RouteType.SMART_CLOSE
    assert close_except.args == {"action": "close_except", "except_apps": ["chrome", "vscode"]}

    guard = route("bat che do ngu quen sau 30 phut tu 23 den 6")
    assert guard.type == RouteType.LAZY_IDLE_GUARD
    assert guard.args["action"] == "enable"
    assert guard.args["idle_minutes"] == 30
    assert guard.args["start_hour"] == 23
    assert guard.args["end_hour"] == 6
    assert guard.args["start_minutes"] == 23 * 60
    assert guard.args["end_minutes"] == 6 * 60

    guard_with_minutes = route("bat che do ngu quen sau 15 phut tu 1h30 den 6")
    assert guard_with_minutes.type == RouteType.LAZY_IDLE_GUARD
    assert guard_with_minutes.args["idle_minutes"] == 15
    assert guard_with_minutes.args["start_minutes"] == 90
    assert guard_with_minutes.args["end_minutes"] == 6 * 60

    assert route("trang thai che do ngu quen").args == {"action": "status"}
    assert route("tat che do ngu quen").args == {"action": "disable"}


def test_scheduled_open_routes():
    app = route("mo chrome sau 30 phut")
    assert app.type == RouteType.SCHEDULED_OPEN
    assert app.args["action"] == "open_app"
    assert app.args["app_name"] == "chrome"
    assert app.args["delay_seconds"] == 30 * 60

    url = route("mo https://example.com luc 23h30 hang ngay canh bao truoc 10 phut")
    assert url.type == RouteType.SCHEDULED_OPEN
    assert url.args["action"] == "open_url"
    assert url.args["url"] == "https://example.com"
    assert url.args["repeat"] == "daily"
    assert url.args["warning_minutes"] == 10

    assert route("xem lich mo app").args == {"action": "status"}
    assert route("huy hen mo web").args == {"action": "cancel"}


def test_schedule_open_creates_status_and_cancel(monkeypatch):
    timers = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False
            self.cancelled = False

        def start(self):
            self.started = True

        def cancel(self):
            self.cancelled = True

    executor._SCHEDULED_OPEN_TASKS.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )

    scheduled = executor.schedule_open("open_app", app_name="chrome", delay_seconds=60)
    status = executor.schedule_open("status")
    cancelled = executor.schedule_open("cancel")

    assert scheduled.status == ActionStatus.SUCCESS
    assert scheduled.data["scheduled_open_task"]["delay_seconds"] == 60
    assert timers[0].started is True
    assert status.data["scheduled_open_tasks"]
    assert cancelled.status == ActionStatus.SUCCESS
    assert timers[0].cancelled is True


def test_engine_confirms_lazy_user_risky_actions():
    engine = Engine()

    scheduled_open = engine.handle_turn("mo chrome sau 30 phut")
    assert scheduled_open.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "schedule_open"

    smart = engine.handle_turn("dong app nang")
    assert smart.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "smart_close"

    guard = engine.handle_turn("bat che do ngu quen")
    assert guard.status == ActionStatus.NEED_CONFIRM
    assert engine.state.pending_tool == "lazy_idle_guard"


def test_shutdown_confirm_has_telegram_quick_commands():
    engine = Engine()

    result = engine.handle_turn("tat may")

    assert result.status == ActionStatus.NEED_CONFIRM
    buttons = result.data["telegram_command_buttons"]
    assert buttons[0] == {"text": "Sau 30p", "command": "tat may sau 30 phut"}
    assert any(item["command"] == "huy hen gio tat may" for item in buttons)


def test_close_visible_running_apps_except_keeps_requested_apps(monkeypatch):
    processes = [
        {"pid": 1, "pids": [1], "name": "chrome.exe", "display_name": "Google Chrome", "memory_mb": 100, "exe": "chrome.exe"},
        {"pid": 2, "pids": [2], "name": "notepad.exe", "display_name": "Notepad", "memory_mb": 20, "exe": "notepad.exe"},
    ]
    closed = []

    result = ActionResult.need_choice("apps", ["Chrome", "Notepad"], action="running_app")
    result.data["processes"] = processes
    monkeypatch.setattr(executor, "list_running_apps", lambda limit=30: result)
    monkeypatch.setattr(executor, "close_process_id", lambda **kwargs: closed.append(kwargs) or ActionResult.ok("closed"))
    monkeypatch.setattr(executor.os, "getpid", lambda: 999)

    response = executor.close_visible_running_apps_except(["chrome"])

    assert response.status == ActionStatus.SUCCESS
    assert closed == [{"pids": [2], "name": "Notepad"}]


def test_lazy_idle_guard_stores_minute_level_window(monkeypatch):
    timers = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False

        def start(self):
            self.started = True

        def cancel(self):
            pass

    executor._IDLE_GUARD_STATE.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )

    result = executor.lazy_idle_guard(
        "enable",
        idle_minutes=15,
        start_minutes=90,
        end_minutes=360,
    )
    status = executor.lazy_idle_guard("status")

    assert result.status == ActionStatus.SUCCESS
    assert result.data["idle_guard"]["start_minutes"] == 90
    assert result.data["idle_guard"]["end_minutes"] == 360
    assert "01:30-06:00" in status.message
    assert timers[0].started is True


def test_lazy_idle_guard_starts_grace_timer_before_warning(monkeypatch):
    timers = []
    warnings = []
    power_actions = []

    class FakeTimer:
        def __init__(self, delay, callback):
            self.delay = delay
            self.callback = callback
            self.daemon = False
            self.started = False

        def start(self):
            self.started = True

        def cancel(self):
            pass

    def fake_warning(title, message):
        warnings.append((title, message))
        assert timers
        assert timers[0].started is True

    executor._IDLE_GUARD_STATE.clear()
    monkeypatch.setattr(
        executor.threading,
        "Timer",
        lambda delay, callback: timers.append(FakeTimer(delay, callback)) or timers[-1],
    )
    monkeypatch.setattr(executor, "_show_schedule_warning_async", fake_warning)
    monkeypatch.setattr(executor, "_get_idle_seconds", lambda: 30 * 60)
    monkeypatch.setattr(
        executor,
        "system_power",
        lambda action: power_actions.append(action) or ActionResult.ok("ok"),
    )

    executor._IDLE_GUARD_STATE.update(
        {
            "enabled": True,
            "idle_minutes": 15,
            "start_minutes": 0,
            "end_minutes": 0,
            "grace_minutes": 10,
            "power_action": "shutdown",
            "last_triggered_date": "",
        }
    )

    executor._idle_guard_tick()
    timers[0].callback()

    assert warnings
    assert timers[0].delay == 10 * 60
    assert timers[0].started is True
    assert timers[1].started is True
    assert power_actions == ["shutdown"]
    executor._IDLE_GUARD_STATE.clear()
