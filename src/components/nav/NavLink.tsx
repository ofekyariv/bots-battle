'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Extra classes applied only when the link is active */
  activeClassName?: string;
  onClick?: () => void;
}

export default function NavLink({
  href,
  children,
  className,
  activeClassName = 'text-amber-300',
  onClick,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'nav-link inline-flex items-center gap-1 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors hover:text-amber-300',
        isActive ? activeClassName + ' text-amber-300' : 'text-foam',
        className,
      )}
    >
      {children}
    </Link>
  );
}
