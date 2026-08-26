'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  FileText,
  Gamepad2,
  Newspaper,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { ActivityCard } from '@/components/activities/activity-card';
import { ActivityViewerModal } from '@/components/activities/activity-viewer-modal';
import { fetchWeeklyPlan } from '@/lib/api/weekly-plan';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { normalizeLevel } from '@/lib/constants/levels';
import { API_BASE } from '@/lib/api/client';
import toast from 'react-hot-toast';

const teImg = (url: string) => {
  if (!url) return '';
  if (url.includes('test-english.com')) {
    return `${API_BASE}/activities/test-english/image-proxy?url=${encodeURIComponent(url)}`;
  }
  if (url.includes('liveworksheets.com')) {
    return `${API_BASE}/activities/liveworksheets/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const formatFallbackTitle = (item: any) => {
  if (item.title && item.title.trim() && !/^\d+$/.test(item.title.trim())) {
    return item.title.trim();
  }
  if (item.url) {
    const parts = item.url.replace(/\/$/, '').split('/');
    const slug = parts[parts.length - 2] || parts[parts.length - 1];
    if (slug && !/^\d+$/.test(slug)) {
      return slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
  }
  return item.slug ? `Exercise ${item.slug}` : 'English Worksheet';
};

type TabType = 'grammar' | 'vocabulary' | 'listenings' | 'reading' | 'flashcards' | 'simulations' | 'games' | 'news';

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
interface TestEnglishItem {
  id?: string;
  slug: string;
  title: string;
  image: string;
  url: string;
  level: string;
  source?: string;
}
interface GameItem {
  id: string;
  title: string;
  description?: string;
  wordwall_url: string;
  levels?: string[];
  is_published?: boolean;
  created_at?: string;
}
interface NewsItem {
  id: string;
  title: string;
  description?: string;
  url: string;
  levels?: string[];
  thumbnail_url?: string | null;
  is_published?: boolean;
  created_at?: string;
}

export default function ActivitiesClientPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('grammar');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'test-english' | 'liveworksheets'>('all');
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [filterLevel, setFilterLevel] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState(10);

  const isStaff = user?.role && ['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'Professora', 'Programador', 'admin', 'Admin'].includes(user.role);

  const effectiveLevel = !isStaff && user?.level && ['A1','A2','B1','B2','C1'].includes(user.level) ? user.level : filterLevel;

  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, effectiveLevel, searchQuery, statusFilter, sourceFilter]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('tati_last_activity_tab') as TabType;
      if (savedTab && ['grammar', 'vocabulary', 'listenings', 'reading', 'flashcards', 'simulations', 'games', 'news'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
      const savedLevel = sessionStorage.getItem('tati_activities_filter_level');
      if (savedLevel && ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(savedLevel)) {
        setFilterLevel(savedLevel);
      }
      const savedStatus = sessionStorage.getItem('tati_activities_filter_status') as any;
      if (savedStatus && ['all', 'pending', 'done'].includes(savedStatus)) {
        setStatusFilter(savedStatus);
      }
      const savedSource = sessionStorage.getItem('tati_activities_filter_source') as any;
      if (savedSource && ['all', 'test-english', 'liveworksheets'].includes(savedSource)) {
        setSourceFilter(savedSource);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tati_last_activity_tab', activeTab);
  }, [activeTab]);

  const handleFilterLevelChange = (val: string) => {
    setFilterLevel(val);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tati_activities_filter_level', val);
    }
  };

  const handleStatusFilterChange = (val: 'all' | 'pending' | 'done') => {
    setStatusFilter(val);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tati_activities_filter_status', val);
    }
  };

  const handleSourceFilterChange = (val: 'all' | 'test-english' | 'liveworksheets') => {
    setSourceFilter(val);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('tati_activities_filter_source', val);
    }
  };

  // User Submissions for Done vs Pending verification (Cached via React Query)
  const { data: mySubmissions = [], refetch: refetchSubmissions } = useQuery<any[]>({
    queryKey: ['my-submissions'],
    queryFn: () => apiGet<any[]>('/activities/submissions/my'),
    staleTime: 5 * 60 * 1000,
  });

  const completedActivityIds = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(mySubmissions)) {
      mySubmissions.forEach((sub: any) => {
        const isDoneScore = sub.score !== undefined ? sub.score > 0 : true;
        const statusNotPending = sub.metadata?.status !== 'pending';
        if (isDoneScore && statusNotPending) {
          if (sub.module_id) set.add(sub.module_id);
          if (sub.activity_id) set.add(sub.activity_id);
          if (sub.metadata?.url) set.add(sub.metadata.url);
          if (sub.metadata?.slug) set.add(sub.metadata.slug);
        }
      });
    }
    return set;
  }, [mySubmissions]);

  // Simulations, Podcasts, Flashcards (Cached - fetched only when relevant tab is active)
  const { data: simulationsRaw = [] } = useQuery<SimulationItem[]>({
    queryKey: ['activities-simulations', effectiveLevel],
    queryFn: () => apiGet<SimulationItem[]>(
      effectiveLevel === 'All'
        ? '/simulation/scenarios'
        : `/simulation/scenarios?level=${effectiveLevel}`
    ),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === 'simulations',
  });
  const { data: podcastsRaw = [] } = useQuery<PodcastItem[]>({
    queryKey: ['activities-podcasts', effectiveLevel],
    queryFn: () => apiGet<PodcastItem[]>(
      effectiveLevel === 'All'
        ? '/activities/podcasts/recommendations?lang=en-US'
        : `/activities/podcasts/recommendations?lang=en-US&level=${effectiveLevel}`
    ),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === 'listenings',
  });
  const { data: flashcardsRaw = [] } = useQuery<FlashcardDeck[]>({
    queryKey: ['activities-flashcards', effectiveLevel],
    queryFn: () => apiGet<FlashcardDeck[]>(
      effectiveLevel === 'All'
        ? '/activities/flashcards/my'
        : `/activities/flashcards/my?level=${effectiveLevel}`
    ),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === 'flashcards',
  });
  const { data: podcastProgress } = useQuery({
    queryKey: ['activities-podcasts-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/activities/podcasts/progress'),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'listenings',
  });
  const { data: simulationProgress } = useQuery({
    queryKey: ['activities-simulations-progress'],
    queryFn: () => apiGet<{ completed: string[] }>('/simulation/progress'),
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'simulations',
  });

  const testEnglishLevel = effectiveLevel === 'All' ? 'all' : effectiveLevel;

  // Test-English Content (Cached 30 mins)
  const { data: grammarTE } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-grammar', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'grammar')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'grammar',
  });
  const { data: vocabularyTE } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-vocabulary', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'vocabulary')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'vocabulary',
  });
  const { data: listeningTE } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-listening', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'listening')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'listenings',
  });
  const { data: readingTE } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['test-english-reading', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel, 'reading')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'reading',
  });

  // LiveWorksheets Content (Cached 30 mins)
  const { data: grammarLW } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['liveworksheets-grammar', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.LIVEWORKSHEETS_CONTENT(testEnglishLevel, 'grammar')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'grammar',
  });
  const { data: vocabularyLW } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['liveworksheets-vocabulary', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.LIVEWORKSHEETS_CONTENT(testEnglishLevel, 'vocabulary')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'vocabulary',
  });
  const { data: listeningLW } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['liveworksheets-listening', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.LIVEWORKSHEETS_CONTENT(testEnglishLevel, 'listening')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'listenings',
  });
  const { data: readingLW } = useQuery<{ items: TestEnglishItem[] }>({
    queryKey: ['liveworksheets-reading', testEnglishLevel],
    queryFn: () => apiGet<any>(ENDPOINTS.LIVEWORKSHEETS_CONTENT(testEnglishLevel, 'reading')),
    staleTime: 30 * 60 * 1000,
    enabled: activeTab === 'reading',
  });

  const { data: gamesRaw = [] } = useQuery<GameItem[]>({
    queryKey: ['activities-games'],
    queryFn: () => apiGet<GameItem[]>(ENDPOINTS.ACTIVITIES_GAMES),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === 'games',
  });

  const { data: newsRaw = [] } = useQuery<NewsItem[]>({
    queryKey: ['activities-news'],
    queryFn: () => apiGet<NewsItem[]>(ENDPOINTS.ACTIVITIES_NEWS),
    staleTime: 10 * 60 * 1000,
    enabled: activeTab === 'news',
  });

  useQuery({
    queryKey: ['weekly-plan-v2'],
    queryFn: fetchWeeklyPlan,
    staleTime: 5 * 60 * 1000,
  });

  // Combine items for each category
  const filterItems = useCallback(
    (teItems: TestEnglishItem[] = [], lwItems: TestEnglishItem[] = [], category?: string) => {
      let combined = [
        ...(teItems || []).map((i) => ({
          ...i,
          id: i.url || i.slug,
          source: 'test-english.com',
          category,
          title: formatFallbackTitle(i),
        })),
        ...(lwItems || []).map((i) => ({
          ...i,
          id: i.url || i.slug,
          source: 'liveworksheets.com',
          category,
          title: formatFallbackTitle(i),
        })),
      ];

      if (searchQuery) {
        combined = combined.filter((i) => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      if (sourceFilter === 'test-english') {
        combined = combined.filter((i) => i.source === 'test-english.com');
      } else if (sourceFilter === 'liveworksheets') {
        combined = combined.filter((i) => i.source === 'liveworksheets.com');
      }

      if (statusFilter === 'done') {
        combined = combined.filter(
          (i) => completedActivityIds.has(i.id) || completedActivityIds.has(i.url) || completedActivityIds.has(i.slug)
        );
      } else if (statusFilter === 'pending') {
        combined = combined.filter(
          (i) => !(completedActivityIds.has(i.id) || completedActivityIds.has(i.url) || completedActivityIds.has(i.slug))
        );
      }

      return combined;
    },
    [searchQuery, sourceFilter, statusFilter, completedActivityIds]
  );

  const grammarItems = useMemo(
    () => filterItems(grammarTE?.items, grammarLW?.items, 'grammar'),
    [grammarTE, grammarLW, filterItems]
  );
  const vocabularyItems = useMemo(
    () => filterItems(vocabularyTE?.items, vocabularyLW?.items, 'vocabulary'),
    [vocabularyTE, vocabularyLW, filterItems]
  );
  const listeningItems = useMemo(
    () => filterItems(listeningTE?.items, listeningLW?.items, 'listening'),
    [listeningTE, listeningLW, filterItems]
  );
  const readingItems = useMemo(
    () => filterItems(readingTE?.items, readingLW?.items, 'reading'),
    [readingTE, readingLW, filterItems]
  );

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

  // Mark completion handlers
  const handleMarkDone = async (item: any) => {
    const actId = item.url || item.slug || item.id;
    try {
      await apiPost('/activities/submissions', {
        activity_id: actId,
        activity_type: item.source || 'external',
        score: 100,
        metadata: {
          title: item.title,
          url: item.url,
          slug: item.slug,
          status: 'done',
          category: item.category,
        },
      });
      toast.success("Atividade concluída com sucesso!", { id: 'act-status' });
      await refetchSubmissions();
    } catch (e) {
      toast.error("Erro ao concluir atividade.");
    }
  };

  const handleMarkPending = async (item: any) => {
    const actId = item.url || item.slug || item.id;
    try {
      await apiPost('/activities/submissions', {
        activity_id: actId,
        activity_type: item.source || 'external',
        score: 0,
        status: 'pending',
        metadata: {
          title: item.title,
          url: item.url,
          slug: item.slug,
          status: 'pending',
          category: item.category,
        },
      });
      toast.success("Atividade revertida para pendente!", { id: 'act-status' });
      await refetchSubmissions();
    } catch (e) {
      toast.error("Erro ao reverter atividade.");
    }
  };

  const tabs: Array<{ id: TabType; icon: React.ReactNode; label: string; count?: number }> = [
    { id: 'grammar', icon: <BookOpen size={18} />, label: 'Grammar', count: grammarItems.length },
    { id: 'vocabulary', icon: <Lightbulb size={18} />, label: 'Vocabulary', count: vocabularyItems.length },
    { id: 'listenings', icon: <Podcast size={18} />, label: 'Listening', count: listeningItems.length || podcasts.length },
    { id: 'reading', icon: <FileText size={18} />, label: 'Reading', count: readingItems.length },
    { id: 'flashcards', icon: <Layers size={18} />, label: 'Flashcards', count: flashcards.length },
    { id: 'simulations', icon: <Drama size={18} />, label: 'Simulations', count: simulations.length },
    { id: 'games', icon: <Gamepad2 size={18} />, label: 'Games', count: gamesRaw.length },
    { id: 'news', icon: <Newspaper size={18} />, label: 'News', count: newsRaw.length },
  ];

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const renderCategoryGrid = (items: any[], categoryName: string, icon: React.ReactNode) => {
    if (items.length === 0) {
      return (
        <div className="py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
          No {categoryName} activities found matching your filters.
        </div>
      );
    }

    const currentItems = items.slice(0, visibleCount);
    const hasMore = items.length > visibleCount;

    return (
      <div className="space-y-8">
        <p className="text-text-muted text-sm max-w-2xl">
          Interactive {categoryName} exercises for level {testEnglishLevel} from test-english.com & liveworksheets.com.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentItems.map((item) => {
            const itemId = item.url || item.slug || item.id;
            const isDone = completedActivityIds.has(itemId) || completedActivityIds.has(item.url) || completedActivityIds.has(item.slug);

            return (
              <div
                key={itemId}
                onClick={() => setSelectedActivity(item)}
                className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {item.image ? (
                    <div className="h-36 overflow-hidden bg-bg-secondary relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={teImg(item.image)}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        {isDone ? (
                          <span className="flex items-center gap-1 bg-success text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                            <CheckCircle2 size={12} /> Done
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-warning/90 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-24 overflow-hidden bg-primary/5 p-4 relative flex items-center justify-between border-b border-border/40">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        {icon}
                      </div>
                      <div className="flex gap-1">
                        {isDone ? (
                          <span className="flex items-center gap-1 bg-success text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                            <CheckCircle2 size={12} /> Done
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-warning/90 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        {icon}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.6rem] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase">
                          {item.level || testEnglishLevel}
                        </span>
                        <span className="text-[0.6rem] font-bold bg-bg text-text-subtle border border-border px-2 py-0.5 rounded-full">
                          {item.source}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-text line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t border-border/40 mt-3">
                  <span className="text-[0.7rem] text-text-muted flex items-center gap-1">
                    <ExternalLink size={12} /> Practice
                  </span>
                  {isDone ? (
                    <span className="text-[0.65rem] font-bold text-success flex items-center gap-1">
                      <CheckCircle2 size={12} /> Completed
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-bold text-warning flex items-center gap-1">
                      <Clock size={12} /> Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More Button (10 by 10) */}
        {hasMore && (
          <div className="flex flex-col items-center justify-center pt-4">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
            >
              <span>Load 10 More ({items.length - visibleCount} remaining)</span>
              <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">My Activities</h1>
              <p className="text-text-muted text-sm md:text-base max-w-2xl">
                Practice vocabulary, grammar, reading and listening. Track Completed vs Pending activities!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center flex-wrap">
              {isStaff && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-subtle uppercase tracking-wider whitespace-nowrap">Level:</span>
                  <select
                    value={filterLevel}
                    onChange={(e) => handleFilterLevelChange(e.target.value)}
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

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-subtle uppercase tracking-wider whitespace-nowrap">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value as any)}
                  className="px-3 py-2 bg-surface border border-border rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer text-text"
                >
                  <option value="all">All Status</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="done">✓ Completed</option>
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-subtle uppercase tracking-wider whitespace-nowrap">Source:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => handleSourceFilterChange(e.target.value as any)}
                  className="px-3 py-2 bg-surface border border-border rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer text-text"
                >
                  <option value="all">All Sources</option>
                  <option value="test-english">test-english.com</option>
                  <option value="liveworksheets">liveworksheets.com</option>
                </select>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" size={18} />
                <input
                  type="text"
                  placeholder="Search activity..."
                  className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
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
            {activeTab === 'grammar' && renderCategoryGrid(grammarItems, 'Grammar', <BookOpen size={16} />)}
            {activeTab === 'vocabulary' && renderCategoryGrid(vocabularyItems, 'Vocabulary', <Lightbulb size={16} />)}
            {activeTab === 'listenings' && renderCategoryGrid(listeningItems, 'Listening', <Podcast size={16} />)}
            {activeTab === 'reading' && renderCategoryGrid(readingItems, 'Reading', <FileText size={16} />)}

            {activeTab === 'flashcards' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {flashcards.length > 0 ? (
                    flashcards.slice(0, visibleCount).map((f) => (
                      <ActivityCard
                        key={f.id}
                        title={f.title}
                        description={f.description || 'Your vocabulary flashcards.'}
                        type="flashcard"
                        status={completedActivityIds.has(f.id) ? 'done' : 'pending'}
                        onClick={() =>
                          setSelectedActivity({
                            id: f.id,
                            slug: f.id,
                            title: f.title,
                            url: `/flashcards/${f.id}`,
                            route: `/flashcards/${f.id}`,
                            source: 'Flashcards',
                            category: 'flashcards',
                            level: f.level || 'all',
                          })
                        }
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
                {flashcards.length > visibleCount && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
                    >
                      <span>Load 10 More</span>
                      <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'simulations' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {simulations.length > 0 ? (
                    simulations.slice(0, visibleCount).map((s) => (
                      <ActivityCard
                        key={s.id}
                        title={s.name}
                        emoji={s.emoji || s.icon}
                        description={s.description || 'Choose a scenario and practice English in everyday situations'}
                        type="simulation"
                        status={simulationProgress?.completed?.includes(s.id) || completedActivityIds.has(s.id) ? 'done' : 'pending'}
                        onClick={() =>
                          setSelectedActivity({
                            id: s.id,
                            slug: s.id,
                            title: s.name,
                            url: `/voice?simulation_id=${s.id}`,
                            route: `/voice?simulation_id=${s.id}`,
                            source: 'Simulation',
                            category: 'simulations',
                            level: s.difficulty || 'all',
                          })
                        }
                        meta={[{ icon: <Play size={14} />, label: s.difficulty || 'normal' }]}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                      No simulations available.
                    </div>
                  )}
                </div>
                {simulations.length > visibleCount && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
                    >
                      <span>Load 10 More</span>
                      <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'games' && (
              <div className="space-y-8">
                {gamesRaw.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {gamesRaw
                        .filter((g) => !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase()))
                        .slice(0, visibleCount)
                        .map((g) => {
                          const isDone = completedActivityIds.has(g.id) || completedActivityIds.has(g.wordwall_url);
                          return (
                            <div
                              key={g.id}
                              onClick={() =>
                                setSelectedActivity({
                                  id: g.id,
                                  title: g.title,
                                  url: g.wordwall_url,
                                  source: 'WordWall',
                                  category: 'games',
                                  level: g.levels?.[0] || 'all',
                                })
                              }
                              className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer"
                            >
                              <div className="p-5 flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                  <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary">
                                    <Gamepad2 size={20} />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {isDone ? (
                                      <span className="flex items-center gap-1 bg-success text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={12} /> Completed
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 bg-warning text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full">
                                        <Clock size={12} /> Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-text line-clamp-2 group-hover:text-primary transition-colors">
                                    {g.title}
                                  </h4>
                                  {g.description && (
                                    <p className="text-[0.75rem] text-text-muted line-clamp-2 mt-1">{g.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[0.7rem] text-text-muted mt-auto pt-2 border-t border-border/40">
                                  <span className="flex items-center gap-1">
                                    <ExternalLink size={12} /> WordWall
                                  </span>
                                  <span className="font-bold text-primary">Practice</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {gamesRaw.filter((g) => !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase())).length > visibleCount && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={handleLoadMore}
                          className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
                        >
                          <span>Load 10 More</span>
                          <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    <Gamepad2 size={40} className="mx-auto mb-4 opacity-20" />
                    <p>No games available for your level.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div className="space-y-8">
                {newsRaw.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {newsRaw
                        .filter((n) => !searchQuery || (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
                        .slice(0, visibleCount)
                        .map((n) => {
                          const isDone = completedActivityIds.has(n.id) || completedActivityIds.has(n.url);
                          return (
                            <div
                              key={n.id}
                              onClick={() =>
                                setSelectedActivity({
                                  id: n.id,
                                  title: n.title || n.url,
                                  url: n.url,
                                  image: n.thumbnail_url || undefined,
                                  source: 'News',
                                  category: 'news',
                                  level: n.levels?.[0] || 'all',
                                })
                              }
                              className="text-left bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer flex flex-col"
                            >
                              {n.thumbnail_url ? (
                                <div className="h-36 overflow-hidden bg-bg-secondary relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={n.thumbnail_url}
                                    alt={n.title || 'News'}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                  <div className="absolute top-2 right-2">
                                    {isDone ? (
                                      <span className="flex items-center gap-1 bg-success text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                                        <CheckCircle2 size={12} /> Completed
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 bg-warning text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                                        <Clock size={12} /> Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-24 bg-primary/5 p-4 flex items-center justify-between border-b border-border/40 relative">
                                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <Newspaper size={20} />
                                  </div>
                                  <div className="flex gap-1">
                                    {isDone ? (
                                      <span className="flex items-center gap-1 bg-success text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                                        <CheckCircle2 size={12} /> Completed
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1 bg-warning text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow">
                                        <Clock size={12} /> Pending
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="p-4 flex flex-col gap-2 flex-1">
                                <h4 className="text-sm font-bold text-text line-clamp-2 group-hover:text-primary transition-colors">
                                  {n.title || n.url}
                                </h4>
                                {n.description && (
                                  <p className="text-[0.75rem] text-text-muted line-clamp-2">{n.description}</p>
                                )}
                              </div>

                              <div className="px-4 pb-4 pt-1 flex items-center justify-between text-[0.7rem] text-text-muted border-t border-border/40">
                                <span className="flex items-center gap-1">
                                  <ExternalLink size={12} /> Open link
                                </span>
                                <span className="font-bold text-primary">Read</span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {newsRaw.filter((n) => !searchQuery || (n.title || '').toLowerCase().includes(searchQuery.toLowerCase())).length > visibleCount && (
                      <div className="flex justify-center pt-4">
                        <button
                          onClick={handleLoadMore}
                          className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
                        >
                          <span>Load 10 More</span>
                          <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                    <Newspaper size={40} className="mx-auto mb-4 opacity-20" />
                    <p>No news available for your level.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Activity Viewer Modal with Done vs Pending tracking */}
      <ActivityViewerModal
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        isDone={
          selectedActivity
            ? completedActivityIds.has(selectedActivity.id) ||
              completedActivityIds.has(selectedActivity.url) ||
              completedActivityIds.has(selectedActivity.slug)
            : false
        }
        onMarkDone={handleMarkDone}
        onMarkPending={handleMarkPending}
      />
    </div>
  );
}
