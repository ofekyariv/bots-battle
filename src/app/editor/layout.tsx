// ============================================================
// 🏴‍☠️ /editor route layout — wraps with ErrorBoundary
// ============================================================

import ErrorBoundary from '@/components/ErrorBoundary';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
