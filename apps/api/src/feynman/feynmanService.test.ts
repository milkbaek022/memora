import { describe, expect, it } from "vitest";
import type { FeynmanFeedback } from "@memora/shared";
import type { AiProvider, FeynmanGenerationInput } from "../ai/provider";
import { MockAiProvider } from "../ai/mockProvider";
import { createDatabase } from "../db/database";
import type { SqliteDatabase } from "../db/database";
import { migrateDatabase, seedInviteCode } from "../db/schema";
import { activateInvite, ApiError } from "../invites/inviteService";
import { generateLearning } from "../learning/learningService";
import { submitFeynmanFeedback } from "./feynmanService";

const feedback: FeynmanFeedback = {
  understanding_score: 82,
  what_is_clear: "你已经讲清楚了它不是照抄用户原话。",
  missing_or_wrong: "还可以补充如何通过追问找到真实目标。",
  better_explanation:
    "这个概念就是从用户表面说法里继续追问，找到真正要解决的问题，再寻找更合适的方案。",
  next_question: "如果用户说想要一个按钮，你会怎么判断他真正想完成什么？"
};

function inviteRow(db: SqliteDatabase, code: string) {
  return db
    .prepare("select id, code, remaining_credits from invite_codes where code = ?")
    .get(code) as { id: number; code: string; remaining_credits: number };
}

function feedbackProvider(
  generateFeynmanFeedback: (input: FeynmanGenerationInput) => Promise<FeynmanFeedback>
): AiProvider {
  return {
    async generateLearningContent() {
      throw new Error("unused");
    },
    generateFeynmanFeedback
  };
}

async function setupSession(mode: "quick" | "deep" | "mastery" = "mastery") {
  const db = createDatabase(":memory:");
  migrateDatabase(db);
  seedInviteCode(db, "BETA-FEYNMAN", 5);
  await activateInvite(db, "BETA-FEYNMAN");
  const invite = inviteRow(db, "BETA-FEYNMAN");
  const session = await generateLearning(db, new MockAiProvider(), invite, {
    selected_text: "demand mining",
    paragraph_context: "Product managers use demand mining.",
    page_title: "Notes",
    page_url: "https://example.com",
    mode
  });
  return { db, invite, session };
}

describe("submitFeynmanFeedback", () => {
  it("stores one feedback response without deducting credit", async () => {
    const { db, invite, session } = await setupSession();
    let capturedInput: FeynmanGenerationInput | undefined;
    const provider = feedbackProvider(async (input) => {
      capturedInput = input;
      return feedback;
    });
    const before = db
      .prepare("select remaining_credits from invite_codes where id = ?")
      .get(invite.id) as { remaining_credits: number };

    const response = await submitFeynmanFeedback(db, provider, invite, {
      session_id: session.session_id,
      user_explanation:
        "  需求挖掘就是不要只听用户说要什么，还要追问他真正想解决什么问题。  "
    });

    expect(response.feedback.understanding_score).toBe(82);
    expect(capturedInput).toEqual({
      originalTerm: "demand mining",
      chineseDisplayName: "需求挖掘",
      userExplanation: "需求挖掘就是不要只听用户说要什么，还要追问他真正想解决什么问题。",
      expectedPoints: ["说明它解决什么问题", "区分表面说法和真实需求", "用一个简单例子讲清楚"]
    });
    const after = db
      .prepare("select remaining_credits from invite_codes where id = ?")
      .get(invite.id) as { remaining_credits: number };
    expect(after.remaining_credits).toBe(before.remaining_credits);
    const row = db
      .prepare(`
        select learning_session_id, user_explanation, ai_feedback_json
        from feynman_feedbacks
        where learning_session_id = ?
      `)
      .get(session.session_id) as {
      learning_session_id: string;
      user_explanation: string;
      ai_feedback_json: string;
    };
    expect(row.learning_session_id).toBe(session.session_id);
    expect(row.user_explanation).toBe(
      "需求挖掘就是不要只听用户说要什么，还要追问他真正想解决什么问题。"
    );
    expect(JSON.parse(row.ai_feedback_json)).toMatchObject(feedback);
  });

  it("allows three feedback rounds for the same session and rejects the fourth", async () => {
    const { db, invite, session } = await setupSession();
    let calls = 0;
    const provider = feedbackProvider(async () => {
      calls += 1;
      return feedback;
    });

    for (const user_explanation of ["第一次解释。", "第二次解释。", "第三次解释。"]) {
      const response = await submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation
      });
      expect(response.feedback.understanding_score).toBe(82);
    }

    await expect(
      submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation: "第四次解释。"
      })
    ).rejects.toMatchObject({ code: "FEEDBACK_ALREADY_SUBMITTED", statusCode: 409 });
    expect(calls).toBe(3);

    const row = db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(session.session_id) as { count: number };
    expect(row.count).toBe(3);
  });

  it("rejects sessions owned by another invite", async () => {
    const { db, session } = await setupSession();
    seedInviteCode(db, "BETA-OTHER", 5);
    await activateInvite(db, "BETA-OTHER");
    const otherInvite = inviteRow(db, "BETA-OTHER");

    await expect(
      submitFeynmanFeedback(db, new MockAiProvider(), otherInvite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND", statusCode: 404 });
  });

  it("rejects non-mastery sessions", async () => {
    const { db, invite, session } = await setupSession("quick");

    await expect(
      submitFeynmanFeedback(db, new MockAiProvider(), invite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND", statusCode: 400 });
  });

  it("does not store feedback when AI generation fails", async () => {
    const { db, invite, session } = await setupSession();
    const provider = feedbackProvider(async () => {
      throw new Error("model unavailable");
    });

    await expect(
      submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).rejects.toMatchObject({ code: "AI_FAILURE", statusCode: 502 });

    const row = db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(session.session_id) as { count: number };
    expect(row.count).toBe(0);
  });

  it("preserves typed provider validation errors without storing feedback", async () => {
    const { db, invite, session } = await setupSession();
    const provider = feedbackProvider(async () => {
      throw new ApiError("NON_CHINESE_OUTPUT", 502, "费曼反馈必须使用中文输出。");
    });

    await expect(
      submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).rejects.toMatchObject({ code: "NON_CHINESE_OUTPUT", statusCode: 502 });

    const row = db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(session.session_id) as { count: number };
    expect(row.count).toBe(0);
  });

  it("stores a later feedback generated while another round is already saved", async () => {
    const { db, invite, session } = await setupSession();
    const provider = feedbackProvider(async () => {
      db.prepare(`
        insert into feynman_feedbacks (id, learning_session_id, user_explanation, ai_feedback_json)
        values (?, ?, ?, ?)
      `).run("late-duplicate", session.session_id, "另一个同时提交的解释。", JSON.stringify(feedback));
      return feedback;
    });

    await expect(
      submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).resolves.toMatchObject({ feedback });

    const row = db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(session.session_id) as { count: number };
    expect(row.count).toBe(2);
  });

  it("rejects malformed feedback without storing it", async () => {
    const { db, invite, session } = await setupSession();
    const provider: AiProvider = {
      async generateLearningContent() {
        throw new Error("unused");
      },
      async generateFeynmanFeedback() {
        return {
          understanding_score: 82
        } as never;
      }
    };

    await expect(
      submitFeynmanFeedback(db, provider, invite, {
        session_id: session.session_id,
        user_explanation: "我试着解释一下这个概念。"
      })
    ).rejects.toMatchObject({ code: "MALFORMED_AI_RESPONSE", statusCode: 502 });

    const row = db
      .prepare("select count(*) as count from feynman_feedbacks where learning_session_id = ?")
      .get(session.session_id) as { count: number };
    expect(row.count).toBe(0);
  });
});
