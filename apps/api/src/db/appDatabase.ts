import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AppConfig } from "../config";
import type { AppDatabase } from "./database";
import { createDatabase } from "./database";

export async function createAppDatabase(config: AppConfig): Promise<AppDatabase> {
  if (config.databaseUrl.trim().length > 0) {
    const { createPostgresDatabase } = await import("./postgresDatabase");
    return createPostgresDatabase(config.databaseUrl);
  }

  mkdirSync(dirname(config.databasePath), { recursive: true });
  return createDatabase(config.databasePath);
}
