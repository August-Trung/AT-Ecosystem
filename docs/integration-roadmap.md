# ATAssistant Web Integration Roadmap

This roadmap tracks the first integration layer between ATAssistant and public AT web apps.

## MVP Implemented

- `packages/at-protocol` defines `at-actions.v1` manifest and invoke result types.
- `packages/at-hotkey-sdk` lets web apps register actions, expose `window.__AT`, and consume URL-based action invocations.
- `apps/mmo-web` exposes a static manifest at `/.well-known/at-actions.json`.
- `apps/mmo-web` registers pilot actions for opening MMO Tools, QR Generator, Temp Mail, and JSON Formatter.
- ATAssistant has a web action adapter that resolves an action, builds an invocation URL, and opens the web app.
- Telegram delivery can now bypass browser opening for native MMO handlers, including QR, JSON formatter, Temp Mail, hash/text/timestamp/ID/password/regex/extractor, structured data formatters, text analytics, JWT/schema/UUID, canonical/shorten/VietQR, crypto/user-agent/cron/2FA.

## Current Invocation Flow

```text
User command
  -> ATAssistant router
  -> RouteType.WEB_APP_ACTION
  -> src.integrations.web_actions.invoke_web_action
  -> open URL with #/<route>?atAction=...&atArgs=...
  -> mmo-web bootATActions()
  -> at-hotkey-sdk registry invokes the registered handler
```

## Next Steps

1. Add a real browser bridge for active tabs via DevTools/WebSocket or a local assistant bridge so ATAssistant can receive action results from the page.
2. Move action matching from hard-coded router rules into manifest-driven alias matching.
3. Add native Telegram handlers for the remaining network/SEO, template, and file/photo tools listed in `docs/mmo-telegram-inventory.md`.
4. Add confirmation policy based on `risk`, `requiresConfirm`, and `permissions`.
5. Extend the pilot to `swiftscan-web`, `tempmail-web`, `tokdown-web`, and `augustdown-web`.
6. Add monorepo workspace scripts after the app boundaries are stable.
