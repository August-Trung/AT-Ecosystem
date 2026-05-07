from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import src.plugins.chat_session_service as chat_session_module
from src.plugins.chat_session_service import ChatSessionService


def test_chat_session_service_create_save_list_and_load(tmp_path, monkeypatch):
    monkeypatch.setattr(chat_session_module, "runtime_root", lambda: Path(tmp_path))

    service = ChatSessionService()
    session = service.create_session()
    session_id = session["session_id"]

    messages = [
        {"role": "assistant", "kind": "text", "text": "Xin chào!", "style": "normal"},
        {"role": "user", "kind": "text", "text": "mở notepad", "style": "normal"},
        {"role": "assistant", "kind": "text", "text": "Đã mở notepad", "style": "success"},
    ]
    saved = service.save_session(session_id, title="tmp", messages=messages)

    assert saved["title"] == "mở notepad"
    assert saved["message_count"] == 3
    assert saved["preview"] == "Đã mở notepad"

    sessions = service.list_sessions()
    assert sessions[0]["session_id"] == session_id

    loaded = service.load_session(session_id)
    assert loaded["messages"][1]["text"] == "mở notepad"
    assert loaded["title"] == "mở notepad"


def test_chat_session_service_title_fallback_and_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(chat_session_module, "runtime_root", lambda: Path(tmp_path))

    service = ChatSessionService()
    session = service.create_session(title="Cuộc trò chuyện mới")
    session_id = session["session_id"]
    service.save_session(
        session_id,
        title="Cuộc trò chuyện mới",
        messages=[{"role": "assistant", "kind": "text", "text": "Xin chào!", "style": "normal"}],
    )

    loaded = service.load_session(session_id)
    assert loaded["title"] == "Cuộc trò chuyện mới"

    service.delete_session(session_id)
    assert service.list_sessions() == []


def test_chat_session_service_suggest_successful_commands(tmp_path, monkeypatch):
    monkeypatch.setattr(chat_session_module, "runtime_root", lambda: Path(tmp_path))

    service = ChatSessionService()

    session_1 = service.create_session()
    service.save_session(
        session_1["session_id"],
        title="tmp",
        messages=[
            {"role": "user", "kind": "text", "text": "đăng xuất gg drive", "style": "normal"},
            {"role": "assistant", "kind": "text", "text": "Đã đăng xuất Google Drive.", "style": "success"},
        ],
    )

    session_2 = service.create_session()
    service.save_session(
        session_2["session_id"],
        title="tmp",
        messages=[
            {"role": "user", "kind": "text", "text": "đăng nhập google drive", "style": "normal"},
            {"role": "assistant", "kind": "text", "text": "Đã kết nối Google Drive.", "style": "success"},
        ],
    )

    suggestions = service.suggest_successful_commands("đăng xuất drive", limit=3)

    assert suggestions
    assert suggestions[0] == "đăng xuất gg drive"


def test_chat_session_service_ignores_numeric_choices_in_suggestions(tmp_path, monkeypatch):
    monkeypatch.setattr(chat_session_module, "runtime_root", lambda: Path(tmp_path))

    service = ChatSessionService()

    session = service.create_session()
    service.save_session(
        session["session_id"],
        title="tmp",
        messages=[
            {"role": "user", "kind": "text", "text": "2", "style": "normal"},
            {"role": "assistant", "kind": "text", "text": "Đã mở file.", "style": "success"},
            {"role": "user", "kind": "text", "text": "đăng xuất gg drive", "style": "normal"},
            {"role": "assistant", "kind": "text", "text": "Đã đăng xuất Google Drive.", "style": "success"},
        ],
    )

    suggestions = service.suggest_successful_commands("đăng xuất drive", limit=5)

    assert "2" not in suggestions
    assert "đăng xuất gg drive" in suggestions
