// ============================================================================
// Crida Frontend - Hooks Library Panel
// Pre-built Frida hooks for common security testing tasks
// ============================================================================

import type { CaidoSDK } from "../types";

export function createHooksPanel(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px;"><i class="fas fa-shield-alt" style="color: #58a6ff; margin-right: 8px;"></i>Pre-built Hooks Library</h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #8b949e;">
        Ready-to-use Frida hooks for common mobile security testing scenarios. Click "Apply" to inject a hook into the attached process.
      </p>
      <div class="crida__filter">
        <select class="crida__select" id="crida-hooks-platform-filter" style="width: 150px;">
          <option value="all">All Platforms</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
        <select class="crida__select" id="crida-hooks-category-filter" style="width: 180px;">
          <option value="all">All Categories</option>
          <option value="ssl-pinning">SSL Pinning</option>
          <option value="root-detection">Root Detection</option>
          <option value="jailbreak-detection">Jailbreak Detection</option>
          <option value="crypto">Crypto</option>
          <option value="network">Network</option>
          <option value="storage">Storage</option>
        </select>
        <input type="text" class="crida__input" id="crida-hooks-search" placeholder="Search hooks..." />
      </div>
    </div>
    <div class="crida__hooks-grid" id="crida-hooks-grid">
      <div class="crida__empty">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading hooks library...</p>
      </div>
    </div>
  `;

  loadHooksLibrary(container, sdk);
  setupHooksEvents(container, sdk);
  return container;
}

interface HookEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  source: string;
}

async function loadHooksLibrary(container: HTMLElement, sdk: CaidoSDK): Promise<void> {
  const hooks = await sdk.backend.getHooksLibrary();
  renderHooks(container, sdk, hooks, "all", "all", "");
}

function setupHooksEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const platformFilter = container.querySelector("#crida-hooks-platform-filter") as HTMLSelectElement;
  const categoryFilter = container.querySelector("#crida-hooks-category-filter") as HTMLSelectElement;
  const searchInput = container.querySelector("#crida-hooks-search") as HTMLInputElement;

  const applyFilters = async () => {
    const hooks = await sdk.backend.getHooksLibrary();
    renderHooks(
      container,
      sdk,
      hooks,
      platformFilter.value,
      categoryFilter.value,
      searchInput.value
    );
  };

  platformFilter.addEventListener("change", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", applyFilters);
}

function renderHooks(
  container: HTMLElement,
  sdk: CaidoSDK,
  hooks: HookEntry[],
  platformFilter: string,
  categoryFilter: string,
  search: string
): void {
  const grid = container.querySelector("#crida-hooks-grid") as HTMLElement;

  const filtered = hooks.filter((hook) => {
    if (platformFilter !== "all" && hook.platform !== platformFilter && hook.platform !== "any") return false;
    if (categoryFilter !== "all" && hook.category !== categoryFilter) return false;
    if (search && !hook.name.toLowerCase().includes(search.toLowerCase()) &&
        !hook.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="crida__empty" style="grid-column: 1 / -1;">
        <i class="fas fa-search"></i>
        <p>No hooks match your filters</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered
    .map(
      (hook) => `
    <div class="crida__hook-card" data-hook-id="${hook.id}">
      <h4>${escapeHtml(hook.name)}</h4>
      <div class="crida__badge-group">
        <span class="crida__badge crida__badge--${hook.platform}">${hook.platform}</span>
        <span class="crida__badge crida__badge--category">${hook.category}</span>
      </div>
      <p>${escapeHtml(hook.description)}</p>
      <div class="crida__btn-group">
        <button class="crida__btn crida__btn--primary crida__btn--small crida-apply-hook-btn" data-hook-id="${hook.id}" data-platform="${hook.platform}">
          <i class="fas fa-bolt"></i> Apply
        </button>
        <button class="crida__btn crida__btn--secondary crida__btn--small crida-view-hook-btn" data-hook-id="${hook.id}">
          <i class="fas fa-code"></i> View Source
        </button>
      </div>
    </div>
  `
    )
    .join("");

  // Bind apply buttons
  grid.querySelectorAll(".crida-apply-hook-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const hookId = (btn as HTMLElement).dataset["hookId"]!;
      const platform = (btn as HTMLElement).dataset["platform"]!;
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).innerHTML = '<span class="crida__spinner"></span> Applying...';

      const result = await sdk.backend.runPrebuiltHook(hookId, platform);

      if (result.success) {
        (btn as HTMLButtonElement).innerHTML = '<i class="fas fa-check"></i> Applied';
        (btn as HTMLButtonElement).classList.remove("crida__btn--primary");
        (btn as HTMLButtonElement).classList.add("crida__btn--secondary");
      } else {
        (btn as HTMLButtonElement).innerHTML = '<i class="fas fa-times"></i> Failed';
        setTimeout(() => {
          (btn as HTMLButtonElement).innerHTML = '<i class="fas fa-bolt"></i> Apply';
          (btn as HTMLButtonElement).disabled = false;
        }, 2000);
      }
    });
  });

  // Bind view source buttons
  grid.querySelectorAll(".crida-view-hook-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const hookId = (btn as HTMLElement).dataset["hookId"]!;
      const hook = hooks.find((h) => h.id === hookId);
      if (hook) {
        showSourceModal(hook);
      }
    });
  });
}

function showSourceModal(hook: HookEntry): void {
  // Remove existing modal
  const existing = document.querySelector("#crida-source-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "crida-source-modal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  `;
  modal.innerHTML = `
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; max-width: 800px; width: 100%; max-height: 80vh; display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #30363d;">
        <h3 style="margin: 0; font-size: 14px; color: #e1e4e8;">${escapeHtml(hook.name)}</h3>
        <button id="crida-close-modal" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 18px; padding: 4px 8px;">✕</button>
      </div>
      <pre style="margin: 0; padding: 16px; overflow: auto; flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5; color: #79c0ff; background: #0d1117;">${escapeHtml(hook.source)}</pre>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  modal.querySelector("#crida-close-modal")!.addEventListener("click", () => modal.remove());
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
