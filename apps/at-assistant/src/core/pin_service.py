"""
pin_service.py — Quản lý PIN xác thực khi khởi động ATAssistant.

- Lưu PIN dưới dạng hash PBKDF2-HMAC-SHA256 (stdlib, không cần thư viện ngoài).
- File pin_config.json được mã hóa qua security_utils (Fernet).
- Không bao giờ lưu PIN dạng plaintext.
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

from src.core import security_utils
from src.core.app_paths import ensure_runtime_dir, runtime_root

_PIN_FILE = "pin_config.json"
_PBKDF2_ITERATIONS = 200_000  # NIST-khuyến nghị cho PBKDF2-SHA256


class PinService:
    """Service quản lý PIN xác thực."""

    def __init__(self) -> None:
        ensure_runtime_dir("app_settings")
        self._pin_path: Path = runtime_root() / "app_settings" / _PIN_FILE

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def is_pin_set(self) -> bool:
        """Trả về True nếu người dùng đã thiết lập PIN."""
        data = security_utils.read_json_file(self._pin_path)
        return bool(data.get("hash") and data.get("salt"))

    def set_pin(self, pin: str) -> None:
        """
        Thiết lập PIN mới.
        Raise ValueError nếu PIN không hợp lệ (không phải số, hoặc không 4-6 ký tự).
        """
        self._validate(pin)
        salt = os.urandom(16)
        security_utils.write_json_file(
            self._pin_path,
            {
                "hash": self._hash(pin, salt),
                "salt": salt.hex(),
            },
        )

    def verify_pin(self, pin: str) -> bool:
        """
        Kiểm tra PIN nhập vào có khớp với PIN đã lưu không.
        Trả về True nếu chưa thiết lập PIN (không chặn app).
        """
        data = security_utils.read_json_file(self._pin_path)
        if not data.get("hash") or not data.get("salt"):
            return True
        salt = bytes.fromhex(data["salt"])
        return self._hash(pin, salt) == data["hash"]

    def change_pin(self, old_pin: str, new_pin: str) -> None:
        """
        Đổi PIN. Raise ValueError nếu PIN cũ sai hoặc PIN mới không hợp lệ.
        """
        if not self.verify_pin(old_pin):
            raise ValueError("PIN cũ không đúng.")
        self.set_pin(new_pin)

    def clear_pin(self) -> None:
        """Xóa PIN — app sẽ không yêu cầu xác thực khi khởi động nữa."""
        if self._pin_path.exists():
            self._pin_path.unlink()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _hash(pin: str, salt: bytes) -> str:
        dk = hashlib.pbkdf2_hmac(
            "sha256", pin.encode("utf-8"), salt, _PBKDF2_ITERATIONS
        )
        return dk.hex()

    @staticmethod
    def _validate(pin: str) -> None:
        if not pin.isdigit():
            raise ValueError("PIN chỉ được chứa chữ số.")
        if not (4 <= len(pin) <= 6):
            raise ValueError("PIN phải có 4–6 chữ số.")
