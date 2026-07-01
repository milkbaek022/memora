import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadPendingSelection,
  loadToken,
  saveLearningSession,
  saveToken
} from "./sessionStore";

const storage: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.map((key) => [key, storage[key]]));
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        })
      }
    }
  });
});

describe("sessionStore", () => {
  it("saves and loads token", async () => {
    await saveToken("abc");
    await expect(loadToken()).resolves.toBe("abc");
  });

  it("returns null when token is missing", async () => {
    await expect(loadToken()).resolves.toBeNull();
  });

  it("loads pending selection", async () => {
    storage.pendingSelection = {
      selectedText: "demand mining",
      paragraphContext: "paragraph",
      pageTitle: "title",
      pageUrl: "https://example.com"
    };

    await expect(loadPendingSelection()).resolves.toMatchObject({
      selectedText: "demand mining"
    });
  });

  it("returns null when pending selection shape is invalid", async () => {
    storage.pendingSelection = { selectedText: "demand mining" };

    await expect(loadPendingSelection()).resolves.toBeNull();
  });

  it("saves the current learning session", async () => {
    await saveLearningSession({
      sessionId: "session-1",
      remainingCredits: 4,
      mode: "quick",
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
    });

    expect(storage.currentLearningSession).toMatchObject({
      sessionId: "session-1",
      remainingCredits: 4
    });
  });
});
