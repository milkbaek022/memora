import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AppConfig } from "../config.js";
import type { AppDatabase } from "./database.js";
import { createDatabase } from "./database.js";

export async function createAppDatabase(config: AppConfig): Promise<AppDatabase> {
  if (config.databaseUrl.trim().length > 0) {
    const { createPostgresDatabase } = await import("./postgresDatabase.js");
    return createPostgresDatabase(config.databaseUrl);
  }

  mkdirSync(dirname(config.databasePath), { recursive: true });
  return createDatabase(config.databasePath);
}
