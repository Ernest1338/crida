// ============================================================================
// Crida Bridge - Device Manager
// Handles Frida device discovery and connection
// ============================================================================

import frida from "frida";
import type { Device } from "frida";

export class DeviceManager {
  private device: Device | null = null;

  async getLocalDevice(): Promise<Device> {
    const device = await frida.getLocalDevice();
    this.device = device;
    return device;
  }

  async getUsbDevice(timeout = 5000): Promise<Device> {
    const device = await frida.getUsbDevice({ timeout });
    this.device = device;
    return device;
  }

  async getRemoteDevice(host: string, port = 27042): Promise<Device> {
    const deviceManager = frida.getDeviceManager();
    const device = await deviceManager.addRemoteDevice(`${host}:${port}`);
    this.device = device;
    return device;
  }

  async connectDevice(type: string, remoteHost?: string, remotePort?: number): Promise<Device> {
    switch (type) {
      case "local":
        return this.getLocalDevice();
      case "usb":
        return this.getUsbDevice();
      case "remote":
        if (!remoteHost) throw new Error("Remote host is required");
        return this.getRemoteDevice(remoteHost, remotePort);
      default:
        throw new Error(`Unknown device type: ${type}`);
    }
  }

  getDevice(): Device | null {
    return this.device;
  }

  disconnect(): void {
    this.device = null;
  }

  async listApplications() {
    if (!this.device) throw new Error("No device connected");
    return this.device.enumerateApplications();
  }

  async listProcesses() {
    if (!this.device) throw new Error("No device connected");
    return this.device.enumerateProcesses();
  }
}
