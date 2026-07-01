import type { LearningContent, LearningMode } from "@memora/shared";
import type { SelectionContext } from "../contentScript";

const TOKEN_KEY = "accessToken";
const PENDING_SELECTION_KEY = "pendingSelection";
const CURRENT_LEARNING_SESSION_KEY = "currentLearningSession";

export interface StoredLearningSession {
  sessionId: string;
  remainingCredits: number;
  mode: LearningMode;
  content: LearningContent;
}

function isSelectionContext(value: unknown): value is SelectionContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const selection = value as Partial<Record<keyof SelectionContext, unknown>>;
  return (
    typeof selection.selectedText === "string" &&
    typeof selection.paragraphContext === "string" &&
    typeof selection.pageTitle === "string" &&
    typeof selection.pageUrl === "string"
  );
}

export function parseSelectionContext(value: unknown): SelectionContext | null {
  return isSelectionContext(value) ? value : null;
}

export async function loadToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return typeof result[TOKEN_KEY] === "string" ? result[TOKEN_KEY] : null;
}

export async function saveToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function loadPendingSelection(): Promise<SelectionContext | null> {
  const result = await chrome.storage.local.get(PENDING_SELECTION_KEY);
  return parseSelectionContext(result[PENDING_SELECTION_KEY]);
}

export async function saveLearningSession(session: StoredLearningSession): Promise<void> {
  await chrome.storage.local.set({ [CURRENT_LEARNING_SESSION_KEY]: session });
}
