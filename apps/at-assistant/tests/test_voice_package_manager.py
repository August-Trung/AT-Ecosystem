from __future__ import annotations

from pathlib import Path
import sys
import threading
import time
import types
import zipfile

from src.core.voice_package_manager import (
    CONTROL_PACKAGE_URL_ENV,
    TTS_PACKAGE_URL_ENV,
    VoicePackageManager,
)


def _build_manager(tmp_path, monkeypatch) -> VoicePackageManager:
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    return VoicePackageManager()


def _create_tts_model(model_dir: Path) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "female_voice_v1.onnx").write_text("fake-model", encoding="utf-8")
    (model_dir / "female_voice_v1.onnx.json").write_text("{}", encoding="utf-8")
    (model_dir / "non-vietnamese-words.csv").write_text("src,dst\nhello,he lo\n", encoding="utf-8")


def _create_zipformer_model(model_dir: Path) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    for filename in (
        "encoder-epoch-20-avg-10.onnx",
        "decoder-epoch-20-avg-10.onnx",
        "joiner-epoch-20-avg-10.onnx",
        "tokens.txt",
    ):
        (model_dir / filename).write_text("fake", encoding="utf-8")


def _zip_dir(source_dir: Path, zip_path: Path, *, nested_root: str = "") -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w") as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                relative = path.relative_to(source_dir)
                archive_name = Path(nested_root) / relative if nested_root else relative
                archive.write(path, archive_name.as_posix())


def test_voice_status_missing_packages_on_first_run(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(manager, "has_tts_runtime", lambda: True)
    monkeypatch.setattr(manager, "has_sherpa_runtime", lambda: True)

    status = manager.refresh_status()

    assert status.first_run is True
    assert status.speech_ready is False
    assert status.control_ready is False
    assert manager.should_prompt_on_start(status) is True


def test_voice_status_detects_installed_packages(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(manager, "has_tts_runtime", lambda: True)
    monkeypatch.setattr(manager, "has_sherpa_runtime", lambda: True)

    _create_tts_model(manager.root_dir / "voices" / "custom_tts")
    zipformer_dir = manager.root_dir / "models" / "Zipformer-30M-RNNT-6000h"
    _create_zipformer_model(zipformer_dir)

    manager.mark_onboarding_seen("installed")
    status = manager.refresh_status()

    assert status.first_run is False
    assert status.speech_ready is True
    assert status.control_ready is True
    assert manager.should_prompt_on_start(status) is False


def test_voice_status_detects_missing_sherpa_runtime_even_when_model_exists(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(manager, "has_tts_runtime", lambda: True)
    monkeypatch.setattr(manager, "has_sherpa_runtime", lambda: False)

    zipformer_dir = manager.root_dir / "models" / "Zipformer-30M-RNNT-6000h"
    _create_zipformer_model(zipformer_dir)

    status = manager.refresh_status()

    assert status.control_ready is False
    assert "sherpa" in status.control.detail.lower()


def test_build_voice_input_context_uses_zipformer(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    zipformer_dir = manager.root_dir / "models" / "Zipformer-30M-RNNT-6000h"
    _create_zipformer_model(zipformer_dir)

    context = manager.build_voice_input_context()

    assert context["engine"] == "zipformer-transducer"
    assert context["model_size"] == "Zipformer-30M-RNNT-6000h"
    assert context["model_path"] == str(zipformer_dir)
    assert context["compute_type"] == ""


def test_install_speech_package_downloads_tts_model(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)

    package_source = tmp_path / "package" / "tts"
    _create_tts_model(package_source)
    package_zip = tmp_path / "atassistant-tts-vi-v1.zip"
    _zip_dir(package_source, package_zip, nested_root="tts")
    monkeypatch.setenv(TTS_PACKAGE_URL_ENV, package_zip.as_uri())

    manager._install_speech_package(on_progress=None)

    installed_dir = manager.get_tts_model_dir()
    assert installed_dir is not None
    assert installed_dir.name == "custom_tts"
    assert (installed_dir / "female_voice_v1.onnx").exists()


def test_install_control_package_downloads_zipformer_model(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)

    package_source = tmp_path / "package" / "Zipformer-30M-RNNT-6000h"
    _create_zipformer_model(package_source)
    package_zip = tmp_path / "atassistant-stt-zipformer-vi-v1.zip"
    _zip_dir(package_source, package_zip, nested_root="Zipformer-30M-RNNT-6000h")
    monkeypatch.setenv(CONTROL_PACKAGE_URL_ENV, package_zip.as_uri())

    manager._install_control_package(on_progress=None)

    context = manager.build_voice_input_context()
    assert context["engine"] == "zipformer-transducer"
    assert Path(context["model_path"]).name == "Zipformer-30M-RNNT-6000h"


def test_speak_async_returns_false_when_speech_package_missing(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(manager, "has_tts_runtime", lambda: True)

    assert manager.speak_async("Nhac ban: test") is False


def test_speak_async_uses_piper_when_ready(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    _create_tts_model(manager.root_dir / "voices" / "custom_tts")

    played = {"count": 0}

    class FakeChunk:
        def __init__(self, audio):
            self.sample_rate = 22050
            self.audio_int16_array = audio

    class FakeVoice:
        def synthesize(self, text):
            played["text"] = text
            yield FakeChunk(__import__("numpy").array([1, 2, 3], dtype="int16"))

    fake_piper = types.SimpleNamespace(
        PiperVoice=types.SimpleNamespace(load=lambda path: FakeVoice())
    )
    fake_sounddevice = types.SimpleNamespace(
        play=lambda samples, sample_rate: played.update({"count": played["count"] + 1, "sample_rate": sample_rate, "samples": samples}),
        wait=lambda: played.update({"waited": True}),
    )

    monkeypatch.setitem(sys.modules, "piper", fake_piper)
    monkeypatch.setitem(sys.modules, "sounddevice", fake_sounddevice)

    manager._speak_sync("Nhac ban: kiem tra")

    assert played["count"] == 1
    assert played["sample_rate"] == 22050
    assert played["waited"] is True


def test_warm_up_speaker_async_loads_piper_model(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    monkeypatch.setattr(manager, "has_tts_runtime", lambda: True)
    _create_tts_model(manager.root_dir / "voices" / "custom_tts")

    loaded = {"count": 0}

    class FakeVoice:
        pass

    def fake_load(path):
        loaded["count"] += 1
        loaded["path"] = path
        return FakeVoice()

    fake_piper = types.SimpleNamespace(
        PiperVoice=types.SimpleNamespace(load=fake_load)
    )
    monkeypatch.setitem(sys.modules, "piper", fake_piper)

    assert manager.warm_up_speaker_async() is True
    deadline = time.monotonic() + 2
    while loaded["count"] == 0 and time.monotonic() < deadline:
        time.sleep(0.01)

    assert loaded["count"] == 1
    assert loaded["path"].endswith("female_voice_v1.onnx")


def test_speak_sync_serializes_concurrent_playback(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)
    _create_tts_model(manager.root_dir / "voices" / "custom_tts")

    state = {"active": 0, "max_active": 0, "play_count": 0}
    state_lock = threading.Lock()

    class FakeChunk:
        def __init__(self, audio):
            self.sample_rate = 22050
            self.audio_int16_array = audio

    class FakeVoice:
        def synthesize(self, text):
            yield FakeChunk(__import__("numpy").array([1, 2, 3], dtype="int16"))

    fake_piper = types.SimpleNamespace(
        PiperVoice=types.SimpleNamespace(load=lambda path: FakeVoice())
    )

    def fake_play(samples, sample_rate):
        with state_lock:
            state["active"] += 1
            state["max_active"] = max(state["max_active"], state["active"])
            state["play_count"] += 1

    def fake_wait():
        time.sleep(0.05)
        with state_lock:
            state["active"] -= 1

    fake_sounddevice = types.SimpleNamespace(
        play=fake_play,
        wait=fake_wait,
    )

    monkeypatch.setitem(sys.modules, "piper", fake_piper)
    monkeypatch.setitem(sys.modules, "sounddevice", fake_sounddevice)

    t1 = threading.Thread(target=manager._speak_sync, args=("mail voice",))
    t2 = threading.Thread(target=manager._speak_sync, args=("reminder voice",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert state["play_count"] == 2
    assert state["max_active"] == 1


def test_normalize_tts_text_spells_time_date_and_numbers(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)

    normalized = manager._normalize_tts_text("Nhắc test voice vào 14:25 - 12/04/2026, mã 125.")

    assert "mười bốn giờ hai mươi lăm phút" in normalized
    assert "ngày mười hai tháng bốn năm hai nghìn không trăm hai mươi sáu" in normalized
    assert "một trăm hai mươi lăm" in normalized


def test_normalize_tts_text_removes_urls_before_speaking(tmp_path, monkeypatch):
    manager = _build_manager(tmp_path, monkeypatch)

    normalized = manager._normalize_tts_text("Mở https://youtube.com lúc 14:25")

    assert "https://youtube.com" not in normalized
    assert "mười bốn giờ hai mươi lăm phút" in normalized
