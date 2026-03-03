import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonProps = React.ComponentPropsWithoutRef<typeof Button>;

interface GoldButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Show a subtle glow ring on hover (default: true) */
  glow?: boolean;
}

/**
 * GoldButton — gold-gradient CTA button.
 * Replaces the repeated inline `style={{ background: 'var(--gold)', color: 'var(--navy)' }}` pattern.
 */
const GoldButton = React.forwardRef<React.ElementRef<typeof Button>, GoldButtonProps>(
  ({ className, glow = true, style, ...props }, ref) => (
    <Button
      ref={ref}
      variant="default"
      className={cn(
        'font-bold text-[var(--navy)] transition-all duration-200',
        'hover:brightness-110 active:scale-95',
        glow && 'hover:shadow-[0_0_12px_rgba(212,168,67,0.5)]',
        className,
      )}
      style={{
        background: 'linear-gradient(135deg, var(--gold-light), var(--gold), var(--gold-dark))',
        color: 'var(--navy)',
        ...style,
      }}
      {...props}
    />
  ),
);
GoldButton.displayName = 'GoldButton';

export { GoldButton };
export type { GoldButtonProps };
