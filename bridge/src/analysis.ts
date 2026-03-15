// ============================================================================
// Crida Bridge - Analysis Module
// Binary analysis capabilities: class enumeration, module inspection, etc.
// ============================================================================

import type { ScriptManager } from "./script-manager";

// Pre-built analysis scripts
const ENUM_CLASSES_SCRIPT = (filter?: string) => `
  var classes = [];
  Java.perform(function() {
    Java.enumerateLoadedClasses({
      onMatch: function(name) {
        ${filter ? `if (name.toLowerCase().indexOf("${filter.toLowerCase()}") !== -1)` : ""}
        classes.push(name);
      },
      onComplete: function() {}
    });
  });
  rpc.exports = {
    getClasses: function() { return classes; }
  };
`;

const GET_CLASS_METHODS_SCRIPT = (className: string) => `
  rpc.exports = {
    getClassInfo: function() {
      return new Promise(function(resolve) {
        Java.perform(function() {
          try {
            var cls = Java.use("${className}");
            var javaClass = cls.class;

            var methods = [];
            var declaredMethods = javaClass.getDeclaredMethods();
            for (var i = 0; i < declaredMethods.length; i++) {
              var m = declaredMethods[i];
              var paramTypes = m.getParameterTypes();
              var argTypes = [];
              for (var j = 0; j < paramTypes.length; j++) {
                argTypes.push(paramTypes[j].getName());
              }
              methods.push({
                name: m.getName(),
                returnType: m.getReturnType().getName(),
                argumentTypes: argTypes,
                isConstructor: false
              });
            }

            // Add constructors
            var constructors = javaClass.getDeclaredConstructors();
            for (var k = 0; k < constructors.length; k++) {
              var c = constructors[k];
              var cParamTypes = c.getParameterTypes();
              var cArgTypes = [];
              for (var l = 0; l < cParamTypes.length; l++) {
                cArgTypes.push(cParamTypes[l].getName());
              }
              methods.push({
                name: "<init>",
                returnType: "void",
                argumentTypes: cArgTypes,
                isConstructor: true
              });
            }

            // Fields
            var fields = [];
            var declaredFields = javaClass.getDeclaredFields();
            for (var fi = 0; fi < declaredFields.length; fi++) {
              var f = declaredFields[fi];
              fields.push({
                name: f.getName(),
                type: f.getType().getName()
              });
            }

            var superClass = javaClass.getSuperclass();

            resolve({
              name: "${className}",
              methods: methods,
              fields: fields,
              superClass: superClass ? superClass.getName() : null
            });
          } catch(e) {
            resolve({ name: "${className}", methods: [], fields: [], error: e.message });
          }
        });
      });
    }
  };
`;

const ENUM_MODULES_SCRIPT = `
  rpc.exports = {
    getModules: function() {
      var modules = Process.enumerateModules();
      return modules.map(function(m) {
        return {
          name: m.name,
          base: m.base.toString(),
          size: m.size,
          path: m.path
        };
      });
    }
  };
`;

const GET_MODULE_EXPORTS_SCRIPT = (moduleName: string) => `
  rpc.exports = {
    getExports: function() {
      var exports = Module.enumerateExports("${moduleName}");
      return exports.map(function(e) {
        return {
          name: e.name,
          type: e.type,
          address: e.address.toString()
        };
      });
    }
  };
`;

const GET_MODULE_IMPORTS_SCRIPT = (moduleName: string) => `
  rpc.exports = {
    getImports: function() {
      var imports = Module.enumerateImports("${moduleName}");
      return imports.map(function(i) {
        return {
          name: i.name || "",
          module: i.module || "",
          address: i.address ? i.address.toString() : "",
          type: i.type || ""
        };
      });
    }
  };
`;

export class AnalysisEngine {
  private scriptManager: ScriptManager;

  constructor(scriptManager: ScriptManager) {
    this.scriptManager = scriptManager;
  }

  async enumerateClasses(filter?: string): Promise<string[]> {
    const script = await this.scriptManager.loadScript(ENUM_CLASSES_SCRIPT(filter));
    const exports = script.exports as { getClasses: () => Promise<string[]> };
    const classes = await exports.getClasses();
    return classes;
  }

  async getClassMethods(className: string): Promise<unknown> {
    const script = await this.scriptManager.loadScript(GET_CLASS_METHODS_SCRIPT(className));
    const exports = script.exports as { getClassInfo: () => Promise<unknown> };
    return exports.getClassInfo();
  }

  async enumerateModules(): Promise<unknown[]> {
    const script = await this.scriptManager.loadScript(ENUM_MODULES_SCRIPT);
    const exports = script.exports as { getModules: () => Promise<unknown[]> };
    return exports.getModules();
  }

  async getModuleExports(moduleName: string): Promise<unknown[]> {
    const script = await this.scriptManager.loadScript(GET_MODULE_EXPORTS_SCRIPT(moduleName));
    const exports = script.exports as { getExports: () => Promise<unknown[]> };
    return exports.getExports();
  }

  async getModuleImports(moduleName: string): Promise<unknown[]> {
    const script = await this.scriptManager.loadScript(GET_MODULE_IMPORTS_SCRIPT(moduleName));
    const exports = script.exports as { getImports: () => Promise<unknown[]> };
    return exports.getImports();
  }
}
