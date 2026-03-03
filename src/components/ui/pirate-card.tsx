import * as React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Re-export standard card sub-components for convenience
export { CardHeader, CardContent, CardFooter, CardTitle, CardDescription };

interface PirateCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  /** Apply a more intense gold glow (default: false) */
  glow?: boolean;
}

/**
 * PirateCard — a Card variant with the pirate-border treatment:
 * gold border + inner shadow. Drop-in replacement for Card.
 */
const PirateCard = React.forwardRef<React.ElementRef<typeof Card>, PirateCardProps>(
  ({ className, glow = false, ...props }, ref) => (
    <Card
      ref={ref}
      className={cn(
        'pirate-border bg-[var(--navy-card)] text-[var(--white)]',
        glow && 'shadow-[0_0_24px_rgba(212,168,67,0.25)]',
        className,
      )}
      {...props}
    />
  ),
);
PirateCard.displayName = 'PirateCard';

export { PirateCard };
