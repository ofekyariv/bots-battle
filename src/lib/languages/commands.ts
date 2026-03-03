// ============================================================
// 🏴☠️ Bots Battle — Command API per Language
// Defines how commands are created in each language
// ============================================================

import type { CommandApi, LanguageId } from './types';

export const COMMAND_APIS: Record<LanguageId, CommandApi> = {
  javascript: {
    idle: `{ type: 'idle' }`,
    move: `{ type: 'move', target: { x, y } }`,
    moveToObject: `{ type: 'move', target }`,
    description: 'Return command objects directly. Command.idle() and Command.move(x, y) are also available as helpers.',
  },
  typescript: {
    idle: `{ type: 'idle' }`,
    move: `{ type: 'move', target: { x, y } }`,
    moveToObject: `{ type: 'move', target }`,
    description: 'Return command objects directly. Command.idle() and Command.move(x, y) are also available as helpers.',
  },
  python: {
    idle: `{"type": "idle"}`,
    move: `{"type": "move", "target": {"x": x, "y": y}}`,
    moveToObject: `{"type": "move", "target": target}`,
    description: 'Return command dicts directly. Command.idle() and Command.move(x, y) are also available as helpers.',
  },
  kotlin: {
    idle: `idle()`,
    move: `moveTo(x, y)`,
    moveToObject: `moveTo(target.x as Double, target.y as Double)`,
    description: 'Use idle() and moveTo(x, y) function calls.',
  },
  java: {
    idle: `idle()`,
    move: `move(x, y)`,
    moveToObject: `move(target.x, target.y)`,
    description: 'Use idle() and move(x, y) helper functions.',
  },
  csharp: {
    idle: `Idle()`,
    move: `Move(x, y)`,
    moveToObject: `Move(target.X, target.Y)`,
    description: 'Use Idle() and Move(x, y) helper functions.',
  },
  swift: {
    idle: `.idle`,
    move: `.move(x: x, y: y)`,
    moveToObject: `.move(x: target.x, y: target.y)`,
    description: 'Use .idle and .move(x:y:) enum cases.',
  },
};

/** Get the command API for a language */
export function getCommandApi(langId: LanguageId): CommandApi {
  return COMMAND_APIS[langId];
}
