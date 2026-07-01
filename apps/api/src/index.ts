import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadConfig } from "./config";
import { createConfiguredAiProvider } from "./ai/configuredProvider";
import { createDatabase } from "./db/database";
import { migrateDatabase, seedMainInviteCode } from "./db/schema";
import { buildServer } from "./server";

const config = loadConfig();
mkdirSync(dirname(config.databasePath), { recursive: true });

const db = createDatabase(config.databasePath);
migrateDatabase(db);
seedMainInviteCode(db, config.mainInviteCode);

const app = buildServer({ db, aiProvider: createConfiguredAiProvider(config) });
await app.listen({ port: config.port, host: "0.0.0.0" });
