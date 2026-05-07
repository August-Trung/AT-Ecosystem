from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_runtime_dir, runtime_root
from src.core.alias.normalize import normalize_text


VN_TZ = timezone(timedelta(hours=7))


class ChatSessionService:
    def __init__(self) -> None:
        ensure_runtime_dir("app_settings", "chat_sessions")
        self.root = runtime_root() / "app_settings" / "chat_sessions"
        self.root.mkdir(parents=True, exist_ok=True)

    def create_session(self, title: str = "Cuộc trò chuyện mới") -> dict[str, Any]:
        now = self._now_iso()
        payload = {
            "schema_version": 1,
            "session_id": self._new_session_id(),
            "title": (title or "Cuộc trò chuyện mới").strip(),
            "created_at": now,
            "updated_at": now,
            "preview": "",
            "message_count": 0,
            "messages": [],
        }
        self._save_payload(payload)
        return self._to_summary(payload)

    def list_sessions(self, *, limit: int = 50) -> list[dict[str, Any]]:
        sessions: list[dict[str, Any]] = []
        for path in self.root.glob("*.json"):
            payload = self._load_payload(path)
            if not payload:
                continue
            if not self.has_user_messages(payload.get("messages") or []):
                continue
            sessions.append(self._to_summary(payload))
        sessions.sort(key=lambda item: str(item.get("updated_at") or ""), reverse=True)
        return sessions[:limit]

    def load_session(self, session_id: str) -> dict[str, Any]:
        payload = self._load_payload(self._session_path(session_id))
        if not payload:
            raise FileNotFoundError(f"Không tìm thấy session '{session_id}'.")
        return payload

    def save_session(
        self,
        session_id: str,
        *,
        title: str,
        messages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        existing = self._load_payload(self._session_path(session_id)) or {}
        created_at = str(existing.get("created_at") or self._now_iso())
        clean_messages = [self._sanitize_message(item) for item in messages if isinstance(item, dict)]
        payload = {
            "schema_version": 1,
            "session_id": session_id,
            "title": self._derive_title(clean_messages, fallback=title),
            "created_at": created_at,
            "updated_at": self._now_iso(),
            "preview": self._build_preview(clean_messages),
            "message_count": len(clean_messages),
            "messages": clean_messages,
        }
        self._save_payload(payload)
        return payload

    def build_title_from_messages(self, messages: list[dict[str, Any]], fallback: str = "Cuộc trò chuyện mới") -> str:
        return self._derive_title(messages, fallback=fallback)

    def delete_session(self, session_id: str) -> None:
        path = self._session_path(session_id)
        if path.exists():
            path.unlink()

    def has_user_messages(self, messages: list[dict[str, Any]]) -> bool:
        for item in messages:
            if str(item.get("role") or "") != "user":
                continue
            if str(item.get("text") or "").strip():
                return True
        return False

    def suggest_successful_commands(self, query: str, *, limit: int = 5) -> list[str]:
        normalized_query = self._normalize_command(query)
        if not normalized_query:
            return []

        candidates: list[tuple[float, str]] = []
        seen: set[str] = set()
        for path in self.root.glob("*.json"):
            payload = self._load_payload(path)
            if not payload:
                continue
            messages = payload.get("messages") or []
            for command in self._extract_successful_commands(messages):
                if not self._is_meaningful_command(command):
                    continue
                normalized_command = self._normalize_command(command)
                if not normalized_command or normalized_command == normalized_query:
                    continue
                if normalized_command in seen:
                    continue
                score = self._score_similarity(normalized_query, normalized_command)
                if score <= 0:
                    continue
                seen.add(normalized_command)
                candidates.append((score, command))

        candidates.sort(key=lambda item: (-item[0], item[1]))
        return [command for _, command in candidates[: max(limit, 0)]]

    def _load_payload(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        try:
            with path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None
        payload.setdefault("messages", [])
        payload.setdefault("title", "Cuộc trò chuyện mới")
        payload.setdefault("preview", "")
        payload.setdefault("message_count", len(payload.get("messages") or []))
        return payload

    def _save_payload(self, payload: dict[str, Any]) -> None:
        path = self._session_path(str(payload.get("session_id") or ""))
        with path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

    def _session_path(self, session_id: str) -> Path:
        safe_session_id = (session_id or "").strip()
        if not safe_session_id:
            raise ValueError("Thiếu session_id.")
        return self.root / f"{safe_session_id}.json"

    def _new_session_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def _to_summary(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "session_id": payload.get("session_id") or "",
            "title": payload.get("title") or "Cuộc trò chuyện mới",
            "preview": payload.get("preview") or "",
            "updated_at": payload.get("updated_at") or "",
            "created_at": payload.get("created_at") or "",
            "message_count": int(payload.get("message_count") or len(payload.get("messages") or [])),
        }

    def _sanitize_message(self, payload: dict[str, Any]) -> dict[str, Any]:
        message = {
            "role": str(payload.get("role") or "assistant"),
            "kind": str(payload.get("kind") or "text"),
            "text": str(payload.get("text") or ""),
            "style": str(payload.get("style") or "normal"),
            "created_at": str(payload.get("created_at") or self._now_iso()),
            "payload": payload.get("payload") if isinstance(payload.get("payload"), dict) else {},
        }
        return message

    def _derive_title(self, messages: list[dict[str, Any]], fallback: str) -> str:
        for item in messages:
            if str(item.get("role") or "") != "user":
                continue
            text = " ".join(str(item.get("text") or "").split()).strip()
            if not text:
                continue
            if len(text) > 60:
                return text[:57].rstrip() + "..."
            return text
        fallback = (fallback or "Cuộc trò chuyện mới").strip()
        return fallback or "Cuộc trò chuyện mới"

    def _build_preview(self, messages: list[dict[str, Any]]) -> str:
        for item in reversed(messages):
            text = " ".join(str(item.get("text") or "").split()).strip()
            if not text:
                continue
            if len(text) > 90:
                return text[:87].rstrip() + "..."
            return text
        return ""

    def _now_iso(self) -> str:
        return datetime.now(VN_TZ).isoformat()

    def _extract_successful_commands(self, messages: list[dict[str, Any]]) -> list[str]:
        successful: list[str] = []
        for index, item in enumerate(messages):
            if str(item.get("role") or "") != "user":
                continue
            if str(item.get("kind") or "text") != "text":
                continue
            text = " ".join(str(item.get("text") or "").split()).strip()
            if not text:
                continue
            next_item = messages[index + 1] if index + 1 < len(messages) else {}
            if (
                str(next_item.get("role") or "") == "assistant"
                and str(next_item.get("kind") or "text") == "text"
                and str(next_item.get("style") or "") == "success"
            ):
                successful.append(text)
        return successful

    def _normalize_command(self, text: str) -> str:
        normalized = normalize_text(text or "")
        normalized = normalized.lower().strip()
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized

    def _tokenize_command(self, text: str) -> list[str]:
        normalized = self._normalize_command(text)
        return [token for token in re.split(r"[^0-9a-zA-ZÀ-ỹ_]+", normalized) if token]

    def _score_similarity(self, query: str, candidate: str) -> float:
        if query == candidate:
            return 0.0
        if query in candidate or candidate in query:
            return 1.0

        query_tokens = set(self._tokenize_command(query))
        candidate_tokens = set(self._tokenize_command(candidate))
        if not query_tokens or not candidate_tokens:
            return 0.0

        overlap = query_tokens & candidate_tokens
        if not overlap:
            return 0.0

        jaccard = len(overlap) / len(query_tokens | candidate_tokens)
        coverage = len(overlap) / len(query_tokens)
        return (jaccard * 0.6) + (coverage * 0.4)

    def _is_meaningful_command(self, text: str) -> bool:
        normalized = self._normalize_command(text)
        if not normalized:
            return False
        if re.fullmatch(r"\d+", normalized):
            return False
        if normalized in {"y", "yes", "n", "no", "ok", "1", "2", "3", "4", "5"}:
            return False
        if len(normalized) < 4:
            return False
        return True
