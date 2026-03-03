'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import NavLink from './NavLink';
import { ROUTES } from '@/lib/routes';

const NAV_ITEMS = [
  { href: ROUTES.play, label: '⚔️ Play' },
  { href: ROUTES.campaign, label: '⚓ Campaign' },
  { href: ROUTES.tournaments, label: '🏆 Tournaments' },
  { href: ROUTES.editor, label: '✏️ Editor' },
  { href: ROUTES.docs, label: '📜 Docs' },
  { href: ROUTES.replays, label: '🎬 Replays' },
  { href: ROUTES.profile, label: '🧭 Profile' },
] as const;

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Trap focus within the menu when open
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const focusable = menuRef.current.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length > 0) focusable[0].focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !menuRef.current) return;
      const elements = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open]);

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        ref={buttonRef}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-foam hover:text-amber-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/60"
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />

          {/* Menu */}
          <nav
            id="mobile-nav-menu"
            ref={menuRef}
            role="dialog"
            aria-label="Navigation menu"
            aria-modal="true"
            className="absolute top-full right-0 left-0 z-50
              bg-[rgba(10,22,40,0.98)] border-b border-gold/20
              shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md
              flex flex-col py-2"
          >
            {NAV_ITEMS.map(({ href, label }) => (
              <NavLink
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="px-6 py-3 rounded-none text-base w-full"
              >
                {label}
              </NavLink>
            ))}

            {/* CTA */}
            <div className="px-4 pt-2 pb-3 border-t border-gold/15 mt-1">
              <NavLink
                href={ROUTES.campaign}
                onClick={() => setOpen(false)}
                className="w-full text-center px-4 py-2 rounded-md font-bold
                  bg-gold text-navy shadow-[0_2px_8px_rgba(212,168,67,0.35)]
                  hover:text-navy hover:scale-105 transition-all"
              >
                ⚓ Campaign
              </NavLink>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
