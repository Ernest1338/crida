// ============================================================================
// Crida Bridge - Pre-built Hooks Registry
// Maps hook IDs to their Frida script sources
// ============================================================================

// The hook sources are stored in the Caido backend (hooks-library.ts).
// This module provides the bridge-side implementation that loads hooks by ID.

const HOOK_SCRIPTS: Record<string, Record<string, string>> = {
  // SSL Pinning Bypass
  "prebuilt-1": {
    android: getAndroidSSLBypass(),
    any: getAndroidSSLBypass(),
  },
  "prebuilt-2": {
    ios: getIOSSSLBypass(),
    any: getIOSSSLBypass(),
  },
  // Root Detection Bypass
  "prebuilt-3": {
    android: getAndroidRootBypass(),
    any: getAndroidRootBypass(),
  },
  // Jailbreak Detection Bypass
  "prebuilt-4": {
    ios: getIOSJailbreakBypass(),
    any: getIOSJailbreakBypass(),
  },
};

export function getHookScript(hookId: string, platform: string): string | null {
  const hook = HOOK_SCRIPTS[hookId];
  if (!hook) return null;

  return hook[platform] ?? hook["any"] ?? null;
}

function getAndroidSSLBypass(): string {
  return `
Java.perform(function() {
  var TrustManagerFactory = Java.use('javax.net.ssl.TrustManagerFactory');
  var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
  var SSLContext = Java.use('javax.net.ssl.SSLContext');
  var TrustManager = Java.registerClass({
    name: 'com.crida.TrustManager',
    implements: [X509TrustManager],
    methods: {
      checkClientTrusted: function(chain, authType) {},
      checkServerTrusted: function(chain, authType) {},
      getAcceptedIssuers: function() { return []; }
    }
  });
  SSLContext.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom').implementation = function(km, tm, sr) {
    this.init(km, [TrustManager.$new()], sr);
    send({ type: 'hook', message: '[SSL] SSLContext.init intercepted' });
  };
  try {
    var CertificatePinner = Java.use('okhttp3.CertificatePinner');
    CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function(hostname, peerCerts) {
      send({ type: 'hook', message: '[SSL] OkHttp3 CertificatePinner bypassed for: ' + hostname });
    };
  } catch(e) {}
  send({ type: 'success', message: '[SSL] Android SSL pinning bypass installed' });
});`;
}

function getIOSSSLBypass(): string {
  return `
if (ObjC.available) {
  try {
    var SecTrustEvaluate = Module.findExportByName('Security', 'SecTrustEvaluate');
    if (SecTrustEvaluate) {
      Interceptor.replace(SecTrustEvaluate, new NativeCallback(function(trust, result) {
        Memory.writeU32(result, 4);
        send({ type: 'hook', message: '[SSL] SecTrustEvaluate bypassed' });
        return 0;
      }, 'int', ['pointer', 'pointer']));
    }
  } catch(e) {}
  try {
    var SecTrustEvaluateWithError = Module.findExportByName('Security', 'SecTrustEvaluateWithError');
    if (SecTrustEvaluateWithError) {
      Interceptor.replace(SecTrustEvaluateWithError, new NativeCallback(function(trust, error) {
        send({ type: 'hook', message: '[SSL] SecTrustEvaluateWithError bypassed' });
        return 1;
      }, 'bool', ['pointer', 'pointer']));
    }
  } catch(e) {}
  send({ type: 'success', message: '[SSL] iOS SSL pinning bypass installed' });
}`;
}

function getAndroidRootBypass(): string {
  return `
Java.perform(function() {
  var rootPaths = ['/system/app/Superuser.apk','/sbin/su','/system/bin/su','/system/xbin/su','/data/local/xbin/su','/data/local/bin/su','/su/bin/su','/sbin/.magisk'];
  var File = Java.use('java.io.File');
  File.exists.implementation = function() {
    var path = this.getAbsolutePath();
    for (var i = 0; i < rootPaths.length; i++) {
      if (path === rootPaths[i]) {
        send({ type: 'hook', message: '[Root] File.exists blocked: ' + path });
        return false;
      }
    }
    return this.exists();
  };
  var Build = Java.use('android.os.Build');
  var tags = Build.TAGS.value;
  if (tags && tags.indexOf('test-keys') !== -1) {
    Build.TAGS.value = 'release-keys';
  }
  send({ type: 'success', message: '[Root] Android root detection bypass installed' });
});`;
}

function getIOSJailbreakBypass(): string {
  return `
if (ObjC.available) {
  var jbPaths = ['/Applications/Cydia.app','/Library/MobileSubstrate/MobileSubstrate.dylib','/bin/bash','/usr/sbin/sshd','/etc/apt','/usr/bin/ssh','/var/jb'];
  var NSFileManager = ObjC.classes.NSFileManager;
  var origFileExists = NSFileManager['- fileExistsAtPath:'];
  Interceptor.attach(origFileExists.implementation, {
    onEnter: function(args) { this.path = new ObjC.Object(args[2]).toString(); },
    onLeave: function(retval) {
      for (var i = 0; i < jbPaths.length; i++) {
        if (this.path === jbPaths[i]) {
          retval.replace(0);
          send({ type: 'hook', message: '[JB] fileExistsAtPath blocked: ' + this.path });
          return;
        }
      }
    }
  });
  send({ type: 'success', message: '[JB] iOS jailbreak detection bypass installed' });
}`;
}
