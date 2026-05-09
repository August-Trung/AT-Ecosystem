from __future__ import annotations

from pathlib import Path

import requests

from src.core.result import ActionResult
from src.integrations.mobile_remote import MobileRemoteBridge, MobileRemoteSettingsStore, mobile_payload_from_result


class _FakeEngine:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def handle_turn(self, command: str, cancel_check=None, source: str = "desktop") -> ActionResult:
        self.calls.append((command, source))
        if command == "trạng thái máy":
            return ActionResult.ok(
                "Trạng thái máy",
                cpu_percent=12,
                ram_percent=34,
                disk_percent=56,
                foreground_window="ATAssistant",
            )
        if command == "tat may":
            return ActionResult.need_confirm("Bạn có chắc muốn tắt máy?", "system_power", {"action": "shutdown"})
        return ActionResult.ok("SHA256", algorithm="sha256", hex="abc123", base64="YWJjMTIz")


def _store(tmp_path: Path, monkeypatch) -> MobileRemoteSettingsStore:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    return MobileRemoteSettingsStore()


def test_mobile_remote_http_pair_and_command_flow(tmp_path, monkeypatch):
    engine = _FakeEngine()
    bridge = MobileRemoteBridge(engine, settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"

    try:
        health = requests.get(f"{base}/api/health", timeout=3).json()
        assert health["ok"] is True
        assert health["pairCode"] == bridge.pair_code

        pair = requests.post(
            f"{base}/api/pair/request",
            json={"deviceName": "Điện thoại của Trung", "pairCode": bridge.pair_code},
            timeout=3,
        ).json()
        assert pair["status"] == "pending"
        assert bridge.snapshot()["pending"]

        approved = bridge.approve_pair_request(pair["requestId"])
        assert approved["ok"] is True

        status = requests.get(f"{base}/api/pair/status?requestId={pair['requestId']}", timeout=3).json()
        assert status["status"] == "approved"
        assert status["authKey"]

        result = requests.post(
            f"{base}/api/command",
            headers={"X-AT-Remote-Key": status["authKey"]},
            json={"command": "trạng thái máy"},
            timeout=3,
        ).json()

        assert result["status"] == "success"
        assert result["cards"][0]["type"] == "system_status"
        assert engine.calls == [("trạng thái máy", "mobile")]
    finally:
        bridge.stop()


def test_mobile_remote_rejects_unpaired_command(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    payload = bridge.handle_command("missing", "trạng thái máy")

    assert payload["status"] == "unauthorized"
    assert payload["cards"][0]["type"] == "error"


def test_mobile_remote_deduplicates_pair_requests(tmp_path, monkeypatch):
    events: list[tuple[str, dict]] = []
    bridge = MobileRemoteBridge(
        _FakeEngine(),
        settings_store=_store(tmp_path, monkeypatch),
        on_event=lambda event, payload: events.append((event, payload)),
    )
    bridge.start(host="127.0.0.1", port=0)
    try:
        first = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        second = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")

        assert first["status"] == "pending"
        assert second["status"] == "pending"
        assert second["requestId"] == first["requestId"]
        assert len(bridge.snapshot()["pending"]) == 1
        assert [event for event, _payload in events].count("pair_requested") == 1

        approved = bridge.approve_pair_request(first["requestId"])
        assert approved["ok"] is True

        third = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        assert third["status"] == "approved"
        assert third["requestId"] == first["requestId"]
        assert third["authKey"]
        assert len(bridge.snapshot()["devices"]) == 1
    finally:
        bridge.stop()


def test_mobile_remote_accepts_optional_at_prefix_and_emits_chat_events(tmp_path, monkeypatch):
    engine = _FakeEngine()
    events: list[tuple[str, dict]] = []
    bridge = MobileRemoteBridge(
        engine,
        settings_store=_store(tmp_path, monkeypatch),
        on_event=lambda event, payload: events.append((event, payload)),
    )
    bridge.start(host="127.0.0.1", port=0)
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        status = bridge.pair_status(pair["requestId"])

        payload = bridge.handle_command(str(status["authKey"]), "/at trạng thái máy")

        assert payload["status"] == "success"
        assert engine.calls == [("trạng thái máy", "mobile")]
        received = [payload for event, payload in events if event == "command_received"]
        results = [payload for event, payload in events if event == "command_result"]
        assert received[-1]["displayCommand"] == "/at trạng thái máy"
        assert received[-1]["command"] == "trạng thái máy"
        assert results[-1]["status"] == "success"
        assert results[-1]["result"].message == "Trạng thái máy"
    finally:
        bridge.stop()


def test_mobile_remote_confirmation_payload_has_phone_buttons():
    payload = mobile_payload_from_result(ActionResult.need_confirm("Bạn có chắc muốn tắt máy?", "system_power", {"action": "shutdown"}))

    assert payload["requiresConfirmation"] is True
    assert payload["cards"][0]["type"] == "confirm"
    assert payload["buttons"][0]["command"] == "yes"
    assert payload["buttons"][1]["command"] == "no"
