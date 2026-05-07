from __future__ import annotations

import queue
from dataclasses import dataclass

from src.core.result import ActionResult
from src.core.voice_runtime import (
    NoSpeechDetectedError,
    VoiceEventType,
    VoiceOrchestrator,
    VoiceUnavailableError,
)


@dataclass
class _FakeStatus:
    control_ready: bool = True
    speech_ready: bool = True


class _FakePackages:
    def __init__(self, *, control_ready: bool = True) -> None:
        self._status = _FakeStatus(control_ready=control_ready)

    def refresh_status(self):
        return self._status


class _FakeAudioInput:
    def __init__(self, payload: bytes = b"voice-bytes", *, error: Exception | None = None) -> None:
        self.payload = payload
        self.error = error

    def record_once(self, stop_check=None) -> bytes:
        if self.error:
            raise self.error
        return self.payload


class _FakeSpeechToText:
    def __init__(self, transcript: str = "check mail", *, error: Exception | None = None) -> None:
        self.transcript = transcript
        self.error = error

    def transcribe(self, audio_bytes: bytes) -> str:
        if self.error:
            raise self.error
        return self.transcript


class _FakeSpeaker:
    def __init__(self) -> None:
        self.spoken: list[str] = []

    def speak(self, text: str) -> bool:
        self.spoken.append(text)
        return True


def _drain_events(q: queue.Queue) -> list[tuple[VoiceEventType, str, str]]:
    events: list[tuple[VoiceEventType, str, str]] = []
    while True:
        try:
            item = q.get(timeout=1)
        except queue.Empty:
            break
        events.append((item.type, item.message, item.transcript))
        if item.type in {
            VoiceEventType.COMPLETED,
            VoiceEventType.CANCELLED,
            VoiceEventType.UNAVAILABLE,
            VoiceEventType.ERROR,
        }:
            break
    return events


def test_voice_orchestrator_happy_path_emits_transcript():
    q: queue.Queue = queue.Queue()
    orchestrator = VoiceOrchestrator(
        _FakePackages(control_ready=True),
        audio_input=_FakeAudioInput(),
        speech_to_text=_FakeSpeechToText("xem email hom nay"),
        speaker=_FakeSpeaker(),
        event_queue=q,
    )

    assert orchestrator.start_listen_once() is True

    events = _drain_events(q)

    assert [item[0] for item in events] == [
        VoiceEventType.STARTED,
        VoiceEventType.LISTENING,
        VoiceEventType.SPEECH_DETECTED,
        VoiceEventType.TRANSCRIBING,
        VoiceEventType.TRANSCRIPT,
        VoiceEventType.COMPLETED,
    ]
    assert events[4][2] == "xem email hom nay"


def test_voice_orchestrator_reports_unavailable_when_control_package_missing():
    q: queue.Queue = queue.Queue()
    orchestrator = VoiceOrchestrator(
        _FakePackages(control_ready=False),
        audio_input=_FakeAudioInput(),
        speech_to_text=_FakeSpeechToText(),
        speaker=_FakeSpeaker(),
        event_queue=q,
    )

    assert orchestrator.start_listen_once() is False

    events = _drain_events(q)

    assert events == [
        (
            VoiceEventType.UNAVAILABLE,
            "Gói nhận lệnh giọng nói offline chưa sẵn sàng. App vẫn dùng text bình thường.",
            "",
        )
    ]


def test_voice_orchestrator_reports_stt_error_without_crashing():
    q: queue.Queue = queue.Queue()
    orchestrator = VoiceOrchestrator(
        _FakePackages(control_ready=True),
        audio_input=_FakeAudioInput(),
        speech_to_text=_FakeSpeechToText(error=VoiceUnavailableError("Thieu sherpa runtime")),
        speaker=_FakeSpeaker(),
        event_queue=q,
    )

    assert orchestrator.start_listen_once() is True

    events = _drain_events(q)

    assert events[-1][0] == VoiceEventType.UNAVAILABLE
    assert events[-1][1] == "Thieu sherpa runtime"


def test_voice_orchestrator_reports_no_speech():
    q: queue.Queue = queue.Queue()
    orchestrator = VoiceOrchestrator(
        _FakePackages(control_ready=True),
        audio_input=_FakeAudioInput(error=NoSpeechDetectedError("Khong nghe ro")),
        speech_to_text=_FakeSpeechToText(),
        speaker=_FakeSpeaker(),
        event_queue=q,
    )

    assert orchestrator.start_listen_once() is True

    events = _drain_events(q)

    assert events[-1][0] == VoiceEventType.ERROR
    assert events[-1][1] == "Khong nghe ro"


def test_voice_orchestrator_speaks_only_supported_short_results():
    speaker = _FakeSpeaker()
    orchestrator = VoiceOrchestrator(
        _FakePackages(control_ready=True),
        audio_input=_FakeAudioInput(),
        speech_to_text=_FakeSpeechToText(),
        speaker=speaker,
        event_queue=queue.Queue(),
    )

    ok = ActionResult.ok("Da mo notepad.")
    clarify = ActionResult.need_clarify("Ban muon tao reminder luc nao?", "Ban muon tao reminder luc nao?")
    choice = ActionResult.need_choice("Chon so di.", ["1", "2"])

    assert orchestrator.speak_for_result(ok) is True
    assert orchestrator.speak_for_result(clarify) is True
    assert orchestrator.speak_for_result(choice) is False
    assert speaker.spoken == ["Da mo notepad.", "Ban muon tao reminder luc nao?"]


def test_voice_smoke_command_samples_are_forwarded_as_transcripts():
    samples = [
        "check mail",
        "xem email hom nay",
        "tao reminder",
        "mo notepad",
    ]

    for sample in samples:
        q: queue.Queue = queue.Queue()
        orchestrator = VoiceOrchestrator(
            _FakePackages(control_ready=True),
            audio_input=_FakeAudioInput(),
            speech_to_text=_FakeSpeechToText(sample),
            speaker=_FakeSpeaker(),
            event_queue=q,
        )

        assert orchestrator.start_listen_once() is True
        events = _drain_events(q)

        assert events[4][0] == VoiceEventType.TRANSCRIPT
        assert events[4][2] == sample
