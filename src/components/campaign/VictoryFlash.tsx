// ============================================================
// 🎉 VictoryFlash — Full-screen victory celebration overlay
// ============================================================
'use client';

import { useEffect } from 'react';

interface VictoryFlashProps {
  message: string;
  onDismiss: () => void;
}

export function VictoryFlash({ message, onDismiss }: VictoryFlashProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/50 backdrop-blur-sm">
      <div className="pointer-events-auto px-10 py-8 rounded-2xl text-center flex flex-col items-center gap-3 bg-[#0a1628] border-2 border-gold shadow-[0_0_60px_rgba(212,168,67,0.4),0_24px_64px_rgba(0,0,0,0.8)]">
        <div className="text-5xl animate-bounce">🎉</div>
        <div className="text-2xl font-black text-gold">{message}</div>
        <button
          onClick={onDismiss}
          className="mt-2 px-6 py-2 rounded-lg font-bold text-sm bg-gold text-[#0c1524]"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
