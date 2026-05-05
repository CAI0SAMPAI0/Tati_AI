'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiGet, apiDelete, apiPut } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

import { 
  BookOpen, 
  Search, 
  Download, 
  Trash2, 
  CheckCircle2, 
  GraduationCap, 
  Sparkles,
  X,
  Brain,
  Edit2,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface VocabWord {
  id: string;
  term: string;
  translation?: string;
  example?: string;
  status: 'new' | 'learning' | 'learned';
}

interface VocabResponse {
  words: VocabWord[];
  total: number;
}

type FilterType = 'all' | 'learning' | 'learned' | 'new';

const filterLabels: Record<string, string> = {
  all: 'All',
  learning: 'Learning',
  learned: 'Learned',
  new: 'New'
};

export default function VocabPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ translation: string; example: string }>({ translation: '', example: '' });

  // SRS Data
  const { data: dueData = [] } = useQuery<any[]>({
    queryKey: ['due-vocab'],
    queryFn: () => apiGet<any[]>('/users/vocabulary/due'),
  });

  // Query vocabulary
  const { data, isLoading } = useQuery<VocabResponse>({
    queryKey: ['vocabulary'],
    queryFn: () => apiGet<VocabResponse>(ENDPOINTS.VOCABULARY),
  });

  const allWords = data?.words || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`${ENDPOINTS.VOCABULARY}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      toast.success('Word deleted.');
    },
    onError: () => toast.error('Error deleting word.')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => apiPut(`${ENDPOINTS.VOCABULARY}/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
      toast.success('Saved successfully!');
      setEditingId(null);
    },
    onError: () => toast.error('Error saving changes.')
  });

  const filteredWords = useMemo(() => {
    return allWords.filter(w => {
      const matchesSearch = w.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           w.translation?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' || w.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [allWords, searchTerm, filter]);

  const stats = useMemo(() => {
    return {
      total: allWords.length,
      learned: allWords.filter(w => w.status === 'learned').length,
      learning: allWords.filter(w => w.status === 'learning' || w.status === 'new').length,
    };
  }, [allWords]);

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Term,Translation,Example,Status\n"
      + allWords.map(w => `"${w.term}","${w.translation || ''}","${w.example || ''}","${w.status}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tati_vocabulary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startEditing = (word: VocabWord) => {
    setEditingId(word.id);
    setEditForm({
      translation: word.translation || '',
      example: word.example || ''
    });
  };

  const saveEdit = (word: VocabWord) => {
    updateMutation.mutate({
      id: word.id,
      payload: {
        ...word,
        translation: editForm.translation,
        example: editForm.example
      }
    });
  };


  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* SRS Banner */}
            {dueData.length > 0 && (
              <div className="bg-gradient-to-r from-primary to-accent p-6 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-primary/20 animate-in slide-in-from-top-4 duration-700">
                <div className="flex items-center gap-4 text-center md:text-left">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                    <Brain size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Daily Review Ready</h3>
                    <p className="text-white/80 text-sm font-medium">You have {dueData.length} words to review and strengthen your memory.</p>
                  </div>
                </div>
                <Button 
                  onClick={() => router.push('/vocab/review')}
                  className="bg-white text-primary hover:bg-white/90 font-bold px-8 py-6 rounded-2xl w-full md:w-auto"
                >
                  Start Review Now
                </Button>
              </div>
            )}

            {/* Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-text">
                  📝 My Vocabulary Notebook
                </h1>
                <p className="text-text-muted text-sm md:text-base">
                  Learned words and reviews
                </p>
              </div>
              <Button variant="secondary" onClick={handleExport} className="gap-2 rounded-xl">
                <Download size={18} />
                Export
              </Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard 
                label="Total Words" 
                value={stats.total} 
                icon={<BookOpen className="text-primary" size={24} />}
                color="bg-primary/10"
              />
              <SummaryCard 
                label="Learned" 
                value={stats.learned} 
                icon={<CheckCircle2 className="text-success" size={24} />}
                color="bg-success/10"
              />
              <SummaryCard 
                label="Learning" 
                value={stats.learning} 
                icon={<GraduationCap className="text-info" size={24} />}
                color="bg-info/10"
              />
            </div>

            {/* Controls */}
            <div className="bg-surface border border-border p-4 rounded-3xl space-y-4 shadow-sm">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-subtle" size={20} />
                <Input
                  placeholder="Search word..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 mb-0 bg-bg border-none focus:ring-2 focus:ring-primary/20 rounded-2xl"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['all', 'learning', 'learned', 'new'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all",
                      filter === f 
                        ? "bg-primary border-primary text-white shadow-glow" 
                        : "bg-bg border-border text-text-muted hover:border-primary/30 hover:text-primary"
                    )}
                  >
                    {filterLabels[f] || f}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="grid gap-3 pb-20 md:pb-8">
              <AnimatePresence mode="popLayout">
                {filteredWords.length > 0 ? (
                  filteredWords.map((word) => (
                    <motion.div
                      key={word.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="group bg-surface border border-border rounded-3xl p-5 md:p-6 flex items-start gap-4 transition-all hover:border-primary/30 hover:shadow-md"
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                        word.status === 'learned' ? "bg-success/10 text-success border-success/20" :
                        word.status === 'learning' ? "bg-info/10 text-info border-info/20" :
                        "bg-primary/10 text-primary border-primary/20"
                      )}>
                        {word.status === 'learned' ? <CheckCircle2 size={24} /> : <BookOpen size={24} />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-text truncate">{word.term}</h3>
                          <span className={cn(
                            "text-[0.6rem] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                            word.status === 'learned' ? "bg-success/10 text-success border-success/20" :
                            word.status === 'learning' ? "bg-info/10 text-info border-info/20" :
                            "bg-primary/10 text-primary border-primary/20"
                          )}>
                            {filterLabels[word.status] || word.status}
                          </span>
                        </div>
                        
                        {editingId === word.id ? (
                          <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                            <Input 
                              value={editForm.translation}
                              onChange={e => setEditForm(prev => ({ ...prev, translation: e.target.value }))}
                              placeholder="Translation"
                              className="bg-bg border-border text-sm"
                            />
                            <textarea 
                              value={editForm.example}
                              onChange={e => setEditForm(prev => ({ ...prev, example: e.target.value }))}
                              placeholder="Example sentence"
                              className="w-full p-3 bg-bg border border-border rounded-xl text-sm outline-none focus:border-primary/50 transition-all resize-none italic"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(word)} loading={updateMutation.isPending} className="gap-2">
                                <Save size={14} /> Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {word.translation && (
                              <p className="text-sm font-semibold text-primary/90">{word.translation}</p>
                            )}
                            {word.example && (
                              <div className="mt-3 p-4 bg-bg-secondary/50 rounded-2xl border border-border/50 italic text-sm text-text-muted relative group-hover:bg-bg-secondary transition-colors">
                                <Sparkles className="absolute -top-2 -left-2 text-primary opacity-30" size={18} />
                                "{word.example}"
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {editingId !== word.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary hover:bg-primary/10"
                            onClick={() => startEditing(word)}
                          >
                            <Edit2 size={18} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger hover:bg-danger/10"
                          onClick={() => {
                            if (confirm(`Delete "${word.term}"?`)) {
                              deleteMutation.mutate(word.id);
                            }
                          }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-20 bg-surface/50 border border-dashed border-border rounded-[2.5rem] space-y-4">
                    <div className="w-20 h-20 bg-bg-secondary rounded-3xl flex items-center justify-center mx-auto text-text-subtle">
                      <BookOpen size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-text font-bold">No words found</p>
                      <p className="text-text-muted text-sm px-10">
                        {allWords.length === 0 ? 'Start practicing in the chat with Teacher Tati to build your vocabulary.' : 'Try adjusting your search or filters.'}
                      </p>
                    </div>
                    {allWords.length > 0 && (
                      <Button variant="ghost" onClick={() => {setSearchTerm(''); setFilter('all');}} className="text-primary text-xs font-bold">
                        Clear all filters
                      </Button>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="p-6 bg-surface border border-border rounded-[2rem] flex items-center gap-5 transition-all hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[0.7rem] font-bold text-text-muted uppercase tracking-widest mb-1 leading-none">{label}</p>
        <p className="text-2xl font-display font-black text-text">{value}</p>
      </div>
    </div>
  );
}
