# Another Tomorrow API

Backend API for Another Tomorrow. It uses Express and SQLite through `better-sqlite3`.

## Run

```bash
npm run dev:api
```

Default API URL:

```text
http://127.0.0.1:8787
```

Default SQLite path:

```text
data/another-tomorrow.sqlite
```

Override it on a VPS:

```bash
SQLITE_PATH=/var/lib/another-tomorrow/app.sqlite npm run dev:api
```

For production, build the API first and run the compiled server:

```bash
npm run build:api
NODE_ENV=production HOST=0.0.0.0 PORT=8787 SQLITE_PATH=/var/lib/another-tomorrow/app.sqlite npm run start:api
```

The API applies SQL migrations from `server/migrations`, records them in `schema_migrations`, seeds the catalog from frontend data, enables WAL mode, and exposes `/api/health` for service checks.

## Frontend integration

Create `.env` for the frontend:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787
```

The frontend still works without this value by using local mock/localStorage behavior.

Set `CORS_ORIGIN` to the deployed frontend origin in production. Multiple origins can be comma-separated.
