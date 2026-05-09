from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

from src.core import executor
from src.core.app_paths import ensure_app_data_dir
from src.core.result import ActionResult, ErrorCode
from src.integrations.mmo_native import handle_native_mmo_action


MMO_TOOL_ACTIONS: list[dict[str, Any]] = [
    {"id": "mmo.openHashTool", "title": "Open Hash Utilities", "route": "/hash", "aliases": ["hash", "md5", "sha1", "sha256", "sha512"]},
    {"id": "mmo.openTextTools", "title": "Open Text Tools", "route": "/text-tools", "aliases": ["base64", "url encode", "url decode", "hex encode", "hex decode"]},
    {"id": "mmo.openTimestampTool", "title": "Open Timestamp Converter", "route": "/timestamp", "aliases": ["timestamp", "unix time", "epoch"]},
    {"id": "mmo.openIdGenerator", "title": "Open ID Generator", "route": "/id-gen", "aliases": ["id gen", "uuid gen", "ulid", "nanoid"]},
    {"id": "mmo.openPasswordGenerator", "title": "Open Password Generator", "route": "/password", "aliases": ["password", "mat khau"]},
    {"id": "mmo.openRegexTester", "title": "Open Regex Tester", "route": "/regex", "aliases": ["regex", "regexp"]},
    {"id": "mmo.openListExtractor", "title": "Open List Extractor", "route": "/extractor", "aliases": ["extract email", "extract ip", "extract proxy"]},
    {"id": "mmo.openKeyValueFormatter", "title": "Open Key Value Formatter", "route": "/kv-line-format", "aliases": ["key value", "kv line"]},
    {"id": "mmo.openDiffChecker", "title": "Open Diff Checker", "route": "/diff", "aliases": ["diff", "compare text"]},
    {"id": "mmo.openJsonDiff", "title": "Open JSON Diff", "route": "/json-diff", "aliases": ["json diff", "compare json"]},
    {"id": "mmo.openYamlJson", "title": "Open YAML JSON Converter", "route": "/yaml-json", "aliases": ["yaml", "json yaml"]},
    {"id": "mmo.openSqlFormatter", "title": "Open SQL Formatter", "route": "/sql-format", "aliases": ["sql format", "format sql"]},
    {"id": "mmo.openReadability", "title": "Open Readability Analyzer", "route": "/readability", "aliases": ["readability", "word count"]},
    {"id": "mmo.openKeywordExtractor", "title": "Open Keyword Extractor", "route": "/keywords", "aliases": ["keyword", "keywords"]},
    {"id": "mmo.openSimilarityChecker", "title": "Open Similarity Checker", "route": "/similarity", "aliases": ["similarity", "jaccard"]},
    {"id": "mmo.openUuidTool", "title": "Open UUID Validator", "route": "/uuid-check", "aliases": ["uuid check", "validate uuid"]},
    {"id": "mmo.openJwtTool", "title": "Open JWT Tool", "route": "/jwt", "aliases": ["jwt", "decode jwt"]},
    {"id": "mmo.openJsonSchemaValidator", "title": "Open JSON Schema Validator", "route": "/json-schema", "aliases": ["json schema", "schema validate"]},
    {"id": "mmo.openCanonicalBuilder", "title": "Open Canonical Builder", "route": "/canonical", "aliases": ["canonical", "hreflang"]},
    {"id": "mmo.openUrlShortener", "title": "Open URL Shortener", "route": "/shorten", "aliases": ["shorten", "rut gon link"]},
    {"id": "mmo.openVietQR", "title": "Open VietQR Generator", "route": "/vietqr", "aliases": ["vietqr", "bank qr"]},
    {"id": "mmo.openCryptoConverter", "title": "Open Crypto Converter", "route": "/crypto", "aliases": ["eth", "gwei", "wei"]},
    {"id": "mmo.openUserAgentGenerator", "title": "Open User Agent Generator", "route": "/ua-gen", "aliases": ["user agent", "ua gen"]},
    {"id": "mmo.openCronParser", "title": "Open Cron Parser", "route": "/cron", "aliases": ["cron", "crontab"]},
    {"id": "mmo.openTwoFAGenerator", "title": "Open 2FA Generator", "route": "/2fa", "aliases": ["2fa", "totp"]},
]


DEFAULT_MANIFEST: dict[str, Any] = {
    "protocolVersion": "at-actions.v1",
    "appId": "mmo-web",
    "appName": "MMO Tools",
    "origin": "https://mmo.augusttrung.com",
    "actions": [
        {
            "id": "mmo.openHome",
            "title": "Open MMO Tools",
            "route": "/browse",
            "risk": "safe",
            "permissions": ["navigate"],
        },
        {
            "id": "mmo.openQrGenerator",
            "title": "Open QR Generator",
            "route": "/qr-gen",
            "risk": "safe",
            "permissions": ["navigate"],
        },
        {
            "id": "mmo.openTempMail",
            "title": "Open Temp Mail",
            "route": "/temp-mail",
            "risk": "safe",
            "permissions": ["navigate", "network", "user-data"],
        },
        {
            "id": "mmo.openJsonFormatter",
            "title": "Open JSON Formatter",
            "route": "/json-format",
            "risk": "safe",
            "permissions": ["navigate"],
        },
        *[
            {
                **action,
                "risk": "safe",
                "permissions": ["navigate"],
            }
            for action in MMO_TOOL_ACTIONS
        ],
    ],
}


def _monorepo_root() -> Path | None:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "apps").is_dir() and (parent / "packages").is_dir():
            return parent
    return None


def _load_manifest(app_id: str) -> dict[str, Any]:
    if app_id != "mmo-web":
        return {}

    root = _monorepo_root()
    if root:
        manifest_path = root / "apps" / "mmo-web" / "public" / ".well-known" / "at-actions.json"
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            known_actions = list(DEFAULT_MANIFEST.get("actions") or [])
            existing_ids = {str(action.get("id") or "") for action in list(manifest.get("actions") or [])}
            missing = [action for action in known_actions if str(action.get("id") or "") not in existing_ids]
            if missing:
                manifest["actions"] = list(manifest.get("actions") or []) + missing
            return manifest
        except Exception:
            pass

    return dict(DEFAULT_MANIFEST)


def _base_url(app_id: str, manifest: dict[str, Any]) -> str:
    env_key = f"AT_WEB_{app_id.upper().replace('-', '_')}_URL"
    configured = os.environ.get(env_key) or os.environ.get("AT_MMO_WEB_URL")
    if configured:
        return configured.rstrip("/")
    return str(manifest.get("origin") or DEFAULT_MANIFEST["origin"]).rstrip("/")


def _action_by_id(manifest: dict[str, Any], action_id: str) -> dict[str, Any] | None:
    for action in list(manifest.get("actions") or []):
        if str(action.get("id") or "") == action_id:
            return dict(action)
    return None


def _build_invocation_url(
    base_url: str,
    route: str,
    action_id: str,
    args: dict[str, Any],
) -> str:
    safe_route = route.strip() or "/"
    if not safe_route.startswith("/"):
        safe_route = "/" + safe_route
    payload = quote(json.dumps(args or {}, ensure_ascii=False, separators=(",", ":")), safe="")
    request_id = quote(f"ata-{int(time.time() * 1000)}", safe="")
    separator = "&" if "?" in safe_route else "?"
    return (
        f"{base_url}/#{safe_route}{separator}"
        f"atAction={quote(action_id, safe='')}"
        f"&atSource=assistant"
        f"&atRequestId={request_id}"
        f"&atArgs={payload}"
    )


def _prepare_qr_telegram_photo(args: dict[str, Any]) -> str:
    text = str(args.get("text") or "").strip()
    if not text:
        return ""

    try:
        url = (
            "https://api.qrserver.com/v1/create-qr-code/"
            f"?size=512x512&data={quote(text, safe='')}&color=000000&bgcolor=ffffff"
        )
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        content_type = str(response.headers.get("Content-Type") or "").lower()
        if "image" not in content_type and not getattr(response, "content", b"").startswith(b"\x89PNG"):
            return ""
        out_dir = ensure_app_data_dir("telegram")
        path = out_dir / f"mmo_qr_{int(time.time() * 1000)}.png"
        path.write_bytes(response.content)
        return str(path)
    except Exception:
        return ""


def invoke_web_action(
    app_id: str,
    action_id: str,
    args: dict[str, Any] | None = None,
    browser: str = "default",
    delivery: str = "desktop",
) -> ActionResult:
    app_id = (app_id or "").strip()
    action_id = (action_id or "").strip()
    args = dict(args or {})

    manifest = _load_manifest(app_id)
    if not manifest:
        return ActionResult.err(
            f"Web app action manifest not found for {app_id or '(empty)'}.",
            code=ErrorCode.UNKNOWN,
        )

    action = _action_by_id(manifest, action_id)
    if not action:
        return ActionResult.err(
            f"Web action not found: {action_id or '(empty)'}.",
            code=ErrorCode.UNKNOWN,
            app_id=app_id,
        )

    route = str(args.pop("route", "") or action.get("route") or "/")
    url = _build_invocation_url(_base_url(app_id, manifest), route, action_id, args)

    delivery_key = (delivery or "").strip().lower()

    if delivery_key in {"telegram", "mobile"}:
        native = handle_native_mmo_action(action_id, args)
        if native is not None:
            if isinstance(native.data, dict):
                native.data.setdefault("url", url)
            return native
        if delivery_key == "mobile":
            return ActionResult.ok(
                f"Công cụ này cần mở trên máy tính: {action.get('title') or action_id}.",
                app_id=app_id,
                action_id=action_id,
                route=route,
                url=url,
                mobile_buttons=[
                    {
                        "text": "Mở trên máy tính",
                        "url": url,
                    }
                ],
            )
        return ActionResult.ok(
            f"Tool này chưa có native Telegram handler. Bấm nút để mở {action.get('title') or action_id}.",
            app_id=app_id,
            action_id=action_id,
            route=route,
            url=url,
            telegram_url_buttons=[
                {
                    "text": str(action.get("title") or action_id)[:48],
                    "url": url,
                }
            ],
        )

    opened = executor.open_url(url, browser=browser)
    if opened.status.value != "success":
        return opened

    telegram_photo_path = ""
    if action_id == "mmo.openQrGenerator":
        telegram_photo_path = _prepare_qr_telegram_photo(args)

    return ActionResult.ok(
        f"Dispatched {action.get('title') or action_id} to {manifest.get('appName') or app_id}.",
        app_id=app_id,
        action_id=action_id,
        route=route,
        url=url,
        args=args,
        telegram_photo_path=telegram_photo_path,
        telegram_url_buttons=[
            {
                "text": str(action.get("title") or action_id)[:48],
                "url": url,
            }
        ],
    )
