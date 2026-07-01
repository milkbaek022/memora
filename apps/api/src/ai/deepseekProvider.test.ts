import { describe, expect, it, vi } from "vitest";
import { DeepSeekChatProvider } from "./deepseekProvider";

const quickContent = {
  concept_validity: { is_valid: true, reason: "这是一个值得解释的概念。" },
  original_term: "demand mining",
  chinese_display_name: "需求挖掘",
  concept_type: "方法",
  background: "这个词常出现在产品工作里，用来发现用户真实想解决的问题。",
  plain_definition: "它是从用户表面说法里继续追问真实目标的方法。",
  simple_example: "用户说想要一匹更快的马，但真实需求是更快到达目的地，所以车可能更合适。",
  example_mapping: "快马对应表面需求，更快到达目的地对应真实需求，车对应更合适的方案。"
};

const englishQuickContent = {
  concept_validity: { is_valid: true, reason: "This is a concept." },
  original_term: "demand mining",
  chinese_display_name: "Demand mining",
  concept_type: "method",
  background: "This term is used in product work.",
  plain_definition: "It means asking what users really need.",
  simple_example: "A user asks for a faster horse, but may need a car.",
  example_mapping: "The horse is the stated request and the car is a better solution."
};

function mockJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload
  } as Response;
}

describe("DeepSeekChatProvider", () => {
  it("requests JSON content through the Chat Completions API", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      mockJsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify(quickContent)
            }
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new DeepSeekChatProvider({
      apiKey: "test-key",
      model: "deepseek-chat"
    }).generateLearningContent({
      selectedText: "demand mining",
      paragraphContext: "Product managers use demand mining.",
      pageTitle: "Notes",
      pageUrl: "https://example.com",
      mode: "quick"
    });

    expect(result).toMatchObject({
      original_term: "demand mining",
      chinese_display_name: "需求挖掘"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
          "content-type": "application/json"
        })
      })
    );
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const requestInit = firstCall![1]!;
    const body = JSON.parse(requestInit.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "deepseek-chat",
      response_format: { type: "json_object" }
    });
  });

  it("rejects responses without message content", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockJsonResponse({ choices: [] })));

    await expect(
      new DeepSeekChatProvider({ apiKey: "test-key", model: "deepseek-chat" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "AI_FAILURE",
      statusCode: 502,
      message: "DeepSeek 没有返回内容，请稍后重试。"
    });
  });

  it("parses JSON returned inside a markdown code block", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({
          choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(quickContent)}\n\`\`\`` } }]
        })
      )
    );

    await expect(
      new DeepSeekChatProvider({ apiKey: "test-key", model: "deepseek-chat" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).resolves.toMatchObject({ chinese_display_name: "需求挖掘" });
  });

  it("surfaces DeepSeek HTTP error details as API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "Insufficient Balance" } }), {
            status: 402
          })
      )
    );

    await expect(
      new DeepSeekChatProvider({ apiKey: "test-key", model: "deepseek-chat" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "AI_FAILURE",
      statusCode: 502,
      message: "DeepSeek 请求失败（402）：Insufficient Balance"
    });
  });

  it("surfaces network failures as actionable API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );

    await expect(
      new DeepSeekChatProvider({ apiKey: "test-key", model: "deepseek-chat" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "AI_FAILURE",
      statusCode: 502,
      message: "DeepSeek 网络连接失败，请检查后端网络和 DEEPSEEK_BASE_URL。"
    });
  });

  it("rejects content that fails shared validation with the shared error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({
          choices: [{ message: { content: JSON.stringify(englishQuickContent) } }]
        })
      )
    );

    await expect(
      new DeepSeekChatProvider({ apiKey: "test-key", model: "deepseek-chat" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).rejects.toMatchObject({
      code: "NON_CHINESE_OUTPUT",
      statusCode: 502,
      message: "学习内容必须使用中文输出。"
    });
  });
});
