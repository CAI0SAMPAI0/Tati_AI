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
  Sparkles
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { ActivityCard } from '@/components/activities/activity-card';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';

type TabType = 'quiz' | 'flashcards' | 'simulations' | 'podcasts' | 'exercises';

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
}
interface SubmissionItem {
  id: string;
  created_at: string;
  score: number;
  status: string;
  activity_type?: string;
  module?: { title?: string };
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

export default function ActivitiesPage() {
  
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('quiz');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persistence: Load last tab on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tati_last_activity_tab');
      if (saved) {
        // Simple validation to ensure the saved value is a valid TabType
        if (['quiz', 'flashcards', 'simulations', 'podcasts', 'exercises'].includes(saved)) {
          // We set it inside a timeout or use a separate state to avoid hydration issues
          // But for now, we'll just update it in a useEffect below for safety
        }
      }
    }
  });

  // Effect to load and save
  useEffect(() => {
    const saved = localStorage.getItem('tati_last_activity_tab') as TabType;
    if (saved && saved !== activeTab) {
      setActiveTab(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('tati_last_activity_tab', activeTab);
  }, [activeTab]);

  // Fetching real data
  const { data: modules, isLoading: modulesLoading } = useQuery<ModuleItem[]>({
    queryKey: ['activities-modules'],
    queryFn: () => apiGet<ModuleItem[]>(ENDPOINTS.ACTIVITIES_MODULES),
  });
  const { data: simulationsRaw = [] } = useQuery<SimulationItem[]>({
    queryKey: ['activities-simulations'],
    queryFn: () => apiGet<SimulationItem[]>('/simulation/scenarios'),
  });
  const { data: podcastsRaw = [] } = useQuery<PodcastItem[]>({
    queryKey: ['activities-podcasts'],
    queryFn: () => apiGet<PodcastItem[]>(`/activities/podcasts/recommendations?lang=en-US`),
  });
  const { data: submissions = [] } = useQuery<SubmissionItem[]>({
    queryKey: ['activities-submissions'],
    queryFn: () => apiGet<SubmissionItem[]>('/activities/submissions/my'),
  });
  const { data: flashcardsRaw = [] } = useQuery<FlashcardDeck[]>({
    queryKey: ['activities-flashcards'],
    queryFn: () => apiGet<FlashcardDeck[]>('/activities/flashcards/my'),
  });
  const { data: userErrors = [] } = useQuery<UserError[]>({
    queryKey: ['activities-user-errors'],
    queryFn: () => apiGet<UserError[]>('/users/progress/errors/recent'),
  });

  const quizzes = useMemo(() => {
    if (!modules) return [];
    const list: Array<QuizItem & { module_title: string }> = [];
    modules.forEach(m => {
      if (m.id === PERSONALIZED_MODULE_ID) return;
      (m.quizzes || []).forEach((q) => {
        if (!searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          list.push({ 
            ...q, 
            module_title: m.title,
            user_status: m.user_status 
          });
        }
      });
    });
    return list;
  }, [modules, searchQuery]);

  const exercises = useMemo(() => {
    if (!modules) return [];
    const list: Array<QuizItem> = [];
    modules.forEach(m => {
      if (m.id !== PERSONALIZED_MODULE_ID) return;
      (m.quizzes || []).forEach((q) => {
        if (!searchQuery || q.title.toLowerCase().includes(searchQuery.toLowerCase())) {
          list.push(q);
        }
      });
    });
    return list;
  }, [modules, searchQuery]);

  const flashcards = useMemo(() => {
    if (!flashcardsRaw) return [];
    if (!searchQuery) return flashcardsRaw;
    return flashcardsRaw.filter(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flashcardsRaw, searchQuery]);

  const simulations = useMemo(() => {
    if (!simulationsRaw) return [];
    if (!searchQuery) return simulationsRaw;
    return simulationsRaw.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [simulationsRaw, searchQuery]);

  const podcasts = useMemo(() => {
    if (!podcastsRaw) return [];
    if (!searchQuery) return podcastsRaw;
    return podcastsRaw.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [podcastsRaw, searchQuery]);

  const tabs: Array<{ id: TabType; icon: React.ReactNode; label: string; count?: number }> = [
    { id: 'quiz', icon: <HelpCircle size={18} />, label: 'Quizzes', count: quizzes.length },
    { id: 'exercises', icon: <Sparkles size={18} />, label: 'AI Exercises', count: exercises.length },
    { id: 'flashcards', icon: <Layers size={18} />, label: 'Flashcards', count: flashcards.length },
    { id: 'simulations', icon: <Drama size={18} />, label: 'Simulations', count: simulations.length },
    { id: 'podcasts', icon: <Podcast size={18} />, label: 'Podcasts', count: podcasts.length },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">
                {'My Activities'}
              </h2>
              <p className="text-text-muted text-sm md:text-base max-w-2xl">
                {'Practice vocabulary, grammar and pronunciation. Earn points in the ranking!'}
              </p>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" size={18} />
              <input 
                type="text"
                placeholder={'Search activity...'}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </header>

          <nav className="flex gap-2 overflow-x-auto pb-1 mb-8 scrollbar-none border-b border-border sticky top-16 bg-bg/90 backdrop-blur-md z-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 px-5 py-3 rounded-t-xl text-sm font-bold transition-all whitespace-nowrap relative top-[1px]",
                  activeTab === tab.id
                    ? "bg-surface border-x border-t border-border text-primary border-b-bg"
                    : "text-text-muted hover:text-text border-x border-t border-transparent"
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
            {modulesLoading ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : (
              <>
                {activeTab === 'quiz' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.length > 0 ? quizzes.map((q) => (
                      <ActivityCard
                        key={q.id}
                        title={q.title}
                        description={q.description || 'Practice your knowledge about '}
                        type="quiz"
                        status={q.user_status?.is_done ? 'done' : 'new'}
                        score={q.user_status?.score}
                        onClick={() => router.push(`/quiz/${q.id}`)}
                        meta={[{ icon: <Layers size={14} />, label: (modules?.find(m => m.id === q.id || m.quizzes?.some(qz => qz.id === q.id))?.level || 'all') }]}
                      />
                    )) : (
                      <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                        {'No quizzes available.'}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'exercises' && (
                  <div className="space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {exercises.length > 0 ? exercises.map((q) => (
                        <ActivityCard
                          key={q.id}
                          title={q.title}
                          description={q.description || 'Personalized practice based on your mistakes.'}
                          type="quiz"
                          status={q.status === 'done' ? 'done' : 'new'}
                          onClick={() => router.push(`/quiz/${q.id}`)}
                        />
                      )) : (
                        <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30 px-8">
                          <Sparkles size={40} className="mx-auto mb-4 opacity-20" />
                          <p className="max-w-md mx-auto">{'No exercises generated yet. Keep chatting with Tati so she can identify areas for improvement!'}</p>
                        </div>
                      )}
                    </div>

                    {userErrors.length > 0 && (
                      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h4 className="text-lg font-bold flex items-center gap-2 mb-6">
                          <History size={20} className="text-primary" />
                          {'Your recent mistakes'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {userErrors.slice(0, 10).map((err) => (
                            <div key={err.id} className="bg-surface border border-border p-5 rounded-2xl space-y-3 hover:border-primary/20 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="text-[0.65rem] font-bold text-danger uppercase tracking-wider">Mistake</p>
                                  <p className="text-sm font-medium line-through opacity-50 italic">"{err.incorrect_text}"</p>
                                </div>
                                <span className="bg-primary/10 text-primary text-[0.6rem] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                                  {err.category || 'grammar'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[0.65rem] font-bold text-success uppercase tracking-wider">{'The correct form is:'}</p>
                                <p className="text-sm font-bold text-text">"{err.correct_text}"</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {podcasts.length > 0 ? podcasts.map((p) => (
                      <ActivityCard
                        key={p.id}
                        title={p.title}
                        description={p.description || 'Get ready to listen and practice.'}
                        imageUrl={p.thumbnail}
                        type="podcast"
                        onClick={() => router.push(`/podcasts/${p.id}`)}
                        actionLabel="Play"
                      />
                    )) : (
                      <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                        No podcasts available.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'flashcards' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {flashcards.length > 0 ? flashcards.map((f) => (
                      <ActivityCard
                        key={f.id}
                        title={f.title}
                        description={f.description || 'Your vocabulary flashcards will be generated here soon.'}
                        type="flashcard"
                        onClick={() => router.push(`/flashcards/${f.id}`)}
                        meta={[{ icon: <FileBox size={14} />, label: `${f.card_count} cards` }]}
                      />
                    )) : (
                      <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                        <Layers size={40} className="mx-auto mb-4 opacity-20" />
                        <p>No flashcards available.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'simulations' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {simulations.length > 0 ? simulations.map((s) => (
                      <ActivityCard
                        key={s.id}
                        title={s.name}
                        emoji={s.emoji || s.icon}
                        description={s.description || 'Choose a scenario and practice English in everyday situations'}
                        type="simulation"
                        onClick={() => router.push(`/voice?simulation_id=${s.id}`)}
                        meta={[{ icon: <Play size={14} />, label: s.difficulty || 'normal' }]}
                      />
                    )) : (
                      <div className="col-span-full py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
                        No simulations available.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            
            {submissions.length > 0 && activeTab === 'quiz' && (
              <div className="pt-12">
                <h4 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <History size={20} className="text-primary" />
                  Activities history
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {submissions.slice(0, 6).map((s) => (
                    <div key={s.id} className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{s.module?.title || 'Atividade'}</p>
                        <p className="text-[0.65rem] text-text-muted mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">
                          {s.score}/100
                        </span>
                        <span className={cn(
                          "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-tighter",
                          (s.status === 'corrected' || s.status === 'done' || s.activity_type === 'quiz') 
                            ? "bg-success/10 text-success border-success/20" 
                            : "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {s.activity_type === 'quiz' ? 'done' : s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
