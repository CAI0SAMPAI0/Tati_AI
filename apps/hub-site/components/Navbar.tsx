'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShoppingCart, Search, Bell, Menu, ChevronDown, LogOut, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useHubAuth } from '@/components/auth-provider';
import { getInitials } from '@/lib/catalog';
import BrandMark from '@/components/BrandMark';

export default function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, isLoaded, logout } = useHubAuth();
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

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-20 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-md md:px-8 lg:left-64">
      <div className="flex items-center gap-4 lg:hidden">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-muted hover:bg-primarySoft hover:text-ink"
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>
        <BrandMark variant="compact" />
      </div>

      <div className="relative mx-4 hidden max-w-xl flex-grow md:flex">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle"
          size={18}
          aria-hidden
        />
        <input
          placeholder="Buscar materiais..."
          className="input-hub w-full pl-11"
          aria-label="Buscar materiais"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-4">
        <button
          type="button"
          className="relative rounded-lg p-2 text-muted transition hover:bg-primarySoft hover:text-primary"
          aria-label="Carrinho"
        >
          <ShoppingCart size={22} />
          <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
            0
          </span>
        </button>

        <button
          type="button"
          className="hidden rounded-lg p-2 text-muted transition hover:bg-primarySoft hover:text-ink sm:block"
          aria-label="Notificações"
        >
          <Bell size={22} />
        </button>

        <span className="hidden h-8 w-px bg-line sm:block" aria-hidden />

        {!isLoaded ? (
          <div className="h-10 w-24 animate-pulse rounded-hub bg-bgSecondary" />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-hub border border-line bg-surface px-2 py-1.5 transition hover:border-primary md:px-3"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {getInitials(user.name)}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-semibold text-ink md:block">
                {user.name.split(' ')[0]}
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
                  href="/meus-materiais"
                  role="menuitem"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-primarySoft"
                  onClick={() => setMenuOpen(false)}
                >
                  <BookOpen size={16} />
                  Meus materiais
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/login" className="btn-primary px-4 py-2 text-sm">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
