'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  PieChart,
  Users,
  LineChart,
  BookOpen,
  Layers,
  Drama,
  MessageSquare,
  Settings,
  X,
  Zap,
  GraduationCap
} from 'lucide-react';

import { cn } from '@/lib/utils';

export type DashSection = 'overview' | 'students' | 'reports' | 'modules' | 'flashcards' | 'simulations' | 'premium' | 'cefr';

interface DashboardSidebarProps {
  activeSection: DashSection;
  onSetSection: (section: DashSection) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ activeSection, onSetSection, isOpen, onClose }: DashboardSidebarProps) {
  const navItems: Array<{ id: DashSection; icon: React.ReactNode; label: string }> = [
    { id: 'overview', icon: <PieChart size={20} />, label: 'Overview' },
    { id: 'students', icon: <Users size={20} />, label: 'Students' },
    { id: 'reports', icon: <LineChart size={20} />, label: 'Reports' },
    { id: 'modules', icon: <BookOpen size={20} />, label: 'Modules' },
    { id: 'flashcards', icon: <Layers size={20} />, label: 'Flashcards' },
    { id: 'simulations', icon: <Drama size={20} />, label: 'Simulations' },
    { id: 'cefr', icon: <BookOpen size={20} />, label: 'CEFR Materials' },
    { id: 'premium', icon: <Zap size={20} />, label: 'Premium Hub' },
  ];

  return (
    <>
      {/* Overlay para mobile */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity md:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          // Mobile: comportamento atual com slide
          'fixed inset-y-0 left-0 z-[70] w-[280px]',
          // Desktop: sticky no topo com altura da viewport
          'md:sticky md:top-0 md:z-auto',
          // Estilos visuais
          'bg-bg-secondary border-r border-border flex flex-col h-screen shrink-0',
          // Transições mobile
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0'
        )}
      >
        <div className="p-6 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center text-primary shrink-0 border border-primary/10">
              <Image
                src="/images/tati_logo.jpg"
                alt="Tati AI"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none' }} className="w-full h-full items-center justify-center bg-primary text-white">
                <GraduationCap size={16} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-display text-[0.9rem] font-bold tracking-tight text-text truncate">Teacher Tati</div>
              <div className="text-[0.65rem] font-bold text-primary uppercase tracking-widest leading-none">Dashboard</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSetSection(item.id); onClose(); }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group',
                activeSection === item.id
                  ? 'bg-primary text-white shadow-glow'
                  : 'text-text-muted hover:bg-primary/10 hover:text-primary'
              )}
            >
              <span className={cn(activeSection === item.id ? 'text-white' : 'text-text-subtle group-hover:text-primary')}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>


        <div className="p-4 border-t border-border space-y-2 shrink-0">
          <Link
            href="/chat"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
          >
            <MessageSquare size={20} />
            {'Go to Chat'}
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text-muted hover:bg-bg-secondary transition-all"
          >
            <Settings size={20} />
            {'Settings'}
          </Link>
        </div>
      </aside>
    </>
  );
}