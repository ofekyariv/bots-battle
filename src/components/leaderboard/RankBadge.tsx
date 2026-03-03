'use client';

interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md' | 'lg';
}

const CROWN_ICONS: Record<number, string> = {
  1: '👑',
  2: '🥈',
  3: '🥉',
};

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-navy font-black shadow-[0_0_12px_rgba(212,168,67,0.7)] border border-yellow-300',
  2: 'bg-gradient-to-br from-slate-300 to-slate-500 text-navy font-black shadow-[0_0_8px_rgba(148,163,184,0.5)] border border-slate-200',
  3: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white font-black shadow-[0_0_8px_rgba(180,83,9,0.5)] border border-amber-500',
};

const SIZE_STYLES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
};

export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const sizeClass = SIZE_STYLES[size];
  const isTop3 = rank <= 3;

  if (isTop3) {
    return (
      <div
        className={`${sizeClass} ${RANK_STYLES[rank]} rounded-full flex items-center justify-center flex-col leading-none`}
        title={`Rank #${rank}`}
      >
        <span className="text-[0.65em] leading-none">{CROWN_ICONS[rank]}</span>
        <span className="text-[0.6em] leading-none font-black">#{rank}</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} bg-navy-light border border-gold/20 text-gold/70 font-bold rounded-full flex items-center justify-center text-xs`}
      title={`Rank #${rank}`}
    >
      #{rank}
    </div>
  );
}
