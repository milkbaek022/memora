import { describe, expect, it, vi } from "vitest";
import { OpenAiResponsesProvider } from "./openaiProvider";

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

describe("OpenAiResponsesProvider", () => {
  it("parses raw output_text content from Responses API output arrays", async () => {
    const fetchMock = vi.fn(async () =>
      mockJsonResponse({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify(quickContent)
              }
            ]
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAiResponsesProvider({
      apiKey: "test-key",
      model: "test-model"
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
  });

  it("rejects responses without output text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockJsonResponse({ output: [] })));

    await expect(
      new OpenAiResponsesProvider({ apiKey: "test-key", model: "test-model" }).generateLearningContent({
        selectedText: "demand mining",
        paragraphContext: "Product managers use demand mining.",
        pageTitle: "Notes",
        pageUrl: "https://example.com",
        mode: "quick"
      })
    ).rejects.toThrow("OpenAI response did not include output_text.");
  });

  it("rejects content that fails shared validation with the shared error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        mockJsonResponse({
          output_text: JSON.stringify(englishQuickContent)
        })
      )
    );

    await expect(
      new OpenAiResponsesProvider({ apiKey: "test-key", model: "test-model" }).generateLearningContent({
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
