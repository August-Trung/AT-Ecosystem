# Deployment Notes

Another Tomorrow should deploy as two services:

- Static frontend: Vite build output from `dist/`.
- Backend API: Node/Express service from `build/server/src/server.js`.

Keep the product positioning explicit in public copy: emotional entertainment, anonymous stories, and late-night audio. Do not describe the app as therapy, diagnosis, treatment, crisis support, or medical care.

## Release checks

Run these before every deploy:

```bash
npm ci
npm test
npm run build
```

`npm run build` creates both deployable outputs:

- `dist/` - upload this to the frontend host.
- `build/server/src/server.js` - run this on the backend host.

## Static frontend

Set the API URL at build time because Vite replaces `VITE_*` variables during the production build.

```bash
VITE_API_BASE_URL=https://api.your-domain.example npm run build
```

Upload the contents of `dist/` to the static host. The app uses hash routes such as `/#tonight`, so a normal static file host works without SPA rewrite rules.

Recommended frontend host options:

- Existing cPanel/static host.
- Netlify, Vercel, Cloudflare Pages, or Render Static Site.
- VPS served by Nginx/Caddy if you want one machine for everything.

## Backend API

Required production environment:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
SQLITE_PATH=/var/lib/another-tomorrow/app.sqlite
CORS_ORIGIN=https://your-frontend-domain.example
```

Build and start:

```bash
npm ci
npm run build:api
npm run start:api
```

The API exposes:

- `GET /api/health` for health checks.
- `GET /api/catalog` for seeded catalog data.
- `POST /api/confessions` for moderated anonymous drafts.
- `POST /api/archive/saved`, `DELETE /api/archive/saved`, and `POST /api/archive/recently-played` for archive sync.

SQLite production notes:

- Put `SQLITE_PATH` under a persistent directory, not the app source tree unless that directory is backed by durable storage.
- Back up the SQLite file regularly.
- Keep a single writer process for this MVP. Do not horizontally scale this backend while it uses one SQLite file.
- WAL mode, foreign keys, migration tracking, and a 5s busy timeout are enabled by the app.

## Render Web Service

Use Render Web Service for the API, not Static Site.

Suggested settings:

```text
Build Command: npm ci && npm run build:api
Start Command: npm run start:api
Health Check Path: /api/health
```

Environment:

```text
NODE_ENV=production
HOST=0.0.0.0
SQLITE_PATH=/var/data/another-tomorrow.sqlite
CORS_ORIGIN=https://your-frontend-domain.example
```

Attach a persistent disk and mount it at `/var/data`. Render's filesystem outside the disk is ephemeral across deploys/restarts, and disks are intended for a single attached service instance.

## VPS

Recommended VPS layout:

```text
/srv/another-tomorrow/current      app checkout
/var/lib/another-tomorrow          SQLite database
/var/backups/another-tomorrow      SQLite backups
```

Example API boot commands:

```bash
cd /srv/another-tomorrow/current
npm ci
npm run build:api
NODE_ENV=production HOST=0.0.0.0 PORT=8787 SQLITE_PATH=/var/lib/another-tomorrow/app.sqlite CORS_ORIGIN=https://your-frontend-domain.example npm run start:api
```

Serve the frontend with Nginx/Caddy from `dist/`. Either expose the API on `api.your-domain.example` or proxy `/api` to `127.0.0.1:8787`.

Minimum backup command when `sqlite3` is installed:

```bash
sqlite3 /var/lib/another-tomorrow/app.sqlite ".backup '/var/backups/another-tomorrow/another-tomorrow-$(date +%F).sqlite'"
```

## Operational References

- [Vite env variables and modes](https://vite.dev/guide/env-and-mode/)
- [Render persistent disks](https://render.com/docs/disks)
- [Render web services](https://render.com/docs/web-services)
