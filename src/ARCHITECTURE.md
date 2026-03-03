# Bots Battle — Architecture Guide

> Internal reference for contributors. Covers directory structure, design patterns,
> and how to extend the codebase.

---

## Directory Structure

```
src/
├── app/          # Next.js App Router pages & layouts
├── bots/         # Pre-built bot algorithm registry
├── components/   # React UI components
│   ├── campaign/ # Campaign-mode components
│   ├── docs/     # /docs page components
│   ├── editor/   # /editor page components
│   ├── game/     # /game page components
│   ├── nav/      # Navbar components
│   └── ui/       # shadcn/ui primitives + custom variants
├── engine/       # Pure TypeScript game engine (no React)
├── hooks/        # Standalone React hooks
├── lib/          # Utilities, context, storage, sandboxes
│   ├── constants/  # Static content (docs text, starter code, API ref)
│   ├── sandbox/    # Multi-language sandbox router
│   └── storage/    # LocalStorage CRUD + Zod schemas
├── types/        # Global TypeScript declarations
└── workers/      # Web Worker entry points
```

---

## Design System Usage

### shadcn/ui + Tailwind CSS

The project uses [shadcn/ui](https://ui.shadcn.com/) — a collection of
copy-pastable components built on Radix UI primitives and styled with Tailwind CSS.

**Install location:** `src/components/ui/`  
**Add a new component:** `pnpm dlx shadcn@latest add <component-name>`

**Custom pirate-themed variants:**
| Component | File | Purpose |
|-----------|------|---------|
| `GoldButton` | `ui/gold-button.tsx` | Primary CTA with gold gradient |
| `PirateCard` | `ui/pirate-card.tsx` | Dark card with treasure chest styling |
| `PageContainer` | `ui/page-container.tsx` | Consistent page padding/max-width |
| `SectionHeader` | `ui/section-header.tsx` | Decorated section headings |

**Color tokens** (defined in `src/lib/theme.ts` + `globals.css`):
- `--gold` / `--gold-dim` — primary accent
- `--pirate-dark` — deep navy background
- Standard shadcn CSS custom properties for light/dark mode

### Component Composition Pattern

All pages use `PageContainer` for consistent layout:
```tsx
import { PageContainer } from '@/components/ui/page-container';

export default function MyPage() {
  return (
    <PageContainer>
      <SectionHeader>Title</SectionHeader>
      {/* content */}
    </PageContainer>
  );
}
```

---

## Component Hierarchy

```
app/layout.tsx
└── ClientProviders          ← React context (GameContext, etc.)
    └── Navbar
        ├── NavLink
        └── MobileNav
    └── {page content}

/play page
└── GameSetup
    ├── FleetGrid            ← Your bot picker
    │   └── BotCard
    ├── OpponentGrid         ← Opponent picker
    │   └── ScoutingReportModal
    └── Config form (inline)

/editor page
└── BotEditor               ← Monaco wrapper
    └── EditorSidebar
        ├── EditorToolbar
        ├── BotSelector
        ├── LanguageToggle
        ├── ConsoleOutput
        └── PasteLLMModal

/game page
└── GameRunner              ← Orchestrates engine + renders
    ├── GameCanvas           ← Canvas 2D renderer
    ├── ScoreHUD             ← Score overlay
    ├── GameControls         ← Speed / pause
    └── GameOverModal        ← End screen

/campaign page
└── CampaignProgress
    ├── LevelCard
    │   └── BotSelectionModal
    └── VictoryFlash
```

---

## State Management Patterns

The app uses **React hooks only** — no Redux or Zustand.

### 1. Game State (`src/lib/GameContext.tsx`)

A React context that holds the active game configuration (selected bots, settings).
Consumed by `/play`, `/game`, and `/campaign` pages.

```tsx
// Read
const { config, playerBot, opponentBot } = useGameContext();
// Write
const { setConfig, setPlayerBot } = useGameContext();
```

### 2. Engine State (`src/lib/useGame.ts`)

The main game hook — manages the running `GameEngine` instance, tick loop,
and exposes `FullGameState` for rendering.

```tsx
const { gameState, isRunning, start, pause, setSpeed } = useGame(config);
```

### 3. Storage (`src/lib/storage/`)

All persistence is localStorage-based. Each module uses Zod schemas
(`src/lib/storage/schemas.ts`) for runtime validation.

```ts
// Bots
import { getBotById, saveBot, listBots, deleteBot } from '@/lib/storage/bots';
// Matches / replays
import { saveMatch, listReplays } from '@/lib/storage/matches';
```

**Schema migrations** run automatically on first read — see `migrations.ts`.

### 4. Campaign Progress (`src/lib/campaign.ts`)

Campaign state persisted in localStorage. Exposes:
```ts
getCampaignProgress()         // → CampaignProgress
advanceCampaign(levelIndex)   // → updated CampaignProgress
resetCampaign()
```

---

## How to Add a New Page

1. **Create the file:**
   ```
   src/app/my-page/page.tsx
   ```

2. **Use `PageContainer` for consistent layout:**
   ```tsx
   import { PageContainer } from '@/components/ui';
   
   export default function MyPage() {
     return (
       <PageContainer>
         <h1>My Page</h1>
       </PageContainer>
     );
   }
   ```

3. **Add a route constant** in `src/lib/routes.ts`:
   ```ts
   export const ROUTES = {
     ...existing,
     MY_PAGE: '/my-page',
   };
   ```

4. **Add a Navbar link** in `src/components/nav/Navbar.tsx` if needed.

5. **No special registration required** — Next.js App Router auto-discovers
   any `page.tsx` file.

---

## How to Add a New Bot

1. **Create `src/bots/my-bot.ts`** with the standard shape:

```ts
import type { BotFactory, GameState, Ship, Command } from '@/engine/types';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      // Your strategy here
      return { type: 'idle' };
    }
  };
}
`.trim();

export function createBot(): ReturnType<BotFactory> {
  return {
    tick(state: GameState, ship: Ship): Command {
      // Mirror of botCode above — same logic, TypeScript version
      return { type: 'idle' };
    }
  };
}
```

2. **Register in `src/bots/index.ts`:**

```ts
import { createBot as myBotFactory, botCode as myBotCode } from './my-bot';

// Add to the BOTS array:
{
  id: 'my-bot',              // stable, never change
  name: 'My Bot',
  description: 'One sentence.',
  flavour: 'Interesting detail.',
  difficulty: 'medium',     // 'easy' | 'medium' | 'hard' | 'insane'
  code: myBotCode,
  factory: myBotFactory,
},
```

3. **That's it.** The bot automatically appears in:
   - `/play` opponent picker
   - `/editor` bot selector
   - Campaign level definitions (if added to a level in `campaign.ts`)

---

## Language Registry

The `src/lib/languages/` directory is the **single source of truth** for all multi-language support. Every consumer — editor sidebar, docs page, LLM helper, sandbox router, starter codes — reads from here. Nothing duplicates language data elsewhere.

### Data Flow

```
engine/helpers.ts (BOT_HELPERS)
        │
        ▼
languages/helpers.ts        ← per-language native signatures for all 14 helpers
languages/commands.ts       ← per-language idle/move command snippets
languages/codegen.ts        ← runtime preamble builders (Python, Kotlin, Swift, C#)
        │
        ▼
languages/registry.ts (LANGUAGES record)
        │
        ├──→ lib/sandbox/index.ts        ← sandbox router reads LanguageConfig.sandbox.type
        │         │
        │         ├── botSandbox.ts       (js-direct: JS/TS via Web Worker)
        │         ├── pythonSandbox.ts    (remote-compile: Brython)
        │         ├── kotlinSandbox.ts    (remote-compile: Kotlin Playground)
        │         ├── javaSandbox.ts      (transpile-to-js)
        │         ├── csharpSandbox.ts    (transpile-to-js)
        │         └── swiftSandbox.ts     (remote-compile: Godbolt)
        │
        ├──→ components/docs/            ← reads starterCode, helperSignatures, typeDefinitions
        │
        ├──→ components/editor/          ← reads starterCode, sampleBots, monacoLanguage
        │       ├── LanguageToggle.tsx   ← getAllLanguages() for language picker
        │       └── EditorSidebar.tsx    ← getLanguage(id) for inline API docs
        │
        └──→ app/llm-helper/page.tsx     ← reads starterCode, docSnippets per language
```

### Sandbox ← Registry Relationship

The sandbox router (`lib/sandbox/index.ts`) dispatches execution based on `LanguageConfig.sandbox.type`:

| `sandbox.type` | Execution Model | Languages |
|----------------|----------------|-----------|
| `js-direct` | Function() constructor in Web Worker with helpers injected | JS, TS |
| `transpile-to-js` | Local transpiler → JavaScript → Web Worker | Java, C# |
| `remote-compile` | External API → JS/WASM/stdout bridge | Python, Kotlin, Swift |

The registry owns the classification; sandboxes own the execution. Adding a new language only requires registering it in the registry and wiring a sandbox — no other files need changes.

### Docs/Editor ← Registry Relationship

- **`/docs` page:** reads `helperSignatures` and `typeDefinitions` from each `LanguageConfig` to generate per-language API tabs
- **`/editor` sidebar:** reads `starterCode`, `sampleBots`, and `docSnippets` to populate the inline reference panel and "Load Example" modal
- **Monaco editor:** uses `monacoLanguage` for syntax highlighting and `typeDefinitions` for intellisense stubs

Both consumers call `getAllLanguages()` to enumerate supported languages — no hardcoded arrays anywhere else.

---

## Engine Overview

The engine (`src/engine/`) is pure TypeScript — zero React, zero DOM.

| Module | Responsibility |
|--------|---------------|
| `GameEngine.ts` | Main tick loop, orchestrates all modules |
| `types.ts` | All interfaces + `DEFAULT_CONFIG` (authoritative defaults) |
| `combat.ts` | Per-ship radius combat resolution |
| `capture.ts` | Island capture state machine |
| `map.ts` | Symmetric island placement |
| `scoring.ts` | Exponential scoring formula |
| `helpers.ts` | Bot helper functions injected into sandbox scope |

**All engine modules have corresponding `.test.ts` files** (148 passing tests).
Run with `pnpm test`.

### Bot Sandbox Flow

```
User code (JavaScript/Python/Kotlin)
  → typeStripper.ts (strip TypeScript annotations if needed)
  → sandbox/index.ts (route by language)
     ├── botSandbox.ts    → botWorker.ts (Web Worker)
     ├── pythonSandbox.ts → Brython (public/brython.min.js)
     └── kotlinSandbox.ts → Kotlin/JS
  → GameEngine receives a BotFactory
  → tick() called once per ship per tick
```

---

## How to Add a New Language

1. Add ID to `LanguageId` union in `lib/languages/types.ts`
2. Add 14 helper signatures in `lib/languages/helpers.ts`
3. Add `CommandApi` in `lib/languages/commands.ts`
4. Add full `LanguageConfig` to `LANGUAGES` record and `ALL_LANGUAGE_IDS` in `lib/languages/registry.ts` (starter code + 3 sample bots)
5. Add runtime preamble builders in `lib/languages/codegen.ts` if needed
6. Create `lib/<language>Sandbox.ts` implementing the execution model
7. Register in `lib/sandbox/index.ts` router
8. Update `__tests__/registry.test.ts` to include new language ID

---

## Testing

```bash
pnpm test          # Run all Vitest tests (fast, ~150ms)
pnpm test --watch  # Watch mode
```

Tests live next to their source files in `src/engine/`.
No React component tests currently.

---

## Key Conventions

- **Imports:** Use `@/` path alias (maps to `src/`)
- **Types:** Engine-internal uses `"player1"/"player2"`, bot-facing uses `"me"/"enemy"`
- **Lint:** `pnpm lint` — zero errors required, warnings acceptable
- **Format:** `pnpm format` (Prettier) — run before committing
- **Authoritative defaults:** `src/engine/types.ts` `DEFAULT_CONFIG` — never hardcode defaults elsewhere
