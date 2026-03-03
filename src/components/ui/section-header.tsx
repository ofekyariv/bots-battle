import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Alignment of the header text (default: "left") */
  align?: 'left' | 'center' | 'right';
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

/**
 * SectionHeader — reusable title + optional subtitle block.
 * Matches the gold-text heading pattern used across every page.
 */
const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  align = 'left',
  className,
  titleClassName,
  subtitleClassName,
}) => {
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  return (
    <div className={cn('mb-4', alignClass, className)}>
      <h2 className={cn('text-2xl font-bold gold-text font-serif tracking-wide', titleClassName)}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn('mt-1 text-sm text-[var(--foam)]', subtitleClassName)}>{subtitle}</p>
      )}
    </div>
  );
};

SectionHeader.displayName = 'SectionHeader';

export { SectionHeader };
export type { SectionHeaderProps };
