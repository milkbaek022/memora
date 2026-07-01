export interface SelectionContext {
  selectedText: string;
  paragraphContext: string;
  pageTitle: string;
  pageUrl: string;
}

export function normalizeSelectedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function findNearestParagraphText(node: Node | null): string {
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element) {
      const paragraph = current.closest("p, article, section, main, li, blockquote");
      if (paragraph?.textContent) {
        return normalizeSelectedText(paragraph.textContent).slice(0, 3000);
      }
    }
    current = current.parentNode;
  }
  return "";
}

export function getSelectionContext(): SelectionContext {
  const selection = window.getSelection();
  const selectedText = normalizeSelectedText(selection?.toString() ?? "");
  const anchorNode = selection?.anchorNode ?? null;
  const anchorElement =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;

  return {
    selectedText,
    paragraphContext: findNearestParagraphText(anchorElement),
    pageTitle: document.title,
    pageUrl: window.location.href
  };
}

function registerSelectionCaptureListener(): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    return;
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (
      typeof message === "object" &&
      message !== null &&
      (message as { type?: unknown }).type === "AI_LEARNING_CAPTURE_SELECTION"
    ) {
      chrome.storage.local.set({ pendingSelection: getSelectionContext() }).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
    return false;
  });
}

registerSelectionCaptureListener();
