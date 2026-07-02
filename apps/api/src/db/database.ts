import Database from "better-sqlite3";
import { UNLIMITED_INVITE_CREDITS } from "./schema.js";

export type MaybePromise<T> = T | Promise<T>;

export interface InviteRecord {
  id: number;
  code: string;
  remaining_credits: number;
  is_active: number;
}

export interface AuthenticatedInviteRecord {
  id: number;
  code: string;
  remaining_credits: number;
}

export interface LearningSessionRecord {
  id: string;
  mode: string;
  ai_response_json: string;
}

export interface RecordLearningInput {
  sessionId: string;
  inviteId: number;
  selectedText: string;
  paragraphContext: string;
  pageTitle: string;
  pageUrl: string;
  mode: string;
  aiResponseJson: string;
  isUnlimited: boolean;
}

export interface InsertFeynmanFeedbackInput {
  id: string;
  learningSessionId: string;
  userExplanation: string;
  aiFeedbackJson: string;
}

export interface AppDatabase {
  migrate(): MaybePromise<void>;
  seedInviteCode(code: string, credits: number): MaybePromise<void>;
  seedMainInviteCode(code: string): MaybePromise<void>;
  findInviteByCode(code: string): MaybePromise<InviteRecord | undefined>;
  activateInvite(id: number, tokenHash: string): MaybePromise<void>;
  findInviteByTokenHash(tokenHash: string): MaybePromise<AuthenticatedInviteRecord | undefined>;
  getInviteCredits(id: number): MaybePromise<number | undefined>;
  recordLearning(input: RecordLearningInput): MaybePromise<number | undefined>;
  findLearningSession(
    sessionId: string,
    inviteId: number
  ): MaybePromise<LearningSessionRecord | undefined>;
  countFeynmanFeedbacks(learningSessionId: string): MaybePromise<number>;
  insertFeynmanFeedback(input: InsertFeynmanFeedbackInput): MaybePromise<void>;
  close(): MaybePromise<void>;
}

export class SqliteDatabase implements AppDatabase {
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  exec(sql: string): Database.Database {
    return this.db.exec(sql);
  }

  migrate(): void {
    this.db.exec(`
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
    this.migrateFeynmanFeedbackRounds();
  }

  seedInviteCode(code: string, credits: number): void {
    this.db
      .prepare(
        `
          insert into invite_codes (code, total_credits, remaining_credits, is_active)
          values (?, ?, ?, 1)
          on conflict(code) do nothing
        `
      )
      .run(code, credits, credits);
  }

  seedMainInviteCode(code: string): void {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return;
    }

    this.db
      .prepare(
        `
          insert into invite_codes (code, total_credits, remaining_credits, is_active)
          values (?, ?, ?, 1)
          on conflict(code) do update set
            total_credits = excluded.total_credits,
            remaining_credits = excluded.remaining_credits,
            is_active = 1
        `
      )
      .run(normalizedCode, UNLIMITED_INVITE_CREDITS, UNLIMITED_INVITE_CREDITS);
  }

  findInviteByCode(code: string): InviteRecord | undefined {
    return this.db
      .prepare("select id, code, remaining_credits, is_active from invite_codes where code = ?")
      .get(code) as InviteRecord | undefined;
  }

  activateInvite(id: number, tokenHash: string): void {
    this.db
      .prepare(
        `
          update invite_codes
          set access_token_hash = ?,
              activated_at = coalesce(activated_at, datetime('now')),
              last_used_at = datetime('now')
          where id = ?
        `
      )
      .run(tokenHash, id);
  }

  findInviteByTokenHash(tokenHash: string): AuthenticatedInviteRecord | undefined {
    return this.db
      .prepare(
        `
          select id, code, remaining_credits
          from invite_codes
          where access_token_hash = ? and is_active = 1
        `
      )
      .get(tokenHash) as AuthenticatedInviteRecord | undefined;
  }

  getInviteCredits(id: number): number | undefined {
    const row = this.db
      .prepare("select remaining_credits from invite_codes where id = ?")
      .get(id) as { remaining_credits: number } | undefined;
    return row?.remaining_credits;
  }

  recordLearning(input: RecordLearningInput): number | undefined {
    return this.db.transaction(() => {
      let creditDeducted = 0;

      if (input.isUnlimited) {
        this.db
          .prepare("update invite_codes set last_used_at = datetime('now') where id = ?")
          .run(input.inviteId);
      } else {
        const updated = this.db
          .prepare(
            `
              update invite_codes
              set remaining_credits = remaining_credits - 1, last_used_at = datetime('now')
              where id = ? and remaining_credits > 0
            `
          )
          .run(input.inviteId);

        if (updated.changes !== 1) {
          return undefined;
        }
        creditDeducted = 1;
      }

      this.db
        .prepare(
          `
            insert into learning_sessions (
              id, invite_code_id, selected_text, paragraph_context, page_title, page_url,
              mode, ai_response_json, credit_deducted, error_code
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, null)
          `
        )
        .run(
          input.sessionId,
          input.inviteId,
          input.selectedText,
          input.paragraphContext,
          input.pageTitle,
          input.pageUrl,
          input.mode,
          input.aiResponseJson,
          creditDeducted
        );

      const row = this.db
        .prepare("select remaining_credits from invite_codes where id = ?")
        .get(input.inviteId) as { remaining_credits: number };
      return row.remaining_credits;
    })() as number | undefined;
  }

  findLearningSession(
    sessionId: string,
    inviteId: number
  ): LearningSessionRecord | undefined {
    return this.db
      .prepare(
        `
          select id, mode, ai_response_json
          from learning_sessions
          where id = ? and invite_code_id = ?
        `
      )
      .get(sessionId, inviteId) as LearningSessionRecord | undefined;
  }

  countFeynmanFeedbacks(learningSessionId: string): number {
    const row = this.db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(learningSessionId) as { count: number };
    return row.count;
  }

  insertFeynmanFeedback(input: InsertFeynmanFeedbackInput): void {
    this.db
      .prepare(
        `
          insert into feynman_feedbacks (
            id,
            learning_session_id,
            user_explanation,
            ai_feedback_json
          )
          values (?, ?, ?, ?)
        `
      )
      .run(
        input.id,
        input.learningSessionId,
        input.userExplanation,
        input.aiFeedbackJson
      );
  }

  close(): void {
    this.db.close();
  }

  private migrateFeynmanFeedbackRounds(): void {
    const table = this.db
      .prepare(
        "select sql from sqlite_master where type = 'table' and name = 'feynman_feedbacks'"
      )
      .get() as { sql: string } | undefined;

    if (!table?.sql.includes("learning_session_id text not null unique")) {
      return;
    }

    this.db.exec("pragma foreign_keys = off");
    try {
      this.db.exec(`
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
      this.db.exec("rollback");
      throw error;
    } finally {
      this.db.exec("pragma foreign_keys = on");
    }
  }
}

export function createDatabase(path: string): SqliteDatabase {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return new SqliteDatabase(db);
}
