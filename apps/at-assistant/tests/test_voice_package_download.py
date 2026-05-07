from __future__ import annotations

import zipfile
from pathlib import Path

from src.core import voice_package_manager as voice_module
from src.core.voice_package_manager import (
    CONTROL_PACKAGE_URL_ENV,
    TTS_MODEL_FILES,
    TTS_PACKAGE_URL_ENV,
    ZIPFORMER_MODEL_FILES,
    VoicePackageManager,
)


def _write_zip(path: Path, files: tuple[str, ...], *, nested_root: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as archive:
        for filename in files:
            name = f"{nested_root}/{filename}" if nested_root else filename
            archive.writestr(name, "test")


def test_voice_manager_installs_tts_package_from_url(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    package_zip = tmp_path / "atassistant-tts-vi-v1.zip"
    _write_zip(package_zip, TTS_MODEL_FILES, nested_root="tts")
    monkeypatch.setenv(TTS_PACKAGE_URL_ENV, package_zip.as_uri())

    manager = VoicePackageManager()
    manager._install_speech_package(None)

    model_dir = manager.get_tts_model_dir()
    assert model_dir is not None
    assert model_dir == manager.root_dir / "voices" / "custom_tts"
    assert all((model_dir / filename).exists() for filename in TTS_MODEL_FILES)


def test_voice_manager_installs_control_package_from_url(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    package_zip = tmp_path / "atassistant-stt-zipformer-vi-v1.zip"
    _write_zip(package_zip, ZIPFORMER_MODEL_FILES, nested_root="Zipformer-30M-RNNT-6000h")
    monkeypatch.setenv(CONTROL_PACKAGE_URL_ENV, package_zip.as_uri())

    manager = VoicePackageManager()
    manager._install_control_package(None)

    model_dir = manager.get_stt_model_path()
    assert model_dir is not None
    assert model_dir == manager.root_dir / "models" / voice_module.ZIPFORMER_MODEL_NAME
    assert all((model_dir / filename).exists() for filename in ZIPFORMER_MODEL_FILES)


def test_voice_status_exposes_download_urls(tmp_path, monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.setenv(TTS_PACKAGE_URL_ENV, "https://example.test/tts.zip")
    monkeypatch.setenv(CONTROL_PACKAGE_URL_ENV, "https://example.test/control.zip")

    status = VoicePackageManager().refresh_status()

    assert status.speech.source_url == "https://example.test/tts.zip"
    assert status.control.source_url == "https://example.test/control.zip"
