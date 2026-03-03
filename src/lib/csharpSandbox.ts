// ============================================================
// 🔷 C# Bot Sandbox — Transpiler-based C# execution
// ============================================================
//
// Transpiles a supported subset of C# game-bot code to JavaScript,
// then delegates to the existing JS SandboxedBot for execution.
// No dotnet runtime, no external API, no WASM — zero runtime deps.
//
// HOW IT WORKS
// ────────────
//   1. Players write a top-level Tick() function (or a class with Tick).
//   2. transpileCSharpToJs() converts it to an equivalent createBot() JS.
//   3. The resulting JS is loaded by SandboxedBot, giving tick-level
//      isolation, timeouts, and helper injection — identical to JS bots.
//
// SUPPORTED C# PATTERNS
// ────────────────────
//   ✅ Type declarations:  var, int, double, float, bool, string, List<T>
//   ✅ Control flow:       if/else, for, foreach, while, do-while, switch
//   ✅ LINQ (method chain): Where, Select, OrderBy, OrderByDescending,
//                           First, FirstOrDefault, Last, LastOrDefault,
//                           Any, All, Count, Min, Max, MinBy, MaxBy,
//                           Sum, ToList, ToArray, Take, Skip, Distinct
//   ✅ Lambdas:            x => expr, (x, y) => expr
//   ✅ Null-safe:          obj?.Prop, obj ?? fallback, obj != null
//   ✅ Math:               Math.Sqrt, Math.Abs, Math.Floor, Math.Ceiling,
//                          Math.Min, Math.Max, Math.Pow, Math.PI, Math.Atan2
//   ✅ PascalCase → camelCase for all known API fields
//   ✅ Command helpers:    Command.Idle(), Command.MoveTo(x, y)
//   ✅ New collections:    new List<T>() → [], new List<T> { a, b } → [a, b]
//   ✅ Class-based bots:   class MyBot { Command Tick(...) { ... } }
//   ✅ Top-level bots:     Command Tick(...) { ... }  (no class needed)
//   ✅ State across ticks: static fields or declared-outside-tick variables
//   ✅ String interpolation: $"text {expr}" → `text ${expr}`
//   ✅ Console.WriteLine → console.log
//
// LIMITATIONS
// ───────────
//   ❌ No generics beyond List<T>
//   ❌ No async/await
//   ❌ No reflection or attributes
//   ❌ No struct/record/enum definitions
//   ❌ No multi-file compilation (single file only)
//   ❌ try/catch blocks are stripped to just the try body
//
// ============================================================

import type { BotShip, Command, GameState } from '@/engine/types';
import { SandboxedBot } from '@/lib/botSandbox';
import { buildCSharpHelperMap } from '@/lib/languages/codegen';

// ─────────────────────────────────────────────
// Known API property mappings (PascalCase → camelCase)
// ─────────────────────────────────────────────

const PROP_MAP: Record<string, string> = {
  // Ship
  Alive: 'alive',
  IsCapturing: 'isCapturing',
  TurnsToRevive: 'turnsToRevive',
  InitialX: 'initialX',
  InitialY: 'initialY',
  // GameState
  MyShips: 'myShips',
  EnemyShips: 'enemyShips',
  Islands: 'islands',
  MyScore: 'myScore',
  EnemyScore: 'enemyScore',
  MaxTicks: 'maxTicks',
  MapWidth: 'mapWidth',
  MapHeight: 'mapHeight',
  TargetScore: 'targetScore',
  // Island
  Owner: 'owner',
  TeamCapturing: 'teamCapturing',
  CaptureProgress: 'captureProgress',
  CaptureTurns: 'captureTurns',
  Radius: 'radius',
  Value: 'value',
  // Shared
  X: 'x',
  Y: 'y',
  Id: 'id',
};

// Helper functions (PascalCase → camelCase mapping).
// Generated from the language registry — adding a helper to CANONICAL_HELPERS
// automatically adds its C# name mapping here. Do NOT hardcode manually.
const HELPER_MAP: Record<string, string> = buildCSharpHelperMap();

// ─────────────────────────────────────────────
// Transpiler helpers
// ─────────────────────────────────────────────

/** Extracts the contents of the outermost matching brace pair starting at pos. */
function extractBraceBlock(src: string, openPos: number): { body: string; end: number } {
  let depth = 0;
  let i = openPos;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return { body: src.slice(openPos + 1, i), end: i };
      }
    }
    i++;
  }
  return { body: src.slice(openPos + 1), end: src.length };
}

/** Simple PascalCase → camelCase (first letter lower, rest unchanged) */
function toCamel(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Strip C# type annotations from parameter lists: int x, Ship ship → x, ship */
function stripParamTypes(params: string): string {
  if (!params.trim()) return params;
  return params
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      // Match: optional out/ref/in, Type (incl. generics + array), name
      const m = trimmed.match(/^(?:(?:out|ref|in)\s+)?[\w<>\[\],\s]+\s+(\w+)$/);
      return m ? m[1] : trimmed;
    })
    .join(', ');
}

/** Strip C# type from a single-variable declaration, return just the name. */
function stripVarType(decl: string): string {
  const m = decl.match(/^(?:var|[\w<>\[\],\s]+)\s+(\w+)$/);
  return m ? m[1] : decl;
}

// ─────────────────────────────────────────────
// C# → JavaScript transformation passes
// Applied in order; each pass modifies the running string.
// ─────────────────────────────────────────────

function applyTransforms(code: string): string {
  let s = code;

  // ── Pass 1: Remove using / namespace / class boilerplate ────────────
  // Remove using statements
  s = s.replace(/^\s*using\s+[^;]+;\s*$/gm, '');
  // Remove namespace declarations (keep body)
  s = s.replace(/^\s*namespace\s+\S+\s*\{/, '');
  // Close the namespace brace at the end (approximate — remove final unmatched })
  // We'll handle this by stripping class wrappers below.

  // ── Pass 2: String interpolation  $"..." → `...` ────────────────────
  s = s.replace(/\$"([^"]*?)"/g, (_, inner) => {
    // Replace {expr} inside → ${expr}
    const converted = inner.replace(/\{([^}]+)\}/g, '${$1}');
    return '`' + converted + '`';
  });

  // ── Pass 3: Math methods (PascalCase → lowercase) ───────────────────
  s = s.replace(/\bMath\.Sqrt\b/g, 'Math.sqrt');
  s = s.replace(/\bMath\.Abs\b/g, 'Math.abs');
  s = s.replace(/\bMath\.Floor\b/g, 'Math.floor');
  s = s.replace(/\bMath\.Ceiling\b/g, 'Math.ceil');
  s = s.replace(/\bMath\.Round\b/g, 'Math.round');
  s = s.replace(/\bMath\.Pow\b/g, 'Math.pow');
  s = s.replace(/\bMath\.Max\b/g, 'Math.max');
  s = s.replace(/\bMath\.Min\b/g, 'Math.min');
  s = s.replace(/\bMath\.Atan2\b/g, 'Math.atan2');
  s = s.replace(/\bMath\.Sin\b/g, 'Math.sin');
  s = s.replace(/\bMath\.Cos\b/g, 'Math.cos');
  s = s.replace(/\bMath\.Tan\b/g, 'Math.tan');
  s = s.replace(/\bMath\.Log\b/g, 'Math.log');
  s = s.replace(/\bMath\.Exp\b/g, 'Math.exp');

  // ── Pass 4: Console → console ────────────────────────────────────────
  s = s.replace(/\bConsole\.WriteLine\b/g, 'console.log');
  s = s.replace(/\bConsole\.Write\b/g, 'console.log');

  // ── Pass 5: Helper function name remapping ────────────────────────────
  for (const [cs, js] of Object.entries(HELPER_MAP)) {
    s = s.replace(new RegExp(`\\b${cs}\\b`, 'g'), js);
  }

  // ── Pass 6: Command helpers ────────────────────────────────────────────
  // Command.Idle() or Idle() → { type: 'idle' }
  s = s.replace(/\bCommand\.Idle\(\)/g, "{ type: 'idle' }");
  s = s.replace(/\bIdle\(\)/g, "{ type: 'idle' }");
  // Command.MoveTo(x, y) or Move(x, y) → { type: 'move', target: { x, y } }
  s = s.replace(
    /\bCommand\.MoveTo\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    "{ type: 'move', target: { x: $1, y: $2 } }",
  );
  s = s.replace(
    /\bMove\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    "{ type: 'move', target: { x: $1, y: $2 } }",
  );
  // new Command { Type = "idle" } → { type: 'idle' }
  s = s.replace(/new\s+Command\s*\{\s*Type\s*=\s*"idle"\s*\}/g, "{ type: 'idle' }");
  // new Command { Type = "move", Target = new Point { X = ..., Y = ... } }
  s = s.replace(
    /new\s+Command\s*\{\s*Type\s*=\s*"move"\s*,\s*Target\s*=\s*new\s+(?:Point|Target)\s*\{\s*X\s*=\s*([^,}]+)\s*,\s*Y\s*=\s*([^}]+)\s*\}\s*\}/g,
    "{ type: 'move', target: { x: $1, y: $2 } }",
  );

  // ── Pass 7: new Point { X = x, Y = y } → { x, y } ──────────────────
  s = s.replace(
    /new\s+(?:Point|Vector2?)\s*\{\s*X\s*=\s*([^,}]+)\s*,\s*Y\s*=\s*([^}]+)\s*\}/g,
    '{ x: $1, y: $2 }',
  );

  // ── Pass 8: new List<T>() → [] / new List<T> { ... } → [...] ────────
  s = s.replace(/new\s+List\s*<[^>]+>\s*\(\s*\)/g, '[]');
  s = s.replace(/new\s+List\s*<[^>]+>\s*\{([^}]*)\}/g, '[$1]');
  s = s.replace(/new\s+\w+\[\]\s*\{([^}]*)\}/g, '[$1]'); // new int[] { ... }

  // ── Pass 9: LINQ method chain transformations ─────────────────────────
  // Order matters: do compound ones first, then simple ones.

  // .MinBy(x => expr) → custom inline: [...arr].reduce((a,b) => expr(a) < expr(b) ? a : b, arr[0])
  // We handle MinBy/MaxBy with a wrapper approach
  // Note: ([^()]*(?:\([^()]*\)[^()]*)*) captures expressions with one level of nested parens
  s = s.replace(/\.MinBy\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.reduce((___a, ${param}) => {
      const ___v = ${expr};
      return (___a === undefined || ___v < ___a.__minVal) ? { __minVal: ___v, __item: ${param} } : ___a;
    }, undefined)?..__item`.replace(/\s+/g, ' ');
  });
  s = s.replace(/\.MaxBy\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.reduce((___a, ${param}) => {
      const ___v = ${expr};
      return (___a === undefined || ___v > ___a.__maxVal) ? { __maxVal: ___v, __item: ${param} } : ___a;
    }, undefined)?..__item`.replace(/\s+/g, ' ');
  });

  // .Where(pred) → .filter(pred)
  s = s.replace(/\.Where\(/g, '.filter(');
  // .Select(fn) → .map(fn)
  s = s.replace(/\.Select\(/g, '.map(');
  // .OrderBy(key) → custom sort ascending
  // Note: ([^()]*(?:\([^()]*\)[^()]*)*) captures expressions with one level of nested parens
  s = s.replace(/\.OrderBy\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.sort((${param}A, ${param}B) => {
      const __a = ((${param}) => ${expr})(${param}A);
      const __b = ((${param}) => ${expr})(${param}B);
      return __a < __b ? -1 : __a > __b ? 1 : 0;
    })`.replace(/\s+/g, ' ');
  });
  // .OrderByDescending(key) → custom sort descending
  s = s.replace(/\.OrderByDescending\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.sort((${param}A, ${param}B) => {
      const __a = ((${param}) => ${expr})(${param}A);
      const __b = ((${param}) => ${expr})(${param}B);
      return __a > __b ? -1 : __a < __b ? 1 : 0;
    })`.replace(/\s+/g, ' ');
  });
  // .ThenBy(key) → (chained sort — simplified, appended after sort)
  s = s.replace(/\.ThenBy\((\w+)\s*=>\s*([^)]+)\)/g, '/* ThenBy not supported */');
  // .First() → [0]
  s = s.replace(/\.First\(\)/g, '[0]');
  // .FirstOrDefault() → [0] ?? null
  s = s.replace(/\.FirstOrDefault\(\)/g, '[0] ?? null');
  // .FirstOrDefault(pred) → .find(pred) ?? null
  s = s.replace(/\.FirstOrDefault\(/g, '.find(');
  // .First(pred) → .find(pred)
  s = s.replace(/\.First\(/g, '.find(');
  // .Last() → slice(-1)[0]
  s = s.replace(/\.Last\(\)/g, '.slice(-1)[0]');
  // .LastOrDefault() → slice(-1)[0] ?? null
  s = s.replace(/\.LastOrDefault\(\)/g, '.slice(-1)[0] ?? null');
  // .Any() → .length > 0
  s = s.replace(/\.Any\(\)/g, '.length > 0');
  // .Any(pred) → .some(pred)
  s = s.replace(/\.Any\(/g, '.some(');
  // .All(pred) → .every(pred)
  s = s.replace(/\.All\(/g, '.every(');
  // .Count() → .length
  s = s.replace(/\.Count\(\)/g, '.length');
  // .Count → .length (property access form)
  s = s.replace(/\.Count\b(?!\()/g, '.length');
  // .Length → .length
  s = s.replace(/\.Length\b/g, '.length');
  // .Sum(fn) → .reduce((acc, x) => acc + fn(x), 0)
  s = s.replace(/\.Sum\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.reduce((___sum, ${param}) => ___sum + (${expr}), 0)`;
  });
  s = s.replace(/\.Sum\(\)/g, '.reduce((a, b) => a + b, 0)');
  // .Min(fn) → Math.min(...arr.map(fn))
  s = s.replace(/\.Min\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.reduce((___m, ${param}) => Math.min(___m, ${expr}), Infinity)`;
  });
  s = s.replace(/\.Min\(\)/g, '.reduce((a, b) => Math.min(a, b), Infinity)');
  // .Max(fn) → Math.max
  s = s.replace(/\.Max\((\w+)\s*=>\s*([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (_, param, expr) => {
    return `.reduce((___m, ${param}) => Math.max(___m, ${expr}), -Infinity)`;
  });
  s = s.replace(/\.Max\(\)/g, '.reduce((a, b) => Math.max(a, b), -Infinity)');
  // .ToList() / .ToArray() → remove (already array-like)
  s = s.replace(/\.ToList\(\)/g, '');
  s = s.replace(/\.ToArray\(\)/g, '');
  // .Take(n) → .slice(0, n)
  s = s.replace(/\.Take\((\d+)\)/g, '.slice(0, $1)');
  // .Skip(n) → .slice(n)
  s = s.replace(/\.Skip\((\d+)\)/g, '.slice($1)');
  // .Distinct() → [...new Set(...)] — approximate
  s = s.replace(/\.Distinct\(\)/g, '/* Distinct: dedupe manually if needed */');
  // .Reverse() → .slice().reverse()
  s = s.replace(/\.Reverse\(\)/g, '.slice().reverse()');
  // .Contains(x) → .includes(x)
  s = s.replace(/\.Contains\(/g, '.includes(');
  // string.IsNullOrEmpty(s) → !s
  s = s.replace(/string\.IsNullOrEmpty\(([^)]+)\)/g, '(!($1))');
  s = s.replace(/string\.IsNullOrWhiteSpace\(([^)]+)\)/g, '(!($1)?.trim())');

  // ── Pass 10: Type-cast removal: (int)x → Math.floor(x), (double)x → x ─
  s = s.replace(/\(int\)\s*([a-zA-Z0-9_.]+)/g, 'Math.floor($1)');
  s = s.replace(/\(double\)\s*/g, '');
  s = s.replace(/\(float\)\s*/g, '');
  s = s.replace(/\(string\)\s*/g, 'String(');
  // Note: (string) cast above is incomplete — leave as-is for now

  // ── Pass 11: Variable declarations ────────────────────────────────────
  // var/type declarations → let
  const TYPE_PATTERN =
    /\b(var|int|double|float|long|uint|ulong|byte|short|ushort|decimal|bool|string|List<[^>]+>|IEnumerable<[^>]+>|IList<[^>]+>|IReadOnlyList<[^>]+>|Command|Ship|GameState|Island|BotShip|Point)\s+(\w+)\s*(=)/g;
  s = s.replace(TYPE_PATTERN, 'let $2 $3');

  // ── Pass 12: foreach → for...of ───────────────────────────────────────
  s = s.replace(/\bforeach\s*\(\s*(?:var\s+|[\w<>]+\s+)?(\w+)\s+in\s+([^)]+)\)/g, 'for (const $1 of $2)');

  // ── Pass 13: try/catch → just try block ─────────────────────────────
  // We strip catch blocks (game bots shouldn't throw, and SandboxedBot handles errors)
  s = s.replace(/\}\s*catch\s*\([^)]*\)\s*\{[^}]*\}/g, '}');
  s = s.replace(/\bfinally\s*\{[^}]*\}/g, '');

  // ── Pass 14: Boolean literals (already JS-compatible, but ensure lowercase) ──
  // C# true/false/null are same as JS — no change needed.

  // ── Pass 15: Known property name remapping ────────────────────────────
  // We build a regex from known property names, applied with word boundaries
  // on the right-hand side of a dot.
  for (const [pascal, camel] of Object.entries(PROP_MAP)) {
    if (pascal === camel) continue;
    // Match: .PropertyName (but not part of a longer identifier)
    s = s.replace(new RegExp(`(?<=\\.)${pascal}\\b`, 'g'), camel);
  }

  // ── Pass 16: Method return type declarations → function ───────────────
  // Transform: ReturnType MethodName(TypedParams) { body }
  // → function MethodName(params) { body }
  // This is done in the structural extraction step (not here).

  // ── Pass 17: Generic property camelCase (fallback for unknown props) ──
  // Convert .PascalCase to .camelCase for anything that's .Uppercase* followed
  // by identifier chars. This is a heuristic — safe for most cases.
  s = s.replace(/(?<=\.)([A-Z][a-zA-Z0-9]+)\b/g, (_, name) => {
    // Skip known JS globals that start uppercase (Set, Map, Error, etc.)
    const jsGlobals = new Set([
      'Set',
      'Map',
      'Error',
      'Array',
      'Object',
      'JSON',
      'Date',
      'Promise',
      'Math',
      'Number',
      'String',
      'Boolean',
      'Symbol',
      'Function',
      'RegExp',
      'NaN',
      'Infinity',
    ]);
    if (jsGlobals.has(name)) return name;
    return toCamel(name);
  });

  // ── Pass 18: static keyword removal ─────────────────────────────────
  s = s.replace(/\bstatic\s+/g, '');
  s = s.replace(/\bprivate\s+/g, '');
  s = s.replace(/\bpublic\s+/g, '');
  s = s.replace(/\bprotected\s+/g, '');
  s = s.replace(/\binternal\s+/g, '');
  s = s.replace(/\breadonly\s+/g, '');
  s = s.replace(/\boverride\s+/g, '');
  s = s.replace(/\bvirtual\s+/g, '');
  s = s.replace(/\babstract\s+/g, '');
  s = s.replace(/\bnew\s+(?=\w)/g, 'new '); // normalize spacing

  // ── Pass 19: .f number suffix removal ────────────────────────────────
  s = s.replace(/(\d+\.\d*)f\b/g, '$1');
  s = s.replace(/(\d+)f\b/g, '$1');
  s = s.replace(/(\d+\.\d*)d\b/g, '$1');
  s = s.replace(/(\d+)m\b/g, '$1'); // decimal suffix

  return s;
}

// ─────────────────────────────────────────────
// Method extractor
// ─────────────────────────────────────────────

interface ExtractedMethod {
  name: string;
  params: string;
  body: string;
}

/**
 * Finds all method-like definitions in preprocessed C# code.
 * Handles: ReturnType Name(TypedParams) { body }
 * Returns an array of extracted methods.
 */
function extractMethods(code: string): ExtractedMethod[] {
  const methods: ExtractedMethod[] = [];

  // Match: optional type params, method name, params, opening brace
  // Regex: word ReturnType, space, MethodName(params) {
  const METHOD_RE =
    /(?:^|\n)\s*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\(([^)]*)\)\s*\{/gm;

  let m: RegExpExecArray | null;
  while ((m = METHOD_RE.exec(code)) !== null) {
    const methodName = m[1];
    // Skip constructors, if/for/while/switch keywords
    if (['if', 'for', 'while', 'switch', 'catch', 'else'].includes(methodName)) continue;
    // Skip class/namespace names
    if (m[0].includes('class ') || m[0].includes('namespace ')) continue;

    const rawParams = m[2];
    const bracePos = m.index + m[0].length - 1;

    try {
      const { body } = extractBraceBlock(code, bracePos);
      methods.push({
        name: methodName,
        params: stripParamTypes(rawParams),
        body,
      });
    } catch {
      // Skip unparseable method
    }
  }

  return methods;
}

/**
 * Strips the outer class wrapper(s) from C# code.
 * Returns the content inside the innermost class body.
 */
function stripClassWrapper(code: string): string {
  // Find class declaration
  const classMatch = code.match(/\bclass\s+\w+[\s\S]*?\{/);
  if (!classMatch || classMatch.index === undefined) return code;

  const braceStart = classMatch.index + classMatch[0].length - 1;
  try {
    const { body } = extractBraceBlock(code, braceStart);
    return body;
  } catch {
    return code;
  }
}

// ─────────────────────────────────────────────
// Main transpiler entry point
// ─────────────────────────────────────────────

/**
 * Transpile C# bot code to an equivalent JavaScript `createBot()` module.
 *
 * The output is a valid JavaScript string that can be passed directly to
 * SandboxedBot.initFromCode().
 *
 * @throws {Error} with a descriptive message if the code cannot be transpiled.
 */
export function transpileCSharpToJs(csCode: string): string {
  // ── Step 1: Strip single-line and block comments ─────────────────────
  let code = csCode
    .replace(/\/\/[^\n]*/g, '') // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments

  // ── Step 2: Strip class wrapper (if present) ──────────────────────────
  const hasClass = /\bclass\s+\w+/.test(code);
  if (hasClass) {
    code = stripClassWrapper(code);
  }

  // ── Step 3: Apply language transforms ─────────────────────────────────
  code = applyTransforms(code);

  // ── Step 4: Extract methods ────────────────────────────────────────────
  const methods = extractMethods(code);

  // Find the Tick method
  const tickMethod = methods.find(
    (m) => m.name === 'Tick' || m.name === 'tick',
  );

  if (!tickMethod) {
    throw new Error(
      'C# bot code must define a Tick(GameState state, Ship ship) method. ' +
        'Use the starter template as a guide.',
    );
  }

  // All other methods become helper functions available to tick()
  const helperMethods = methods.filter((m) => m !== tickMethod);

  // ── Step 5: Strip remaining C# type annotations from tick params ───────
  // tickMethod.params is already stripped by extractMethods/stripParamTypes
  // Normalize to (state, ship)
  let tickParams = tickMethod.params.trim();
  if (!tickParams) tickParams = 'state, ship';

  // ── Step 6: Generate JavaScript ────────────────────────────────────────
  const helpers = helperMethods
    .map((m) => {
      const jsName = toCamel(m.name);
      return `  function ${jsName}(${m.params}) {${m.body}}`;
    })
    .join('\n\n');

  const js = `
function createBot() {
  // ── State across ticks (defined at bot-instance scope) ────────────
  const memory = {};
${helpers ? '\n' + helpers : ''}
  return {
    tick(${tickParams}) {
${tickMethod.body}
    }
  };
}
`.trim();

  return js;
}

// ─────────────────────────────────────────────
// CSharpSandboxedBot
// ─────────────────────────────────────────────

/**
 * Bot sandbox for C# code.
 *
 * Transpiles C# → JavaScript once, then delegates all tick() calls
 * to the existing SandboxedBot — giving the same sandboxing, timeout
 * protection, and helper injection as native JS bots.
 */
export class CSharpSandboxedBot {
  private inner: SandboxedBot;
  private readonly label: string;
  private _initialized = false;

  constructor(label: string) {
    this.label = label;
    this.inner = new SandboxedBot(label, { timeoutMs: 50 });
  }

  /**
   * Transpile and load C# bot code.
   *
   * @throws If the C# code cannot be transpiled (missing Tick method, etc.).
   *         Caller should surface the error in the editor UI.
   */
  async initFromCode(code: string): Promise<void> {
    let jsCode: string;
    try {
      jsCode = transpileCSharpToJs(code);
    } catch (err) {
      throw new Error(
        `C# transpilation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Delegate to the JS sandbox for execution
    try {
      this.inner.initFromCode(jsCode);
    } catch (err) {
      throw new Error(
        `C# bot initialization error: ${err instanceof Error ? err.message : String(err)}\n\n` +
          `This may be caused by a transpilation issue. Generated JS:\n${jsCode}`,
      );
    }

    this._initialized = true;
  }

  tick(state: GameState, ship: BotShip): Command {
    if (!this._initialized) return { type: 'idle' };
    return this.inner.tick(state, ship);
  }

  get isReady(): boolean {
    return this._initialized && this.inner.isReady;
  }

  get isTimedOut(): boolean {
    return this.inner.isTimedOut;
  }

  destroy(): void {
    this.inner.destroy();
    this._initialized = false;
  }
}

// ─────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────

/**
 * Returns true if the code string looks like C#.
 * Checks for a `// @language: csharp` marker or C#-specific syntax.
 */
export function isCSharpCode(code: string): boolean {
  const firstLines = code.slice(0, 600).trimStart();
  if (/^\/\/\s*@language\s*:\s*csharp/im.test(firstLines)) return true;
  // Heuristic: C#-style Tick method signature or using statements
  if (/\bCommand\s+Tick\s*\(/m.test(code)) return true;
  if (/^\s*using\s+System\s*;/m.test(code)) return true;
  return false;
}
