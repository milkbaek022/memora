import type { ActivateInviteResponse, ApiErrorCode } from "@memora/shared";
import type { AppDatabase } from "../db/database";
import { createAccessToken, hashAccessToken } from "../auth/tokens";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public statusCode: number, message: string) {
    super(message);
  }
}

interface InviteRow {
  id: number;
  code: string;
  remaining_credits: number;
  is_active: number;
}

export function activateInvite(db: AppDatabase, code: string): ActivateInviteResponse {
  const normalizedCode = code.trim();
  const row = db.prepare("select id, code, remaining_credits, is_active from invite_codes where code = ?").get(normalizedCode) as InviteRow | undefined;

  if (!row) {
    throw new ApiError("INVALID_INVITE", 401, "邀请码不存在。");
  }
  if (row.is_active !== 1) {
    throw new ApiError("INVITE_DISABLED", 403, "邀请码已停用。");
  }

  const token = createAccessToken();
  const tokenHash = hashAccessToken(token);
  db.prepare(`
    update invite_codes
    set access_token_hash = ?, activated_at = coalesce(activated_at, datetime('now')), last_used_at = datetime('now')
    where id = ?
  `).run(tokenHash, row.id);

  return {
    token,
    remaining_credits: row.remaining_credits
  };
}
