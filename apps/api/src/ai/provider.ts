import type { FeynmanFeedback, LearningContent, LearningMode } from "@memora/shared";

export interface LearningGenerationInput {
  selectedText: string;
  paragraphContext: string;
  pageTitle: string;
  pageUrl: string;
  mode: LearningMode;
}

export interface FeynmanGenerationInput {
  originalTerm: string;
  chineseDisplayName: string;
  userExplanation: string;
  expectedPoints: string[];
}

export interface AiProvider {
  generateLearningContent(input: LearningGenerationInput): Promise<LearningContent>;
  generateFeynmanFeedback(input: FeynmanGenerationInput): Promise<FeynmanFeedback>;
}
