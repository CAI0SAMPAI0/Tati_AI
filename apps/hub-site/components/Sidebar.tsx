'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  BookOpen,
  History,
  HelpCircle,
  Settings,
  LogOut,
  X,
  MessageSquare,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { useHubAuth } from '@/components/auth-provider';

const menuItems = [
  { name: 'Galeria', icon: LayoutGrid, href: '/materiais' },
  { name: 'Meus Materiais', icon: BookOpen, href: '/meus-materiais' },
  { name: 'Pedidos', icon: History, href: '/pedidos' },
];

const secondaryItems = [
  { name: 'Suporte', icon: HelpCircle, href: `https://mail.google.com/mail/?view=cm&fs=1&to=${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}` },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useHubAuth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[70] flex h-screen w-64 flex-col border-r border-line bg-surface shadow-sm transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <Link href="/materiais" onClick={onClose}>
            <BrandMark variant="compact" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-primarySoft hover:text-ink lg:hidden"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 flex-grow space-y-1 px-3">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
            Menu Principal
          </p>
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-hub px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primarySoft text-primary'
                    : 'text-muted hover:bg-bgSecondary hover:text-ink'
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </Link>
            );
          })}

          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
            Utilidades
          </p>
          {secondaryItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-hub px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-bgSecondary hover:text-ink"
            >
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-line p-4">
          {user && (
            <button
              type="button"
              onClick={() => {
                logout();
                onClose?.();
              }}
              className="flex w-full items-center gap-2 rounded-hub px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-danger/10 hover:text-danger"
            >
              <LogOut size={18} />
              Sair da conta
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
