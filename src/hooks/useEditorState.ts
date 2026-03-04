'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { OnMount, BeforeMount } from '@monaco-editor/react';
import { ROUTES } from '@/lib/routes';
import {
  listBots,
  getBot,
  saveBot as saveApiBot,
  deleteBot as deleteApiBot,
} from '@/lib/api/bots';
import type { BotMeta, BotWithCode } from '@/lib/api/bots';
import {
  getBotRecord,
  setLastEditedBotId,
  getLastEditedBotId,
} from '@/lib/storage';
import { useGameContext } from '@/lib/GameContext';
import {
  STARTER_BOT_CODE,
  STARTER_BOT_CODE_TS,
  STARTER_BOT_CODE_PYTHON,
  STARTER_BOT_CODE_KOTLIN,
  STARTER_BOT_CODE_CSHARP,
  STARTER_BOT_CODE_JAVA,
  STARTER_BOT_CODE_SWIFT,
} from '@/lib/constants/starter-codes';
import { getBotApiReferenceForLanguage } from '@/lib/constants/bot-api-reference';
import type { LanguageId } from '@/lib/languages/types';
import { isTypeScriptCode, stripTypeScript } from '@/lib/typeStripper';
import { isPythonCode, PythonSandboxedBot } from '@/lib/pythonSandbox';
import { isKotlinCode, KotlinSandboxedBot } from '@/lib/kotlinSandbox';
import { isCSharpCode, CSharpSandboxedBot } from '@/lib/csharpSandbox';
import { isJavaCode, JavaSandboxedBot } from '@/lib/javaSandbox';
import { isSwiftCode, SwiftSandboxedBot } from '@/lib/swiftSandbox';
import type { LogEntry, LogLevel, WinRecord, EditorLanguage, BotVersion } from '@/components/editor/types';

// ─────────────────────────────────────────────
// Log helpers
// ─────────────────────────────────────────────

let logIdCounter = 0;
export function makeLog(level: LogLevel, msg: string): LogEntry {
  return {
    id: ++logIdCounter,
    level,
    msg,
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
  };
}

// ─────────────────────────────────────────────
// LLM prompt builder
// ─────────────────────────────────────────────

const LLM_MECHANICS_SUMMARY = `
=== GAME MECHANICS SUMMARY ===

COMBAT: Per-ship radius evaluation. enemies > friendlies within attackRadius → ship dies.
1v1 = both survive (each counts itself as friendly). 2v1 = lone ship dies, pair survives. Ships near islands (isCapturing=true) still fight normally.

ISLAND CAPTURE: Stay within island.radius for captureTurns ticks. Enemy island = 2× ticks.
Both teams at island = timer paused. Leave radius = progress resets to 0.

SCORING (exponential): pointsPerTick = 2^(totalIslandValue-1). 3 islands = 4pt/tick, 5 = 16pt/tick.

SAFE ZONES: Each player's spawn zone on their side — enemy ships cannot enter. Ships respawn there.
`.trim();

function buildEditorLLMPrompt(code: string, language: EditorLanguage): string {
  const apiRef = getBotApiReferenceForLanguage(language as LanguageId);
  return [
    `You are helping improve a bot for Bots Battle, a competitive coding strategy game. The bot is written in ${language}. Here are the complete game rules and API, and my current code. Suggest improvements or write a new version.`,
    '',
    apiRef,
    '',
    LLM_MECHANICS_SUMMARY,
    '',
    `=== MY CURRENT BOT CODE (${language}) ===`,
    '',
    code,
    '',
    '=== END ===',
    '',
    `Please analyze my bot and suggest specific improvements or write an improved version as a tick() function in ${language}.`,
  ].join('\n');
}

// ─────────────────────────────────────────────
// Bot type defs for Monaco autocomplete
// ─────────────────────────────────────────────

export const BOT_TYPE_DEFS = `
interface GameConfig {
  mapWidth: number; mapHeight: number; shipSpeed: number;
  attackRadius: number; captureRadius: number; captureTurns: number;
  respawnDelay: number; gameDuration: number; targetScore: number;
  shipsPerPlayer: number; safeZoneWidth: number; numIslands: number; tickRateMs: number;
}
type BotOwner = 'me' | 'enemy' | 'neutral';
type BotTeamCapturing = 'me' | 'enemy' | 'none';
interface BotShip {
  id: number; x: number; y: number; alive: boolean;
  isCapturing: boolean; turnsToRevive: number; initialX: number; initialY: number;
}
interface BotIsland {
  id: number; x: number; y: number; radius: number;
  owner: BotOwner; teamCapturing: BotTeamCapturing;
  captureProgress: number; captureTurns: number; value: number;
}
interface Command { type: 'move' | 'idle'; target?: { x: number; y: number }; }
interface GameState {
  tick: number; maxTicks: number; mapWidth: number; mapHeight: number;
  islands: BotIsland[]; myShips: BotShip[]; enemyShips: BotShip[];
  myScore: number; enemyScore: number; targetScore: number; config: GameConfig;
}
declare function distanceTo(a: {x:number;y:number}, b: {x:number;y:number}): number;
declare function distanceToSq(a: {x:number;y:number}, b: {x:number;y:number}): number;
declare function angleTo(from: {x:number;y:number}, to: {x:number;y:number}): number;
declare function nearestIsland(ship: {x:number;y:number}, islands: BotIsland[]): BotIsland | null;
declare function islandsOwnedBy(islands: BotIsland[], owner: BotOwner): BotIsland[];
declare function islandsNotMine(islands: BotIsland[]): BotIsland[];
declare function nearestIslandOwnedBy(ship: {x:number;y:number}, islands: BotIsland[], owner: BotOwner): BotIsland | null;
declare function nearestEnemy(ship: {x:number;y:number}, enemies: BotShip[]): BotShip | null;
declare function shipsNear(point: {x:number;y:number}, ships: BotShip[], radius: number): BotShip[];
declare function shipsSortedByDistance(point: {x:number;y:number}, ships: BotShip[]): BotShip[];
declare function freeShips(ships: BotShip[]): BotShip[];
declare function wouldDieAt(pos: {x:number;y:number}, myShips: BotShip[], enemyShips: BotShip[], attackRadius: number): boolean;
declare function aliveCount(ships: BotShip[], excludeCapturing?: boolean): number;
declare function scoreRate(totalValue: number): number;
declare function idle(): Command;
declare function move(x: number, y: number): Command;
`;

// ─────────────────────────────────────────────
// Bot validator
// ─────────────────────────────────────────────

function validateBot(code: string): { ok: boolean; logs: LogEntry[]; isPython?: boolean; isKotlin?: boolean; isCSharp?: boolean; isJava?: boolean; isSwift?: boolean } {
  const logs: LogEntry[] = [];

  if (isPythonCode(code)) {
    logs.push(makeLog('info', '🐍 Python detected — use Run Test to validate via Brython'));
    return { ok: true, logs, isPython: true };
  }
  if (isKotlinCode(code)) {
    logs.push(makeLog('info', '🟣 Kotlin detected — use Run Test for async compilation check'));
    return { ok: true, logs, isKotlin: true };
  }
  if (isCSharpCode(code)) {
    logs.push(makeLog('info', '🔷 C# detected — use Run Test to validate transpilation'));
    return { ok: true, logs, isCSharp: true };
  }
  if (isJavaCode(code)) {
    logs.push(makeLog('info', '☕ Java detected — use Run Test to validate transpilation'));
    return { ok: true, logs, isJava: true };
  }
  if (isSwiftCode(code)) {
    logs.push(makeLog('info', '🦅 Swift detected — use Run Test for async compilation check (compilation service)'));
    return { ok: true, logs, isSwift: true };
  }

  const isTS = isTypeScriptCode(code);
  const evalCode = isTS ? stripTypeScript(code) : code;
  if (isTS) {
    logs.push(makeLog('info', '🔷 TypeScript detected — stripping types for validation'));
  }

  try {
     
    new Function(evalCode);
  } catch (e) {
    logs.push(makeLog('error', `Syntax error: ${(e as Error).message}`));
    return { ok: false, logs };
  }
  logs.push(makeLog('success', '✓ Syntax OK'));

  try {
    const mockHelpers = {
      distanceTo: (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(b.x - a.x, b.y - a.y),
      distanceToSq: (a: { x: number; y: number }, b: { x: number; y: number }) =>
        (b.x - a.x) ** 2 + (b.y - a.y) ** 2,
      angleTo: (from: { x: number; y: number }, to: { x: number; y: number }) =>
        Math.atan2(to.y - from.y, to.x - from.x),
      nearestIsland: (ship: { x: number; y: number }, islands: { x: number; y: number }[]) => {
        let best: { x: number; y: number } | null = null,
          bestD = Infinity;
        for (const isl of islands) {
          const d = Math.hypot(isl.x - ship.x, isl.y - ship.y);
          if (d < bestD) {
            bestD = d;
            best = isl;
          }
        }
        return best;
      },
      islandsOwnedBy: (islands: { owner: string }[], owner: string) =>
        islands.filter((i) => i.owner === owner),
      islandsNotMine: (islands: { owner: string }[]) => islands.filter((i) => i.owner !== 'me'),
      nearestIslandOwnedBy: (
        ship: { x: number; y: number },
        islands: { x: number; y: number; owner: string }[],
        owner: string,
      ) => {
        const filtered = islands.filter((i) => i.owner === owner);
        let best: { x: number; y: number; owner: string } | null = null,
          bestD = Infinity;
        for (const isl of filtered) {
          const d = Math.hypot(isl.x - ship.x, isl.y - ship.y);
          if (d < bestD) {
            bestD = d;
            best = isl;
          }
        }
        return best;
      },
      nearestEnemy: (
        ship: { x: number; y: number },
        enemies: { x: number; y: number; alive: boolean }[],
      ) => {
        const alive = enemies.filter((e) => e.alive);
        let best: { x: number; y: number; alive: boolean } | null = null,
          bestD = Infinity;
        for (const e of alive) {
          const d = Math.hypot(e.x - ship.x, e.y - ship.y);
          if (d < bestD) {
            bestD = d;
            best = e;
          }
        }
        return best;
      },
      shipsNear: (
        point: { x: number; y: number },
        ships: { x: number; y: number; alive: boolean }[],
        radius: number,
      ) => ships.filter((s) => s.alive && Math.hypot(s.x - point.x, s.y - point.y) <= radius),
      shipsSortedByDistance: (
        point: { x: number; y: number },
        ships: { x: number; y: number; alive: boolean }[],
      ) =>
        [...ships].sort(
          (a, b) =>
            Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y),
        ),
      freeShips: (ships: { alive: boolean; isCapturing: boolean }[]) =>
        ships.filter((s) => s.alive && !s.isCapturing),
      wouldDieAt: () => false,
      aliveCount: (ships: { alive: boolean }[], excludeCapturing = false) =>
        ships.filter(
          (s) => s.alive && !(excludeCapturing && (s as { isCapturing?: boolean }).isCapturing),
        ).length,
      scoreRate: (v: number) => (v <= 0 ? 0 : Math.pow(2, v - 1)),
      idle: () => ({ type: 'idle' as const }),
      move: (x: number, y: number) => ({ type: 'move' as const, target: { x, y } }),
    };

    const mockState = {
      tick: 0,
      maxTicks: 1800,
      mapWidth: 1000,
      mapHeight: 1000,
      islands: [
        {
          id: 1,
          x: 500,
          y: 500,
          radius: 50,
          owner: 'neutral',
          teamCapturing: 'none',
          captureProgress: 0,
          captureTurns: 20,
          value: 1,
        },
      ],
      myShips: [
        {
          id: 0,
          x: 80,
          y: 500,
          alive: true,
          isCapturing: false,
          turnsToRevive: 0,
          initialX: 80,
          initialY: 500,
        },
      ],
      enemyShips: [
        {
          id: 5,
          x: 920,
          y: 500,
          alive: true,
          isCapturing: false,
          turnsToRevive: 0,
          initialX: 920,
          initialY: 500,
        },
      ],
      myScore: 0,
      enemyScore: 0,
      targetScore: 1000,
      config: {
        mapWidth: 1000,
        mapHeight: 1000,
        shipSpeed: 2,
        attackRadius: 30,
        captureRadius: 50,
        captureTurns: 20,
        respawnDelay: 30,
        gameDuration: 1800,
        targetScore: 1000,
        shipsPerPlayer: 5,
        safeZoneWidth: 80,
        numIslands: 7,
        tickRateMs: 100,
      },
    };

     
    const fn = new Function(
      ...Object.keys(mockHelpers),
      `${evalCode}\nif (typeof createBot === 'function') return { mode: 'factory', fn: createBot };\nif (typeof tick === 'function') return { mode: 'flat', fn: tick };\nthrow new Error('Bot must define either tick(state, ship) or createBot()');`,
    );
    const result = fn(...Object.values(mockHelpers));
    let bot: { tick: (s: unknown, sh: unknown) => unknown };
    if (result.mode === 'factory') {
      bot = result.fn();
      if (!bot || typeof bot.tick !== 'function')
        throw new Error('createBot() must return { tick(state, ship) }');
      logs.push(makeLog('success', '✓ createBot() found and valid'));
    } else {
      bot = { tick: result.fn };
      logs.push(makeLog('success', '✓ tick() found and valid'));
    }

    const ship = mockState.myShips[0];
    const cmd = bot.tick(mockState, ship) as { type?: string; target?: { x: number; y: number } } | null;
    if (!cmd || typeof cmd.type !== 'string')
      throw new Error("tick() must return a Command with a 'type' field");
    logs.push(
      makeLog(
        'success',
        `✓ tick() → { type: '${cmd.type}'${cmd.target ? ` target: (${cmd.target.x},${cmd.target.y})` : ''} }`,
      ),
    );

    for (let t = 0; t < 3; t++) {
      const r = bot.tick(mockState, ship) as { type?: string } | null;
      if (!r?.type) throw new Error('tick() returned invalid result');
    }
    logs.push(makeLog('success', '✓ Multi-tick test (3 ticks) passed'));
  } catch (e) {
    logs.push(makeLog('error', `Runtime error: ${(e as Error).message}`));
    return { ok: false, logs };
  }

  logs.push(makeLog('success', '🏴‍☠️ Bot validated! Ready for battle.'));
  return { ok: true, logs };
}

// ─────────────────────────────────────────────
// Detect language from code
// ─────────────────────────────────────────────

function detectLanguage(code: string, fallback?: EditorLanguage): EditorLanguage {
  if (isKotlinCode(code)) return 'kotlin';
  if (isPythonCode(code)) return 'python';
  if (isCSharpCode(code)) return 'csharp';
  if (isJavaCode(code)) return 'java';
  if (isSwiftCode(code)) return 'swift';
  if (isTypeScriptCode(code)) return 'typescript';
  return fallback ?? 'javascript';
}

// ─────────────────────────────────────────────
// The hook
// ─────────────────────────────────────────────

export function useEditorState() {
  const router = useRouter();
  const { updatePlayer1 } = useGameContext();
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';

  // Monaco refs
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<BeforeMount>[0] | null>(null);

  // Editor state
  const [code, setCode] = useState(STARTER_BOT_CODE);
  const [botName, setBotName] = useState('My Bot');
  const [currentBotId, setCurrentBotId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState<EditorLanguage>('javascript');

  // Bots list (from server)
  const [savedBots, setSavedBots] = useState<BotMeta[]>([]);
  const [showBotDropdown, setShowBotDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Versions (session-only, not persisted)
  const [versions, setVersions] = useState<BotVersion[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'docs' | 'history' | 'examples'>('docs');

  // Save status
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Console
  const [logs, setLogs] = useState<LogEntry[]>([
    makeLog('info', '🏴‍☠️ Welcome to the Bot Editor! Press ▶ Run Test to validate your code.'),
  ]);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);

  // LLM
  const [llmCopyStatus, setLlmCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [showPasteLLMModal, setShowPasteLLMModal] = useState(false);
  const [llmPastedCode, setLlmPastedCode] = useState('');

  // W/L record
  const [record, setRecord] = useState<WinRecord>({ wins: 0, losses: 0, draws: 0, total: 0 });

  // ── Internal helpers ────────────────────────────────────────────

  const addLog = useCallback((entry: LogEntry) => setLogs((prev) => [...prev, entry]), []);

  const refreshBots = useCallback(async () => {
    if (!isAuthenticated) {
      setSavedBots([]);
      return;
    }
    try {
      const bots = await listBots();
      setSavedBots(bots);
    } catch {
      setSavedBots([]);
    }
  }, [isAuthenticated]);

  const refreshRecord = useCallback((botId: string) => setRecord(getBotRecord(botId)), []);

  const setMonacoLanguage = useCallback((lang: EditorLanguage) => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const monacoLang =
          lang === 'typescript'
            ? 'typescript'
            : lang === 'python'
              ? 'python'
              : lang === 'kotlin'
                ? 'kotlin'
                : lang === 'csharp'
                  ? 'csharp'
                  : lang === 'java'
                    ? 'java'
                    : lang === 'swift'
                      ? 'swift'
                      : 'javascript';
        monacoRef.current.editor.setModelLanguage(model, monacoLang);
      }
    }
  }, []);

  // ── Load a bot into the editor ──────────────────────────────────

  const loadBotData = useCallback(
    (bot: BotWithCode) => {
      const lang = detectLanguage(bot.code, bot.language as EditorLanguage | undefined);
      setCode(bot.code);
      setBotName(bot.name);
      setCurrentBotId(bot.id);
      setVersions([]); // Version history not returned by server API
      setIsDirty(false);
      setEditorLanguage(lang);
      setLastEditedBotId(bot.id);
      suppressDirtyRef.current = true;
      editorRef.current?.setValue(bot.code);
      suppressDirtyRef.current = false;
      setMonacoLanguage(lang);
      refreshRecord(bot.id);
      addLog(
        makeLog(
          'info',
          `📂 Loaded bot: "${bot.name}" (${lang.toUpperCase()})`,
        ),
      );
    },
    [addLog, refreshRecord, setMonacoLanguage],
  );

  // ── On mount ────────────────────────────────────────────────────

  useEffect(() => {
    const loadInitial = async () => {
      // Fetch bot list
      if (isAuthenticated) {
        try {
          const bots = await listBots();
          setSavedBots(bots);
        } catch {
          setSavedBots([]);
        }
      }

      const params = new URLSearchParams(window.location.search);
      // ?new=1 → start fresh, don't load any bot
      if (params.get('new') === '1') return;

      const lastId = getLastEditedBotId();
      const loadId = params.get('load') ?? lastId;
      if (loadId && isAuthenticated) {
        try {
          const bot = await getBot(loadId);
          const lang = detectLanguage(bot.code, bot.language as EditorLanguage | undefined);
          setCode(bot.code);
          setBotName(bot.name);
          setCurrentBotId(bot.id);
          setVersions([]);
          setEditorLanguage(lang);
          refreshRecord(bot.id);
        } catch {
          // Bot not found or auth error — start fresh
        }
      }
    };
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Monaco handlers ─────────────────────────────────────────────

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;

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
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      strict: false,
      noImplicitAny: false,
      module: monaco.languages.typescript.ModuleKind.None,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      BOT_TYPE_DEFS,
      'file:///bot-api.d.ts',
    );
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      BOT_TYPE_DEFS,
      'file:///bot-api.d.ts',
    );
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const suppressDirtyRef = useRef(false);

  const handleCodeChange = useCallback((value: string | undefined) => {
    setCode(value ?? '');
    if (suppressDirtyRef.current) return;
    setIsDirty(true);
  }, []);

  // ── Save ────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (versionNote?: string) => {
      if (!isAuthenticated) {
        setSaveStatus({ ok: false, msg: 'Sign in to save bots' });
        setTimeout(() => setSaveStatus(null), 3000);
        return null;
      }
      const currentCode = editorRef.current?.getValue() ?? code;
      if (!botName.trim()) {
        setSaveStatus({ ok: false, msg: 'Bot name cannot be empty' });
        setTimeout(() => setSaveStatus(null), 3000);
        return null;
      }
      try {
        const saved = await saveApiBot({
          id: currentBotId ?? undefined,
          name: botName.trim(),
          language: editorLanguage as import('@/lib/api/bots').BotLanguage,
          code: currentCode,
        });
        setCurrentBotId(saved.id);
        setVersions([]);
        setIsDirty(false);
        setLastEditedBotId(saved.id);
        await refreshBots();
        refreshRecord(saved.id);
        setSaveStatus({ ok: true, msg: `✓ Saved "${saved.name}"` });
        setTimeout(() => setSaveStatus(null), 3000);
        void versionNote; // unused now; kept for API compat
        return saved;
      } catch (e) {
        setSaveStatus({ ok: false, msg: `✗ ${(e as Error).message}` });
        setTimeout(() => setSaveStatus(null), 4000);
        return null;
      }
    },
    [code, botName, currentBotId, editorLanguage, isAuthenticated, refreshBots, refreshRecord],
  );

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // ── New bot ─────────────────────────────────────────────────────

  const handleNew = useCallback(() => {
    if (isDirty && !confirm('Unsaved changes will be lost. Continue?')) return;
    setCode(STARTER_BOT_CODE);
    setBotName('My Bot');
    setCurrentBotId(null);
    setVersions([]);
    setIsDirty(false);
    setEditorLanguage('javascript');
    setRecord({ wins: 0, losses: 0, draws: 0, total: 0 });
    setLastEditedBotId(null);
    editorRef.current?.setValue(STARTER_BOT_CODE);
    setMonacoLanguage('javascript');
    addLog(makeLog('info', '📄 New bot from starter template'));
  }, [isDirty, addLog, setMonacoLanguage]);

  // ── Delete bot ──────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteApiBot(id);
      } catch (e) {
        setSaveStatus({ ok: false, msg: `✗ Delete failed: ${(e as Error).message}` });
        setTimeout(() => setSaveStatus(null), 4000);
        return;
      }
      await refreshBots();
      setShowDeleteConfirm(null);
      setShowBotDropdown(false);
      if (currentBotId === id) {
        setCode(STARTER_BOT_CODE);
        setBotName('My Bot');
        setCurrentBotId(null);
        setVersions([]);
        setIsDirty(false);
        setEditorLanguage('javascript');
        setLastEditedBotId(null);
        editorRef.current?.setValue(STARTER_BOT_CODE);
        setMonacoLanguage('javascript');
      }
      addLog(makeLog('warn', '🗑 Bot deleted'));
    },
    [currentBotId, refreshBots, addLog, setMonacoLanguage],
  );

  // ── Language change ─────────────────────────────────────────────

  const handleLanguageChange = useCallback(
    (lang: EditorLanguage) => {
      setEditorLanguage(lang);
      setMonacoLanguage(lang);

      if (!editorRef.current) return;
      const currentCode = editorRef.current.getValue();

      const starterCodes: Record<EditorLanguage, string> = {
        javascript: STARTER_BOT_CODE,
        typescript: STARTER_BOT_CODE_TS,
        python: STARTER_BOT_CODE_PYTHON,
        kotlin: STARTER_BOT_CODE_KOTLIN,
        csharp: STARTER_BOT_CODE_CSHARP,
        java: STARTER_BOT_CODE_JAVA,
        swift: STARTER_BOT_CODE_SWIFT,
      };

      // Switch to starter only if current content matches any known starter or is empty
      const isKnownStarter = Object.values(starterCodes).some(
        (s) => currentCode.trim() === s.trim(),
      );
      if (isKnownStarter || currentCode.trim() === '') {
        const starter = starterCodes[lang];
        editorRef.current.setValue(starter);
        setCode(starter);
        setIsDirty(false);
      }
    },
    [setMonacoLanguage],
  );

  // ── Run Test ────────────────────────────────────────────────────

  const handleRunTest = useCallback(async () => {
    const currentCode = editorRef.current?.getValue() ?? code;
    setConsoleCollapsed(false);
    addLog(makeLog('info', '─── Running validation test ───'));
    const { logs: newLogs, isPython, isKotlin, isCSharp, isJava, isSwift } = validateBot(currentCode);
    setLogs((prev) => [...prev, ...newLogs]);

    if (isPython) {
      addLog(makeLog('info', '🐍 Loading Brython runtime…'));
      try {
        const bot = new PythonSandboxedBot('test');
        await bot.initFromCode(currentCode);
        addLog(makeLog('success', '✓ Python compiled successfully'));

        const mockState = {
          tick: 0,
          maxTicks: 15000,
          mapWidth: 700,
          mapHeight: 1000,
          islands: [{ id: 1, x: 500, y: 500, radius: 50, owner: 'neutral', teamCapturing: 'none', captureProgress: 0, captureTurns: 15, value: 1 }],
          myShips: [{ id: 0, x: 80, y: 500, alive: true, isCapturing: false, turnsToRevive: 0, initialX: 80, initialY: 500 }],
          enemyShips: [{ id: 9, x: 600, y: 900, alive: true, isCapturing: false, turnsToRevive: 0, initialX: 600, initialY: 900 }],
          myScore: 0,
          enemyScore: 0,
          targetScore: 10000,
          config: { mapWidth: 700, mapHeight: 1000, shipSpeed: 5, attackRadius: 51, captureRadius: 50, captureTurns: 15, respawnDelay: 20, gameDuration: 15000, targetScore: 10000, shipsPerPlayer: 8, safeZoneWidth: 80 },
        };
        const ship = mockState.myShips[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cmd = bot.tick(mockState as any, ship as any);
        if (!cmd || !cmd.type) {
          throw new Error('tick() must return a valid command object');
        }
        addLog(makeLog('success', `✓ tick() → { type: '${cmd.type}'${cmd.type === 'move' && cmd.target ? `, target: {x: ${cmd.target.x}, y: ${cmd.target.y}}` : ''} }`));
        bot.destroy();
      } catch (e) {
        addLog(makeLog('error', `Python error: ${(e as Error).message}`));
      }
    }

    if (isKotlin) {
      addLog(makeLog('info', '🟣 Compiling Kotlin via JetBrains API…'));
      try {
        const bot = new KotlinSandboxedBot('test');
        await bot.initFromCode(currentCode);
        addLog(makeLog('success', '✓ Kotlin compiled successfully'));
        const mockState = {
          tick: 0,
          islands: [{ x: 500, y: 500, owner: 'neutral' }],
          myShips: [{ x: 80, y: 500, alive: true, id: 0 }],
          enemyShips: [],
          config: { attackRadius: 30 },
        };
        const ship = mockState.myShips[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cmd = bot.tick(mockState as any, ship as any);
        if (!cmd || !cmd.type) {
          throw new Error('tick() must return a valid command object');
        }
        addLog(makeLog('success', `✓ tick() → { type: '${cmd.type}' }`));
        bot.destroy();
      } catch (e) {
        addLog(makeLog('error', `Kotlin error: ${(e as Error).message}`));
      }
    }

    if (isCSharp) {
      addLog(makeLog('info', '🔷 Transpiling C# to JavaScript…'));
      try {
        const bot = new CSharpSandboxedBot('test');
        await bot.initFromCode(currentCode);
        addLog(makeLog('success', '✓ C# transpiled and validated successfully (no runtime required)'));
        bot.destroy();
      } catch (e) {
        addLog(makeLog('error', `C# error: ${(e as Error).message}`));
      }
    }

    if (isJava) {
      addLog(makeLog('info', '☕ Transpiling Java to JavaScript…'));
      try {
        const bot = new JavaSandboxedBot('test');
        await bot.initFromCode(currentCode);
        addLog(makeLog('success', '✓ Java transpiled and validated successfully (no runtime required)'));
        bot.destroy();
      } catch (e) {
        addLog(makeLog('error', `Java error: ${(e as Error).message}`));
      }
    }

    if (isSwift) {
      addLog(makeLog('info', '🦅 Compiling Swift via remote API… (this may take ~30s)'));
      try {
        const bot = new SwiftSandboxedBot('test');
        await bot.initFromCode(currentCode);
        addLog(makeLog('success', '✓ Swift compiled and validated successfully'));
        bot.destroy();
      } catch (e) {
        addLog(makeLog('error', `Swift error: ${(e as Error).message}`));
      }
    }
  }, [code, addLog]);

  // ── Restore version ─────────────────────────────────────────────

  const handleRestore = useCallback(
    async (versionCode: string) => {
      setCode(versionCode);
      editorRef.current?.setValue(versionCode);
      setIsDirty(true);
      addLog(makeLog('info', '↩ Version restored — save to persist'));
    },
    [addLog],
  );

  // ── Use in Battle ───────────────────────────────────────────────

  const handleUseInBattle = useCallback(async () => {
    const currentCode = editorRef.current?.getValue() ?? code;
    let savedId = currentBotId;

    if (isAuthenticated && botName.trim()) {
      const saved = await saveApiBot({
        id: currentBotId ?? undefined,
        name: botName.trim(),
        code: currentCode,
        language: editorLanguage as import('@/lib/api/bots').BotLanguage,
      }).catch(() => null);

      if (saved) {
        savedId = saved.id;
        setCurrentBotId(saved.id);
        setVersions([]);
        setIsDirty(false);
        setLastEditedBotId(saved.id);
        await refreshBots();
      }
    }

    updatePlayer1({ type: 'custom', code: currentCode, savedBotId: savedId ?? undefined });
    router.push(ROUTES.play);
  }, [code, currentBotId, botName, editorLanguage, isAuthenticated, refreshBots, updatePlayer1, router]);

  // ── LLM copy ────────────────────────────────────────────────────

  const handleCopyForLLM = useCallback(async () => {
    const currentCode = editorRef.current?.getValue() ?? code;
    const prompt = buildEditorLLMPrompt(currentCode, editorLanguage);
    try {
      await navigator.clipboard.writeText(prompt);
      setLlmCopyStatus('copied');
      setTimeout(() => setLlmCopyStatus('idle'), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = prompt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setLlmCopyStatus('copied');
        setTimeout(() => setLlmCopyStatus('idle'), 2500);
      } catch {
        setLlmCopyStatus('error');
        setTimeout(() => setLlmCopyStatus('idle'), 3000);
      }
      document.body.removeChild(ta);
    }
  }, [code, editorLanguage]);

  const handleLoadLLMCode = useCallback(() => {
    if (!llmPastedCode.trim()) return;
    const trimmed = llmPastedCode.trim();
    setCode(trimmed);
    editorRef.current?.setValue(trimmed);
    setIsDirty(true);
    setShowPasteLLMModal(false);
    setLlmPastedCode('');
    setConsoleCollapsed(false);
    addLog(makeLog('info', '📥 LLM code loaded into editor. Run Test to validate.'));
  }, [llmPastedCode, addLog]);

  // ── Expose ──────────────────────────────────────────────────────

  return {
    // Refs
    editorRef,
    monacoRef,
    // Auth
    isAuthenticated,
    // State
    code,
    botName,
    setBotName,
    currentBotId,
    isDirty,
    editorLanguage,
    savedBots,
    showBotDropdown,
    setShowBotDropdown,
    showDeleteConfirm,
    setShowDeleteConfirm,
    versions,
    sidebarTab,
    setSidebarTab,
    saveStatus,
    logs,
    setLogs,
    consoleCollapsed,
    setConsoleCollapsed,
    llmCopyStatus,
    showPasteLLMModal,
    setShowPasteLLMModal,
    llmPastedCode,
    setLlmPastedCode,
    record,
    // Handlers
    loadBotData,
    handleBeforeMount,
    handleMount,
    handleCodeChange,
    handleSave,
    handleNew,
    handleDelete,
    handleLanguageChange,
    handleRunTest,
    handleRestore,
    handleUseInBattle,
    handleCopyForLLM,
    handleLoadLLMCode,
    handleLoadExample: (exampleCode: string) => {
      setCode(exampleCode);
      editorRef.current?.setValue(exampleCode);
      setIsDirty(true);
    },
  };
}
