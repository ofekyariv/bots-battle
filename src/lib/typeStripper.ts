// ============================================================
// 🏴‍☠️ TypeScript Type Stripper
// ============================================================
// Simple regex-based transformer that strips TypeScript-specific
// syntax so bot code can be eval'd as plain JavaScript.
//
// Handles patterns commonly used in bot code:
//   1. @language: typescript marker comment (removed)
//   2. interface declarations (removed entirely)
//   3. type alias declarations (removed entirely)
//   4. Function parameter type annotations → stripped
//      e.g., (state: GameState, ship: BotShip) → (state, ship)
//   5. Return type annotations → stripped
//      e.g., ): Command { → ) {
//   6. Variable type annotations → stripped
//      e.g., const x: BotIsland | null = ... → const x = ...
//   7. as-type assertions → stripped
//      e.g., x as BotIsland → x
//   8. Non-null assertions → stripped
//      e.g., ship!.x → ship.x
//   9. Generic type params on function declarations → stripped
//      e.g., function foo<T>( → function foo(
//
// Safety strategy:
//   Type annotations are only stripped when the type name STARTS with
//   an uppercase letter (TypeScript PascalCase convention for types)
//   OR is a primitive type keyword (string, number, boolean, void, etc.).
//   This prevents accidental stripping of JavaScript object property
//   values like { id: 1, type: 'move', owner: 'me' }.
//
// For complex TypeScript, use Monaco's TS worker which provides a
// full compiler. This stripper is the lightweight runtime fallback.
// ============================================================

// ── Type-name pattern (conservative: PascalCase or primitive keywords) ──────
// Matches:
//   - PascalCase names: GameState, BotShip, Command, Array<BotShip>
//   - With optional generics: BotShip[], Command | null
//   - Primitive keywords: string, number, boolean, void, any, null, undefined, etc.
const PRIM = 'string|number|boolean|void|any|never|unknown|null|undefined';
// Single type segment: PascalCase with optional generics and array suffix
const SEG = `(?:[A-Z]\\w*(?:<[^>()]*>)?(?:\\[\\])*)`;
// Union/intersection type (simplified – handles A | B | null)
const TYPE_RE = `(?:${SEG}(?:\\s*[|&]\\s*(?:${SEG}|${PRIM}))*|${PRIM}(?:\\s*[|&]\\s*(?:${SEG}|${PRIM}))*)`;

/**
 * Returns true if the code string is TypeScript.
 * Checks for the `// @language: typescript` marker at the top.
 */
export function isTypeScriptCode(code: string): boolean {
  return /^\/\/\s*@language\s*:\s*typescript/im.test(code.slice(0, 500).trimStart());
}

/**
 * Strips TypeScript type annotations from bot code.
 * Returns plain JavaScript safe for eval() / new Function().
 */
export function stripTypeScript(tsCode: string): string {
  let code = tsCode;

  // 1. Remove @language marker comment
  code = code.replace(/^\/\/\s*@language\s*:\s*typescript[ \t]*\r?\n?/im, '');

  // 2. Remove interface declarations (multi-line, balanced braces)
  code = removeBalancedBlocks(
    code,
    /(?:export\s+)?interface\s+\w+(?:<[^{]*>)?(?:\s+extends\s+[^{]+)?/,
  );

  // 3. Remove type aliases with object bodies: type Foo = { ... }
  code = removeBalancedBlocks(code, /(?:export\s+)?type\s+\w+(?:<[^{=]*>)?\s*=/);

  // 4. Remove simple one-line type aliases: type Foo = string | number;
  code = code.replace(/^[ \t]*(?:export\s+)?type\s+\w+(?:<[^>]*>)?\s*=[^;{]*;[ \t]*\r?\n?/gm, '');

  // 5. Remove generic type parameters from function declarations
  //    e.g., function createBot<T extends Foo>( → function createBot(
  code = code.replace(/\b(function\s+\w+)\s*<[^>()]+>/g, '$1');

  // 6. Remove return type annotations after closing paren
  //    e.g., ): Command { → ) {    e.g., ): Command | null => → ) =>
  const retTypeRe = new RegExp(`\\)\\s*:\\s*${TYPE_RE}\\s*(?=\\{|=>)`, 'g');
  code = code.replace(retTypeRe, ') ');

  // 7. Remove parameter type annotations
  //    e.g., (state: GameState, ship: BotShip) → (state, ship)
  //    Only strips if the type starts with uppercase or is a primitive keyword
  //    Stops at , or ) to avoid consuming too much
  const paramTypeRe = new RegExp(`(\\w+)\\s*:\\s*${TYPE_RE}(?=[,)])`, 'g');
  // Run twice to handle adjacent type params in same param list
  code = code.replace(paramTypeRe, '$1');
  code = code.replace(paramTypeRe, '$1');

  // 8. Remove variable/const/let type annotations
  //    e.g., const x: BotIsland | null = ... → const x = ...
  const varTypeRe = new RegExp(`\\b(const|let|var)\\s+(\\w+)\\s*:\\s*${TYPE_RE}\\s*=`, 'g');
  code = code.replace(varTypeRe, '$1 $2 =');

  // 9. Remove 'as' type assertions
  //    e.g., x as BotIsland → x  (only PascalCase types to stay safe)
  code = code.replace(new RegExp(`\\s+as\\s+${TYPE_RE}`, 'g'), '');

  // 10. Remove non-null assertions: ship!.x → ship.x, foo()! → foo()
  code = code.replace(/(\w|\))!/g, '$1');

  return code;
}

// ─────────────────────────────────────────────
// Internal: balanced-brace block removal
// ─────────────────────────────────────────────

/**
 * Scans the code for declarations matching `keyword` followed by `{`,
 * then removes everything from the keyword start to the matching `}`.
 *
 * The `pattern` RegExp should match the declaration header (without the `{`).
 * It will be anchored to the start of a line (after optional indentation).
 */
function removeBalancedBlocks(code: string, pattern: RegExp): string {
  // Build a line-start-anchored pattern that expects { to follow on the same line
  const linePattern = new RegExp(`^[ \\t]*${pattern.source}\\s*\\{`, 'm');

  let result = '';
  let remaining = code;

  for (let safety = 0; safety < 200; safety++) {
    const match = linePattern.exec(remaining);
    if (!match) {
      result += remaining;
      break;
    }

    // Append everything before this declaration
    result += remaining.slice(0, match.index);
    remaining = remaining.slice(match.index);

    // Walk forward counting braces to find the matching }
    let depth = 0;
    let end = -1;
    for (let i = 0; i < remaining.length; i++) {
      const ch = remaining[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          // Consume the trailing newline too
          if (remaining[end] === '\r') end++;
          if (remaining[end] === '\n') end++;
          break;
        }
      }
    }

    if (end === -1) {
      // Unbalanced braces — give up, keep the rest
      result += remaining;
      break;
    }

    remaining = remaining.slice(end);
  }

  return result;
}
