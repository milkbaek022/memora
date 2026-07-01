import { randomUUID } from "node:crypto";
import type { LearnRequest, LearnResponse } from "@memora/shared";
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
  const selectionValidation = validateSelectedText(request.selected_text);
  if (!selectionValidation.ok) {
    throw new ApiError(selectionValidation.code, 400, selectionValidation.message);
  }

  const quotaRow = db
    .prepare("select remaining_credits from invite_codes where id = ?")
    .get(invite.id) as { remaining_credits: number } | undefined;
  const isUnlimited = quotaRow?.remaining_credits === UNLIMITED_INVITE_CREDITS;
  if (!quotaRow || (!isUnlimited && quotaRow.remaining_credits <= 0)) {
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

  const contentValidation = validateLearningContent(request.mode, content);
  if (!contentValidation.ok) {
    throw new ApiError(contentValidation.code, 502, contentValidation.message);
  }

  if (content.concept_validity.is_valid === false) {
    throw new ApiError("INVALID_CONCEPT", 400, "请选择一个更具体的概念词。");
  }

  const sessionId = randomUUID();
  const remainingCredits = db.transaction(() => {
    let creditDeducted = 0;

    if (isUnlimited) {
      db.prepare("update invite_codes set last_used_at = datetime('now') where id = ?").run(
        invite.id
      );
    } else {
      const updated = db
        .prepare(`
          update invite_codes
          set remaining_credits = remaining_credits - 1, last_used_at = datetime('now')
          where id = ? and remaining_credits > 0
        `)
        .run(invite.id);

      if (updated.changes !== 1) {
        throw new ApiError("NO_QUOTA", 402, "记忆药水已用完。");
      }
      creditDeducted = 1;
    }

    db.prepare(`
      insert into learning_sessions (
        id, invite_code_id, selected_text, paragraph_context, page_title, page_url,
        mode, ai_response_json, credit_deducted, error_code
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, null)
    `).run(
      sessionId,
      invite.id,
      request.selected_text.trim(),
      request.paragraph_context.trim(),
      request.page_title.trim(),
      request.page_url.trim(),
      request.mode,
      JSON.stringify(content),
      creditDeducted
    );

    const row = db
      .prepare("select remaining_credits from invite_codes where id = ?")
      .get(invite.id) as { remaining_credits: number };
    return row.remaining_credits;
  })();

  return {
    session_id: sessionId,
    remaining_credits: remainingCredits,
    content
  };
}
