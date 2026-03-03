// ============================================================
// 🏆 /tournaments/create — Create tournament form
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BotOption {
  id: string;
  name: string;
  language: string;
}

const FORMAT_OPTIONS = [
  { value: 'round_robin', label: '🔄 Round Robin', desc: 'Everyone plays everyone' },
  { value: 'single_elim', label: '🗡️ Single Elimination', desc: 'One loss and you\'re out' },
  { value: 'double_elim', label: '⚔️ Double Elimination', desc: 'Two losses to exit' },
] as const;

export default function CreateTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'round_robin' | 'single_elim' | 'double_elim'>('round_robin');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [botId, setBotId] = useState('');
  const [bots, setBots] = useState<BotOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/bots')
      .then((r) => r.json())
      .then((data) => {
        const myBots: BotOption[] = data.bots ?? [];
        setBots(myBots);
        if (myBots.length > 0) setBotId(myBots[0].id);
      })
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!botId) {
      setError('You need at least one bot to create a tournament.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, format, maxPlayers, botId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create tournament');
        return;
      }
      router.push(`/tournaments/${data.tournament.id}`);
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-navy">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#fbbf24] font-serif">🏆 New Tournament</h1>
          <p className="text-sm text-[#64748b] mt-1">Set up a tournament and invite your rivals</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-[rgba(15,23,42,0.8)] border border-gold/20 rounded-2xl p-6 shadow-xl">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">
              Tournament Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={128}
              placeholder="The Grand Armada"
              className="w-full bg-[rgba(10,22,40,0.8)] border border-gold/20 rounded-lg px-4 py-2.5 text-[#e2e8f0] placeholder-[#334155] focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">
              Format
            </label>
            <div className="flex flex-col gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                    format === opt.value
                      ? 'border-gold/60 bg-gold/10'
                      : 'border-gold/10 hover:border-gold/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={() => setFormat(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-semibold text-[#e2e8f0] text-sm">{opt.label}</div>
                    <div className="text-xs text-[#64748b]">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Max players */}
          <div>
            <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">
              Max Players: {maxPlayers}
            </label>
            <input
              type="range"
              min={2}
              max={64}
              step={2}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-gold"
            />
            <div className="flex justify-between text-xs text-[#475569] mt-1">
              <span>2</span>
              <span>64</span>
            </div>
          </div>

          {/* Bot selection */}
          <div>
            <label className="block text-xs font-bold text-[#94a3b8] uppercase tracking-widest mb-2">
              Your Entry Bot
            </label>
            {bots.length === 0 ? (
              <p className="text-sm text-red-400">No bots found. Create a bot first in the Editor.</p>
            ) : (
              <select
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                className="w-full bg-[rgba(10,22,40,0.8)] border border-gold/20 rounded-lg px-4 py-2.5 text-[#e2e8f0] focus:outline-none focus:border-gold/60"
              >
                {bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || bots.length === 0}
            className="w-full py-3 rounded-lg font-bold text-navy bg-gold shadow-[0_2px_8px_rgba(212,168,67,0.35)] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating…' : '⚓ Create Tournament'}
          </button>
        </form>
      </div>
    </div>
  );
}
