// ============================================================================
// Crida Backend - Caido Plugin Entry Point
// Bridge between Caido and the Frida bridge server
// ============================================================================

import type { SDK, DefineAPI } from "caido:plugin";
import type {
  ConnectionConfig,
  ConnectionStatus,
  FridaApplication,
  FridaProcess,
  FridaScript,
  ClassInfo,
  ModuleInfo,
  ExportInfo,
  ImportInfo,
  RpcResult,
  KeystoreEntry,
  CertificateInfo,
  ConsoleMessage,
} from "crida-shared";
import { DEFAULT_CONNECTION_CONFIG } from "crida-shared";
import { FridaBridgeClient } from "./frida-bridge";
import { HOOKS_LIBRARY, getHooksByPlatform, getHooksByCategory } from "./hooks-library";

// Global state
let bridgeClient = new FridaBridgeClient(DEFAULT_CONNECTION_CONFIG);
let messageIdCounter = 0;

function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

function createConsoleMessage(
  level: ConsoleMessage["level"],
  source: string,
  message: string,
  data?: unknown
): ConsoleMessage {
  return {
    id: generateMessageId(),
    timestamp: Date.now(),
    level,
    source,
    message,
    data,
  };
}

// ============================================================================
// API Handlers
// ============================================================================

// -- Connection --

async function connect(
  sdk: SDK,
  config: ConnectionConfig
): Promise<ConnectionStatus> {
  try {
    bridgeClient.updateConfig(config);
    const pingResult = await bridgeClient.ping();

    if (!pingResult.success) {
      return {
        connected: false,
        bridgeConnected: false,
        deviceConnected: false,
        error: "Cannot reach Frida bridge server. Make sure it is running.",
      };
    }

    sdk.console.log(`Connected to Crida bridge v${pingResult.data?.version}`);

    const deviceResult = await bridgeClient.connectDevice(
      config.deviceType,
      config.remoteHost,
      config.remotePort
    );

    if (!deviceResult.success) {
      return {
        connected: true,
        bridgeConnected: true,
        deviceConnected: false,
        error: deviceResult.error ?? "Failed to connect to device",
      };
    }

    sdk.console.log(`Connected to device: ${deviceResult.data?.name}`);

    return {
      connected: true,
      bridgeConnected: true,
      deviceConnected: true,
      deviceInfo: deviceResult.data,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    sdk.console.log(`Connection error: ${errorMsg}`);
    return {
      connected: false,
      bridgeConnected: false,
      deviceConnected: false,
      error: errorMsg,
    };
  }
}

async function disconnect(sdk: SDK): Promise<boolean> {
  try {
    await bridgeClient.disconnectDevice();
    sdk.console.log("Disconnected from device");
    return true;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    sdk.console.log(`Disconnect error: ${errorMsg}`);
    return false;
  }
}

async function getStatus(sdk: SDK): Promise<ConnectionStatus> {
  try {
    const result = await bridgeClient.getStatus();
    return (
      result.data ?? {
        connected: false,
        bridgeConnected: false,
        deviceConnected: false,
      }
    );
  } catch {
    sdk.console.log("Bridge unreachable");
    return {
      connected: false,
      bridgeConnected: false,
      deviceConnected: false,
      error: "Bridge unreachable",
    };
  }
}

// -- Application Management --

async function listApplications(
  sdk: SDK
): Promise<FridaApplication[]> {
  try {
    const result = await bridgeClient.listApplications();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error listing apps: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function listProcesses(sdk: SDK): Promise<FridaProcess[]> {
  try {
    const result = await bridgeClient.listProcesses();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error listing processes: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function spawnAndAttach(
  sdk: SDK,
  identifier: string
): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    const result = await bridgeClient.spawnAndAttach(identifier);
    if (result.success && result.data) {
      sdk.console.log(`Spawned and attached to ${identifier} (PID: ${result.data.pid})`);
      return { success: true, pid: result.data.pid };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function attachToProcess(
  sdk: SDK,
  pid: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await bridgeClient.attach(pid);
    if (result.success) {
      sdk.console.log(`Attached to PID: ${pid}`);
      return { success: true };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function detachFromProcess(
  sdk: SDK
): Promise<boolean> {
  try {
    const result = await bridgeClient.detach();
    if (result.success) {
      sdk.console.log("Detached from process");
    }
    return result.success;
  } catch (e) {
    sdk.console.log(`Detach error: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

// -- Script Management --

async function loadScript(
  sdk: SDK,
  source: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const result = await bridgeClient.loadScript(source);
    if (result.success && result.data) {
      sdk.console.log("Frida script loaded successfully");
      return { success: true, id: result.data.id };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function unloadScript(
  sdk: SDK
): Promise<boolean> {
  try {
    const result = await bridgeClient.unloadScript();
    if (result.success) {
      sdk.console.log("Frida script unloaded");
    }
    return result.success;
  } catch (e) {
    sdk.console.log(`Unload error: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

// -- RPC Exports --

async function callRpcExport(
  sdk: SDK,
  exportName: string,
  args: unknown[]
): Promise<RpcResult> {
  try {
    const result = await bridgeClient.callExport(exportName, args);
    if (result.success && result.data) {
      return result.data;
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function listRpcExports(sdk: SDK): Promise<string[]> {
  try {
    const result = await bridgeClient.listExports();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error listing exports: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

// -- Binary Analysis --

async function enumerateClasses(
  sdk: SDK,
  filter?: string
): Promise<string[]> {
  try {
    const result = await bridgeClient.enumerateClasses(filter);
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error enumerating classes: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function getClassMethods(
  sdk: SDK,
  className: string
): Promise<ClassInfo | null> {
  try {
    const result = await bridgeClient.getClassMethods(className);
    return result.data ?? null;
  } catch (e) {
    sdk.console.log(`Error getting class methods: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function enumerateModules(
  sdk: SDK
): Promise<ModuleInfo[]> {
  try {
    const result = await bridgeClient.enumerateModules();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error enumerating modules: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function getModuleExports(
  sdk: SDK,
  moduleName: string
): Promise<ExportInfo[]> {
  try {
    const result = await bridgeClient.getModuleExports(moduleName);
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error getting module exports: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function getModuleImports(
  sdk: SDK,
  moduleName: string
): Promise<ImportInfo[]> {
  try {
    const result = await bridgeClient.getModuleImports(moduleName);
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error getting module imports: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

// -- Pre-built Hooks --

function getHooksLibrary(
  _sdk: SDK
): FridaScript[] {
  return HOOKS_LIBRARY;
}

function getHooksForPlatform(
  _sdk: SDK,
  platform: string
): FridaScript[] {
  return getHooksByPlatform(platform as "android" | "ios" | "any");
}

function getHooksForCategory(
  _sdk: SDK,
  category: string
): FridaScript[] {
  return getHooksByCategory(category as FridaScript["category"]);
}

async function runPrebuiltHook(
  sdk: SDK,
  hookId: string,
  platform: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await bridgeClient.runPrebuiltHook(hookId, platform);
    if (result.success) {
      sdk.console.log(`Pre-built hook ${hookId} applied`);
      return { success: true };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

// -- Inspection & Tamper Hooks --

async function addInspectionHook(
  sdk: SDK,
  className: string,
  methodName: string
): Promise<{ success: boolean; hookId?: string; error?: string }> {
  try {
    const result = await bridgeClient.addInspectionHook(className, methodName);
    if (result.success && result.data) {
      sdk.console.log(`Inspection hook added: ${className}.${methodName}`);
      return { success: true, hookId: result.data.hookId };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function addTamperHook(
  sdk: SDK,
  className: string,
  methodName: string,
  returnValue: string
): Promise<{ success: boolean; hookId?: string; error?: string }> {
  try {
    const result = await bridgeClient.addTamperHook(
      className,
      methodName,
      returnValue
    );
    if (result.success && result.data) {
      sdk.console.log(`Tamper hook added: ${className}.${methodName} -> ${returnValue}`);
      return { success: true, hookId: result.data.hookId };
    }
    return { success: false, error: result.error };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: errorMsg };
  }
}

async function removeHook(
  sdk: SDK,
  hookId: string
): Promise<boolean> {
  try {
    const result = await bridgeClient.removeHook(hookId);
    if (result.success) {
      sdk.console.log(`Hook removed: ${hookId}`);
    }
    return result.success;
  } catch (e) {
    sdk.console.log(`Error removing hook: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

// -- Platform-specific --

async function enumerateKeystores(
  sdk: SDK
): Promise<KeystoreEntry[]> {
  try {
    const result = await bridgeClient.enumerateKeystores();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error enumerating keystores: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function dumpSharedPreferences(
  sdk: SDK
): Promise<Record<string, unknown>> {
  try {
    const result = await bridgeClient.dumpSharedPreferences();
    return result.data ?? {};
  } catch (e) {
    sdk.console.log(`Error dumping shared prefs: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

async function enumerateCertificates(
  sdk: SDK
): Promise<CertificateInfo[]> {
  try {
    const result = await bridgeClient.enumerateCertificates();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error enumerating certificates: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function dumpKeychain(
  sdk: SDK
): Promise<Record<string, unknown>[]> {
  try {
    const result = await bridgeClient.dumpKeychain();
    return result.data ?? [];
  } catch (e) {
    sdk.console.log(`Error dumping keychain: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

// -- Console Messages --

async function getMessages(
  sdk: SDK
): Promise<ConsoleMessage[]> {
  try {
    const result = await bridgeClient.getMessages();
    if (result.success && result.data) {
      return result.data.map((m) =>
        createConsoleMessage(
          m.type === "error" ? "error" : m.type === "warning" ? "warning" : "info",
          "frida",
          m.payload
        )
      );
    }
    return [];
  } catch (e) {
    sdk.console.log(`Error getting messages: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function clearMessages(
  sdk: SDK
): Promise<boolean> {
  try {
    const result = await bridgeClient.clearMessages();
    return result.success;
  } catch (e) {
    sdk.console.log(`Error clearing messages: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

// ============================================================================
// API Type Definition
// ============================================================================

export type API = DefineAPI<{
  // Connection
  connect: typeof connect;
  disconnect: typeof disconnect;
  getStatus: typeof getStatus;

  // Apps & Processes
  listApplications: typeof listApplications;
  listProcesses: typeof listProcesses;
  spawnAndAttach: typeof spawnAndAttach;
  attachToProcess: typeof attachToProcess;
  detachFromProcess: typeof detachFromProcess;

  // Scripts
  loadScript: typeof loadScript;
  unloadScript: typeof unloadScript;

  // RPC
  callRpcExport: typeof callRpcExport;
  listRpcExports: typeof listRpcExports;

  // Analysis
  enumerateClasses: typeof enumerateClasses;
  getClassMethods: typeof getClassMethods;
  enumerateModules: typeof enumerateModules;
  getModuleExports: typeof getModuleExports;
  getModuleImports: typeof getModuleImports;

  // Hooks Library
  getHooksLibrary: typeof getHooksLibrary;
  getHooksForPlatform: typeof getHooksForPlatform;
  getHooksForCategory: typeof getHooksForCategory;
  runPrebuiltHook: typeof runPrebuiltHook;

  // Inspection & Tamper Hooks
  addInspectionHook: typeof addInspectionHook;
  addTamperHook: typeof addTamperHook;
  removeHook: typeof removeHook;

  // Platform-specific
  enumerateKeystores: typeof enumerateKeystores;
  dumpSharedPreferences: typeof dumpSharedPreferences;
  enumerateCertificates: typeof enumerateCertificates;
  dumpKeychain: typeof dumpKeychain;

  // Console
  getMessages: typeof getMessages;
  clearMessages: typeof clearMessages;
}>;

// ============================================================================
// Plugin Initialization
// ============================================================================

export function init(sdk: SDK<API>) {
  sdk.console.log("Crida plugin initializing...");

  // Connection
  sdk.api.register("connect", connect);
  sdk.api.register("disconnect", disconnect);
  sdk.api.register("getStatus", getStatus);

  // Apps & Processes
  sdk.api.register("listApplications", listApplications);
  sdk.api.register("listProcesses", listProcesses);
  sdk.api.register("spawnAndAttach", spawnAndAttach);
  sdk.api.register("attachToProcess", attachToProcess);
  sdk.api.register("detachFromProcess", detachFromProcess);

  // Scripts
  sdk.api.register("loadScript", loadScript);
  sdk.api.register("unloadScript", unloadScript);

  // RPC
  sdk.api.register("callRpcExport", callRpcExport);
  sdk.api.register("listRpcExports", listRpcExports);

  // Analysis
  sdk.api.register("enumerateClasses", enumerateClasses);
  sdk.api.register("getClassMethods", getClassMethods);
  sdk.api.register("enumerateModules", enumerateModules);
  sdk.api.register("getModuleExports", getModuleExports);
  sdk.api.register("getModuleImports", getModuleImports);

  // Hooks Library
  sdk.api.register("getHooksLibrary", getHooksLibrary);
  sdk.api.register("getHooksForPlatform", getHooksForPlatform);
  sdk.api.register("getHooksForCategory", getHooksForCategory);
  sdk.api.register("runPrebuiltHook", runPrebuiltHook);

  // Inspection & Tamper Hooks
  sdk.api.register("addInspectionHook", addInspectionHook);
  sdk.api.register("addTamperHook", addTamperHook);
  sdk.api.register("removeHook", removeHook);

  // Platform-specific
  sdk.api.register("enumerateKeystores", enumerateKeystores);
  sdk.api.register("dumpSharedPreferences", dumpSharedPreferences);
  sdk.api.register("enumerateCertificates", enumerateCertificates);
  sdk.api.register("dumpKeychain", dumpKeychain);

  // Console
  sdk.api.register("getMessages", getMessages);
  sdk.api.register("clearMessages", clearMessages);

  sdk.console.log("Crida plugin initialized - ready for Frida bridge connection");
}
