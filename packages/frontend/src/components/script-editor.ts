// ============================================================================
// Crida Frontend - Script Editor Component
// Frida script editing and execution
// ============================================================================

import type { CaidoSDK } from "../types";

const DEFAULT_SCRIPT = `// Crida - Frida Script Editor
// Write your Frida instrumentation script here.
// Exports defined in rpc.exports will be callable from the RPC Tester.

Java.perform(function() {
  // Example: Hook a method and log its arguments
  // var MyClass = Java.use('com.example.MyClass');
  // MyClass.myMethod.implementation = function(arg1, arg2) {
  //   send({ type: 'hook', message: 'myMethod called: ' + arg1 + ', ' + arg2 });
  //   return this.myMethod(arg1, arg2);
  // };

  send({ type: 'info', message: 'Script loaded successfully!' });
});

rpc.exports = {
  // Define RPC exports here - they can be called from the Dashboard
  ping() {
    return "pong";
  },

  // Example: call app's decrypt function
  // decrypt(data) {
  //   return new Promise(resolve => {
  //     Java.perform(() => {
  //       var Crypto = Java.use('com.example.CryptoHelper');
  //       var result = Crypto.decrypt(data);
  //       resolve(result);
  //     });
  //   });
  // },
};
`;

export function createScriptEditor(sdk: CaidoSDK): HTMLElement {
  const container = document.createElement("div");
  container.className = "crida__editor-wrapper";
  container.innerHTML = `
    <div class="crida__editor-toolbar">
      <button class="crida__btn crida__btn--primary" id="crida-load-script-btn">
        <i class="fas fa-play"></i> Load Script
      </button>
      <button class="crida__btn crida__btn--danger" id="crida-unload-script-btn">
        <i class="fas fa-stop"></i> Unload Script
      </button>
      <div style="flex: 1;"></div>
      <button class="crida__btn crida__btn--secondary" id="crida-save-script-btn">
        <i class="fas fa-save"></i> Save
      </button>
      <select class="crida__select" id="crida-script-template" style="width: auto; min-width: 200px;">
        <option value="">Load template...</option>
        <option value="android-basic">Android Basic Hook</option>
        <option value="ios-basic">iOS Basic Hook</option>
        <option value="android-enum">Android Class Enumeration</option>
        <option value="ios-enum">iOS Class Enumeration</option>
        <option value="rpc-template">RPC Export Template</option>
        <option value="android-webview">Android WebView Debug</option>
        <option value="native-hook">Native Function Hook</option>
      </select>
    </div>
    <div class="crida__editor">
      <textarea id="crida-script-editor" spellcheck="false">${escapeHtml(DEFAULT_SCRIPT)}</textarea>
    </div>
  `;

  setupEditorEvents(container, sdk);
  return container;
}

function setupEditorEvents(container: HTMLElement, sdk: CaidoSDK): void {
  const editor = container.querySelector("#crida-script-editor") as HTMLTextAreaElement;
  const loadBtn = container.querySelector("#crida-load-script-btn") as HTMLButtonElement;
  const unloadBtn = container.querySelector("#crida-unload-script-btn") as HTMLButtonElement;
  const templateSelect = container.querySelector("#crida-script-template") as HTMLSelectElement;

  // Tab key support in textarea
  editor.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    }
  });

  // Load script
  loadBtn.addEventListener("click", async () => {
    const source = editor.value;
    if (!source.trim()) return;

    loadBtn.disabled = true;
    loadBtn.innerHTML = '<span class="crida__spinner"></span> Loading...';

    const result = await sdk.backend.loadScript(source);

    if (result.success) {
      loadBtn.innerHTML = '<i class="fas fa-check"></i> Loaded';
      setTimeout(() => {
        loadBtn.innerHTML = '<i class="fas fa-play"></i> Load Script';
        loadBtn.disabled = false;
      }, 2000);
    } else {
      loadBtn.innerHTML = '<i class="fas fa-times"></i> Error';
      setTimeout(() => {
        loadBtn.innerHTML = '<i class="fas fa-play"></i> Load Script';
        loadBtn.disabled = false;
      }, 2000);
    }
  });

  // Unload script
  unloadBtn.addEventListener("click", async () => {
    unloadBtn.disabled = true;
    await sdk.backend.unloadScript();
    unloadBtn.disabled = false;
  });

  // Template selection
  templateSelect.addEventListener("change", () => {
    const template = templateSelect.value;
    if (template && TEMPLATES[template]) {
      editor.value = TEMPLATES[template] ?? "";
    }
    templateSelect.value = "";
  });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TEMPLATES: Record<string, string> = {
  "android-basic": `// Android Basic Hook Template
Java.perform(function() {
  var targetClass = Java.use('com.example.TargetClass');

  // Hook a specific method
  targetClass.targetMethod.overload('java.lang.String').implementation = function(arg) {
    send({ type: 'hook', message: 'targetMethod called with: ' + arg });

    // Call original method
    var result = this.targetMethod(arg);
    send({ type: 'hook', message: 'targetMethod returned: ' + result });

    return result;
  };

  // Hook constructor
  targetClass.$init.overload('java.lang.String').implementation = function(arg) {
    send({ type: 'hook', message: 'Constructor called with: ' + arg });
    return this.$init(arg);
  };

  send({ type: 'success', message: 'Android hooks installed!' });
});
`,

  "ios-basic": `// iOS Basic Hook Template
if (ObjC.available) {
  var TargetClass = ObjC.classes.TargetClass;

  // Hook an instance method
  var origMethod = TargetClass['- targetMethod:'];
  Interceptor.attach(origMethod.implementation, {
    onEnter: function(args) {
      // args[0] = self, args[1] = _cmd, args[2+] = method arguments
      var arg1 = new ObjC.Object(args[2]);
      send({ type: 'hook', message: 'targetMethod called with: ' + arg1.toString() });
    },
    onLeave: function(retval) {
      var ret = new ObjC.Object(retval);
      send({ type: 'hook', message: 'targetMethod returned: ' + ret.toString() });
    }
  });

  // Hook a class method
  var classMethod = TargetClass['+ classMethod:'];
  Interceptor.attach(classMethod.implementation, {
    onEnter: function(args) {
      send({ type: 'hook', message: 'classMethod called' });
    }
  });

  send({ type: 'success', message: 'iOS hooks installed!' });
} else {
  send({ type: 'error', message: 'ObjC runtime not available' });
}
`,

  "android-enum": `// Android Class Enumeration
Java.perform(function() {
  // Enumerate all loaded classes
  Java.enumerateLoadedClasses({
    onMatch: function(className) {
      // Filter by package name
      if (className.startsWith('com.example.')) {
        send({ type: 'info', message: '[Class] ' + className });

        // Enumerate methods of matching classes
        try {
          var cls = Java.use(className);
          var methods = cls.class.getDeclaredMethods();
          methods.forEach(function(method) {
            send({ type: 'info', message: '  [Method] ' + method.getName() });
          });
        } catch(e) {}
      }
    },
    onComplete: function() {
      send({ type: 'success', message: 'Class enumeration complete' });
    }
  });
});
`,

  "ios-enum": `// iOS Class Enumeration
if (ObjC.available) {
  // Enumerate all registered classes
  for (var className in ObjC.classes) {
    if (ObjC.classes.hasOwnProperty(className)) {
      // Filter by prefix
      if (className.startsWith('MyApp') || className.startsWith('XX')) {
        send({ type: 'info', message: '[Class] ' + className });

        // List methods
        var methods = ObjC.classes[className].$ownMethods;
        methods.forEach(function(method) {
          send({ type: 'info', message: '  [Method] ' + method });
        });
      }
    }
  }

  send({ type: 'success', message: 'Class enumeration complete' });
} else {
  send({ type: 'error', message: 'ObjC runtime not available' });
}
`,

  "rpc-template": `// RPC Export Template
// Define functions that can be called from Caido's RPC Tester

rpc.exports = {
  // Simple ping/pong
  ping() {
    return "pong from Frida!";
  },

  // Decrypt data using the app's own crypto
  decrypt(base64Data) {
    return new Promise(function(resolve, reject) {
      Java.perform(function() {
        try {
          var CryptoHelper = Java.use('com.example.CryptoHelper');
          var result = CryptoHelper.decrypt(base64Data);
          resolve(result);
        } catch(e) {
          reject(e.message);
        }
      });
    });
  },

  // Encrypt data using the app's own crypto
  encrypt(plaintext) {
    return new Promise(function(resolve, reject) {
      Java.perform(function() {
        try {
          var CryptoHelper = Java.use('com.example.CryptoHelper');
          var result = CryptoHelper.encrypt(plaintext);
          resolve(result);
        } catch(e) {
          reject(e.message);
        }
      });
    });
  },

  // Get a token or key from the app's memory
  getToken() {
    return new Promise(function(resolve) {
      Java.perform(function() {
        try {
          var TokenManager = Java.use('com.example.TokenManager');
          var instance = TokenManager.getInstance();
          resolve(instance.getAccessToken());
        } catch(e) {
          resolve("Error: " + e.message);
        }
      });
    });
  },

  // Sign data using the app's signing mechanism
  sign(data) {
    return new Promise(function(resolve, reject) {
      Java.perform(function() {
        try {
          var Signer = Java.use('com.example.RequestSigner');
          var signature = Signer.sign(data);
          resolve(signature);
        } catch(e) {
          reject(e.message);
        }
      });
    });
  },
};
`,

  "android-webview": `// Android WebView Debug Hook
Java.perform(function() {
  // Enable WebView debugging
  var WebView = Java.use('android.webkit.WebView');
  WebView.setWebContentsDebuggingEnabled(true);
  send({ type: 'success', message: '[WebView] Debugging enabled - use chrome://inspect' });

  // Monitor WebView URL loading
  WebView.loadUrl.overload('java.lang.String').implementation = function(url) {
    send({ type: 'network', message: '[WebView] loadUrl: ' + url });
    return this.loadUrl(url);
  };

  WebView.loadUrl.overload('java.lang.String', 'java.util.Map').implementation = function(url, headers) {
    send({ type: 'network', message: '[WebView] loadUrl with headers: ' + url });
    return this.loadUrl(url, headers);
  };

  // Monitor JavaScript interface additions
  WebView.addJavascriptInterface.implementation = function(obj, name) {
    send({ type: 'info', message: '[WebView] addJavascriptInterface: ' + name + ' (' + obj.getClass().getName() + ')' });
    return this.addJavascriptInterface(obj, name);
  };

  // Monitor evaluateJavascript calls
  try {
    WebView.evaluateJavascript.implementation = function(script, callback) {
      send({ type: 'info', message: '[WebView] evaluateJavascript: ' + script.substring(0, 200) });
      return this.evaluateJavascript(script, callback);
    };
  } catch(e) {}

  // Hook WebViewClient
  try {
    var WebViewClient = Java.use('android.webkit.WebViewClient');
    WebViewClient.shouldInterceptRequest.overload('android.webkit.WebView', 'android.webkit.WebResourceRequest').implementation = function(view, request) {
      var url = request.getUrl().toString();
      send({ type: 'network', message: '[WebView] Request: ' + request.getMethod() + ' ' + url });
      return this.shouldInterceptRequest(view, request);
    };
  } catch(e) {}

  send({ type: 'success', message: '[WebView] WebView monitoring hooks installed' });
});
`,

  "native-hook": `// Native Function Hook Template
// Hook native (C/C++) functions using Interceptor

// Find and hook a function by name
var targetFunc = Module.findExportByName(null, 'target_function_name');
// Or from a specific library: Module.findExportByName('libtarget.so', 'target_function');

if (targetFunc) {
  Interceptor.attach(targetFunc, {
    onEnter: function(args) {
      // Access arguments
      // args[0], args[1], etc. are NativePointer objects
      send({
        type: 'hook',
        message: 'target_function called\\n' +
          '  arg0: ' + args[0] + '\\n' +
          '  arg1: ' + args[1]
      });

      // Read string argument: args[0].readUtf8String()
      // Read int: args[0].toInt32()
      // Read pointer: args[0].readPointer()
      // Read byte array: args[0].readByteArray(length)
    },
    onLeave: function(retval) {
      send({ type: 'hook', message: 'target_function returned: ' + retval });

      // Modify return value:
      // retval.replace(0x1);
      // retval.replace(ptr("0x0"));
    }
  });
  send({ type: 'success', message: 'Native hook installed' });
} else {
  send({ type: 'error', message: 'Function not found' });
}

// Enumerate modules to find the right library
Process.enumerateModules({
  onMatch: function(module) {
    if (module.name.indexOf('target') !== -1) {
      send({ type: 'info', message: '[Module] ' + module.name + ' @ ' + module.base + ' (' + module.size + ')' });
    }
  },
  onComplete: function() {}
});
`,
};
