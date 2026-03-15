# Crida — Frida Integration for Caido

A feature-rich [Caido](https://caido.io) plugin that integrates [Frida](https://frida.re) for mobile application security testing. Inspired by [Brida](https://github.com/federicodotta/Brida), Crida brings Frida's powerful dynamic instrumentation capabilities directly into Caido's workflow.

## Features

- **Device & App Management** — Connect to Android/iOS devices (USB, local, remote), list running apps and processes, spawn or attach to targets
- **Script Editor** — Built-in Frida script editor with templates for Android, iOS, native hooking, WebView debugging, and RPC exports
- **Pre-built Hooks Library** — One-click bypass for SSL pinning, root/jailbreak detection, crypto inspection, network monitoring, and more
- **Binary Analysis** — Enumerate classes, methods, fields, modules, exports, and imports of the target application
- **Inspection & Tamper Hooks** — Add inspection hooks to log method arguments/returns, or tamper hooks to override return values
- **RPC Export Tester** — Call Frida `rpc.exports` functions directly from Caido to decrypt, sign, or transform data
- **Console** — Real-time Frida message output with filtering, search, and auto-polling
- **Custom Plugin Builder** — Brida-style custom plugins that wire Frida RPC exports to HTTP request/response processing

## Architecture

Crida uses a three-component architecture:

```
┌──────────────────────┐     HTTP/JSON     ┌────────────────────┐     Frida     ┌────────────┐
│   Caido (Browser)    │ ◄──────────────► │  Crida Bridge      │ ◄──────────► │  Mobile    │
│                      │                   │  (Bun Server)      │              │  Device    │
│  ┌────────────────┐  │                   │                    │              │            │
│  │ Crida Frontend │  │                   │  frida-node binds  │              │  frida-    │
│  │ (Plugin UI)    │  │                   │  to device/process │              │  server    │
│  └────────┬───────┘  │                   └────────────────────┘              └────────────┘
│           │          │
│  ┌────────▼───────┐  │
│  │ Crida Backend  │  │
│  │ (Plugin Logic) │  │
│  └────────────────┘  │
└──────────────────────┘
```

1. **Crida Frontend** — Rich UI inside Caido with dashboard, editor, analysis, hooks, console, and custom plugin tabs
2. **Crida Backend** — Caido backend plugin that communicates with the bridge server via HTTP
3. **Crida Bridge** — Standalone Bun server wrapping `frida-node` that manages device connections, script injection, and RPC calls

## Prerequisites

- [Caido](https://caido.io) (v0.41+)
- [Bun](https://bun.sh) runtime (for the bridge server)
- [Frida](https://frida.re) server running on the target device
- [pnpm](https://pnpm.io) (for building the plugin)

## Quick Start

### 1. Start the Bridge Server

```bash
cd bridge
bun install
bun run start
```

The bridge server starts on `http://127.0.0.1:28092` by default. Change the port with the `CRIDA_PORT` environment variable.

### 2. Build & Install the Caido Plugin

```bash
pnpm install
pnpm run build
```

This creates `dist/plugin_package.zip`. Install it in Caido via **Settings → Plugins → Install from file**.

### 3. Connect

1. Open Caido and navigate to **Crida** in the sidebar
2. Configure the bridge host/port (defaults to `127.0.0.1:28092`)
3. Select your device type (USB, Local, or Remote)
4. Click **Connect**

### 4. Start Testing

- Use the **Dashboard** to list apps, attach to processes, and call RPC exports
- Write Frida scripts in the **Script Editor** and load them into the target
- Apply pre-built hooks from the **Hooks Library** (SSL pinning bypass, root detection bypass, etc.)
- Browse classes and methods in the **Analysis** tab and add inspection/tamper hooks
- Build **Custom Plugins** that use Frida RPC exports to process HTTP traffic

## Tabs Overview

| Tab | Description |
|-----|-------------|
| **Dashboard** | Connection management, app/process listing, RPC export tester |
| **Script Editor** | Frida script editor with templates and load/unload controls |
| **Hooks Library** | Pre-built hooks organized by platform and category |
| **Analysis** | Class/method browser, module inspector, hook management |
| **Custom Plugins** | Brida-style plugin builder for HTTP processing with Frida |
| **Console** | Real-time Frida messages with filtering and search |

## Development

```bash
# Install dependencies
pnpm install

# Build everything
pnpm run build

# Bridge development (with auto-reload)
cd bridge && bun run dev
```

## License

MIT
