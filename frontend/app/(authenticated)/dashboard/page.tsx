'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Menu,
  Search,
} from 'lucide-react';
import { DashboardSidebar, type DashSection } from '@/components/dashboard/dashboard-sidebar';
import { OverviewSection } from '@/components/dashboard/overview-section';
import { ReportsSection } from '@/components/dashboard/reports-section';
import { ModulesSection } from '@/components/dashboard/modules-section';
import  SimulationsSection  from '@/components/dashboard/simulations-section';
import { FlashcardsSection } from '@/components/dashboard/flashcards-section';
import { PremiumSection } from '@/components/dashboard/premium-section';
import { StudentModal } from '@/components/dashboard/student-modal';
import { apiGet } from '@/lib/api/client';

import { formatDateTime } from '@/lib/utils/index';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Spinner } from '@/components/ui/spinner';

export default function DashboardPage() {
  const router = useRouter();
  const { canAccessDashboard, isLoading: permissionsLoading } = usePermissions();
  const [activeSection, setActiveSection] = useState<DashSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Persistence: Load last section on mount
  useEffect(() => {
    const saved = localStorage.getItem('tati_last_dashboard_tab') as DashSection;
    if (saved && saved !== activeSection) {
      setActiveSection(saved);
    }
  }, []);

  // Persistence: Save section on change
  useEffect(() => {
    localStorage.setItem('tati_last_dashboard_tab', activeSection);
  }, [activeSection]);

  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

  const sectionTitles: Record<string, string> = {
    overview: 'Overview',
    reports: 'Reports',
    students: 'Students',
    modules: 'Modules',
    simulations: 'Simulations',
    flashcards: 'Flashcards',
    submissions: 'Corrections'
  };

  const sectionSubs: Record<string, string> = {
    overview: 'Platform summary',
    reports: 'Overview and class metrics',
    students: 'Student management',
    modules: 'Management of modules and activities',
    simulations: 'Manage real-life conversation simulations',
    flashcards: 'Vocabulary deck management',
    submissions: 'Student answers to review'
  };

  // Fetching data
  const { data: stats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => apiGet<any>('/dashboard/stats'),
  });
  const { data: students } = useQuery<any[]>({
    queryKey: ['admin-dashboard-students'],
    queryFn: () => apiGet<any[]>('/dashboard/students'),
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
        onSetSection={setActiveSection}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary/30 relative h-screen">
        <header className="h-16 border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-surface-hover md:hidden text-text-muted"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-text leading-tight capitalize">
                {activeSection === 'overview' ? 'Overview' : {
                  students: 'Students',
                  reports: 'Reports',
                  submissions: 'Corrections',
                  modules: 'Modules',
                  flashcards: 'Flashcards',
                  simulations: 'Simulations'
                }[activeSection] || activeSection}
              </h1>
              <p className="text-[0.7rem] text-text-muted font-medium uppercase tracking-wider">
                {{
                  overview: 'Platform summary',
                  students: 'Student management',
                  reports: 'Overview and class metrics',
                  submissions: 'Student answers to review',
                  modules: 'Management of modules and activities',
                  flashcards: 'Vocabulary deck management',
                  simulations: 'Manage real-life conversation simulations'
                }[activeSection] || 'Management'}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in overflow-y-auto custom-scrollbar">
          {activeSection === 'overview' && (
            <OverviewSection 
              stats={stats} 
              students={students || []} 
              difficulties={difficulties}
              onSeeAllStudents={() => setActiveSection('students')}
            />
          )}

          {activeSection === 'reports' && <ReportsSection />}
          {activeSection === 'modules' && <ModulesSection />}
          {activeSection === 'simulations' && <SimulationsSection />}
          {activeSection === 'flashcards' && <FlashcardsSection />}
          {activeSection === 'premium' && <PremiumSection />}

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
                              <div className="text-sm font-bold truncate text-text group-hover:text-primary transition-colors">{s.name || s.username}</div>
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
                          {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
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
          // Trigger SWR mutation to refresh student list
        }}
      />
    </div>
  );
}
