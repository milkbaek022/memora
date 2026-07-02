import type { FastifyInstance } from "fastify";
import { createConfiguredAiProvider } from "./ai/configuredProvider.js";
import { loadConfig } from "./config.js";
import { createAppDatabase } from "./db/appDatabase.js";
import { migrateDatabase, seedMainInviteCode } from "./db/schema.js";
import { buildServer } from "./server.js";

let serverPromise: Promise<FastifyInstance> | undefined;

export async function createConfiguredServer(): Promise<FastifyInstance> {
  if (!serverPromise) {
    serverPromise = (async () => {
      const config = loadConfig();
      const db = await createAppDatabase(config);
      await migrateDatabase(db);
      await seedMainInviteCode(db, config.mainInviteCode);
      return buildServer({ db, aiProvider: createConfiguredAiProvider(config) });
    })();
  }

  return serverPromise;
}
