import { describe, expect, it } from "vitest";
import { createDatabase } from "./database";
import {
  DEFAULT_INVITE_CREDITS,
  UNLIMITED_INVITE_CREDITS,
  migrateDatabase,
  seedInviteCode,
  seedMainInviteCode
} from "./schema";

describe("seedInviteCode", () => {
  it("seeds regular invite codes with 20 credits by default", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);

    seedInviteCode(db, "BETA-DEFAULT");

    const row = db
      .prepare("select total_credits, remaining_credits from invite_codes where code = ?")
      .get("BETA-DEFAULT") as { total_credits: number; remaining_credits: number };
    expect(row).toEqual({
      total_credits: DEFAULT_INVITE_CREDITS,
      remaining_credits: DEFAULT_INVITE_CREDITS
    });
  });

  it("seeds the main invite code as unlimited and active", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "MEMORA-MAIN", 1);
    db.prepare("update invite_codes set remaining_credits = 0, is_active = 0 where code = ?").run(
      "MEMORA-MAIN"
    );

    seedMainInviteCode(db, "MEMORA-MAIN");

    const row = db
      .prepare("select total_credits, remaining_credits, is_active from invite_codes where code = ?")
      .get("MEMORA-MAIN") as {
      total_credits: number;
      remaining_credits: number;
      is_active: number;
    };
    expect(row).toEqual({
      total_credits: UNLIMITED_INVITE_CREDITS,
      remaining_credits: UNLIMITED_INVITE_CREDITS,
      is_active: 1
    });
  });

  it("migrates old Feynman feedback tables to allow multiple rounds", () => {
    const db = createDatabase(":memory:");
    db.exec(`
      create table invite_codes (
        id integer primary key autoincrement,
        code text not null unique,
        total_credits integer not null,
        remaining_credits integer not null,
        is_active integer not null default 1
      );

      create table learning_sessions (
        id text primary key,
        invite_code_id integer not null,
        selected_text text not null,
        paragraph_context text not null,
        page_title text not null,
        page_url text not null,
        mode text not null,
        ai_response_json text not null,
        credit_deducted integer not null
      );

      create table feynman_feedbacks (
        id text primary key,
        learning_session_id text not null unique,
        user_explanation text not null,
        ai_feedback_json text not null,
        created_at text not null default (datetime('now'))
      );
    `);

    migrateDatabase(db);

    const table = db
      .prepare("select sql from sqlite_master where type = 'table' and name = 'feynman_feedbacks'")
      .get() as { sql: string };
    expect(table.sql).toContain("learning_session_id text not null");
    expect(table.sql).not.toContain("learning_session_id text not null unique");
  });

  it("does not reset credits for an existing invite code", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-KEEP", 5);
    db.prepare("update invite_codes set remaining_credits = 2 where code = ?").run("BETA-KEEP");

    seedInviteCode(db, "BETA-KEEP", 5);

    const row = db
      .prepare("select total_credits, remaining_credits from invite_codes where code = ?")
      .get("BETA-KEEP") as { total_credits: number; remaining_credits: number };
    expect(row).toEqual({ total_credits: 5, remaining_credits: 2 });
  });

  it("does not reactivate an existing disabled invite code", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-DISABLED", 5);
    db.prepare("update invite_codes set is_active = 0 where code = ?").run("BETA-DISABLED");

    seedInviteCode(db, "BETA-DISABLED", 5);

    const row = db
      .prepare("select is_active from invite_codes where code = ?")
      .get("BETA-DISABLED") as { is_active: number };
    expect(row.is_active).toBe(0);
  });
});
