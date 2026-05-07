from __future__ import annotations

import argparse
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "dist" / "voice-packages"
PACKAGES = {
    "atassistant-tts-vi-v1.zip": PROJECT_ROOT / "voice" / "model" / "tts",
    "atassistant-stt-zipformer-vi-v1.zip": PROJECT_ROOT
    / "assests"
    / "voice_model"
    / "Zipformer-30M-RNNT-6000h",
}


def zip_directory(source_dir: Path, output_path: Path) -> None:
    if not source_dir.exists():
        raise FileNotFoundError(f"Missing voice package source: {source_dir}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(source_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(source_dir))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build AT Assistant voice package zips.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory where voice package zips will be written.",
    )
    args = parser.parse_args()

    for filename, source_dir in PACKAGES.items():
        output_path = args.output_dir / filename
        zip_directory(source_dir, output_path)
        print(output_path)


if __name__ == "__main__":
    main()
