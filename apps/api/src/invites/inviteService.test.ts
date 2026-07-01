import { describe, expect, it } from "vitest";
import { createDatabase } from "../db/database";
import {
  UNLIMITED_INVITE_CREDITS,
  migrateDatabase,
  seedInviteCode,
  seedMainInviteCode
} from "../db/schema";
import { activateInvite } from "./inviteService";

async function expectApiError(
  action: () => Promise<unknown>,
  expected: { code: string; statusCode: number }
): Promise<void> {
  try {
    await action();
    throw new Error("Expected action to throw.");
  } catch (error) {
    expect(error).toMatchObject(expected);
  }
}

describe("activateInvite", () => {
  it("activates an invite code and returns a reusable bearer token", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-001", 5);

    const result = await activateInvite(db, "BETA-001");

    expect(result.remaining_credits).toBe(5);
    expect(result.token.length).toBeGreaterThan(32);
    const row = db.prepare("select activated_at, access_token_hash from invite_codes where code = ?").get("BETA-001") as { activated_at: string; access_token_hash: string };
    expect(row.activated_at).toEqual(expect.any(String));
    expect(row.access_token_hash.length).toBe(64);
  });

  it("activates the main invite code with unlimited credits", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedMainInviteCode(db, "MEMORA-MAIN");

    const result = await activateInvite(db, "MEMORA-MAIN");

    expect(result.remaining_credits).toBe(UNLIMITED_INVITE_CREDITS);
    expect(result.token.length).toBeGreaterThan(32);
  });

  it("rejects an unknown invite code", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);

    await expectApiError(() => activateInvite(db, "MISSING"), {
      code: "INVALID_INVITE",
      statusCode: 401
    });
  });

  it("rejects a disabled invite code", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-002", 5);
    db.prepare("update invite_codes set is_active = 0 where code = ?").run("BETA-002");

    await expectApiError(() => activateInvite(db, "BETA-002"), {
      code: "INVITE_DISABLED",
      statusCode: 403
    });
  });
});
