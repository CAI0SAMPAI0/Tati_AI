'use client';

import { useState } from 'react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { PodcastList } from '@/components/podcasts/podcast-list';


export default function PodcastsClientPage() {
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            <header>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">
                Recommended Podcasts
              </h1>
              <p className="text-text-muted text-sm md:text-base max-w-2xl">
                Improve listening and pronunciation with content for your level.
              </p>
            </header>

            <PodcastList />
          </div>
        </main>
      </div>
    </div>
  );
}
