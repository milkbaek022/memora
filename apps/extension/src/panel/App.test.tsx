import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { LearningContent } from "@memora/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const selection = {
  selectedText: "demand mining",
  paragraphContext: "Product managers use demand mining.",
  pageTitle: "Notes",
  pageUrl: "https://example.com"
};

interface LearnResultForTests {
  session_id: string;
  remaining_credits: number;
  content: LearningContent;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

let storageChangeListeners: Array<
  (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
> = [];

beforeEach(() => {
  storageChangeListeners = [];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        set: vi.fn(async () => undefined)
      },
      onChanged: {
        addListener: vi.fn((listener) => storageChangeListeners.push(listener)),
        removeListener: vi.fn((listener) => {
          storageChangeListeners = storageChangeListeners.filter((item) => item !== listener);
        })
      }
    }
  });
});

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("activates invite and generates Chinese quick content", async () => {
    const client = {
      activateInvite: vi.fn(async () => ({ token: "token-1", remaining_credits: 5 })),
      learn: vi.fn(async () => ({
        session_id: "session-1",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "demand mining",
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "这个词常出现在产品场景。",
          plain_definition: "需求挖掘就是追问真实问题。",
          simple_example: "用户说想要快马，真实需求是更快到达目的地。",
          example_mapping: "快马是表面需求，目的地是深层需求。"
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken={null} />);

    expect(screen.getByLabelText("记忆药水动态")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("邀请码"), { target: { value: "BETA-001" } });
    fireEvent.click(screen.getByRole("button", { name: "开始学习" }));

    await waitFor(() => expect(screen.getByText("需求挖掘")).toBeInTheDocument());
    expect(screen.getByText("还剩 4 瓶记忆药水")).toBeInTheDocument();
    const explanationCard = screen.getByLabelText("概念解释卡片");
    expect(within(explanationCard).getByText("这个词常出现在产品场景。")).toBeInTheDocument();
    expect(within(explanationCard).getByText("需求挖掘就是追问真实问题。")).toBeInTheDocument();
    expect(
      within(explanationCard).getByText("用户说想要快马，真实需求是更快到达目的地。")
    ).toBeInTheDocument();
    expect(client.learn).toHaveBeenCalledWith({
      selected_text: "demand mining",
      paragraph_context: "Product managers use demand mining.",
      page_title: "Notes",
      page_url: "https://example.com",
      mode: "quick"
    });
  });

  it("shows unlimited memory potions for the main account", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-unlimited",
        remaining_credits: -1,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "parameter count",
          chinese_display_name: "参数数量",
          concept_type: "指标",
          background: "这是文章里用来描述模型规模的指标。",
          plain_definition: "参数数量可以理解为模型内部可调节的知识旋钮数量。",
          simple_example: "就像一本工具书里的条目更多，能覆盖的问题通常也更多。",
          example_mapping: "工具书条目对应模型参数，更多条目不等于一定更聪明，但代表容量更大。"
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(screen.getByText("无限瓶记忆药水")).toBeInTheDocument());
    expect(screen.queryByText("还剩 -1 瓶记忆药水")).not.toBeInTheDocument();
  });

  it("shows invite activation errors inside the invite card", async () => {
    const client = {
      activateInvite: vi.fn(async () => {
        throw new Error("邀请码不存在。");
      }),
      learn: vi.fn(),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken={null} />);

    fireEvent.change(screen.getByLabelText("邀请码"), { target: { value: "NOPE" } });
    fireEvent.click(screen.getByRole("button", { name: "开始学习" }));

    await waitFor(() => expect(screen.getByText("邀请码不存在。")).toBeInTheDocument());
    expect(screen.queryByText("邀请码不存在.")).not.toBeInTheDocument();
  });

  it("shows quiz feedback immediately", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-2",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "demand mining",
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "背景",
          plain_definition: "定义",
          simple_example: "例子",
          example_mapping: "映射",
          key_points: ["要点一", "要点二", "要点三"],
          common_misunderstandings: ["误区一", "误区二"],
          quiz: [
            {
              id: "q1",
              question: "哪项正确？",
              options: [
                { id: "A", text: "整理原话" },
                { id: "B", text: "追问真实问题" },
                { id: "C", text: "直接开发" },
                { id: "D", text: "跳过研究" }
              ],
              correct_option_id: "B",
              explanation: "B 对，因为它关注真实问题。"
            }
          ]
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledWith(expect.objectContaining({ mode: "quick" })));
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    await waitFor(() => expect(screen.getByText("哪项正确？")).toBeInTheDocument());
    expect(screen.getByText("巩固测试")).toBeInTheDocument();
    expect(screen.queryByLabelText("概念解释卡片")).not.toBeInTheDocument();
    expect(screen.queryByText("误区一")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "整理原话" }));

    expect(screen.getByText("B 对，因为它关注真实问题。")).toBeInTheDocument();
  });

  it("submits one Feynman explanation and shows feedback", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-3",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "demand mining",
          chinese_display_name: "需求挖掘",
          concept_type: "方法",
          background: "背景",
          plain_definition: "定义",
          simple_example: "例子",
          example_mapping: "映射",
          key_points: ["要点一", "要点二", "要点三"],
          common_misunderstandings: ["误区一", "误区二"],
          quiz: [],
          feynman_prompt: "请用自己的话讲给朋友听。",
          expected_explanation_points: ["说明真实目标", "区分表面说法", "举一个生活例子"]
        }
      })),
      submitFeynmanFeedback: vi.fn(async () => ({
        feedback: {
          understanding_score: 88,
          what_is_clear: "你讲清楚了表面需求和真实需求的区别。",
          missing_or_wrong: "还可以补充如何继续追问。",
          better_explanation: "可以说它是从用户原话里追问真实目标的方法。",
          next_question: "如果用户说想要导出按钮，你会怎么继续问？"
        }
      }))
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledWith(expect.objectContaining({ mode: "quick" })));
    fireEvent.click(screen.getByRole("button", { name: "深度理解" }));
    await waitFor(() => expect(screen.getByText("请用自己的话讲给朋友听。")).toBeInTheDocument());
    expect(screen.getByText("费曼学习")).toBeInTheDocument();
    expect(screen.getByText("可以讲到")).toBeInTheDocument();
    expect(screen.queryByLabelText("概念解释卡片")).not.toBeInTheDocument();
    expect(screen.queryByText("理解小测")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("你的解释"), {
      target: { value: "需求挖掘就是追问用户真正想完成什么。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交解释" }));

    await waitFor(() => expect(screen.getByText("88 分")).toBeInTheDocument());
    expect(screen.getByText("你讲清楚了表面需求和真实需求的区别。")).toBeInTheDocument();
    expect(client.submitFeynmanFeedback).toHaveBeenCalledWith({
      session_id: "session-3",
      user_explanation: "需求挖掘就是追问用户真正想完成什么。"
    });
  });

  it("does not retry automatic quick generation after a failure", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => {
        throw new Error("AI 生成失败，请稍后重试。");
      }),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(screen.getByText("AI 生成失败，请稍后重试。")).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client.learn).toHaveBeenCalledTimes(1);
  });

  it("shows a concept selection card when no selected text is available", () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={null} initialToken="token-1" />);

    const emptyCard = screen.getByLabelText("选择概念提示卡片");
    expect(within(emptyCard).getByText("先在网页中选中一个词或概念")).toBeInTheDocument();
    expect(emptyCard).toHaveTextContent("右键点击“学习这个概念”");
    expect(client.learn).not.toHaveBeenCalled();
  });

  it("generates content when a new concept is captured while the panel is already open", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-live",
        remaining_credits: 4,
        content: {
          concept_validity: { is_valid: true, reason: "这是概念。" },
          original_term: "ChapsVision",
          chinese_display_name: "ChapsVision",
          concept_type: "公司名",
          background: "这是文章里提到的一家公司。",
          plain_definition: "这里指一个欧洲企业名称。",
          simple_example: "就像新闻里提到某家公司，先识别它是谁，再理解上下文。",
          example_mapping: "名字本身不是方法，而是文章讨论对象。"
        }
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={null} initialToken="token-1" />);

    act(() => {
      storageChangeListeners[0]?.(
        {
          pendingSelection: {
            newValue: {
              selectedText: "ChapsVision",
              paragraphContext: "ChapsVision 等欧洲企业，也开始混用模型。",
              pageTitle: "模型新闻",
              pageUrl: "https://example.com/news"
            }
          }
        },
        "local"
      );
    });

    await waitFor(() =>
      expect(client.learn).toHaveBeenCalledWith({
        selected_text: "ChapsVision",
        paragraph_context: "ChapsVision 等欧洲企业，也开始混用模型。",
        page_title: "模型新闻",
        page_url: "https://example.com/news",
        mode: "quick"
      })
    );
    expect(screen.getByLabelText("概念解释卡片")).toHaveTextContent("这里指一个欧洲企业名称。");
  });

  it("does not regenerate the active mode", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi.fn(async () => ({
        session_id: "session-4",
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
      })),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "大概了解" }));

    expect(client.learn).toHaveBeenCalledTimes(1);
  });

  it("shows only the target mode loading state while uncached content is generated", async () => {
    const deepGeneration = deferred<LearnResultForTests>();
    const client = {
      activateInvite: vi.fn(),
      learn: vi
        .fn()
        .mockResolvedValueOnce({
          session_id: "session-quick",
          remaining_credits: 4,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "demand mining",
            chinese_display_name: "需求挖掘",
            concept_type: "方法",
            background: "快速背景",
            plain_definition: "快速定义",
            simple_example: "快速例子",
            example_mapping: "快速映射"
          }
        })
        .mockImplementationOnce(() => deepGeneration.promise),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(screen.getByText("快速定义")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    expect(screen.getByRole("button", { name: "深入理解" })).toHaveClass("active");
    expect(screen.getByText("正在生成深入理解...")).toBeInTheDocument();
    expect(screen.queryByLabelText("概念解释卡片")).not.toBeInTheDocument();
    expect(screen.queryByText("快速定义")).not.toBeInTheDocument();

    deepGeneration.resolve({
      session_id: "session-deep",
      remaining_credits: 3,
      content: {
        concept_validity: { is_valid: true, reason: "这是概念。" },
        original_term: "demand mining",
        chinese_display_name: "需求挖掘",
        concept_type: "方法",
        background: "深入背景",
        plain_definition: "深入定义",
        simple_example: "深入例子",
        example_mapping: "深入映射",
        key_points: ["要点一", "要点二", "要点三"],
        common_misunderstandings: ["误区一", "误区二"],
        quiz: [
          {
            id: "q1",
            question: "深入题？",
            options: [
              { id: "A", text: "选项 A" },
              { id: "B", text: "选项 B" },
              { id: "C", text: "选项 C" },
              { id: "D", text: "选项 D" }
            ],
            correct_option_id: "B",
            explanation: "解释"
          }
        ]
      }
    });
  });

  it("reuses cached mode content when switching tabs without changing concept", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi
        .fn()
        .mockResolvedValueOnce({
          session_id: "session-cached-quick",
          remaining_credits: 4,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "demand mining",
            chinese_display_name: "需求挖掘",
            concept_type: "方法",
            background: "快速背景",
            plain_definition: "快速定义",
            simple_example: "快速例子",
            example_mapping: "快速映射"
          }
        })
        .mockResolvedValueOnce({
          session_id: "session-cached-deep",
          remaining_credits: 3,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "demand mining",
            chinese_display_name: "需求挖掘",
            concept_type: "方法",
            background: "深入背景",
            plain_definition: "深入定义",
            simple_example: "深入例子",
            example_mapping: "深入映射",
            key_points: ["要点一", "要点二", "要点三"],
            common_misunderstandings: ["误区一", "误区二"],
            quiz: [
              {
                id: "q1",
                question: "缓存题？",
                options: [
                  { id: "A", text: "旧答案 A" },
                  { id: "B", text: "旧答案 B" },
                  { id: "C", text: "旧答案 C" },
                  { id: "D", text: "旧答案 D" }
                ],
                correct_option_id: "B",
                explanation: "缓存解释"
              }
            ]
          }
        }),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(screen.getByText("快速定义")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    await waitFor(() => expect(screen.getByText("缓存题？")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "大概了解" }));

    expect(screen.getByLabelText("概念解释卡片")).toHaveTextContent("快速定义");
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    expect(screen.getByText("缓存题？")).toBeInTheDocument();
    expect(client.learn).toHaveBeenCalledTimes(2);
  });

  it("keeps the requested mode active and hides previous content when a mode switch fails", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi
        .fn()
        .mockResolvedValueOnce({
          session_id: "session-5",
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
        })
        .mockRejectedValueOnce(new Error("AI 生成失败，请稍后重试。")),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    await waitFor(() => expect(screen.getByText("AI 生成失败，请稍后重试。")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "深入理解" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "大概了解" })).not.toHaveClass("active");
    expect(screen.queryByLabelText("概念解释卡片")).not.toBeInTheDocument();
  });

  it("clears generated mode caches when a new concept is captured", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi
        .fn()
        .mockResolvedValueOnce({
          session_id: "session-6",
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
        })
        .mockResolvedValueOnce({
          session_id: "session-7",
          remaining_credits: 3,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "demand mining",
            chinese_display_name: "需求挖掘",
            concept_type: "方法",
            background: "背景",
            plain_definition: "定义",
            simple_example: "例子",
            example_mapping: "映射",
            key_points: ["要点一", "要点二", "要点三"],
            common_misunderstandings: ["误区一"],
            quiz: [
              {
                id: "q1",
                question: "深入题？",
                options: [
                  { id: "A", text: "旧答案 A" },
                  { id: "B", text: "旧答案 B" }
                ],
            correct_option_id: "B",
            explanation: "深入解释"
          }
        ]
      }
        })
        .mockResolvedValueOnce({
          session_id: "session-9",
          remaining_credits: 1,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "ChapsVision",
            chinese_display_name: "ChapsVision",
            concept_type: "公司名",
            background: "新背景",
            plain_definition: "新定义",
            simple_example: "新例子",
            example_mapping: "新映射"
          }
        }),
      submitFeynmanFeedback: vi.fn()
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "深入理解" }));

    await waitFor(() => expect(screen.getByText("深入题？")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "旧答案 A" }));
    expect(screen.getByText("深入解释")).toBeInTheDocument();

    act(() => {
      storageChangeListeners[0]?.(
        {
          pendingSelection: {
            newValue: {
              selectedText: "ChapsVision",
              paragraphContext: "ChapsVision 等欧洲企业，也开始混用模型。",
              pageTitle: "模型新闻",
              pageUrl: "https://example.com/news"
            }
          }
        },
        "local"
      );
    });

    await waitFor(() => expect(screen.getByText("新定义")).toBeInTheDocument());
    expect(screen.queryByText("深入题？")).not.toBeInTheDocument();
    expect(screen.queryByText("深入解释")).not.toBeInTheDocument();
  });

  it("supports three Feynman feedback rounds before closing the form", async () => {
    const client = {
      activateInvite: vi.fn(),
      learn: vi
        .fn()
        .mockResolvedValueOnce({
          session_id: "session-feynman-quick",
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
        })
        .mockResolvedValueOnce({
          session_id: "session-feynman-mastery",
          remaining_credits: 3,
          content: {
            concept_validity: { is_valid: true, reason: "这是概念。" },
            original_term: "demand mining",
            chinese_display_name: "需求挖掘",
            concept_type: "方法",
            background: "背景",
            plain_definition: "定义",
            simple_example: "例子",
            example_mapping: "映射",
            key_points: ["要点一", "要点二", "要点三"],
            common_misunderstandings: ["误区一", "误区二"],
            quiz: [
              {
                id: "q1",
                question: "题目？",
                options: [
                  { id: "A", text: "A" },
                  { id: "B", text: "B" },
                  { id: "C", text: "C" },
                  { id: "D", text: "D" }
                ],
                correct_option_id: "B",
                explanation: "解释"
              }
            ],
            feynman_prompt: "请用自己的话讲给朋友听。",
            expected_explanation_points: ["说明真实目标", "区分表面说法", "举一个生活例子"]
          }
        }),
      submitFeynmanFeedback: vi
        .fn()
        .mockResolvedValueOnce({
          feedback: {
            understanding_score: 40,
            what_is_clear: "第一轮清楚点",
            missing_or_wrong: "第一轮缺口",
            better_explanation: "第一轮改写",
            next_question: "第二轮问题？"
          }
        })
        .mockResolvedValueOnce({
          feedback: {
            understanding_score: 70,
            what_is_clear: "第二轮清楚点",
            missing_or_wrong: "第二轮缺口",
            better_explanation: "第二轮改写",
            next_question: "第三轮问题？"
          }
        })
        .mockResolvedValueOnce({
          feedback: {
            understanding_score: 92,
            what_is_clear: "第三轮清楚点",
            missing_or_wrong: "第三轮缺口",
            better_explanation: "第三轮改写",
            next_question: "已经可以收束。"
          }
        })
    };

    render(<App apiClient={client} initialSelection={selection} initialToken="token-1" />);

    await waitFor(() => expect(client.learn).toHaveBeenCalledWith(expect.objectContaining({ mode: "quick" })));
    fireEvent.click(screen.getByRole("button", { name: "深度理解" }));
    await waitFor(() => expect(screen.getByText("请用自己的话讲给朋友听。")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("你的解释"), { target: { value: "第一轮解释" } });
    fireEvent.click(screen.getByRole("button", { name: "提交解释" }));
    await waitFor(() => expect(screen.getByText("40 分")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("你的解释"), { target: { value: "第二轮解释" } });
    fireEvent.click(screen.getByRole("button", { name: "提交解释" }));
    await waitFor(() => expect(screen.getByText("70 分")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("你的解释"), { target: { value: "第三轮解释" } });
    fireEvent.click(screen.getByRole("button", { name: "提交解释" }));

    await waitFor(() => expect(screen.getByText("92 分")).toBeInTheDocument());
    expect(screen.getByText("40 分")).toBeInTheDocument();
    expect(screen.getByText("70 分")).toBeInTheDocument();
    expect(screen.queryByLabelText("你的解释")).not.toBeInTheDocument();
    expect(client.submitFeynmanFeedback).toHaveBeenCalledTimes(3);
  });
});
