import type { FastifyRequest } from "fastify";
import type { AppDatabase } from "../db/database";
import { ApiError } from "../invites/inviteService";
import { hashAccessToken } from "./tokens";

export interface AuthenticatedInvite {
  id: number;
  code: string;
  remaining_credits: number;
}

declare module "fastify" {
  interface FastifyRequest {
    inviteCode?: AuthenticatedInvite;
  }
}

export function authenticateRequest(db: AppDatabase, request: FastifyRequest): AuthenticatedInvite {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", 401, "请先输入邀请码。");
  }

  const token = header.slice("Bearer ".length).trim();
  const tokenHash = hashAccessToken(token);
  const row = db.prepare(`
    select id, code, remaining_credits
    from invite_codes
    where access_token_hash = ? and is_active = 1
  `).get(tokenHash) as AuthenticatedInvite | undefined;

  if (!row) {
    throw new ApiError("UNAUTHORIZED", 401, "登录状态已失效，请重新输入邀请码。");
  }

  request.inviteCode = row;
  return row;
}
