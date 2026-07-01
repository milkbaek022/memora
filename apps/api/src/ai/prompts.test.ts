import { describe, expect, it } from "vitest";
import { buildFeynmanPrompt, buildLearningPrompt } from "./prompts";

describe("learning prompts", () => {
  it("requires Chinese output even for English selected terms", () => {
    const prompt = buildLearningPrompt({
      selectedText: "demand mining",
      paragraphContext: "Product managers use demand mining to understand user needs.",
      pageTitle: "Product Discovery Notes",
      pageUrl: "https://example.com",
      mode: "mastery"
    });

    expect(prompt).toContain("所有输出必须使用简体中文");
    expect(prompt).toContain("保留原始英文词");
    expect(prompt).toContain("demand mining");
    expect(prompt).toContain("5 到 8 道选择题");
    expect(prompt).toContain("费曼学习法");
  });

  it("requires examples to follow the article context before generic explanations", () => {
    const prompt = buildLearningPrompt({
      selectedText: "熔断机制",
      paragraphContext: "把紧箍咒变成护身符，平衡数据安全和AI性能的协同合规新范式。",
      pageTitle: "金融AI治理",
      pageUrl: "https://example.com/article",
      mode: "quick"
    });

    expect(prompt).toContain("先结合所在段落判断这个词在本文中的具体含义");
    expect(prompt).toContain("不要只给百科式通用解释");
    expect(prompt).toContain("例子必须贴合文章语境");
    expect(prompt).toContain("说明生活例子中的角色分别对应文章里的什么");
  });

  it("requires Chinese Feynman feedback that can continue across rounds", () => {
    const prompt = buildFeynmanPrompt({
      originalTerm: "demand mining",
      chineseDisplayName: "需求挖掘",
      userExplanation: "就是多问几个为什么。",
      expectedPoints: ["表面需求", "真实问题", "更好方案"]
    });

    expect(prompt).toContain("多轮费曼练习中的一轮反馈");
    expect(prompt).toContain("next_question");
    expect(prompt).toContain("简体中文");
    expect(prompt).toContain("understanding_score");
    expect(prompt).not.toContain("不进行多轮追问");
  });
});
