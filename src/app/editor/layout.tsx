// ============================================================
// 🏴‍☠️ /editor route layout — wraps with ErrorBoundary
// ============================================================
import type { Metadata } from 'next';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Bot Editor',
  description:
    'Write and test your pirate ship AI in JavaScript, TypeScript, Python, Kotlin, Java, C#, or Swift. Build smart algorithms that outmaneuver your opponents on the high seas.',
  openGraph: {
    title: 'Bot Editor — Bots Battle',
    description:
      'Write and test your pirate ship AI in JavaScript, TypeScript, Python, Kotlin, Java, C#, or Swift. Build smart algorithms that outmaneuver your opponents on the high seas.',
  },
  twitter: {
    title: 'Bot Editor — Bots Battle',
    description:
      'Write and test your pirate ship AI in JavaScript, TypeScript, Python, Kotlin, Java, C#, or Swift.',
  },
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
