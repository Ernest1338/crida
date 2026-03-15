// ============================================================================
// Crida Bridge - Script Manager
// Handles Frida script injection and RPC communication
// ============================================================================

import type { Device, Script, Session } from "frida";

interface ScriptMessage {
  type: string;
  payload: string;
  timestamp: number;
}

export class ScriptManager {
  private session: Session | null = null;
  private script: Script | null = null;
  private messages: ScriptMessage[] = [];
  private maxMessages = 5000;

  async attach(device: Device, pid: number): Promise<Session> {
    if (this.session) {
      try {
        await this.session.detach();
      } catch {
        // Ignore detach errors
      }
    }
    this.session = await device.attach(pid);
    this.session.detached.connect(() => {
      console.log(`[Crida] Session detached (PID: ${pid})`);
      this.session = null;
      this.script = null;
    });
    return this.session;
  }

  async spawn(device: Device, identifier: string): Promise<number> {
    const pid = await device.spawn(identifier);
    await this.attach(device, pid);
    await device.resume(pid);
    return pid;
  }

  async detach(): Promise<void> {
    if (this.script) {
      try {
        await this.script.unload();
      } catch {
        // Ignore
      }
      this.script = null;
    }
    if (this.session) {
      try {
        await this.session.detach();
      } catch {
        // Ignore
      }
      this.session = null;
    }
  }

  async loadScript(source: string): Promise<Script> {
    if (!this.session) throw new Error("No active session. Attach to a process first.");

    // Unload existing script
    if (this.script) {
      try {
        await this.script.unload();
      } catch {
        // Ignore
      }
    }

    this.script = await this.session.createScript(source);

    this.script.message.connect((message, _data) => {
      const msg: ScriptMessage = {
        type: "log",
        payload: "",
        timestamp: Date.now(),
      };

      if (message.type === "send" && message.payload) {
        if (typeof message.payload === "object" && message.payload !== null) {
          const payload = message.payload as Record<string, unknown>;
          msg.type = (payload["type"] as string) ?? "info";
          msg.payload = (payload["message"] as string) ?? JSON.stringify(payload);
        } else {
          msg.payload = String(message.payload);
        }
      } else if (message.type === "error") {
        msg.type = "error";
        msg.payload = String(message.stack ?? message.description ?? "Unknown error");
      }

      this.messages.push(msg);
      if (this.messages.length > this.maxMessages) {
        this.messages = this.messages.slice(-this.maxMessages);
      }

      console.log(`[Frida][${msg.type}] ${msg.payload}`);
    });

    await this.script.load();
    return this.script;
  }

  async unloadScript(): Promise<void> {
    if (this.script) {
      await this.script.unload();
      this.script = null;
    }
  }

  async callExport(exportName: string, args: unknown[]): Promise<unknown> {
    if (!this.script) throw new Error("No script loaded");

    const exports = this.script.exports as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const fn = exports[exportName];
    if (!fn) throw new Error(`Export "${exportName}" not found`);

    return fn(...args);
  }

  async listExports(): Promise<string[]> {
    if (!this.script) return [];

    const exports = this.script.exports as Record<string, unknown>;
    return Object.keys(exports).filter((k) => typeof exports[k] === "function");
  }

  getMessages(): ScriptMessage[] {
    const msgs = [...this.messages];
    return msgs;
  }

  clearMessages(): void {
    this.messages = [];
  }

  getSession(): Session | null {
    return this.session;
  }

  getScript(): Script | null {
    return this.script;
  }

  isAttached(): boolean {
    return this.session !== null;
  }
}
