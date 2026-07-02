import type { AppDatabase, MaybePromise } from "./database.js";

export const DEFAULT_INVITE_CREDITS = 20;
export const UNLIMITED_INVITE_CREDITS = -1;
export const DEFAULT_MAIN_INVITE_CODE = "MEMORA-MAIN";

export function migrateDatabase(db: AppDatabase): MaybePromise<void> {
  return db.migrate();
}

export function seedInviteCode(
  db: AppDatabase,
  code: string,
  credits = DEFAULT_INVITE_CREDITS
): MaybePromise<void> {
  return db.seedInviteCode(code, credits);
}

export function seedMainInviteCode(
  db: AppDatabase,
  code: string = DEFAULT_MAIN_INVITE_CODE
): MaybePromise<void> {
  return db.seedMainInviteCode(code);
}
