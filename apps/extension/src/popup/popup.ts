interface StandaloneStatusResponse {
  amazonLoggedIn: boolean;
  notionConnected: boolean;
  notionBotName?: string;
  databasesConfigured: boolean;
  lastSync?: string;
  config: {
    notionApiKey: string;
    notionParentPageId: string;
    booksDbId?: string;
    highlightsDbId?: string;
    amazonDomain: string;
    fieldMapping?: {
      bookTitleField?: string;
      bookAuthorField?: string;
      bookAsinField?: string;
      bookUrlField?: string;
      bookLastAnnotatedField?: string;
      highlightTitleField?: string;
      highlightBookRelationField?: string;
      highlightQuoteField?: string;
      highlightNoteField?: string;
      highlightLocationField?: string;
      highlightPageField?: string;
      highlightChapterField?: string;
      highlightColorField?: string;
      highlightImportanceField?: string;
      highlightStatusField?: string;
      highlightInterpretationField?: string;
    };
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const brandLogo = document.getElementById("brand-logo") as HTMLImageElement;
  const appVersionEl = document.getElementById("app-version");
  if (appVersionEl && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifestVer = chrome.runtime.getManifest()?.version;
      if (manifestVer) appVersionEl.textContent = `v${manifestVer}`;
    } catch {
      // Ignore in non-extension environments
    }
  }

  const amazonDot = document.getElementById("amazon-dot")!;
  const amazonStatusEl = document.getElementById("amazon-status")!;
  const notionDot = document.getElementById("notion-dot")!;
  const notionStatusEl = document.getElementById("notion-status")!;
  const lastSyncEl = document.getElementById("last-sync")!;
  
  const btnSync = document.getElementById("btn-sync") as HTMLButtonElement;
  const btnSyncText = document.getElementById("btn-sync-text")!;
  const btnSaveConfig = document.getElementById("btn-save-config") as HTMLButtonElement;
  
  const notionTokenInput = document.getElementById("notion-token") as HTMLInputElement;
  const notionParentIdInput = document.getElementById("notion-parent-id") as HTMLInputElement;
  const amazonDomainSelect = document.getElementById("amazon-domain") as HTMLSelectElement;
  const autoSyncIntervalSelect = document.getElementById("auto-sync-interval") as HTMLSelectElement;
  
  const btnToggleToken = document.getElementById("btn-toggle-token-visibility") as HTMLButtonElement;
  const iconEye = document.getElementById("icon-eye") as HTMLElement;
  const iconEyeOff = document.getElementById("icon-eye-off") as HTMLElement;

  const accordionToggle = document.getElementById("accordion-toggle") as HTMLButtonElement;
  const accordionChevron = document.getElementById("accordion-chevron")!;
  const settingsPanel = document.getElementById("settings-panel")!;

  const mappingToggle = document.getElementById("mapping-toggle") as HTMLButtonElement;
  const mappingChevron = document.getElementById("mapping-chevron")!;
  const mappingPanel = document.getElementById("mapping-panel")!;

  // Books Mapping Inputs
  const mapBookTitleInput = document.getElementById("map-book-title") as HTMLInputElement;
  const mapBookAuthorInput = document.getElementById("map-book-author") as HTMLInputElement;
  const mapBookAsinInput = document.getElementById("map-book-asin") as HTMLInputElement;
  const mapBookUrlInput = document.getElementById("map-book-url") as HTMLInputElement;
  const mapBookLastAnnotatedInput = document.getElementById("map-book-last-annotated") as HTMLInputElement;

  // Highlights Mapping Inputs
  const mapHighlightTitleInput = document.getElementById("map-highlight-title") as HTMLInputElement;
  const mapHighlightRelationInput = document.getElementById("map-highlight-relation") as HTMLInputElement;
  const mapHighlightQuoteInput = document.getElementById("map-highlight-quote") as HTMLInputElement;
  const mapHighlightNoteInput = document.getElementById("map-highlight-note") as HTMLInputElement;
  const mapHighlightLocInput = document.getElementById("map-highlight-loc") as HTMLInputElement;
  const mapHighlightPageInput = document.getElementById("map-highlight-page") as HTMLInputElement;
  const mapHighlightChapterInput = document.getElementById("map-highlight-chapter") as HTMLInputElement;
  const mapHighlightColorInput = document.getElementById("map-highlight-color") as HTMLInputElement;
  const mapHighlightImportanceInput = document.getElementById("map-highlight-importance") as HTMLInputElement;
  const mapHighlightStatusInput = document.getElementById("map-highlight-status") as HTMLInputElement;
  const mapHighlightInterpInput = document.getElementById("map-highlight-interp") as HTMLInputElement;

  const progressCard = document.getElementById("sync-progress-card")!;
  const progressBookLabel = document.getElementById("progress-book-label")!;
  const progressPercent = document.getElementById("progress-percent")!;
  const progressFill = document.getElementById("progress-fill")!;

  const toastBanner = document.getElementById("toast-banner")!;
  const toastText = document.getElementById("toast-text")!;
  const toastClose = document.getElementById("toast-close") as HTMLButtonElement;

  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function showToast(message: string, type: "success" | "error" | "info" = "info", autoDismiss = 5000) {
    if (toastTimer) clearTimeout(toastTimer);
    toastText.textContent = message;
    toastBanner.className = `toast-banner toast-${type}`;
    toastBanner.style.display = "flex";

    if (autoDismiss > 0) {
      toastTimer = setTimeout(() => {
        toastBanner.style.display = "none";
      }, autoDismiss);
    }
  }

  toastClose.addEventListener("click", () => {
    toastBanner.style.display = "none";
  });

  // Extract 32-char ID from full Notion URLs
  function extractPageId(raw: string): string {
    const trimmed = raw.trim();
    const cleanUrl = trimmed.split("?")[0] || trimmed;
    const match = cleanUrl.replace(/-/g, "").match(/([a-f0-9]{32})/i);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  }

  // Format relative timestamp
  function formatRelativeTime(isoString: string): string {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Toggle Password Visibility with SVG Icons
  btnToggleToken.addEventListener("click", () => {
    if (notionTokenInput.type === "password") {
      notionTokenInput.type = "text";
      iconEye.style.display = "none";
      iconEyeOff.style.display = "block";
    } else {
      notionTokenInput.type = "password";
      iconEye.style.display = "block";
      iconEyeOff.style.display = "none";
    }
  });

  // Main Collapsible Accordion
  let isSettingsOpen = false;
  accordionToggle.addEventListener("click", () => {
    isSettingsOpen = !isSettingsOpen;
    accordionToggle.setAttribute("aria-expanded", String(isSettingsOpen));
    accordionChevron.className = `accordion-chevron ${isSettingsOpen ? "expanded" : ""}`;
    settingsPanel.style.display = isSettingsOpen ? "block" : "none";
    if (isSettingsOpen && !notionTokenInput.value) {
      notionTokenInput.focus();
    }
  });

  // Field Mapping Sub-Accordion
  let isMappingOpen = false;
  mappingToggle.addEventListener("click", () => {
    isMappingOpen = !isMappingOpen;
    mappingToggle.setAttribute("aria-expanded", String(isMappingOpen));
    mappingChevron.className = `accordion-chevron ${isMappingOpen ? "expanded" : ""}`;
    mappingPanel.style.display = isMappingOpen ? "block" : "none";
  });

  // Smart auto-clean on parent ID input blur/paste
  notionParentIdInput.addEventListener("change", () => {
    notionParentIdInput.value = extractPageId(notionParentIdInput.value);
  });

  function updateUI(res: StandaloneStatusResponse) {
    // Amazon Status
    if (res.amazonLoggedIn) {
      amazonStatusEl.textContent = "Active Session";
      amazonDot.className = "status-dot dot-online";
    } else {
      amazonStatusEl.textContent = "Not Logged In";
      amazonDot.className = "status-dot dot-offline";
    }

    // Notion Status
    if (res.notionConnected) {
      notionStatusEl.textContent = res.notionBotName ? `Connected (${res.notionBotName})` : "Connected";
      notionDot.className = "status-dot dot-online";
    } else {
      notionStatusEl.textContent = "Not Connected";
      notionDot.className = "status-dot dot-offline";
    }

    // Last Sync
    if (res.lastSync) {
      lastSyncEl.textContent = formatRelativeTime(res.lastSync);
      lastSyncEl.title = new Date(res.lastSync).toLocaleString();
    } else {
      lastSyncEl.textContent = "Never";
      lastSyncEl.title = "Never synced";
    }

    // Form inputs
    if (res.config) {
      notionTokenInput.value = res.config.notionApiKey || "";
      notionParentIdInput.value = res.config.notionParentPageId || "";
      amazonDomainSelect.value = res.config.amazonDomain || "read.amazon.com";
      autoSyncIntervalSelect.value = String((res.config as any).autoSyncIntervalMinutes ?? 360);

      if (res.config.fieldMapping) {
        mapBookTitleInput.value = res.config.fieldMapping.bookTitleField || "";
        mapBookAuthorInput.value = res.config.fieldMapping.bookAuthorField || "";
        mapBookAsinInput.value = res.config.fieldMapping.bookAsinField || "";
        mapBookUrlInput.value = res.config.fieldMapping.bookUrlField || "";
        mapBookLastAnnotatedInput.value = res.config.fieldMapping.bookLastAnnotatedField || "";

        mapHighlightTitleInput.value = res.config.fieldMapping.highlightTitleField || "";
        mapHighlightRelationInput.value = res.config.fieldMapping.highlightBookRelationField || "";
        mapHighlightQuoteInput.value = res.config.fieldMapping.highlightQuoteField || "";
        mapHighlightNoteInput.value = res.config.fieldMapping.highlightNoteField || "";
        mapHighlightLocInput.value = res.config.fieldMapping.highlightLocationField || "";
        mapHighlightPageInput.value = res.config.fieldMapping.highlightPageField || "";
        mapHighlightChapterInput.value = res.config.fieldMapping.highlightChapterField || "";
        mapHighlightColorInput.value = res.config.fieldMapping.highlightColorField || "";
        mapHighlightImportanceInput.value = res.config.fieldMapping.highlightImportanceField || "";
        mapHighlightStatusInput.value = res.config.fieldMapping.highlightStatusField || "";
        mapHighlightInterpInput.value = res.config.fieldMapping.highlightInterpretationField || "";
      }

      // If missing config on first launch, auto-open accordion
      if (!res.config.notionApiKey && !isSettingsOpen) {
        accordionToggle.click();
      }
    }

    btnSync.disabled = !res.notionConnected || !res.config?.notionApiKey;
  }

  // Listen for background progress messages
  if (typeof chrome !== "undefined" && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "SYNC_PROGRESS") {
        progressCard.style.display = "block";
        progressBookLabel.textContent = message.label;
        progressPercent.textContent = `${message.percent}%`;
        progressFill.style.width = `${message.percent}%`;
      }
    });

    // Request initial status from background worker
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response: StandaloneStatusResponse) => {
      if (response) {
        updateUI(response);
      }
    });

    // 1. Sync Action
    btnSync.addEventListener("click", () => {
      btnSync.disabled = true;
      btnSyncText.textContent = "Syncing...";
      brandLogo.classList.add("syncing");
      
      progressCard.style.display = "block";
      progressBookLabel.textContent = "Connecting to Kindle & Notion...";
      progressPercent.textContent = "10%";
      progressFill.style.width = "10%";

      showToast("Fetching highlights from Kindle and syncing to Notion...", "info", 0);

      chrome.runtime.sendMessage({ type: "SYNC_NOW", forceFullSync: true }, (result: { success: boolean; message: string }) => {
        btnSync.disabled = false;
        btnSyncText.textContent = "Sync Highlights to Notion";
        brandLogo.classList.remove("syncing");

        if (result && result.success) {
          progressPercent.textContent = "100%";
          progressFill.style.width = "100%";
          progressBookLabel.textContent = "Sync completed!";
          showToast(result.message, "success", 7000);
          setTimeout(() => {
            progressCard.style.display = "none";
          }, 3000);
          chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);
        } else {
          progressCard.style.display = "none";
          showToast(result?.message || "Sync failed. Check connection.", "error", 9000);
        }
      });
    });

    // 2. Save Settings Action
    btnSaveConfig.addEventListener("click", () => {
      const notionApiKey = notionTokenInput.value.trim();
      const rawParentId = notionParentIdInput.value.trim();
      const notionParentPageId = extractPageId(rawParentId);
      const amazonDomain = amazonDomainSelect.value;

      const fieldMapping = {
        bookTitleField: mapBookTitleInput.value.trim() || "Title",
        bookAuthorField: mapBookAuthorInput.value.trim() || "Author",
        bookAsinField: mapBookAsinInput.value.trim() || "ASIN",
        bookUrlField: mapBookUrlInput.value.trim() || "Kindle URL",
        bookLastAnnotatedField: mapBookLastAnnotatedInput.value.trim() || "Last Annotated",

        highlightTitleField: mapHighlightTitleInput.value.trim() || "Name",
        highlightBookRelationField: mapHighlightRelationInput.value.trim() || "Book",
        highlightQuoteField: mapHighlightQuoteInput.value.trim() || "Quote",
        highlightNoteField: mapHighlightNoteInput.value.trim() || "Kindle Note",
        highlightLocationField: mapHighlightLocInput.value.trim() || "Location",
        highlightPageField: mapHighlightPageInput.value.trim() || "Page",
        highlightChapterField: mapHighlightChapterInput.value.trim() || "Chapter",
        highlightColorField: mapHighlightColorInput.value.trim() || "Color",
        highlightImportanceField: mapHighlightImportanceInput.value.trim() || "Importance",
        highlightStatusField: mapHighlightStatusInput.value.trim() || "Process Status",
        highlightInterpretationField: mapHighlightInterpInput.value.trim() || "My Interpretation",
      };

      const autoSyncIntervalMinutes = parseInt(autoSyncIntervalSelect.value, 10);

      showToast("Validating Notion connection...", "info", 0);

      chrome.runtime.sendMessage(
        {
          type: "SAVE_CONFIG",
          config: { notionApiKey, notionParentPageId, amazonDomain, autoSyncIntervalMinutes, fieldMapping },
        },
        () => {
          chrome.runtime.sendMessage({ type: "GET_STATUS" }, (status: StandaloneStatusResponse) => {
            if (status) {
              updateUI(status);
              if (status.notionConnected) {
                showToast("Configuration saved & verified! Ready to sync.", "success", 5000);
              } else {
                showToast("Settings saved. Could not connect to Notion — check your Secret token.", "error", 7000);
              }
            }
          });
        }
      );
    });

    // 3. Reset Cache Action
    const btnResetCache = document.getElementById("btn-reset-cache");
    if (btnResetCache) {
      btnResetCache.addEventListener("click", () => {
        if (confirm("Reset saved Notion database IDs and sync cache? Next sync will verify and re-provision fresh connections.")) {
          chrome.runtime.sendMessage({ type: "RESET_DATABASES" }, () => {
            showToast("Database IDs and cache reset successfully.", "success", 3000);
            chrome.runtime.sendMessage({ type: "GET_STATUS" }, (status: StandaloneStatusResponse) => {
              if (status) updateUI(status);
            });
          });
        }
      });
    }
  }
});
