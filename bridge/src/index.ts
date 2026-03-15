// ============================================================================
// Crida Bridge Server - Main Entry Point
// Standalone HTTP server that bridges Caido with Frida
// Run with: bun run src/index.ts
// ============================================================================

import { DeviceManager } from "./device-manager";
import { ScriptManager } from "./script-manager";
import { AnalysisEngine } from "./analysis";
import { getHookScript } from "./hooks";

const VERSION = "0.1.0";
const DEFAULT_PORT = 28092;

const deviceManager = new DeviceManager();
const scriptManager = new ScriptManager();
const analysisEngine = new AnalysisEngine(scriptManager);

// Active inspection/tamper hooks
const activeHooks = new Map<string, { type: string; className: string; methodName: string }>();
let hookCounter = 0;

// ============================================================================
// Response Helpers
// ============================================================================

function success<T>(data: T): Response {
  return Response.json({ success: true, data });
}

function error(message: string, status = 400): Response {
  return Response.json({ success: false, error: message }, { status });
}

// ============================================================================
// Route Handler
// ============================================================================

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS headers for Caido
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    if (method === "POST" || method === "DELETE") {
      const text = await req.text();
      if (text) {
        body = JSON.parse(text) as Record<string, unknown>;
      }
    }

    let response: Response;

    switch (true) {
      // -- Health --
      case path === "/api/ping" && method === "GET":
        response = success({ version: VERSION });
        break;

      // -- Status --
      case path === "/api/status" && method === "GET":
        response = success({
          connected: true,
          bridgeConnected: true,
          deviceConnected: deviceManager.getDevice() !== null,
          sessionActive: scriptManager.isAttached(),
          deviceInfo: deviceManager.getDevice()
            ? {
                id: deviceManager.getDevice()!.id,
                name: deviceManager.getDevice()!.name,
                type: deviceManager.getDevice()!.type,
              }
            : null,
        });
        break;

      // -- Device Connection --
      case path === "/api/device/connect" && method === "POST": {
        const device = await deviceManager.connectDevice(
          body["type"] as string,
          body["remoteHost"] as string | undefined,
          body["remotePort"] as number | undefined
        );
        response = success({ id: device.id, name: device.name, type: device.type });
        break;
      }

      case path === "/api/device/disconnect" && method === "POST":
        await scriptManager.detach();
        deviceManager.disconnect();
        response = success(null);
        break;

      // -- Applications --
      case path === "/api/apps" && method === "GET": {
        const apps = await deviceManager.listApplications();
        response = success(
          apps.map((a) => ({
            pid: a.pid,
            name: a.name,
            identifier: a.identifier,
          }))
        );
        break;
      }

      // -- Processes --
      case path === "/api/processes" && method === "GET": {
        const procs = await deviceManager.listProcesses();
        response = success(
          procs.map((p) => ({
            pid: p.pid,
            name: p.name,
          }))
        );
        break;
      }

      // -- Spawn & Attach --
      case path === "/api/app/spawn" && method === "POST": {
        const device = deviceManager.getDevice();
        if (!device) {
          response = error("No device connected");
          break;
        }
        const pid = await scriptManager.spawn(device, body["identifier"] as string);
        response = success({ pid });
        break;
      }

      case path === "/api/app/attach" && method === "POST": {
        const dev = deviceManager.getDevice();
        if (!dev) {
          response = error("No device connected");
          break;
        }
        await scriptManager.attach(dev, body["pid"] as number);
        response = success({ pid: body["pid"] });
        break;
      }

      case path === "/api/app/detach" && method === "POST":
        await scriptManager.detach();
        response = success(null);
        break;

      // -- Script Management --
      case path === "/api/script/load" && method === "POST": {
        const script = await scriptManager.loadScript(body["source"] as string);
        response = success({ id: String(script) });
        break;
      }

      case path === "/api/script/unload" && method === "POST":
        await scriptManager.unloadScript();
        response = success(null);
        break;

      // -- RPC Exports --
      case path === "/api/rpc/call" && method === "POST": {
        const result = await scriptManager.callExport(
          body["exportName"] as string,
          body["args"] as unknown[]
        );
        response = success({ success: true, result });
        break;
      }

      case path === "/api/rpc/exports" && method === "GET": {
        const exports = await scriptManager.listExports();
        response = success(exports);
        break;
      }

      // -- Binary Analysis --
      case path === "/api/analysis/classes" && method === "GET": {
        const filter = url.searchParams.get("filter") ?? undefined;
        const classes = await analysisEngine.enumerateClasses(filter);
        response = success(classes);
        break;
      }

      case path === "/api/analysis/class/methods" && method === "POST": {
        const classInfo = await analysisEngine.getClassMethods(body["className"] as string);
        response = success(classInfo);
        break;
      }

      case path === "/api/analysis/modules" && method === "GET": {
        const modules = await analysisEngine.enumerateModules();
        response = success(modules);
        break;
      }

      case path === "/api/analysis/module/exports" && method === "POST": {
        const moduleExports = await analysisEngine.getModuleExports(body["moduleName"] as string);
        response = success(moduleExports);
        break;
      }

      case path === "/api/analysis/module/imports" && method === "POST": {
        const moduleImports = await analysisEngine.getModuleImports(body["moduleName"] as string);
        response = success(moduleImports);
        break;
      }

      // -- Pre-built Hooks --
      case path === "/api/hooks/prebuilt" && method === "POST": {
        const hookScript = getHookScript(
          body["hookId"] as string,
          body["platform"] as string
        );
        if (!hookScript) {
          response = error("Hook not found");
          break;
        }
        await scriptManager.loadScript(hookScript);
        response = success(null);
        break;
      }

      // -- Inspection Hooks --
      case path === "/api/hooks/inspect" && method === "POST": {
        const className = body["className"] as string;
        const methodName = body["methodName"] as string;
        const hookId = `hook-${++hookCounter}`;

        const inspectScript = `
          Java.perform(function() {
            var cls = Java.use("${className}");
            cls.${methodName}.implementation = function() {
              var args = [];
              for (var i = 0; i < arguments.length; i++) {
                args.push(String(arguments[i]));
              }
              send({
                type: 'inspect',
                message: '${className}.${methodName}(' + args.join(', ') + ')'
              });
              var result = this.${methodName}.apply(this, arguments);
              send({
                type: 'inspect',
                message: '${className}.${methodName} => ' + String(result)
              });
              return result;
            };
            send({ type: 'success', message: 'Inspection hook installed: ${className}.${methodName}' });
          });
        `;

        await scriptManager.loadScript(inspectScript);
        activeHooks.set(hookId, { type: "inspect", className, methodName });
        response = success({ hookId });
        break;
      }

      // -- Tamper Hooks --
      case path === "/api/hooks/tamper" && method === "POST": {
        const tClassName = body["className"] as string;
        const tMethodName = body["methodName"] as string;
        const returnValue = body["returnValue"] as string;
        const tHookId = `hook-${++hookCounter}`;

        const tamperScript = `
          Java.perform(function() {
            var cls = Java.use("${tClassName}");
            cls.${tMethodName}.implementation = function() {
              var args = [];
              for (var i = 0; i < arguments.length; i++) {
                args.push(String(arguments[i]));
              }
              send({
                type: 'tamper',
                message: '${tClassName}.${tMethodName}(' + args.join(', ') + ') => tampered to: ${returnValue}'
              });
              return ${returnValue};
            };
            send({ type: 'success', message: 'Tamper hook installed: ${tClassName}.${tMethodName} => ${returnValue}' });
          });
        `;

        await scriptManager.loadScript(tamperScript);
        activeHooks.set(tHookId, { type: "tamper", className: tClassName, methodName: tMethodName });
        response = success({ hookId: tHookId });
        break;
      }

      // -- Remove Hook --
      case path.startsWith("/api/hooks/") && method === "DELETE": {
        const removeHookId = path.split("/").pop()!;
        activeHooks.delete(removeHookId);
        // Note: In Frida, we can't easily remove individual hooks without reloading.
        // The hook will remain active until the script is replaced or session detaches.
        response = success(null);
        break;
      }

      // -- Android Specific --
      case path === "/api/android/keystores" && method === "GET": {
        const ksScript = `
          rpc.exports = {
            getKeystores: function() {
              return new Promise(function(resolve) {
                Java.perform(function() {
                  try {
                    var KeyStore = Java.use('java.security.KeyStore');
                    // This is a simplified enumeration
                    resolve([{ type: 'AndroidKeyStore', provider: 'AndroidKeyStore' }]);
                  } catch(e) {
                    resolve([]);
                  }
                });
              });
            }
          };
        `;
        await scriptManager.loadScript(ksScript);
        const ksExports = scriptManager.getScript()?.exports as { getKeystores?: () => Promise<unknown[]> };
        const keystores = ksExports?.getKeystores ? await ksExports.getKeystores() : [];
        response = success(keystores);
        break;
      }

      case path === "/api/android/shared-prefs" && method === "GET": {
        const spScript = `
          rpc.exports = {
            getSharedPrefs: function() {
              return new Promise(function(resolve) {
                Java.perform(function() {
                  try {
                    var context = Java.use('android.app.ActivityThread').currentApplication().getApplicationContext();
                    var prefsDir = context.getFilesDir().getParent() + '/shared_prefs';
                    var File = Java.use('java.io.File');
                    var dir = File.$new(prefsDir);
                    var files = dir.listFiles();
                    var result = {};
                    for (var i = 0; i < files.length; i++) {
                      result[files[i].getName()] = files[i].getAbsolutePath();
                    }
                    resolve(result);
                  } catch(e) {
                    resolve({ error: e.message });
                  }
                });
              });
            }
          };
        `;
        await scriptManager.loadScript(spScript);
        const spExports = scriptManager.getScript()?.exports as { getSharedPrefs?: () => Promise<Record<string, unknown>> };
        const prefs = spExports?.getSharedPrefs ? await spExports.getSharedPrefs() : {};
        response = success(prefs);
        break;
      }

      // -- iOS Specific --
      case path === "/api/ios/certificates" && method === "GET": {
        const certScript = `
          rpc.exports = {
            getCertificates: function() {
              if (!ObjC.available) return [];
              // Simplified certificate enumeration
              return [{ info: 'Use keychain dump for detailed certificates' }];
            }
          };
        `;
        await scriptManager.loadScript(certScript);
        const certExports = scriptManager.getScript()?.exports as { getCertificates?: () => Promise<unknown[]> };
        const certs = certExports?.getCertificates ? await certExports.getCertificates() : [];
        response = success(certs);
        break;
      }

      case path === "/api/ios/keychain" && method === "GET": {
        const kcScript = `
          rpc.exports = {
            dumpKeychain: function() {
              if (!ObjC.available) return [];
              try {
                var NSMutableDictionary = ObjC.classes.NSMutableDictionary;
                var query = NSMutableDictionary.alloc().init();
                // Simplified - full keychain dump would require more complex implementation
                return [{ info: 'Keychain access requires specific entitlements' }];
              } catch(e) {
                return [{ error: e.message }];
              }
            }
          };
        `;
        await scriptManager.loadScript(kcScript);
        const kcExports = scriptManager.getScript()?.exports as { dumpKeychain?: () => Promise<Record<string, unknown>[]> };
        const keychain = kcExports?.dumpKeychain ? await kcExports.dumpKeychain() : [];
        response = success(keychain);
        break;
      }

      // -- Messages --
      case path === "/api/messages" && method === "GET": {
        const messages = scriptManager.getMessages();
        response = success(messages);
        break;
      }

      case path === "/api/messages/clear" && method === "POST":
        scriptManager.clearMessages();
        response = success(null);
        break;

      // -- 404 --
      default:
        response = error(`Not found: ${method} ${path}`, 404);
    }

    // Add CORS headers to all responses
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[Crida Bridge] Error: ${message}`);
    return error(message, 500);
  }
}

// ============================================================================
// Server Startup
// ============================================================================

const port = parseInt(process.env["CRIDA_PORT"] ?? String(DEFAULT_PORT), 10);

console.log(`
╔═══════════════════════════════════════════════════════╗
║           Crida Bridge Server v${VERSION}               ║
║         Frida Integration for Caido                   ║
╠═══════════════════════════════════════════════════════╣
║  Bridge URL:  http://127.0.0.1:${String(port).padEnd(24)}║
║  Status:      Ready                                   ║
╚═══════════════════════════════════════════════════════╝
`);

const server = Bun.serve({
  port,
  fetch: handleRequest,
});

console.log(`[Crida] Bridge server listening on http://localhost:${server.port}`);
console.log("[Crida] Waiting for Caido plugin connection...");
