import { randomUUID } from "node:crypto";
import type {
  FeynmanFeedbackRequest,
  FeynmanFeedbackResponse,
  MasteryContent,
  ValidationResult
} from "@memora/shared";
import { validateFeynmanFeedback, validateLearningContent } from "@memora/shared";
import type { AiProvider } from "../ai/provider.js";
import type { AuthenticatedInvite } from "../auth/authMiddleware.js";
import type { AppDatabase } from "../db/database.js";
import { ApiError } from "../invites/inviteService.js";

const MAX_FEYNMAN_ROUNDS = 3;

function parseMasteryContent(json: string): MasteryContent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ApiError("MALFORMED_AI_RESPONSE", 502, "AI 返回格式不正确。");
  }

  const validation: ValidationResult = validateLearningContent("mastery", parsed);
  if (validation.ok === false) {
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
  const session = await db.findLearningSession(request.session_id.trim(), invite.id);

  if (!session) {
    throw new ApiError("SESSION_NOT_FOUND", 404, "没有找到这次学习记录。");
  }
  if (session.mode !== "mastery") {
    throw new ApiError("SESSION_NOT_FOUND", 400, "只有深度理解模式支持费曼反馈。");
  }

  const existingFeedbackCount = await db.countFeynmanFeedbacks(session.id);
  if (existingFeedbackCount >= MAX_FEYNMAN_ROUNDS) {
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

  const validation: ValidationResult = validateFeynmanFeedback(feedback);
  if (validation.ok === false) {
    throw new ApiError(validation.code, 502, validation.message);
  }

  await db.insertFeynmanFeedback({
    id: randomUUID(),
    learningSessionId: session.id,
    userExplanation: request.user_explanation.trim(),
    aiFeedbackJson: JSON.stringify(feedback)
  });

  return { feedback };
}
