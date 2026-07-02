import type { FeynmanFeedback, LearningContent, QuizQuestion } from "@memora/shared";
import type { AiProvider, FeynmanGenerationInput, LearningGenerationInput } from "./provider.js";

const demandMiningQuiz: QuizQuestion[] = [
  {
    id: "q1",
    question: "以下哪一种最接近这个概念的意思？",
    options: [
      { id: "A", text: "把用户原话整理成列表" },
      { id: "B", text: "继续追问背后的真实问题" },
      { id: "C", text: "尽快做出用户说的功能" },
      { id: "D", text: "把所有需求都交给研发判断" }
    ],
    correct_option_id: "B",
    explanation: "B 对，因为这个概念关注表面表达背后的真实目标。"
  },
  {
    id: "q2",
    question: "用户说想要一匹更快的马，这时更好的追问方向是什么？",
    options: [
      { id: "A", text: "你想更快到哪里，为什么现在慢？" },
      { id: "B", text: "你想要什么颜色的马？" },
      { id: "C", text: "你能接受多贵的马鞍？" },
      { id: "D", text: "你是否已经决定必须买马？" }
    ],
    correct_option_id: "A",
    explanation: "A 对，因为它追问的是到达目的地这个真实目标，而不是马本身。"
  },
  {
    id: "q3",
    question: "哪一种做法最容易落入这个概念的误区？",
    options: [
      { id: "A", text: "确认用户说法背后的目标" },
      { id: "B", text: "比较不同方案能否解决同一目标" },
      { id: "C", text: "直接把用户原话当成最终需求" },
      { id: "D", text: "用简单例子复述自己的理解" }
    ],
    correct_option_id: "C",
    explanation: "C 错在停留在表面表达，没有继续识别真实问题。"
  },
  {
    id: "q4",
    question: "如果真实需求是更快到达目的地，下面哪个方案更符合需求挖掘思路？",
    options: [
      { id: "A", text: "只训练一匹更快的马" },
      { id: "B", text: "比较车、公交、路线优化等方案" },
      { id: "C", text: "要求用户别再改变想法" },
      { id: "D", text: "先把马的外观设计做好" }
    ],
    correct_option_id: "B",
    explanation: "B 对，因为它围绕真实目标寻找更合适方案，而不是被原话限制住。"
  },
  {
    id: "q5",
    question: "判断一个需求是否被挖掘充分，最重要的依据是什么？",
    options: [
      { id: "A", text: "用户是否说了很多功能名字" },
      { id: "B", text: "方案是否足够新奇复杂" },
      { id: "C", text: "团队是否已经开始开发" },
      { id: "D", text: "是否说清了用户真正想达成的结果" }
    ],
    correct_option_id: "D",
    explanation: "D 对，因为需求挖掘的重点是理解真实结果，再决定解决方案。"
  }
];

export class MockAiProvider implements AiProvider {
  async generateLearningContent(input: LearningGenerationInput): Promise<LearningContent> {
    const quick = {
      concept_validity: { is_valid: true, reason: "这是一个值得解释的概念。" },
      original_term: input.selectedText,
      chinese_display_name:
        input.selectedText === "demand mining" ? "需求挖掘" : input.selectedText,
      concept_type: "方法",
      background:
        "这个词常出现在产品、学习或工作分析场景中，用来帮助人们看清表面说法背后的真实问题。",
      plain_definition: "它指的是继续追问表面说法背后的真实目标。",
      simple_example:
        "用户说想要一匹更快的马，但真实需求可能是更快到达目的地，所以车可能是更好的方案。",
      example_mapping:
        "快马是表面需求，更快到达目的地是真实需求，车是围绕真实需求找到的新方案。"
    };

    if (input.mode === "quick") return quick;

    const deep = {
      ...quick,
      key_points: ["不要停在用户原话", "继续追问真实目标", "围绕真实目标找更合适方案"],
      common_misunderstandings: ["把用户说的话当成最终答案", "只关注功能而忽略真实问题"],
      quiz: demandMiningQuiz
    };

    if (input.mode === "deep") return deep;

    return {
      ...deep,
      feynman_prompt: "请你用自己的话解释这个概念，就像讲给一个刚入门的朋友听。",
      expected_explanation_points: [
        "说明它解决什么问题",
        "区分表面说法和真实需求",
        "用一个简单例子讲清楚"
      ]
    };
  }

  async generateFeynmanFeedback(_input: FeynmanGenerationInput): Promise<FeynmanFeedback> {
    return {
      understanding_score: 82,
      what_is_clear: "你已经讲清楚了它不是照抄用户原话。",
      missing_or_wrong: "还可以补充如何通过追问找到真实目标。",
      better_explanation:
        "这个概念就是从用户表面说法里继续追问，找到真正要解决的问题，再寻找更合适的方案。",
      next_question: "如果用户说想要一个按钮，你会怎么判断他真正想完成什么？"
    };
  }
}
