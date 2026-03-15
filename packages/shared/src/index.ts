// ============================================================================
// Crida Shared Types - Frida Bridge Protocol
// ============================================================================

// -- Connection & Device Types --

export type DeviceType = "local" | "usb" | "remote";

export interface FridaDevice {
  id: string;
  name: string;
  type: DeviceType;
}

export interface FridaApplication {
  pid: number;
  name: string;
  identifier: string;
}

export interface FridaProcess {
  pid: number;
  name: string;
}

export interface ConnectionConfig {
  bridgeHost: string;
  bridgePort: number;
  deviceType: DeviceType;
  remoteHost?: string;
  remotePort?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  bridgeConnected: boolean;
  deviceConnected: boolean;
  deviceInfo?: FridaDevice;
  attachedApp?: FridaApplication;
  error?: string;
}

// -- Script Types --

export interface FridaScript {
  id: string;
  name: string;
  source: string;
  category: ScriptCategory;
  description: string;
  platform: Platform;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ScriptCategory =
  | "ssl-pinning"
  | "root-detection"
  | "jailbreak-detection"
  | "crypto"
  | "network"
  | "storage"
  | "binary-analysis"
  | "tampering"
  | "custom";

export type Platform = "android" | "ios" | "any";

// -- Hook Types --

export interface HookDefinition {
  id: string;
  className: string;
  methodName: string;
  hookType: HookType;
  enabled: boolean;
  returnValue?: string;
  logArgs: boolean;
  logReturnValue: boolean;
  script?: string;
}

export type HookType = "inspect" | "tamper" | "replace";

// -- Analysis Types --

export interface ClassInfo {
  name: string;
  methods: MethodInfo[];
  fields?: FieldInfo[];
  superClass?: string;
}

export interface MethodInfo {
  name: string;
  returnType: string;
  argumentTypes: string[];
  isConstructor: boolean;
}

export interface FieldInfo {
  name: string;
  type: string;
  value?: string;
}

export interface ModuleInfo {
  name: string;
  base: string;
  size: number;
  path: string;
}

export interface ExportInfo {
  name: string;
  type: "function" | "variable";
  address: string;
}

export interface ImportInfo {
  name: string;
  module: string;
  address: string;
  type: string;
}

// -- Console / Logging --

export interface ConsoleMessage {
  id: string;
  timestamp: number;
  level: "info" | "warning" | "error" | "debug" | "success";
  source: string;
  message: string;
  data?: unknown;
}

// -- Custom Plugin Types (Brida-style) --

export interface CustomPlugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: CustomPluginType;
  config: CustomPluginConfig;
  createdAt: number;
}

export type CustomPluginType =
  | "request_processor"
  | "response_processor"
  | "request_response_processor"
  | "context_menu"
  | "custom_tab"
  | "button_action";

export interface CustomPluginConfig {
  fridaExportName: string;
  inputEncoding: "utf8" | "hex" | "base64" | "raw";
  outputEncoding: "utf8" | "hex" | "base64" | "raw";
  matchScope?: "all" | "in_scope" | "regex";
  matchPattern?: string;
  parameterType: "full_body" | "header_value" | "regex_match" | "selected_text";
  parameterRegex?: string;
  headerName?: string;
}

// -- HTTP Processing Types --

export interface HttpMessage {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface ProcessedMessage {
  original: string;
  processed: string;
  exportUsed: string;
  timestamp: number;
}

// -- Bridge API Request/Response Types --

export interface BridgeRequest<T = unknown> {
  action: string;
  params?: T;
}

export interface BridgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// -- Storage Types --

export interface PluginStorage {
  connectionConfig: ConnectionConfig;
  savedScripts: FridaScript[];
  customPlugins: CustomPlugin[];
  hooks: HookDefinition[];
  consoleMessages: ConsoleMessage[];
  activeTab: string;
  editorContent: string;
}

// -- Frida RPC Export Invocation --

export interface RpcInvocation {
  exportName: string;
  args: unknown[];
}

export interface RpcResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// -- Keystore / Certificate Types --

export interface KeystoreEntry {
  alias: string;
  type: string;
  algorithm?: string;
  size?: number;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  algorithm: string;
}

// -- Default Configuration --

export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  bridgeHost: "127.0.0.1",
  bridgePort: 28092,
  deviceType: "usb",
};

export const DEFAULT_STORAGE: PluginStorage = {
  connectionConfig: DEFAULT_CONNECTION_CONFIG,
  savedScripts: [],
  customPlugins: [],
  hooks: [],
  consoleMessages: [],
  activeTab: "dashboard",
  editorContent: `// Crida - Write your Frida script here
// Exports defined here will be callable from Caido

rpc.exports = {
  // Example: decrypt a value using the app's own decryption function
  decrypt(data) {
    // Use Java.perform for Android or ObjC for iOS
    return new Promise((resolve) => {
      Java.perform(() => {
        // Your hooking logic here
        resolve(data);
      });
    });
  },

  // Example: get encryption key from app memory
  getKey() {
    return new Promise((resolve) => {
      Java.perform(() => {
        // Your key extraction logic here
        resolve("");
      });
    });
  },
};
`,
};
