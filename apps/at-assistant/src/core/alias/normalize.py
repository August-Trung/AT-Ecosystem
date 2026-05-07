import re
from src.core.alias.app_alias import normalize_app_name

def normalize_text(text: str) -> str:
    text = text.strip()

    text = re.sub(r"[\.!\?,;:]+$", "", text)
    text = normalize_app_name(text)

    return text