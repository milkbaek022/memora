import type {
  AppDatabase,
  AuthenticatedInviteRecord,
  InsertFeynmanFeedbackInput,
  InviteRecord,
  LearningSessionRecord,
  RecordLearningInput
} from "./database";
import { UNLIMITED_INVITE_CREDITS } from "./schema";

interface NeonSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Array<Record<string, unknown>>>;
}

function numberFromRow(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function inviteRecordFromRow(row: Record<string, unknown> | undefined): InviteRecord | undefined {
  if (!row) {
    return undefined;
  }
  return {
    id: numberFromRow(row.id),
    code: String(row.code),
    remaining_credits: numberFromRow(row.remaining_credits),
    is_active: numberFromRow(row.is_active)
  };
}

function authenticatedInviteFromRow(
  row: Record<string, unknown> | undefined
): AuthenticatedInviteRecord | undefined {
  if (!row) {
    return undefined;
  }
  return {
    id: numberFromRow(row.id),
    code: String(row.code),
    remaining_credits: numberFromRow(row.remaining_credits)
  };
}

export class PostgresDatabase implements AppDatabase {
  constructor(private readonly sql: NeonSql) {}

  async migrate(): Promise<void> {
    await this.sql`
      create table if not exists invite_codes (
        id serial primary key,
        code text not null unique,
        total_credits integer not null,
        remaining_credits integer not null,
        is_active integer not null default 1,
        access_token_hash text,
        created_at timestamptz not null default now(),
        activated_at timestamptz,
        last_used_at timestamptz
      )
    `;

    await this.sql`
      create table if not exists learning_sessions (
        id text primary key,
        invite_code_id integer not null references invite_codes(id),
        selected_text text not null,
        paragraph_context text not null,
        page_title text not null,
        page_url text not null,
        mode text not null,
        ai_response_json text not null,
        credit_deducted integer not null,
        error_code text,
        created_at timestamptz not null default now()
      )
    `;

    await this.sql`
      create table if not exists feynman_feedbacks (
        id text primary key,
        learning_session_id text not null references learning_sessions(id),
        user_explanation text not null,
        ai_feedback_json text not null,
        created_at timestamptz not null default now()
      )
    `;
  }

  async seedInviteCode(code: string, credits: number): Promise<void> {
    await this.sql`
      insert into invite_codes (code, total_credits, remaining_credits, is_active)
      values (${code}, ${credits}, ${credits}, 1)
      on conflict (code) do nothing
    `;
  }

  async seedMainInviteCode(code: string): Promise<void> {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      return;
    }

    await this.sql`
      insert into invite_codes (code, total_credits, remaining_credits, is_active)
      values (
        ${normalizedCode},
        ${UNLIMITED_INVITE_CREDITS},
        ${UNLIMITED_INVITE_CREDITS},
        1
      )
      on conflict (code) do update set
        total_credits = excluded.total_credits,
        remaining_credits = excluded.remaining_credits,
        is_active = 1
    `;
  }

  async findInviteByCode(code: string): Promise<InviteRecord | undefined> {
    const rows = await this.sql`
      select id, code, remaining_credits, is_active
      from invite_codes
      where code = ${code}
    `;
    return inviteRecordFromRow(rows[0]);
  }

  async activateInvite(id: number, tokenHash: string): Promise<void> {
    await this.sql`
      update invite_codes
      set access_token_hash = ${tokenHash},
          activated_at = coalesce(activated_at, now()),
          last_used_at = now()
      where id = ${id}
    `;
  }

  async findInviteByTokenHash(
    tokenHash: string
  ): Promise<AuthenticatedInviteRecord | undefined> {
    const rows = await this.sql`
      select id, code, remaining_credits
      from invite_codes
      where access_token_hash = ${tokenHash} and is_active = 1
    `;
    return authenticatedInviteFromRow(rows[0]);
  }

  async getInviteCredits(id: number): Promise<number | undefined> {
    const rows = await this.sql`
      select remaining_credits
      from invite_codes
      where id = ${id}
    `;
    const row = rows[0];
    return row ? numberFromRow(row.remaining_credits) : undefined;
  }

  async recordLearning(input: RecordLearningInput): Promise<number | undefined> {
    const rows = await this.sql`
      with updated_invite as (
        update invite_codes
        set remaining_credits = case
              when ${input.isUnlimited} then remaining_credits
              else remaining_credits - 1
            end,
            last_used_at = now()
        where id = ${input.inviteId}
          and (${input.isUnlimited} or remaining_credits > 0)
        returning remaining_credits,
          case when ${input.isUnlimited} then 0 else 1 end as credit_deducted
      ),
      inserted_session as (
        insert into learning_sessions (
          id,
          invite_code_id,
          selected_text,
          paragraph_context,
          page_title,
          page_url,
          mode,
          ai_response_json,
          credit_deducted,
          error_code
        )
        select
          ${input.sessionId},
          ${input.inviteId},
          ${input.selectedText},
          ${input.paragraphContext},
          ${input.pageTitle},
          ${input.pageUrl},
          ${input.mode},
          ${input.aiResponseJson},
          updated_invite.credit_deducted,
          null
        from updated_invite
        returning id
      )
      select remaining_credits from updated_invite
    `;

    const row = rows[0];
    return row ? numberFromRow(row.remaining_credits) : undefined;
  }

  async findLearningSession(
    sessionId: string,
    inviteId: number
  ): Promise<LearningSessionRecord | undefined> {
    const rows = await this.sql`
      select id, mode, ai_response_json
      from learning_sessions
      where id = ${sessionId} and invite_code_id = ${inviteId}
    `;
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: String(row.id),
      mode: String(row.mode),
      ai_response_json: String(row.ai_response_json)
    };
  }

  async countFeynmanFeedbacks(learningSessionId: string): Promise<number> {
    const rows = await this.sql`
      select count(*) as count
      from feynman_feedbacks
      where learning_session_id = ${learningSessionId}
    `;
    return numberFromRow(rows[0]?.count ?? 0);
  }

  async insertFeynmanFeedback(input: InsertFeynmanFeedbackInput): Promise<void> {
    await this.sql`
      insert into feynman_feedbacks (
        id,
        learning_session_id,
        user_explanation,
        ai_feedback_json
      )
      values (
        ${input.id},
        ${input.learningSessionId},
        ${input.userExplanation},
        ${input.aiFeedbackJson}
      )
    `;
  }

  close(): void {}
}

export async function createPostgresDatabase(connectionString: string): Promise<PostgresDatabase> {
  const { neon } = await import("@neondatabase/serverless");
  return new PostgresDatabase(neon(connectionString));
}
