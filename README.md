# AT Ecosystem

AT Ecosystem is a unified workspace for ATAssistant and the public web apps built around the August Trung product ecosystem.

The long-term goal is simple: ATAssistant acts as the core assistant and automation layer, while each web app exposes useful tools, experiences, and future actions that can be controlled consistently from one ecosystem.

## What This Includes

- `ATAssistant`: a desktop assistant core for automation, file workflows, search, device control, and future cross-device coordination.
- Public web apps: hosted tools and experiences under `augusttrung.com` subdomains.
- Shared packages: reserved space for common protocol, hotkey/action registration, and assistant integration code.
- Deployment notes: infrastructure and release documentation for the ecosystem.

## Hosted Apps

| App | Public domain | Purpose |
| --- | --- | --- |
| Arcade | [arcade.augusttrung.com](https://arcade.augusttrung.com) | Browser arcade and casual game collection. |
| ATomorrow | [atomorrow.augusttrung.com](https://atomorrow.augusttrung.com) | Tomorrow-focused web experience. |
| AugustDown | [augustdown.augusttrung.com](https://augustdown.augusttrung.com) | Download-focused utility app. |
| GameHub | [gamehub.augusttrung.com](https://gamehub.augusttrung.com) | Web game hub with multiple playable games. |
| Happy Birthday | [happybirthday.augusttrung.com](https://happybirthday.augusttrung.com) | Personal celebration web page. |
| Love | [love.augusttrung.com](https://love.augusttrung.com) | Personal relationship web page. |
| Lovebook | [lovebook.augusttrung.com](https://lovebook.augusttrung.com) | Interactive memory/book experience. |
| MMO Tools | [mmo.augusttrung.com](https://mmo.augusttrung.com) | Utility toolkit for content, SEO, formatting, IDs, QR, mail, and productivity workflows. |
| Night | [night.augusttrung.com](https://night.augusttrung.com) | Pixel chat and lightweight social/game experience. |
| Personal Hub | [personalhub.augusttrung.com](https://personalhub.augusttrung.com) | Personal dashboard, file/link hub, and API-backed productivity system. |
| SwiftScan | [scan.augusttrung.com](https://scan.augusttrung.com) | Scanning-focused web utility. |
| Space Navigator | [spacenavigator.augusttrung.com](https://spacenavigator.augusttrung.com) | Browser space navigation game/experience. |
| Speedtest | [speedtest.augusttrung.com](https://speedtest.augusttrung.com) | Speed/location utility experience. |
| TempMail | [tempmail.augusttrung.com](https://tempmail.augusttrung.com) | Temporary email utility. |
| Tokdown | [tokdown.augusttrung.com](https://tokdown.augusttrung.com) | TikTok download utility. |

## Repository Layout

```text
AT-Ecosystem/
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

This is a real monorepo. App folders under `apps/` are normal source directories managed by the root repository.

## Development Setup

Clone the repository:

```powershell
git clone https://github.com/August-Trung/AT-Ecosystem.git at-ecosystem
cd at-ecosystem
```

Most web apps are independent Vite/Node apps:

```powershell
cd apps/mmo-web
npm ci
npm run dev
```

Build a web app:

```powershell
npm run build
```

Some apps have nested project folders:

```powershell
cd apps/gamehub-web/webgame_ui
npm ci
npm run dev
```

```powershell
cd apps/personalhub-web/my-personal-hub
npm ci
npm run dev
```

The Personal Hub API is a .NET project:

```powershell
cd apps/personalhub-web/my-personal-hub-api
dotnet restore
dotnet run
```

## ATAssistant

ATAssistant is the ecosystem core. It is designed to become the shared assistant layer for:

- Desktop automation and system commands.
- File and productivity workflows.
- Search and information retrieval.
- Voice, GUI, and assistant interactions.
- Future cross-device handoff and web app control.

Setup:

```powershell
cd apps/at-assistant
py -3.11 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Run:

```powershell
.\run.ps1
```

Build the Windows executable:

```powershell
python -m PyInstaller --clean -y ATAssistant.spec
```

Executable builds are generated under `dist/` and are not committed to the repository. Public binary releases should be published through GitHub Releases or another release channel.

## Shared Packages

The `packages/` directory is reserved for code that should be shared across the ecosystem:

- `at-core`: assistant orchestration and reusable core logic.
- `at-hotkey-sdk`: future web action and hotkey registration layer.
- `at-protocol`: command/message schemas shared by ATAssistant, devices, and web adapters.

These packages are intentionally minimal today and will grow as the ecosystem integration becomes more formal.

## Security And Privacy

Do not commit secrets, tokens, local account data, generated sessions, or personal runtime files.

Ignored by default:

- `.env` and local environment variants.
- `.venv`, `node_modules`, and other dependency folders.
- `dist`, `build`, `.next`, `.output`, and other generated build output.
- Logs, caches, test output, and machine-specific editor files.

Some assistant model files are currently committed because they are required by the desktop app. Future large model and media assets may move to Git LFS or release assets as the project grows.

## Roadmap

- Consolidate repeated frontend patterns into shared packages.
- Define a stable AT command protocol.
- Add a hotkey/action SDK for web apps.
- Let ATAssistant discover and trigger web app actions consistently.
- Improve release automation for web deployments and desktop builds.
- Add public documentation for end users and contributor documentation for developers.

See [docs/integration-roadmap.md](docs/integration-roadmap.md) for the first ATAssistant-to-web action registry slice.

## Project Status

AT Ecosystem is under active development. Several apps are already hosted publicly, while the assistant integration layer and shared packages are still evolving.

## License

No public license has been declared yet. Until a license is added, all rights are reserved by the project owner.
