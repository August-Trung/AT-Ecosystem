# Voice Packages

AT Assistant does not bundle offline voice models inside the one-file exe.
The app downloads these packages on demand and stores them under:

```text
%LOCALAPPDATA%\ATAssistant\offline_voice
```

Default release tag:

```text
voice-v1
```

Required GitHub Release assets:

```text
atassistant-tts-vi-v1.zip
atassistant-stt-zipformer-vi-v1.zip
```

Build the assets locally:

```powershell
.\.venv\Scripts\python.exe tools\build_voice_packages.py
```

The zip files are written to:

```text
dist\voice-packages
```

Upload both zip files to the public voice package repository:

```text
https://github.com/August-Trung/atassistant-voice-packages/releases/tag/voice-v1
```

For development or private mirrors, override the download URLs before launching the app:

```powershell
$env:ATASSISTANT_TTS_PACKAGE_URL = "file:///D:/path/atassistant-tts-vi-v1.zip"
$env:ATASSISTANT_CONTROL_PACKAGE_URL = "file:///D:/path/atassistant-stt-zipformer-vi-v1.zip"
```
