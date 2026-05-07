from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

import requests

from src.core.env_loader import load_project_env
from src.core.external_api_ai import CancelledError


load_project_env()


CHAT_SYSTEM = """Bạn là lớp chat tự nhiên của AT Assistant.
Trả lời trực tiếp, ngắn gọn, hữu ích bằng ngôn ngữ của người dùng.
Không tự ý gọi tool, không nói rằng bạn đã mở app/gửi mail/tạo reminder.
Nếu câu hỏi cần dữ liệu thời gian thực hoặc nguồn mới, nói rõ cần tra cứu web thay vì bịa.
"""


class ChatProviderError(RuntimeError):
    def __init__(self, provider: str, message: str):
        super().__init__(message)
        self.provider = provider


def _openrouter_headers() -> Dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY environment variable.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _chat_messages(
    user_text: str,
    history: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    messages: List[Dict[str, Any]] = [{"role": "system", "content": CHAT_SYSTEM}]
    if history:
        messages.extend(history[-8:])
    messages.append({"role": "user", "content": user_text})
    return messages


def _generate_openrouter_reply(
    user_text: str,
    history: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    cancel_check=None,
) -> str:
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled before OpenRouter chat call.")

    model = (
        model
        or os.getenv("OPENROUTER_CHAT_MODEL", "").strip()
        or os.getenv("OPENROUTER_MODEL", "google/gemma-3-27b-it:free").strip()
    )
    base_url = (
        os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        .strip()
        .rstrip("/")
    )

    response = requests.post(
        url=f"{base_url}/chat/completions",
        headers=_openrouter_headers(),
        data=json.dumps(
            {
                "model": model,
                "messages": _chat_messages(user_text, history),
                "temperature": 0.4,
            }
        ),
        timeout=45,
    )
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled after OpenRouter chat call.")
    if response.status_code >= 400:
        raise ChatProviderError(
            "openrouter",
            f"OpenRouter chat error {response.status_code}: {response.text}",
        )

    data = response.json()
    content = data["choices"][0]["message"].get("content") or ""
    return str(content).strip()


def _generate_gemini_reply(
    user_text: str,
    history: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    cancel_check=None,
) -> str:
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled before Gemini chat call.")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ChatProviderError("gemini", "Missing GEMINI_API_KEY environment variable.")

    model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite").strip()
    base_url = (
        os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
        .strip()
        .rstrip("/")
    )

    contents: List[Dict[str, Any]] = []
    for item in (history or [])[-8:]:
        role = "model" if item.get("role") == "assistant" else "user"
        text = str(item.get("content") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": user_text}]})

    response = requests.post(
        url=f"{base_url}/models/{model}:generateContent",
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        data=json.dumps(
            {
                "systemInstruction": {"parts": [{"text": CHAT_SYSTEM}]},
                "contents": contents,
                "generationConfig": {"temperature": 0.4},
            }
        ),
        timeout=45,
    )
    if cancel_check and cancel_check():
        raise CancelledError("Request cancelled after Gemini chat call.")
    if response.status_code >= 400:
        raise ChatProviderError(
            "gemini",
            f"Gemini chat error {response.status_code}: {response.text}",
        )

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    return "\n".join(str(part.get("text") or "").strip() for part in parts).strip()


def _provider_order(provider: str) -> list[str]:
    normalized = (provider or "auto").strip().lower()
    if normalized in {"openrouter", "or"}:
        return ["openrouter"]
    if normalized in {"gemini", "google"}:
        return ["gemini"]
    if normalized in {"auto", "fallback", ""}:
        return ["openrouter", "gemini"]
    return [normalized]


def generate_chat_reply(
    user_text: str,
    history: Optional[List[Dict[str, Any]]] = None,
    model: Optional[str] = None,
    cancel_check=None,
) -> str:
    provider = os.getenv("AI_PROVIDER", "auto")
    errors: list[str] = []

    for current_provider in _provider_order(provider):
        try:
            if current_provider == "openrouter":
                reply = _generate_openrouter_reply(
                    user_text,
                    history=history,
                    model=model,
                    cancel_check=cancel_check,
                )
            elif current_provider == "gemini":
                reply = _generate_gemini_reply(
                    user_text,
                    history=history,
                    cancel_check=cancel_check,
                )
            else:
                raise ChatProviderError(
                    current_provider,
                    f"Unsupported AI_PROVIDER: {current_provider}",
                )
            if reply:
                return reply
            errors.append(f"{current_provider}: empty response")
        except CancelledError:
            raise
        except Exception as e:
            errors.append(f"{current_provider}: {e}")

    detail = " | ".join(errors) if errors else "No provider attempted."
    raise ChatProviderError("auto", detail)
