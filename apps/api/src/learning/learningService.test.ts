import { describe, expect, it } from "vitest";
import type { AiProvider } from "../ai/provider";
import { MockAiProvider } from "../ai/mockProvider";
import { createDatabase } from "../db/database";
import {
  UNLIMITED_INVITE_CREDITS,
  migrateDatabase,
  seedInviteCode,
  seedMainInviteCode
} from "../db/schema";
import { activateInvite, ApiError } from "../invites/inviteService";
import { generateLearning } from "./learningService";

function setup() {
  const db = createDatabase(":memory:");
  migrateDatabase(db);
  seedInviteCode(db, "BETA-LEARN", 5);
  activateInvite(db, "BETA-LEARN");
  const invite = db
    .prepare("select id, code, remaining_credits from invite_codes where code = ?")
    .get("BETA-LEARN") as { id: number; code: string; remaining_credits: number };
  return { db, invite };
}

describe("generateLearning", () => {
  it("deducts exactly one credit after a successful generation", async () => {
    const { db, invite } = setup();
    const response = await generateLearning(db, new MockAiProvider(), invite, {
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    });

    expect(response.remaining_credits).toBe(4);
    expect(response.content).toMatchObject({
      original_term: "demand mining",
      chinese_display_name: "需求挖掘"
    });
    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(4);
    const session = db
      .prepare(`
        select selected_text, paragraph_context, page_title, page_url, credit_deducted
        from learning_sessions
        where id = ?
      `)
      .get(response.session_id) as {
      selected_text: string;
      paragraph_context: string;
      page_title: string;
      page_url: string;
      credit_deducted: number;
    };
    expect(session).toEqual({
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      credit_deducted: 1
    });
  });

  it("does not deduct credits for the unlimited main invite code", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedMainInviteCode(db, "MEMORA-MAIN");
    activateInvite(db, "MEMORA-MAIN");
    const invite = db
      .prepare("select id, code, remaining_credits from invite_codes where code = ?")
      .get("MEMORA-MAIN") as { id: number; code: string; remaining_credits: number };

    const response = await generateLearning(db, new MockAiProvider(), invite, {
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    });

    expect(response.remaining_credits).toBe(UNLIMITED_INVITE_CREDITS);
    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(UNLIMITED_INVITE_CREDITS);
    const session = db
      .prepare("select credit_deducted from learning_sessions where id = ?")
      .get(response.session_id) as { credit_deducted: number };
    expect(session.credit_deducted).toBe(0);
  });

  it("rejects no quota before returning content", async () => {
    const { db, invite } = setup();
    db.prepare("update invite_codes set remaining_credits = 0 where id = ?").run(invite.id);

    await expect(
      generateLearning(db, new MockAiProvider(), { ...invite, remaining_credits: 0 }, {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({ code: "NO_QUOTA", statusCode: 402 });
  });

  it("does not deduct credit when AI fails", async () => {
    const { db, invite } = setup();
    const failingProvider: AiProvider = {
      async generateLearningContent() {
        throw new Error("model unavailable");
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(
      generateLearning(db, failingProvider, invite, {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "AI_FAILURE",
      message: "AI 生成失败：model unavailable"
    });

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(5);
    const sessions = db.prepare("select count(*) as count from learning_sessions").get() as {
      count: number;
    };
    expect(sessions.count).toBe(0);
  });

  it("preserves typed provider validation errors without deducting credit", async () => {
    const { db, invite } = setup();
    const nonChineseProvider: AiProvider = {
      async generateLearningContent() {
        throw new ApiError("NON_CHINESE_OUTPUT", 502, "学习内容必须使用中文输出。");
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(
      generateLearning(db, nonChineseProvider, invite, {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({ code: "NON_CHINESE_OUTPUT", statusCode: 502 });

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(5);
  });

  it("rejects invalid concepts without deducting credit", async () => {
    const { db, invite } = setup();
    const invalidConceptProvider: AiProvider = {
      async generateLearningContent() {
        return {
          concept_validity: { is_valid: false, reason: "这不是一个适合解释的概念词。" },
          original_term: "the",
          chinese_display_name: "the",
          concept_type: "词",
          background: "这是一个不适合单独解释的功能词。",
          plain_definition: "它本身不承载一个具体概念。",
          simple_example: "例如句子里的冠词，不适合单独拿来学概念。",
          example_mapping: "它更像语法部件，而不是一个独立知识点。"
        };
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(
      generateLearning(db, invalidConceptProvider, invite, {
        selected_text: "the",
        paragraph_context: "This is the paragraph context.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({ code: "INVALID_CONCEPT", statusCode: 400 });

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(5);
  });

  it("uses a Chinese fallback message for invalid concept reasons", async () => {
    const { db, invite } = setup();
    const invalidConceptProvider: AiProvider = {
      async generateLearningContent() {
        return {
          concept_validity: { is_valid: false, reason: "This is not a specific concept." },
          original_term: "the",
          chinese_display_name: "冠词",
          concept_type: "词",
          background: "这是一个不适合单独解释的功能词。",
          plain_definition: "它本身不承载一个具体概念。",
          simple_example: "例如句子里的冠词，不适合单独拿来学概念。",
          example_mapping: "它更像语法部件，而不是一个独立知识点。"
        };
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(
      generateLearning(db, invalidConceptProvider, invite, {
        selected_text: "the",
        paragraph_context: "This is the paragraph context.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "INVALID_CONCEPT",
      statusCode: 400,
      message: "请选择一个更具体的概念词。"
    });
  });

  it("rejects malformed AI output without deducting credit", async () => {
    const { db, invite } = setup();
    const malformedProvider: AiProvider = {
      async generateLearningContent() {
        return {
          concept_validity: { is_valid: true, reason: "ok" },
          original_term: "demand mining"
        } as never;
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };

    await expect(
      generateLearning(db, malformedProvider, invite, {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({ code: "MALFORMED_AI_RESPONSE", statusCode: 502 });

    const row = db.prepare("select remaining_credits from invite_codes where id = ?").get(
      invite.id
    ) as { remaining_credits: number };
    expect(row.remaining_credits).toBe(5);
  });

  it("rejects long selections without deducting credit", async () => {
    const { db, invite } = setup();

    await expect(
      generateLearning(db, new MockAiProvider(), invite, {
        selected_text: "需求".repeat(50),
        paragraph_context: "Long selected text.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({ code: "SELECTION_TOO_LONG" });
  });
});
