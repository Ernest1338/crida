// ============================================================================
// Crida - Pre-built Frida Hooks Library
// Common hooks for mobile security testing
// ============================================================================

import type { FridaScript, Platform, ScriptCategory } from "crida-shared";

let scriptIdCounter = 0;

function createScript(
  name: string,
  description: string,
  category: ScriptCategory,
  platform: Platform,
  source: string
): FridaScript {
  return {
    id: `prebuilt-${++scriptIdCounter}`,
    name,
    description,
    category,
    platform,
    source,
    active: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// SSL Pinning Bypass Hooks
// ============================================================================

const androidSSLPinningBypass = createScript(
  "Android SSL Pinning Bypass (Universal)",
  "Bypasses SSL pinning on Android by hooking TrustManagerFactory, OkHttp, and common pinning libraries",
  "ssl-pinning",
  "android",
  `
Java.perform(function() {
  // TrustManager bypass
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

  // SSLContext.init override
  SSLContext.init.overload('[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom').implementation = function(km, tm, sr) {
    this.init(km, [TrustManager.$new()], sr);
    send({ type: 'hook', message: '[SSL] SSLContext.init intercepted - Trust all certificates' });
  };

  // OkHttp3 CertificatePinner bypass
  try {
    var CertificatePinner = Java.use('okhttp3.CertificatePinner');
    CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function(hostname, peerCertificates) {
      send({ type: 'hook', message: '[SSL] OkHttp3 CertificatePinner.check bypassed for: ' + hostname });
    };
    CertificatePinner.check$okhttp.overload('java.lang.String', 'kotlin.jvm.functions.Function0').implementation = function(hostname, peerCertificates) {
      send({ type: 'hook', message: '[SSL] OkHttp3 CertificatePinner.check$okhttp bypassed for: ' + hostname });
    };
  } catch(e) {
    send({ type: 'info', message: '[SSL] OkHttp3 not found, skipping...' });
  }

  // Trustkit bypass
  try {
    var TrustKit = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
    TrustKit.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function(hostname, session) {
      send({ type: 'hook', message: '[SSL] TrustKit verify bypassed for: ' + hostname });
      return true;
    };
  } catch(e) {}

  // WebView SSL error bypass
  try {
    var WebViewClient = Java.use('android.webkit.WebViewClient');
    WebViewClient.onReceivedSslError.implementation = function(view, handler, error) {
      handler.proceed();
      send({ type: 'hook', message: '[SSL] WebView SSL error bypassed' });
    };
  } catch(e) {}

  send({ type: 'success', message: '[SSL] Android SSL pinning bypass hooks installed' });
});
`
);

const iosSSLPinningBypass = createScript(
  "iOS SSL Pinning Bypass (Universal)",
  "Bypasses SSL pinning on iOS by hooking NSURLSession, AFNetworking, and ATS",
  "ssl-pinning",
  "ios",
  `
// iOS SSL Pinning Bypass
if (ObjC.available) {
  // NSURLSession delegate bypass
  try {
    var NSURLSessionConfiguration = ObjC.classes.NSURLSessionConfiguration;

    // Hook defaultSessionConfiguration
    var origDefault = NSURLSessionConfiguration['+ defaultSessionConfiguration'];
    Interceptor.attach(origDefault.implementation, {
      onLeave: function(retval) {
        var config = new ObjC.Object(retval);
        config.setConnectionProxyDictionary_(null);
        send({ type: 'hook', message: '[SSL] NSURLSession default config intercepted' });
      }
    });
  } catch(e) {}

  // SecTrustEvaluate bypass
  try {
    var SecTrustEvaluate = Module.findExportByName('Security', 'SecTrustEvaluate');
    if (SecTrustEvaluate) {
      Interceptor.replace(SecTrustEvaluate, new NativeCallback(function(trust, result) {
        Memory.writeU32(result, 4); // kSecTrustResultProceed
        send({ type: 'hook', message: '[SSL] SecTrustEvaluate bypassed' });
        return 0; // errSecSuccess
      }, 'int', ['pointer', 'pointer']));
    }
  } catch(e) {}

  // SecTrustEvaluateWithError bypass (iOS 12+)
  try {
    var SecTrustEvaluateWithError = Module.findExportByName('Security', 'SecTrustEvaluateWithError');
    if (SecTrustEvaluateWithError) {
      Interceptor.replace(SecTrustEvaluateWithError, new NativeCallback(function(trust, error) {
        send({ type: 'hook', message: '[SSL] SecTrustEvaluateWithError bypassed' });
        return 1; // true = trusted
      }, 'bool', ['pointer', 'pointer']));
    }
  } catch(e) {}

  // AFNetworking bypass
  try {
    var AFSecurityPolicy = ObjC.classes.AFSecurityPolicy;
    if (AFSecurityPolicy) {
      AFSecurityPolicy['- setSSLPinningMode:'].implementation = ObjC.implement(
        AFSecurityPolicy['- setSSLPinningMode:'],
        function(self, _cmd, mode) {
          send({ type: 'hook', message: '[SSL] AFNetworking pinning mode set to none' });
        }
      );
    }
  } catch(e) {}

  // TrustKit iOS bypass
  try {
    var TrustKit = ObjC.classes.TrustKit;
    if (TrustKit) {
      var origInit = TrustKit['- initWithConfiguration:'];
      if (origInit) {
        Interceptor.attach(origInit.implementation, {
          onEnter: function(args) {
            send({ type: 'hook', message: '[SSL] TrustKit initialization intercepted' });
          }
        });
      }
    }
  } catch(e) {}

  send({ type: 'success', message: '[SSL] iOS SSL pinning bypass hooks installed' });
} else {
  send({ type: 'error', message: '[SSL] ObjC runtime not available' });
}
`
);

// ============================================================================
// Root / Jailbreak Detection Bypass
// ============================================================================

const androidRootDetectionBypass = createScript(
  "Android Root Detection Bypass",
  "Bypasses common root detection checks including SafetyNet, file checks, and property checks",
  "root-detection",
  "android",
  `
Java.perform(function() {
  // Common root detection file paths
  var rootPaths = [
    '/system/app/Superuser.apk',
    '/sbin/su',
    '/system/bin/su',
    '/system/xbin/su',
    '/data/local/xbin/su',
    '/data/local/bin/su',
    '/system/sd/xbin/su',
    '/system/bin/failsafe/su',
    '/data/local/su',
    '/su/bin/su',
    '/su/bin',
    '/system/xbin/daemonsu',
    '/system/app/Superuser',
    '/system/etc/init.d/99telecominfra',
    '/system/app/Magisk.apk',
    '/sbin/.magisk',
    '/sbin/.core'
  ];

  var rootPackages = [
    'com.topjohnwu.magisk',
    'eu.chainfire.supersu',
    'com.koushikdutta.superuser',
    'com.noshufou.android.su',
    'com.thirdparty.superuser',
    'com.zachspong.temprootremovejb'
  ];

  // File.exists bypass
  var File = Java.use('java.io.File');
  File.exists.implementation = function() {
    var path = this.getAbsolutePath();
    for (var i = 0; i < rootPaths.length; i++) {
      if (path === rootPaths[i]) {
        send({ type: 'hook', message: '[Root] File.exists blocked for: ' + path });
        return false;
      }
    }
    return this.exists();
  };

  // Runtime.exec bypass
  var Runtime = Java.use('java.lang.Runtime');
  Runtime.exec.overload('[Ljava.lang.String;').implementation = function(cmdArray) {
    var cmd = cmdArray.join(' ');
    if (cmd.indexOf('su') !== -1 || cmd.indexOf('which') !== -1) {
      send({ type: 'hook', message: '[Root] Runtime.exec blocked: ' + cmd });
      throw Java.use('java.io.IOException').$new('Command not found');
    }
    return this.exec(cmdArray);
  };

  // PackageManager bypass for root packages
  var PackageManager = Java.use('android.app.ApplicationPackageManager');
  PackageManager.getPackageInfo.overload('java.lang.String', 'int').implementation = function(packageName, flags) {
    for (var i = 0; i < rootPackages.length; i++) {
      if (packageName === rootPackages[i]) {
        send({ type: 'hook', message: '[Root] PackageManager blocked for: ' + packageName });
        throw Java.use('android.content.pm.PackageManager$NameNotFoundException').$new(packageName);
      }
    }
    return this.getPackageInfo(packageName, flags);
  };

  // Build.TAGS bypass
  var Build = Java.use('android.os.Build');
  var tags = Build.TAGS.value;
  if (tags && tags.indexOf('test-keys') !== -1) {
    Build.TAGS.value = 'release-keys';
    send({ type: 'hook', message: '[Root] Build.TAGS changed from test-keys to release-keys' });
  }

  // System property bypass
  try {
    var SystemProperties = Java.use('android.os.SystemProperties');
    SystemProperties.get.overload('java.lang.String').implementation = function(key) {
      if (key === 'ro.build.tags' || key === 'ro.debuggable' || key === 'ro.secure') {
        if (key === 'ro.debuggable') {
          send({ type: 'hook', message: '[Root] SystemProperties.get bypassed for: ' + key });
          return '0';
        }
        if (key === 'ro.secure') {
          send({ type: 'hook', message: '[Root] SystemProperties.get bypassed for: ' + key });
          return '1';
        }
        if (key === 'ro.build.tags') {
          send({ type: 'hook', message: '[Root] SystemProperties.get bypassed for: ' + key });
          return 'release-keys';
        }
      }
      return this.get(key);
    };
  } catch(e) {}

  send({ type: 'success', message: '[Root] Android root detection bypass hooks installed' });
});
`
);

const iosJailbreakDetectionBypass = createScript(
  "iOS Jailbreak Detection Bypass",
  "Bypasses common jailbreak detection checks including file existence, URL schemes, and sandbox integrity checks",
  "jailbreak-detection",
  "ios",
  `
if (ObjC.available) {
  var jbPaths = [
    '/Applications/Cydia.app',
    '/Applications/Sileo.app',
    '/Applications/Zebra.app',
    '/Library/MobileSubstrate/MobileSubstrate.dylib',
    '/bin/bash',
    '/usr/sbin/sshd',
    '/etc/apt',
    '/private/var/lib/apt',
    '/usr/bin/ssh',
    '/private/var/stash',
    '/usr/libexec/sftp-server',
    '/private/var/tmp/cydia.log',
    '/Applications/blackra1n.app',
    '/private/var/mobile/Library/SBSettings/Themes',
    '/private/var/lib/cydia',
    '/usr/sbin/frida-server',
    '/usr/bin/cycript',
    '/var/jb'
  ];

  var jbURLSchemes = [
    'cydia://',
    'sileo://',
    'zbra://',
    'filza://',
    'undecimus://'
  ];

  // NSFileManager.fileExistsAtPath bypass
  var NSFileManager = ObjC.classes.NSFileManager;
  var origFileExists = NSFileManager['- fileExistsAtPath:'];
  Interceptor.attach(origFileExists.implementation, {
    onEnter: function(args) {
      this.path = new ObjC.Object(args[2]).toString();
    },
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

  // UIApplication.canOpenURL bypass
  try {
    var UIApplication = ObjC.classes.UIApplication;
    var origCanOpen = UIApplication['- canOpenURL:'];
    Interceptor.attach(origCanOpen.implementation, {
      onEnter: function(args) {
        this.url = new ObjC.Object(args[2]).toString();
      },
      onLeave: function(retval) {
        for (var i = 0; i < jbURLSchemes.length; i++) {
          if (this.url && this.url.indexOf(jbURLSchemes[i]) !== -1) {
            retval.replace(0);
            send({ type: 'hook', message: '[JB] canOpenURL blocked: ' + this.url });
            return;
          }
        }
      }
    });
  } catch(e) {}

  // fork() detection bypass
  try {
    var forkPtr = Module.findExportByName(null, 'fork');
    if (forkPtr) {
      Interceptor.replace(forkPtr, new NativeCallback(function() {
        send({ type: 'hook', message: '[JB] fork() call blocked' });
        return -1;
      }, 'int', []));
    }
  } catch(e) {}

  // stat() bypass for jailbreak paths
  try {
    var statPtr = Module.findExportByName(null, 'stat');
    if (statPtr) {
      Interceptor.attach(statPtr, {
        onEnter: function(args) {
          this.path = args[0].readUtf8String();
        },
        onLeave: function(retval) {
          if (this.path) {
            for (var i = 0; i < jbPaths.length; i++) {
              if (this.path.indexOf(jbPaths[i]) !== -1) {
                retval.replace(-1);
                send({ type: 'hook', message: '[JB] stat() blocked for: ' + this.path });
                return;
              }
            }
          }
        }
      });
    }
  } catch(e) {}

  // Dyld image checking bypass
  try {
    var _dyld_image_count = new NativeFunction(
      Module.findExportByName(null, '_dyld_image_count'), 'int', []
    );
    var _dyld_get_image_name = new NativeFunction(
      Module.findExportByName(null, '_dyld_get_image_name'), 'pointer', ['int']
    );

    Interceptor.replace(Module.findExportByName(null, '_dyld_get_image_name'),
      new NativeCallback(function(index) {
        var name = _dyld_get_image_name(index);
        if (name.isNull()) return name;
        var str = name.readUtf8String();
        if (str && (str.indexOf('MobileSubstrate') !== -1 ||
            str.indexOf('substrate') !== -1 ||
            str.indexOf('frida') !== -1 ||
            str.indexOf('cycript') !== -1)) {
          send({ type: 'hook', message: '[JB] Dyld image name hidden: ' + str });
          return Memory.allocUtf8String('/usr/lib/system/libdyld.dylib');
        }
        return name;
      }, 'pointer', ['int'])
    );
  } catch(e) {}

  send({ type: 'success', message: '[JB] iOS jailbreak detection bypass hooks installed' });
} else {
  send({ type: 'error', message: '[JB] ObjC runtime not available' });
}
`
);

// ============================================================================
// Crypto Hooks
// ============================================================================

const androidCryptoMonitor = createScript(
  "Android Crypto Monitor",
  "Monitors Android cryptographic operations including Cipher, MessageDigest, Mac, SecretKeySpec, and KeyStore",
  "crypto",
  "android",
  `
Java.perform(function() {
  // Cipher monitoring
  var Cipher = Java.use('javax.crypto.Cipher');

  Cipher.getInstance.overload('java.lang.String').implementation = function(transformation) {
    send({ type: 'crypto', message: '[Crypto] Cipher.getInstance: ' + transformation });
    return this.getInstance(transformation);
  };

  Cipher.doFinal.overload('[B').implementation = function(input) {
    var mode = this.getOpmode ? 'unknown' : 'unknown';
    try { mode = this.getOpmode() === 1 ? 'ENCRYPT' : 'DECRYPT'; } catch(e) {}
    var algorithm = this.getAlgorithm();
    var inputHex = bytesToHex(input);
    var result = this.doFinal(input);
    var outputHex = bytesToHex(result);
    send({
      type: 'crypto',
      message: '[Crypto] Cipher.' + mode + ' (' + algorithm + ')\\n  Input:  ' + inputHex + '\\n  Output: ' + outputHex
    });
    return result;
  };

  // SecretKeySpec monitoring
  var SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');
  SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function(key, algorithm) {
    send({
      type: 'crypto',
      message: '[Crypto] SecretKeySpec created: ' + algorithm + '\\n  Key: ' + bytesToHex(key)
    });
    return this.$init(key, algorithm);
  };

  // IvParameterSpec monitoring
  var IvParameterSpec = Java.use('javax.crypto.spec.IvParameterSpec');
  IvParameterSpec.$init.overload('[B').implementation = function(iv) {
    send({
      type: 'crypto',
      message: '[Crypto] IvParameterSpec created\\n  IV: ' + bytesToHex(iv)
    });
    return this.$init(iv);
  };

  // MessageDigest monitoring
  var MessageDigest = Java.use('java.security.MessageDigest');
  MessageDigest.digest.overload('[B').implementation = function(input) {
    var algorithm = this.getAlgorithm();
    var inputHex = bytesToHex(input);
    var result = this.digest(input);
    var outputHex = bytesToHex(result);
    send({
      type: 'crypto',
      message: '[Crypto] MessageDigest.' + algorithm + '\\n  Input:  ' + inputHex + '\\n  Output: ' + outputHex
    });
    return result;
  };

  // Mac monitoring
  var Mac = Java.use('javax.crypto.Mac');
  Mac.doFinal.overload('[B').implementation = function(input) {
    var algorithm = this.getAlgorithm();
    var inputHex = bytesToHex(input);
    var result = this.doFinal(input);
    var outputHex = bytesToHex(result);
    send({
      type: 'crypto',
      message: '[Crypto] Mac.' + algorithm + '\\n  Input:  ' + inputHex + '\\n  Output: ' + outputHex
    });
    return result;
  };

  // Base64 monitoring
  try {
    var Base64 = Java.use('android.util.Base64');
    Base64.encodeToString.overload('[B', 'int').implementation = function(input, flags) {
      var result = this.encodeToString(input, flags);
      send({
        type: 'crypto',
        message: '[Crypto] Base64.encode\\n  Input:  ' + bytesToHex(input) + '\\n  Output: ' + result.substring(0, 100)
      });
      return result;
    };
    Base64.decode.overload('java.lang.String', 'int').implementation = function(str, flags) {
      var result = this.decode(str, flags);
      send({
        type: 'crypto',
        message: '[Crypto] Base64.decode\\n  Input:  ' + str.substring(0, 100) + '\\n  Output: ' + bytesToHex(result)
      });
      return result;
    };
  } catch(e) {}

  function bytesToHex(bytes) {
    if (!bytes) return 'null';
    var hex = '';
    for (var i = 0; i < bytes.length && i < 64; i++) {
      var b = (bytes[i] & 0xff).toString(16);
      hex += (b.length === 1 ? '0' : '') + b;
    }
    if (bytes.length > 64) hex += '... (' + bytes.length + ' bytes)';
    return hex;
  }

  send({ type: 'success', message: '[Crypto] Android crypto monitor hooks installed' });
});
`
);

const iosCryptoMonitor = createScript(
  "iOS Crypto Monitor",
  "Monitors iOS cryptographic operations including CommonCrypto (CCCrypt), SecKey operations, and hashing",
  "crypto",
  "ios",
  `
if (ObjC.available) {
  // CCCrypt monitoring
  try {
    var CCCrypt = Module.findExportByName('libcommonCrypto.dylib', 'CCCrypt');
    if (CCCrypt) {
      Interceptor.attach(CCCrypt, {
        onEnter: function(args) {
          this.operation = args[0].toInt32() === 0 ? 'ENCRYPT' : 'DECRYPT';
          this.algorithm = ['AES', 'DES', '3DES', 'CAST', 'RC4', 'RC2', 'Blowfish'][args[1].toInt32()] || 'Unknown';
          this.keyLen = args[3].toInt32();
          this.key = args[2].readByteArray(this.keyLen);
          this.dataLen = args[5].toInt32();
          this.dataIn = args[4].readByteArray(Math.min(this.dataLen, 64));
          this.dataOut = args[6];
          this.dataOutLen = args[7].toInt32();
        },
        onLeave: function(retval) {
          var outData = this.dataOut.readByteArray(Math.min(this.dataOutLen, 64));
          send({
            type: 'crypto',
            message: '[Crypto] CCCrypt ' + this.operation + ' (' + this.algorithm + ')\\n' +
              '  Key (' + this.keyLen + 'B): ' + arrayToHex(this.key) + '\\n' +
              '  Input (' + this.dataLen + 'B): ' + arrayToHex(this.dataIn) + '\\n' +
              '  Output (' + this.dataOutLen + 'B): ' + arrayToHex(outData)
          });
        }
      });
    }
  } catch(e) {}

  // CC_SHA256 monitoring
  try {
    var CC_SHA256 = Module.findExportByName('libcommonCrypto.dylib', 'CC_SHA256');
    if (CC_SHA256) {
      Interceptor.attach(CC_SHA256, {
        onEnter: function(args) {
          this.dataLen = args[1].toInt32();
          this.dataIn = args[0].readByteArray(Math.min(this.dataLen, 64));
          this.md = args[2];
        },
        onLeave: function(retval) {
          var hash = this.md.readByteArray(32);
          send({
            type: 'crypto',
            message: '[Crypto] CC_SHA256\\n  Input (' + this.dataLen + 'B): ' +
              arrayToHex(this.dataIn) + '\\n  Hash: ' + arrayToHex(hash)
          });
        }
      });
    }
  } catch(e) {}

  // CC_MD5 monitoring
  try {
    var CC_MD5 = Module.findExportByName('libcommonCrypto.dylib', 'CC_MD5');
    if (CC_MD5) {
      Interceptor.attach(CC_MD5, {
        onEnter: function(args) {
          this.dataLen = args[1].toInt32();
          this.dataIn = args[0].readByteArray(Math.min(this.dataLen, 64));
          this.md = args[2];
        },
        onLeave: function(retval) {
          var hash = this.md.readByteArray(16);
          send({
            type: 'crypto',
            message: '[Crypto] CC_MD5\\n  Input (' + this.dataLen + 'B): ' +
              arrayToHex(this.dataIn) + '\\n  Hash: ' + arrayToHex(hash)
          });
        }
      });
    }
  } catch(e) {}

  function arrayToHex(arr) {
    if (!arr) return 'null';
    var bytes = new Uint8Array(arr);
    var hex = '';
    for (var i = 0; i < bytes.length && i < 64; i++) {
      hex += ('0' + bytes[i].toString(16)).slice(-2);
    }
    if (bytes.length > 64) hex += '... (' + bytes.length + ' bytes)';
    return hex;
  }

  send({ type: 'success', message: '[Crypto] iOS crypto monitor hooks installed' });
} else {
  send({ type: 'error', message: '[Crypto] ObjC runtime not available' });
}
`
);

// ============================================================================
// Network Monitoring Hooks
// ============================================================================

const androidNetworkMonitor = createScript(
  "Android Network Monitor",
  "Monitors HTTP/HTTPS network traffic at the Java layer including URL connections and OkHttp calls",
  "network",
  "android",
  `
Java.perform(function() {
  // HttpURLConnection monitoring
  var URL = Java.use('java.net.URL');
  URL.openConnection.overload().implementation = function() {
    var url = this.toString();
    send({ type: 'network', message: '[Net] URL.openConnection: ' + url });
    return this.openConnection();
  };

  // OkHttp Request monitoring
  try {
    var Request = Java.use('okhttp3.Request');
    var RequestBody = Java.use('okhttp3.RequestBody');
    var Buffer = Java.use('okio.Buffer');

    var RealCall = Java.use('okhttp3.internal.connection.RealCall');
    RealCall.execute.implementation = function() {
      var request = this.request();
      var url = request.url().toString();
      var method = request.method();
      send({ type: 'network', message: '[Net] OkHttp ' + method + ' ' + url });

      var body = request.body();
      if (body) {
        try {
          var buffer = Buffer.$new();
          body.writeTo(buffer);
          var bodyStr = buffer.readUtf8();
          if (bodyStr.length > 0) {
            send({ type: 'network', message: '[Net] OkHttp Body: ' + bodyStr.substring(0, 500) });
          }
        } catch(e) {}
      }

      var response = this.execute();
      send({ type: 'network', message: '[Net] OkHttp Response: ' + response.code() + ' ' + url });
      return response;
    };
  } catch(e) {
    send({ type: 'info', message: '[Net] OkHttp not found, skipping...' });
  }

  // WebView URL monitoring
  try {
    var WebView = Java.use('android.webkit.WebView');
    WebView.loadUrl.overload('java.lang.String').implementation = function(url) {
      send({ type: 'network', message: '[Net] WebView.loadUrl: ' + url });
      return this.loadUrl(url);
    };
  } catch(e) {}

  send({ type: 'success', message: '[Net] Android network monitor hooks installed' });
});
`
);

// ============================================================================
// Storage Monitoring Hooks
// ============================================================================

const androidStorageMonitor = createScript(
  "Android Storage Monitor",
  "Monitors SharedPreferences, SQLite database operations, and file I/O on Android",
  "storage",
  "android",
  `
Java.perform(function() {
  // SharedPreferences monitoring
  var SharedPreferences = Java.use('android.app.SharedPreferencesImpl');
  SharedPreferences.getString.implementation = function(key, defValue) {
    var result = this.getString(key, defValue);
    send({ type: 'storage', message: '[Storage] SharedPrefs.getString(' + key + ') = ' + result });
    return result;
  };
  SharedPreferences.getInt.implementation = function(key, defValue) {
    var result = this.getInt(key, defValue);
    send({ type: 'storage', message: '[Storage] SharedPrefs.getInt(' + key + ') = ' + result });
    return result;
  };
  SharedPreferences.getBoolean.implementation = function(key, defValue) {
    var result = this.getBoolean(key, defValue);
    send({ type: 'storage', message: '[Storage] SharedPrefs.getBoolean(' + key + ') = ' + result });
    return result;
  };

  // SharedPreferences Editor monitoring
  var Editor = Java.use('android.app.SharedPreferencesImpl$EditorImpl');
  Editor.putString.implementation = function(key, value) {
    send({ type: 'storage', message: '[Storage] SharedPrefs.putString(' + key + ', ' + value + ')' });
    return this.putString(key, value);
  };
  Editor.putInt.implementation = function(key, value) {
    send({ type: 'storage', message: '[Storage] SharedPrefs.putInt(' + key + ', ' + value + ')' });
    return this.putInt(key, value);
  };

  // SQLiteDatabase monitoring
  try {
    var SQLiteDatabase = Java.use('android.database.sqlite.SQLiteDatabase');
    SQLiteDatabase.rawQuery.overload('java.lang.String', '[Ljava.lang.String;').implementation = function(sql, selectionArgs) {
      send({ type: 'storage', message: '[Storage] SQLite.rawQuery: ' + sql });
      return this.rawQuery(sql, selectionArgs);
    };
    SQLiteDatabase.execSQL.overload('java.lang.String').implementation = function(sql) {
      send({ type: 'storage', message: '[Storage] SQLite.execSQL: ' + sql });
      return this.execSQL(sql);
    };
    SQLiteDatabase.insert.implementation = function(table, nullColumnHack, values) {
      send({ type: 'storage', message: '[Storage] SQLite.insert: ' + table + ' = ' + values });
      return this.insert(table, nullColumnHack, values);
    };
  } catch(e) {}

  send({ type: 'success', message: '[Storage] Android storage monitor hooks installed' });
});
`
);

const iosStorageMonitor = createScript(
  "iOS Storage Monitor",
  "Monitors NSUserDefaults, Keychain access, Core Data operations, and file I/O on iOS",
  "storage",
  "ios",
  `
if (ObjC.available) {
  // NSUserDefaults monitoring
  var NSUserDefaults = ObjC.classes.NSUserDefaults;

  Interceptor.attach(NSUserDefaults['- objectForKey:'].implementation, {
    onEnter: function(args) {
      this.key = new ObjC.Object(args[2]).toString();
    },
    onLeave: function(retval) {
      if (!retval.isNull()) {
        var value = new ObjC.Object(retval);
        send({ type: 'storage', message: '[Storage] NSUserDefaults.get(' + this.key + ') = ' + value.toString().substring(0, 200) });
      }
    }
  });

  Interceptor.attach(NSUserDefaults['- setObject:forKey:'].implementation, {
    onEnter: function(args) {
      var value = new ObjC.Object(args[2]);
      var key = new ObjC.Object(args[3]);
      send({ type: 'storage', message: '[Storage] NSUserDefaults.set(' + key + ') = ' + value.toString().substring(0, 200) });
    }
  });

  // Keychain monitoring
  try {
    var SecItemCopyMatching = Module.findExportByName('Security', 'SecItemCopyMatching');
    if (SecItemCopyMatching) {
      Interceptor.attach(SecItemCopyMatching, {
        onEnter: function(args) {
          var query = new ObjC.Object(args[0]);
          send({ type: 'storage', message: '[Storage] SecItemCopyMatching: ' + query.toString().substring(0, 300) });
        }
      });
    }
  } catch(e) {}

  try {
    var SecItemAdd = Module.findExportByName('Security', 'SecItemAdd');
    if (SecItemAdd) {
      Interceptor.attach(SecItemAdd, {
        onEnter: function(args) {
          var attributes = new ObjC.Object(args[0]);
          send({ type: 'storage', message: '[Storage] SecItemAdd: ' + attributes.toString().substring(0, 300) });
        }
      });
    }
  } catch(e) {}

  send({ type: 'success', message: '[Storage] iOS storage monitor hooks installed' });
} else {
  send({ type: 'error', message: '[Storage] ObjC runtime not available' });
}
`
);

// ============================================================================
// Android Debugging Helpers
// ============================================================================

const androidIntentMonitor = createScript(
  "Android Intent Monitor",
  "Monitors Android Intent creation and delivery, including extras and component information",
  "network",
  "android",
  `
Java.perform(function() {
  var Intent = Java.use('android.content.Intent');

  Intent.$init.overload('java.lang.String').implementation = function(action) {
    send({ type: 'intent', message: '[Intent] new Intent(' + action + ')' });
    return this.$init(action);
  };

  Intent.$init.overload('android.content.Context', 'java.lang.Class').implementation = function(ctx, cls) {
    send({ type: 'intent', message: '[Intent] new Intent -> ' + cls.getName() });
    return this.$init(ctx, cls);
  };

  Intent.putExtra.overload('java.lang.String', 'java.lang.String').implementation = function(key, value) {
    send({ type: 'intent', message: '[Intent] putExtra(' + key + ', ' + value + ')' });
    return this.putExtra(key, value);
  };

  Intent.putExtra.overload('java.lang.String', 'int').implementation = function(key, value) {
    send({ type: 'intent', message: '[Intent] putExtra(' + key + ', ' + value + ')' });
    return this.putExtra(key, value);
  };

  Intent.putExtra.overload('java.lang.String', 'boolean').implementation = function(key, value) {
    send({ type: 'intent', message: '[Intent] putExtra(' + key + ', ' + value + ')' });
    return this.putExtra(key, value);
  };

  // Activity start monitoring
  try {
    var Activity = Java.use('android.app.Activity');
    Activity.startActivity.overload('android.content.Intent').implementation = function(intent) {
      var component = intent.getComponent();
      var action = intent.getAction();
      var data = intent.getDataString();
      send({
        type: 'intent',
        message: '[Intent] startActivity: ' +
          (component ? component.getClassName() : 'null') +
          ' action=' + action +
          ' data=' + data
      });
      return this.startActivity(intent);
    };
  } catch(e) {}

  send({ type: 'success', message: '[Intent] Android intent monitor hooks installed' });
});
`
);

// ============================================================================
// Clipboard Monitor
// ============================================================================

const androidClipboardMonitor = createScript(
  "Android Clipboard Monitor",
  "Monitors clipboard read/write operations that may leak sensitive data",
  "storage",
  "android",
  `
Java.perform(function() {
  var ClipboardManager = Java.use('android.content.ClipboardManager');

  ClipboardManager.setPrimaryClip.implementation = function(clip) {
    var text = '';
    try {
      var item = clip.getItemAt(0);
      text = item.getText().toString();
    } catch(e) {}
    send({ type: 'storage', message: '[Clipboard] setPrimaryClip: ' + text.substring(0, 500) });
    return this.setPrimaryClip(clip);
  };

  ClipboardManager.getPrimaryClip.implementation = function() {
    var clip = this.getPrimaryClip();
    if (clip && clip.getItemCount() > 0) {
      try {
        var text = clip.getItemAt(0).getText().toString();
        send({ type: 'storage', message: '[Clipboard] getPrimaryClip: ' + text.substring(0, 500) });
      } catch(e) {}
    }
    return clip;
  };

  send({ type: 'success', message: '[Clipboard] Android clipboard monitor hooks installed' });
});
`
);

// ============================================================================
// Frida Detection Bypass
// ============================================================================

const fridaDetectionBypass = createScript(
  "Frida Detection Bypass",
  "Bypasses common Frida detection techniques including port scanning, library detection, and named pipe checks",
  "root-detection",
  "any",
  `
// Universal Frida detection bypass
// Works on both Android and iOS

// Bypass pthread_create based detection
try {
  var pthreadCreate = Module.findExportByName(null, 'pthread_create');
  if (pthreadCreate) {
    Interceptor.attach(pthreadCreate, {
      onEnter: function(args) {
        var startRoutine = args[2];
        try {
          var moduleName = Process.findModuleByAddress(startRoutine);
          if (moduleName && moduleName.name.indexOf('frida') !== -1) {
            send({ type: 'hook', message: '[Anti-Frida] Blocking frida thread detection' });
          }
        } catch(e) {}
      }
    });
  }
} catch(e) {}

// Bypass strstr based detection (checking for frida strings)
try {
  var strstr = Module.findExportByName(null, 'strstr');
  if (strstr) {
    Interceptor.attach(strstr, {
      onEnter: function(args) {
        this.haystack = args[0].readUtf8String();
        this.needle = args[1].readUtf8String();
      },
      onLeave: function(retval) {
        if (this.needle) {
          var n = this.needle.toLowerCase();
          if (n.indexOf('frida') !== -1 || n.indexOf('gadget') !== -1 || n.indexOf('gum-js') !== -1) {
            retval.replace(ptr(0));
            send({ type: 'hook', message: '[Anti-Frida] strstr detection bypassed for: ' + this.needle });
          }
        }
      }
    });
  }
} catch(e) {}

// Bypass open() checking for frida-related files
try {
  var openPtr = Module.findExportByName(null, 'open');
  if (openPtr) {
    Interceptor.attach(openPtr, {
      onEnter: function(args) {
        this.path = args[0].readUtf8String();
      },
      onLeave: function(retval) {
        if (this.path) {
          var p = this.path.toLowerCase();
          if (p.indexOf('frida') !== -1 || p.indexOf('linjector') !== -1) {
            retval.replace(-1);
            send({ type: 'hook', message: '[Anti-Frida] open() blocked for: ' + this.path });
          }
        }
      }
    });
  }
} catch(e) {}

// Port scanning bypass (frida default port 27042)
try {
  var connectPtr = Module.findExportByName(null, 'connect');
  if (connectPtr) {
    Interceptor.attach(connectPtr, {
      onEnter: function(args) {
        var sockAddr = args[1];
        var family = sockAddr.readU16();
        if (family === 2) { // AF_INET
          var port = (sockAddr.add(2).readU8() << 8) | sockAddr.add(3).readU8();
          if (port === 27042 || port === 27043) {
            send({ type: 'hook', message: '[Anti-Frida] Port scan to ' + port + ' intercepted' });
          }
        }
      }
    });
  }
} catch(e) {}

send({ type: 'success', message: '[Anti-Frida] Frida detection bypass hooks installed' });
`
);

// ============================================================================
// Exported Hooks Library
// ============================================================================

export const HOOKS_LIBRARY: FridaScript[] = [
  androidSSLPinningBypass,
  iosSSLPinningBypass,
  androidRootDetectionBypass,
  iosJailbreakDetectionBypass,
  androidCryptoMonitor,
  iosCryptoMonitor,
  androidNetworkMonitor,
  androidStorageMonitor,
  iosStorageMonitor,
  androidIntentMonitor,
  androidClipboardMonitor,
  fridaDetectionBypass,
];

export function getHooksByPlatform(platform: Platform): FridaScript[] {
  return HOOKS_LIBRARY.filter(
    (h) => h.platform === platform || h.platform === "any"
  );
}

export function getHooksByCategory(category: ScriptCategory): FridaScript[] {
  return HOOKS_LIBRARY.filter((h) => h.category === category);
}

export function getHookById(id: string): FridaScript | undefined {
  return HOOKS_LIBRARY.find((h) => h.id === id);
}
