// ============================================================
// 🏴‍☠️ /campaign route layout — metadata + passthrough
// ============================================================
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campaign',
  description:
    'Battle through 10 progressive pirate campaign levels. Code your fleet in any of 7 languages and climb from a humble sailor to the Fleet Admiral of the Seas.',
  openGraph: {
    title: 'Campaign — Bots Battle',
    description:
      'Battle through 10 progressive pirate campaign levels. Code your fleet and climb to Fleet Admiral.',
  },
  twitter: {
    title: 'Campaign — Bots Battle',
    description:
      'Battle through 10 progressive pirate campaign levels. Code your fleet and climb to Fleet Admiral.',
  },
};

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
