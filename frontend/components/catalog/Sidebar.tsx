'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutGrid,
  BookOpen,
  History,
  HelpCircle,
  MessageSquare,
  X,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const menuItems = [
  { name: 'Gallery', icon: LayoutGrid, href: '/activities/hub' },
  { name: 'My Materials', icon: BookOpen, href: '/activities/hub/meus-materiais' },
  { name: 'Orders', icon: History, href: '/activities/hub/pedidos' },
];

const secondaryItems = [
  { name: 'Support', icon: HelpCircle, href: 'mailto:caio.matos@aedb.br' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function HubSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-[70] flex h-screen w-64 flex-col border-r border-line bg-surface shadow-sm transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <Link href="/activities/hub" onClick={onClose}>
            <BrandMark variant="compact" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-primarySoft hover:text-ink md:hidden"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 flex-grow space-y-1 px-3">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
            Main Menu
          </p>
          {menuItems.map((item) => {
            const isActive =
              item.href === '/activities/hub'
                ? pathname === '/activities/hub' ||
                  (pathname.startsWith('/activities/hub/') &&
                    !pathname.startsWith('/activities/hub/meus-materiais') &&
                    !pathname.startsWith('/activities/hub/pedidos'))
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
            Utilities
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
          <Link
            href="/activities"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-hub bg-primary/10 py-3 text-sm font-bold text-primary transition hover:bg-primary/20"
          >
            <MessageSquare size={18} />
            Back to Tati AI
          </Link>
        </div>
      </aside>
    </>
  );
}