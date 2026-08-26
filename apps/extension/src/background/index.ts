import { AmazonNotebookClient, type SyncCacheMap } from "./amazon-client.js";
import { NotionDirectClient, type NotionFieldMapping } from "./notion-direct-client.js";

export interface StandaloneConfig {
  notionApiKey: string;
  notionParentPageId: string;
  booksDbId?: string;
  highlightsDbId?: string;
  amazonDomain: string;
  autoSyncIntervalMinutes: number; // 0 = disabled, 60 = 1h, 360 = 6h, 720 = 12h, 1440 = 24h
  fieldMapping?: NotionFieldMapping;
}

const DEFAULT_CONFIG: StandaloneConfig = {
  notionApiKey: "",
  notionParentPageId: "",
  amazonDomain: "read.amazon.com",
  autoSyncIntervalMinutes: 360, // 6 hours default
  fieldMapping: {
    bookTitleField: "Title",
    bookAuthorField: "Author",
    bookAsinField: "ASIN",
    bookUrlField: "Kindle URL",
    bookLastAnnotatedField: "Last Annotated",
    highlightTitleField: "Name",
    highlightBookRelationField: "Book",
    highlightQuoteField: "Quote",
    highlightNoteField: "Kindle Note",
    highlightLocationField: "Location",
    highlightPageField: "Page",
    highlightChapterField: "Chapter",
    highlightColorField: "Color",
    highlightImportanceField: "Importance",
    highlightStatusField: "Process Status",
    highlightInterpretationField: "My Interpretation",
  },
};

async function getConfig(): Promise<StandaloneConfig> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get("hakim_standalone_config");
    return (data["hakim_standalone_config"] as StandaloneConfig) || DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

async function setConfig(config: Partial<StandaloneConfig>): Promise<void> {
  const current = await getConfig();
  const updated = { ...current, ...config };
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ hakim_standalone_config: updated });
  }

  // Update alarms if autoSyncIntervalMinutes was changed
  if (config.autoSyncIntervalMinutes !== undefined) {
    await setupAlarms(updated.autoSyncIntervalMinutes);
  }
}

async function setupAlarms(intervalMinutes: number) {
  if (typeof chrome === "undefined" || !chrome.alarms) return;

  await chrome.alarms.clear("hakim_notion_sync");
  if (intervalMinutes > 0) {
    chrome.alarms.create("hakim_notion_sync", {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes,
    });
  }
}

function broadcastProgress(label: string, percent: number) {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: "SYNC_PROGRESS",
      label,
      percent,
    }).catch(() => {
      // Popup may not be open, safe to ignore
    });
  }
}

function setBadge(text: string, color: string) {
  if (typeof chrome !== "undefined" && chrome.action) {
    chrome.action.setBadgeText({ text });
    if (color) {
      chrome.action.setBadgeBackgroundColor({ color });
    }
  }
}

export async function performDirectNotionSync(
  isBackground = false,
  forceFullSync = false
): Promise<{ success: boolean; message: string }> {
  try {
    const config = await getConfig();

    if (!config.notionApiKey || !config.notionApiKey.trim()) {
      return { success: false, message: "Missing Notion Secret. Please paste your secret in Configuration below." };
    }

    if (!config.notionParentPageId || !config.notionParentPageId.trim()) {
      return {
        success: false,
        message: "Missing Notion Page URL / ID. Paste your Notion page URL in Configuration below.",
      };
    }

    if (isBackground) {
      setBadge("SYNC", "#6366f1");
    }

    const notion = new NotionDirectClient(config.notionApiKey, config.fieldMapping);
    const amazon = new AmazonNotebookClient(config.amazonDomain);

    // 1. Verify Notion connection
    broadcastProgress("Connecting to Notion Workspace...", 10);
    const notionTest = await notion.testConnection();
    if (!notionTest.valid) {
      if (isBackground) setBadge("!", "#f43f5e");
      return { success: false, message: `Notion Error: ${notionTest.error}` };
    }

    // 2. Ensure Databases are provisioned (auto-create if missing)
    let booksDbId = config.booksDbId;
    let highlightsDbId = config.highlightsDbId;

    if (!booksDbId || !highlightsDbId) {
      broadcastProgress("Creating Books & Highlights databases in Notion...", 20);
      const prov = await notion.provisionDatabases(config.notionParentPageId);
      booksDbId = prov.booksDbId;
      highlightsDbId = prov.highlightsDbId;
      await setConfig({ booksDbId, highlightsDbId });
    } else {
      // Verify reciprocal two-way database relations exist on existing databases
      await notion.ensureDatabaseRelations(booksDbId, highlightsDbId);
    }

    // 3. Verify Amazon Session
    broadcastProgress("Checking Kindle Amazon session...", 30);
    const session = await amazon.checkSession();
    if (!session.loggedIn) {
      if (isBackground) setBadge("!", "#f59e0b");
      return {
        success: false,
        message: `Amazon Kindle session not active. Please open https://${config.amazonDomain || "read.amazon.com"} in your browser, log in, and click Sync again.`,
      };
    }

    // 4. Load Sync Cache for fast re-syncs
    let syncCache: SyncCacheMap = {};
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const cacheData = await chrome.storage.local.get("hakim_sync_cache");
      syncCache = (cacheData["hakim_sync_cache"] as SyncCacheMap) || {};
    }

    // If manual sync is clicked, force full scan so user's fresh/reset DB is populated!
    const shouldForceScan = forceFullSync || !isBackground;

    // 5. Fetch all real books and their highlights from Kindle Cloud
    broadcastProgress("Discovering books in your Kindle library...", 40);
    const books = await amazon.fetchAllLibrary(
      (bookTitle, current, total) => {
        const pct = Math.min(65, Math.round(40 + (current / total) * 25));
        broadcastProgress(`Fetching: "${bookTitle}" (${current}/${total})...`, pct);
      },
      syncCache,
      shouldForceScan
    );

    if (books.length === 0) {
      if (isBackground) setBadge("", "");
      return {
        success: true,
        message: "Kindle library up to date! All highlights are already synchronized to Notion.",
      };
    }

    // 6. Query existing books in Notion
    broadcastProgress("Comparing with existing Notion library...", 70);
    const existingBooksMap = await notion.queryExistingBooks(booksDbId);

    let totalNewHighlights = 0;
    let totalUpdatedHighlights = 0;
    let booksSynced = 0;

    for (let i = 0; i < books.length; i++) {
      const book = books[i]!;
      const pct = Math.min(95, Math.round(70 + ((i + 1) / books.length) * 25));
      broadcastProgress(`Syncing "${book.sourceTitle}" (${book.annotations.length} highlights)...`, pct);

      const existingBookPageId =
        (book.asin ? existingBooksMap.get(book.asin) : undefined) ||
        existingBooksMap.get(book.sourceTitle.toLowerCase());

      const bookPageId = await notion.upsertBook(booksDbId, book, existingBookPageId);
      booksSynced++;

      // Sync highlight quotes directly into the Book page body in Notion
      await notion.syncBookPageContent(bookPageId, book);

      // Query existing highlights for this book to avoid duplicates & protect user notes
      const existingHighlightsMap = await notion.queryExistingHighlightsForBook(highlightsDbId, bookPageId);

      for (const annot of book.annotations) {
        const annotKey = `${annot.locationStart || 0}:${annot.rawText.substring(0, 60).trim()}`;
        const existingPageId = existingHighlightsMap.get(annotKey);

        if (existingPageId) {
          // Highlight already exists: Update source quote/note safely without overwriting user data
          await notion.updateHighlightSourceFields(existingPageId, book.sourceTitle, annot);
          totalUpdatedHighlights++;
        } else {
          // Brand new highlight: Create it and link to book page
          await notion.createHighlight(highlightsDbId, bookPageId, book.sourceTitle, annot);
          existingHighlightsMap.set(annotKey, "created");
          totalNewHighlights++;
        }
      }

      // Record in sync cache
      if (book.asin) {
        syncCache[book.asin] = {
          annotationsCount: book.annotations.length,
          lastSyncedAt: new Date().toISOString(),
        };
      }
    }

    const lastSync = new Date().toISOString();
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        hakim_last_sync: lastSync,
        hakim_sync_cache: syncCache,
      });
    }

    broadcastProgress("Sync complete!", 100);
    if (isBackground) setBadge("", "");

    // Optional background notification
    if (isBackground && totalNewHighlights > 0 && typeof chrome !== "undefined" && chrome.notifications) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "dist/assets/icons/icon-128.png",
        title: "Hakim: Kindle Highlights Synced",
        message: `Auto-synced ${totalNewHighlights} new highlight(s) across ${booksSynced} book(s) to Notion.`,
      });
    }

    return {
      success: true,
      message: `Successfully synced ${booksSynced} book(s) — ${totalNewHighlights} new highlight(s), ${totalUpdatedHighlights} updated in Notion!`,
    };
  } catch (err: unknown) {
    if (isBackground) setBadge("!", "#f43f5e");
    const msg = err instanceof Error ? err.message : "An unexpected error occurred during sync.";
    return { success: false, message: msg };
  }
}

// Service worker event listeners
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onInstalled?.addListener(async () => {
    const config = await getConfig();
    await setupAlarms(config.autoSyncIntervalMinutes);
  });

  chrome.runtime.onStartup?.addListener(async () => {
    const config = await getConfig();
    if (config.autoSyncIntervalMinutes > 0 && config.notionApiKey) {
      setTimeout(() => {
        performDirectNotionSync(true, false).catch(console.error);
      }, 15000);
    }
  });

  chrome.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name === "hakim_notion_sync") {
      performDirectNotionSync(true, false).catch(console.error);
    }
  });

  chrome.runtime.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_STATUS") {
      (async () => {
        try {
          const config = await getConfig();
          const amazon = new AmazonNotebookClient(config.amazonDomain);
          const session = await amazon.checkSession();
          let notionValid = false;
          let botName: string | undefined;

          if (config.notionApiKey) {
            const notion = new NotionDirectClient(config.notionApiKey, config.fieldMapping);
            const test = await notion.testConnection();
            notionValid = test.valid;
            botName = test.botName;
          }

          const lastSync = (await chrome.storage.local.get("hakim_last_sync"))["hakim_last_sync"] as string | undefined;

          sendResponse({
            amazonLoggedIn: session.loggedIn,
            notionConnected: notionValid,
            notionBotName: botName,
            databasesConfigured: Boolean(config.booksDbId && config.highlightsDbId),
            lastSync,
            config,
          });
        } catch {
          sendResponse({
            amazonLoggedIn: false,
            notionConnected: false,
            databasesConfigured: false,
            config: DEFAULT_CONFIG,
          });
        }
      })();
      return true;
    }

    if (message.type === "SAVE_CONFIG") {
      (async () => {
        await setConfig(message.config);
        sendResponse({ success: true });
      })();
      return true;
    }

    if (message.type === "SYNC_NOW") {
      (async () => {
        const result = await performDirectNotionSync(false, message.forceFullSync ?? true);
        sendResponse(result);
      })();
      return true;
    }

    if (message.type === "RESET_DATABASES") {
      (async () => {
        await setConfig({ booksDbId: undefined, highlightsDbId: undefined });
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          await chrome.storage.local.remove(["hakim_sync_cache", "hakim_last_sync"]);
        }
        sendResponse({ success: true });
      })();
      return true;
    }

    return false;
  });
}
