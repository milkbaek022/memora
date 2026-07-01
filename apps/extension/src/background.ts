const MENU_ID = "learn-concept";
const CAPTURE_SELECTION_MESSAGE = { type: "AI_LEARNING_CAPTURE_SELECTION" };

function buildFallbackSelection(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  const selectedText = info.selectionText?.replace(/\s+/g, " ").trim();
  if (!selectedText) return null;

  return {
    selectedText,
    paragraphContext: selectedText,
    pageTitle: tab.title ?? "",
    pageUrl: tab.url ?? ""
  };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "学习这个概念",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;

  await chrome.sidePanel.open({ tabId: tab.id });

  try {
    await chrome.tabs.sendMessage(tab.id, CAPTURE_SELECTION_MESSAGE);
  } catch {
    const fallbackSelection = buildFallbackSelection(info, tab);
    if (fallbackSelection) {
      await chrome.storage.local.set({ pendingSelection: fallbackSelection });
    }
  }
});

export {};
