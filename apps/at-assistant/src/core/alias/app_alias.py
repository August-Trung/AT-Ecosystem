from __future__ import annotations

import re

APP_ALIASES = {
    "zalo": ["za lo", "gia lô", "gia lo", "ja lô", "ja lo", "da lô", "da lo", "za lô"],
    "excel": ["exel", "ekxel", "ếc xeo", "ếc xel", "éc xeo", "ec xeo"],
    "notepad": ["nốt pát", "nốt pad"],
    "word": [
        "quợt", "quớt", "quơt", "guột", "guot", "wớt", "wơt", "worde",
    ],
    "vscode": ["v s code", "visual studio code", "vs code"],
    "youtube": ["you tube", "du túp", "du tube"],
}


def normalize_app_name(text: str) -> str:
    normalized = text.lower().strip()

    replacements: list[tuple[str, str]] = []
    for canonical, alts in APP_ALIASES.items():
        replacements.append((canonical, canonical))
        for alt in alts:
            replacements.append((alt, canonical))

    for source, canonical in sorted(replacements, key=lambda item: len(item[0]), reverse=True):
        pattern = rf"(?<!\w){re.escape(source)}(?!\w)"
        normalized = re.sub(pattern, canonical, normalized)

    return " ".join(normalized.split())
