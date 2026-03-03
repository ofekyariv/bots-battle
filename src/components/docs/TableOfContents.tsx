'use client';

import { ROUTES } from '@/lib/routes';

export const TOC_ITEMS = [
  { id: 'quick-start', label: '⚡ Quick Start', depth: 0 },
  { id: 'types', label: '📦 Type Reference', depth: 0 },
  { id: 'type-gamestate', label: 'GameState', depth: 1 },
  { id: 'type-botship', label: 'BotShip', depth: 1 },
  { id: 'type-botisland', label: 'BotIsland', depth: 1 },
  { id: 'type-command', label: 'Command', depth: 1 },
  { id: 'type-gameconfig', label: 'GameConfig', depth: 1 },
  { id: 'helpers', label: '🛠 Helper Functions', depth: 0 },
  { id: 'helper-geometry', label: 'Geometry', depth: 1 },
  { id: 'helper-islands', label: 'Islands', depth: 1 },
  { id: 'helper-ships', label: 'Ships', depth: 1 },
  { id: 'helper-combat', label: 'Combat', depth: 1 },
  { id: 'helper-scoring', label: 'Scoring', depth: 1 },
  { id: 'mechanics', label: '⚙️ Game Mechanics', depth: 0 },
  { id: 'mechanics-combat', label: 'Combat System', depth: 1 },
  { id: 'mechanics-capture', label: 'Island Capture', depth: 1 },
  { id: 'mechanics-scoring', label: 'Exponential Scoring', depth: 1 },
  { id: 'mechanics-safezone', label: 'Safe Zones & Respawn', depth: 1 },
  { id: 'mechanics-tick', label: 'Tick Rate & Timing', depth: 1 },
  { id: 'strategy', label: '🧭 Strategy Tips', depth: 0 },
  { id: 'example-bots', label: '🤖 Example Bots', depth: 0 },
  { id: 'bot-rusher', label: 'Rusher Bot', depth: 1 },
];

interface TableOfContentsProps {
  activeId: string;
}

export function TableOfContents({ activeId }: TableOfContentsProps) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        position: 'sticky',
        top: 64,
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        background: 'var(--navy-light)',
        borderRight: '1px solid #1e3a5f',
        padding: '1.5rem 1rem',
      }}
    >
      <p
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#f5a623',
          fontWeight: 700,
          marginBottom: '0.5rem',
          fontFamily: 'monospace',
        }}
      >
        📜 Contents
      </p>
      <nav>
        {TOC_ITEMS.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`toc-link depth-${item.depth}${activeId === item.id ? ' active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>


    </aside>
  );
}
