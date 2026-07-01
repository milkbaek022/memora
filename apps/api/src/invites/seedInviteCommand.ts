import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config";
import { createAppDatabase } from "../db/appDatabase";
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

export async function seedInviteFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Promise<SeedInviteResult> {
  const code = env.INVITE_CODE?.trim();
  if (!code) {
    throw new Error("Set INVITE_CODE before running seed:invite.");
  }

  const config = loadConfig(env);
  const credits = inviteCreditsFromEnv(env.INVITE_CREDITS);
  if (!config.databaseUrl) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
  }

  const db = await createAppDatabase(config);
  try {
    await migrateDatabase(db);
    await seedInviteCode(db, code, credits);
  } finally {
    await db.close();
  }

  return {
    code,
    credits,
    databasePath: config.databasePath
  };
}

const executedPath = process.argv[1] ? fileURLToPath(import.meta.url) : "";

if (process.argv[1] === executedPath) {
  const result = await seedInviteFromEnv();
  console.log(
    `Seeded invite ${result.code} with ${result.credits} memory potions in ${result.databasePath}.`
  );
}
