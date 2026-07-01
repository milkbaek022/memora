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

export async function authenticateRequest(
  db: AppDatabase,
  request: FastifyRequest
): Promise<AuthenticatedInvite> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", 401, "请先输入邀请码。");
  }

  const token = header.slice("Bearer ".length).trim();
  const tokenHash = hashAccessToken(token);
  const row = await db.findInviteByTokenHash(tokenHash);

  if (!row) {
    throw new ApiError("UNAUTHORIZED", 401, "登录状态已失效，请重新输入邀请码。");
  }

  request.inviteCode = row;
  return row;
}
