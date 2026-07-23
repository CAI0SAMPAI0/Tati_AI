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
  Search,
  BookOpen,
  Lightbulb,
  GraduationCap,
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
import { normalizeLevel } from '@/lib/constants/levels';

type TabType = 'quiz' | 'flashcards' | 'simulations' | 'podcasts' | 'grammar' | 'materials';

const PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001';

interface QuizItem {
  id: string;
  title: string;
  description?: string;
  attempts?: number;
  status?: string;
  level?: string;
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
interface GrammarTopicIndex {
  topic: string;
  level: string;
  title: string;
  source_name: string;
  source_url: string;
}
interface GrammarDetail {
  topic: string;
  level: string;
  title: string;
  rule_summary: string;
  key_structure: string;
  tip_teacher_tati: string;
  sources: Array<{ name: string; url: string }>;
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
      if (saved && ['quiz', 'flashcards', 'simulations', 'podcasts', 'grammar', 'materials'].includes(saved)) {
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
    queryKey: ['activities-simulations', filterLevel],
    queryFn: () => apiGet<SimulationItem[]>(
      filterLevel === 'All'
        ? '/simulation/scenarios'
        : `/simulation/scenarios?level=${filterLevel}`
    ),
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
    queryKey: ['activities-flashcards', filterLevel],
    queryFn: () => apiGet<FlashcardDeck[]>(
      filterLevel === 'All'
        ? '/activities/flashcards/my'
        : `/activities/flashcards/my?level=${filterLevel}`
    ),
  });
  const { data: podcastProgress } = useQuery({
    queryKey: ['activities-podcasts-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/activities/podcasts/progress'),
  });
  const { data: simulationProgress } = useQuery({
    queryKey: ['activities-simulations-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/simulation/progress'),
  });
  const { data: grammarIndex } = useQuery<{ topics: GrammarTopicIndex[]; sources: Array<{ name: string; url: string }> }>({
    queryKey: ['grammar-index', filterLevel],
    queryFn: () => apiGet<{ topics: GrammarTopicIndex[]; sources: Array<{ name: string; url: string }> }>(
      filterLevel === 'All'
        ? ENDPOINTS.GRAMMAR
        : `${ENDPOINTS.GRAMMAR}?level=${filterLevel}`
    ),
    staleTime: 30 * 60 * 1000,
  });
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState<string | null>(null);
  const { data: grammarDetail } = useQuery<GrammarDetail>({
    queryKey: ['grammar-detail', selectedGrammarTopic],
    queryFn: () => apiGet<GrammarDetail>(`${ENDPOINTS.GRAMMAR}?topic=${selectedGrammarTopic}`),
    enabled: !!selectedGrammarTopic,
    staleTime: 30 * 60 * 1000,
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
    const targetLevel = filterLevel === 'All' ? null : normalizeLevel(filterLevel);
    modules.forEach((m) => {
      if (m.id === PERSONALIZED_MODULE_ID) return;
      (m.quizzes || []).forEach((q) => {
        if (
          !searchQuery ||
          q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.title.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          // Resolve nível do quiz: próprio ou do módulo
          const quizLevel = q.level || m.level;
          if (targetLevel && quizLevel) {
            const quizLevelNorm = normalizeLevel(quizLevel);
            if (quizLevelNorm !== targetLevel && quizLevel.toLowerCase() !== 'all') {
              return;
            }
          }
          list.push({
            ...q,
            module_title: m.title,
            // Use per-quiz user_status if available, fall back to module status
            user_status: q.user_status ?? m.user_status,
            is_published: (m as any).is_published,
            level: quizLevel,
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
  }, [modules, masterModule, searchQuery, filterLevel]);

  const flashcards = useMemo(() => {
    if (!flashcardsRaw) return [];
    let filtered = flashcardsRaw.filter(
      (f) => f.title !== 'Vocabulary Review' && f.title !== 'Revisão de Vocabulário',
    );
    if (filterLevel !== 'All') {
      const target = normalizeLevel(filterLevel);
      filtered = filtered.filter(
        (f) => !f.level || normalizeLevel(f.level) === target || f.level.toLowerCase() === 'all'
      );
    }
    if (!searchQuery) return filtered;
    return filtered.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flashcardsRaw, searchQuery, filterLevel]);

  const simulations = useMemo(() => {
    if (!simulationsRaw) return [];
    let filtered = simulationsRaw;
    if (filterLevel !== 'All') {
      const target = normalizeLevel(filterLevel);
      filtered = filtered.filter(
        (s) => !s.difficulty || normalizeLevel(s.difficulty) === target || s.difficulty.toLowerCase() === 'all'
      );
    }
    if (!searchQuery) return filtered;
    return filtered.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [simulationsRaw, searchQuery, filterLevel]);

  const podcasts = useMemo(() => {
    if (!podcastsRaw) return [];
    let filtered = podcastsRaw;
    if (!searchQuery) return filtered;
    return filtered.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [podcastsRaw, searchQuery]);

  const tabs: Array<{ id: TabType; icon: React.ReactNode; label: string; count?: number }> = [
    { id: 'quiz', icon: <HelpCircle size={18} />, label: 'Quizzes', count: quizzes.length },
    { id: 'grammar', icon: <BookOpen size={18} />, label: 'Grammar', count: grammarIndex?.topics?.length },
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

            {activeTab === 'grammar' && (
              <div className="space-y-8">
                {selectedGrammarTopic ? (
                  <div className="space-y-4 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button
                      onClick={() => setSelectedGrammarTopic(null)}
                      className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      ← Back to topics
                    </button>

                    {grammarDetail ? (
                      <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">
                              CEFR {grammarDetail.level}
                            </span>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-text">
                              {grammarDetail.title}
                            </h3>
                          </div>
                        </div>

                        <p className="text-text text-sm md:text-base leading-relaxed">
                          {grammarDetail.rule_summary}
                        </p>

                        <div className="bg-bg-secondary/50 border border-border rounded-2xl p-4">
                          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted mb-1">
                            Key Structure
                          </p>
                          <p className="text-text text-sm font-medium">
                            {grammarDetail.key_structure}
                          </p>
                        </div>

                        <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                          <Lightbulb size={20} className="text-primary shrink-0 mt-0.5" />
                          <p className="text-sm text-text">
                            <span className="font-bold text-primary">Teacher Tati Tip: </span>
                            {grammarDetail.tip_teacher_tati}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                            Reference Sources
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {grammarDetail.sources?.map((src) => (
                              <a
                                key={src.url}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-surface border border-border rounded-full text-[0.8rem] font-semibold text-text-muted hover:bg-primary-dim hover:text-primary hover:border-primary/50 transition-all"
                              >
                                {src.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center text-text-muted">
                        Loading explanation...
                      </div>
                    )}
                  </div>
                ) : grammarIndex?.topics?.length ? (
                  <div>
                    <p className="text-text-muted text-sm mb-5 max-w-2xl">
                      Explore grammar topics with Teacher Tati's explanations and links to
                      DW, BBC Learning English and test-english.com.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {grammarIndex.topics
                        .filter(
                          (t) =>
                            !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.topic.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((t) => (
                          <button
                            key={t.topic}
                            onClick={() => setSelectedGrammarTopic(t.topic)}
                            className="text-left bg-surface border border-border rounded-2xl p-5 space-y-3 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <BookOpen size={20} />
                              </div>
                              <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                CEFR {t.level}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-text">{t.title}</h4>
                            <p className="text-[0.7rem] text-text-muted">Source: {t.source_name}</p>
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-text-muted">
                    No grammar topics available for this level.
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
                      const displayFname = mat.display_filename || mat.filename;
                      const isDeleted = mat.is_deleted === true;
                      const isEdited = mat.is_edited === true;
                      const isPdf = displayFname.toLowerCase().endsWith('.pdf');
                      const isImage = /\.(png|jpe?g|gif|webp)$/i.test(displayFname);
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
                          className={cn(
                            "bg-surface border rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5",
                            isDeleted ? "border-danger/30 opacity-75 bg-danger/5" : "border-border hover:border-primary/45"
                          )}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                                isDeleted ? "bg-danger/10 text-danger border-danger/20" :
                                isPdf ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                isImage ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                "bg-primary/10 text-primary border-primary/20"
                              )}>
                                <FileText size={24} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className={cn("text-sm font-bold text-text truncate", isDeleted && "line-through text-text-muted")} title={displayFname}>
                                    {displayFname}
                                  </h4>
                                  {isEdited && !isDeleted && (
                                    <span className="text-[0.6rem] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                      Editado
                                    </span>
                                  )}
                                  {isDeleted && (
                                    <span className="text-[0.6rem] font-bold bg-danger/10 text-danger px-1.5 py-0.5 rounded">
                                      Apagado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[0.7rem] text-text-muted mt-0.5">
                                  Received on {dateStr}
                                </p>
                              </div>
                            </div>

                            {mat.message && (
                              <div className="bg-bg-secondary/40 border-l-4 border-primary rounded-r-xl p-3.5 text-xs text-text-muted italic space-y-1">
                                <span className="font-bold text-[0.65rem] text-primary uppercase tracking-wider block">
                                  Message from Teacher Tati: {isEdited && <span className="text-[0.6rem] font-normal text-text-muted lowercase tracking-normal">(editada)</span>}
                                </span>
                                <span>&ldquo;{mat.message}&rdquo;</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-5 flex gap-2">
                            {isDeleted ? (
                              <button
                                disabled
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-border text-text-muted cursor-not-allowed"
                              >
                                Indisponível (Removido)
                              </button>
                            ) : isPdf ? (
                              <>
                                <a
                                  href={`https://docs.google.com/viewer?url=${encodeURIComponent(mat.url)}&embedded=true`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
                                >
                                  <FileText size={14} />
                                  Open PDF
                                </a>
                                <a
                                  href={mat.url}
                                  download
                                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-surface border border-border text-text-muted hover:bg-bg-secondary transition-colors"
                                >
                                  <Download size={14} />
                                </a>
                              </>
                            ) : (
                              <a
                                href={mat.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm"
                              >
                                <Download size={14} />
                                Open File
                              </a>
                            )}
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
