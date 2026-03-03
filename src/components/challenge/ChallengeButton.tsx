// 🏴☠️ Challenge a Friend — create a shareable invite link
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

interface BotOption {
  id: string;
  name: string;
  language: string;
}

export default function ChallengeButton() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [bots, setBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function openModal() {
    setOpen(true);
    setInviteUrl(null);
    setError(null);
    setBotsLoading(true);
    try {
      const res = await fetch('/api/bots');
      const data: BotOption[] = await res.json();
      setBots(data);
      if (data.length > 0) setSelectedBotId(data[0].id);
    } catch {
      setError('Failed to load your bots');
    } finally {
      setBotsLoading(false);
    }
  }

  async function createChallenge() {
    if (!selectedBotId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: selectedBotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create challenge');
      } else {
        setInviteUrl(data.inviteUrl);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!session) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openModal}
        className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 flex-shrink-0 bg-navy border border-gold/40 text-gold hover:bg-gold/10"
      >
        🏴‍☠️ Challenge a Friend
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="border border-gold/30 bg-[rgba(10,22,40,0.97)] rounded-xl p-8 max-w-md w-full shadow-[0_8px_32px_rgba(0,0,0,0.7)] text-center">
            <div className="text-4xl mb-3">⚔️</div>
            <h2 className="text-2xl font-bold text-gold mb-1">Challenge a Friend</h2>
            <p className="text-slate-400 text-sm mb-6">Pick your bot, generate a link, send it to your opponent.</p>

            {botsLoading ? (
              <p className="text-gold/60 animate-pulse text-sm">Loading your bots...</p>
            ) : bots.length === 0 ? (
              <p className="text-slate-400 text-sm">You need to create a bot first.</p>
            ) : !inviteUrl ? (
              <>
                <label className="block text-left text-sm font-bold text-gold mb-2">Your bot:</label>
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  className="w-full rounded-lg bg-navy border border-gold/30 text-white px-3 py-2 mb-4 focus:outline-none focus:border-gold"
                >
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.language})
                    </option>
                  ))}
                </select>

                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

                <button
                  onClick={createChallenge}
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-gold text-navy font-bold hover:bg-gold/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Generating link...' : '🔗 Generate Invite Link'}
                </button>
              </>
            ) : (
              <>
                <p className="text-green-400 text-sm mb-3">✅ Challenge created! Share this link:</p>
                <div className="bg-navy/80 border border-gold/20 rounded-lg px-3 py-2 mb-4 font-mono text-xs text-gold/80 break-all text-left">
                  {inviteUrl}
                </div>
                <button
                  onClick={copyLink}
                  className="w-full py-3 rounded-lg bg-gold text-navy font-bold hover:bg-gold/90 transition-all hover:scale-105 mb-3"
                >
                  {copied ? '✅ Copied!' : '📋 Copy Link'}
                </button>
                <button
                  onClick={() => { setInviteUrl(null); setOpen(false); }}
                  className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Done
                </button>
              </>
            )}

            <button
              onClick={() => setOpen(false)}
              className="mt-4 text-slate-500 text-xs hover:text-white transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
