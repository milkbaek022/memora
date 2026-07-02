import { describe, expect, it } from "vitest";
import type { AiProvider } from "./ai/provider";
import { MockAiProvider } from "./ai/mockProvider";
import { createDatabase } from "./db/database";
import { migrateDatabase, seedInviteCode } from "./db/schema";
import serverHandler, { buildServer } from "./server";

describe("server invite route", () => {
  it("exports a Vercel-compatible request handler", () => {
    expect(typeof serverHandler).toBe("function");
  });

  it("returns a lightweight health check for production hosts", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "memora-api"
    });

    const apiResponse = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(apiResponse.statusCode).toBe(200);
    expect(apiResponse.json()).toEqual({
      status: "ok",
      service: "memora-api"
    });
  });

  it("activates invite code through HTTP", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-HTTP", 5);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "BETA-HTTP" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ remaining_credits: 5 });
    expect(response.json().token).toEqual(expect.any(String));
  });

  it("accepts an ai provider dependency for later learning routes", () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);

    expect(() => buildServer({ db, aiProvider: {} as AiProvider })).not.toThrow();
  });

  it("routes /api/learn through the configured ai provider for authenticated invites", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-LEARN-HTTP", 5);
    const aiProvider: AiProvider = {
      async generateLearningContent(input) {
        return {
          concept_validity: { is_valid: true, reason: "这是一个值得解释的概念。" },
          original_term: input.selectedText,
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "这是一个产品分析里常见的概念。",
          plain_definition: "它指继续追问表面需求背后的真实目标。",
          simple_example: "用户说要更快的马，真实需求可能是更快到达目的地。",
          example_mapping: "快马是表面需求，更快到达目的地是真实目标。"
        };
      },
      async generateFeynmanFeedback() {
        throw new Error("unused");
      }
    };
    const app = buildServer({ db, aiProvider });
    const activation = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "BETA-LEARN-HTTP" }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/learn",
      headers: { authorization: `Bearer ${activation.json().token}` },
      payload: {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "quick"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      remaining_credits: 4,
      content: {
        original_term: "demand mining",
        chinese_display_name: "需求挖掘"
      }
    });
  });

  it("routes /api/feynman-feedback through the configured ai provider without deducting credit", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-FEYNMAN-HTTP", 5);
    const learningProvider = new MockAiProvider();
    let capturedExplanation = "";
    const aiProvider: AiProvider = {
      generateLearningContent: (input) => learningProvider.generateLearningContent(input),
      async generateFeynmanFeedback(input) {
        capturedExplanation = input.userExplanation;
        return {
          understanding_score: 91,
          what_is_clear: "你已经抓住了表面需求和真实需求的区别。",
          missing_or_wrong: "还可以补一句如何通过追问发现真实目标。",
          better_explanation: "需求挖掘就是先理解用户想达成什么，再决定做什么方案。",
          next_question: "如果用户说想要导出按钮，你会继续问什么？"
        };
      }
    };
    const app = buildServer({ db, aiProvider });
    const activation = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "BETA-FEYNMAN-HTTP" }
    });

    const learning = await app.inject({
      method: "POST",
      url: "/api/learn",
      headers: { authorization: `Bearer ${activation.json().token}` },
      payload: {
        selected_text: "demand mining",
        paragraph_context: "Product managers use demand mining.",
        page_title: "Notes",
        page_url: "https://example.com",
        mode: "mastery"
      }
    });
    const learningJson = learning.json();

    const feedback = await app.inject({
      method: "POST",
      url: "/api/feynman-feedback",
      headers: { authorization: `Bearer ${activation.json().token}` },
      payload: {
        session_id: learningJson.session_id,
        user_explanation: "  需求挖掘是找到用户原话背后的真实目标。  "
      }
    });

    expect(feedback.statusCode).toBe(200);
    expect(feedback.json()).toMatchObject({
      feedback: {
        understanding_score: 91
      }
    });
    expect(capturedExplanation).toBe("需求挖掘是找到用户原话背后的真实目标。");

    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${activation.json().token}` }
    });
    expect(me.json()).toMatchObject({ remaining_credits: 4 });
  });

  it("normalizes service errors into stable API errors", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "NOPE" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "INVALID_INVITE", message: "邀请码不存在。" }
    });
  });

  it("handles non-object invite activation bodies as invite errors", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      headers: { "content-type": "application/json" },
      payload: "null"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "INVALID_INVITE", message: "邀请码不存在。" }
    });
  });

  it("rejects /api/me without a bearer token", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "GET",
      url: "/api/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "请先输入邀请码。" }
    });
  });

  it("rejects /api/me with an invalid bearer token", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    const app = buildServer({ db });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer wrong-token" }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "登录状态已失效，请重新输入邀请码。" }
    });
  });

  it("returns the authenticated invite state from /api/me", async () => {
    const db = createDatabase(":memory:");
    migrateDatabase(db);
    seedInviteCode(db, "BETA-ME", 5);
    const app = buildServer({ db });
    const activation = await app.inject({
      method: "POST",
      url: "/api/invite/activate",
      payload: { code: "BETA-ME" }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${activation.json().token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      code: "BETA-ME",
      remaining_credits: 5
    });
  });
});
