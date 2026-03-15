// ============================================================================
// Crida Frontend - Console Component
// Frida message output and logging
// ============================================================================

import type { CaidoSDK } from "../types";

interface ConsoleMsg {
  id: string;
  timestamp: number;
  level: string;
  source: string;
  message: string;
}

let consoleMessages: ConsoleMsg[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;
let autoScroll = true;

export function createConsole(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <div class="crida__console">
      <div class="crida__console-toolbar">
        <button class="crida__btn crida__btn--secondary crida__btn--small" id="crida-console-refresh">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
        <button class="crida__btn crida__btn--danger crida__btn--small" id="crida-console-clear">
          <i class="fas fa-trash"></i> Clear
        </button>
        <div style="flex: 1;"></div>
        <label style="font-size: 12px; color: #8b949e; display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" id="crida-console-auto-poll" checked /> Auto-poll
        </label>
        <label style="font-size: 12px; color: #8b949e; display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" id="crida-console-auto-scroll" checked /> Auto-scroll
        </label>
        <select class="crida__select" id="crida-console-filter" style="width: auto; min-width: 120px;">
          <option value="all">All Levels</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>
        <input type="text" class="crida__input" id="crida-console-search" placeholder="Search messages..." style="width: 200px;" />
      </div>
      <div class="crida__console-messages" id="crida-console-messages">
        <div class="crida__console-msg crida__console-msg--info">
          <span class="timestamp">[${formatTime(Date.now())}]</span>
          <span class="source">[crida]</span>
          Console ready. Connect to a Frida bridge and load a script to see messages.
        </div>
      </div>
    </div>
  `;

  setupConsoleEvents(container, sdk);
  return container;
}

function setupConsoleEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const refreshBtn = container.querySelector("#crida-console-refresh") as HTMLButtonElement;
  const clearBtn = container.querySelector("#crida-console-clear") as HTMLButtonElement;
  const autoPollCheckbox = container.querySelector("#crida-console-auto-poll") as HTMLInputElement;
  const autoScrollCheckbox = container.querySelector("#crida-console-auto-scroll") as HTMLInputElement;
  const filterSelect = container.querySelector("#crida-console-filter") as HTMLSelectElement;
  const searchInput = container.querySelector("#crida-console-search") as HTMLInputElement;

  const refreshMessages = async () => {
    const messages = await sdk.backend.getMessages();
    if (messages.length > 0) {
      for (const msg of messages) {
        if (!consoleMessages.some((m) => m.id === msg.id)) {
          consoleMessages.push(msg);
        }
      }
      renderConsoleMessages(container, filterSelect.value, searchInput.value);
    }
  };

  refreshBtn.addEventListener("click", refreshMessages);

  clearBtn.addEventListener("click", async () => {
    consoleMessages = [];
    await sdk.backend.clearMessages();
    renderConsoleMessages(container, filterSelect.value, searchInput.value);
  });

  autoPollCheckbox.addEventListener("change", () => {
    if (autoPollCheckbox.checked) {
      startPolling(sdk, container, filterSelect, searchInput);
    } else {
      stopPolling();
    }
  });

  autoScrollCheckbox.addEventListener("change", () => {
    autoScroll = autoScrollCheckbox.checked;
  });

  filterSelect.addEventListener("change", () => {
    renderConsoleMessages(container, filterSelect.value, searchInput.value);
  });

  searchInput.addEventListener("input", () => {
    renderConsoleMessages(container, filterSelect.value, searchInput.value);
  });

  // Start auto-polling
  startPolling(sdk, container, filterSelect, searchInput);
}

function startPolling(
  sdk: CaidoSDK,
  container: HTMLElement,
  filterSelect: HTMLSelectElement,
  searchInput: HTMLInputElement
): void {
  stopPolling();
  pollInterval = setInterval(async () => {
    const messages = await sdk.backend.getMessages();
    if (messages.length > 0) {
      let hasNew = false;
      for (const msg of messages) {
        if (!consoleMessages.some((m) => m.id === msg.id)) {
          consoleMessages.push(msg);
          hasNew = true;
        }
      }
      if (hasNew) {
        renderConsoleMessages(container, filterSelect.value, searchInput.value);
      }
    }
  }, 2000);
}

function stopPolling(): void {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function renderConsoleMessages(container: HTMLElement, levelFilter: string, search: string): void {
  const messagesDiv = container.querySelector("#crida-console-messages") as HTMLElement;

  let filtered = consoleMessages;
  if (levelFilter !== "all") {
    filtered = filtered.filter((m) => m.level === levelFilter);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (m) => m.message.toLowerCase().includes(s) || m.source.toLowerCase().includes(s)
    );
  }

  if (filtered.length === 0) {
    messagesDiv.innerHTML = `
      <div class="crida__console-msg crida__console-msg--info">
        <span class="timestamp">[${formatTime(Date.now())}]</span>
        <span class="source">[crida]</span>
        No messages${levelFilter !== "all" ? ` matching filter "${levelFilter}"` : ""}${search ? ` containing "${search}"` : ""}.
      </div>
    `;
    return;
  }

  // Limit displayed messages
  const displayed = filtered.slice(-500);

  messagesDiv.innerHTML = displayed
    .map(
      (msg) => `
    <div class="crida__console-msg crida__console-msg--${msg.level}">
      <span class="timestamp">[${formatTime(msg.timestamp)}]</span>
      <span class="source">[${escapeHtml(msg.source)}]</span>
      ${escapeHtml(msg.message)}
    </div>
  `
    )
    .join("");

  // Auto-scroll to bottom
  if (autoScroll) {
    const consoleEl = container.querySelector(".crida__console") as HTMLElement;
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
