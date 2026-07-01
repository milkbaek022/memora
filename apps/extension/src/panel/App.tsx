import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeepContent,
  FeynmanFeedback,
  LearningContent,
  LearningMode,
  LearnRequest,
  MasteryContent
} from "@memora/shared";
import type { SelectionContext } from "../contentScript";
import { parseSelectionContext, saveLearningSession } from "../lib/sessionStore";
import { ErrorNotice } from "./components/ErrorNotice";
import { FeynmanBox } from "./components/FeynmanBox";
import { InviteGate } from "./components/InviteGate";
import { LearningContentView } from "./components/LearningContentView";
import { ModeTabs } from "./components/ModeTabs";
import { QuizView } from "./components/QuizView";

interface ApiClientLike {
  activateInvite(code: string): Promise<{ token: string; remaining_credits: number }>;
  learn(request: LearnRequest): Promise<{
    session_id: string;
    remaining_credits: number;
    content: LearningContent;
  }>;
  submitFeynmanFeedback(request: {
    session_id: string;
    user_explanation: string;
  }): Promise<{ feedback: FeynmanFeedback }>;
}

interface AppProps {
  apiClient: ApiClientLike;
  initialSelection: SelectionContext | null;
  initialToken: string | null;
}

interface ModeCacheEntry {
  sessionId: string;
  content: LearningContent;
  feedbacks: FeynmanFeedback[];
}

const MODE_LABELS: Record<LearningMode, string> = {
  quick: "大概了解",
  deep: "深入理解",
  mastery: "深度理解"
};

const UNLIMITED_INVITE_CREDITS = -1;

function formatQuota(remainingCredits: number | null): string {
  if (remainingCredits === UNLIMITED_INVITE_CREDITS) {
    return "无限瓶记忆药水";
  }
  return `还剩 ${remainingCredits ?? "-"} 瓶记忆药水`;
}

function hasQuiz(content: LearningContent): content is DeepContent | MasteryContent {
  return "quiz" in content;
}

function hasFeynmanPrompt(content: LearningContent): content is MasteryContent {
  return "feynman_prompt" in content;
}

export function App({ apiClient, initialSelection, initialToken }: AppProps) {
  const [tokenReady, setTokenReady] = useState(Boolean(initialToken));
  const [selection, setSelection] = useState<SelectionContext | null>(initialSelection);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [mode, setMode] = useState<LearningMode>("quick");
  const [modeCache, setModeCache] = useState<Partial<Record<LearningMode, ModeCacheEntry>>>({});
  const [loadingMode, setLoadingMode] = useState<LearningMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoGenerateAttempted, setAutoGenerateAttempted] = useState(false);
  const activeEntry = modeCache[mode] ?? null;
  const activeContent = activeEntry?.content ?? null;
  const loading = loadingMode === mode;

  const emptyState = useMemo(() => {
    if (activeContent || loading) return null;
    if (!selection?.selectedText) {
      return {
        title: "先在网页中选中一个词或概念",
        body: "选中文字后，右键点击“学习这个概念”，Memora 会把它带到这里。"
      };
    }
    if (remainingCredits === 0) {
      return {
        title: "这张邀请码的记忆药水用完了",
        body: "当前概念已经准备好，但需要新的记忆药水才能生成学习内容。"
      };
    }
    return null;
  }, [activeContent, loading, remainingCredits, selection]);

  async function activateInvite(code: string) {
    setError(null);
    try {
      const response = await apiClient.activateInvite(code);
      setTokenReady(true);
      setRemainingCredits(response.remaining_credits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "邀请码验证失败，请稍后重试。");
    }
  }

  const generate = useCallback(
    async (nextMode: LearningMode = mode) => {
      setMode(nextMode);
      if (modeCache[nextMode]) {
        return;
      }
      if (!selection?.selectedText) {
        setError("请先在网页中选中一个概念。");
        return;
      }
      if (remainingCredits === 0) {
        setError("记忆药水已用完。");
        return;
      }

      setLoadingMode(nextMode);
      setError(null);
      try {
        const response = await apiClient.learn({
          selected_text: selection.selectedText,
          paragraph_context: selection.paragraphContext,
          page_title: selection.pageTitle,
          page_url: selection.pageUrl,
          mode: nextMode
        });
        setRemainingCredits(response.remaining_credits);
        setModeCache((currentCache) => ({
          ...currentCache,
          [nextMode]: {
            sessionId: response.session_id,
            content: response.content,
            feedbacks: []
          }
        }));
        await saveLearningSession({
          sessionId: response.session_id,
          remainingCredits: response.remaining_credits,
          mode: nextMode,
          content: response.content
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
      } finally {
        setLoadingMode((currentMode) => (currentMode === nextMode ? null : currentMode));
      }
    },
    [apiClient, mode, modeCache, remainingCredits, selection]
  );

  async function changeMode(nextMode: LearningMode) {
    if (nextMode === mode) {
      return;
    }
    await generate(nextMode);
  }

  async function submitExplanation(userExplanation: string) {
    if (mode !== "mastery" || !activeEntry) return;
    const sessionId = activeEntry.sessionId;
    setError(null);
    try {
      const response = await apiClient.submitFeynmanFeedback({
        session_id: sessionId,
        user_explanation: userExplanation.trim()
      });
      setModeCache((currentCache) => {
        const entry = currentCache.mastery;
        if (!entry || entry.sessionId !== sessionId) {
          return currentCache;
        }
        return {
          ...currentCache,
          mastery: {
            ...entry,
            feedbacks: [...entry.feedbacks, response.feedback]
          }
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "反馈生成失败，请稍后重试。");
    }
  }

  useEffect(() => {
    if (
      tokenReady &&
      selection?.selectedText &&
      !modeCache.quick &&
      remainingCredits !== 0 &&
      loadingMode === null &&
      !autoGenerateAttempted
    ) {
      setAutoGenerateAttempted(true);
      void generate("quick");
    }
  }, [
    autoGenerateAttempted,
    generate,
    loadingMode,
    modeCache.quick,
    remainingCredits,
    selection,
    tokenReady
  ]);

  useEffect(() => {
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;
      const nextSelection = parseSelectionContext(changes.pendingSelection?.newValue);
      if (!nextSelection?.selectedText) return;

      setSelection(nextSelection);
      setMode("quick");
      setModeCache({});
      setLoadingMode(null);
      setError(null);
      setAutoGenerateAttempted(false);
    };

    chrome.storage?.onChanged?.addListener(onStorageChanged);
    return () => chrome.storage?.onChanged?.removeListener(onStorageChanged);
  }, []);

  if (!tokenReady) {
    return <InviteGate error={error} onSubmit={activateInvite} />;
  }

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Memora 记忆药水</p>
          <h1>{activeContent?.chinese_display_name || selection?.selectedText || "选择一个概念"}</h1>
        </div>
        <span className="quota-pill">{formatQuota(remainingCredits)}</span>
      </header>

      <ModeTabs
        value={mode}
        onChange={changeMode}
        disabled={loadingMode !== null || !selection?.selectedText}
      />

      {error && <ErrorNotice message={error} />}
      {loading && <div className="skeleton">正在生成{MODE_LABELS[mode]}...</div>}
      {activeContent && mode === "quick" && <LearningContentView content={activeContent} />}
      {activeContent && mode === "deep" && hasQuiz(activeContent) && (
        <QuizView questions={activeContent.quiz} />
      )}
      {activeContent && mode === "mastery" && hasFeynmanPrompt(activeContent) && (
        <FeynmanBox
          prompt={activeContent.feynman_prompt}
          expectedPoints={activeContent.expected_explanation_points}
          feedbacks={activeEntry?.feedbacks ?? []}
          onSubmit={submitExplanation}
        />
      )}
      {emptyState && <EmptyStateCard title={emptyState.title} body={emptyState.body} />}
    </main>
  );
}

function EmptyStateCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-card" aria-label="选择概念提示卡片">
      <span>下一步</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
