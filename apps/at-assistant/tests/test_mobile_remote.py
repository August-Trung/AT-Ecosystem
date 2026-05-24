from __future__ import annotations

from pathlib import Path
import base64
import socket
from types import SimpleNamespace

import requests

from src.core.result import ActionResult
from src.integrations import mobile_remote as mobile_remote_module
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
        if command == "đi ngủ":
            return ActionResult.ok("Đã bật preset đi ngủ.", scheduled_power={"action": "shutdown"})
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


def test_mobile_remote_settings_never_bind_loopback_for_lan(tmp_path, monkeypatch):
    store = _store(tmp_path, monkeypatch)
    saved = store.save({"enabled": True, "host": "127.0.0.1", "port": 8765, "paired_devices": []})

    assert saved["host"] == "0.0.0.0"
    assert store.load()["host"] == "0.0.0.0"


def test_mobile_remote_snapshot_exposes_tailscale_urls(tmp_path, monkeypatch):
    if mobile_remote_module.psutil is None:
        return

    monkeypatch.setattr(
        mobile_remote_module.psutil,
        "net_if_addrs",
        lambda: {
            "Tailscale": [SimpleNamespace(family=socket.AF_INET, address="100.101.102.103")],
            "Wi-Fi": [SimpleNamespace(family=socket.AF_INET, address="192.168.1.23")],
        },
    )

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        snapshot = bridge.snapshot()
        assert any(item["kind"] == "tailscale" and item["address"] == "100.101.102.103" for item in snapshot["networkAddresses"])
        assert f"http://100.101.102.103:{bridge.port}" in snapshot["tailscaleUrls"]
        assert f"http://100.101.102.103:{bridge.port}/?code={bridge.pair_code}" in snapshot["tailscalePairingUrls"]
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


def test_mobile_remote_help_is_app_specific_and_skips_engine(tmp_path, monkeypatch):
    engine = _FakeEngine()
    bridge = MobileRemoteBridge(engine, settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = bridge.handle_command(str(auth_key), "help")

        assert payload["status"] == "success"
        assert payload["cards"][0]["title"] == "Trợ giúp AT Remote"
        assert "Không cần gõ /at" in payload["message"]
        assert engine.calls == []
    finally:
        bridge.stop()


def test_mobile_remote_macro_result_has_short_card_and_next_buttons(tmp_path, monkeypatch):
    engine = _FakeEngine()
    bridge = MobileRemoteBridge(engine, settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = bridge.handle_command(str(auth_key), "đi ngủ")

        assert payload["status"] == "success"
        assert payload["cards"][0]["title"] == "Đã bật Đi ngủ"
        assert payload["cards"][0]["message"] == "Preset đi ngủ đã chạy trên máy tính."
        assert any(button["command"] == "hủy hẹn giờ tắt máy" for button in payload["buttons"])
        assert engine.calls == [("đi ngủ", "mobile")]
    finally:
        bridge.stop()


def test_mobile_remote_share_text_sets_desktop_clipboard(tmp_path, monkeypatch):
    called: list[tuple[str, str]] = []

    def fake_clipboard(action: str, text: str = "") -> ActionResult:
        called.append((action, text))
        return ActionResult.ok("Đã đưa nội dung vào clipboard máy.", clipboard_text=text)

    monkeypatch.setattr(mobile_remote_module.executor, "clipboard_bridge", fake_clipboard)
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = bridge.handle_share(str(auth_key), {"text": "https://example.com"})

        assert payload["status"] == "success"
        assert payload["cards"][0]["title"] == "Đã gửi sang máy"
        assert payload["message"] == "Nội dung đã nằm trong clipboard máy tính."
        assert payload["buttons"][0]["command"] == "mở https://example.com"
        assert called == [("set", "https://example.com")]
    finally:
        bridge.stop()


def test_mobile_remote_serves_result_file_without_exposing_path(tmp_path, monkeypatch):
    document_path = tmp_path / "report.txt"
    document_path.write_text("hello from desktop", encoding="utf-8")

    class _DocumentEngine(_FakeEngine):
        def handle_turn(self, command: str, cancel_check=None, source: str = "desktop") -> ActionResult:
            self.calls.append((command, source))
            return ActionResult.ok("Tệp đã sẵn sàng.", telegram_document_path=str(document_path))

    bridge = MobileRemoteBridge(_DocumentEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = requests.post(
            f"{base}/api/command",
            headers={"X-AT-Remote-Key": auth_key},
            json={"command": "gửi file báo cáo"},
            timeout=3,
        ).json()

        file_cards = [card for card in payload["cards"] if card.get("type") == "file"]
        assert file_cards
        public_file = file_cards[0]["file"]
        assert public_file["name"] == "report.txt"
        assert public_file["downloadUrl"].startswith("/api/files/")
        assert "telegram_document_path" not in payload["raw"]["data"]

        downloaded = requests.get(f"{base}{public_file['downloadUrl']}", timeout=3)
        assert downloaded.status_code == 200
        assert downloaded.content == b"hello from desktop"
    finally:
        bridge.stop()


def test_mobile_remote_image_result_is_not_duplicated_as_file(tmp_path):
    image_path = tmp_path / "screenshot.png"
    image_path.write_bytes(
        base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
    )
    resolved: list[tuple[str, str]] = []

    def resolver(path: str | Path, kind: str) -> dict:
        resolved.append((str(path), kind))
        return {
            "id": f"{kind}-1",
            "name": Path(path).name,
            "mime": "image/png",
            "size": Path(path).stat().st_size,
            "downloadUrl": f"/api/files/{kind}-1?token=t",
        }

    payload = mobile_payload_from_result(
        ActionResult.ok("Đã chụp màn hình.", telegram_photo_path=str(image_path), path=str(image_path)),
        file_resolver=resolver,
    )

    assert [card["type"] for card in payload["cards"]] == ["image"]
    assert payload["cards"][0]["image"]["src"].startswith("data:image/png;base64,")
    assert payload["files"] == []
    assert resolved == [(str(image_path), "image")]


def test_mobile_remote_upload_saves_file_and_can_run_command(tmp_path, monkeypatch):
    events: list[tuple[str, dict]] = []
    engine = _FakeEngine()
    bridge = MobileRemoteBridge(
        engine,
        settings_store=_store(tmp_path, monkeypatch),
        on_event=lambda event, payload: events.append((event, payload)),
    )
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]
        raw = b"mobile upload"

        payload = requests.post(
            f"{base}/api/upload",
            headers={"X-AT-Remote-Key": auth_key},
            json={
                "name": "note.txt",
                "mime": "text/plain",
                "command": "mở file này",
                "dataBase64": base64.b64encode(raw).decode("ascii"),
            },
            timeout=3,
        ).json()

        assert payload["status"] == "success"
        assert engine.calls
        assert engine.calls[-1][1] == "mobile"
        assert "note.txt" in engine.calls[-1][0]
        assert [event for event, _payload in events].count("file_received") == 1
        upload_card = [card for card in payload["cards"] if card.get("type") == "file"][0]
        downloaded = requests.get(f"{base}{upload_card['file']['downloadUrl']}", timeout=3)
        assert downloaded.content == raw
    finally:
        bridge.stop()


def test_mobile_remote_upload_without_command_returns_one_file_card(tmp_path, monkeypatch):
    events: list[tuple[str, dict]] = []
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch), on_event=lambda event, payload: events.append((event, payload)))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = requests.post(
            f"{base}/api/upload",
            headers={"X-AT-Remote-Key": auth_key},
            json={
                "name": "note.txt",
                "mime": "text/plain",
                "dataBase64": base64.b64encode(b"mobile upload").decode("ascii"),
            },
            timeout=3,
        ).json()

        file_cards = [card for card in payload["cards"] if card.get("type") == "file"]
        assert payload["message"] == "Tệp đã được lưu trên máy tính."
        assert len(file_cards) == 1
        assert file_cards[0]["title"] == "Tệp đã gửi"
        assert len(payload["files"]) == 1
        assert [event for event, _payload in events].count("file_received") == 1
        assert [event for event, _payload in events].count("command_received") == 0
    finally:
        bridge.stop()


def test_mobile_remote_lists_and_deletes_uploaded_files(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        requests.post(
            f"{base}/api/upload",
            headers={"X-AT-Remote-Key": auth_key},
            json={
                "name": "note.txt",
                "mime": "text/plain",
                "dataBase64": base64.b64encode(b"mobile upload").decode("ascii"),
            },
            timeout=3,
        )

        listed = requests.get(f"{base}/api/uploads", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()
        assert listed["ok"] is True
        assert listed["files"][0]["name"] == "note.txt"

        deleted = requests.post(
            f"{base}/api/uploads/delete",
            headers={"X-AT-Remote-Key": auth_key},
            json={"name": "note.txt"},
            timeout=3,
        ).json()
        assert deleted["ok"] is True

        listed_again = requests.get(f"{base}/api/uploads", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()
        assert listed_again["files"] == []
    finally:
        bridge.stop()


def test_mobile_remote_enforces_permission_groups(tmp_path, monkeypatch):
    engine = _FakeEngine()
    bridge = MobileRemoteBridge(engine, settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]
        device = bridge.snapshot()["devices"][0]

        permissions = requests.get(f"{base}/api/permissions", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()
        assert permissions["ok"] is True
        assert {item["key"]: item["enabled"] for item in permissions["groups"]}["system_power"] is False

        denied = requests.post(
            f"{base}/api/command",
            headers={"X-AT-Remote-Key": auth_key},
            json={"command": "tat may"},
            timeout=3,
        ).json()
        assert denied["status"] == "error"
        assert engine.calls == []

        bridge.update_device_permissions(device["id"], {**device["permissions"], "system_power": True})
        allowed = requests.post(
            f"{base}/api/command",
            headers={"X-AT-Remote-Key": auth_key},
            json={"command": "tat may"},
            timeout=3,
        ).json()
        assert allowed["requiresConfirmation"] is True
        assert engine.calls == [("tat may", "mobile")]
    finally:
        bridge.stop()


def test_mobile_remote_upload_blocks_dangerous_extensions(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        payload = requests.post(
            f"{base}/api/upload",
            headers={"X-AT-Remote-Key": auth_key},
            json={
                "name": "run.exe",
                "mime": "application/octet-stream",
                "dataBase64": base64.b64encode(b"bad").decode("ascii"),
            },
            timeout=3,
        ).json()

        assert payload["status"] == "error"
        assert "nguy hiểm" in payload["message"]
    finally:
        bridge.stop()


def test_mobile_remote_static_app_uses_fresh_cache_headers(tmp_path, monkeypatch):
    dist = tmp_path / "remote_dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div>AT Remote</div>", encoding="utf-8")
    (dist / "sw.js").write_text("self.addEventListener('fetch', () => {})", encoding="utf-8")
    (dist / "manifest.webmanifest").write_text("{}", encoding="utf-8")
    (assets / "app.js").write_text("console.log('at-remote')", encoding="utf-8")
    monkeypatch.setattr("src.integrations.mobile_remote._at_remote_dist_dir", lambda: dist)

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        index = requests.get(f"{base}/", timeout=3)
        worker = requests.get(f"{base}/sw.js", timeout=3)
        manifest = requests.get(f"{base}/manifest.webmanifest", timeout=3)
        asset = requests.get(f"{base}/assets/app.js", timeout=3)

        assert index.headers["Cache-Control"] == "no-store"
        assert worker.headers["Cache-Control"] == "no-store"
        assert manifest.headers["Cache-Control"] == "no-store"
        assert asset.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    finally:
        bridge.stop()


def test_mobile_remote_confirmation_payload_has_phone_buttons():
    payload = mobile_payload_from_result(ActionResult.need_confirm("Bạn có chắc muốn tắt máy?", "system_power", {"action": "shutdown"}))

    assert payload["requiresConfirmation"] is True
    assert payload["cards"][0]["type"] == "confirm"
    assert payload["buttons"][0]["command"] == "yes"
    assert payload["buttons"][1]["command"] == "no"


def test_mobile_remote_payload_maps_telegram_and_mobile_buttons():
    payload = mobile_payload_from_result(
        ActionResult.ok(
            "Có thao tác",
            telegram_command_buttons=[{"text": "Refresh inbox", "command": "mo temp mail"}],
            telegram_url_buttons=[{"text": "Mở web", "url": "https://example.com"}],
            mobile_buttons=[
                {"label": "Tạo mới", "command": "tao temp mail moi"},
                {"label": "Mở ngoài", "url": "https://example.org"},
            ],
        )
    )

    assert {"label": "Làm mới", "command": "mở temp mail", "tone": "neutral"} in payload["buttons"]
    assert {"label": "Mở web", "url": "https://example.com", "tone": "neutral"} in payload["buttons"]
    assert {"label": "Tạo mới", "command": "tạo temp mail mới", "tone": "neutral"} in payload["buttons"]
    assert {"label": "Mở ngoài", "url": "https://example.org", "tone": "neutral"} in payload["buttons"]


def test_mobile_remote_last_seen_is_throttled(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        pair = bridge.request_pair("Điện thoại của Trung", bridge.pair_code, client_host="192.168.1.50")
        bridge.approve_pair_request(pair["requestId"])
        auth_key = bridge.pair_status(pair["requestId"])["authKey"]

        bridge.handle_command(auth_key, "trạng thái máy")
        first_seen = bridge.snapshot()["devices"][0]["lastSeen"]
        bridge.handle_command(auth_key, "trạng thái máy")
        second_seen = bridge.snapshot()["devices"][0]["lastSeen"]

        assert first_seen
        assert second_seen == first_seen
    finally:
        bridge.stop()


def _paired_auth_key(bridge: MobileRemoteBridge) -> str:
    pair = bridge.request_pair("Phone", bridge.pair_code, client_host="192.168.1.51")
    bridge.approve_pair_request(pair["requestId"])
    return str(bridge.pair_status(pair["requestId"])["authKey"])


def _grant_remote_desktop(bridge: MobileRemoteBridge) -> None:
    device = bridge.snapshot()["devices"][0]
    bridge.update_device_permissions(device["id"], {**device["permissions"], "remote_desktop": True})


def test_mobile_remote_desktop_requires_permission(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    try:
        auth_key = _paired_auth_key(bridge)

        payload = bridge.remote_screen(auth_key)

        assert payload["ok"] is False
        assert payload["status"] == "error"
    finally:
        bridge.stop()


def test_mobile_remote_desktop_serves_screen_snapshot(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)
        monkeypatch.setattr(
            mobile_remote_module,
            "_remote_screen_snapshot",
            lambda **_kwargs: {
                "ok": True,
                "status": "success",
                "message": "screen",
                "screen": {
                    "image": "data:image/jpeg;base64,abc",
                    "width": 1440,
                    "height": 900,
                    "previewWidth": 1280,
                    "previewHeight": 800,
                    "capturedAt": "now",
                },
            },
        )

        payload = requests.get(f"{base}/api/remote/screen", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()

        assert payload["ok"] is True
        assert payload["screen"]["image"].startswith("data:image/jpeg;base64,")
        assert payload["screen"]["width"] == 1440
    finally:
        bridge.stop()


def test_mobile_remote_desktop_serves_mjpeg_stream(tmp_path, monkeypatch):
    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)
        monkeypatch.setattr(
            mobile_remote_module,
            "_remote_screen_jpeg",
            lambda **_kwargs: (
                b"\xff\xd8fake-jpeg\xff\xd9",
                {"width": 1440, "height": 900, "previewWidth": 640, "previewHeight": 400, "capturedAt": "now"},
            ),
        )

        response = requests.get(
            f"{base}/api/remote/stream?key={auth_key}&fps=2",
            stream=True,
            timeout=3,
        )
        try:
            chunk = next(response.iter_content(chunk_size=128))
        finally:
            response.close()

        assert response.status_code == 200
        assert response.headers["Content-Type"].startswith("multipart/x-mixed-replace")
        assert b"--atremote" in chunk
        assert b"image/jpeg" in chunk
    finally:
        bridge.stop()


def test_mobile_remote_desktop_capabilities_list_monitors(tmp_path, monkeypatch):
    monkeypatch.setattr(
        mobile_remote_module,
        "_remote_monitors",
        lambda: [
            {"id": "monitor-0", "label": "Màn hình chính", "x": 0, "y": 0, "width": 1000, "height": 600, "isPrimary": True},
            {"id": "monitor-1", "label": "Màn hình 2", "x": 1000, "y": 0, "width": 800, "height": 600, "isPrimary": False},
        ],
    )
    monkeypatch.setattr(mobile_remote_module, "_ffmpeg_path", lambda: "ffmpeg")
    monkeypatch.setattr(mobile_remote_module, "_webrtc_available", lambda: True)

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)

        payload = requests.get(f"{base}/api/remote/capabilities", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()

        assert payload["ok"] is True
        assert payload["streamTransports"]["h264"] is True
        assert payload["streamTransports"]["webrtc"] is True
        assert [monitor["id"] for monitor in payload["monitors"]] == ["monitor-0", "monitor-1"]
    finally:
        bridge.stop()


def test_mobile_remote_stop_remote_desktop_control_revokes_permission(tmp_path, monkeypatch):
    events: list[str] = []
    released: list[bool] = []
    monkeypatch.setattr(mobile_remote_module, "_release_remote_inputs", lambda: released.append(True))

    bridge = MobileRemoteBridge(
        _FakeEngine(),
        settings_store=_store(tmp_path, monkeypatch),
        on_event=lambda event, _payload: events.append(event),
    )
    bridge.start(host="127.0.0.1", port=0)
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)

        result = bridge.stop_remote_desktop_control()

        device = bridge.snapshot()["devices"][0]
        assert result["ok"] is True
        assert released == [True]
        assert device["permissions"]["remote_desktop"] is False
        assert bridge.remote_stream_auth(auth_key)["ok"] is False
        assert "remote_control_stopped" in events
    finally:
        bridge.stop()


def test_mobile_remote_keyboard_hold_and_release_routes_to_executor(monkeypatch):
    calls: list[tuple[str, object]] = []

    def fake_keyboard_control(action: str, **kwargs):
        calls.append((action, kwargs.get("keys")))
        return mobile_remote_module.ActionResult.ok("ok")

    monkeypatch.setattr(mobile_remote_module.executor, "keyboard_control", fake_keyboard_control)

    hold = mobile_remote_module._remote_input_result({"action": "hold", "keys": ["ctrl"]})
    release = mobile_remote_module._remote_input_result({"action": "release", "keys": ["ctrl"]})

    assert hold["status"] == "success"
    assert release["status"] == "success"
    assert calls == [("hold", ["ctrl"]), ("release", ["ctrl"])]


def test_mobile_remote_h264_command_targets_monitor(monkeypatch):
    monkeypatch.setattr(
        mobile_remote_module,
        "_remote_monitors",
        lambda: [
            {"id": "monitor-0", "label": "Màn hình chính", "x": 0, "y": 0, "width": 1000, "height": 600, "isPrimary": True},
            {"id": "monitor-1", "label": "Màn hình 2", "x": -800, "y": 0, "width": 800, "height": 600, "isPrimary": False},
        ],
    )
    monkeypatch.setattr(mobile_remote_module, "_ffmpeg_path", lambda: "ffmpeg")

    command = mobile_remote_module._h264_stream_command(monitor_id="monitor-1", fps=16, max_width=640)

    assert command
    assert command[command.index("-offset_x") + 1] == "-800"
    assert command[command.index("-video_size") + 1] == "800x600"
    assert command[command.index("-framerate") + 1] == "16"
    assert command[command.index("-c:v") + 1] == "libx264"


def test_mobile_remote_desktop_serves_cursor_state(tmp_path, monkeypatch):
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "GetSystemMetrics", lambda index: 1200 if index == 0 else 800)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "GetCursorPos", lambda: (300, 400))

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)

        payload = requests.get(f"{base}/api/remote/cursor", headers={"X-AT-Remote-Key": auth_key}, timeout=3).json()

        assert payload["ok"] is True
        assert payload["cursor"]["x"] == 300
        assert payload["cursor"]["y"] == 400
        assert payload["cursor"]["width"] == 1200
        assert payload["cursor"]["height"] == 800
    finally:
        bridge.stop()


def test_mobile_remote_desktop_tap_routes_mouse_input(tmp_path, monkeypatch):
    events: list[tuple[str, tuple[int, int] | int]] = []
    cursor = [0, 0]

    def fake_set_cursor_pos(point: tuple[int, int]) -> None:
        cursor[0], cursor[1] = point
        events.append(("pos", point))

    def fake_get_cursor_pos() -> tuple[int, int]:
        return (cursor[0], cursor[1])

    def fake_mouse_event(flag: int, x: int, y: int, data: int, extra: int) -> None:
        events.append(("mouse", flag))

    monkeypatch.setattr(mobile_remote_module.executor.win32api, "GetSystemMetrics", lambda index: 1000 if index == 0 else 500)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "SetCursorPos", fake_set_cursor_pos)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "GetCursorPos", fake_get_cursor_pos)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "mouse_event", fake_mouse_event)

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)

        payload = requests.post(
            f"{base}/api/remote/input",
            headers={"X-AT-Remote-Key": auth_key},
            json={"action": "tap", "xRatio": 0.25, "yRatio": 0.5},
            timeout=3,
        ).json()

        assert payload["status"] == "success"
        assert payload["cursor"]["x"] == 250
        assert payload["cursor"]["y"] == 250
        assert events[0] == ("pos", (250, 250))
        assert events[1:] == [
            ("mouse", mobile_remote_module.executor.win32con.MOUSEEVENTF_LEFTDOWN),
            ("mouse", mobile_remote_module.executor.win32con.MOUSEEVENTF_LEFTUP),
        ]
    finally:
        bridge.stop()


def test_mobile_remote_desktop_input_maps_selected_monitor(tmp_path, monkeypatch):
    events: list[tuple[str, tuple[int, int] | int]] = []
    cursor = [0, 0]

    monkeypatch.setattr(
        mobile_remote_module,
        "_remote_monitors",
        lambda: [
            {"id": "monitor-0", "label": "Màn hình chính", "x": 0, "y": 0, "width": 1000, "height": 500, "isPrimary": True},
            {"id": "monitor-1", "label": "Màn hình 2", "x": 1000, "y": 0, "width": 800, "height": 600, "isPrimary": False},
        ],
    )

    def fake_set_cursor_pos(point: tuple[int, int]) -> None:
        cursor[0], cursor[1] = point
        events.append(("pos", point))

    def fake_get_cursor_pos() -> tuple[int, int]:
        return (cursor[0], cursor[1])

    def fake_mouse_event(flag: int, x: int, y: int, data: int, extra: int) -> None:
        events.append(("mouse", flag))

    monkeypatch.setattr(mobile_remote_module.executor.win32api, "SetCursorPos", fake_set_cursor_pos)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "GetCursorPos", fake_get_cursor_pos)
    monkeypatch.setattr(mobile_remote_module.executor.win32api, "mouse_event", fake_mouse_event)

    bridge = MobileRemoteBridge(_FakeEngine(), settings_store=_store(tmp_path, monkeypatch))
    bridge.start(host="127.0.0.1", port=0)
    base = f"http://127.0.0.1:{bridge.port}"
    try:
        auth_key = _paired_auth_key(bridge)
        _grant_remote_desktop(bridge)

        payload = requests.post(
            f"{base}/api/remote/input",
            headers={"X-AT-Remote-Key": auth_key},
            json={"action": "tap", "monitorId": "monitor-1", "xRatio": 0.5, "yRatio": 0.5},
            timeout=3,
        ).json()

        assert payload["status"] == "success"
        assert payload["cursor"]["monitorId"] == "monitor-1"
        assert payload["cursor"]["x"] == 400
        assert payload["cursor"]["y"] == 300
        assert events[0] == ("pos", (1400, 300))
    finally:
        bridge.stop()
