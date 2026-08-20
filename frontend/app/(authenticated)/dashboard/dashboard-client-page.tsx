'use client';

import { useState, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Menu,
  Search,
} from 'lucide-react';
import { DashboardSidebar, type DashSection } from '@/components/dashboard/dashboard-sidebar';
import { cn } from '@/lib/utils';
import { useSidebarState } from '@/hooks/useSidebarState';

import dynamic from 'next/dynamic';

const OverviewSection = dynamic(() => import('@/components/dashboard/overview-section').then(mod => mod.OverviewSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const ReportsSection = dynamic(() => import('@/components/dashboard/reports-section').then(mod => mod.ReportsSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const SimulationsSection = dynamic(() => import('@/components/dashboard/simulations-section'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const FlashcardsSection = dynamic(() => import('@/components/dashboard/flashcards-section').then(mod => mod.FlashcardsSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const PremiumSection = dynamic(() => import('@/components/dashboard/premium-section').then(mod => mod.PremiumSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const CefrSection = dynamic(() => import('@/components/dashboard/cefr-section').then(mod => mod.CefrSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const WhatsappSection = dynamic(() => import('@/components/dashboard/whatsapp-section').then(mod => mod.WhatsappSection), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const GamesSection = dynamic(() => import('@/components/dashboard/games-section'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
const NewsSection = dynamic(() => import('@/components/dashboard/news-section'), {
  loading: () => <div className="h-48 flex items-center justify-center"><Spinner size="md" /></div>
});
import { StudentModal } from '@/components/dashboard/student-modal';
import { apiGet } from '@/lib/api/client';

import { formatDateTime, formatDate } from '@/lib/utils/index';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Spinner } from '@/components/ui/spinner';

import { useSearchParams } from 'next/navigation';

export default function DashboardClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccessDashboard, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  
  // Get tab from URL or localStorage
  const getInitialTab = (): DashSection => {
    const tabParam = searchParams.get('tab') as DashSection;
    if (tabParam && ['overview', 'students', 'reports', 'flashcards', 'simulations', 'games', 'news', 'premium', 'cefr', 'whatsapp'].includes(tabParam)) {
      return tabParam;
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tati_last_dashboard_tab') as DashSection;
      if (saved && ['overview', 'students', 'reports', 'flashcards', 'simulations', 'games', 'news', 'premium', 'cefr', 'whatsapp'].includes(saved)) {
        return saved;
      }
    }
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState<DashSection>(getInitialTab());
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [searchQuery, setSearchQuery] = useState('');

  // Update URL and storage when section changes
  const handleSetSection = (section: DashSection) => {
    setActiveSection(section);
    localStorage.setItem('tati_last_dashboard_tab', section);
    
    // Update URL without full page reload and without triggering Next.js server fetch
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', section);
    window.history.pushState(null, '', `/dashboard?${params.toString()}`);
  };

  // Sync tab if URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as DashSection;
    if (tabParam && tabParam !== activeSection) {
      setActiveSection(tabParam);
    }
  }, [searchParams]);

  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  // Fetching data
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => apiGet<any>('/dashboard/stats'),
  });
  const { data: students } = useQuery<any[]>({
    queryKey: ['admin-dashboard-students'],
    queryFn: () => apiGet<any[]>('/dashboard/students'),
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
    refetchIntervalInBackground: false, // Pausa polling quando a aba está em background
  });
  const { data: difficulties } = useQuery<any>({
    queryKey: ['admin-dashboard-difficulties'],
    queryFn: () => apiGet<any>('/dashboard/difficulties'),
  });

  useEffect(() => {
    if (!permissionsLoading && !canAccessDashboard) {
      router.replace('/chat');
    }
  }, [permissionsLoading, canAccessDashboard, router]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.username || '').toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!canAccessDashboard) return null;

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <DashboardSidebar 
        activeSection={activeSection} 
        onSetSection={handleSetSection}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      <div className={cn("flex-1 flex flex-col min-w-0 bg-bg-secondary/30 relative h-screen transition-all duration-300", sidebarOpen ? "md:pl-[280px]" : "md:pl-0")}>
        <header className="h-16 border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleToggleSidebar}
              className="p-2 rounded-md hover:bg-surface-hover text-text-muted"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-text leading-tight capitalize">
                {activeSection === 'overview' ? 'Overview' : {
                  students: 'Students',
                  reports: 'Reports',
                  submissions: 'Corrections',
                  flashcards: 'Flashcards',
                  simulations: 'Simulations',
                  games: 'Games',
                  news: 'News',
                  cefr: 'CEFR Materials',
                  premium: 'Premium Hub',
                  whatsapp: 'WhatsApp Connection'
                }[activeSection] || activeSection}
              </h1>
              <p className="text-[0.7rem] text-text-muted font-medium uppercase tracking-wider">
                {{
                  overview: 'Platform summary',
                  students: 'Student management',
                  reports: 'Overview and class metrics',
                  submissions: 'Student answers to review',
                  flashcards: 'Study decks',
                  simulations: 'Real-world scenarios',
                  games: 'WordWall games for students',
                  news: 'News, reels and links for students',
                  cefr: 'Diagnose and generate from PDFs',
                  premium: 'Premium materials & payments',
                  whatsapp: 'Connect and manage WhatsApp WAHA sessions'
                }[activeSection]}
              </p>

            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
          {activeSection === 'overview' && (
            <>
              <OverviewSection 
                stats={stats} 
                students={students || []} 
                difficulties={difficulties}
                onSeeAllStudents={() => setActiveSection('students')}
              />
            </>
          )}

          {activeSection === 'reports' && <ReportsSection />}
          {activeSection === 'simulations' && <SimulationsSection />}
          {activeSection === 'games' && <GamesSection />}
          {activeSection === 'news' && <NewsSection />}
          {activeSection === 'flashcards' && <FlashcardsSection />}
          {activeSection === 'cefr' && <CefrSection />}
          {activeSection === 'premium' && <PremiumSection />}
          {activeSection === 'whatsapp' && <WhatsappSection />}

          {activeSection === 'students' && (
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-bold text-text">{'All Students'}</h3>
                <div className="relative max-w-md w-full">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
                  <input 
                    type="text"
                    placeholder={'Search student...'}
                    className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-bg-secondary/50 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-3">{'Student'}</th>
                      <th className="px-5 py-3">{'Level'}</th>
                      <th className="px-5 py-3">{'Focus'}</th>
                      <th className="px-5 py-3">{'Last active'}</th>
                      <th className="px-5 py-3">{'Msgs'}</th>
                      <th className="px-5 py-3">{'Joined'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((s) => (
                      <tr 
                        key={s.username} 
                        onClick={() => { setSelectedStudent(s); setIsStudentModalOpen(true); }}
                        className="hover:bg-bg-secondary/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : (s.name || s.username || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="text-sm font-bold truncate text-text group-hover:text-primary transition-colors">{s.name || s.username}</span>
                                {s.risk_level === 'critical' && (
                                  <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger text-[0.6rem] font-bold animate-pulse">Critical</span>
                                )}
                                {s.risk_level === 'warning' && (
                                  <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[0.6rem] font-bold">At Risk</span>
                                )}
                                {s.current_streak > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[0.6rem] font-bold" title={`${s.current_streak} days streak`}>🔥 {s.current_streak}</span>
                                )}
                                {s.streak_freeze_count > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-info/10 text-info text-[0.6rem] font-bold" title={`${s.streak_freeze_count} freezes remaining`}>❄️ {s.streak_freeze_count}</span>
                                )}
                              </div>
                              <div className="text-[0.7rem] text-text-muted truncate">@{s.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-subtle uppercase tracking-wider">
                            {s.level || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-text-muted italic max-w-[200px] truncate">
                          {s.focus || '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-text-muted">{formatDateTime(s.last_active)}</td>
                        <td className="px-5 py-3 text-sm font-bold text-text-subtle">
                          {s.total_messages ?? 0}
                        </td>
                        <td className="px-5 py-3 text-xs text-text-subtle">
                          {formatDate(s.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      <StudentModal 
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        student={selectedStudent}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-dashboard-students'] });
        }}
      />
    </div>
  );
}
