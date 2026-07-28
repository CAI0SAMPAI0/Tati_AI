'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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
import { API_BASE } from '@/lib/api/client';

const teImg = (url: string) =>
  url.includes('test-english.com')
    ? `${API_BASE}/activities/test-english/image-proxy?url=${encodeURIComponent(url)}`
    : url;

type TabType = 'grammar' | 'vocabulary' | 'listenings' | 'reading' | 'flashcards' | 'simulations';

interface ModuleItem {
  id: string;
  title: string;
  level?: string;
  levels?: string[];
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
interface TestEnglishItem {
  slug: string;
  title: string;
  image: string;
  url: string;
  level: string;
}

export default function ActivitiesClientPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('grammar');
  const [searchQuery, setSearchQuery] = useState('');
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [visiblePodcastsCount, setVisiblePodcastsCount] = useState(10);
  const [filterLevel, setFilterLevel] = useState<string>('All');

  const isStaff = user?.role && ['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'Professora', 'Programador', 'admin', 'Admin'].includes(user.role);

  const effectiveLevel = !isStaff && user?.level && ['A1','A2','B1','B2','C1'].includes(user.level) ? user.level : filterLevel;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tati_last_activity_tab') as TabType;
      if (saved && ['grammar', 'vocabulary', 'listenings', 'reading', 'flashcards', 'simulations'].includes(saved)) {
        setActiveTab(saved);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tati_last_activity_tab', activeTab);
  }, [activeTab]);

  const { data: simulationsRaw = [] } = useQuery<SimulationItem[]>({
    queryKey: ['activities-simulations', effectiveLevel],
    queryFn: () => apiGet<SimulationItem[]>(
      effectiveLevel === 'All'
        ? '/simulation/scenarios'
        : `/simulation/scenarios?level=${effectiveLevel}`
    ),
  });
  const { data: podcastsRaw = [] } = useQuery<PodcastItem[]>({
    queryKey: ['activities-podcasts', effectiveLevel],
    queryFn: () => apiGet<PodcastItem[]>(
      effectiveLevel === 'All'
        ? '/activities/podcasts/recommendations?lang=en-US'
        : `/activities/podcasts/recommendations?lang=en-US&level=${effectiveLevel}`
    ),
  });
  const { data: flashcardsRaw = [] } = useQuery<FlashcardDeck[]>({
    queryKey: ['activities-flashcards', effectiveLevel],
    queryFn: () => apiGet<FlashcardDeck[]>(
      effectiveLevel === 'All'
        ? '/activities/flashcards/my'
        : `/activities/flashcards/my?level=${effectiveLevel}`
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
    queryKey: ['grammar-index', effectiveLevel],
    queryFn: () => apiGet<{ topics: GrammarTopicIndex[]; sources: Array<{ name: string; url: string }> }>(
      effectiveLevel === 'All'
        ? ENDPOINTS.GRAMMAR
        : `${ENDPOINTS.GRAMMAR}?level=${effectiveLevel}`
    ),
    staleTime: 5 * 60 * 1000,
  });
  const [selectedGrammarTopic, setSelectedGrammarTopic] = useState<string | null>(null);
  const { data: grammarDetail } = useQuery<GrammarDetail>({
    queryKey: ['grammar-detail', selectedGrammarTopic],
    queryFn: () => apiGet<GrammarDetail>(`${ENDPOINTS.GRAMMAR}?topic=${selectedGrammarTopic}`),
    enabled: !!selectedGrammarTopic,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => apiGet<any>('/profile'),
    refetchInterval: 10000,
  });

  const testEnglishLevel = effectiveLevel === 'All' ? 'all' : effectiveLevel;

  const { data: grammarContent } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-grammar', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'grammar')),
    staleTime: 30 * 60 * 1000,
  });

  const { data: vocabularyContent } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-vocabulary', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'vocabulary')),
    staleTime: 30 * 60 * 1000,
  });

  const { data: listeningContent } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-listening', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'listening')),
    staleTime: 30 * 60 * 1000,
  });

  const { data: readingContent } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-reading', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'reading')),
    staleTime: 30 * 60 * 1000,
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

  const flashcards = useMemo(() => {
    if (!flashcardsRaw) return [];
    let filtered = flashcardsRaw.filter(
      (f) => f.title !== 'Vocabulary Review' && f.title !== 'Revisão de Vocabulário',
    );
    if (effectiveLevel !== 'All') {
      const target = normalizeLevel(effectiveLevel);
      filtered = filtered.filter(
        (f) => !f.level || normalizeLevel(f.level) === target || f.level.toLowerCase() === 'all'
      );
    }
    if (!searchQuery) return filtered;
    return filtered.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flashcardsRaw, searchQuery, effectiveLevel]);

  const simulations = useMemo(() => {
    if (!simulationsRaw) return [];
    let filtered = simulationsRaw;
    if (effectiveLevel !== 'All') {
      const target = normalizeLevel(effectiveLevel);
      filtered = filtered.filter(
        (s) => !s.difficulty || normalizeLevel(s.difficulty) === target || s.difficulty.toLowerCase() === 'all'
      );
    }
    if (!searchQuery) return filtered;
    return filtered.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [simulationsRaw, searchQuery, effectiveLevel]);

  const podcasts = useMemo(() => {
    if (!podcastsRaw) return [];
    let filtered = podcastsRaw;
    if (!searchQuery) return filtered;
    return filtered.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [podcastsRaw, searchQuery]);

  const tabs: Array<{ id: TabType; icon: React.ReactNode; label: string; count?: number }> = [
    { id: 'grammar', icon: <BookOpen size={18} />, label: 'Grammar', count: grammarContent?.items?.length },
    { id: 'vocabulary', icon: <Lightbulb size={18} />, label: 'Vocabulary', count: vocabularyContent?.items?.length },
    { id: 'listenings', icon: <Podcast size={18} />, label: 'Listening', count: listeningContent?.items?.length || podcasts.length },
    { id: 'reading', icon: <FileText size={18} />, label: 'Reading', count: readingContent?.items?.length },
    { id: 'flashcards', icon: <Layers size={18} />, label: 'Flashcards', count: flashcards.length },
    { id: 'simulations', icon: <Drama size={18} />, label: 'Simulations', count: simulations.length },
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
            {activeTab === 'grammar' && (
              <div className="space-y-8">
                {grammarContent?.items && grammarContent.items.length > 0 ? (
                  <div>
                    <p className="text-text-muted text-sm mb-5 max-w-2xl">
                      Grammar lessons and exercises from test-english.com for level {testEnglishLevel}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {grammarContent.items
                        .filter(
                          (t) =>
                            !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((item) => (
                          <a
                            key={item.slug}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
                          >
                            {item.image && (
                              <div className="h-32 overflow-hidden bg-bg-secondary">
                                <img
                                  src={teImg(item.image)}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                  <BookOpen size={16} />
                                </div>
                                <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                  {testEnglishLevel}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-text line-clamp-2">{item.title}</h4>
                              <p className="text-[0.7rem] text-text-muted">test-english.com</p>
                            </div>
                          </a>
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

            {activeTab === 'listenings' && (
              <div className="space-y-8">
                {listeningContent?.items && listeningContent.items.length > 0 ? (
                  <div>
                    <p className="text-text-muted text-sm mb-5 max-w-2xl">
                      Listening tests from test-english.com for level {testEnglishLevel}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {listeningContent.items
                        .filter(
                          (t) =>
                            !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((item) => (
                          <a
                            key={item.slug}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
                          >
                            {item.image && (
                              <div className="h-32 overflow-hidden bg-bg-secondary">
                                <img
                                  src={teImg(item.image)}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                  <Podcast size={16} />
                                </div>
                                <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                  {testEnglishLevel}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-text line-clamp-2">{item.title}</h4>
                              <p className="text-[0.7rem] text-text-muted">test-english.com</p>
                            </div>
                          </a>
                        ))}
                    </div>
                  </div>
                ) : podcasts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {podcasts.slice(0, visiblePodcastsCount).map((p) => (
                      <ActivityCard
                        key={p.id}
                        title={p.title}
                        description={p.description || 'Get ready to listen and practice.'}
                        imageUrl={p.thumbnail}
                        type="podcast"
                        status={podcastProgress?.completed?.includes(p.id) ? 'done' : 'new'}
                        onClick={() => router.push(`/listenings/${p.id}`)}
                        actionLabel="Play"
                        meta={[
                          {
                            icon: <Layers size={14} />,
                            label: p.level || 'all',
                          }
                        ]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    No listening content available.
                  </div>
                )}
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

            {activeTab === 'vocabulary' && (
              <div className="space-y-8">
                {vocabularyContent?.items && vocabularyContent.items.length > 0 ? (
                  <div>
                    <p className="text-text-muted text-sm mb-5 max-w-2xl">
                      Vocabulary lessons from test-english.com for level {testEnglishLevel}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {vocabularyContent.items
                        .filter(
                          (t) =>
                            !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((item) => (
                          <a
                            key={item.slug}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
                          >
                            {item.image && (
                              <div className="h-32 overflow-hidden bg-bg-secondary">
                                <img
                                  src={teImg(item.image)}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                  <Lightbulb size={16} />
                                </div>
                                <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                  {testEnglishLevel}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-text line-clamp-2">{item.title}</h4>
                              <p className="text-[0.7rem] text-text-muted">test-english.com</p>
                            </div>
                          </a>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-text-muted">
                    No vocabulary lessons available for this level.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reading' && (
              <div className="space-y-8">
                {readingContent?.items && readingContent.items.length > 0 ? (
                  <div>
                    <p className="text-text-muted text-sm mb-5 max-w-2xl">
                      Reading tests from test-english.com for level {testEnglishLevel}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {readingContent.items
                        .filter(
                          (t) =>
                            !searchQuery ||
                            t.title.toLowerCase().includes(searchQuery.toLowerCase()),
                        )
                        .map((item) => (
                          <a
                            key={item.slug}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group"
                          >
                            {item.image && (
                              <div className="h-32 overflow-hidden bg-bg-secondary">
                                <img
                                  src={teImg(item.image)}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                  <FileText size={16} />
                                </div>
                                <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                                  {testEnglishLevel}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-text line-clamp-2">{item.title}</h4>
                              <p className="text-[0.7rem] text-text-muted">test-english.com</p>
                            </div>
                          </a>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-20 text-center text-text-muted">
                    No reading tests available for this level.
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
          </div>
        </main>
      </div>
    </div>
  );
}
