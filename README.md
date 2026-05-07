# AT Ecosystem

Monorepo for ATAssistant and the hosted AT web apps.

From this point forward, source changes for ATAssistant and AT web apps should happen inside this workspace.

## Layout

```text
AT Ecosystem/
  apps/
    at-assistant/
    arcade-web/
    atomorrow-web/
    augustdown-web/
    gamehub-web/
    happybirthday-web/
    love-web/
    lovebook-web/
    mmo-web/
    night-web/
    personalhub-web/
    spacenavigator-web/
    speedtest-web/
    swiftscan-web/
    tempmail-web/
    tokdown-web/
  packages/
    at-core/
    at-hotkey-sdk/
    at-protocol/
  docs/
  infra/
    deploy/
```

## Repository Policy

The original project folders are left untouched and can be kept as backups.

This workspace is intended to be a single git repository at the root. App folders under `apps/` are normal source directories, not nested repositories.

Regenerable or environment-specific folders/files should not be copied manually:

- `.venv`, `venv`, `env`
- `node_modules`
- `dist`, `build`, `.next`, `.nuxt`, `.output`, `out`
- cache/test output folders
- secret `.env` files

Use each app's manifest and lockfile to reinstall dependencies inside its new folder.
