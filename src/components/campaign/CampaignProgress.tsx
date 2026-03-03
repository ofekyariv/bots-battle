// ============================================================
// 📊 CampaignProgress — Overall Progress Bar & Tracker
// ============================================================
'use client';

import { CAMPAIGN_LEVELS } from '@/lib/campaign';
import type { CampaignProgress as CampaignProgressData } from '@/lib/campaign';

interface CampaignProgressProps {
  progress: CampaignProgressData;
}

export function CampaignProgress({ progress }: CampaignProgressProps) {
  const completedLevels = progress.completedLevels.length;
  const totalLevels = CAMPAIGN_LEVELS.length;
  const totalWins = progress.attempts.filter((a) => a.result === 'win').length;
  const totalAttempts = progress.attempts.length;

  return (
    <div className="mt-5 mx-auto max-w-xs">
      <div className="flex justify-between text-xs mb-1 text-[#475569]">
        <span>
          {completedLevels}/{totalLevels} levels
        </span>
        <span>
          {totalAttempts > 0 ? `${totalWins}W / ${totalAttempts - totalWins}L` : 'No battles yet'}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-[rgba(30,41,59,0.7)]">
        {/* width is JS-computed — must stay as style */}
        <div
          className="h-full rounded-full transition-all duration-700 bg-[linear-gradient(90deg,#92741a,#d4a843)]"
          style={{ width: `${(completedLevels / totalLevels) * 100}%` }}
        />
      </div>
      {completedLevels === totalLevels && (
        <div className="text-center mt-2 text-sm font-bold text-gold">👑 Pirate King!</div>
      )}
    </div>
  );
}
