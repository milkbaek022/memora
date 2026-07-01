import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./apiClient";

describe("apiClient", () => {
  it("activates invite code and stores token", async () => {
    const saveToken = vi.fn();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            token: "token-123",
            remaining_credits: 5
          }),
          { status: 200 }
        )
    );

    const client = createApiClient("https://api.example.com", {
      getToken: async () => null,
      saveToken,
      fetchImpl: fetchMock
    });

    const response = await client.activateInvite("BETA-001");

    expect(response.remaining_credits).toBe(5);
    expect(saveToken).toHaveBeenCalledWith("token-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/invite/activate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "BETA-001" })
      })
    );
  });

  it("sends bearer token to learn endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            session_id: "session-1",
            remaining_credits: 4,
            content: {
              concept_validity: { is_valid: true, reason: "这是概念。" },
              original_term: "demand mining",
              chinese_display_name: "需求挖掘",
              concept_type: "方法",
              background: "背景",
              plain_definition: "定义",
              simple_example: "例子",
              example_mapping: "映射"
            }
          }),
          { status: 200 }
        )
    );

    const client = createApiClient("https://api.example.com", {
      getToken: async () => "token-123",
      saveToken: async () => undefined,
      fetchImpl: fetchMock
    });

    await client.learn({
      selected_text: "demand mining",
      paragraph_context: "paragraph",
      page_title: "title",
      page_url: "https://example.com",
      mode: "quick"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/learn",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer token-123" })
      })
    );
  });

  it("surfaces Chinese API error messages", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: "INVALID_INVITE", message: "邀请码不存在。" }
          }),
          { status: 401 }
        )
    );

    const client = createApiClient("https://api.example.com", {
      getToken: async () => null,
      saveToken: async () => undefined,
      fetchImpl: fetchMock
    });

    await expect(client.activateInvite("NOPE")).rejects.toThrow("邀请码不存在。");
  });

  it("requires a token for protected endpoints", async () => {
    const fetchMock = vi.fn();
    const client = createApiClient("https://api.example.com", {
      getToken: async () => null,
      saveToken: async () => undefined,
      fetchImpl: fetchMock
    });

    await expect(
      client.learn({
        selected_text: "demand mining",
        paragraph_context: "paragraph",
        page_title: "title",
        page_url: "https://example.com",
        mode: "quick"
      })
    ).rejects.toThrow("请先输入邀请码。");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends bearer token to feynman feedback endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            feedback: {
              understanding_score: 88,
              what_is_clear: "你讲清楚了核心意思。",
              missing_or_wrong: "还可以补一个生活例子。",
              better_explanation: "可以说它是追问真实目标的方法。",
              next_question: "你会如何继续追问用户？"
            }
          }),
          { status: 200 }
        )
    );
    const client = createApiClient("https://api.example.com", {
      getToken: async () => "token-123",
      saveToken: async () => undefined,
      fetchImpl: fetchMock
    });

    await client.submitFeynmanFeedback({
      session_id: "session-1",
      user_explanation: "我用自己的话解释一下。"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/feynman-feedback",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer token-123" })
      })
    );
  });
});
