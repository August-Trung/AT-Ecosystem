# at-hotkey-sdk

Shared hotkey/action registration layer for AT web apps.

## MVP Scope

The SDK lets a web app register actions, expose a browser bridge on `window.__AT`, and consume URL-based invocations from ATAssistant.

```ts
const registry = createATRegistry({
  protocolVersion: "at-actions.v1",
  appId: "mmo-web",
  appName: "MMO Tools",
});

registry
  .registerAction({ id: "mmo.openQrGenerator", title: "Open QR Generator" }, async () => {
    window.location.hash = "/qr-gen";
    return { status: "success", message: "Opened QR Generator." };
  })
  .exposeToWindow();

registry.invokeFromUrl();
```

This first slice intentionally uses URL invocation so it works before a deeper browser DevTools or local socket bridge exists.
