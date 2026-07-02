import { randomUUID } from "node:crypto";
import type { LearnRequest, LearnResponse, ValidationResult } from "@memora/shared";
import { validateLearningContent, validateSelectedText } from "@memora/shared";
import type { AiProvider } from "../ai/provider";
import type { AuthenticatedInvite } from "../auth/authMiddleware";
import type { AppDatabase } from "../db/database";
import { UNLIMITED_INVITE_CREDITS } from "../db/schema";
import { ApiError } from "../invites/inviteService";

function aiFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `AI 生成失败：${error.message.trim()}`;
  }
  return "AI 生成失败，请稍后重试。";
}

export async function generateLearning(
  db: AppDatabase,
  aiProvider: AiProvider,
  invite: AuthenticatedInvite,
  request: LearnRequest
): Promise<LearnResponse> {
  const selectionValidation: ValidationResult = validateSelectedText(request.selected_text);
  if (selectionValidation.ok === false) {
    throw new ApiError(selectionValidation.code, 400, selectionValidation.message);
  }

  const remainingCreditQuota = await db.getInviteCredits(invite.id);
  const isUnlimited = remainingCreditQuota === UNLIMITED_INVITE_CREDITS;
  if (
    remainingCreditQuota === undefined ||
    (!isUnlimited && remainingCreditQuota <= 0)
  ) {
    throw new ApiError("NO_QUOTA", 402, "记忆药水已用完。");
  }

  let content: Awaited<ReturnType<AiProvider["generateLearningContent"]>>;
  try {
    content = await aiProvider.generateLearningContent({
      selectedText: request.selected_text.trim(),
      paragraphContext: request.paragraph_context.trim(),
      pageTitle: request.page_title.trim(),
      pageUrl: request.page_url.trim(),
      mode: request.mode
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("AI_FAILURE", 502, aiFailureMessage(error));
  }

  const contentValidation: ValidationResult = validateLearningContent(request.mode, content);
  if (contentValidation.ok === false) {
    throw new ApiError(contentValidation.code, 502, contentValidation.message);
  }

  if (content.concept_validity.is_valid === false) {
    throw new ApiError("INVALID_CONCEPT", 400, "请选择一个更具体的概念词。");
  }

  const sessionId = randomUUID();
  const remainingCredits = await db.recordLearning({
      sessionId,
      inviteId: invite.id,
      selectedText: request.selected_text.trim(),
      paragraphContext: request.paragraph_context.trim(),
      pageTitle: request.page_title.trim(),
      pageUrl: request.page_url.trim(),
      mode: request.mode,
      aiResponseJson: JSON.stringify(content),
      isUnlimited
    });
  if (remainingCredits === undefined) {
    throw new ApiError("NO_QUOTA", 402, "记忆药水已用完。");
  }

  return {
    session_id: sessionId,
    remaining_credits: remainingCredits,
    content
  };
}
