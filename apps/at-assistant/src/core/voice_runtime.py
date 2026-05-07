from __future__ import annotations

import queue
import re
import threading
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Protocol

from src.core.result import ActionResult, ActionStatus
from src.core.voice_package_manager import VoicePackageManager


class VoiceEventType(str, Enum):
    STARTED = "started"
    LISTENING = "listening"
    SPEECH_DETECTED = "speech_detected"
    TRANSCRIBING = "transcribing"
    TRANSCRIPT = "transcript"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    UNAVAILABLE = "unavailable"
    ERROR = "error"


@dataclass(frozen=True)
class VoiceEvent:
    type: VoiceEventType
    message: str = ""
    transcript: str = ""


class VoiceRuntimeError(RuntimeError):
    pass


class VoiceUnavailableError(VoiceRuntimeError):
    pass


class NoSpeechDetectedError(VoiceRuntimeError):
    pass


class AudioInput(Protocol):
    def record_once(self, stop_check: Callable[[], bool] | None = None) -> bytes:
        ...


class SpeechToText(Protocol):
    def transcribe(self, audio_bytes: bytes) -> str:
        ...


class ResponseSpeaker(Protocol):
    def speak(self, text: str) -> bool:
        ...


@dataclass(frozen=True)
class VoiceCaptureConfig:
    sample_rate: int = 16000
    chunk_size: int = 1024
    pre_speech_timeout_sec: float = 4.0
    max_recording_sec: float = 8.0
    trailing_silence_sec: float = 1.0
    min_speech_sec: float = 0.35
    activation_threshold: float = 0.015
    continuation_threshold: float = 0.009


class PyAudioVoiceInput:
    def __init__(self, config: VoiceCaptureConfig | None = None) -> None:
        self._config = config or VoiceCaptureConfig()

    def update_config(self, config: VoiceCaptureConfig) -> None:
        self._config = config

    def record_once(self, stop_check: Callable[[], bool] | None = None) -> bytes:
        try:
            import numpy as np
            import pyaudio
        except Exception as exc:
            raise VoiceUnavailableError("Thiếu PyAudio để thu âm từ microphone.") from exc

        audio = pyaudio.PyAudio()
        stream = None
        cfg = self._config
        raw_frames: list[bytes] = []
        speech_started = False
        speech_chunks = 0
        silent_after_speech = 0
        max_chunks = max(1, int(cfg.max_recording_sec * cfg.sample_rate / cfg.chunk_size))
        pre_speech_limit = max(1, int(cfg.pre_speech_timeout_sec * cfg.sample_rate / cfg.chunk_size))
        silence_limit = max(1, int(cfg.trailing_silence_sec * cfg.sample_rate / cfg.chunk_size))
        min_speech_chunks = max(1, int(cfg.min_speech_sec * cfg.sample_rate / cfg.chunk_size))

        try:
            stream = audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=cfg.sample_rate,
                input=True,
                frames_per_buffer=cfg.chunk_size,
            )

            for chunk_index in range(max_chunks):
                if stop_check and stop_check():
                    return b""

                data = stream.read(cfg.chunk_size, exception_on_overflow=False)
                raw_frames.append(data)
                pcm = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                level = self._chunk_level(pcm)

                if not speech_started:
                    if level >= cfg.activation_threshold:
                        speech_started = True
                        speech_chunks = 1
                        silent_after_speech = 0
                    elif chunk_index + 1 >= pre_speech_limit:
                        break
                    continue

                if level >= cfg.continuation_threshold:
                    speech_chunks += 1
                    silent_after_speech = 0
                else:
                    silent_after_speech += 1
                    if silent_after_speech >= silence_limit:
                        break

            if not speech_started or speech_chunks < min_speech_chunks:
                raise NoSpeechDetectedError("Không nhận được câu lệnh giọng nói rõ ràng.")

            return b"".join(raw_frames)
        finally:
            if stream is not None:
                try:
                    stream.stop_stream()
                except Exception:
                    pass
                try:
                    stream.close()
                except Exception:
                    pass
            audio.terminate()

    @staticmethod
    def _chunk_level(chunk) -> float:
        import numpy as np

        if chunk.size == 0:
            return 0.0
        centered = chunk - float(np.mean(chunk))
        return float(np.sqrt(np.mean(np.square(centered))))


class SherpaSpeechRecognizer:
    def __init__(self, package_manager: VoicePackageManager) -> None:
        self._package_manager = package_manager
        self._recognizer = None
        self._recognizer_lock = threading.Lock()
        self._sample_rate = 16000

    def transcribe(self, audio_bytes: bytes) -> str:
        if not audio_bytes:
            return ""

        import numpy as np

        recognizer = self._get_recognizer()
        audio = np.frombuffer(audio_bytes, dtype=np.int16)
        if audio.size == 0:
            return ""

        stream = recognizer.create_stream()
        stream.accept_waveform(self._sample_rate, audio.astype(np.float32) / 32768.0)
        recognizer.decode_stream(stream)
        return (stream.result.text or "").strip()

    def _get_recognizer(self):
        with self._recognizer_lock:
            if self._recognizer is not None:
                return self._recognizer

            model_path = self._package_manager.get_stt_model_path()
            if model_path is None:
                raise VoiceUnavailableError("Gói nhận lệnh giọng nói offline chưa sẵn sàng.")

            try:
                import sherpa_onnx
            except Exception as exc:
                raise VoiceUnavailableError("Thiếu runtime sherpa-onnx để nhận lệnh giọng nói offline.") from exc

            self._recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
                encoder=str(model_path / "encoder-epoch-20-avg-10.onnx"),
                decoder=str(model_path / "decoder-epoch-20-avg-10.onnx"),
                joiner=str(model_path / "joiner-epoch-20-avg-10.onnx"),
                tokens=str(model_path / "tokens.txt"),
                num_threads=4,
                sample_rate=self._sample_rate,
                feature_dim=80,
                decoding_method="greedy_search",
            )
            return self._recognizer


class PiperResponseSpeaker:
    def __init__(self, package_manager: VoicePackageManager) -> None:
        self._package_manager = package_manager

    def speak(self, text: str) -> bool:
        return self._package_manager.speak_async(text)


class VoiceOrchestrator:
    def __init__(
        self,
        package_manager: VoicePackageManager,
        *,
        audio_input: AudioInput | None = None,
        speech_to_text: SpeechToText | None = None,
        speaker: ResponseSpeaker | None = None,
        event_queue: queue.Queue[VoiceEvent] | None = None,
    ) -> None:
        self._package_manager = package_manager
        self._audio_input = audio_input or PyAudioVoiceInput()
        self._speech_to_text = speech_to_text or SherpaSpeechRecognizer(package_manager)
        self._speaker = speaker or PiperResponseSpeaker(package_manager)
        self._events = event_queue or queue.Queue()
        self._lock = threading.Lock()
        self._worker: threading.Thread | None = None
        self._stop_event = threading.Event()

    @property
    def event_queue(self) -> queue.Queue[VoiceEvent]:
        return self._events

    def is_busy(self) -> bool:
        worker = self._worker
        return bool(worker and worker.is_alive())

    def start_listen_once(self) -> bool:
        with self._lock:
            if self.is_busy():
                return False

            status = self._package_manager.refresh_status()
            if not status.control_ready:
                self._emit(
                    VoiceEventType.UNAVAILABLE,
                    "Gói nhận lệnh giọng nói offline chưa sẵn sàng. App vẫn dùng text bình thường.",
                )
                return False

            self._stop_event = threading.Event()
            worker = threading.Thread(target=self._run_single_turn, daemon=True)
            self._worker = worker
            worker.start()
            return True

    def cancel(self) -> None:
        self._stop_event.set()

    def update_capture_config(self, config: VoiceCaptureConfig) -> None:
        if isinstance(self._audio_input, PyAudioVoiceInput):
            self._audio_input.update_config(config)

    def speak_for_result(self, result: ActionResult) -> bool:
        if result.status not in {ActionStatus.SUCCESS, ActionStatus.ERROR, ActionStatus.NEED_CLARIFY}:
            return False
        text = self._build_spoken_response(result)
        if not text:
            return False
        try:
            return self._speaker.speak(text)
        except Exception:
            return False

    def _run_single_turn(self) -> None:
        self._emit(VoiceEventType.STARTED, "Mic đã bật cho một lượt nói.")
        self._emit(VoiceEventType.LISTENING, "Đang nghe câu lệnh...")
        try:
            audio_bytes = self._audio_input.record_once(stop_check=self._stop_event.is_set)
            if self._stop_event.is_set():
                self._emit(VoiceEventType.CANCELLED, "Đã dừng nghe giọng nói.")
                return
            if not audio_bytes:
                self._emit(VoiceEventType.CANCELLED, "Đã dừng nghe giọng nói.")
                return

            self._emit(VoiceEventType.SPEECH_DETECTED, "Đã ghi nhận giọng nói, đang chuyển thành chữ...")
            self._emit(VoiceEventType.TRANSCRIBING, "Đang nhận diện câu lệnh bằng Zipformer...")
            transcript = (self._speech_to_text.transcribe(audio_bytes) or "").strip()
            if not transcript:
                raise NoSpeechDetectedError("Không nhận ra transcript từ câu lệnh vừa nói.")
            self._emit(VoiceEventType.TRANSCRIPT, "Đã nhận transcript.", transcript=transcript)
            self._emit(VoiceEventType.COMPLETED, "Voice turn hoàn tất.")
        except VoiceUnavailableError as exc:
            self._emit(VoiceEventType.UNAVAILABLE, str(exc))
        except NoSpeechDetectedError as exc:
            self._emit(VoiceEventType.ERROR, str(exc))
        except Exception as exc:
            self._emit(VoiceEventType.ERROR, f"Voice runtime lỗi: {exc}")

    def _emit(self, event_type: VoiceEventType, message: str = "", *, transcript: str = "") -> None:
        self._events.put(VoiceEvent(type=event_type, message=message, transcript=transcript))

    def _build_spoken_response(self, result: ActionResult) -> str:
        text = (result.message or "").strip()
        if not text:
            return ""
        text = re.sub(r"\s+\(foreground pid=\d+\)\.?", ".", text, flags=re.IGNORECASE)
        text = re.sub(r"\s+\(pid=\d+\)\.?", ".", text, flags=re.IGNORECASE)
        text = re.sub(r"https?://\S+", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"www\.\S+", " ", text, flags=re.IGNORECASE)
        normalized = " ".join(text.split())
        if len(normalized) > 220:
            return ""
        if result.status == ActionStatus.NEED_CLARIFY and "?" not in normalized and len(normalized) > 140:
            return ""
        return normalized
