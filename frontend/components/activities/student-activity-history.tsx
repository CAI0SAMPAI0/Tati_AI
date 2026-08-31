'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CheckCircle2, Search, Filter, Calendar, Award, 
  ExternalLink, RotateCcw, BookOpen, Layers, Podcast, 
  Drama, Gamepad2, Newspaper 
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, any> = {
  grammar: BookOpen,
  vocabulary: Layers,
  listening: Podcast,
  reading: BookOpen,
  simulations: Drama,
  games: Gamepad2,
  news: Newspaper,
};

export function StudentActivityHistory({ onSelectActivity }: { onSelectActivity?: (item: any) => void }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: submissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['my-submissions'],
    queryFn: () => apiGet<any[]>('/activities/submissions/my'),
  });

  const categories = [
    { id: 'all', label: 'Todas' },
    { id: 'grammar', label: 'Gramática' },
    { id: 'vocabulary', label: 'Vocabulário' },
    { id: 'listening', label: 'Listening' },
    { id: 'reading', label: 'Reading' },
    { id: 'simulations', label: 'Simulações' },
    { id: 'games', label: 'Jogos' },
    { id: 'news', label: 'Notícias' },
  ];

  const filtered = useMemo(() => {
    return submissions.filter((sub: any) => {
      const type = (sub.activity_type || sub.category || '').toLowerCase();
      const title = (sub.metadata?.title || sub.metadata?.slug || sub.activity_type || '').toLowerCase();
      
      const matchCat = selectedCategory === 'all' || type.includes(selectedCategory);
      const matchSearch = !search.trim() || title.includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [submissions, selectedCategory, search]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const avg = total > 0 ? Math.round(submissions.reduce((acc: number, s: any) => acc + (s.score || 100), 0) / total) : 0;
    return { total, avg };
  }, [submissions]);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Total Concluídas</p>
              <p className="text-2xl font-black text-text mt-0.5">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Precisão / Média</p>
              <p className="text-2xl font-black text-text mt-0.5">{stats.avg}%</p>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Última Atividade</p>
              <p className="text-sm font-bold text-text mt-1 truncate">
                {submissions[0]?.created_at 
                  ? new Date(submissions[0].created_at).toLocaleDateString('pt-BR') 
                  : 'Nenhuma ainda'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Busca e Filtro */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar atividade realizada..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary transition-all"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto p-1 bg-bg-secondary rounded-xl">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                selectedCategory === cat.id
                  ? "bg-surface text-primary shadow-sm"
                  : "text-text-muted hover:text-text"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Atividades */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface animate-pulse rounded-2xl border border-border" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-2xl border border-dashed border-border">
          <p className="text-sm font-bold text-text">Nenhuma atividade encontrada</p>
          <p className="text-xs text-text-muted mt-1">Conclua atividades para construir seu histórico!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item: any) => {
            const Icon = CATEGORY_ICONS[item.activity_type] || BookOpen;
            const formattedDate = item.created_at
              ? new Date(item.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={item.id}
                className="p-4 bg-surface border border-border rounded-2xl flex items-center justify-between gap-4 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-text truncate">
                        {item.metadata?.title || item.metadata?.slug || item.activity_type?.toUpperCase()}
                      </h4>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full uppercase">
                        {item.score ?? 100}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                      <span className="capitalize">{item.activity_type}</span>
                      <span>•</span>
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.metadata?.url && (
                    <a
                      href={item.metadata.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-text-muted hover:text-primary rounded-xl hover:bg-bg-secondary transition-colors"
                      title="Abrir link original"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                  {onSelectActivity && (
                    <button
                      onClick={() => onSelectActivity(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <RotateCcw size={14} />
                      Refazer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
