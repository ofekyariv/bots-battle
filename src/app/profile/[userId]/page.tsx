// ============================================================
// 🏴☠️ /profile/[userId] — Public profile (no auth required)
// ============================================================
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/db';
import { users, bots, matches } from '@/db/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PirateCard, CardContent } from '@/components/ui/pirate-card';
import { SectionHeader } from '@/components/ui/section-header';
import { PageContainer } from '@/components/ui/page-container';

// ── Helpers ──────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
  typescript: 'bg-blue-400/20 text-blue-300 border-blue-400/40',
  python: 'bg-green-400/20 text-green-300 border-green-400/40',
  kotlin: 'bg-purple-400/20 text-purple-300 border-purple-400/40',
  java: 'bg-orange-400/20 text-orange-300 border-orange-400/40',
  csharp: 'bg-indigo-400/20 text-indigo-300 border-indigo-400/40',
  swift: 'bg-red-400/20 text-red-300 border-red-400/40',
};

function LangBadge({ lang }: { lang: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LANG_COLORS[lang] ?? 'bg-white/10 text-white/60 border-white/20'}`}>
      {lang}
    </span>
  );
}

function ResultBadge({ result }: { result: 'win' | 'loss' | 'draw' }) {
  const styles = {
    win: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40',
    loss: 'bg-red-400/20 text-red-300 border-red-400/40',
    draw: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
  };
  const labels = { win: 'W', loss: 'L', draw: 'D' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${styles[result]}`}>
      {labels[result]}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRows.length) notFound();
  const user = userRows[0];

  // Bots (no code exposed)
  const userBots = await db
    .select({
      id: bots.id,
      name: bots.name,
      language: bots.language,
      version: bots.version,
      isActive: bots.isActive,
      updatedAt: bots.updatedAt,
    })
    .from(bots)
    .where(and(eq(bots.userId, userId), eq(bots.isActive, true)))
    .orderBy(desc(bots.updatedAt));

  const botIds = userBots.map((b) => b.id);

  const bot1 = alias(bots, 'bot1');
  const bot2 = alias(bots, 'bot2');
  const user2 = alias(users, 'opp');

  type MatchRow = {
    id: string;
    player1BotId: string;
    player2BotId: string;
    winnerBotId: string | null;
    player1Score: number;
    player2Score: number;
    completedAt: Date | null;
    bot1Name: string;
    bot2Name: string;
    bot2UserId: string;
    oppName: string | null;
  };

  let recentMatches: MatchRow[] = [];
  let stats = { totalMatches: 0, wins: 0, losses: 0, draws: 0, winRate: 0, favoriteLanguage: null as string | null };

  if (botIds.length > 0) {
    const matchRows = await db
      .select({
        id: matches.id,
        player1BotId: matches.player1BotId,
        player2BotId: matches.player2BotId,
        winnerBotId: matches.winnerBotId,
        player1Score: matches.player1Score,
        player2Score: matches.player2Score,
        completedAt: matches.completedAt,
        bot1Name: bot1.name,
        bot2Name: bot2.name,
        bot2UserId: bot2.userId,
        oppName: user2.name,
      })
      .from(matches)
      .innerJoin(bot1, eq(matches.player1BotId, bot1.id))
      .innerJoin(bot2, eq(matches.player2BotId, bot2.id))
      .innerJoin(user2, eq(bot2.userId, user2.id))
      .where(
        and(
          eq(matches.status, 'completed'),
          or(...botIds.map((bid) => or(eq(matches.player1BotId, bid), eq(matches.player2BotId, bid)))),
        ),
      )
      .orderBy(desc(matches.completedAt))
      .limit(20);

    recentMatches = matchRows as MatchRow[];

    let wins = 0, losses = 0, draws = 0;
    const langCount: Record<string, number> = {};
    for (const m of recentMatches) {
      const isP1 = botIds.includes(m.player1BotId);
      const myBotId = isP1 ? m.player1BotId : m.player2BotId;
      const myBot = userBots.find((b) => b.id === myBotId);
      if (myBot) langCount[myBot.language] = (langCount[myBot.language] ?? 0) + 1;
      if (!m.winnerBotId) draws++;
      else if (m.winnerBotId === myBotId) wins++;
      else losses++;
    }
    const total = wins + losses + draws;
    stats = {
      totalMatches: total, wins, losses, draws,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      favoriteLanguage: Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* ── Hero ──────────────────────────────────────── */}
        <PirateCard glow className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-navy via-[#0d2a4a] to-navy relative">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(212,168,67,0.1) 0, rgba(212,168,67,0.1) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }}
            />
          </div>
          <CardContent className="pt-0 px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={80}
                  height={80}
                  className="rounded-full border-4 border-gold/60 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-4 border-gold/60 bg-navy-card flex items-center justify-center text-3xl">
                  🏴‍☠️
                </div>
              )}
              <div className="flex-1 min-w-0 pb-1">
                <h1 className="text-2xl font-bold text-white font-serif">{user.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gold font-bold text-lg">⚔️ {user.eloRating} ELO</span>
                  <span className="text-white/40 text-sm">Pirate Admiral</span>
                </div>
              </div>
            </div>
          </CardContent>
        </PirateCard>

        {/* ── Stats ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Matches', value: stats.totalMatches, icon: '⚔️' },
            { label: 'Win Rate', value: `${stats.winRate}%`, icon: '🏆' },
            { label: 'Current ELO', value: user.eloRating, icon: '📈' },
            { label: 'Fav. Language', value: stats.favoriteLanguage ?? '—', icon: '💻' },
          ].map(({ label, value, icon }) => (
            <PirateCard key={label}>
              <CardContent className="p-4 text-center">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-xl font-bold text-gold">{value}</div>
                <div className="text-xs text-white/50 mt-0.5">{label}</div>
              </CardContent>
            </PirateCard>
          ))}
        </div>

        {/* ── Bots (read-only, no code) ──────────────────── */}
        <section>
          <SectionHeader title="🤖 Bots" />
          {userBots.length === 0 ? (
            <PirateCard>
              <CardContent className="py-10 text-center text-white/50">
                <div className="text-4xl mb-3">🏗️</div>
                <p>This pirate hasn&#39;t built any bots yet.</p>
              </CardContent>
            </PirateCard>
          ) : (
            <div className="space-y-3">
              {userBots.map((bot) => (
                <PirateCard key={bot.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{bot.name}</span>
                        <LangBadge lang={bot.language} />
                        <span className="text-xs text-white/40">v{bot.version}</span>
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        Last updated {new Date(bot.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </PirateCard>
              ))}
            </div>
          )}
        </section>

        {/* ── Match History ─────────────────────────────── */}
        <section>
          <SectionHeader title="📜 Match History" />
          {recentMatches.length === 0 ? (
            <PirateCard>
              <CardContent className="py-10 text-center text-white/50">
                <div className="text-4xl mb-3">⚓</div>
                <p>No battles yet.</p>
              </CardContent>
            </PirateCard>
          ) : (
            <PirateCard>
              <CardContent className="p-0">
                <div className="divide-y divide-gold/10">
                  {recentMatches.map((m) => {
                    const isP1 = botIds.includes(m.player1BotId);
                    const myBotId = isP1 ? m.player1BotId : m.player2BotId;
                    const result = !m.winnerBotId ? 'draw' : m.winnerBotId === myBotId ? 'win' : 'loss';
                    const myScore = isP1 ? m.player1Score : m.player2Score;
                    const oppScore = isP1 ? m.player2Score : m.player1Score;
                    const myBotName = isP1 ? m.bot1Name : m.bot2Name;
                    const oppName = m.oppName ?? 'Unknown';
                    const oppUserId = m.bot2UserId;

                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <ResultBadge result={result as 'win' | 'loss' | 'draw'} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">
                            <span className="font-medium">{myBotName}</span>
                            <span className="text-white/40 mx-2">vs</span>
                            <Link href={`/profile/${oppUserId}`} className="hover:text-gold transition-colors">
                              {oppName}
                            </Link>
                          </div>
                          <div className="text-xs text-white/40 mt-0.5">
                            {m.completedAt ? new Date(m.completedAt).toLocaleDateString() : '—'}
                          </div>
                        </div>
                        <div className="text-sm font-mono font-bold text-white/80 shrink-0">
                          {myScore} – {oppScore}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </PirateCard>
          )}
        </section>

      </div>
    </PageContainer>
  );
}
