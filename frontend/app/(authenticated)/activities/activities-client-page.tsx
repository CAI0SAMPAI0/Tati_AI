'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  HelpCircle,
  Layers,
  Drama,
  Podcast,
  Play,
  FileBox,
  History,
  Search,
  Sparkles,
  FileText,
  Download,
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { ActivityCard } from '@/components/activities/activity-card';
import { fetchWeeklyPlan } from '@/lib/api/weekly-plan';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type TabType = 'quiz' | 'flashcards' | 'simulations' | 'podcasts' | 'exercises' | 'materials';

const PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001';

interface QuizItem {
  id: string;
  title: string;
  description?: string;
  attempts?: number;
  status?: string;
  user_status?: { is_done: boolean; score?: number };
}
interface ModuleItem {
  id: string;
  title: string;
  level?: string;
  levels?: string[];
  quizzes?: QuizItem[];
  flashcards?: Array<{ id: string }>;
  user_status?: { is_done: boolean; score?: number };
}
interface SimulationItem {
  id: string;
  name: string;
  description?: string;
  difficulty?: string;
  icon?: string;
  emoji?: string;
}
interface PodcastItem {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  level?: string;
}
interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  card_count?: number;
  level?: string;
}
interface UserError {
  id: string;
  incorrect_text: string;
  correct_text: string;
  explanation?: string;
  category?: string;
  created_at: string;
}

export default function ActivitiesClientPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('quiz');
  const [searchQuery, setSearchQuery] = useState('');
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [visiblePodcastsCount, setVisiblePodcastsCount] = useState(10);
  const [filterLevel, setFilterLevel] = useState<string>('All');

  const isStaff = user?.role && ['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'Professora', 'Programador', 'admin', 'Admin'].includes(user.role);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tati_last_activity_tab') as TabType;
      if (saved && ['quiz', 'flashcards', 'simulations', 'podcasts', 'exercises', 'materials'].includes(saved)) {
        setActiveTab(saved);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tati_last_activity_tab', activeTab);
  }, [activeTab]);

  const { data: modules = [] } = useQuery<ModuleItem[]>({
    queryKey: ['activities-modules', filterLevel],
    queryFn: () => apiGet<ModuleItem[]>(
      filterLevel === 'All'
        ? ENDPOINTS.ACTIVITIES_MODULES
        : `${ENDPOINTS.ACTIVITIES_MODULES}?level=${filterLevel}`
    ),
    refetchInterval: 10000, // Silently fetch updates every 10 seconds
  });

  const { data: masterModule } = useQuery<any>({
    queryKey: ['activities-master-module'],
    queryFn: () => apiGet<any>('/admin/modules/personalized'),
    refetchInterval: 10000, // Silently fetch updates every 10 seconds
  });

  const { data: simulationsRaw = [] } = useQuery<SimulationItem[]>({
    queryKey: ['activities-simulations'],
    queryFn: () => apiGet<SimulationItem[]>('/simulation/scenarios'),
  });
  const { data: podcastsRaw = [] } = useQuery<PodcastItem[]>({
    queryKey: ['activities-podcasts', filterLevel],
    queryFn: () => apiGet<PodcastItem[]>(
      filterLevel === 'All'
        ? '/activities/podcasts/recommendations?lang=en-US'
        : `/activities/podcasts/recommendations?lang=en-US&level=${filterLevel}`
    ),
  });
  const { data: flashcardsRaw = [] } = useQuery<FlashcardDeck[]>({
    queryKey: ['activities-flashcards'],
    queryFn: () => apiGet<FlashcardDeck[]>('/activities/flashcards/my'),
  });
  const { data: podcastProgress } = useQuery({
    queryKey: ['activities-podcasts-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/activities/podcasts/progress'),
  });
  const { data: simulationProgress } = useQuery({
    queryKey: ['activities-simulations-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/simulation/progress'),
  });
  const { data: userErrors = [] } = useQuery<UserError[]>({
    queryKey: ['activities-user-errors'],
    queryFn: () => apiGet<UserError[]>('/users/progress/errors/recent'),
  });

  const { data: userProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => apiGet<any>('/profile'),
    refetchInterval: 10000, // Silently fetch profile updates every 10 seconds to keep study materials fresh
  });

  useQuery({
    queryKey: ['weekly-plan-v2'],
    queryFn: fetchWeeklyPlan,
    staleTime: 5 * 60 * 1000,
  });

  const studyMaterials = useMemo(() => {
    const mats = userProfile?.profile?.study_materials || [];
    if (!searchQuery) return mats;
    return mats.filter((m: any) => m.filename.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [userProfile, searchQuery]);

  const quizzes = useMemo(() => {
    if (!modules) return [];
    const list: Array<QuizItem & { module_title: string; is_published?: boolean; level?: string }> = [];
    modules.forEach((m) => {
      if (m.id === PERSONALIZED_MODULE_ID) return;
      (m.quizzes || []).forEach((q) => {
        if (
          !searchQuery ||
          q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.title.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          list.push({
            ...q,
            module_title: m.title,
            user_status: m.user_status,
            is_published: (m as any).is_published,
            level: m.level,
          });
        }
      });
    });

    if (masterModule && masterModule.quizzes) {
      masterModule.quizzes.forEach((q: any) => {
        if (q.id && q.id.startsWith('cefr_')) {
          if (!searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            list.push({
              ...q,
              module_title: 'CEFR Exercises',
              user_status: { is_done: q.status === 'done', score: q.score },
            });
          }
        } else {
          if (!searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            list.push({
              ...q,
              module_title: 'Personalized Practice',
              user_status: { is_done: q.status === 'completed' || q.status === 'done', score: q.score },
              is_published: true,
              level: 'All',
            });
          }
        }
      });
    }

    return list;
  }, [modules, masterModule, searchQuery]);

  const exercises = useMemo(() => {
    if (!masterModule || !masterModule.quizzes) return [];
    return masterModule.quizzes.filter(
      (q: any) => q.id && !q.id.startsWith('cefr_') && (!searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [masterModule, searchQuery]);

  const flashcards = useMemo(() => {
    if (!flashcardsRaw) return [];
    const filtered = flashcardsRaw.filter(
      (f) => f.title !== 'Vocabulary Review' && f.title !== 'Revisão de Vocabulário',
    );
    if (!searchQuery) return filtered;
    return filtered.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flashcardsRaw, searchQuery]);

  const simulations = useMemo(() => {
    if (!simulationsRaw) return [];
    let filtered = simulationsRaw;
    if (!searchQuery) return filtered;
    return filtered.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [simulationsRaw, searchQuery]);

  const podcasts = useMemo(() => {
    if (!podcastsRaw) return [];
    let filtered = podcastsRaw;
    if (!searchQuery) return filtered;
    return filtered.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [podcastsRaw, searchQuery]);

  const tabs: Array<{ id: TabType; icon: React.ReactNode; label: string; count?: number }> = [
    { id: 'quiz', icon: <HelpCircle size={18} />, label: 'Quizzes', count: quizzes.length },
    { id: 'exercises', icon: <Sparkles size={18} />, label: 'AI Exercises', count: exercises.length },
    { id: 'flashcards', icon: <Layers size={18} />, label: 'Flashcards', count: flashcards.length },
    { id: 'simulations', icon: <Drama size={18} />, label: 'Simulations', count: simulations.length },
    { id: 'podcasts', icon: <Podcast size={18} />, label: 'Podcasts', count: podcasts.length },
    { id: 'materials', icon: <FileBox size={18} />, label: 'Study Materials', count: studyMaterials.length },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">My Activities</h1>
              <p className="text-text-muted text-sm md:text-base max-w-2xl">
                Practice vocabulary, grammar and pronunciation. Earn points in the ranking!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
              {isStaff && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-subtle uppercase tracking-wider whitespace-nowrap">Filter by Level:</span>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="px-3 py-2 bg-surface border border-border rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer text-text"
                  >
                    <option value="All">All Levels</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>
              )}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" size={18} />
                <input
                  type="text"
                  placeholder="Search activity..."
                  className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </header>

          <nav className="flex flex-col sm:flex-row flex-wrap gap-2 sm:overflow-x-auto pb-1 mb-8 scrollbar-none border-b border-border bg-bg z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-5 py-3 rounded-xl sm:rounded-t-xl sm:rounded-b-none text-sm font-bold transition-all whitespace-nowrap w-full sm:w-auto',
                  activeTab === tab.id
                    ? 'bg-surface border border-border sm:border-b-bg text-primary'
                    : 'text-text-muted hover:text-text border border-transparent',
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-primary/10 text-primary text-[0.65rem] px-1.5 py-0.5 rounded-full font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="min-h-[400px]">
            {activeTab === 'quiz' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.length > 0 ? (
                  quizzes.map((q: any) => (
                    <ActivityCard
                      key={q.id}
                      title={q.title}
                      description={q.description || 'Practice your knowledge.'}
                      type="quiz"
                      status={q.user_status?.is_done ? 'done' : 'new'}
                      score={q.user_status?.score}
                      onClick={() => router.push(`/quiz/${q.id}`)}
                      meta={[
                        {
                          icon: <Layers size={14} />,
                          label: q.level || 'all',
                        },
                        isStaff && {
                          icon: <Play size={14} />,
                          label: q.is_published ? 'Published' : 'Draft',
                        }
                      ].filter(Boolean) as any}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    No quizzes available.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'exercises' && (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exercises.length > 0 ? (
                    exercises.map((q: any) => (
                      <ActivityCard
                        key={q.id}
                        title={q.title}
                        description={q.description || 'Personalized practice based on your mistakes.'}
                        type="quiz"
                        status={q.status === 'done' ? 'done' : 'new'}
                        onClick={() => router.push(`/quiz/${q.id}`)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30 px-8">
                      <Sparkles size={40} className="mx-auto mb-4 opacity-20" />
                      <p className="max-w-md mx-auto">
                        No exercises generated yet. Keep chatting with Tati so she can identify areas for improvement!
                      </p>
                    </div>
                  )}
                </div>

                {userErrors.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h4 className="text-lg font-bold flex items-center gap-2 mb-6">
                      <History size={20} className="text-primary" />
                      Your recent mistakes
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userErrors.slice(0, 10).map((err) => (
                        <div
                          key={err.id}
                          className="bg-surface border border-border p-5 rounded-2xl space-y-3 hover:border-primary/20 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-[0.65rem] font-bold text-danger uppercase tracking-wider">Mistake</p>
                              <p className="text-sm font-medium line-through opacity-50 italic">
                                &quot;{err.incorrect_text}&quot;
                              </p>
                            </div>
                            <span className="bg-primary/10 text-primary text-[0.6rem] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                              {err.category || 'grammar'}
                            </span>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[0.65rem] font-bold text-success uppercase tracking-wider">
                              The correct form is:
                            </p>
                            <p className="text-sm font-bold text-text">&quot;{err.correct_text}&quot;</p>
                          </div>
                          {err.explanation && (
                            <p className="text-[0.7rem] text-text-muted bg-bg-secondary/50 p-2 rounded-lg italic">
                              {err.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'podcasts' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {podcasts.length > 0 ? (
                    podcasts.slice(0, visiblePodcastsCount).map((p) => (
                      <ActivityCard
                        key={p.id}
                        title={p.title}
                        description={p.description || 'Get ready to listen and practice.'}
                        imageUrl={p.thumbnail}
                        type="podcast"
                        status={podcastProgress?.completed?.includes(p.id) ? 'done' : 'new'}
                        onClick={() => router.push(`/podcasts/${p.id}`)}
                        actionLabel="Play"
                        meta={[
                          {
                            icon: <Layers size={14} />,
                            label: p.level || 'all',
                          }
                        ]}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                      No podcasts available.
                    </div>
                  )}
                </div>
                {visiblePodcastsCount < podcasts.length && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setVisiblePodcastsCount(prev => prev + 10)}
                      className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border text-text font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
                    >
                      Show More
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'flashcards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {flashcards.length > 0 ? (
                  flashcards.map((f) => (
                    <ActivityCard
                      key={f.id}
                      title={f.title}
                      description={f.description || 'Your vocabulary flashcards.'}
                      type="flashcard"
                      onClick={() => router.push(`/flashcards/${f.id}`)}
                      meta={[{ icon: <FileBox size={14} />, label: `${f.card_count} cards` }]}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    <Layers size={40} className="mx-auto mb-4 opacity-20" />
                    <p>No flashcards available.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'simulations' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {simulations.length > 0 ? (
                  simulations.map((s) => (
                    <ActivityCard
                      key={s.id}
                      title={s.name}
                      emoji={s.emoji || s.icon}
                      description={
                        s.description || 'Choose a scenario and practice English in everyday situations'
                      }
                      type="simulation"
                      status={simulationProgress?.completed?.includes(s.id) ? 'done' : 'pending'}
                      onClick={() => router.push(`/voice?simulation_id=${s.id}`)}
                      meta={[{ icon: <Play size={14} />, label: s.difficulty || 'normal' }]}
                    />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    No simulations available.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'materials' && (
              <div className="space-y-6">
                {studyMaterials.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {studyMaterials.map((mat: any, idx: number) => {
                      const isPdf = mat.filename.toLowerCase().endsWith('.pdf');
                      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(mat.filename);
                      const dateStr = mat.date_received 
                        ? new Date(mat.date_received).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : '';
                        
                      return (
                        <div 
                          key={idx}
                          className="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between hover:border-primary/45 hover:shadow-md transition-all hover:-translate-y-0.5"
                        >
                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                                isPdf ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                isImage ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                "bg-primary/10 text-primary border-primary/20"
                              )}>
                                <FileText size={24} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-text truncate" title={mat.filename}>
                                  {mat.filename}
                                </h4>
                                <p className="text-[0.7rem] text-text-muted mt-0.5">
                                  Received on {dateStr}
                                </p>
                              </div>
                            </div>

                            {mat.message && (
                              <div className="bg-bg-secondary/40 border-l-4 border-primary rounded-r-xl p-3.5 text-xs text-text-muted italic space-y-1">
                                <span className="font-bold text-[0.65rem] text-primary uppercase tracking-wider block">Message from Teacher Tati:</span>
                                <span>&ldquo;{mat.message}&rdquo;</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-5 flex gap-2">
                            <a 
                              href={mat.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
                            >
                              <Download size={14} />
                              Download / Open File
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    <FileBox size={40} className="mx-auto mb-4 opacity-20" />
                    <p>No study materials available yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
