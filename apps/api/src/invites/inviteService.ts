import type { ActivateInviteResponse, ApiErrorCode } from "@memora/shared";
import type { AppDatabase } from "../db/database.js";
import { createAccessToken, hashAccessToken } from "../auth/tokens.js";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public statusCode: number, message: string) {
    super(message);
  }
}

export async function activateInvite(db: AppDatabase, code: string): Promise<ActivateInviteResponse> {
  const normalizedCode = code.trim();
  const row = await db.findInviteByCode(normalizedCode);

  if (!row) {
    throw new ApiError("INVALID_INVITE", 401, "邀请码不存在。");
  }
  if (row.is_active !== 1) {
    throw new ApiError("INVITE_DISABLED", 403, "邀请码已停用。");
  }

  const token = createAccessToken();
  const tokenHash = hashAccessToken(token);
  await db.activateInvite(row.id, tokenHash);

  return {
    token,
    remaining_credits: row.remaining_credits
  };
}
