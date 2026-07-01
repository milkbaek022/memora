import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "../db/database";
import { seedInviteFromEnv } from "./seedInviteCommand";

let tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function tempDatabasePath(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "memora-seed-invite-"));
  tempDirs.push(tempDir);
  return join(tempDir, "ai-learning.sqlite");
}

describe("seedInviteFromEnv", () => {
  it("creates a regular invite code with 20 potions by default", async () => {
    const databasePath = tempDatabasePath();

    const result = await seedInviteFromEnv({
      DATABASE_PATH: databasePath,
      INVITE_CODE: "BETA-ONLINE"
    });

    const db = createDatabase(databasePath);
    const row = db
      .prepare(
        "select code, total_credits, remaining_credits, is_active from invite_codes where code = ?"
      )
      .get("BETA-ONLINE");
    db.close();

    expect(result).toEqual({
      code: "BETA-ONLINE",
      credits: 20,
      databasePath
    });
    expect(row).toEqual({
      code: "BETA-ONLINE",
      total_credits: 20,
      remaining_credits: 20,
      is_active: 1
    });
  });

  it("requires INVITE_CODE so production shells do not seed blank invites", async () => {
    await expect(
      seedInviteFromEnv({
        DATABASE_PATH: tempDatabasePath()
      })
    ).rejects.toThrow("Set INVITE_CODE before running seed:invite.");
  });
});
