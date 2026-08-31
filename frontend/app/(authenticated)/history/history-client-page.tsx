'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Search,
  Calendar,
  Award,
  ExternalLink,
  RotateCcw,
  BookOpen,
  Layers,
  Podcast,
  Drama,
  Gamepad2,
  Newspaper,
  ArrowRight,
  Filter,
  Sparkles,
  ChevronDown,
  Zap,
  History as HistoryIcon,
  TrendingUp,
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  grammar: {
    label: 'Grammar',
    icon: BookOpen,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  vocabulary: {
    label: 'Vocabulary',
    icon: Layers,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  vocab: {
    label: 'Vocabulary',
    icon: Layers,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  listening: {
    label: 'Listening',
    icon: Podcast,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  reading: {
    label: 'Reading',
    icon: BookOpen,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  simulations: {
    label: 'Simulations',
    icon: Drama,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  simulation: {
    label: 'Simulations',
    icon: Drama,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  games: {
    label: 'Games',
    icon: Gamepad2,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  game: {
    label: 'Games',
    icon: Gamepad2,
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  news: {
    label: 'News',
    icon: Newspaper,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  flashcards: {
    label: 'Flashcards',
    icon: Layers,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
};

type SortOption = 'newest' | 'oldest' | 'highest_score' | 'lowest_score';

// Helpers to reliably extract category and title regardless of submission shape
function resolveActivityCategory(sub: any): string {
  const meta = sub.metadata || {};
  const metaCat = (meta.category || sub.category || '').toLowerCase().trim();
  if (metaCat) {
    if (metaCat.includes('gramm')) return 'grammar';
    if (metaCat.includes('vocab')) return 'vocabulary';
    if (metaCat.includes('listen') || metaCat.includes('podcast')) return 'listening';
    if (metaCat.includes('read')) return 'reading';
    if (metaCat.includes('simul')) return 'simulations';
    if (metaCat.includes('game') || metaCat.includes('wordwall')) return 'games';
    if (metaCat.includes('news')) return 'news';
    if (metaCat.includes('flash')) return 'flashcards';
  }

  const actType = (sub.activity_type || '').toLowerCase().trim();
  if (actType.includes('simul')) return 'simulations';
  if (actType.includes('flash')) return 'flashcards';
  if (actType.includes('news')) return 'news';
  if (actType.includes('wordwall') || actType.includes('game')) return 'games';
  if (actType.includes('listen') || actType.includes('podcast')) return 'listening';
  if (actType.includes('read')) return 'reading';
  if (actType.includes('vocab')) return 'vocabulary';
  if (actType.includes('gramm')) return 'grammar';

  // Check URL / slug heuristics
  const rawUrl = (meta.url || meta.slug || meta.activity_id || sub.activity_id || '').toLowerCase();
  if (rawUrl.includes('grammar') || rawUrl.includes('gramatica')) return 'grammar';
  if (rawUrl.includes('vocab')) return 'vocabulary';
  if (rawUrl.includes('listening') || rawUrl.includes('podcast')) return 'listening';
  if (rawUrl.includes('reading') || rawUrl.includes('leitura')) return 'reading';
  if (rawUrl.includes('wordwall') || rawUrl.includes('game')) return 'games';
  if (rawUrl.includes('instagram') || rawUrl.includes('news')) return 'news';
  if (rawUrl.includes('flashcard')) return 'flashcards';
  if (rawUrl.includes('simulation') || rawUrl.includes('voice')) return 'simulations';

  return 'grammar';
}

function resolveActivityTitle(sub: any): string {
  const meta = sub.metadata || {};
  let title = meta.title || meta.deck_title || meta.name || '';

  // If title is missing or is a raw URL
  if (!title || title.startsWith('http://') || title.startsWith('https://') || title.startsWith('www.')) {
    if (meta.slug && !meta.slug.startsWith('http')) {
      title = meta.slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
    } else if (meta.url) {
      try {
        const parsed = new URL(meta.url);
        const segments = parsed.pathname.split('/').filter(Boolean);
        const lastSeg = segments[segments.length - 1] || parsed.hostname;
        if (lastSeg && !lastSeg.startsWith('reel') && lastSeg !== 'www.instagram.com') {
          title = decodeURIComponent(lastSeg)
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        } else {
          title = 'English News Article';
        }
      } catch {
        title = 'Interactive Activity';
      }
    } else {
      const cat = resolveActivityCategory(sub);
      title = `${cat.charAt(0).toUpperCase() + cat.slice(1)} Practice`;
    }
  }

  return title;
}

function resolvePracticeUrl(sub: any): { url?: string; route?: string } {
  const meta = sub.metadata || {};
  const cat = resolveActivityCategory(sub);

  if (cat === 'flashcards' && (sub.activity_id || meta.deck_id || sub.id)) {
    return { route: `/flashcards/${sub.activity_id || meta.deck_id || sub.id}` };
  }
  if (cat === 'simulations') {
    return { route: '/voice' };
  }

  let directUrl = meta.url || '';
  if (directUrl) {
    if (directUrl.includes('/worksheet/en/')) {
      const parts = directUrl.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      directUrl = `https://www.liveworksheets.com/w/en/english-as-a-second-language-esl/${id}`;
    }
    return { url: directUrl };
  }

  if (meta.slug) {
    return { url: `https://test-english.com/grammar-points/a1/${meta.slug}/` };
  }

  return { url: 'https://test-english.com' };
}

export default function HistoryClientPage() {
  const router = useRouter();
  const {
    sidebarOpen,
    toggleSidebar: handleToggleSidebar,
    closeSidebar: handleCloseSidebar,
  } = useSidebarState();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [visibleCount, setVisibleCount] = useState(15);

  // Fetch student's submissions
  const {
    data: submissions = [],
    isLoading,
  } = useQuery<any[]>({
    queryKey: ['my-submissions'],
    queryFn: () => apiGet<any[]>('/activities/submissions/my'),
    staleTime: 2 * 60 * 1000,
  });

  const categories = [
    { id: 'all', label: 'All Activities' },
    { id: 'grammar', label: 'Grammar' },
    { id: 'vocabulary', label: 'Vocabulary' },
    { id: 'listening', label: 'Listening' },
    { id: 'reading', label: 'Reading' },
    { id: 'simulations', label: 'Simulations' },
    { id: 'games', label: 'Games' },
    { id: 'news', label: 'News' },
    { id: 'flashcards', label: 'Flashcards' },
  ];

  // Filter and sort submissions
  const filteredAndSorted = useMemo(() => {
    let result = (submissions || []).filter((sub: any) => {
      const category = resolveActivityCategory(sub);
      const title = resolveActivityTitle(sub).toLowerCase();

      const matchCat =
        selectedCategory === 'all' ||
        category === selectedCategory ||
        category.includes(selectedCategory);
      const matchSearch = !search.trim() || title.includes(search.toLowerCase());
      return matchCat && matchSearch;
    });

    result = [...result].sort((a: any, b: any) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortBy === 'highest_score') {
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'lowest_score') {
        return (a.score || 0) - (b.score || 0);
      }
      return 0;
    });

    return result;
  }, [submissions, selectedCategory, search, sortBy]);

  const displayedItems = useMemo(
    () => filteredAndSorted.slice(0, visibleCount),
    [filteredAndSorted, visibleCount]
  );

  const hasMore = visibleCount < filteredAndSorted.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  // KPIs
  const stats = useMemo(() => {
    const total = submissions.length;
    const avg =
      total > 0
        ? Math.round(
            submissions.reduce((acc: number, s: any) => acc + (s.score !== undefined ? s.score : 100), 0) /
              total
          )
        : 0;

    const totalXp = submissions.reduce((acc: number, s: any) => {
      const sc = s.score !== undefined ? s.score : 100;
      return acc + (sc >= 70 ? 15 : 5);
    }, 0);

    const categoryCounts: Record<string, number> = {};
    submissions.forEach((s: any) => {
      const cat = resolveActivityCategory(s);
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    let topCategory = 'None';
    let maxCount = 0;
    Object.entries(categoryCounts).forEach(([cat, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        topCategory = cat.charAt(0).toUpperCase() + cat.slice(1);
      }
    });

    return { total, avg, totalXp, topCategory, categoryCounts };
  }, [submissions]);

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      {/* Responsive unified Sidebar */}
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          sidebarOpen ? 'md:ml-[280px]' : 'md:ml-0'
        )}
      >
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in space-y-8">
          {/* Header & Title */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-wider mb-1">
                <HistoryIcon size={16} />
                Study Activity Log
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-text tracking-tight">
                Activity History
              </h1>
              <p className="text-text-muted text-sm mt-1">
                View all your completed exercises, scores, and track what you have mastered so far.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => router.push('/activities')}
                className="gap-2 text-xs font-bold"
              >
                <Sparkles size={16} /> Explore Activities
              </Button>
            </div>
          </div>

          {/* Stats KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Completed */}
            <div className="bg-surface border border-border rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-primary/40 transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Completed
                  </p>
                  <p className="text-2xl font-black text-text mt-0.5">
                    {stats.total}
                  </p>
                </div>
              </div>
              <p className="text-[0.7rem] text-text-muted mt-3">Activities finished</p>
            </div>

            {/* Average Accuracy */}
            <div className="bg-surface border border-border rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Award size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Avg Score
                  </p>
                  <p className="text-2xl font-black text-text mt-0.5">
                    {stats.avg}%
                  </p>
                </div>
              </div>
              <p className="text-[0.7rem] text-text-muted mt-3">Average accuracy score</p>
            </div>

            {/* Total XP Earned */}
            <div className="bg-surface border border-border rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Zap size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Total XP
                  </p>
                  <p className="text-2xl font-black text-text mt-0.5">
                    +{stats.totalXp}
                  </p>
                </div>
              </div>
              <p className="text-[0.7rem] text-text-muted mt-3">Estimated XP gained</p>
            </div>

            {/* Top Category */}
            <div className="bg-surface border border-border rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-purple-500/40 transition-all">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Sparkles size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Top Category
                  </p>
                  <p className="text-xl font-black text-text mt-0.5 truncate">
                    {stats.topCategory}
                  </p>
                </div>
              </div>
              <p className="text-[0.7rem] text-text-muted mt-3">Most practiced skill</p>
            </div>
          </div>

          {/* Skill Breakdown Summary (O que foi feito vs O que falta praticar) */}
          <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-text">Skills Overview</h2>
              </div>
              <span className="text-xs text-text-muted">Completed vs Practice</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
              {[
                { id: 'grammar', label: 'Grammar', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { id: 'vocabulary', label: 'Vocab', icon: Layers, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { id: 'listening', label: 'Listening', icon: Podcast, color: 'text-purple-500', bg: 'bg-purple-500/10' },
                { id: 'reading', label: 'Reading', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { id: 'simulations', label: 'Simulations', icon: Drama, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                { id: 'games', label: 'Games', icon: Gamepad2, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                { id: 'news', label: 'News', icon: Newspaper, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
                { id: 'flashcards', label: 'Flashcards', icon: Layers, color: 'text-orange-500', bg: 'bg-orange-500/10' },
              ].map((skill) => {
                const count = stats.categoryCounts[skill.id] || 0;
                const Icon = skill.icon;
                return (
                  <div
                    key={skill.id}
                    onClick={() => {
                      setSelectedCategory(selectedCategory === skill.id ? 'all' : skill.id);
                      setVisibleCount(15);
                    }}
                    className={cn(
                      'p-3 rounded-2xl border transition-all text-center cursor-pointer',
                      selectedCategory === skill.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/60 bg-bg hover:border-primary/30'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2', skill.bg, skill.color)}>
                      <Icon size={16} />
                    </div>
                    <p className="text-xs font-bold text-text truncate">{skill.label}</p>
                    <p className="text-[11px] font-semibold text-text-muted mt-0.5">
                      {count} done
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search, Filter, and Sort Controls */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search input */}
              <div className="relative w-full md:w-96">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search activities by title or topic..."
                  className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-2xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-all shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted hover:text-text px-1.5 py-0.5 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2 self-end md:self-auto">
                <span className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                  <Filter size={14} /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-surface border border-border text-xs font-bold text-text rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary cursor-pointer transition-all shadow-sm"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest_score">Highest score</option>
                  <option value="lowest_score">Lowest score</option>
                </select>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setVisibleCount(15);
                    }}
                    className={cn(
                      'px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border',
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'bg-surface text-text-muted hover:text-text border-border hover:border-primary/40'
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submissions List */}
          {isLoading ? (
            <div className="space-y-3">
              {Array(6)
                .fill(0)
                .map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-surface animate-pulse rounded-2xl border border-border"
                  />
                ))}
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-3xl border border-dashed border-border space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-text">No activities found</h3>
                <p className="text-xs text-text-muted">
                  {submissions.length === 0
                    ? "You haven't completed any activities yet. Complete your first exercise in Activities to build your study history and stats!"
                    : search || selectedCategory !== 'all'
                    ? 'No completed activities match your current search or category filter.'
                    : 'No completed activities found.'}
                </p>
              </div>
              <Link
                href="/activities"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-2xl text-xs font-bold transition-all"
              >
                Go to Activities
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-text-muted px-1">
                <span>
                  Showing {displayedItems.length} of {filteredAndSorted.length} activities
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {displayedItems.map((sub: any) => {
                  const meta = sub.metadata || {};
                  const catKey = resolveActivityCategory(sub);
                  const config = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.grammar;
                  const Icon = config.icon;
                  const title = resolveActivityTitle(sub);
                  const practice = resolvePracticeUrl(sub);

                  const formattedDate = sub.created_at
                    ? new Date(sub.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Completed';

                  const score = sub.score !== undefined ? sub.score : 100;
                  const isHighScore = score >= 80;

                  return (
                    <div
                      key={sub.id}
                      className="p-4 bg-surface border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/40 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start sm:items-center gap-4 min-w-0">
                        {/* Category Icon */}
                        <div
                          className={cn(
                            'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border',
                            config.bg,
                            config.color,
                            config.border
                          )}
                        >
                          <Icon size={22} />
                        </div>

                        {/* Title & Metadata */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-text truncate group-hover:text-primary transition-colors">
                              {title}
                            </h3>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-[10px] font-black rounded-full uppercase border',
                                isHighScore
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              )}
                            >
                              {score}%
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 text-xs text-text-muted mt-1 flex-wrap">
                            <span className="font-semibold text-text-subtle capitalize">
                              {config.label}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {formattedDate}
                            </span>
                            {meta.url && (
                              <>
                                <span>•</span>
                                <span className="text-[11px] text-text-muted">
                                  {meta.url.includes('test-english')
                                    ? 'test-english.com'
                                    : meta.url.includes('liveworksheets')
                                    ? 'liveworksheets.com'
                                    : meta.url.includes('wordwall')
                                    ? 'wordwall.net'
                                    : 'Online Exercise'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action direct button (NO MODAL) */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {practice.route ? (
                          <button
                            onClick={() => router.push(practice.route!)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <RotateCcw size={14} />
                            Practice Again
                          </button>
                        ) : (
                          <a
                            href={practice.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                          >
                            <RotateCcw size={14} />
                            Practice Again
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-6 pb-2">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 group"
                  >
                    <span>Load More ({filteredAndSorted.length - visibleCount} remaining)</span>
                    <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
