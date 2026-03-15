// ============================================================================
// Crida Frontend - Custom Plugin Builder
// Brida-style custom plugins for HTTP request/response processing
// ============================================================================

import type { CaidoSDK } from "../types";

interface CustomPluginDef {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  fridaExportName: string;
  inputEncoding: string;
  outputEncoding: string;
  matchScope: string;
  matchPattern: string;
  parameterType: string;
  parameterRegex: string;
  headerName: string;
}

let plugins: CustomPluginDef[] = [];
let selectedPluginId: string | null = null;
let pluginIdCounter = 0;

export function createCustomPluginsPanel(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px;">
        <i class="fas fa-puzzle-piece" style="color: #58a6ff; margin-right: 8px;"></i>
        Custom Plugin Builder
      </h3>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #8b949e;">
        Create custom plugins that use Frida RPC exports to process HTTP requests and responses.
        Similar to Brida's custom plugin system - define how data flows between Caido and Frida.
      </p>
    </div>
    <div class="crida__plugin-builder">
      <div class="crida__plugin-list">
        <div style="padding: 8px; border-bottom: 1px solid #30363d;">
          <button class="crida__btn crida__btn--primary crida__btn--small" id="crida-add-plugin-btn" style="width: 100%;">
            <i class="fas fa-plus"></i> New Plugin
          </button>
        </div>
        <div id="crida-plugin-list-items">
          <div class="crida__empty" style="padding: 20px;">
            <p style="font-size: 12px;">No custom plugins yet</p>
          </div>
        </div>
      </div>
      <div class="crida__plugin-config" id="crida-plugin-config">
        <div class="crida__empty">
          <i class="fas fa-arrow-left"></i>
          <p>Select or create a plugin to configure it</p>
        </div>
      </div>
    </div>
  `;

  setupPluginEvents(container, sdk);
  return container;
}

function setupPluginEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const addBtn = container.querySelector("#crida-add-plugin-btn") as HTMLButtonElement;

  addBtn.addEventListener("click", () => {
    const newPlugin: CustomPluginDef = {
      id: `plugin-${++pluginIdCounter}`,
      name: `Plugin ${pluginIdCounter}`,
      description: "",
      type: "request_processor",
      enabled: false,
      fridaExportName: "",
      inputEncoding: "utf8",
      outputEncoding: "utf8",
      matchScope: "all",
      matchPattern: "",
      parameterType: "full_body",
      parameterRegex: "",
      headerName: "",
    };
    plugins.push(newPlugin);
    selectedPluginId = newPlugin.id;
    renderPluginList(container, sdk);
    renderPluginConfig(container, sdk);
  });
}

function renderPluginList(container: HTMLElement, sdk: CaidoSDK): void {
  const listItems = container.querySelector("#crida-plugin-list-items") as HTMLElement;

  if (plugins.length === 0) {
    listItems.innerHTML = `
      <div class="crida__empty" style="padding: 20px;">
        <p style="font-size: 12px;">No custom plugins yet</p>
      </div>
    `;
    return;
  }

  listItems.innerHTML = plugins
    .map(
      (p) => `
    <div class="crida__plugin-list-item ${p.id === selectedPluginId ? "crida__plugin-list-item--active" : ""}" data-plugin-id="${p.id}">
      <h4 style="display: flex; align-items: center; gap: 6px;">
        <span style="color: ${p.enabled ? "#3fb950" : "#8b949e"};">●</span>
        ${escapeHtml(p.name)}
      </h4>
      <p>${escapeHtml(p.type.replace(/_/g, " "))} → ${escapeHtml(p.fridaExportName || "not configured")}</p>
    </div>
  `
    )
    .join("");

  listItems.querySelectorAll(".crida__plugin-list-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedPluginId = (item as HTMLElement).dataset["pluginId"]!;
      renderPluginList(container, sdk);
      renderPluginConfig(container, sdk);
    });
  });
}

function renderPluginConfig(container: HTMLElement, sdk: CaidoSDK): void {
  const configPanel = container.querySelector("#crida-plugin-config") as HTMLElement;
  const plugin = plugins.find((p) => p.id === selectedPluginId);

  if (!plugin) {
    configPanel.innerHTML = `
      <div class="crida__empty">
        <i class="fas fa-arrow-left"></i>
        <p>Select a plugin to configure it</p>
      </div>
    `;
    return;
  }

  configPanel.innerHTML = `
    <h3 style="margin: 0 0 16px 0; font-size: 14px; display: flex; align-items: center; justify-content: space-between;">
      <span>Plugin Configuration</span>
      <div class="crida__btn-group">
        <button class="crida__btn crida__btn--danger crida__btn--small" id="crida-delete-plugin">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </h3>

    <div class="crida__form-group">
      <label>Plugin Name</label>
      <input type="text" class="crida__input" id="crida-plugin-name" value="${escapeHtml(plugin.name)}" />
    </div>

    <div class="crida__form-group">
      <label>Description</label>
      <input type="text" class="crida__input" id="crida-plugin-desc" value="${escapeHtml(plugin.description)}" placeholder="What does this plugin do?" />
    </div>

    <div class="crida__form-group">
      <label>Plugin Type</label>
      <select class="crida__select" id="crida-plugin-type">
        <option value="request_processor" ${plugin.type === "request_processor" ? "selected" : ""}>Request Processor</option>
        <option value="response_processor" ${plugin.type === "response_processor" ? "selected" : ""}>Response Processor</option>
        <option value="request_response_processor" ${plugin.type === "request_response_processor" ? "selected" : ""}>Request + Response Processor</option>
        <option value="context_menu" ${plugin.type === "context_menu" ? "selected" : ""}>Context Menu Action</option>
        <option value="button_action" ${plugin.type === "button_action" ? "selected" : ""}>Button Action</option>
      </select>
    </div>

    <hr style="border: none; border-top: 1px solid #30363d; margin: 16px 0;" />
    <h4 style="margin: 0 0 12px 0; font-size: 13px; color: #8b949e;">Frida Integration</h4>

    <div class="crida__form-group">
      <label>Frida RPC Export Name</label>
      <input type="text" class="crida__input" id="crida-plugin-export" value="${escapeHtml(plugin.fridaExportName)}" placeholder="e.g. decrypt, sign, encode" />
      <small style="color: #8b949e; font-size: 11px;">The export name defined in rpc.exports of your Frida script</small>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="crida__form-group">
        <label>Input Encoding</label>
        <select class="crida__select" id="crida-plugin-input-enc">
          <option value="utf8" ${plugin.inputEncoding === "utf8" ? "selected" : ""}>UTF-8 String</option>
          <option value="hex" ${plugin.inputEncoding === "hex" ? "selected" : ""}>Hex Encoded</option>
          <option value="base64" ${plugin.inputEncoding === "base64" ? "selected" : ""}>Base64 Encoded</option>
          <option value="raw" ${plugin.inputEncoding === "raw" ? "selected" : ""}>Raw Bytes</option>
        </select>
      </div>
      <div class="crida__form-group">
        <label>Output Encoding</label>
        <select class="crida__select" id="crida-plugin-output-enc">
          <option value="utf8" ${plugin.outputEncoding === "utf8" ? "selected" : ""}>UTF-8 String</option>
          <option value="hex" ${plugin.outputEncoding === "hex" ? "selected" : ""}>Hex Encoded</option>
          <option value="base64" ${plugin.outputEncoding === "base64" ? "selected" : ""}>Base64 Encoded</option>
          <option value="raw" ${plugin.outputEncoding === "raw" ? "selected" : ""}>Raw Bytes</option>
        </select>
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid #30363d; margin: 16px 0;" />
    <h4 style="margin: 0 0 12px 0; font-size: 13px; color: #8b949e;">Matching & Parameters</h4>

    <div class="crida__form-group">
      <label>Match Scope</label>
      <select class="crida__select" id="crida-plugin-scope">
        <option value="all" ${plugin.matchScope === "all" ? "selected" : ""}>All Requests/Responses</option>
        <option value="in_scope" ${plugin.matchScope === "in_scope" ? "selected" : ""}>In-Scope Only</option>
        <option value="regex" ${plugin.matchScope === "regex" ? "selected" : ""}>URL Regex Match</option>
      </select>
    </div>

    <div class="crida__form-group" id="crida-plugin-pattern-group" style="${plugin.matchScope === "regex" ? "" : "display: none;"}">
      <label>URL Match Pattern (Regex)</label>
      <input type="text" class="crida__input" id="crida-plugin-pattern" value="${escapeHtml(plugin.matchPattern)}" placeholder=".*api\\.example\\.com.*" />
    </div>

    <div class="crida__form-group">
      <label>Parameter Extraction</label>
      <select class="crida__select" id="crida-plugin-param-type">
        <option value="full_body" ${plugin.parameterType === "full_body" ? "selected" : ""}>Full Request/Response Body</option>
        <option value="header_value" ${plugin.parameterType === "header_value" ? "selected" : ""}>Specific Header Value</option>
        <option value="regex_match" ${plugin.parameterType === "regex_match" ? "selected" : ""}>Regex Match from Body</option>
        <option value="selected_text" ${plugin.parameterType === "selected_text" ? "selected" : ""}>User Selected Text</option>
      </select>
    </div>

    <div class="crida__form-group" id="crida-plugin-header-group" style="${plugin.parameterType === "header_value" ? "" : "display: none;"}">
      <label>Header Name</label>
      <input type="text" class="crida__input" id="crida-plugin-header" value="${escapeHtml(plugin.headerName)}" placeholder="e.g. Authorization, X-Signature" />
    </div>

    <div class="crida__form-group" id="crida-plugin-regex-group" style="${plugin.parameterType === "regex_match" ? "" : "display: none;"}">
      <label>Extraction Regex</label>
      <input type="text" class="crida__input" id="crida-plugin-regex" value="${escapeHtml(plugin.parameterRegex)}" placeholder='e.g. "token":"([^"]+)"' />
    </div>

    <hr style="border: none; border-top: 1px solid #30363d; margin: 16px 0;" />

    <div class="crida__btn-group">
      <button class="crida__btn crida__btn--primary" id="crida-save-plugin">
        <i class="fas fa-save"></i> Save Plugin
      </button>
      <button class="crida__btn crida__btn--secondary" id="crida-test-plugin">
        <i class="fas fa-flask"></i> Test Plugin
      </button>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #8b949e; margin-left: auto;">
        <input type="checkbox" id="crida-plugin-enabled" ${plugin.enabled ? "checked" : ""} /> Enabled
      </label>
    </div>

    <div id="crida-plugin-test-result" style="margin-top: 12px;"></div>
  `;

  setupConfigEvents(configPanel, container, sdk, plugin);
}

function setupConfigEvents(
  configPanel: HTMLElement,
  container: HTMLElement,
  sdk: CaidoSDK,
  plugin: CustomPluginDef
): void {
  const scopeSelect = configPanel.querySelector("#crida-plugin-scope") as HTMLSelectElement;
  const patternGroup = configPanel.querySelector("#crida-plugin-pattern-group") as HTMLElement;
  const paramTypeSelect = configPanel.querySelector("#crida-plugin-param-type") as HTMLSelectElement;
  const headerGroup = configPanel.querySelector("#crida-plugin-header-group") as HTMLElement;
  const regexGroup = configPanel.querySelector("#crida-plugin-regex-group") as HTMLElement;
  const saveBtn = configPanel.querySelector("#crida-save-plugin") as HTMLButtonElement;
  const testBtn = configPanel.querySelector("#crida-test-plugin") as HTMLButtonElement;
  const deleteBtn = configPanel.querySelector("#crida-delete-plugin") as HTMLButtonElement;

  scopeSelect.addEventListener("change", () => {
    patternGroup.style.display = scopeSelect.value === "regex" ? "" : "none";
  });

  paramTypeSelect.addEventListener("change", () => {
    headerGroup.style.display = paramTypeSelect.value === "header_value" ? "" : "none";
    regexGroup.style.display = paramTypeSelect.value === "regex_match" ? "" : "none";
  });

  saveBtn.addEventListener("click", () => {
    plugin.name = (configPanel.querySelector("#crida-plugin-name") as HTMLInputElement).value;
    plugin.description = (configPanel.querySelector("#crida-plugin-desc") as HTMLInputElement).value;
    plugin.type = (configPanel.querySelector("#crida-plugin-type") as HTMLSelectElement).value;
    plugin.fridaExportName = (configPanel.querySelector("#crida-plugin-export") as HTMLInputElement).value;
    plugin.inputEncoding = (configPanel.querySelector("#crida-plugin-input-enc") as HTMLSelectElement).value;
    plugin.outputEncoding = (configPanel.querySelector("#crida-plugin-output-enc") as HTMLSelectElement).value;
    plugin.matchScope = scopeSelect.value;
    plugin.matchPattern = (configPanel.querySelector("#crida-plugin-pattern") as HTMLInputElement).value;
    plugin.parameterType = paramTypeSelect.value;
    plugin.headerName = (configPanel.querySelector("#crida-plugin-header") as HTMLInputElement).value;
    plugin.parameterRegex = (configPanel.querySelector("#crida-plugin-regex") as HTMLInputElement).value;
    plugin.enabled = (configPanel.querySelector("#crida-plugin-enabled") as HTMLInputElement).checked;

    renderPluginList(container, sdk);
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved';
    setTimeout(() => {
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Plugin';
    }, 1500);
  });

  testBtn.addEventListener("click", async () => {
    const testResult = configPanel.querySelector("#crida-plugin-test-result") as HTMLElement;
    const exportName = (configPanel.querySelector("#crida-plugin-export") as HTMLInputElement).value;

    if (!exportName) {
      testResult.innerHTML = '<div style="color: #f85149; font-size: 13px;">Please configure a Frida RPC export name first</div>';
      return;
    }

    testResult.innerHTML = '<div style="color: #8b949e; font-size: 13px;"><span class="crida__spinner"></span> Testing export call...</div>';

    const result = await sdk.backend.callRpcExport(exportName, ["test_input"]);

    if (result.success) {
      testResult.innerHTML = `
        <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 12px;">
          <div style="color: #3fb950; margin-bottom: 4px;">✓ Export "${escapeHtml(exportName)}" called successfully</div>
          <div style="color: #e1e4e8;">${escapeHtml(JSON.stringify(result.result, null, 2))}</div>
        </div>
      `;
    } else {
      testResult.innerHTML = `
        <div style="background: #0d1117; border: 1px solid #f85149; border-radius: 4px; padding: 8px; font-family: monospace; font-size: 12px;">
          <div style="color: #f85149;">✗ Export call failed: ${escapeHtml(result.error ?? "Unknown error")}</div>
        </div>
      `;
    }
  });

  deleteBtn.addEventListener("click", () => {
    plugins = plugins.filter((p) => p.id !== plugin.id);
    selectedPluginId = plugins.length > 0 ? plugins[0]!.id : null;
    renderPluginList(container, sdk);
    renderPluginConfig(container, sdk);
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
