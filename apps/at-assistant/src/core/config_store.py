from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict

from src.core.app_paths import resource_path


@lru_cache(maxsize=1)
def load_aliases() -> Dict[str, Any]:
    """
    Load configs/aliases.json từ project root.
    Không dùng __init__.py vẫn OK.
    """
    cfg_path = resource_path("configs", "aliases.json")

    if not cfg_path.exists():
        # fallback an toàn nếu user chưa tạo file
        return {"verb_prefixes": [], "app_aliases": {}}

    with cfg_path.open("r", encoding="utf-8") as f:
        return json.load(f)
