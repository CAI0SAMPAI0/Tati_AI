'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import HubHeader from '@/components/HubHeader';

export default function HubLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoginPage) {
    return <main>{children}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row md:bg-bgSecondary">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col md:ml-64">
        <HubHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 pb-20">{children}</main>
      </div>
    </div>
  );
}
