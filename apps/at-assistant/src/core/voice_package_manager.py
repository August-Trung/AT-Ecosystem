from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable

from src.core.app_paths import ensure_app_data_dir

try:
    from vietnam_number import n2w, n2w_single
except Exception:
    n2w = None
    n2w_single = None

try:
    import winsound
except Exception:
    winsound = None


OFFLINE_VOICE_DIR = "offline_voice"
STATE_FILE_NAME = "voice_package_state.json"

VOICE_RELEASE_BASE_URL = "https://github.com/August-Trung/atassistant-voice-packages/releases/download/voice-v1"
TTS_PACKAGE_URL = f"{VOICE_RELEASE_BASE_URL}/atassistant-tts-vi-v1.zip"
CONTROL_PACKAGE_URL = f"{VOICE_RELEASE_BASE_URL}/atassistant-stt-zipformer-vi-v1.zip"
TTS_PACKAGE_URL_ENV = "ATASSISTANT_TTS_PACKAGE_URL"
CONTROL_PACKAGE_URL_ENV = "ATASSISTANT_CONTROL_PACKAGE_URL"
TTS_MODEL_DIR_NAME = "custom_tts"
TTS_MODEL_FILES = (
    "female_voice_v1.onnx",
    "female_voice_v1.onnx.json",
    "non-vietnamese-words.csv",
)
SHERPA_ONNX_REPO_URL = "https://github.com/k2-fsa/sherpa-onnx"
ZIPFORMER_MODEL_NAME = "Zipformer-30M-RNNT-6000h"
ZIPFORMER_MODEL_FILES = (
    "encoder-epoch-20-avg-10.onnx",
    "decoder-epoch-20-avg-10.onnx",
    "joiner-epoch-20-avg-10.onnx",
    "tokens.txt",
)
ZIPFORMER_DEVICE = "cpu"

PACKAGE_SPEECH = "speech"
PACKAGE_CONTROL = "control"

DEFAULT_STATE = {
    "schema_version": 2,
    "onboarding": {
        "seen": False,
        "last_action": "",
        "last_prompted_at": "",
    },
    "packages": {
        PACKAGE_SPEECH: {
            "last_installed_at": "",
            "last_error": "",
        },
        PACKAGE_CONTROL: {
            "last_installed_at": "",
            "last_error": "",
        },
    },
}


@dataclass(frozen=True)
class VoicePackageStatus:
    package_id: str
    title: str
    summary: str
    ready: bool
    installed_path: str
    detail: str
    source_name: str
    source_url: str


@dataclass(frozen=True)
class VoiceEnvironmentStatus:
    speech: VoicePackageStatus
    control: VoicePackageStatus
    first_run: bool
    onboarding_seen: bool

    @property
    def speech_ready(self) -> bool:
        return self.speech.ready

    @property
    def control_ready(self) -> bool:
        return self.control.ready

    @property
    def missing_any(self) -> bool:
        return not self.speech_ready or not self.control_ready

    @property
    def missing_all(self) -> bool:
        return not self.speech_ready and not self.control_ready


@dataclass(frozen=True)
class InstallProgress:
    stage: str
    message: str
    fraction: float = 0.0
    package_id: str = ""


ProgressCallback = Callable[[InstallProgress], None]
DoneCallback = Callable[[bool, VoiceEnvironmentStatus, str], None]


class VoicePackageManager:
    def __init__(self) -> None:
        self._root_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR)
        self._downloads_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR, "downloads")
        self._runtime_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR, "piper_runtime")
        self._voices_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR, "voices")
        self._models_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR, "models")
        self._temp_dir = ensure_app_data_dir(OFFLINE_VOICE_DIR, "temp")
        self._state_path = self._root_dir / STATE_FILE_NAME
        self._playback_lock = threading.Lock()
        self._install_lock = threading.Lock()
        self._abort_playback = threading.Event()
        self._is_speaking = False

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    @property
    def state_path(self) -> Path:
        return self._state_path

    def refresh_status(self) -> VoiceEnvironmentStatus:
        state = self._load_state()
        speech = self._detect_speech_package()
        control = self._detect_control_package()
        first_run = not state["onboarding"]["seen"]
        return VoiceEnvironmentStatus(
            speech=speech,
            control=control,
            first_run=first_run,
            onboarding_seen=bool(state["onboarding"]["seen"]),
        )

    def should_prompt_on_start(self, status: VoiceEnvironmentStatus | None = None) -> bool:
        current = status or self.refresh_status()
        return current.first_run and current.missing_any

    def mark_onboarding_seen(self, action: str) -> None:
        state = self._load_state()
        state["onboarding"]["seen"] = True
        state["onboarding"]["last_action"] = action
        state["onboarding"]["last_prompted_at"] = self._now_iso()
        self._save_state(state)

    def mark_prompt_shown(self) -> None:
        state = self._load_state()
        state["onboarding"]["last_prompted_at"] = self._now_iso()
        self._save_state(state)

    def install_packages_async(
        self,
        package_ids: Iterable[str],
        *,
        on_progress: ProgressCallback | None = None,
        on_done: DoneCallback | None = None,
    ) -> bool:
        packages = [item for item in dict.fromkeys(package_ids) if item in {PACKAGE_SPEECH, PACKAGE_CONTROL}]
        if not packages:
            if on_done:
                on_done(False, self.refresh_status(), "Không có gói nào để cài.")
            return False

        if not self._install_lock.acquire(blocking=False):
            if on_done:
                on_done(False, self.refresh_status(), "Đang có một tác vụ cài đặt khác chạy.")
            return False

        def worker() -> None:
            success = True
            message = "Đã cài xong gói giọng nói offline."
            try:
                for package_id in packages:
                    if package_id == PACKAGE_SPEECH:
                        self._install_speech_package(on_progress)
                    elif package_id == PACKAGE_CONTROL:
                        self._install_control_package(on_progress)
            except Exception as exc:
                success = False
                message = f"Cài gói giọng nói offline chưa thành công: {exc}"
                for package_id in packages:
                    self._write_package_state(package_id, str(exc))
            finally:
                status = self.refresh_status()
                self._install_lock.release()
                if on_done:
                    on_done(success, status, message)

        threading.Thread(target=worker, daemon=True).start()
        return True

    @property
    def is_speaking(self) -> bool:
        return self._is_speaking

    def stop_speaking(self) -> None:
        """Interrupt any ongoing TTS playback immediately."""
        self._abort_playback.set()
        try:
            import sounddevice as sd
            sd.stop()
        except Exception:
            pass

    def warm_up_speaker_async(self) -> bool:
        """Load the Piper voice model in the background before the first prompt."""
        status = self.refresh_status()
        if not status.speech_ready:
            return False

        def worker() -> None:
            try:
                model_dir = self.get_tts_model_dir()
                if model_dir is None:
                    return
                with self._playback_lock:
                    self._prepare_tts_resources_locked(model_dir)
            except Exception:
                pass

        threading.Thread(target=worker, daemon=True).start()
        return True

    def speak_async(
        self,
        text: str,
        *,
        on_error: Callable[[str], None] | None = None,
        on_start: Callable[[], None] | None = None,
        on_done: Callable[[], None] | None = None,
    ) -> bool:
        text = (text or "").strip()
        if not text:
            return False
        status = self.refresh_status()
        if not status.speech_ready:
            return False

        def worker() -> None:
            self._abort_playback.clear()
            self._is_speaking = True
            if on_start:
                try:
                    on_start()
                except Exception:
                    pass
            try:
                self._speak_sync(text)
            except Exception as exc:
                if on_error:
                    on_error(str(exc))
            finally:
                self._is_speaking = False
                if on_done:
                    try:
                        on_done()
                    except Exception:
                        pass

        threading.Thread(target=worker, daemon=True).start()
        return True

    def get_stt_model_path(self) -> Path | None:
        model_dir = self._sherpa_model_dir()
        if self._is_valid_sherpa_model(model_dir):
            return model_dir
        return None

    def get_tts_model_dir(self) -> Path | None:
        model_dir = self._tts_model_dir()
        if self._is_valid_tts_model(model_dir):
            return model_dir
        return None

    def has_tts_runtime(self) -> bool:
        try:
            import piper  # noqa: F401
            import sounddevice  # noqa: F401
        except Exception:
            return False
        return True

    def has_sherpa_runtime(self) -> bool:
        try:
            import sherpa_onnx  # noqa: F401
        except Exception:
            return False
        return True

    def build_voice_input_context(self) -> dict[str, str]:
        model_path = self.get_stt_model_path()
        return {
            "engine": "zipformer-transducer",
            "language": "vi",
            "model_size": ZIPFORMER_MODEL_NAME,
            "model_path": str(model_path) if model_path else "",
            "device": ZIPFORMER_DEVICE,
            "compute_type": "",
        }

    def _detect_speech_package(self) -> VoicePackageStatus:
        model_dir = self._tts_model_dir()
        has_model = self._is_valid_tts_model(model_dir)
        has_runtime = self.has_tts_runtime()
        ready = has_model and has_runtime
        detail = "Sẵn sàng đọc phản hồi và reminder bằng giọng nói offline."
        if not has_model:
            detail = "Chưa cài gói đọc giọng nói offline. Reminder sẽ beep khi chưa có giọng đọc."
        elif not has_runtime:
            detail = "Đã có model TTS nhưng runtime Python cho piper/sounddevice chưa sẵn sàng."

        return VoicePackageStatus(
            package_id=PACKAGE_SPEECH,
            title="Gói đọc giọng nói offline",
            summary="Tải model TTS về LocalAppData để đọc reminder và phản hồi ngắn trên máy.",
            ready=ready,
            installed_path=str(model_dir),
            detail=detail,
            source_name="AT Assistant voice release",
            source_url=self._tts_package_url(),
        )
    
    def _detect_control_package(self) -> VoicePackageStatus:
        model_dir = self._sherpa_model_dir()
        has_model = self._is_valid_sherpa_model(model_dir)
        has_runtime = self.has_sherpa_runtime()
        ready = has_model and has_runtime
        detail = "Sẵn sàng nhận lệnh giọng nói offline bằng Zipformer."
        if not has_model:
            detail = "Chưa cài gói nhận lệnh giọng nói offline. App vẫn dùng text bình thường."
        elif not has_runtime:
            detail = "Đã có model Zipformer nhưng runtime Python cho sherpa-onnx chưa sẵn sàng."
        return VoicePackageStatus(
            package_id=PACKAGE_CONTROL,
            title="Gói nhận lệnh giọng nói offline",
            summary="Tải Zipformer model về LocalAppData để nhận lệnh giọng nói offline cho toàn app.",
            ready=ready,
            installed_path=str(model_dir),
            detail=detail,
            source_name="AT Assistant voice release",
            source_url=self._control_package_url(),
        )

    def _install_speech_package(self, on_progress):
        self._emit_progress(on_progress, "start", "Dang chuan bi goi doc giong noi offline...", 0.1, PACKAGE_SPEECH)
        self._install_zip_package(
            url=self._tts_package_url(),
            zip_name="atassistant-tts-vi-v1.zip",
            target_root=self._tts_model_dir(),
            required_files=TTS_MODEL_FILES,
            package_id=PACKAGE_SPEECH,
            on_progress=on_progress,
            download_message="Dang tai goi doc giong noi offline...",
            finalize_message="Dang hoan tat goi doc giong noi offline...",
        )
        self._write_package_state(PACKAGE_SPEECH, "")
        self._emit_progress(on_progress, "done", "Da cai xong goi doc giong noi offline.", 1.0, PACKAGE_SPEECH)

    def _install_control_package(self, on_progress: ProgressCallback | None) -> None:
        self._emit_progress(on_progress, "start", "Dang chuan bi goi nhan lenh giong noi offline...", package_id=PACKAGE_CONTROL)
        self._cleanup_legacy_control_artifacts()
        self._install_zip_package(
            url=self._control_package_url(),
            zip_name="atassistant-stt-zipformer-vi-v1.zip",
            target_root=self._sherpa_model_dir(),
            required_files=ZIPFORMER_MODEL_FILES,
            package_id=PACKAGE_CONTROL,
            on_progress=on_progress,
            download_message="Dang tai goi nhan lenh giong noi offline...",
            finalize_message="Dang hoan tat goi nhan lenh giong noi offline...",
        )
        self._write_package_state(PACKAGE_CONTROL, "")
        self._emit_progress(on_progress, "done", "Da cai xong goi nhan lenh giong noi offline.", 1.0, PACKAGE_CONTROL)

    def _install_zip_package(
        self,
        *,
        url: str,
        zip_name: str,
        target_root: Path,
        required_files: tuple[str, ...],
        package_id: str,
        on_progress: ProgressCallback | None,
        download_message: str,
        finalize_message: str,
    ) -> None:
        zip_path = self._downloads_dir / zip_name
        extract_root = self._temp_dir / f"{package_id}_extract"
        self._download_file(
            url,
            zip_path,
            on_progress,
            package_id=package_id,
            message=download_message,
        )
        self._emit_progress(on_progress, "finalize", finalize_message, 0.85, package_id)
        self._extract_zip(zip_path, extract_root, clean_target=True)
        source_root = self._find_package_root(extract_root, required_files)
        if source_root is None:
            raise RuntimeError(f"Goi tai ve khong dung cau truc: {zip_name}")
        if target_root.exists():
            shutil.rmtree(target_root)
        target_root.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_root, target_root)
        shutil.rmtree(extract_root, ignore_errors=True)

    def _find_package_root(self, extract_root: Path, required_files: tuple[str, ...]) -> Path | None:
        candidates = [extract_root]
        candidates.extend(path for path in extract_root.rglob("*") if path.is_dir())
        for candidate in candidates:
            if all((candidate / filename).exists() for filename in required_files):
                return candidate
        return None

    def _download_file(
        self,
        url: str,
        destination: Path,
        on_progress: ProgressCallback | None,
        *,
        package_id: str,
        message: str,
    ) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "ATAssistant/1.0"})
        tmp_path = destination.with_suffix(destination.suffix + ".part")
        with urllib.request.urlopen(request, timeout=90) as response, tmp_path.open("wb") as handle:
            total = int(response.headers.get("Content-Length") or 0)
            downloaded = 0
            while True:
                chunk = response.read(1024 * 128)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded += len(chunk)
                fraction = (downloaded / total) if total else 0.0
                self._emit_progress(on_progress, "download", message, fraction, package_id)
        tmp_path.replace(destination)

    def _extract_zip(self, zip_path: Path, destination: Path, *, clean_target: bool) -> None:
        if clean_target and destination.exists():
            shutil.rmtree(destination)
        destination.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(destination)

    def _prepare_tts_resources_locked(self, model_dir: Path):
        import csv
        import piper

        translit_path = model_dir / "non-vietnamese-words.csv"
        translit_cache_path = getattr(self, "_translit_cache_path", None)
        if translit_cache_path != str(translit_path):
            self._translit_cache_path = str(translit_path)
            self._translit_map = {}
            if translit_path.exists():
                try:
                    with translit_path.open("r", encoding="utf-8") as f:
                        reader = csv.reader(f)
                        next(reader, None)
                        for row in reader:
                            if len(row) >= 2:
                                self._translit_map[row[0].strip().lower()] = row[1].strip().lower()
                except Exception:
                    pass

        model_path = model_dir / "female_voice_v1.onnx"
        cache_path = getattr(self, "_cached_piper_model_path", None)
        if cache_path != str(model_path):
            self._cached_piper_model_path = str(model_path)
            self._cached_piper_model = piper.PiperVoice.load(str(model_path))
        return self._cached_piper_model

    def _apply_tts_transliteration(self, value: str) -> str:
        words = value.split()
        out = []
        translit_map = getattr(self, "_translit_map", {})
        for word in words:
            lowered = word.lower()
            out.append(translit_map.get(lowered, word))

        result = " ".join(out)
        if not any(p in result for p in [".", ",", "!", "?"]):
            result = result.rstrip(".") + "..."
        return result

    def _speak_sync(self, text: str):
        import numpy as np
        import sounddevice as sd

        model_dir = self.get_tts_model_dir()
        if model_dir is None:
            raise FileNotFoundError("G?i ??c gi?ng n?i offline ch?a s?n s?ng.")

        # Serialize the whole synth + playback cycle so concurrent scheduled
        # voices do not interrupt each other.
        with self._playback_lock:
            model = self._prepare_tts_resources_locked(model_dir)
            processed = self._apply_tts_transliteration(self._normalize_tts_text(text))

            chunks = []
            sample_rate = None

            for chunk in model.synthesize(processed):
                if sample_rate is None:
                    sample_rate = chunk.sample_rate
                chunks.append(chunk.audio_int16_array)

            if not chunks:
                return

            samples = np.concatenate(chunks)
            silence = np.zeros(int(sample_rate * 0.1), dtype=np.int16)
            samples = np.concatenate([samples, silence])

            if self._abort_playback.is_set():
                return

            try:
                sd.play(samples, sample_rate)
                sd.wait()
            except Exception as exc:
                if self._abort_playback.is_set():
                    return
                raise RuntimeError(f"Lỗi phát audio TTS: {exc}") from exc

    def _normalize_tts_text(self, text: str) -> str:
        normalized = " ".join((text or "").split())
        if not normalized:
            return ""

        normalized = re.sub(r"https?://\S+", " ", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"www\.\S+", " ", normalized, flags=re.IGNORECASE)
        normalized = " ".join(normalized.split())
        if not normalized:
            return ""

        normalized = re.sub(
            r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b",
            self._replace_date_for_tts,
            normalized,
        )
        normalized = re.sub(
            r"\b(\d{1,2}):(\d{2})\b",
            self._replace_time_for_tts,
            normalized,
        )
        normalized = re.sub(
            r"\b\d+\b",
            self._replace_number_for_tts,
            normalized,
        )
        return normalized

    def _replace_date_for_tts(self, match: re.Match[str]) -> str:
        day, month, year = match.groups()
        return (
            f"ngày {self._spell_number(str(int(day)))} "
            f"tháng {self._spell_number(str(int(month)))} "
            f"năm {self._spell_number(str(int(year)))}"
        )

    def _replace_time_for_tts(self, match: re.Match[str]) -> str:
        hour, minute = match.groups()
        hour_text = self._spell_number(str(int(hour)))
        minute_value = int(minute)
        if minute_value == 0:
            return f"{hour_text} giờ"
        return f"{hour_text} giờ {self._spell_number(str(minute_value))} phút"

    def _replace_number_for_tts(self, match: re.Match[str]) -> str:
        start, end = match.span()
        raw = match.group(0)
        source = match.string
        before = source[start - 1] if start > 0 else ""
        after = source[end] if end < len(source) else ""
        before2 = source[start - 2] if start > 1 else ""
        after2 = source[end + 1] if end + 1 < len(source) else ""
        if before in "/:" or after in "/:":
            return raw
        if before == "." and (before2.isdigit() or before2.isalpha()):
            return raw
        if after == "." and (after2.isdigit() or after2.isalpha()):
            return raw
        return self._spell_number(raw)

    def _spell_number(self, value: str) -> str:
        digits = (value or "").strip()
        if not digits.isdigit():
            return value
        if n2w is None:
            return value

        try:
            if len(digits) >= 8 and n2w_single is not None:
                return n2w_single(digits)
            return n2w(digits)
        except Exception:
            return value

    def _tts_package_url(self) -> str:
        return (os.environ.get(TTS_PACKAGE_URL_ENV) or TTS_PACKAGE_URL).strip()

    def _control_package_url(self) -> str:
        return (os.environ.get(CONTROL_PACKAGE_URL_ENV) or CONTROL_PACKAGE_URL).strip()

    def _tts_model_dir(self) -> Path:
        return self._voices_dir / TTS_MODEL_DIR_NAME

    def _is_valid_tts_model(self, path: Path) -> bool:
        required_paths = [path / filename for filename in TTS_MODEL_FILES]
        return all(item.exists() for item in required_paths)

    def _sherpa_model_dir(self) -> Path:
        return self._models_dir / ZIPFORMER_MODEL_NAME

    def _is_valid_sherpa_model(self, path: Path) -> bool:
        required_paths = [path / filename for filename in ZIPFORMER_MODEL_FILES]
        return all(item.exists() for item in required_paths)

    def _cleanup_legacy_control_artifacts(self) -> None:
        legacy_paths = [
            self._models_dir / "vosk-model-vn",
            self._models_dir / "vosk-model-small-vn-0.4",
            self._downloads_dir / "vosk-model-small-vn-0.4.zip",
            self._models_dir / "whisper-medium",
        ]
        for item in legacy_paths:
            if not item.exists():
                continue
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                try:
                    item.unlink()
                except Exception:
                    pass

    def _emit_progress(
        self,
        callback: ProgressCallback | None,
        stage: str,
        message: str,
        fraction: float = 0.0,
        package_id: str = "",
    ) -> None:
        if callback:
            callback(InstallProgress(stage=stage, message=message, fraction=fraction, package_id=package_id))

    def _write_package_state(self, package_id: str, last_error: str) -> None:
        state = self._load_state()
        package_state = state["packages"].setdefault(package_id, {})
        package_state["last_error"] = last_error
        package_state["last_installed_at"] = self._now_iso() if not last_error else package_state.get("last_installed_at", "")
        self._save_state(state)

    def _load_state(self) -> dict:
        if not self._state_path.exists():
            return json.loads(json.dumps(DEFAULT_STATE))
        with self._state_path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        merged = json.loads(json.dumps(DEFAULT_STATE))
        merged.update({k: v for k, v in data.items() if k not in {"packages", "onboarding"}})
        merged["packages"].update(data.get("packages") or {})
        merged["onboarding"].update(data.get("onboarding") or {})
        return merged

    def _save_state(self, state: dict) -> None:
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        with self._state_path.open("w", encoding="utf-8") as handle:
            json.dump(state, handle, ensure_ascii=False, indent=2)

    def _now_iso(self) -> str:
        return datetime.now().isoformat(timespec="seconds")
