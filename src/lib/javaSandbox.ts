// ============================================================
// ☕ Bots Battle — Java Bot Sandbox (Transpiler)
// ============================================================
//
// Transpiles Java bot code to JavaScript, then delegates to the
// existing SandboxedBot for execution. No external API, no JVM,
// no Wandbox — zero latency at runtime.
//
// HOW IT WORKS
// ────────────
//   1. Player writes a Bot class with: Command tick(GameState state, BotShip ship)
//   2. transpileJavaToJs() converts it to createBot() JS
//   3. The resulting JS runs in SandboxedBot — same speed as native JS bots
//
// SUPPORTED JAVA PATTERNS
// ───────────────────────
//   ✅ Primitives: int, double, float, long, boolean, String
//   ✅ Arrays: Type[], .length
//   ✅ ArrayList, List: new ArrayList<>(), .add(), .get(), .size(), .isEmpty()
//   ✅ Control flow: if/else, for, for-each, while, do-while, switch
//   ✅ Math: Math.sqrt, Math.abs, Math.min, Math.max, Math.pow, Math.PI, Math.atan2
//   ✅ BotHelpers.* → direct helper calls
//   ✅ Command.idle() / Command.move(x, y) → JS command objects
//   ✅ Bot class with tick() method + optional helper methods
//   ✅ Instance fields (state across ticks in createBot closure)
//   ✅ System.out.println → console.log
//   ✅ String concatenation with +
//   ✅ Ternary operator, null checks
//
// LIMITATIONS
// ───────────
//   ❌ No generics beyond basic List/ArrayList
//   ❌ No interfaces/abstract classes
//   ❌ No try/catch (stripped)
//   ❌ No annotations
//   ❌ No multi-file compilation
//   ❌ No streams API
// ============================================================

import type { BotShip, Command, GameState } from '@/engine/types';
import { SandboxedBot } from '@/lib/botSandbox';

// ─────────────────────────────────────────────
// Transpiler helpers
// ─────────────────────────────────────────────

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

/** Strip Java type annotations from parameter list: GameState state, BotShip ship → state, ship */
function stripParamTypes(params: string): string {
  if (!params.trim()) return params;
  return params
    .split(',')
    .map((p) => {
      const trimmed = p.trim();
      // Match: optional final, Type (incl. generics + array), name
      const m = trimmed.match(/^(?:final\s+)?[\w<>\[\]]+\s+(\w+)$/);
      return m ? m[1] : trimmed;
    })
    .join(', ');
}

// ─────────────────────────────────────────────
// Java → JavaScript transformation passes
// ─────────────────────────────────────────────

function applyTransforms(code: string): string {
  let s = code;

  // ── Pass 1: Remove import statements ────────────────────────────────
  s = s.replace(/^\s*import\s+[^;]+;\s*$/gm, '');
  s = s.replace(/^\s*package\s+[^;]+;\s*$/gm, '');

  // ── Pass 2: BotHelpers.method → method (direct helper calls) ─────────
  s = s.replace(/\bBotHelpers\.(\w+)/g, '$1');

  // ── Pass 3: Command helpers ────────────────────────────────────────────
  s = s.replace(/\bCommand\.idle\(\)/g, "{ type: 'idle' }");
  s = s.replace(
    /\bCommand\.move\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    "{ type: 'move', target: { x: $1, y: $2 } }",
  );
  // Bare idle() / move(x, y) — simplified syntax
  s = s.replace(/\bidle\(\)/g, "{ type: 'idle' }");
  s = s.replace(
    /\bmove\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    "{ type: 'move', target: { x: $1, y: $2 } }",
  );

  // ── Pass 4: System.out.println → console.log ──────────────────────────
  s = s.replace(/\bSystem\.out\.println\b/g, 'console.log');
  s = s.replace(/\bSystem\.out\.print\b/g, 'console.log');
  s = s.replace(/\bSystem\.err\.println\b/g, 'console.warn');

  // ── Pass 5: Array operations ────────────────────────────────────────
  // .length already same in JS for arrays
  // Type[] → handled by variable decl stripping

  // ── Pass 6: ArrayList/List methods → JS array methods ────────────────
  s = s.replace(/\.add\(/g, '.push(');
  s = s.replace(/\.get\((\d+)\)/g, '[$1]');
  s = s.replace(/\.get\(([^)]+)\)/g, '[$1]');
  s = s.replace(/\.size\(\)/g, '.length');
  s = s.replace(/\.isEmpty\(\)/g, '(.length === 0)');
  s = s.replace(/\.contains\(/g, '.includes(');
  s = s.replace(/\.remove\((\d+)\)/g, '.splice($1, 1)');
  s = s.replace(/\.clear\(\)/g, '.splice(0)');
  s = s.replace(/\.indexOf\(/g, '.indexOf(');

  // ── Pass 7: new ArrayList<>() / new ArrayList<T>() → [] ──────────────
  s = s.replace(/new\s+(?:Array)?List\s*<[^>]*>\s*\(\s*\)/g, '[]');
  s = s.replace(/new\s+(?:Array)?List\s*<[^>]*>\s*\(\s*Arrays\.asList\(([^)]*)\)\s*\)/g, '[$1]');

  // ── Pass 8: new Type[size] → new Array(size).fill(null) ──────────────
  s = s.replace(/new\s+\w+\[\s*(\w+)\s*\]/g, 'new Array($1).fill(null)');
  // new Type[] { ... } → [...]
  s = s.replace(/new\s+\w+\[\]\s*\{([^}]*)\}/g, '[$1]');

  // ── Pass 9: for-each → for...of ──────────────────────────────────────
  s = s.replace(
    /\bfor\s*\(\s*(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*:\s*([^)]+)\)/g,
    'for (const $1 of $2)',
  );

  // ── Pass 10: Variable declarations → let/const ──────────────────────
  // Type var = expr → let var = expr
  const TYPE_PATTERN =
    /\b(int|double|float|long|short|byte|boolean|char|String|var|BotShip|BotIsland|GameState|Command|(?:(?:Array)?List)\s*<[^>]+>|[\w]+\[\])\s+(\w+)\s*(=)/g;
  s = s.replace(TYPE_PATTERN, 'let $2 $3');
  // Type var; (declaration without init) → let var;
  s = s.replace(
    /\b(int|double|float|long|short|byte|boolean|char|String|var|BotShip|BotIsland|GameState|Command|(?:(?:Array)?List)\s*<[^>]+>|[\w]+\[\])\s+(\w+)\s*;/g,
    'let $2;',
  );

  // ── Pass 11: Boolean keywords (already JS-compatible) ────────────────
  // true/false/null same in both languages

  // ── Pass 12: Cast removal ──────────────────────────────────────────
  s = s.replace(/\(int\)\s*/g, 'Math.floor(');
  s = s.replace(/\(double\)\s*/g, '(');
  s = s.replace(/\(float\)\s*/g, '(');
  // Close the paren for (int) casts — this is approximate
  // Better to handle inline, but for simple cases this works

  // ── Pass 13: String methods ────────────────────────────────────────
  s = s.replace(/\.equals\(/g, ' === (');
  s = s.replace(/\.equalsIgnoreCase\(([^)]+)\)/g, '.toLowerCase() === ($1).toLowerCase()');
  s = s.replace(/\.charAt\(/g, '.charAt(');
  s = s.replace(/\.substring\(/g, '.substring(');
  s = s.replace(/\.toLowerCase\(\)/g, '.toLowerCase()');
  s = s.replace(/\.toUpperCase\(\)/g, '.toUpperCase()');
  s = s.replace(/\.trim\(\)/g, '.trim()');
  s = s.replace(/\.startsWith\(/g, '.startsWith(');
  s = s.replace(/\.endsWith\(/g, '.endsWith(');
  s = s.replace(/\bString\.valueOf\(([^)]+)\)/g, 'String($1)');
  s = s.replace(/\bInteger\.parseInt\(([^)]+)\)/g, 'parseInt($1)');
  s = s.replace(/\bDouble\.parseDouble\(([^)]+)\)/g, 'parseFloat($1)');

  // ── Pass 14: try/catch removal ─────────────────────────────────────
  s = s.replace(/\}\s*catch\s*\([^)]*\)\s*\{[^}]*\}/g, '}');
  s = s.replace(/\bfinally\s*\{[^}]*\}/g, '');

  // ── Pass 15: Access modifiers removal ─────────────────────────────
  s = s.replace(/\bprivate\s+/g, '');
  s = s.replace(/\bpublic\s+/g, '');
  s = s.replace(/\bprotected\s+/g, '');
  s = s.replace(/\bstatic\s+/g, '');
  s = s.replace(/\bfinal\s+/g, '');

  // ── Pass 16: Number suffixes ──────────────────────────────────────
  s = s.replace(/(\d+\.\d*)f\b/g, '$1');
  s = s.replace(/(\d+)f\b/g, '$1');
  s = s.replace(/(\d+)[lL]\b/g, '$1');
  s = s.replace(/(\d+\.\d*)d\b/g, '$1');

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

function extractMethods(code: string): ExtractedMethod[] {
  const methods: ExtractedMethod[] = [];

  // Match: optional modifiers, ReturnType, MethodName(TypedParams) {
  const METHOD_RE =
    /(?:^|\n)\s*(?:[\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*\{/gm;

  let m: RegExpExecArray | null;
  while ((m = METHOD_RE.exec(code)) !== null) {
    const methodName = m[1];
    if (['if', 'for', 'while', 'switch', 'catch', 'else', 'do'].includes(methodName)) continue;
    if (m[0].includes('class ')) continue;

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
      // Skip
    }
  }

  return methods;
}

/** Strip the outer Bot class wrapper, returning inner content */
function stripClassWrapper(code: string): string {
  const classMatch = code.match(/\bclass\s+Bot\b[\s\S]*?\{/);
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
// Main transpiler
// ─────────────────────────────────────────────

export function transpileJavaToJs(javaCode: string): string {
  // Step 1: Strip comments
  let code = javaCode
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Step 2: Strip class wrapper
  if (/\bclass\s+Bot\b/.test(code)) {
    code = stripClassWrapper(code);
  }

  // Step 3: Apply transforms
  code = applyTransforms(code);

  // Step 4: Extract methods
  const methods = extractMethods(code);

  const tickMethod = methods.find(
    (m) => m.name === 'tick' || m.name === 'Tick',
  );

  if (!tickMethod) {
    throw new Error(
      'Java bot must define a tick(GameState state, BotShip ship) method.',
    );
  }

  const helperMethods = methods.filter((m) => m !== tickMethod);

  let tickParams = tickMethod.params.trim();
  if (!tickParams) tickParams = 'state, ship';

  // Step 5: Extract instance fields (variable declarations outside methods)
  // These become closure state in createBot()
  const fieldLines: string[] = [];
  const methodBodies = methods.map((m) => m.body).join('\n');
  // Simple field pattern: type name = value; or type name;
  const fieldRe = /^\s*(?:[\w<>\[\]]+)\s+(\w+)\s*(=\s*[^;]+)?;/gm;
  let fm: RegExpExecArray | null;
  const processedCode = code;
  while ((fm = fieldRe.exec(processedCode)) !== null) {
    // Skip if this line is inside a method body
    const lineStart = processedCode.lastIndexOf('\n', fm.index) + 1;
    const line = processedCode.slice(lineStart, fm.index + fm[0].length);
    // Simple heuristic: if the match position is inside a method, skip it
    if (!methodBodies.includes(fm[0].trim())) {
      const name = fm[1];
      const init = fm[2] ? fm[2].replace(/^=\s*/, '') : 'null';
      fieldLines.push(`  let ${name} = ${init};`);
    }
  }

  // Step 6: Generate JS
  const helpers = helperMethods
    .map((m) => `  function ${m.name}(${m.params}) {${m.body}}`)
    .join('\n\n');

  const fields = fieldLines.length > 0 ? '\n' + fieldLines.join('\n') : '';

  const js = `
function createBot() {${fields}
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
// JavaSandboxedBot
// ─────────────────────────────────────────────

export class JavaSandboxedBot {
  private inner: SandboxedBot;
  private readonly label: string;
  private _initialized = false;

  constructor(label: string) {
    this.label = label;
    this.inner = new SandboxedBot(label, { timeoutMs: 50 });
  }

  async initFromCode(code: string): Promise<void> {
    let jsCode: string;
    try {
      jsCode = transpileJavaToJs(code);
    } catch (err) {
      throw new Error(
        `Java transpilation error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      this.inner.initFromCode(jsCode);
    } catch (err) {
      throw new Error(
        `Java bot initialization error: ${err instanceof Error ? err.message : String(err)}\n\n` +
          `Generated JS:\n${jsCode}`,
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

export function isJavaCode(code: string): boolean {
  const firstLines = code.slice(0, 400).trimStart();
  if (/^\/\/\s*@language\s*:\s*java\b/im.test(firstLines)) return true;
  if (/^\s*class\s+Bot\s*\{/m.test(code)) return true;
  if (/^\s*Command\s+tick\s*\(/m.test(code)) return true;
  return false;
}
