import fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDatabase, openDatabase, type AppDatabase } from "../../server/src/database";
import { createApiApp } from "../../server/src/server";
import type { PrivateConfession } from "../types";
import { createApiClient } from "./api";

describe("frontend API client against the backend", () => {
  let db: AppDatabase;
  let server: Server;
  let baseUrl: string;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "another-tomorrow-e2e-"));
    db = openDatabase(path.join(tempDir, "test.sqlite"));
    server = createServer(createApiApp({ db, corsOrigin: "http://127.0.0.1:5173" }));

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    closeDatabase(db);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("submits a confession and syncs archive activity", async () => {
    const client = createApiClient({ baseUrl, storage: window.localStorage });
    const confession: PrivateConfession = {
      id: "local-confession-1",
      text: "I stayed awake listening to rain because the city felt kinder than my room tonight.",
      mood: "I can't sleep",
      destination: "Keep private",
      station: "rain-city",
      previewTitle: "Awake With The Lights Off",
      createdAt: new Date().toISOString(),
      moderationFlags: []
    };

    const remote = await client.submitConfession(confession);
    expect(remote?.id).toEqual(expect.any(String));
    expect(remote?.publishStatus).toBe("private");

    await client.saveArchiveItem("voice-001", "episode");
    await client.markRecentlyPlayed("voice-001", "episode");

    const archiveResponse = await fetch(`${baseUrl}/api/archive/${client.getAnonymousUserId()}`);
    const archive = await archiveResponse.json();

    expect(archive.saved).toEqual([
      expect.objectContaining({ id: "voice-001", type: "episode" })
    ]);
    expect(archive.recentlyPlayed).toEqual([
      expect.objectContaining({ id: "voice-001", type: "episode" })
    ]);

    await client.removeSavedArchiveItem("voice-001", "episode");

    const updatedArchiveResponse = await fetch(`${baseUrl}/api/archive/${client.getAnonymousUserId()}`);
    const updatedArchive = await updatedArchiveResponse.json();

    expect(updatedArchive.saved).toEqual([]);
    expect(updatedArchive.recentlyPlayed).toHaveLength(1);
  });

  it("rejects crisis content instead of creating entertainment output", async () => {
    const response = await fetch(`${baseUrl}/api/confessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "I want to die tonight and I need someone to turn it into a story.",
        mood: "I feel empty",
        destination: "Turn into a story",
        station: "empty-room"
      })
    });

    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error).toBe("crisis_content_blocked");
  });
});
