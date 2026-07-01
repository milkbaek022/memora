import type { AppDatabase } from "./database";

export const DEFAULT_INVITE_CREDITS = 20;
export const UNLIMITED_INVITE_CREDITS = -1;
export const DEFAULT_MAIN_INVITE_CODE = "MEMORA-MAIN";

export function migrateDatabase(db: AppDatabase): void {
  db.exec(`
    create table if not exists invite_codes (
      id integer primary key autoincrement,
      code text not null unique,
      total_credits integer not null,
      remaining_credits integer not null,
      is_active integer not null default 1,
      access_token_hash text,
      created_at text not null default (datetime('now')),
      activated_at text,
      last_used_at text
    );

    create table if not exists learning_sessions (
      id text primary key,
      invite_code_id integer not null,
      selected_text text not null,
      paragraph_context text not null,
      page_title text not null,
      page_url text not null,
      mode text not null,
      ai_response_json text not null,
      credit_deducted integer not null,
      error_code text,
      created_at text not null default (datetime('now')),
      foreign key (invite_code_id) references invite_codes(id)
    );

    create table if not exists feynman_feedbacks (
      id text primary key,
      learning_session_id text not null,
      user_explanation text not null,
      ai_feedback_json text not null,
      created_at text not null default (datetime('now')),
      foreign key (learning_session_id) references learning_sessions(id)
    );
  `);
  migrateFeynmanFeedbackRounds(db);
}

function migrateFeynmanFeedbackRounds(db: AppDatabase): void {
  const table = db
    .prepare("select sql from sqlite_master where type = 'table' and name = 'feynman_feedbacks'")
    .get() as { sql: string } | undefined;

  if (!table?.sql.includes("learning_session_id text not null unique")) {
    return;
  }

  db.exec("pragma foreign_keys = off");
  try {
    db.exec(`
      begin transaction;

      alter table feynman_feedbacks rename to feynman_feedbacks_old;

      create table feynman_feedbacks (
        id text primary key,
        learning_session_id text not null,
        user_explanation text not null,
        ai_feedback_json text not null,
        created_at text not null default (datetime('now')),
        foreign key (learning_session_id) references learning_sessions(id)
      );

      insert into feynman_feedbacks (
        id,
        learning_session_id,
        user_explanation,
        ai_feedback_json,
        created_at
      )
      select
        id,
        learning_session_id,
        user_explanation,
        ai_feedback_json,
        created_at
      from feynman_feedbacks_old;

      drop table feynman_feedbacks_old;

      commit;
    `);
  } catch (error) {
    db.exec("rollback");
    throw error;
  } finally {
    db.exec("pragma foreign_keys = on");
  }
}

export function seedInviteCode(db: AppDatabase, code: string, credits = DEFAULT_INVITE_CREDITS): void {
  db.prepare(`
    insert into invite_codes (code, total_credits, remaining_credits, is_active)
    values (?, ?, ?, 1)
    on conflict(code) do nothing
  `).run(code, credits, credits);
}

export function seedMainInviteCode(
  db: AppDatabase,
  code: string = DEFAULT_MAIN_INVITE_CODE
): void {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return;
  }

  db.prepare(`
    insert into invite_codes (code, total_credits, remaining_credits, is_active)
    values (?, ?, ?, 1)
    on conflict(code) do update set
      total_credits = excluded.total_credits,
      remaining_credits = excluded.remaining_credits,
      is_active = 1
  `).run(normalizedCode, UNLIMITED_INVITE_CREDITS, UNLIMITED_INVITE_CREDITS);
}
