// 🏴☠️ Challenge Landing Page — accept a 1v1 challenge via invite link
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';

interface ChallengeDetails {
  code: string;
  status: string;
  expiresAt: string;
  challenger: { id: string; name: string; image?: string } | null;
  challengerBot: { id: string; name: string; language: string } | null;
  matchId?: string | null;
}

interface BotOption {
  id: string;
  name: string;
  language: string;
}

const LANGUAGE_EMOJI: Record<string, string> = {
  javascript: '🟨',
  typescript: '🔷',
  python: '🐍',
  kotlin: '🟣',
  java: '☕',
  csharp: '🔵',
  swift: '🟠',
};

export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [challenge, setChallenge] = useState<ChallengeDetails | null>(null);
  const [myBots, setMyBots] = useState<BotOption[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load challenge details
  useEffect(() => {
    if (!code) return;
    fetch(`/api/challenges/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setChallenge(data);
      })
      .catch(() => setError('Failed to load challenge'))
      .finally(() => setLoading(false));
  }, [code]);

  // Load user's bots once authenticated
  useEffect(() => {
    if (!session?.user) return;
    fetch('/api/bots')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: BotOption[]) => {
        if (!Array.isArray(data)) throw new Error('Unexpected response');
        setMyBots(data);
        if (data.length > 0) setSelectedBotId(data[0].id);
      })
      .catch(() => {
        setMyBots([]);
      });
  }, [session]);

  async function acceptChallenge() {
    if (!selectedBotId) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/challenges/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: selectedBotId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to accept challenge');
      } else {
        router.push(`/matches/${data.matchId}`);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setAccepting(false);
    }
  }

  // ─── Loading state ───────────────────────────────────────
  if (loading || authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy">
        <div className="text-gold text-xl animate-pulse">⚓ Loading challenge...</div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────
  if (error && !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy px-4">
        <div className="border border-red-500/40 bg-[rgba(10,22,40,0.92)] rounded-xl p-10 max-w-md w-full text-center shadow-xl">
          <div className="text-5xl mb-4">💀</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Challenge Not Found</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const isOwnChallenge = session?.user?.id === challenge?.challenger?.id;
  const isAccepted = challenge?.status === 'accepted';
  const isExpired = challenge?.status === 'expired';

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy px-4 py-12">
      <div className="border border-gold/30 bg-[rgba(10,22,40,0.92)] rounded-xl p-10 max-w-lg w-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] text-center">
        <div className="text-5xl mb-4 drop-shadow-[0_0_16px_rgba(212,168,67,0.6)]">⚔️</div>
        <h1 className="text-3xl font-bold font-serif text-gold tracking-wide mb-1">1v1 Challenge</h1>
        <p className="text-gold/60 text-sm italic mb-8">&ldquo;Only one bot leaves these waters.&rdquo;</p>

        {/* Challenger info */}
        {challenge?.challenger && (
          <div className="flex items-center justify-center gap-3 mb-6">
            {challenge.challenger.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={challenge.challenger.image} alt="avatar" className="w-10 h-10 rounded-full border border-gold/30" />
            )}
            <div className="text-left">
              <div className="text-white font-bold">{challenge.challenger.name}</div>
              <div className="text-gold/70 text-sm">
                {LANGUAGE_EMOJI[challenge.challengerBot?.language ?? ''] ?? '🤖'}{' '}
                {challenge.challengerBot?.name ?? 'Unknown Bot'}{' '}
                <span className="text-gold/40">({challenge.challengerBot?.language})</span>
              </div>
            </div>
            <div className="text-2xl ml-2">🏴‍☠️</div>
          </div>
        )}

        {/* Status banners */}
        {isExpired && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4 mb-6 text-red-300 text-sm">
            ⏰ This challenge has expired.
          </div>
        )}

        {isAccepted && (
          <div className="bg-green-900/30 border border-green-500/40 rounded-lg p-4 mb-6 text-green-300 text-sm">
            ✅ Challenge already accepted!{' '}
            {challenge.matchId && (
              <button onClick={() => router.push(`/matches/${challenge.matchId}`)} className="underline font-bold">
                View Match →
              </button>
            )}
          </div>
        )}

        {isOwnChallenge && !isAccepted && !isExpired && (
          <div className="bg-gold/10 border border-gold/30 rounded-lg p-4 mb-6 text-gold/80 text-sm">
            🔗 This is your challenge link. Share it with a friend!
            <div className="mt-2 font-mono text-xs text-gold/60 break-all">
              {typeof window !== 'undefined' ? window.location.href : ''}
            </div>
          </div>
        )}

        {/* Accept section — only shown if pending + not own challenge */}
        {!isOwnChallenge && !isAccepted && !isExpired && (
          <>
            {!session ? (
              /* Not logged in */
              <div>
                <p className="text-slate-300 mb-4 text-sm">Sign in to accept this challenge and face {challenge?.challenger?.name ?? 'the challenger'}.</p>
                <button
                  onClick={() => signIn()}
                  className="w-full py-3 rounded-lg bg-gold text-navy font-bold text-lg hover:bg-gold/90 transition-all hover:scale-105"
                >
                  ⚓ Sign in to Accept
                </button>
              </div>
            ) : myBots.length === 0 ? (
              /* Logged in but no bots */
              <div>
                <p className="text-slate-300 mb-4 text-sm">You need a bot to accept this challenge.</p>
                <button
                  onClick={() => router.push('/editor')}
                  className="w-full py-3 rounded-lg bg-gold text-navy font-bold text-lg hover:bg-gold/90 transition-all hover:scale-105"
                >
                  🛠 Build Your Bot
                </button>
              </div>
            ) : (
              /* Pick bot + confirm */
              <div className="text-left">
                <label className="block text-sm font-bold text-gold mb-2">Choose your bot:</label>
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  className="w-full rounded-lg bg-navy border border-gold/30 text-white px-3 py-2 mb-4 focus:outline-none focus:border-gold"
                >
                  {myBots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {LANGUAGE_EMOJI[b.language] ?? '🤖'} {b.name} ({b.language})
                    </option>
                  ))}
                </select>

                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

                <button
                  onClick={acceptChallenge}
                  disabled={accepting || !selectedBotId}
                  className="w-full py-3 rounded-lg bg-gold text-navy font-bold text-lg hover:bg-gold/90 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {accepting ? '⚓ Launching Battle...' : '⚔️ Accept Challenge'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Expires at */}
        {challenge?.status === 'pending' && !isOwnChallenge && (
          <p className="text-slate-500 text-xs mt-6">
            Expires {new Date(challenge.expiresAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
