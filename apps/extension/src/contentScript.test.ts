import { describe, expect, it } from "vitest";
import {
  findNearestParagraphText,
  getSelectionContext,
  normalizeSelectedText
} from "./contentScript";

describe("selection extraction helpers", () => {
  it("normalizes selected text", () => {
    expect(normalizeSelectedText("  demand   mining  ")).toBe("demand mining");
  });

  it("finds the nearest paragraph from a selected node", () => {
    document.body.innerHTML = `
      <article>
        <p id="target">Product managers use <strong>demand mining</strong> to understand users.</p>
      </article>
    `;
    const strong = document.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(findNearestParagraphText(strong as Element)).toBe(
      "Product managers use demand mining to understand users."
    );
  });

  it("returns page metadata with a normalized selection", () => {
    document.body.innerHTML = `
      <main>
        <p>Product managers use <strong>demand mining</strong> to understand users.</p>
      </main>
    `;
    document.title = "Product Notes";
    const strong = document.querySelector("strong");
    expect(strong?.firstChild).toBeDefined();
    const range = document.createRange();
    range.selectNodeContents(strong as Element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(getSelectionContext()).toEqual({
      selectedText: "demand mining",
      paragraphContext: "Product managers use demand mining to understand users.",
      pageTitle: "Product Notes",
      pageUrl: "http://localhost:3000/"
    });
  });
});
