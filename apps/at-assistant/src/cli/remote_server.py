from __future__ import annotations

from src.core.env_loader import load_project_env

load_project_env()

import argparse
import sys
import time

from src.core.engine import Engine
from src.integrations.mobile_remote import DEFAULT_REMOTE_PORT, MobileRemoteBridge


def _print_status(bridge: MobileRemoteBridge) -> None:
    snapshot = bridge.snapshot()
    print("")
    print("AT Remote đang chạy.")
    print(f"Mã kết nối: {snapshot['pairCode']}")
    print("Mở trên điện thoại:")
    for url in snapshot.get("pairingUrls") or snapshot.get("urls") or []:
        print(f"  {url}")
    tailscale_urls = snapshot.get("tailscalePairingUrls") or []
    if tailscale_urls:
        print("Dùng từ xa qua Tailscale:")
        for url in tailscale_urls:
            print(f"  {url}")
    print("")
    print("Lệnh trong cửa sổ này: pending, approve <id>, reject <id>, devices, code, quit")


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the AT Remote LAN bridge.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=DEFAULT_REMOTE_PORT)
    args = parser.parse_args(argv)

    bridge = MobileRemoteBridge(Engine())
    bridge.start(host=args.host, port=args.port)
    _print_status(bridge)

    try:
        while True:
            try:
                line = input("at-remote> ").strip()
            except EOFError:
                while True:
                    time.sleep(3600)
            if not line:
                continue
            command, _, rest = line.partition(" ")
            command = command.lower()
            request_id = rest.strip()
            if command in {"quit", "exit", "q"}:
                return 0
            if command == "pending":
                pending = bridge.snapshot().get("pending") or []
                if not pending:
                    print("Không có thiết bị đang chờ.")
                for item in pending:
                    print(f"{item['id']} - {item['deviceName']} ({item.get('clientHost') or 'LAN'})")
                continue
            if command == "approve":
                print(bridge.approve_pair_request(request_id).get("message") or "Đã duyệt.")
                continue
            if command == "reject":
                print("Đã từ chối." if bridge.reject_pair_request(request_id).get("ok") else "Không tìm thấy thiết bị.")
                continue
            if command == "devices":
                devices = bridge.snapshot().get("devices") or []
                if not devices:
                    print("Chưa có thiết bị nào.")
                for item in devices:
                    print(f"{item['id']} - {item['name']} - lần cuối: {item.get('lastSeen') or 'chưa có'}")
                continue
            if command == "code":
                bridge.rotate_pair_code()
                _print_status(bridge)
                continue
            print("Không hiểu lệnh.")
    finally:
        bridge.stop()


if __name__ == "__main__":
    sys.exit(run())
