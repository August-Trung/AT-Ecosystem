import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { pathToFileURL } from "node:url";
import { checkDatabaseHealth, closeDatabase, openDatabase, type AppDatabase } from "./database.js";
import {
  catalogItemExists,
  createConfession,
  deleteSavedArchiveItem,
  getArchiveForUser,
  getCatalog,
  listConfessions,
  markRecentlyPlayed,
  saveArchiveItem
} from "./repositories.js";
import { makePreviewTitle } from "./preview.js";
import { validateAnonymousUserId, validateArchiveItemInput, validateConfessionInput } from "./validation.js";
import { moderateConfession } from "../../src/utils/moderation.js";

export interface ApiAppOptions {
  db?: AppDatabase;
  corsOrigin?: string;
}

export interface ApiServerOptions extends ApiAppOptions {
  port?: number;
  host?: string;
}

const parseCorsOrigins = (origin?: string) => {
  if (!origin) return true;
  return origin.split(",").map((item) => item.trim()).filter(Boolean);
};

export const createApiApp = ({ db = openDatabase(), corsOrigin = process.env.CORS_ORIGIN }: ApiAppOptions = {}) => {
  const app = express();

  app.use(cors({ origin: parseCorsOrigins(corsOrigin) }));
  app.use(express.json({ limit: "80kb" }));

  app.get("/api/health", (_request, response) => {
    const databaseOk = checkDatabaseHealth(db);

    response.status(databaseOk ? 200 : 503).json({
      ok: databaseOk,
      service: "another-tomorrow-api",
      storage: {
        driver: "sqlite",
        ok: databaseOk
      },
      positioning: "emotional entertainment",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/catalog", (_request, response) => {
    response.json(getCatalog(db));
  });

  app.post("/api/confessions", (request, response) => {
    const validation = validateConfessionInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ error: validation.error });
      return;
    }

    const moderation = moderateConfession(validation.value.text);
    if (moderation.status === "crisis") {
      response.status(422).json({
        error: "crisis_content_blocked",
        message: moderation.message,
        flags: moderation.flags
      });
      return;
    }

    const publishStatus = moderation.status === "needs-review" ? "needs_review" : "private";
    const record = createConfession(db, {
      id: crypto.randomUUID(),
      text: moderation.sanitizedText,
      mood: validation.value.mood,
      destination: validation.value.destination,
      station: validation.value.station,
      previewTitle: makePreviewTitle(validation.value.mood),
      moderationStatus: moderation.status,
      moderationFlags: moderation.flags,
      publishStatus,
      createdAt: new Date().toISOString()
    });

    response.status(201).json(record);
  });

  app.get("/api/confessions", (_request, response) => {
    response.json({ confessions: listConfessions(db) });
  });

  app.post("/api/archive/saved", (request, response) => {
    const validation = validateArchiveItemInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ error: validation.error });
      return;
    }

    if (!catalogItemExists(db, validation.value.itemId, validation.value.itemType)) {
      response.status(404).json({ error: "Archive item not found." });
      return;
    }

    response.status(201).json(saveArchiveItem(db, validation.value));
  });

  app.delete("/api/archive/saved", (request, response) => {
    const validation = validateArchiveItemInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ error: validation.error });
      return;
    }

    response.json(deleteSavedArchiveItem(db, validation.value));
  });

  app.post("/api/archive/recently-played", (request, response) => {
    const validation = validateArchiveItemInput(request.body);
    if (!validation.ok) {
      response.status(400).json({ error: validation.error });
      return;
    }

    if (!catalogItemExists(db, validation.value.itemId, validation.value.itemType)) {
      response.status(404).json({ error: "Archive item not found." });
      return;
    }

    response.status(201).json(markRecentlyPlayed(db, validation.value));
  });

  app.get("/api/archive/:anonymousUserId", (request, response) => {
    const validation = validateAnonymousUserId(request.params.anonymousUserId);
    if (!validation.ok) {
      response.status(400).json({ error: validation.error });
      return;
    }

    response.json(getArchiveForUser(db, validation.value));
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: "Invalid JSON body." });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Internal server error." });
  };

  app.use(errorHandler);

  return app;
};

export const startApiServer = ({
  db = openDatabase(),
  port = Number(process.env.PORT ?? 8787),
  host = process.env.HOST ?? "127.0.0.1",
  corsOrigin = process.env.CORS_ORIGIN
}: ApiServerOptions = {}) => {
  const app = createApiApp({ db, corsOrigin });
  const server = app.listen(port, host, () => {
    console.log(`Another Tomorrow API listening on http://${host}:${port}`);
    console.log(`SQLite path: ${process.env.SQLITE_PATH || "data/another-tomorrow.sqlite"}`);
  });

  const shutdown = () => {
    server.close(() => {
      closeDatabase(db);
      process.exit(0);
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { app, server, db };
};

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  startApiServer();
}
