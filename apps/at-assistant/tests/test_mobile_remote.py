from __future__ import annotations

from pathlib import Path
import base64

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


def test_mobile_remote_settings_never_bind_loopback_for_lan(tmp_path, monkeypatch):
    store = _store(tmp_path, monkeypatch)
    saved = store.save({"enabled": True, "host": "127.0.0.1", "port": 8765, "paired_devices": []})

    assert saved["host"] == "0.0.0.0"
    assert store.load()["host"] == "0.0.0.0"


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
        assert payload["message"] == "Tệp đã sẵn sàng."
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
