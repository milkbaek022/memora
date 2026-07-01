import { randomUUID } from "node:crypto";
import type { FeynmanFeedbackRequest, FeynmanFeedbackResponse, MasteryContent } from "@memora/shared";
import { validateFeynmanFeedback, validateLearningContent } from "@memora/shared";
import type { AiProvider } from "../ai/provider";
import type { AuthenticatedInvite } from "../auth/authMiddleware";
import type { AppDatabase } from "../db/database";
import { ApiError } from "../invites/inviteService";

interface SessionRow {
  id: string;
  mode: string;
  ai_response_json: string;
}

const MAX_FEYNMAN_ROUNDS = 3;

function parseMasteryContent(json: string): MasteryContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ApiError("MALFORMED_AI_RESPONSE", 502, "AI 返回格式不正确。");
  }

  const validation = validateLearningContent("mastery", parsed);
  if (!validation.ok) {
    throw new ApiError(validation.code, 502, validation.message);
  }
  return parsed as MasteryContent;
}

export async function submitFeynmanFeedback(
  db: AppDatabase,
  aiProvider: AiProvider,
  invite: AuthenticatedInvite,
  request: FeynmanFeedbackRequest
): Promise<FeynmanFeedbackResponse> {
  const session = db
    .prepare(`
      select id, mode, ai_response_json
      from learning_sessions
      where id = ? and invite_code_id = ?
    `)
    .get(request.session_id.trim(), invite.id) as SessionRow | undefined;

  if (!session) {
    throw new ApiError("SESSION_NOT_FOUND", 404, "没有找到这次学习记录。");
  }
  if (session.mode !== "mastery") {
    throw new ApiError("SESSION_NOT_FOUND", 400, "只有深度理解模式支持费曼反馈。");
  }

  const existing = db
    .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
    .get(session.id) as { count: number };
  if (existing.count >= MAX_FEYNMAN_ROUNDS) {
    throw new ApiError("FEEDBACK_ALREADY_SUBMITTED", 409, "这次学习最多支持三轮费曼反馈。");
  }

  const content = parseMasteryContent(session.ai_response_json);
  let feedback: Awaited<ReturnType<AiProvider["generateFeynmanFeedback"]>>;
  try {
    feedback = await aiProvider.generateFeynmanFeedback({
      originalTerm: content.original_term,
      chineseDisplayName: content.chinese_display_name,
      userExplanation: request.user_explanation.trim(),
      expectedPoints: content.expected_explanation_points
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("AI_FAILURE", 502, "AI 反馈生成失败，请稍后重试。");
  }

  const validation = validateFeynmanFeedback(feedback);
  if (!validation.ok) {
    throw new ApiError(validation.code, 502, validation.message);
  }

  db.prepare(`
    insert into feynman_feedbacks (id, learning_session_id, user_explanation, ai_feedback_json)
    values (?, ?, ?, ?)
  `).run(randomUUID(), session.id, request.user_explanation.trim(), JSON.stringify(feedback));

  return { feedback };
}
