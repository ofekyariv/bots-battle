// ============================================================
// 🏴‍☠️ /docs route layout — metadata + passthrough
// ============================================================
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Learn how to code winning pirate ship AI for Bots Battle. Full API reference, strategy guides, and code examples in JavaScript, TypeScript, Python, Kotlin, Java, C#, and Swift.',
  openGraph: {
    title: 'Documentation — Bots Battle',
    description:
      'Learn how to code winning pirate ship AI for Bots Battle. Full API reference, strategy guides, and examples in 7 languages.',
  },
  twitter: {
    title: 'Documentation — Bots Battle',
    description:
      'Full API reference and strategy guides for Bots Battle. Code examples in 7 languages.',
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
