import { beforeEach, describe, expect, it, vi } from "vitest";

describe("background context menu", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("opens the side panel before awaiting selection capture", async () => {
    const clickListeners: Array<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => Promise<void>> =
      [];
    const openSidePanel = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const setStorage = vi.fn(async () => undefined);

    vi.stubGlobal("chrome", {
      runtime: {
        onInstalled: {
          addListener: vi.fn()
        }
      },
      contextMenus: {
        create: vi.fn(),
        onClicked: {
          addListener: vi.fn((listener) => clickListeners.push(listener))
        }
      },
      storage: {
        local: {
          set: setStorage
        }
      },
      tabs: {
        sendMessage
      },
      sidePanel: {
        open: openSidePanel
      }
    });

    await import("./background");
    await clickListeners[0]!(
      {
        menuItemId: "learn-concept",
        selectionText: " ChapsVision "
      } as chrome.contextMenus.OnClickData,
      {
        id: 12,
        title: "模型新闻",
        url: "https://example.com/news"
      } as chrome.tabs.Tab
    );

    expect(sendMessage).toHaveBeenCalledWith(12, { type: "AI_LEARNING_CAPTURE_SELECTION" });
    expect(setStorage).not.toHaveBeenCalled();
    expect(openSidePanel).toHaveBeenCalledWith({ tabId: 12 });
    expect(openSidePanel.mock.invocationCallOrder[0]!).toBeLessThan(
      sendMessage.mock.invocationCallOrder[0]!
    );
  });

  it("stores a fallback selection when the content script is unavailable", async () => {
    const clickListeners: Array<(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => Promise<void>> =
      [];
    const openSidePanel = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => {
      throw new Error("No receiver");
    });
    const setStorage = vi.fn(async () => undefined);

    vi.stubGlobal("chrome", {
      runtime: {
        onInstalled: {
          addListener: vi.fn()
        }
      },
      contextMenus: {
        create: vi.fn(),
        onClicked: {
          addListener: vi.fn((listener) => clickListeners.push(listener))
        }
      },
      storage: {
        local: {
          set: setStorage
        }
      },
      tabs: {
        sendMessage
      },
      sidePanel: {
        open: openSidePanel
      }
    });

    await import("./background");
    await clickListeners[0]!(
      {
        menuItemId: "learn-concept",
        selectionText: " ChapsVision "
      } as chrome.contextMenus.OnClickData,
      {
        id: 12,
        title: "模型新闻",
        url: "https://example.com/news"
      } as chrome.tabs.Tab
    );

    expect(setStorage).toHaveBeenCalledWith({
      pendingSelection: {
        selectedText: "ChapsVision",
        paragraphContext: "ChapsVision",
        pageTitle: "模型新闻",
        pageUrl: "https://example.com/news"
      }
    });
    expect(openSidePanel.mock.invocationCallOrder[0]!).toBeLessThan(
      setStorage.mock.invocationCallOrder[0]!
    );
  });
});
