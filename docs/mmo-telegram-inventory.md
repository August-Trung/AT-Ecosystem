# MMO Tools Telegram-Native Inventory

Goal: make ATAssistant serve MMO tools through Telegram first, without opening the web UI unless a tool is not yet portable.

## Implemented Native Handlers

| MMO tool | Telegram behavior |
| --- | --- |
| `qr-gen` | Generates a QR image and sends it back as a Telegram photo. |
| `json-format` | Beautifies/minifies/parses JSON text and returns formatted text. |
| `temp-mail` | Creates/restores a `mail.tm` mailbox, returns address/inbox, and can read message detail by index. |
| `hash`, `text-tools`, `timestamp` | Returns hashes, encode/decode output, and timestamp conversions as Telegram text. |
| `id-gen`, `password`, `regex`, `extractor` | Generates IDs/passwords, runs regex, and extracts email/IP/proxy lists. |
| `kv-line-format`, `diff`, `json-diff`, `yaml-json`, `sql-format` | Formats, converts, or compares structured text/data. |
| `readability`, `keywords`, `similarity` | Returns text analytics directly in Telegram. |
| `uuid-check`, `jwt`, `json-schema` | Validates UUID/JWT/schema data. |
| `canonical`, `shorten`, `vietqr` | Returns canonical tags, shortened links, or a VietQR photo. |
| `crypto`, `ua-gen`, `cron`, `2fa` | Converts ETH/Gwei/Wei, generates user-agents, parses cron, and returns TOTP codes. |

Supported command examples:

```text
/at tao qr https://example.com trong mmo
/at format json {"a":1} trong mmo
/at minify json {"a":1,"b":2} trong mmo
/at mo temp mail
/at tao temp mail moi
/at doc temp mail so 1
/at hash sha256 hello trong mmo
/at base64 encode hello trong mmo
/at regex /\d+/ text abc123 trong mmo
/at json diff {"a":1} ||| {"a":2} trong mmo
/at format sql SELECT * FROM users WHERE id=1 trong mmo
/at 2fa JBSWY3DPEHPK3PXP trong mmo
```

## Good Native Candidates

These can return text, image, or file directly in Telegram with low UI dependency:

| Group | Tools |
| --- | --- |
| Network/SEO | `whois`, `domain`, `http-client`, `api-viewer`, `seo-meta`, `seo-sitemap`, `seo-og`, `redirect-test` |
| Generators/calculators | `fake-identity`, `lorem`, `finance`, `cc-gen` |
| Templates | `outline`, `content`, `education`, `hr`, `legal`, `sales`, `marketing` |

Some candidates need safety controls before Telegram exposure, especially `cc-gen`, `fake-identity`, `http-client`, and any tool that can call arbitrary URLs.

## Needs Files Or Rich UI

These should stay web/app-first until ATAssistant has better file upload/download and preview flows:

| Tool | Reason |
| --- | --- |
| `image-tools`, `design`, `photo` | Needs image upload, preview, and generated file return. |
| `qr-scan` | Needs image input from Telegram document/photo handling. |
| `upload` | Needs file upload providers and upload policy. |
| `notepad` | Needs persistent note UX; Telegram can later become command-only. |
| `global-time` | Can be native, but needs timezone parsing UX to be useful. |

## Porting Order

1. Network/SEO native follow-up: `whois`, `domain`, `redirect-test`, `seo-meta`, `seo-og`, `seo-sitemap`, `http-client`.
2. Template/generator follow-up: `fake-identity`, `lorem`, `finance`, `marketing`, `content`, `education`, `hr`, `legal`, `sales`.
3. File/photo tools after Telegram document/photo handling is formalized.

## Current Delivery Rule

- Desktop/source default: web actions still open the web app URL.
- Telegram source: ATAssistant first tries a native handler and does not open the browser.
- If no native handler exists, Telegram gets a URL button instead of forcing browser control.
- Native Telegram results do not include web-open buttons; they only keep the resolved URL in structured data for logs/debug.
- Temp Mail is intentionally Telegram-native: ATAssistant owns the Telegram mailbox state, while the public web app owns a separate browser `localStorage` mailbox. Do not show a web-open button for Telegram Temp Mail unless a secure shared mailbox bridge is added.
