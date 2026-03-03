// ============================================================
// 🏴‍☠️ ApiDocs — Bot API documentation display component
// ============================================================

'use client';

export default function ApiDocs() {
  return (
    <div className="rounded-lg p-6 font-mono text-sm bg-[#111827] border border-amber-600 text-slate-200">
      <h2 className="text-2xl font-bold mb-4 text-[#f5a623]">📜 Bot API Reference</h2>
      <p className="mb-4 text-slate-400">
        Export a <code className="text-amber-400">createBot()</code> function that returns an object
        with a <code className="text-amber-400">tick(state, ship)</code> method.
      </p>

      <pre className="rounded p-4 text-xs overflow-auto bg-[#050a14] text-[#86efac] border border-ocean">{`function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };
      return { type: 'move', target: { x: 500, y: 500 } };
    }
  };
}`}</pre>

      <div className="mt-6 space-y-3 text-slate-400">
        <p>
          <strong className="text-amber-400">state.myShips</strong> — your ships (Ship[])
        </p>
        <p>
          <strong className="text-amber-400">state.enemyShips</strong> — enemy ships (Ship[])
        </p>
        <p>
          <strong className="text-amber-400">state.islands</strong> — all islands (Island[])
        </p>
        <p>
          <strong className="text-amber-400">state.myScore / state.enemyScore</strong> — current
          scores
        </p>
      </div>

      <p className="mt-6 text-xs text-slate-600">
        Full documentation coming soon. In the meantime, read SYSTEM.md for the full spec.
      </p>
    </div>
  );
}
