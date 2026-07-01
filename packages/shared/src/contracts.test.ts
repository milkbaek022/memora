import { describe, expect, it } from "vitest";
import {
  isChineseTextDominant,
  validateFeynmanFeedback,
  validateLearningContent,
  validateSelectedText
} from "./contracts";

describe("validateSelectedText", () => {
  it("accepts a short English concept", () => {
    expect(validateSelectedText("demand mining")).toEqual({ ok: true });
  });

  it("rejects empty selected text", () => {
    expect(validateSelectedText("   ")).toEqual({
      ok: false,
      code: "INVALID_SELECTION",
      message: "请选择一个更具体的概念词。"
    });
  });

  it("rejects overly long selected text", () => {
    const selectedText = "需求".repeat(50);
    expect(validateSelectedText(selectedText)).toEqual({
      ok: false,
      code: "SELECTION_TOO_LONG",
      message: "选中的内容太长，请选择一个更短的概念词。"
    });
  });
});

describe("validateLearningContent", () => {
  it("accepts quick content with Chinese explanation for English term", () => {
    const result = validateLearningContent("quick", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。"
    });

    expect(result.ok).toBe(true);
  });

  it("rejects English-only explanations", () => {
    const result = validateLearningContent("quick", {
      concept_validity: { is_valid: true, reason: "valid" },
      original_term: "demand mining",
      chinese_display_name: "demand mining",
      concept_type: "method",
      background: "This is used in product discovery.",
      plain_definition: "It means finding hidden needs.",
      simple_example: "A user wants a faster horse.",
      example_mapping: "The horse maps to the surface request."
    });

    expect(result).toEqual({
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "学习内容必须使用中文输出。"
    });
  });

  it("accepts mastery content with quiz and Feynman prompt", () => {
    const result = validateLearningContent("mastery", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。",
      key_points: ["先听表面说法", "继续追问真实目标", "围绕真实目标找方案"],
      common_misunderstandings: ["把用户原话当成最终需求", "只做用户说的功能"],
      quiz: [
        {
          id: "q1",
          question: "以下哪项最接近需求挖掘？",
          options: [
            { id: "A", text: "整理用户原话" },
            { id: "B", text: "追问背后的真实问题" },
            { id: "C", text: "直接排期开发" },
            { id: "D", text: "跳过用户研究" }
          ],
          correct_option_id: "B",
          explanation: "B 对，因为需求挖掘关注真实问题。"
        }
      ],
      feynman_prompt: "请用自己的话解释需求挖掘。",
      expected_explanation_points: ["表面需求", "真实问题", "更合适方案"]
    });

    expect(result.ok).toBe(true);
  });

  it("rejects malformed quiz option ids", () => {
    const result = validateLearningContent("deep", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。",
      key_points: ["先听表面说法", "继续追问真实目标", "围绕真实目标找方案"],
      common_misunderstandings: ["把用户原话当成最终需求", "只做用户说的功能"],
      quiz: [
        {
          id: "q1",
          question: "以下哪项最接近需求挖掘？",
          options: [
            { id: "A", text: "整理用户原话" },
            { id: "A", text: "追问背后的真实问题" },
            { id: "C", text: "直接排期开发" },
            { id: "D", text: "跳过用户研究" }
          ],
          correct_option_id: "B",
          explanation: "B 对，因为需求挖掘关注真实问题。"
        }
      ]
    });

    expect(result).toEqual({
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 返回的选择题选项格式不正确。"
    });
  });

  it("rejects non-string or English-only deep learning points", () => {
    const result = validateLearningContent("deep", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。",
      key_points: ["Surface request", "Hidden need", "Better solution"],
      common_misunderstandings: ["把用户原话当成最终需求", "只做用户说的功能"],
      quiz: [
        {
          id: "q1",
          question: "以下哪项最接近需求挖掘？",
          options: [
            { id: "A", text: "整理用户原话" },
            { id: "B", text: "追问背后的真实问题" },
            { id: "C", text: "直接排期开发" },
            { id: "D", text: "跳过用户研究" }
          ],
          correct_option_id: "B",
          explanation: "B 对，因为需求挖掘关注真实问题。"
        }
      ]
    });

    expect(result).toEqual({
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "理解要点和常见误区必须使用中文输出。"
    });
  });

  it("rejects malformed Feynman expected explanation points", () => {
    const result = validateLearningContent("mastery", {
      concept_validity: { is_valid: true, reason: "这是一个产品术语。" },
      original_term: "demand mining",
      chinese_display_name: "需求挖掘",
      concept_type: "方法",
      background: "这个词常出现在产品和用户研究场景。",
      plain_definition: "需求挖掘就是继续追问用户真正想解决的问题。",
      simple_example: "用户说想要快马，真实需求可能是更快到达目的地。",
      example_mapping: "快马是表面需求，更快到达是深层需求。",
      key_points: ["先听表面说法", "继续追问真实目标", "围绕真实目标找方案"],
      common_misunderstandings: ["把用户原话当成最终需求", "只做用户说的功能"],
      quiz: [
        {
          id: "q1",
          question: "以下哪项最接近需求挖掘？",
          options: [
            { id: "A", text: "整理用户原话" },
            { id: "B", text: "追问背后的真实问题" },
            { id: "C", text: "直接排期开发" },
            { id: "D", text: "跳过用户研究" }
          ],
          correct_option_id: "B",
          explanation: "B 对，因为需求挖掘关注真实问题。"
        }
      ],
      feynman_prompt: "请用自己的话解释需求挖掘。",
      expected_explanation_points: ["Surface request", "Hidden need", "Better solution"]
    });

    expect(result).toEqual({
      ok: false,
      code: "NON_CHINESE_OUTPUT",
      message: "费曼解释要点必须使用中文输出。"
    });
  });
});

describe("validateFeynmanFeedback", () => {
  it("accepts Chinese feedback", () => {
    expect(
      validateFeynmanFeedback({
        understanding_score: 82,
        what_is_clear: "你讲清楚了表面需求和真实需求的区别。",
        missing_or_wrong: "还可以补充如何继续追问。",
        better_explanation: "需求挖掘就是从用户说法里找到真正要解决的问题。",
        next_question: "如果用户说想要更多按钮，你会怎么追问？"
      }).ok
    ).toBe(true);
  });

  it("rejects missing feedback fields", () => {
    expect(
      validateFeynmanFeedback({
        understanding_score: 82,
        what_is_clear: "你讲清楚了表面需求和真实需求的区别。",
        missing_or_wrong: "还可以补充如何继续追问。",
        better_explanation: "需求挖掘就是从用户说法里找到真正要解决的问题。"
      })
    ).toEqual({
      ok: false,
      code: "MALFORMED_AI_RESPONSE",
      message: "AI 反馈缺少字段：next_question"
    });
  });
});

describe("isChineseTextDominant", () => {
  it("treats mixed original term plus Chinese explanation as Chinese dominant", () => {
    expect(
      isChineseTextDominant("demand mining 是需求挖掘，不是简单翻译用户原话。")
    ).toBe(true);
  });
});
