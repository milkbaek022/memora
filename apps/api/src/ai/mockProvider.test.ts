import { describe, expect, it } from "vitest";
import { MockAiProvider } from "./mockProvider";

describe("MockAiProvider", () => {
  it("returns 5 to 8 quiz questions for deep mode", async () => {
    const content = await new MockAiProvider().generateLearningContent({
      selectedText: "demand mining",
      paragraphContext: "Product managers use demand mining.",
      pageTitle: "Notes",
      pageUrl: "https://example.com",
      mode: "deep"
    });

    expect("quiz" in content ? content.quiz.length : 0).toBeGreaterThanOrEqual(5);
    expect("quiz" in content ? content.quiz.length : 0).toBeLessThanOrEqual(8);
  });
});
