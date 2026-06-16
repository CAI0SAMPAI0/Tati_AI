'use client';

import Link from 'next/link';
import { Menu, Bell, ChevronDown, BookOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getInitials } from '@/lib/catalog';

type HubHeaderProps = {
  onToggleMenu?: () => void;
};

export default function HubHeader({ onToggleMenu }: HubHeaderProps) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.name ?? user?.username ?? 'Aluno';

  return (
    <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-line bg-bg px-4 md:px-6">
      <div className="flex items-center gap-3">
        {onToggleMenu && (
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-md p-2 text-muted hover:bg-bgSecondary md:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
        )}
        <Link href="/activities/hub" className="font-display text-lg font-bold tracking-tight">
          Teacher <span className="text-primary">Tati</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <span className="hidden rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-primary sm:inline">
          Beta
        </span>

        <button
          type="button"
          className="hidden rounded-lg p-2 text-muted transition hover:bg-bgSecondary sm:block"
          aria-label="Notificações"
        >
          <Bell size={20} />
        </button>

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-hub border border-line bg-surface px-2 py-1.5 transition hover:border-primary md:px-3"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {getInitials(displayName)}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-semibold text-ink md:block">
                {displayName.split(' ')[0]}
              </span>
              <ChevronDown size={16} className="text-muted" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-52 overflow-hidden rounded-hub border border-line bg-surface py-1 shadow-card"
              >
                <p className="border-b border-line px-4 py-2 text-xs text-muted">{user.email}</p>
                <Link
                  href="/activities/hub/meus-materiais"
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-primarySoft"
                  onClick={() => setMenuOpen(false)}
                >
                  <BookOpen size={16} />
                  Meus materiais
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
