from __future__ import annotations

import queue
import re
import threading
import time
import unicodedata
from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Callable

from src.core.voice_package_manager import VoicePackageManager
from src.core.voice_runtime import (
    NoSpeechDetectedError,
    SherpaSpeechRecognizer,
    VoiceUnavailableError,
)


class WakewordEventType(str, Enum):
    DETECTED = "detected"
    STATUS = "status"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


@dataclass(frozen=True)
class WakewordEvent:
    type: WakewordEventType
    message: str = ""
    transcript: str = ""


@dataclass(frozen=True)
class WakewordConfig:
    sample_rate: int = 16000
    chunk_size: int = 640
    activation_threshold: float = 0.012
    continuation_threshold: float = 0.008
    min_speech_sec: float = 0.25
    trailing_silence_sec: float = 0.55
    max_segment_sec: float = 1.6
    pre_roll_sec: float = 0.18
    cooldown_sec: float = 2.0
    idle_sleep_sec: float = 0.05
    error_backoff_sec: float = 1.0
    unavailable_backoff_sec: float = 3.0


class WakewordService:
    def __init__(
        self,
        package_manager: VoicePackageManager,
        *,
        config: WakewordConfig | None = None,
        event_queue: queue.Queue[WakewordEvent] | None = None,
        can_listen: Callable[[], bool] | None = None,
        settings_provider: Callable[[], dict] | None = None,
    ) -> None:
        self._package_manager = package_manager
        self._config = config or WakewordConfig()
        self._events = event_queue or queue.Queue()
        self._can_listen = can_listen or (lambda: True)
        self._settings_provider = settings_provider or (lambda: {})
        self._speech_to_text = SherpaSpeechRecognizer(package_manager)
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._cooldown_until = 0.0
        self._availability_announced = False

    @property
    def event_queue(self) -> queue.Queue[WakewordEvent]:
        return self._events

    def is_running(self) -> bool:
        worker = self._thread
        return bool(worker and worker.is_alive())

    def start(self) -> bool:
        with self._lock:
            if self.is_running():
                return False
            self._stop_event = threading.Event()
            self._pause_event = threading.Event()
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()
            return True

    def stop(self) -> None:
        self._stop_event.set()
        self._pause_event.set()

    def pause(self) -> None:
        self._pause_event.set()

    def resume(self) -> None:
        self._pause_event.clear()

    def set_cooldown(self, seconds: float) -> None:
        delay = max(0.0, float(seconds or 0.0))
        self._cooldown_until = time.monotonic() + delay

    def _run_loop(self) -> None:
        try:
            import pyaudio
        except Exception as exc:
            self._emit(
                WakewordEventType.UNAVAILABLE,
                f"Wakeword chưa sẵn sàng: thiếu PyAudio ({exc})",
            )
            return

        audio = pyaudio.PyAudio()
        stream = None
        cfg = self._config
        pre_roll: deque[bytes] = deque(
            maxlen=max(1, int(cfg.pre_roll_sec * cfg.sample_rate / cfg.chunk_size))
        )
        active_frames: list[bytes] = []
        speech_started = False
        speech_chunks = 0
        silent_after_speech = 0

        try:
            while not self._stop_event.is_set():
                if self._pause_event.is_set() or not self._can_listen():
                    if stream is not None:
                        stream = self._close_stream(stream)
                    pre_roll.clear()
                    active_frames = []
                    speech_started = False
                    speech_chunks = 0
                    silent_after_speech = 0
                    time.sleep(cfg.idle_sleep_sec)
                    continue

                if time.monotonic() < self._cooldown_until:
                    time.sleep(cfg.idle_sleep_sec)
                    continue

                current_settings = self._settings_provider() or {}
                if not bool(current_settings.get("wakeword_enabled", True)):
                    time.sleep(cfg.idle_sleep_sec)
                    continue

                min_speech_chunks = max(
                    1, int(cfg.min_speech_sec * cfg.sample_rate / cfg.chunk_size)
                )
                silence_limit = max(
                    1, int(cfg.trailing_silence_sec * cfg.sample_rate / cfg.chunk_size)
                )
                max_chunks = max(
                    1, int(cfg.max_segment_sec * cfg.sample_rate / cfg.chunk_size)
                )
                activation_threshold = float(
                    current_settings.get(
                        "wakeword_activation_threshold", cfg.activation_threshold
                    )
                    or cfg.activation_threshold
                )
                continuation_threshold = float(
                    current_settings.get(
                        "wakeword_continuation_threshold",
                        cfg.continuation_threshold,
                    )
                    or cfg.continuation_threshold
                )
                cooldown_sec = float(
                    current_settings.get("wakeword_cooldown_sec", cfg.cooldown_sec)
                    or cfg.cooldown_sec
                )

                status = self._package_manager.refresh_status()
                if not status.control_ready:
                    if not self._availability_announced:
                        self._availability_announced = True
                        self._emit(
                            WakewordEventType.UNAVAILABLE,
                            "Wakeword offline chưa sẵn sàng vì gói nhận lệnh giọng nói chưa sẵn sàng.",
                        )
                    time.sleep(cfg.unavailable_backoff_sec)
                    continue

                self._availability_announced = False

                if stream is None:
                    stream = audio.open(
                        format=pyaudio.paInt16,
                        channels=1,
                        rate=cfg.sample_rate,
                        input=True,
                        frames_per_buffer=cfg.chunk_size,
                    )
                    _ww_phrase = str(
                        current_settings.get("wakeword_phrase") or "Hải ơi"
                    ).strip()
                    self._emit(
                        WakewordEventType.STATUS,
                        f"Wakeword đang lắng nghe cụm '{_ww_phrase}'.",
                    )

                data = stream.read(cfg.chunk_size, exception_on_overflow=False)
                level = self._chunk_level(data)

                if not speech_started:
                    pre_roll.append(data)
                    if level < activation_threshold:
                        continue
                    speech_started = True
                    active_frames = list(pre_roll)
                    speech_chunks = 1
                    silent_after_speech = 0
                    continue

                active_frames.append(data)
                if level >= continuation_threshold:
                    speech_chunks += 1
                    silent_after_speech = 0
                else:
                    silent_after_speech += 1

                if silent_after_speech < silence_limit and len(active_frames) < max_chunks:
                    continue

                segment = b"".join(active_frames)
                pre_roll.clear()
                active_frames = []
                speech_started = False
                silent_after_speech = 0

                if speech_chunks < min_speech_chunks:
                    speech_chunks = 0
                    continue

                speech_chunks = 0
                transcript = self._transcribe_segment(segment)
                if not transcript:
                    continue
                if not self._matches_wakeword(transcript, current_settings):
                    continue

                self.pause()
                self._cooldown_until = time.monotonic() + cooldown_sec
                self._emit(
                    WakewordEventType.DETECTED,
                    "Đã phát hiện wakeword.",
                    transcript=transcript,
                )
                stream = self._close_stream(stream)
        except Exception as exc:
            self._emit(WakewordEventType.ERROR, f"Wakeword runtime lỗi: {exc}")
            time.sleep(cfg.error_backoff_sec)
        finally:
            if stream is not None:
                self._close_stream(stream)
            audio.terminate()

    def _transcribe_segment(self, audio_bytes: bytes) -> str:
        try:
            return (self._speech_to_text.transcribe(audio_bytes) or "").strip()
        except (VoiceUnavailableError, NoSpeechDetectedError):
            return ""
        except Exception:
            return ""

    def _matches_wakeword(self, transcript: str, settings: dict | None = None) -> bool:
        settings = settings or {}
        normalized = self._normalize_phrase(transcript)
        rejected = {
            self._normalize_phrase(item)
            for item in list(settings.get("wakeword_reject_phrases") or [])
            if str(item).strip()
        }
        if normalized in rejected:
            return False

        allowed_variants = {
            self._normalize_phrase(item)
            for item in list(settings.get("wakeword_allowed_variants") or [])
            if str(item).strip()
        }

        base_phrase = self._normalize_phrase(
            str(settings.get("wakeword_phrase") or "Hải ơi")
        )
        if normalized == base_phrase:
            return True
        if normalized in allowed_variants:
            return True

        # Fuzzy fallback: transcript phải bắt đầu bằng các từ của base_phrase
        # (không hardcode "Hải ơi" — phải dựa trên wakeword đang được cài đặt)
        parts = normalized.split()
        base_parts = base_phrase.split()
        if not base_parts or len(parts) > len(base_parts) + 1:
            return False
        return (
            len(parts) >= len(base_parts)
            and parts[: len(base_parts)] == base_parts
        )

    def _normalize_phrase(self, value: str) -> str:
        lowered = (value or "").lower().strip()
        folded = unicodedata.normalize("NFD", lowered)
        folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
        folded = re.sub(r"[^a-z0-9\s]", " ", folded)
        folded = re.sub(r"\s+", " ", folded).strip()
        return folded

    def _emit(
        self,
        event_type: WakewordEventType,
        message: str = "",
        *,
        transcript: str = "",
    ) -> None:
        self._events.put(
            WakewordEvent(type=event_type, message=message, transcript=transcript)
        )

    @staticmethod
    def _chunk_level(chunk_bytes: bytes) -> float:
        import numpy as np

        chunk = np.frombuffer(chunk_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        if chunk.size == 0:
            return 0.0
        centered = chunk - float(np.mean(chunk))
        return float(np.sqrt(np.mean(np.square(centered))))

    @staticmethod
    def _close_stream(stream):
        try:
            stream.stop_stream()
        except Exception:
            pass
        try:
            stream.close()
        except Exception:
            pass
        return None
