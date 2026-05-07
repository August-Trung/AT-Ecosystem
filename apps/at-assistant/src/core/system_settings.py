from __future__ import annotations

import json
import re
import unicodedata
from copy import deepcopy
from pathlib import Path
from typing import Any

from src.core.app_paths import ensure_app_data_dir


DEFAULT_SYSTEM_SETTINGS: dict[str, Any] = {
    "appearance_mode": "dark",
    "widget_scale": 1.0,
    "speaker_enabled": True,
    "display_name": "",
    "wakeword_enabled": True,
    "wakeword_beep_enabled": True,
    "wakeword_beep_frequency_hz": 1046,
    "wakeword_beep_duration_ms": 90,
    "wakeword_phrase": "Hải ơi",
    "wakeword_prompt_normal": "Dạ, mời bạn nói.",
    "wakeword_prompt_confirm": "Bạn đang ở bước xác nhận. Hãy nói đồng ý hoặc hủy.",
    "wakeword_prompt_choice": "Bạn đang ở bước lựa chọn. Hãy nói số thứ tự hoặc hủy.",
    "wakeword_prompt_retry": "Mình chưa nghe rõ. Hãy nói lại.",
    "wakeword_reject_phrases": [
        "ai oi",
        "hay oi",
        "hai nguoi",
        "hoi oi",
    ],
    "wakeword_allowed_variants": [
        "hai oi",
        "hai oi a",
        "hai oi oi",
    ],
    "wakeword_activation_threshold": 0.012,
    "wakeword_continuation_threshold": 0.008,
    "wakeword_cooldown_sec": 2.0,
    "wakeword_cooldown_success_sec": 2.5,
    "wakeword_cooldown_no_speech_sec": 1.0,
    "wakeword_cooldown_cancel_sec": 1.2,
    "voice_pre_speech_timeout_sec": 4.0,
    "voice_max_recording_sec": 8.0,
    "voice_session_max_retries": 2,
}


def _normalize_phrase(value: str) -> str:
    lowered = (value or "").lower().strip()
    folded = unicodedata.normalize("NFD", lowered)
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    folded = re.sub(r"[^a-z0-9\s]", " ", folded)
    return re.sub(r"\s+", " ", folded).strip()


def build_wakeword_rules(phrase: str) -> dict[str, list[str]]:
    phrase = re.sub(r"\s+", " ", (phrase or "").strip().lower())
    normalized = _normalize_phrase(phrase)
    if not normalized:
        normalized = _normalize_phrase(DEFAULT_SYSTEM_SETTINGS["wakeword_phrase"])

    allowed: list[str] = []
    for candidate in (normalized, f"{normalized} a", f"{normalized} oi"):
        if candidate and candidate not in allowed:
            allowed.append(candidate)

    rejected = []
    if normalized == "hai oi":
        rejected = ["ai oi", "hay oi", "hai nguoi", "hoi oi"]

    return {
        "wakeword_allowed_variants": allowed,
        "wakeword_reject_phrases": rejected,
    }


class SystemSettingsStore:
    def __init__(self) -> None:
        self._path = ensure_app_data_dir("settings") / "system_settings.json"

    @property
    def path(self) -> Path:
        return self._path

    def load(self) -> dict[str, Any]:
        data = deepcopy(DEFAULT_SYSTEM_SETTINGS)
        if not self._path.exists():
            return data
        try:
            with self._path.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            return data
        if isinstance(payload, dict):
            for key, value in payload.items():
                if key in data:
                    data[key] = value
        return data

    def save(self, settings: dict[str, Any]) -> dict[str, Any]:
        current = deepcopy(DEFAULT_SYSTEM_SETTINGS)
        for key, value in (settings or {}).items():
            if key in current:
                current[key] = value
        current.update(build_wakeword_rules(str(current.get("wakeword_phrase") or "")))
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("w", encoding="utf-8") as handle:
            json.dump(current, handle, ensure_ascii=False, indent=2)
        return current
