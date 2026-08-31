'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Trophy, ChartBar, MessageSquare, X, TrendingUp, Zap, History } from 'lucide-react';
import { Target } from 'lucide-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePrefetch } from '@/hooks/usePrefetch';

interface SidebarActivitiesProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavItem = memo(
  function NavItem({
    href,
    icon,
    label,
    isActive,
    onMouseEnter,
    onClick,
  }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onMouseEnter: () => void;
    onClick: () => void;
  }) {
    return (
      <Link
        href={href}
        prefetch={true}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group',
          isActive
            ? 'bg-primary text-white shadow-glow'
            : 'text-text-muted hover:bg-primary/10 hover:text-primary'
        )}
      >
        <span className={cn(isActive ? 'text-white' : 'text-text-subtle group-hover:text-primary')}>
          {icon}
        </span>
        {label}
      </Link>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.href === nextProps.href &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.label === nextProps.label
    );
  }
);
NavItem.displayName = 'NavItem';

export function SidebarActivities({ isOpen, onClose }: SidebarActivitiesProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { prefetch } = usePrefetch();

  const isHubOnly = (user as any)?.is_hub_only;

  const navItems = isHubOnly
    ? [{ href: '/activities/hub', icon: <Zap size={20} />, label: 'Hub' }]
    : [
        { href: '/activities', icon: <BookOpen size={20} />, label: 'Activities' },
        { href: '/history', icon: <History size={20} />, label: 'History' },
        { href: '/activities/hub', icon: <Zap size={20} />, label: 'Hub' },
        { href: '/progress', icon: <TrendingUp size={20} />, label: 'Progress' },
        { href: '/goals', icon: <Target size={20} />, label: 'Goals' },
        { href: '/achievements', icon: <Trophy size={20} />, label: 'Achievements' },
        { href: '/competitions', icon: <ChartBar size={20} />, label: 'Competitions' },
      ];

  return (
    <>
      {/* Mobile Overlay (no blur) */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 md:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-[280px] bg-bg-secondary border-r border-border z-50 flex flex-col transition-transform duration-300 shadow-2xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-6 shrink-0">
          <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
            Main Menu
          </span>
          <button
            aria-label="Close menu"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href}
              onMouseEnter={() => {
                const route = item.href === '/activities/hub' ? 'hub-catalog' : item.href.replace('/', '');
                prefetch(route || 'chat');
              }}
              onClick={onClose}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Link
            href="/chat"
            prefetch={true}
            onMouseEnter={() => prefetch('chat')}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
          >
            <MessageSquare size={20} />
            {'Back to chat'}
          </Link>
        </div>
      </aside>
    </>
  );
}
