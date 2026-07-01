import type { FastifyInstance } from "fastify";
import { createConfiguredAiProvider } from "./ai/configuredProvider";
import { loadConfig } from "./config";
import { createAppDatabase } from "./db/appDatabase";
import { migrateDatabase, seedMainInviteCode } from "./db/schema";
import { buildServer } from "./server";

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
