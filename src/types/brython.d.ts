// ============================================================
// Brython type declarations
// ============================================================
// Brython attaches to globalThis.__BRYTHON__ when its module
// is imported. This file tells TypeScript about the ambient global.
// ============================================================

declare module 'brython' {
  // brython.js exports __BRYTHON__ for Node-style environments
  const __BRYTHON__: BrythonRuntime;
  export { __BRYTHON__ };
}

/** Minimal typings for the Brython runtime we actually use */
interface BrythonRuntime {
  /** Compile + execute a Python source string. Returns the module namespace. */
  runPythonSource(src: string, options?: { name?: string; id?: string }): BrythonModule;
  /** Call a Python callable with positional arguments. */
  $call(callable: BrythonObject): (...args: unknown[]) => unknown;
  /** Get an attribute from a Python object. */
  $getattr(obj: BrythonObject, attr: string, fallback?: unknown): unknown;
  /** Map of imported module namespaces, keyed by module name. */
  imported: Record<string, BrythonModule>;
  /** The Python `brython()` initialization function (for DOM integration). */
  brython(options?: Record<string, unknown>): void;
  /** Python builtins */
  builtins: Record<string, BrythonObject>;
}

/** A Brython module namespace (module attributes are JS properties). */
type BrythonModule = Record<string, BrythonObject>;

/** Opaque Brython Python object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrythonObject = any;

declare global {
   
  var __BRYTHON__: BrythonRuntime | undefined;
}
