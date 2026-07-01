import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config";
import { createDatabase } from "../db/database";
import { DEFAULT_INVITE_CREDITS, migrateDatabase, seedInviteCode } from "../db/schema";

export interface SeedInviteResult {
  code: string;
  credits: number;
  databasePath: string;
}

function inviteCreditsFromEnv(value: string | undefined): number {
  if (!value) {
    return DEFAULT_INVITE_CREDITS;
  }

  const credits = Number(value);
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("INVITE_CREDITS must be a positive integer.");
  }
  return credits;
}

export function seedInviteFromEnv(env: NodeJS.ProcessEnv = process.env): SeedInviteResult {
  const code = env.INVITE_CODE?.trim();
  if (!code) {
    throw new Error("Set INVITE_CODE before running seed:invite.");
  }

  const config = loadConfig(env);
  const credits = inviteCreditsFromEnv(env.INVITE_CREDITS);
  mkdirSync(dirname(config.databasePath), { recursive: true });

  const db = createDatabase(config.databasePath);
  try {
    migrateDatabase(db);
    seedInviteCode(db, code, credits);
  } finally {
    db.close();
  }

  return {
    code,
    credits,
    databasePath: config.databasePath
  };
}

const executedPath = process.argv[1] ? fileURLToPath(import.meta.url) : "";

if (process.argv[1] === executedPath) {
  const result = seedInviteFromEnv();
  console.log(
    `Seeded invite ${result.code} with ${result.credits} memory potions in ${result.databasePath}.`
  );
}
