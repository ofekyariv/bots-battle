// ============================================================
// 🏴☠️ Client-side bot API wrappers
// ============================================================

export type BotLanguage = 'javascript' | 'typescript' | 'python' | 'kotlin' | 'java' | 'csharp' | 'swift';

export interface BotMeta {
  id: string;
  name: string;
  language: BotLanguage;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BotWithCode extends BotMeta {
  code: string;
}

export interface SaveBotData {
  id?: string;
  name: string;
  language: BotLanguage;
  code: string;
  is_active?: boolean;
}

export interface ValidateResult {
  valid: boolean;
  errors?: string[];
  note?: string;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** List all bots for the current user (no code). */
export async function listBots(): Promise<BotMeta[]> {
  return fetchJSON<BotMeta[]>('/api/bots');
}

/** Get a single bot with code (for the editor). */
export async function getBot(id: string): Promise<BotWithCode> {
  return fetchJSON<BotWithCode>(`/api/bots/${id}`);
}

/**
 * Create or update a bot.
 * - If `data.id` is provided → PUT /api/bots/:id (update).
 * - Otherwise → POST /api/bots (create).
 */
export async function saveBot(data: SaveBotData): Promise<BotMeta> {
  if (data.id) {
    const { id, ...body } = data;
    return fetchJSON<BotMeta>(`/api/bots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  return fetchJSON<BotMeta>('/api/bots', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      language: data.language,
      code: data.code,
    }),
  });
}

/** Soft-delete a bot (sets is_active = false). */
export async function deleteBot(id: string): Promise<void> {
  await fetchJSON<{ success: boolean }>(`/api/bots/${id}`, { method: 'DELETE' });
}

/** Run a server-side syntax check on a saved bot. */
export async function validateBot(id: string): Promise<ValidateResult> {
  return fetchJSON<ValidateResult>(`/api/bots/${id}/validate`, { method: 'POST' });
}
