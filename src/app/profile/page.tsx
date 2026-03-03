// ============================================================
// 🏴☠️ /profile — Current user's profile (requires auth)
// ============================================================
import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, bots, matches } from '@/db/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { PirateCard, CardContent, CardHeader, CardTitle } from '@/components/ui/pirate-card';
import { Badge } from '@/components/ui/badge';
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
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${LANG_COLORS[lang] ?? 'bg-white/10 text-white/60 border-white/20'}`}
    >
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
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${styles[result]}`}
    >
      {labels[result]}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Fetch user
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];

  // Fetch bots
  const userBots = await db
    .select()
    .from(bots)
    .where(eq(bots.userId, userId))
    .orderBy(desc(bots.updatedAt));

  // Fetch recent matches
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
    bot1Language: string;
    bot2Name: string;
    bot2Language: string;
    bot2UserId: string;
    oppName: string | null;
    oppImage: string | null;
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
        bot1Language: bot1.language,
        bot2Name: bot2.name,
        bot2Language: bot2.language,
        bot2UserId: bot2.userId,
        oppName: user2.name,
        oppImage: user2.image,
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

    // Compute stats
    let wins = 0, losses = 0, draws = 0;
    const langCount: Record<string, number> = {};
    for (const m of recentMatches) {
      const isP1 = botIds.includes(m.player1BotId);
      const myBotId = isP1 ? m.player1BotId : m.player2BotId;
      const myLang = isP1 ? m.bot1Language : m.bot2Language;
      langCount[myLang] = (langCount[myLang] ?? 0) + 1;
      if (!m.winnerBotId) draws++;
      else if (m.winnerBotId === myBotId) wins++;
      else losses++;
    }
    const total = wins + losses + draws;
    stats = {
      totalMatches: total,
      wins,
      losses,
      draws,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      favoriteLanguage: Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    };
  }

  const eloRating = user?.eloRating ?? 1000;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* ── Hero / Avatar ─────────────────────────────── */}
        <PirateCard glow className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-navy via-[#0d2a4a] to-navy relative">
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(212,168,67,0.1) 0, rgba(212,168,67,0.1) 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }}
            />
          </div>
          <CardContent className="pt-0 px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? 'Avatar'}
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
                <h1 className="text-2xl font-bold text-white font-serif">
                  {session.user.name ?? 'Unknown Pirate'}
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-gold font-bold text-lg">⚔️ {eloRating} ELO</span>
                  <span className="text-white/40 text-sm">Pirate Admiral</span>
                </div>
              </div>
            </div>
          </CardContent>
        </PirateCard>

        {/* ── Stats Card ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Matches', value: stats.totalMatches, icon: '⚔️' },
            { label: 'Win Rate', value: `${stats.winRate}%`, icon: '🏆' },
            { label: 'Current ELO', value: eloRating, icon: '📈' },
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

        {/* ── My Bots ───────────────────────────────────── */}
        <section>
          <SectionHeader title="🤖 My Bots" />
          {userBots.length === 0 ? (
            <PirateCard>
              <CardContent className="py-10 text-center text-white/50">
                <div className="text-4xl mb-3">🏗️</div>
                <p>No bots yet. <Link href="/editor" className="text-gold hover:underline">Build your first bot →</Link></p>
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
                        {bot.isActive ? (
                          <span className="text-xs text-emerald-400">● Active</span>
                        ) : (
                          <span className="text-xs text-white/30">● Inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">
                        Last updated {new Date(bot.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Link
                      href={`/editor?botId=${bot.id}`}
                      className="shrink-0 px-3 py-1.5 rounded-md text-sm font-medium bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors"
                    >
                      ✏️ Edit
                    </Link>
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
                <p>No battles yet. <Link href="/play" className="text-gold hover:underline">Set sail →</Link></p>
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

                    return (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <ResultBadge result={result as 'win' | 'loss' | 'draw'} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">
                            <span className="font-medium">{myBotName}</span>
                            <span className="text-white/40 mx-2">vs</span>
                            <Link href={`/profile/${m.bot2UserId}`} className="hover:text-gold transition-colors">
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
