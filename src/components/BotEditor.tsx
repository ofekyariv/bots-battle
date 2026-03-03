// ============================================================
// 🏴‍☠️ BotEditor — Monaco Editor wrapper for writing bot code
// ============================================================
// Features:
//  • TypeScript/JavaScript mode with full bot API autocomplete
//  • Dark theme (vs-dark)
//  • Injected type definitions for GameState, BotShip, BotIsland,
//    Command, GameConfig, and all helper functions
//  • Error highlighting via Monaco's built-in TS/JS language service
//  • Line numbers
//  • 'Save' button with name prompt
// ============================================================

'use client';

import Editor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useRef, useState, useEffect } from 'react';
import { saveBot } from '@/lib/storage';
import { isPythonCode } from '@/lib/pythonSandbox';
import { isKotlinCode } from '@/lib/kotlinSandbox';
import { isCSharpCode } from '@/lib/csharpSandbox';
import { isJavaCode } from '@/lib/javaSandbox';
import { isSwiftCode } from '@/lib/swiftSandbox';
import { isTypeScriptCode } from '@/lib/typeStripper';
import {
  STARTER_BOT_CODE,
  STARTER_BOT_CODE_TS,
  STARTER_BOT_CODE_PYTHON,
  STARTER_BOT_CODE_KOTLIN,
  STARTER_BOT_CODE_CSHARP,
  STARTER_BOT_CODE_JAVA,
  STARTER_BOT_CODE_SWIFT,
} from '@/lib/constants/starter-codes';

// Re-export so existing imports from @/components/BotEditor continue to work
export { STARTER_BOT_CODE, STARTER_BOT_CODE_TS, STARTER_BOT_CODE_PYTHON, STARTER_BOT_CODE_KOTLIN, STARTER_BOT_CODE_CSHARP, STARTER_BOT_CODE_JAVA, STARTER_BOT_CODE_SWIFT };

// ─────────────────────────────────────────────
// Bot API type definitions injected into Monaco
// ─────────────────────────────────────────────

const BOT_TYPE_DEFS = `
/**
 * Configuration for the current game session.
 * Passed as state.config inside tick().
 */
interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  /** Units per tick */
  shipSpeed: number;
  /** Per-ship combat evaluation radius */
  attackRadius: number;
  /** Island capture proximity radius */
  captureRadius: number;
  /** Ticks to fully capture a neutral island */
  captureTurns: number;
  /** Ticks before a dead ship respawns */
  respawnDelay: number;
  /** Total ticks for the game (1800 = 3 min @ 10 tps) */
  gameDuration: number;
  /** Score needed to win immediately */
  targetScore: number;
  /** Ships per player */
  shipsPerPlayer: number;
  /** Width of each player's safe spawn zone */
  safeZoneWidth: number;
  numIslands: number;
  /** Milliseconds between ticks */
  tickRateMs: number;
}

/** Island owner from your bot's perspective */
type BotOwner = 'me' | 'enemy' | 'neutral';

/** Which team is advancing the capture timer */
type BotTeamCapturing = 'me' | 'enemy' | 'none';

/**
 * A ship as seen by your bot.
 * You receive myShips[] and enemyShips[] in GameState.
 */
interface BotShip {
  id: number;
  x: number;
  y: number;
  /** false while waiting to respawn */
  alive: boolean;
  /**
   * true if this ship is inside an island's capture radius.
   * Tracking flag only — ship still participates in combat normally.
   */
  isCapturing: boolean;
  /** 0 when alive; ticks remaining until respawn */
  turnsToRevive: number;
  /** Fixed respawn X (inside your safe zone) */
  initialX: number;
  /** Fixed respawn Y (inside your safe zone) */
  initialY: number;
}

/**
 * An island as seen by your bot.
 */
interface BotIsland {
  id: number;
  x: number;
  y: number;
  /** Ships must stay within this radius to capture */
  radius: number;
  owner: BotOwner;
  /** Who is advancing the capture timer right now */
  teamCapturing: BotTeamCapturing;
  /** Current capture progress in ticks */
  captureProgress: number;
  /** Ticks required to capture (neutral → mine) */
  captureTurns: number;
  /** Scoring weight: 1 = normal, 2+ = treasure */
  value: number;
}

/**
 * The command your tick() returns for a single ship.
 * - { type: 'move', target: { x, y } } — move toward a point
 * - { type: 'idle' }                   — stay put
 */
interface Command {
  type: 'move' | 'idle';
  /** Required when type === 'move' */
  target?: { x: number; y: number };
}

/**
 * Full game snapshot delivered to your tick() on every call.
 * All owners are translated to 'me' / 'enemy' from your perspective.
 */
interface GameState {
  /** Current tick number (0-based) */
  tick: number;
  /** Total ticks in the game */
  maxTicks: number;
  mapWidth: number;
  mapHeight: number;
  /** All islands on the map */
  islands: BotIsland[];
  /** Your ships */
  myShips: BotShip[];
  /** Opponent's ships */
  enemyShips: BotShip[];
  myScore: number;
  enemyScore: number;
  /** Score needed to win immediately */
  targetScore: number;
  config: GameConfig;
}

// ─── Helper functions available globally in your bot ─────────────────────────

/**
 * Euclidean distance between two {x,y} points.
 * @example distanceTo(ship, island)  // → 142.8
 */
declare function distanceTo(a: { x: number; y: number }, b: { x: number; y: number }): number;

/**
 * Squared Euclidean distance — faster when you only need to compare distances.
 * Avoids the sqrt call.
 */
declare function distanceToSq(a: { x: number; y: number }, b: { x: number; y: number }): number;

/**
 * Angle in radians from \`from\` to \`to\`.
 * 0 = right, π/2 = down, −π/2 = up, π = left.
 * @example
 * const angle = angleTo(ship, target);
 * const vx = Math.cos(angle) * speed;
 */
declare function angleTo(from: { x: number; y: number }, to: { x: number; y: number }): number;

/**
 * Returns the nearest island to \`ship\`, or null if none.
 * @example
 * const target = nearestIsland(ship, state.islands);
 * if (target) return { type: 'move', target };
 */
declare function nearestIsland(ship: { x: number; y: number }, islands: BotIsland[]): BotIsland | null;

/**
 * Filter islands by owner: 'me' | 'enemy' | 'neutral'
 * @example
 * const mine = islandsOwnedBy(state.islands, 'me');
 * const neutral = islandsOwnedBy(state.islands, 'neutral');
 */
declare function islandsOwnedBy(islands: BotIsland[], owner: BotOwner): BotIsland[];

/**
 * Islands NOT owned by you (enemy + neutral).
 * Useful for "capture nearest uncaptured island" strategies.
 */
declare function islandsNotMine(islands: BotIsland[]): BotIsland[];

/**
 * Nearest island matching a specific owner, or null.
 */
declare function nearestIslandOwnedBy(
  ship: { x: number; y: number },
  islands: BotIsland[],
  owner: BotOwner
): BotIsland | null;

/**
 * Nearest ALIVE enemy ship, or null if all enemies are dead.
 * @example
 * const threat = nearestEnemy(ship, state.enemyShips);
 * if (threat && distanceTo(ship, threat) < 200) { ... }
 */
declare function nearestEnemy(ship: { x: number; y: number }, enemies: BotShip[]): BotShip | null;

/**
 * All ALIVE ships within \`radius\` of \`point\`.
 * Works for both myShips and enemyShips.
 * @example
 * const nearby = shipsNear(island, state.enemyShips, island.radius);
 */
declare function shipsNear(point: { x: number; y: number }, ships: BotShip[], radius: number): BotShip[];

/**
 * Alive ships sorted by distance from \`point\` (nearest first).
 */
declare function shipsSortedByDistance(point: { x: number; y: number }, ships: BotShip[]): BotShip[];

/**
 * Alive ships that are NOT currently capturing an island.
 * These ships are free to fight or move.
 */
declare function freeShips(ships: BotShip[]): BotShip[];

/**
 * Predicts whether moving to \`position\` would get a ship killed.
 * Uses the per-ship radius evaluation:
 *   enemiesInRadius > friendliesInRadius → destroyed
 */
declare function wouldDieAt(
  position: { x: number; y: number },
  myShips: BotShip[],
  enemyShips: BotShip[],
  attackRadius: number
): boolean;

/**
 * Number of alive ships in \`ships\`.
 * @param excludeCapturing  if true, also excludes capturing ships
 */
declare function aliveCount(ships: BotShip[], excludeCapturing?: boolean): number;

/**
 * Points per tick for the given total island value held.
 * Formula: 2^(totalValue - 1). Returns 0 if totalValue ≤ 0.
 * @example
 * const myIslands = islandsOwnedBy(state.islands, 'me');
 * const totalValue = myIslands.reduce((s, i) => s + i.value, 0);
 * const pts = scoreRate(totalValue);  // → 4 if holding 3 islands
 */
declare function scoreRate(totalValue: number): number;

/** Shorthand for { type: 'idle' }. */
declare function idle(): Command;

/** Shorthand for { type: 'move', target: { x, y } }. */
declare function move(x: number, y: number): Command;
`;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface BotEditorProps {
  /** Current code value */
  value?: string;
  /** Called whenever the code changes */
  onChange?: (code: string) => void;
  /** Called when Save is pressed — receives (name, code). If omitted, uses internal save dialog. */
  onSave?: (name: string, code: string) => void;
  /** Called when Run Test is pressed */
  onRunTest?: (code: string) => void;
  /** Height of the editor area (default: "500px") */
  height?: string;
}

export default function BotEditor({
  value = STARTER_BOT_CODE,
  onChange,
  onSave,
  onRunTest,
  height = '500px',
}: BotEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<BeforeMount>[0] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  // ── Language state ─────────────────────────────────────────────────
  // Auto-detect from value; user can also toggle manually.
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python' | 'kotlin' | 'csharp' | 'java' | 'swift'>(
    () => {
      if (isKotlinCode(value)) return 'kotlin';
      if (isPythonCode(value)) return 'python';
      if (isCSharpCode(value)) return 'csharp';
      if (isJavaCode(value)) return 'java';
      if (isSwiftCode(value)) return 'swift';
      if (isTypeScriptCode(value)) return 'typescript';
      return 'javascript';
    },
  );

  // Re-detect language when value changes externally (e.g. loading a saved bot).
  useEffect(() => {
    if (isKotlinCode(value)) setLanguage('kotlin');
    else if (isPythonCode(value)) setLanguage('python');
    else if (isCSharpCode(value)) setLanguage('csharp');
    else if (isJavaCode(value)) setLanguage('java');
    else if (isSwiftCode(value)) setLanguage('swift');
    else if (isTypeScriptCode(value)) setLanguage('typescript');
    else setLanguage('javascript');
  }, [value]);

  // ── Inject bot API types before the editor mounts ──────────────────
  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;

    // ── JavaScript defaults (checkJs enables type inference in .js files) ──
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      checkJs: true,
      strict: false,
      noImplicitAny: false,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // ── TypeScript defaults — full type checking + inline errors ──────
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      strict: false,
      noImplicitAny: false,
      // Allow module-less code (bots are plain scripts, not modules)
      module: monaco.languages.typescript.ModuleKind.None,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // ── Inject bot API type definitions into BOTH language services ───
    // This gives autocomplete + type checking for GameState, BotShip, etc.
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      BOT_TYPE_DEFS,
      'file:///bot-api.d.ts',
    );
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      BOT_TYPE_DEFS,
      'file:///bot-api.d.ts',
    );
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Auto-focus the editor on mount
    editor.focus();
  };

  // ── Language toggle ─────────────────────────────────────────────────
  const switchToLanguage = (newLang: 'javascript' | 'typescript' | 'python' | 'kotlin' | 'csharp' | 'java' | 'swift') => {
    const currentCode = editorRef.current?.getValue() ?? value;
    const isDefault =
      currentCode.trim() === '' ||
      currentCode.trim() === STARTER_BOT_CODE.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_TS.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_PYTHON.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_KOTLIN.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_CSHARP.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_JAVA.trim() ||
      currentCode.trim() === STARTER_BOT_CODE_SWIFT.trim();

    // Monaco language id for the model
    const monacoLang =
      newLang === 'typescript'
        ? 'typescript'
        : newLang === 'python'
          ? 'python'
          : newLang === 'kotlin'
            ? 'kotlin'
            : newLang === 'csharp'
              ? 'csharp'
              : newLang === 'java'
                ? 'java'
                : newLang === 'swift'
                  ? 'swift'
                  : 'javascript';

    if (isDefault) {
      // Swap to the new language's starter template
      const newTemplate =
        newLang === 'kotlin'
          ? STARTER_BOT_CODE_KOTLIN
          : newLang === 'csharp'
            ? STARTER_BOT_CODE_CSHARP
            : newLang === 'python'
              ? STARTER_BOT_CODE_PYTHON
              : newLang === 'java'
                ? STARTER_BOT_CODE_JAVA
                : newLang === 'swift'
                  ? STARTER_BOT_CODE_SWIFT
                  : newLang === 'typescript'
                    ? STARTER_BOT_CODE_TS
                    : STARTER_BOT_CODE;

      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          monacoRef.current.editor.setModelLanguage(model, monacoLang);
        }
        editorRef.current.setValue(newTemplate);
      }
      onChange?.(newTemplate);
    } else {
      // User has real code — just switch syntax highlighting / language service
      if (editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel();
        if (model) {
          monacoRef.current.editor.setModelLanguage(model, monacoLang);
        }
      }
    }
    setLanguage(newLang);
  };

  const handleLanguageToggle = (target: 'javascript' | 'typescript' | 'python' | 'kotlin' | 'csharp' | 'java' | 'swift') => {
    if (target !== language) switchToLanguage(target);
  };

  // ── Save handler ────────────────────────────────────────────────────
  const handleSave = async () => {
    const code = editorRef.current?.getValue() ?? value;

    if (onSave) {
      // Parent handles naming / UI
      const name = prompt('Bot name:', 'My Bot');
      if (!name?.trim()) return;
      onSave(name.trim(), code);
      return;
    }

    // Built-in save dialog
    const name = prompt('Save bot as:', 'My Bot');
    if (!name?.trim()) return;

    setSaving(true);
    try {
      saveBot(name.trim(), code, undefined, language);
      setSaveMsg(`✅ Saved "${name.trim()}"`);
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg(`❌ Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setSaveMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // ── Run Test handler ────────────────────────────────────────────────
  const handleRunTest = () => {
    const code = editorRef.current?.getValue() ?? value;
    if (onRunTest) {
      onRunTest(code);
    } else {
      // Placeholder: log to console until game engine integration is wired
      console.log('[BotEditor] Run Test triggered — engine integration pending');
      alert('Run Test coming soon! Your bot code will be tested against a quick simulation.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {/* Language toggle: JavaScript | TypeScript | Python | Kotlin | Java | C# | Swift */}
          <div className="flex flex-wrap items-center gap-0 rounded overflow-hidden border border-zinc-700">
            <button
              onClick={() => handleLanguageToggle('javascript')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'javascript'
                  ? 'bg-yellow-600/30 text-yellow-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to JavaScript"
            >
              JavaScript
            </button>
            <button
              onClick={() => handleLanguageToggle('typescript')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'typescript'
                  ? 'bg-blue-500/30 text-blue-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to TypeScript — full type annotations, inline type errors"
            >
              TypeScript
            </button>
            <button
              onClick={() => handleLanguageToggle('python')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'python'
                  ? 'bg-green-600/30 text-green-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to Python 3 (via Brython)"
            >
              Python
            </button>
            <button
              onClick={() => handleLanguageToggle('kotlin')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'kotlin'
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to Kotlin (compiled via JetBrains API)"
            >
              Kotlin
            </button>
            <button
              onClick={() => handleLanguageToggle('java')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'java'
                  ? 'bg-orange-500/30 text-orange-400'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to Java (transpiled to JavaScript locally — no runtime required)"
            >
              Java
            </button>
            <button
              onClick={() => handleLanguageToggle('csharp')}
              className={`px-2 py-1 text-xs font-mono transition-colors border-r border-zinc-700 ${
                language === 'csharp'
                  ? 'bg-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to C# (transpiled to JavaScript — no runtime required)"
            >
              C#
            </button>
            <button
              onClick={() => handleLanguageToggle('swift')}
              className={`px-2 py-1 text-xs font-mono transition-colors ${
                language === 'swift'
                  ? 'bg-rose-500/30 text-rose-400'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
              title="Switch to Swift (compiled via Godbolt API)"
            >
              Swift
            </button>
          </div>
          <span className="text-zinc-600 hidden sm:inline">·</span>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {language === 'javascript' && 'Bot API autocomplete enabled'}
            {language === 'typescript' && 'TypeScript · full types + inline errors'}
            {language === 'python' && 'Python 3 via Brython'}
            {language === 'kotlin' && 'Kotlin · compiled via JetBrains API'}
            {language === 'java' && 'Java · transpiled to JavaScript locally'}
            {language === 'csharp' && 'C# · transpiled to JavaScript (no runtime required)'}
            {language === 'swift' && 'Swift · compiled via Godbolt API'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-xs text-zinc-300 animate-pulse">{saveMsg}</span>}
          <button
            onClick={handleRunTest}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold
              bg-emerald-700 hover:bg-emerald-600 text-white
              transition-colors duration-150
              border border-emerald-500/30
            "
            title="Run a quick simulation to test your bot (coming soon)"
          >
            ▶ Run Test
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold
              bg-amber-700 hover:bg-amber-600 text-white
              transition-colors duration-150
              border border-amber-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            title="Save this bot to local storage"
          >
            {saving ? 'Saving…' : '💾 Save'}
          </button>
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────────────── */}
      <div
        className="rounded-lg overflow-hidden pirate-border border border-zinc-700"
        style={{ height }}
      >
        <Editor
          height="100%"
          defaultLanguage={language}
          language={language}
          value={value}
          theme="vs-dark"
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={(v) => onChange?.(v ?? '')}
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
            // Error squiggles & code actions
            renderValidationDecorations: 'on',
            // UX quality-of-life
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            parameterHints: { enabled: true },
            folding: true,
            formatOnPaste: true,
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            // Brackets & pairs
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            matchBrackets: 'always',
          }}
        />
      </div>

      {/* ── Keyboard shortcut hint ──────────────────────────────────── */}
      <div className="flex items-center gap-4 px-1 text-xs text-zinc-600">
        <span>
          <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Ctrl</kbd>+
          <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Space</kbd> autocomplete
        </span>
        <span>
          <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Ctrl</kbd>+
          <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Shift</kbd>+
          <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">F</kbd> format
        </span>
        <span>Hover any function for docs</span>
      </div>
    </div>
  );
}
