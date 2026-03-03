import type { ReactNode } from 'react';

interface DocSectionProps {
  id: string;
  children: ReactNode;
}

export function DocSection({ id, children }: DocSectionProps) {
  return (
    <section id={id} className="doc-section">
      {children}
    </section>
  );
}
