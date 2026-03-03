import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max width constraint class (default: "max-w-7xl") */
  maxWidth?: string;
  /** Disable the default horizontal padding */
  noPadding?: boolean;
}

/**
 * PageContainer — standard page wrapper with navy background and consistent padding.
 * Wraps content in a centred, max-width container with the site's base styling.
 */
const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, maxWidth = 'max-w-7xl', noPadding = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('min-h-screen bg-[var(--navy)] text-[var(--white)]', className)}
      {...props}
    >
      <div className={cn('mx-auto', maxWidth, !noPadding && 'px-4 py-8 sm:px-6 lg:px-8')}>
        {children}
      </div>
    </div>
  ),
);
PageContainer.displayName = 'PageContainer';

export { PageContainer };
export type { PageContainerProps };
