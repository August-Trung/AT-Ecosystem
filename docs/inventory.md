# AT Ecosystem Inventory

| App | Domain | Original source | Notes |
| --- | --- | --- | --- |
| `at-assistant` | core | `D:\Study\Projects\Python project\ATAssistant` | Python app, synced after commit `e2310a6`. Reinstall from `requirements.txt`. |
| `arcade-web` | `arcade.augusttrung.com` | `D:\Study\Projects\augusttrung-arcade` | Node app, reinstall from `package-lock.json`. |
| `atomorrow-web` | `atomorrow.augusttrung.com` | `D:\Study\Projects\another-tomorrow` | Node app, reinstall from `package-lock.json`. |
| `augustdown-web` | `augustdown.augusttrung.com` | `D:\Study\Projects\augustdown-pro` | Node app, reinstall from `package-lock.json`. |
| `gamehub-web` | `gamehub.augusttrung.com` | `D:\Study\Projects\gamewebsite` | App manifest is under `webgame_ui`. |
| `happybirthday-web` | `happybirthday.augusttrung.com` | `D:\Study\HTML\happy-birthday-main` | Static/no root package manifest detected. |
| `love-web` | `love.augusttrung.com` | `D:\Study\Projects\my-love-page` | Node app, reinstall from `package-lock.json`. |
| `lovebook-web` | `lovebook.augusttrung.com` | `D:\Study\Projects\lovebook` | Node app, both `package-lock.json` and `yarn.lock` detected; choose one package manager before reinstalling. |
| `mmo-web` | `mmo.augusttrung.com` | `D:\Study\Projects\at-tools` | Node app, reinstall from `package-lock.json`. |
| `night-web` | `night.augusttrung.com` | `D:\Study\Projects\midnight-pixel-chat (4)` | Node app, reinstall from `package-lock.json`. |
| `personalhub-web` | `personalhub.augusttrung.com` | `D:\Study\Projects\Vue\personal-hub` | App manifests are inside nested frontend/API folders. |
| `swiftscan-web` | `scan.augusttrung.com` | `D:\Study\Projects\swiftscan-web` | Node app, reinstall from `package-lock.json`. |
| `spacenavigator-web` | `spacenavigator.augusttrung.com` | `D:\Study\Projects\test\spacenavigator` | Node app, reinstall from `package-lock.json`. |
| `speedtest-web` | `speedtest.augusttrung.com` | `D:\Study\Projects\mapme---auto-location-finder` | Node app, reinstall from `package-lock.json`. |
| `tempmail-web` | `tempmail.augusttrung.com` | `D:\Study\Projects\tempmail` | Node app, reinstall from `package-lock.json`. |
| `tokdown-web` | `tokdown.augusttrung.com` | `D:\Study\Projects\tokdownloader-pro` | Node app, reinstall from `package-lock.json`. |

## Dependency Reinstall

For `at-assistant`:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-assistant"
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

For Node apps with `package-lock.json`:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\<app-name>"
npm ci
```

For `lovebook-web`, decide whether the project should use npm or yarn, then keep only the matching lockfile long term.
