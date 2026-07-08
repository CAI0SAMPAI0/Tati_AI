'use client';

import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import HubSidebar from '@/components/catalog/Sidebar';
import HubHeader from '@/components/catalog/HubHeader';

export default function HubShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();

  return (
    <div className="hub-theme flex min-h-screen flex-col bg-surface md:flex-row md:bg-bgSecondary overflow-x-hidden">
      <HubSidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn("flex min-w-0 flex-1 flex-col transition-all duration-300", sidebarOpen ? "md:ml-64" : "md:ml-0")}>
        <HubHeader onToggleMenu={handleToggleSidebar} />
        <main className="mx-auto w-full max-w-7xl flex-1 pb-20">{children}</main>
      </div>
    </div>
  );
}
