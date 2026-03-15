// ============================================================================
// Crida - Frida Bridge Client
// Communicates with the standalone Frida bridge server via HTTP
// ============================================================================

import type {
  BridgeResponse,
  ConnectionConfig,
  ConnectionStatus,
  FridaApplication,
  FridaProcess,
  FridaDevice,
  ClassInfo,
  ModuleInfo,
  ExportInfo,
  ImportInfo,
  RpcResult,
  KeystoreEntry,
  CertificateInfo,
} from "crida-shared";

export class FridaBridgeClient {
  private baseUrl: string;

  constructor(config: ConnectionConfig) {
    this.baseUrl = `http://${config.bridgeHost}:${config.bridgePort}`;
  }

  updateConfig(config: ConnectionConfig): void {
    this.baseUrl = `http://${config.bridgeHost}:${config.bridgePort}`;
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown
  ): Promise<BridgeResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as BridgeResponse<T>;
    return data;
  }

  // -- Connection Management --

  async ping(): Promise<BridgeResponse<{ version: string }>> {
    return this.request("/api/ping");
  }

  async getStatus(): Promise<BridgeResponse<ConnectionStatus>> {
    return this.request("/api/status");
  }

  async connectDevice(
    type: string,
    remoteHost?: string,
    remotePort?: number
  ): Promise<BridgeResponse<FridaDevice>> {
    return this.request("/api/device/connect", "POST", {
      type,
      remoteHost,
      remotePort,
    });
  }

  async disconnectDevice(): Promise<BridgeResponse<void>> {
    return this.request("/api/device/disconnect", "POST");
  }

  // -- Application & Process Management --

  async listApplications(): Promise<BridgeResponse<FridaApplication[]>> {
    return this.request("/api/apps");
  }

  async listProcesses(): Promise<BridgeResponse<FridaProcess[]>> {
    return this.request("/api/processes");
  }

  async spawnAndAttach(
    identifier: string
  ): Promise<BridgeResponse<{ pid: number }>> {
    return this.request("/api/app/spawn", "POST", { identifier });
  }

  async attach(pid: number): Promise<BridgeResponse<{ pid: number }>> {
    return this.request("/api/app/attach", "POST", { pid });
  }

  async detach(): Promise<BridgeResponse<void>> {
    return this.request("/api/app/detach", "POST");
  }

  // -- Script Management --

  async loadScript(source: string): Promise<BridgeResponse<{ id: string }>> {
    return this.request("/api/script/load", "POST", { source });
  }

  async unloadScript(): Promise<BridgeResponse<void>> {
    return this.request("/api/script/unload", "POST");
  }

  // -- RPC Exports --

  async callExport(
    exportName: string,
    args: unknown[]
  ): Promise<BridgeResponse<RpcResult>> {
    return this.request("/api/rpc/call", "POST", { exportName, args });
  }

  async listExports(): Promise<BridgeResponse<string[]>> {
    return this.request("/api/rpc/exports");
  }

  // -- Binary Analysis --

  async enumerateClasses(
    filter?: string
  ): Promise<BridgeResponse<string[]>> {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    return this.request(`/api/analysis/classes${query}`);
  }

  async getClassMethods(
    className: string
  ): Promise<BridgeResponse<ClassInfo>> {
    return this.request("/api/analysis/class/methods", "POST", { className });
  }

  async enumerateModules(): Promise<BridgeResponse<ModuleInfo[]>> {
    return this.request("/api/analysis/modules");
  }

  async getModuleExports(
    moduleName: string
  ): Promise<BridgeResponse<ExportInfo[]>> {
    return this.request("/api/analysis/module/exports", "POST", {
      moduleName,
    });
  }

  async getModuleImports(
    moduleName: string
  ): Promise<BridgeResponse<ImportInfo[]>> {
    return this.request("/api/analysis/module/imports", "POST", {
      moduleName,
    });
  }

  // -- Pre-built Hooks --

  async runPrebuiltHook(
    hookId: string,
    platform: string
  ): Promise<BridgeResponse<void>> {
    return this.request("/api/hooks/prebuilt", "POST", { hookId, platform });
  }

  // -- Inspection Hooks --

  async addInspectionHook(
    className: string,
    methodName: string
  ): Promise<BridgeResponse<{ hookId: string }>> {
    return this.request("/api/hooks/inspect", "POST", {
      className,
      methodName,
    });
  }

  async addTamperHook(
    className: string,
    methodName: string,
    returnValue: string
  ): Promise<BridgeResponse<{ hookId: string }>> {
    return this.request("/api/hooks/tamper", "POST", {
      className,
      methodName,
      returnValue,
    });
  }

  async removeHook(hookId: string): Promise<BridgeResponse<void>> {
    return this.request(`/api/hooks/${hookId}`, "DELETE");
  }

  // -- Android-specific --

  async enumerateKeystores(): Promise<BridgeResponse<KeystoreEntry[]>> {
    return this.request("/api/android/keystores");
  }

  async dumpSharedPreferences(): Promise<
    BridgeResponse<Record<string, unknown>>
  > {
    return this.request("/api/android/shared-prefs");
  }

  // -- iOS-specific --

  async enumerateCertificates(): Promise<BridgeResponse<CertificateInfo[]>> {
    return this.request("/api/ios/certificates");
  }

  async dumpKeychain(): Promise<BridgeResponse<Record<string, unknown>[]>> {
    return this.request("/api/ios/keychain");
  }

  // -- Console / Messages --

  async getMessages(): Promise<
    BridgeResponse<Array<{ type: string; payload: string }>>
  > {
    return this.request("/api/messages");
  }

  async clearMessages(): Promise<BridgeResponse<void>> {
    return this.request("/api/messages/clear", "POST");
  }
}
