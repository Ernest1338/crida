// ============================================================================
// Crida Frontend - Main Entry Point
// Caido plugin integrating Frida for mobile application security testing
// ============================================================================

import type { CaidoSDK } from "./types";
import { createDashboard } from "./components/dashboard";
import { createScriptEditor } from "./components/script-editor";
import { createHooksPanel } from "./components/hooks-panel";
import { createAnalysisPanel } from "./components/analysis";
import { createConsole } from "./components/console";
import { createCustomPluginsPanel } from "./components/custom-plugins";

import "./styles/style.css";

const Page = "/crida" as const;

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "fas fa-home" },
  { id: "editor", label: "Script Editor", icon: "fas fa-code" },
  { id: "hooks", label: "Hooks Library", icon: "fas fa-shield-alt" },
  { id: "analysis", label: "Analysis", icon: "fas fa-sitemap" },
  { id: "plugins", label: "Custom Plugins", icon: "fas fa-puzzle-piece" },
  { id: "console", label: "Console", icon: "fas fa-terminal" },
] as const;

function createPluginUI(sdk: CaidoSDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "crida";

  // Create tabs
  const tabsBar = document.createElement("div");
  tabsBar.className = "crida__tabs";
  tabsBar.innerHTML = TABS.map(
    (tab) =>
      `<button class="crida__tab ${tab.id === "dashboard" ? "crida__tab--active" : ""}" data-tab="${tab.id}">
        <i class="${tab.icon}"></i>${tab.label}
      </button>`
  ).join("");

  // Create content area
  const content = document.createElement("div");
  content.className = "crida__content";

  // Create panels
  const panels: Record<string, HTMLElement> = {};

  const dashboardPanel = createPanel("dashboard", true);
  dashboardPanel.appendChild(createDashboard(sdk));
  panels["dashboard"] = dashboardPanel;

  const editorPanel = createPanel("editor", false);
  editorPanel.appendChild(createScriptEditor(sdk));
  panels["editor"] = editorPanel;

  const hooksPanel = createPanel("hooks", false);
  hooksPanel.appendChild(createHooksPanel(sdk));
  panels["hooks"] = hooksPanel;

  const analysisPanel = createPanel("analysis", false);
  analysisPanel.appendChild(createAnalysisPanel(sdk));
  panels["analysis"] = analysisPanel;

  const pluginsPanel = createPanel("plugins", false);
  pluginsPanel.appendChild(createCustomPluginsPanel(sdk));
  panels["plugins"] = pluginsPanel;

  const consolePanel = createPanel("console", false);
  consolePanel.appendChild(createConsole(sdk));
  panels["console"] = consolePanel;

  for (const panel of Object.values(panels)) {
    content.appendChild(panel);
  }

  // Status bar
  const statusBar = document.createElement("div");
  statusBar.className = "crida__status-bar";
  statusBar.innerHTML = `
    <div>
      <span class="crida__status-indicator crida__status-indicator--disconnected" id="crida-global-status"></span>
      <span id="crida-global-status-text">Not connected</span>
    </div>
    <div>Crida v0.1.0 — Frida Integration for Caido</div>
  `;

  root.appendChild(tabsBar);
  root.appendChild(content);
  root.appendChild(statusBar);

  // Tab switching
  tabsBar.querySelectorAll(".crida__tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      const tabId = (tabBtn as HTMLElement).dataset["tab"]!;

      // Update tab buttons
      tabsBar.querySelectorAll(".crida__tab").forEach((t) => t.classList.remove("crida__tab--active"));
      tabBtn.classList.add("crida__tab--active");

      // Update panels
      for (const [id, panel] of Object.entries(panels)) {
        panel.classList.toggle("crida__panel--active", id === tabId);
      }
    });
  });

  // Periodic status check
  setInterval(async () => {
    try {
      const status = await sdk.backend.getStatus();
      const indicator = root.querySelector("#crida-global-status") as HTMLElement;
      const text = root.querySelector("#crida-global-status-text") as HTMLElement;

      indicator.className = "crida__status-indicator";
      if (status.deviceConnected) {
        indicator.classList.add("crida__status-indicator--connected");
        text.textContent = `Connected — ${status.deviceInfo?.name ?? "Device"}`;
      } else if (status.bridgeConnected) {
        indicator.classList.add("crida__status-indicator--partial");
        text.textContent = "Bridge connected — No device";
      } else {
        indicator.classList.add("crida__status-indicator--disconnected");
        text.textContent = "Not connected";
      }
    } catch {
      // Silently ignore - bridge might not be running
    }
  }, 5000);

  return root;
}

function createPanel(id: string, active: boolean): HTMLElement {
  const panel = document.createElement("div");
  panel.className = `crida__panel ${active ? "crida__panel--active" : ""}`;
  panel.id = `crida-panel-${id}`;
  return panel;
}

export const init = (sdk: CaidoSDK) => {
  // Register page
  const body = createPluginUI(sdk);
  sdk.navigation.addPage(Page, { body });

  // Register sidebar
  sdk.sidebar.registerItem("Crida", Page, {
    icon: "fas fa-mobile-alt",
  });

  // Register commands
  sdk.commands.register("crida.open", {
    name: "Open Crida - Frida Integration",
    run: () => sdk.navigation.goTo(Page),
  });

  sdk.commandPalette.register("crida.open");
};
