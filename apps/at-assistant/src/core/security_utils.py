"""
security_utils.py — Fernet encryption backed by Windows Credential Manager (keyring).

Chức năng chính:
- Tự động generate và lưu Fernet key vào Windows Credential Manager khi chạy lần đầu.
- Mã hóa / giải mã nội dung file JSON (credentials, OAuth tokens).
- Hỗ trợ migration trong suốt: nếu file cũ là plaintext, tự động mã hóa lại khi đọc.

Cách sử dụng:
    from src.core.security_utils import read_json_file, write_json_file
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import keyring
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_SERVICE_NAME = "ATAssistant"
_KEY_USERNAME = "fernet_key"

# Cache Fernet instance để tránh gọi keyring nhiều lần
_fernet_instance: Fernet | None = None


# ===========================================================================
# Internal key management
# ===========================================================================


def _get_fernet() -> Fernet:
    """
    Trả về Fernet instance (cached).
    Nếu chưa có key trong Credential Manager thì generate mới và lưu vào đó.
    """
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    stored_key = keyring.get_password(_SERVICE_NAME, _KEY_USERNAME)
    if stored_key:
        key = stored_key.encode()
        logger.debug("[Security] Đã tải Fernet key từ Windows Credential Manager.")
    else:
        key = Fernet.generate_key()
        keyring.set_password(_SERVICE_NAME, _KEY_USERNAME, key.decode())
        logger.info(
            "[Security] Chưa có Fernet key — đã tạo key mới và lưu vào "
            "Windows Credential Manager (service='%s', username='%s').",
            _SERVICE_NAME,
            _KEY_USERNAME,
        )

    _fernet_instance = Fernet(key)
    return _fernet_instance


# ===========================================================================
# Public API
# ===========================================================================


def encrypt_text(plaintext: str) -> bytes:
    """
    Mã hóa chuỗi UTF-8 và trả về Fernet-encrypted bytes.
    Output luôn bắt đầu bằng 'gAAAAA' (Fernet token format).
    """
    return _get_fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_text(ciphertext: bytes) -> str:
    """
    Giải mã Fernet-encrypted bytes và trả về chuỗi UTF-8 gốc.
    Raise InvalidToken nếu dữ liệu bị hỏng hoặc key sai.
    """
    return _get_fernet().decrypt(ciphertext).decode("utf-8")


def decrypt_text_safe(raw: bytes) -> str:
    """
    Giải mã an toàn: thử Fernet trước, nếu không được thì fallback về plaintext UTF-8.
    Dùng để đọc file có thể là encrypted hoặc plaintext (hỗ trợ migration).
    """
    try:
        return decrypt_text(raw)
    except (InvalidToken, Exception):
        # File cũ chưa được mã hóa → trả về nguyên văn
        return raw.decode("utf-8")


def read_json_file(path: Path) -> dict:
    """
    Đọc một file JSON có thể đã được mã hóa (Fernet) hoặc còn ở dạng plaintext.

    - Nếu file bị mã hóa: giải mã rồi parse JSON.
    - Nếu file là plaintext (file cũ chưa migrate): parse JSON rồi **tự động
      ghi lại dưới dạng mã hóa** để migration trong suốt.
    - Trả về dict rỗng nếu file không tồn tại hoặc bị lỗi.
    """
    if not path.exists():
        return {}

    raw = path.read_bytes()
    if not raw:
        return {}

    try:
        text = decrypt_text_safe(raw)
        data = json.loads(text)
    except Exception as exc:
        logger.warning("[Security] Không thể đọc '%s': %s", path.name, exc)
        return {}

    # Migration: nếu file cũ là plaintext thì ghi lại dưới dạng mã hóa
    if _is_plaintext(raw):
        try:
            write_json_file(path, data)
            logger.info("[Security] Đã migrate '%s' sang định dạng mã hóa.", path.name)
        except Exception as exc:
            logger.warning(
                "[Security] Không thể ghi lại '%s' sau migration: %s", path.name, exc
            )

    return data


def write_json_file(path: Path, data: dict) -> None:
    """
    Serialize dict thành JSON, mã hóa bằng Fernet rồi ghi ra file.
    Tự tạo thư mục cha nếu chưa tồn tại.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_bytes(encrypt_text(text))


# ===========================================================================
# Helpers
# ===========================================================================


def _is_plaintext(raw: bytes) -> bool:
    """
    Trả về True nếu *raw* trông như JSON thuần (chưa mã hóa).
    Fernet token luôn bắt đầu bằng b'gAAAAA', nên nếu không có prefix đó
    thì đây là plaintext.
    """
    return not raw.lstrip().startswith(b"gAAAAA")
