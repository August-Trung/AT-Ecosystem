import json
import os

import requests

from src.core.env_loader import load_project_env
from src.core.logging_setup import setup_logger


logger = setup_logger()
BATCH_SIZE = 10

SYSTEM_PROMPT = """
Bạn là AI phân tích email thông minh.

Nhiệm vụ:
Tạo tag ngắn gọn mô tả nội dung email.

Quy tắc:
- Trả về JSON object
- key là email_id
- value là array tag

Tag rules:
- mỗi tag 1-3 từ
- tối đa 5 tag
- tiếng Việt
- không trùng lặp
- ưu tiên tag quan trọng trước

Phân tích dựa trên:
- subject
- nội dung email
- người gửi nếu liên quan

Loại tag nên tạo:
- công việc, họp, deadline, dự án
- khuyến mãi, quảng cáo
- hóa đơn, thanh toán
- thông báo hệ thống
- sự kiện, lịch
- cá nhân, liên hệ

Không tạo tag vô nghĩa như:
- email
- nội dung
- thông báo chung

Chỉ trả JSON. Không giải thích.

Ví dụ:
{
 "0": ["công việc", "họp", "6:30pm"],
 "1": ["quảng cáo", "khuyến mãi"],
 "2": ["deadline", "dự án"]
}
"""


class EmailSummarizer:
    @staticmethod
    def _settings() -> tuple[str, str, list[str]]:
        load_project_env()
        base_url = (
            os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
            .strip()
            .rstrip("/")
        )
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        models: list[str] = []
        try:
            raw_models = json.loads(os.getenv("AI_MODELS", "[]"))
            if isinstance(raw_models, list):
                models = [str(item).strip() for item in raw_models if str(item).strip()]
        except Exception as exc:
            logger.warning("EMAIL_AI_MODELS_PARSE_FAILED: %s", exc)

        fallback_model = (
            os.getenv("OPENROUTER_CHAT_MODEL", "").strip()
            or os.getenv("OPENROUTER_MODEL", "").strip()
        )
        if fallback_model and fallback_model not in models:
            models.append(fallback_model)
        return f"{base_url}/chat/completions", api_key, models

    @staticmethod
    def _extract_json_object(raw: str) -> dict:
        text = (raw or "").strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        if "{" in text and "}" in text:
            text = text[text.find("{") : text.rfind("}") + 1]
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}

    @staticmethod
    def _fallback_notes(emails: list) -> list:
        for mail in emails:
            tags = list(mail.get("ai_note") or [])
            if mail.get("is_unread") and "Chưa đọc" not in tags:
                tags.insert(0, "Chưa đọc")
            mail["ai_note"] = tags[:5]
        return emails

    @staticmethod
    def summarize(emails: list):
        if not emails:
            return []

        openrouter_url, api_key, models = EmailSummarizer._settings()
        if not api_key or not openrouter_url or not models:
            logger.warning(
                "EMAIL_AI_DISABLED: api_key=%s url=%s models=%s",
                bool(api_key),
                bool(openrouter_url),
                len(models),
            )
            return EmailSummarizer._fallback_notes(emails)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        for start in range(0, len(emails), BATCH_SIZE):
            batch = emails[start : start + BATCH_SIZE]
            email_blocks = []

            for i, mail in enumerate(batch):
                subject = mail.get("subject", "")
                sender = mail.get("from", "")
                content = mail.get("snippet") or mail.get("body", "")
                content = content[:1000]
                email_blocks.append(
                    f"""
email_id: {i}
Subject: {subject}
From: {sender}
Content: {content}
"""
                )

            user_content = "\n".join(email_blocks)
            result = {}

            for model in models:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 0.2,
                }

                try:
                    response = requests.post(
                        openrouter_url,
                        headers=headers,
                        json=payload,
                        timeout=30,
                    )
                    if response.status_code != 200:
                        logger.warning(
                            "EMAIL_AI_HTTP_FAILED: model=%s status=%s body=%s",
                            model,
                            response.status_code,
                            response.text[:300],
                        )
                        continue

                    content = response.json()["choices"][0]["message"]["content"]
                    result = EmailSummarizer._extract_json_object(content)
                    if result:
                        logger.info(
                            "EMAIL_AI_SUMMARY_OK: model=%s count=%s",
                            model,
                            len(batch),
                        )
                        break
                except Exception as exc:
                    logger.warning("EMAIL_AI_MODEL_FAILED: model=%s err=%s", model, exc)

            if not result:
                logger.warning("EMAIL_AI_EMPTY_RESULT: batch_start=%s", start)

            for i, mail in enumerate(batch):
                tags = result.get(str(i), [])
                if not isinstance(tags, list):
                    tags = []
                tags = [
                    tag.strip().capitalize()
                    for tag in tags
                    if isinstance(tag, str) and tag.strip()
                ]

                if mail.get("is_unread"):
                    tags = [tag for tag in tags if tag.lower() != "chưa đọc"]
                    tags.insert(0, "Chưa đọc")

                mail["ai_note"] = tags[:5]

        return emails
