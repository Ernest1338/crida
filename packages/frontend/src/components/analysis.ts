// ============================================================================
// Crida Frontend - Binary Analysis Component
// Class/method enumeration, module inspection, and hook management
// ============================================================================

import type { CaidoSDK } from "../types";

export function createAnalysisPanel(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="crida__card">
        <h3><i class="fas fa-sitemap"></i> Class Browser</h3>
        <div class="crida__filter">
          <input type="text" class="crida__input" id="crida-class-filter" placeholder="Filter classes (e.g. com.example)" />
          <button class="crida__btn crida__btn--primary crida__btn--small" id="crida-enum-classes-btn">
            <i class="fas fa-search"></i> Search
          </button>
        </div>
        <div class="crida__table-wrapper" id="crida-classes-container" style="max-height: 500px;">
          <div class="crida__empty">
            <i class="fas fa-cubes"></i>
            <p>Enter a filter and click Search to enumerate classes</p>
          </div>
        </div>
      </div>

      <div class="crida__card">
        <h3><i class="fas fa-code"></i> Methods & Fields</h3>
        <div id="crida-methods-container">
          <div class="crida__empty">
            <i class="fas fa-hand-pointer"></i>
            <p>Select a class to view its methods</p>
          </div>
        </div>
      </div>

      <div class="crida__card">
        <h3><i class="fas fa-puzzle-piece"></i> Modules</h3>
        <div class="crida__btn-group" style="margin-bottom: 12px;">
          <button class="crida__btn crida__btn--secondary crida__btn--small" id="crida-enum-modules-btn">
            <i class="fas fa-sync-alt"></i> Enumerate Modules
          </button>
        </div>
        <div class="crida__filter">
          <input type="text" class="crida__input" id="crida-module-filter" placeholder="Filter modules..." />
        </div>
        <div class="crida__table-wrapper" id="crida-modules-container" style="max-height: 400px;">
          <div class="crida__empty">
            <i class="fas fa-puzzle-piece"></i>
            <p>Click Enumerate to list loaded modules</p>
          </div>
        </div>
      </div>

      <div class="crida__card">
        <h3><i class="fas fa-file-export"></i> Module Exports / Imports</h3>
        <div id="crida-exports-container">
          <div class="crida__empty">
            <i class="fas fa-hand-pointer"></i>
            <p>Select a module to view its exports and imports</p>
          </div>
        </div>
      </div>
    </div>

    <div class="crida__card" style="margin-top: 16px;">
      <h3><i class="fas fa-crosshairs"></i> Active Inspection Hooks</h3>
      <div class="crida__btn-group" style="margin-bottom: 12px;">
        <button class="crida__btn crida__btn--secondary crida__btn--small" id="crida-add-hook-btn">
          <i class="fas fa-plus"></i> Add Custom Hook
        </button>
      </div>
      <div class="crida__table-wrapper" id="crida-active-hooks-container">
        <table class="crida__table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Class</th>
              <th>Method</th>
              <th>Return Override</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="crida-active-hooks-table">
            <tr><td colspan="5" style="text-align: center; color: #8b949e;">No active hooks. Add inspection or tamper hooks from the class browser.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  setupAnalysisEvents(container, sdk);
  return container;
}

interface ActiveHook {
  hookId: string;
  type: string;
  className: string;
  methodName: string;
  returnValue?: string;
}

const activeHooks: ActiveHook[] = [];

function setupAnalysisEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const enumClassesBtn = container.querySelector("#crida-enum-classes-btn") as HTMLButtonElement;
  const classFilter = container.querySelector("#crida-class-filter") as HTMLInputElement;
  const enumModulesBtn = container.querySelector("#crida-enum-modules-btn") as HTMLButtonElement;
  const moduleFilter = container.querySelector("#crida-module-filter") as HTMLInputElement;
  const addHookBtn = container.querySelector("#crida-add-hook-btn") as HTMLButtonElement;

  // Enumerate classes
  enumClassesBtn.addEventListener("click", async () => {
    enumClassesBtn.disabled = true;
    enumClassesBtn.innerHTML = '<span class="crida__spinner"></span> Searching...';

    const filter = classFilter.value || undefined;
    const classes = await sdk.backend.enumerateClasses(filter);
    renderClasses(container, sdk, classes);

    enumClassesBtn.innerHTML = '<i class="fas fa-search"></i> Search';
    enumClassesBtn.disabled = false;
  });

  // Enter key on class filter
  classFilter.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enumClassesBtn.click();
  });

  // Enumerate modules
  enumModulesBtn.addEventListener("click", async () => {
    enumModulesBtn.disabled = true;
    const modules = await sdk.backend.enumerateModules();
    renderModules(container, sdk, modules, "");
    enumModulesBtn.disabled = false;
  });

  // Module filter
  let allModules: ModuleEntry[] = [];
  moduleFilter.addEventListener("input", () => {
    renderModules(container, sdk, allModules, moduleFilter.value);
  });

  // Store modules for filtering
  const origEnumClick = enumModulesBtn.onclick;
  enumModulesBtn.addEventListener("click", async () => {
    if (origEnumClick) return;
    allModules = await sdk.backend.enumerateModules();
  });

  // Add custom hook
  addHookBtn.addEventListener("click", () => {
    showAddHookDialog(container, sdk);
  });
}

function renderClasses(container: HTMLElement, sdk: CaidoSDK, classes: string[]): void {
  const classesContainer = container.querySelector("#crida-classes-container") as HTMLElement;

  if (classes.length === 0) {
    classesContainer.innerHTML = `
      <div class="crida__empty">
        <i class="fas fa-search"></i>
        <p>No classes found matching your filter</p>
      </div>
    `;
    return;
  }

  classesContainer.innerHTML = `
    <div style="margin-bottom: 8px; font-size: 12px; color: #8b949e;">
      Found ${classes.length} class${classes.length !== 1 ? "es" : ""}
    </div>
    <div class="crida__tree" id="crida-class-tree">
      ${classes
        .slice(0, 500)
        .map(
          (cls) => `
        <div class="crida__tree-node">
          <span class="crida__tree-toggle crida-class-name" data-class="${escapeHtml(cls)}">${escapeHtml(cls)}</span>
          <span class="crida__tree-actions">
            <button class="crida-inspect-class" data-class="${escapeHtml(cls)}" title="Inspect methods">🔍</button>
          </span>
        </div>
      `
        )
        .join("")}
      ${classes.length > 500 ? `<div style="color: #d29922; padding: 8px 0; font-size: 12px;">Showing first 500 of ${classes.length} classes. Use a more specific filter.</div>` : ""}
    </div>
  `;

  // Bind class clicks
  classesContainer.querySelectorAll(".crida-class-name, .crida-inspect-class").forEach((el) => {
    el.addEventListener("click", async () => {
      const className = (el as HTMLElement).dataset["class"]!;
      const methodsContainer = container.querySelector("#crida-methods-container") as HTMLElement;
      methodsContainer.innerHTML = '<div class="crida__empty"><span class="crida__spinner"></span><p>Loading methods...</p></div>';

      const classInfo = await sdk.backend.getClassMethods(className);
      renderClassMethods(container, sdk, className, classInfo);
    });
  });
}

interface ClassInfoResult {
  name: string;
  methods: Array<{
    name: string;
    returnType: string;
    argumentTypes: string[];
    isConstructor: boolean;
  }>;
  fields?: Array<{
    name: string;
    type: string;
    value?: string;
  }>;
  superClass?: string;
}

function renderClassMethods(
  container: HTMLElement,
  sdk: CaidoSDK,
  className: string,
  classInfo: ClassInfoResult | null
): void {
  const methodsContainer = container.querySelector("#crida-methods-container") as HTMLElement;

  if (!classInfo) {
    methodsContainer.innerHTML = `
      <div class="crida__empty">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Could not load class information</p>
      </div>
    `;
    return;
  }

  const methods = classInfo.methods || [];
  const fields = classInfo.fields || [];

  methodsContainer.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong style="color: #58a6ff;">${escapeHtml(className)}</strong>
      ${classInfo.superClass ? `<span style="color: #8b949e;"> extends ${escapeHtml(classInfo.superClass)}</span>` : ""}
    </div>

    ${methods.length > 0 ? `
      <div style="margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase;">
        Methods (${methods.length})
      </div>
      <div class="crida__tree">
        ${methods
          .map(
            (m) => `
          <div class="crida__tree-leaf">
            <span style="color: ${m.isConstructor ? "#d29922" : "#3fb950"};">${escapeHtml(m.returnType)}</span>
            <span style="color: #e1e4e8;">${escapeHtml(m.name)}</span>(<span style="color: #8b949e;">${m.argumentTypes.map(escapeHtml).join(", ")}</span>)
            <span class="crida__tree-actions">
              <button class="crida-hook-inspect" data-class="${escapeHtml(className)}" data-method="${escapeHtml(m.name)}" title="Add inspection hook">👁</button>
              <button class="crida-hook-tamper" data-class="${escapeHtml(className)}" data-method="${escapeHtml(m.name)}" title="Add tamper hook">✏️</button>
            </span>
          </div>
        `
          )
          .join("")}
      </div>
    ` : ""}

    ${fields.length > 0 ? `
      <div style="margin-top: 12px; margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase;">
        Fields (${fields.length})
      </div>
      <div class="crida__tree">
        ${fields
          .map(
            (f) => `
          <div class="crida__tree-leaf">
            <span style="color: #bc8cff;">${escapeHtml(f.type)}</span>
            <span style="color: #e1e4e8;">${escapeHtml(f.name)}</span>
            ${f.value ? `<span style="color: #8b949e;"> = ${escapeHtml(f.value)}</span>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    ` : ""}
  `;

  // Bind inspection hook buttons
  methodsContainer.querySelectorAll(".crida-hook-inspect").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cls = (btn as HTMLElement).dataset["class"]!;
      const method = (btn as HTMLElement).dataset["method"]!;
      const result = await sdk.backend.addInspectionHook(cls, method);
      if (result.success && result.hookId) {
        activeHooks.push({ hookId: result.hookId, type: "inspect", className: cls, methodName: method });
        renderActiveHooks(container, sdk);
        (btn as HTMLButtonElement).textContent = "✓";
        (btn as HTMLButtonElement).disabled = true;
      }
    });
  });

  // Bind tamper hook buttons
  methodsContainer.querySelectorAll(".crida-hook-tamper").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cls = (btn as HTMLElement).dataset["class"]!;
      const method = (btn as HTMLElement).dataset["method"]!;
      showTamperDialog(container, sdk, cls, method);
    });
  });
}

interface ModuleEntry {
  name: string;
  base: string;
  size: number;
  path: string;
}

function renderModules(
  container: HTMLElement,
  sdk: CaidoSDK,
  modules: ModuleEntry[],
  filter: string
): void {
  const modulesContainer = container.querySelector("#crida-modules-container") as HTMLElement;

  const filtered = modules.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    modulesContainer.innerHTML = `
      <div class="crida__empty">
        <i class="fas fa-puzzle-piece"></i>
        <p>${modules.length === 0 ? "No modules found" : "No modules match filter"}</p>
      </div>
    `;
    return;
  }

  modulesContainer.innerHTML = `
    <table class="crida__table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Base</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .slice(0, 200)
          .map(
            (m) => `
          <tr class="crida-module-row" data-module="${escapeHtml(m.name)}" style="cursor: pointer;">
            <td style="color: #58a6ff;">${escapeHtml(m.name)}</td>
            <td style="font-family: monospace; font-size: 12px;">${escapeHtml(m.base)}</td>
            <td>${formatSize(m.size)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  // Bind module clicks
  modulesContainer.querySelectorAll(".crida-module-row").forEach((row) => {
    row.addEventListener("click", async () => {
      const moduleName = (row as HTMLElement).dataset["module"]!;
      const exportsContainer = container.querySelector("#crida-exports-container") as HTMLElement;
      exportsContainer.innerHTML = '<div class="crida__empty"><span class="crida__spinner"></span><p>Loading exports...</p></div>';

      const [exports, imports] = await Promise.all([
        sdk.backend.getModuleExports(moduleName),
        sdk.backend.getModuleImports(moduleName),
      ]);

      renderModuleDetails(exportsContainer, moduleName, exports, imports);
    });
  });
}

interface ExportEntry {
  name: string;
  type: string;
  address: string;
}

interface ImportEntry {
  name: string;
  module: string;
  address: string;
  type: string;
}

function renderModuleDetails(
  container: HTMLElement,
  moduleName: string,
  exports: ExportEntry[],
  imports: ImportEntry[]
): void {
  container.innerHTML = `
    <div style="margin-bottom: 8px;">
      <strong style="color: #58a6ff;">${escapeHtml(moduleName)}</strong>
    </div>

    <div style="margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase;">
      Exports (${exports.length})
    </div>
    <div class="crida__table-wrapper" style="max-height: 200px; margin-bottom: 12px;">
      <table class="crida__table">
        <thead><tr><th>Name</th><th>Type</th><th>Address</th></tr></thead>
        <tbody>
          ${exports.length > 0
            ? exports
                .slice(0, 200)
                .map(
                  (e) => `
              <tr>
                <td style="font-family: monospace; font-size: 12px;">${escapeHtml(e.name)}</td>
                <td>${e.type}</td>
                <td style="font-family: monospace; font-size: 12px;">${escapeHtml(e.address)}</td>
              </tr>
            `
                )
                .join("")
            : '<tr><td colspan="3" style="color: #8b949e; text-align: center;">No exports</td></tr>'}
        </tbody>
      </table>
    </div>

    <div style="margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #8b949e; text-transform: uppercase;">
      Imports (${imports.length})
    </div>
    <div class="crida__table-wrapper" style="max-height: 200px;">
      <table class="crida__table">
        <thead><tr><th>Name</th><th>Module</th><th>Type</th></tr></thead>
        <tbody>
          ${imports.length > 0
            ? imports
                .slice(0, 200)
                .map(
                  (i) => `
              <tr>
                <td style="font-family: monospace; font-size: 12px;">${escapeHtml(i.name)}</td>
                <td>${escapeHtml(i.module)}</td>
                <td>${i.type}</td>
              </tr>
            `
                )
                .join("")
            : '<tr><td colspan="3" style="color: #8b949e; text-align: center;">No imports</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function renderActiveHooks(container: HTMLElement, sdk: CaidoSDK): void {
  const tbody = container.querySelector("#crida-active-hooks-table") as HTMLElement;

  if (activeHooks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #8b949e;">No active hooks</td></tr>';
    return;
  }

  tbody.innerHTML = activeHooks
    .map(
      (hook) => `
    <tr>
      <td><span class="crida__badge crida__badge--${hook.type === "inspect" ? "ios" : "android"}">${hook.type}</span></td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(hook.className)}</td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(hook.methodName)}</td>
      <td>${hook.returnValue ? escapeHtml(hook.returnValue) : '<span style="color: #8b949e;">—</span>'}</td>
      <td>
        <button class="crida__btn crida__btn--danger crida__btn--small crida-remove-hook" data-hook-id="${hook.hookId}">
          Remove
        </button>
      </td>
    </tr>
  `
    )
    .join("");

  tbody.querySelectorAll(".crida-remove-hook").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const hookId = (btn as HTMLElement).dataset["hookId"]!;
      await sdk.backend.removeHook(hookId);
      const idx = activeHooks.findIndex((h) => h.hookId === hookId);
      if (idx !== -1) activeHooks.splice(idx, 1);
      renderActiveHooks(container, sdk);
    });
  });
}

function showTamperDialog(
  container: HTMLElement,
  sdk: CaidoSDK,
  className: string,
  methodName: string
): void {
  const existing = document.querySelector("#crida-tamper-dialog");
  if (existing) existing.remove();

  const dialog = document.createElement("div");
  dialog.id = "crida-tamper-dialog";
  dialog.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  `;
  dialog.innerHTML = `
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; width: 400px;">
      <h3 style="margin: 0 0 12px 0; color: #e1e4e8; font-size: 14px;">Add Tamper Hook</h3>
      <p style="font-size: 12px; color: #8b949e; margin: 0 0 12px 0;">
        ${escapeHtml(className)}.${escapeHtml(methodName)}
      </p>
      <div class="crida__form-group">
        <label>Return Value (JS expression)</label>
        <input type="text" class="crida__input" id="crida-tamper-return" placeholder='e.g. true, "modified", null' />
      </div>
      <div class="crida__btn-group" style="justify-content: flex-end;">
        <button class="crida__btn crida__btn--secondary" id="crida-tamper-cancel">Cancel</button>
        <button class="crida__btn crida__btn--primary" id="crida-tamper-apply">Apply Tamper</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  dialog.querySelector("#crida-tamper-cancel")!.addEventListener("click", () => dialog.remove());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });

  dialog.querySelector("#crida-tamper-apply")!.addEventListener("click", async () => {
    const returnValue = (dialog.querySelector("#crida-tamper-return") as HTMLInputElement).value;
    const result = await sdk.backend.addTamperHook(className, methodName, returnValue);
    if (result.success && result.hookId) {
      activeHooks.push({
        hookId: result.hookId,
        type: "tamper",
        className,
        methodName,
        returnValue,
      });
      renderActiveHooks(container, sdk);
    }
    dialog.remove();
  });
}

function showAddHookDialog(container: HTMLElement, sdk: CaidoSDK): void {
  const existing = document.querySelector("#crida-add-hook-dialog");
  if (existing) existing.remove();

  const dialog = document.createElement("div");
  dialog.id = "crida-add-hook-dialog";
  dialog.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  `;
  dialog.innerHTML = `
    <div style="background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; width: 450px;">
      <h3 style="margin: 0 0 12px 0; color: #e1e4e8; font-size: 14px;">Add Custom Hook</h3>
      <div class="crida__form-group">
        <label>Hook Type</label>
        <select class="crida__select" id="crida-hook-type">
          <option value="inspect">Inspection (log args & return value)</option>
          <option value="tamper">Tamper (modify return value)</option>
        </select>
      </div>
      <div class="crida__form-group">
        <label>Class Name</label>
        <input type="text" class="crida__input" id="crida-hook-class" placeholder="com.example.ClassName" />
      </div>
      <div class="crida__form-group">
        <label>Method Name</label>
        <input type="text" class="crida__input" id="crida-hook-method" placeholder="methodName" />
      </div>
      <div class="crida__form-group" id="crida-hook-return-group" style="display: none;">
        <label>Return Value (JS expression)</label>
        <input type="text" class="crida__input" id="crida-hook-return" placeholder='true, "value", null' />
      </div>
      <div class="crida__btn-group" style="justify-content: flex-end;">
        <button class="crida__btn crida__btn--secondary" id="crida-hook-cancel">Cancel</button>
        <button class="crida__btn crida__btn--primary" id="crida-hook-add">Add Hook</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const typeSelect = dialog.querySelector("#crida-hook-type") as HTMLSelectElement;
  const returnGroup = dialog.querySelector("#crida-hook-return-group") as HTMLElement;

  typeSelect.addEventListener("change", () => {
    returnGroup.style.display = typeSelect.value === "tamper" ? "block" : "none";
  });

  dialog.querySelector("#crida-hook-cancel")!.addEventListener("click", () => dialog.remove());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.remove();
  });

  dialog.querySelector("#crida-hook-add")!.addEventListener("click", async () => {
    const type = typeSelect.value;
    const className = (dialog.querySelector("#crida-hook-class") as HTMLInputElement).value;
    const methodName = (dialog.querySelector("#crida-hook-method") as HTMLInputElement).value;
    const returnValue = (dialog.querySelector("#crida-hook-return") as HTMLInputElement).value;

    if (!className || !methodName) return;

    let result;
    if (type === "inspect") {
      result = await sdk.backend.addInspectionHook(className, methodName);
    } else {
      result = await sdk.backend.addTamperHook(className, methodName, returnValue);
    }

    if (result.success && result.hookId) {
      activeHooks.push({
        hookId: result.hookId,
        type,
        className,
        methodName,
        returnValue: type === "tamper" ? returnValue : undefined,
      });
      renderActiveHooks(container, sdk);
    }
    dialog.remove();
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
