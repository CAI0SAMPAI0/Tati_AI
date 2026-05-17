'use client';

import { useState } from 'react';
import HubSidebar from '@/components/catalog/Sidebar';
import HubHeader from '@/components/catalog/HubHeader';

export default function HubShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="hub-theme flex min-h-screen flex-col bg-surface md:flex-row md:bg-bgSecondary">
      <HubSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col md:ml-64">
        <HubHeader onToggleMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-7xl flex-1 pb-20">{children}</main>
      </div>
    </div>
  );
}
