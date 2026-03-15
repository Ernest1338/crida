// ============================================================================
// Crida Frontend - Dashboard Component
// Connection management and overview
// ============================================================================

import type { CaidoSDK } from "../types";

export function createDashboard(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.className = "crida__dashboard";
  container.innerHTML = `
    <div class="crida__card">
      <h3><i class="fas fa-plug"></i> Bridge Connection</h3>
      <div class="crida__form-group">
        <label>Bridge Host</label>
        <input type="text" class="crida__input" id="crida-bridge-host" value="127.0.0.1" placeholder="127.0.0.1" />
      </div>
      <div class="crida__form-group">
        <label>Bridge Port</label>
        <input type="number" class="crida__input" id="crida-bridge-port" value="28092" placeholder="28092" />
      </div>
      <div class="crida__form-group">
        <label>Device Type</label>
        <select class="crida__select" id="crida-device-type">
          <option value="usb">USB</option>
          <option value="local">Local</option>
          <option value="remote">Remote</option>
        </select>
      </div>
      <div class="crida__form-group" id="crida-remote-settings" style="display: none;">
        <label>Remote Frida Host</label>
        <input type="text" class="crida__input" id="crida-remote-host" placeholder="192.168.1.100" />
        <label style="margin-top: 8px;">Remote Frida Port</label>
        <input type="number" class="crida__input" id="crida-remote-port" value="27042" placeholder="27042" />
      </div>
      <div class="crida__btn-group">
        <button class="crida__btn crida__btn--primary" id="crida-connect-btn">
          <i class="fas fa-link"></i> Connect
        </button>
        <button class="crida__btn crida__btn--danger" id="crida-disconnect-btn" disabled>
          <i class="fas fa-unlink"></i> Disconnect
        </button>
      </div>
    </div>

    <div class="crida__card">
      <h3><i class="fas fa-info-circle"></i> Connection Status</h3>
      <div id="crida-status-info">
        <div class="crida__form-group">
          <label>Bridge</label>
          <div id="crida-bridge-status" style="font-size: 13px;">
            <span class="crida__status-indicator crida__status-indicator--disconnected"></span>
            Not connected
          </div>
        </div>
        <div class="crida__form-group">
          <label>Device</label>
          <div id="crida-device-status" style="font-size: 13px;">
            <span class="crida__status-indicator crida__status-indicator--disconnected"></span>
            Not connected
          </div>
        </div>
        <div class="crida__form-group">
          <label>Attached Process</label>
          <div id="crida-process-status" style="font-size: 13px; color: #8b949e;">
            None
          </div>
        </div>
      </div>
    </div>

    <div class="crida__card">
      <h3><i class="fas fa-mobile-alt"></i> Applications</h3>
      <div class="crida__btn-group" style="margin-bottom: 12px;">
        <button class="crida__btn crida__btn--secondary crida__btn--small" id="crida-refresh-apps">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
      <div class="crida__filter">
        <input type="text" class="crida__input" id="crida-app-filter" placeholder="Filter applications..." />
      </div>
      <div class="crida__table-wrapper" style="max-height: 250px;">
        <table class="crida__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Identifier</th>
              <th>PID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="crida-apps-table">
            <tr><td colspan="4" style="text-align: center; color: #8b949e;">Click Refresh to load applications</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="crida__card">
      <h3><i class="fas fa-cogs"></i> Processes</h3>
      <div class="crida__btn-group" style="margin-bottom: 12px;">
        <button class="crida__btn crida__btn--secondary crida__btn--small" id="crida-refresh-processes">
          <i class="fas fa-sync-alt"></i> Refresh
        </button>
      </div>
      <div class="crida__filter">
        <input type="text" class="crida__input" id="crida-process-filter" placeholder="Filter processes..." />
      </div>
      <div class="crida__table-wrapper" style="max-height: 250px;">
        <table class="crida__table">
          <thead>
            <tr>
              <th>PID</th>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="crida-processes-table">
            <tr><td colspan="3" style="text-align: center; color: #8b949e;">Click Refresh to load processes</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="crida__card crida__card--full">
      <h3><i class="fas fa-exchange-alt"></i> RPC Export Tester</h3>
      <p style="font-size: 12px; color: #8b949e; margin: 0 0 12px 0;">
        Call Frida RPC exports defined in your loaded scripts. Exports are functions defined in <code>rpc.exports</code>.
      </p>
      <div class="crida__rpc-tester">
        <div>
          <div class="crida__form-group">
            <label>Export Name</label>
            <input type="text" class="crida__input" id="crida-rpc-export-name" placeholder="e.g. decrypt" />
          </div>
          <div class="crida__form-group">
            <label>Arguments (JSON array)</label>
            <textarea class="crida__rpc-input" id="crida-rpc-args" placeholder='["arg1", "arg2"]'>[]</textarea>
          </div>
          <div class="crida__btn-group">
            <button class="crida__btn crida__btn--primary" id="crida-rpc-call-btn">
              <i class="fas fa-play"></i> Call Export
            </button>
            <button class="crida__btn crida__btn--secondary" id="crida-rpc-list-btn">
              <i class="fas fa-list"></i> List Exports
            </button>
          </div>
        </div>
        <div>
          <div class="crida__form-group">
            <label>Result</label>
            <div class="crida__rpc-output" id="crida-rpc-result">
              <span style="color: #8b949e;">Results will appear here...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupDashboardEvents(container, sdk);
  return container;
}

function setupDashboardEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const deviceTypeSelect = container.querySelector("#crida-device-type") as HTMLSelectElement;
  const remoteSettings = container.querySelector("#crida-remote-settings") as HTMLElement;
  const connectBtn = container.querySelector("#crida-connect-btn") as HTMLButtonElement;
  const disconnectBtn = container.querySelector("#crida-disconnect-btn") as HTMLButtonElement;
  const refreshAppsBtn = container.querySelector("#crida-refresh-apps") as HTMLButtonElement;
  const refreshProcessesBtn = container.querySelector("#crida-refresh-processes") as HTMLButtonElement;
  const appFilter = container.querySelector("#crida-app-filter") as HTMLInputElement;
  const processFilter = container.querySelector("#crida-process-filter") as HTMLInputElement;
  const rpcCallBtn = container.querySelector("#crida-rpc-call-btn") as HTMLButtonElement;
  const rpcListBtn = container.querySelector("#crida-rpc-list-btn") as HTMLButtonElement;

  // Show/hide remote settings
  deviceTypeSelect.addEventListener("change", () => {
    remoteSettings.style.display = deviceTypeSelect.value === "remote" ? "block" : "none";
  });

  // Connect
  connectBtn.addEventListener("click", async () => {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="crida__spinner"></span> Connecting...';

    const config = {
      bridgeHost: (container.querySelector("#crida-bridge-host") as HTMLInputElement).value,
      bridgePort: parseInt((container.querySelector("#crida-bridge-port") as HTMLInputElement).value, 10),
      deviceType: deviceTypeSelect.value as "usb" | "local" | "remote",
      remoteHost: (container.querySelector("#crida-remote-host") as HTMLInputElement).value || undefined,
      remotePort: parseInt((container.querySelector("#crida-remote-port") as HTMLInputElement).value, 10) || undefined,
    };

    const status = await sdk.backend.connect(config);
    updateStatusDisplay(container, status);

    connectBtn.disabled = false;
    connectBtn.innerHTML = '<i class="fas fa-link"></i> Connect';
    disconnectBtn.disabled = !status.bridgeConnected;
  });

  // Disconnect
  disconnectBtn.addEventListener("click", async () => {
    await sdk.backend.disconnect();
    updateStatusDisplay(container, {
      connected: false,
      bridgeConnected: false,
      deviceConnected: false,
    });
    disconnectBtn.disabled = true;
  });

  // Refresh apps
  refreshAppsBtn.addEventListener("click", async () => {
    refreshAppsBtn.disabled = true;
    const apps = await sdk.backend.listApplications();
    renderApplicationsTable(container, sdk, apps, "");
    refreshAppsBtn.disabled = false;
  });

  // Filter apps
  appFilter.addEventListener("input", async () => {
    const apps = await sdk.backend.listApplications();
    renderApplicationsTable(container, sdk, apps, appFilter.value);
  });

  // Refresh processes
  refreshProcessesBtn.addEventListener("click", async () => {
    refreshProcessesBtn.disabled = true;
    const procs = await sdk.backend.listProcesses();
    renderProcessesTable(container, sdk, procs, "");
    refreshProcessesBtn.disabled = false;
  });

  // Filter processes
  processFilter.addEventListener("input", async () => {
    const procs = await sdk.backend.listProcesses();
    renderProcessesTable(container, sdk, procs, processFilter.value);
  });

  // RPC call
  rpcCallBtn.addEventListener("click", async () => {
    const exportName = (container.querySelector("#crida-rpc-export-name") as HTMLInputElement).value;
    const argsStr = (container.querySelector("#crida-rpc-args") as HTMLTextAreaElement).value;
    const resultDiv = container.querySelector("#crida-rpc-result") as HTMLElement;

    if (!exportName) {
      resultDiv.innerHTML = '<span style="color: #f85149;">Please enter an export name</span>';
      return;
    }

    let args: unknown[];
    try {
      args = JSON.parse(argsStr) as unknown[];
    } catch {
      resultDiv.innerHTML = '<span style="color: #f85149;">Invalid JSON in arguments</span>';
      return;
    }

    resultDiv.innerHTML = '<span class="crida__spinner"></span> Calling...';
    const result = await sdk.backend.callRpcExport(exportName, args);

    if (result.success) {
      resultDiv.innerHTML = `<span style="color: #3fb950;">Success:</span>\n${JSON.stringify(result.result, null, 2)}`;
    } else {
      resultDiv.innerHTML = `<span style="color: #f85149;">Error:</span> ${result.error ?? "Unknown error"}`;
    }
  });

  // List exports
  rpcListBtn.addEventListener("click", async () => {
    const resultDiv = container.querySelector("#crida-rpc-result") as HTMLElement;
    resultDiv.innerHTML = '<span class="crida__spinner"></span> Loading exports...';
    const exports = await sdk.backend.listRpcExports();
    if (exports.length > 0) {
      resultDiv.innerHTML = `<span style="color: #3fb950;">Available exports:</span>\n${exports.map((e) => `  • ${e}`).join("\n")}`;
    } else {
      resultDiv.innerHTML = '<span style="color: #d29922;">No RPC exports found. Load a script with rpc.exports first.</span>';
    }
  });
}

interface ConnectionStatus {
  connected: boolean;
  bridgeConnected: boolean;
  deviceConnected: boolean;
  deviceInfo?: { id: string; name: string; type: string };
  attachedApp?: { pid: number; name: string; identifier: string };
  error?: string;
}

function updateStatusDisplay(container: HTMLElement, status: ConnectionStatus): void {
  const bridgeStatus = container.querySelector("#crida-bridge-status") as HTMLElement;
  const deviceStatus = container.querySelector("#crida-device-status") as HTMLElement;
  const processStatus = container.querySelector("#crida-process-status") as HTMLElement;

  if (status.bridgeConnected) {
    bridgeStatus.innerHTML = '<span class="crida__status-indicator crida__status-indicator--connected"></span> Connected';
  } else {
    bridgeStatus.innerHTML = `<span class="crida__status-indicator crida__status-indicator--disconnected"></span> ${status.error ?? "Not connected"}`;
  }

  if (status.deviceConnected && status.deviceInfo) {
    deviceStatus.innerHTML = `<span class="crida__status-indicator crida__status-indicator--connected"></span> ${status.deviceInfo.name} (${status.deviceInfo.type})`;
  } else if (status.bridgeConnected) {
    deviceStatus.innerHTML = '<span class="crida__status-indicator crida__status-indicator--partial"></span> Bridge connected, device pending';
  } else {
    deviceStatus.innerHTML = '<span class="crida__status-indicator crida__status-indicator--disconnected"></span> Not connected';
  }

  if (status.attachedApp) {
    processStatus.textContent = `${status.attachedApp.name} (PID: ${status.attachedApp.pid})`;
  } else {
    processStatus.textContent = "None";
  }
}

interface AppEntry {
  pid: number;
  name: string;
  identifier: string;
}

function renderApplicationsTable(
  container: HTMLElement,
  sdk: CaidoSDK,
  apps: AppEntry[],
  filter: string
): void {
  const tbody = container.querySelector("#crida-apps-table") as HTMLElement;
  const filtered = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(filter.toLowerCase()) ||
      a.identifier.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8b949e;">${
      apps.length === 0 ? "No applications found" : "No matches"
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (app) => `
    <tr>
      <td>${escapeHtml(app.name)}</td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(app.identifier)}</td>
      <td>${app.pid > 0 ? app.pid : '<span style="color: #8b949e;">—</span>'}</td>
      <td>
        <button class="crida__btn crida__btn--small crida__btn--primary crida-spawn-btn" data-identifier="${escapeHtml(app.identifier)}">
          Spawn
        </button>
        ${
          app.pid > 0
            ? `<button class="crida__btn crida__btn--small crida__btn--secondary crida-attach-btn" data-pid="${app.pid}">
                Attach
              </button>`
            : ""
        }
      </td>
    </tr>
  `
    )
    .join("");

  // Bind spawn buttons
  tbody.querySelectorAll(".crida-spawn-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const identifier = (btn as HTMLElement).dataset["identifier"];
      if (identifier) {
        (btn as HTMLButtonElement).disabled = true;
        (btn as HTMLButtonElement).textContent = "Spawning...";
        await sdk.backend.spawnAndAttach(identifier);
        (btn as HTMLButtonElement).textContent = "Spawned ✓";
      }
    });
  });

  // Bind attach buttons
  tbody.querySelectorAll(".crida-attach-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pid = parseInt((btn as HTMLElement).dataset["pid"] ?? "0", 10);
      if (pid > 0) {
        (btn as HTMLButtonElement).disabled = true;
        (btn as HTMLButtonElement).textContent = "Attaching...";
        await sdk.backend.attachToProcess(pid);
        (btn as HTMLButtonElement).textContent = "Attached ✓";
      }
    });
  });
}

interface ProcEntry {
  pid: number;
  name: string;
}

function renderProcessesTable(
  container: HTMLElement,
  sdk: CaidoSDK,
  procs: ProcEntry[],
  filter: string
): void {
  const tbody = container.querySelector("#crida-processes-table") as HTMLElement;
  const filtered = procs.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #8b949e;">${
      procs.length === 0 ? "No processes found" : "No matches"
    }</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .slice(0, 200) // Limit to 200 for performance
    .map(
      (proc) => `
    <tr>
      <td>${proc.pid}</td>
      <td>${escapeHtml(proc.name)}</td>
      <td>
        <button class="crida__btn crida__btn--small crida__btn--secondary crida-attach-proc-btn" data-pid="${proc.pid}">
          Attach
        </button>
      </td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll(".crida-attach-proc-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pid = parseInt((btn as HTMLElement).dataset["pid"] ?? "0", 10);
      if (pid > 0) {
        (btn as HTMLButtonElement).disabled = true;
        (btn as HTMLButtonElement).textContent = "Attaching...";
        await sdk.backend.attachToProcess(pid);
        (btn as HTMLButtonElement).textContent = "Attached ✓";
      }
    });
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
