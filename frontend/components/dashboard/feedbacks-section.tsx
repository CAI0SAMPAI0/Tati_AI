'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { 
  MessageSquareHeart, 
  Search, 
  Filter, 
  Star, 
  CheckCircle2, 
  Clock, 
  Send, 
  Layers, 
  Gamepad2, 
  BookOpen, 
  Headphones, 
  Drama, 
  Music,
  Check,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';
import toast from 'react-hot-toast';

interface StudentFeedbackItem {
  id: string;
  student_username: string;
  student_name: string;
  cefr_level: string;
  area: string;
  activity_id?: string;
  activity_title?: string;
  rating: number;
  comment: string;
  teacher_reply?: string;
  status: string;
  created_at?: string;
}

const AREAS = [
  { id: 'all', label: 'Todas as Áreas', icon: Filter },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'games', label: 'Jogos / Games', icon: Gamepad2 },
  { id: 'grammar', label: 'Gramática', icon: BookOpen },
  { id: 'listening', label: 'Listening', icon: Headphones },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'simulations', label: 'Simulações IA', icon: Drama },
  { id: 'music', label: 'Músicas', icon: Music },
  { id: 'general', label: 'Geral', icon: MessageSquareHeart },
];

export function FeedbacksSection() {
  const queryClient = useQueryClient();
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  const { data: rawFeedbacks = [], isLoading, refetch } = useQuery<StudentFeedbackItem[]>({
    queryKey: ['admin-student-feedbacks', filterLevel, filterArea, filterStatus, searchStudent],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.append('level', filterLevel);
      if (filterArea !== 'all') params.append('area', filterArea);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (searchStudent.trim()) params.append('student', searchStudent.trim());

      const url = `/dashboard/feedbacks?${params.toString()}`;
      return apiGet<StudentFeedbackItem[]>(url);
    },
  });

  const feedbacks = Array.isArray(rawFeedbacks) ? rawFeedbacks : [];

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { status?: string; teacher_reply?: string } }) => {
      return apiPatch(`/dashboard/feedbacks/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-student-feedbacks'] });
      toast.success('Feedback atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar feedback.');
    },
  });

  const handleToggleStatus = (item: StudentFeedbackItem) => {
    const newStatus = item.status === 'reviewed' ? 'pending' : 'reviewed';
    updateMutation.mutate({ id: item.id, updates: { status: newStatus } });
  };

  const handleSaveReply = (id: string) => {
    const text = replyTexts[id];
    if (text === undefined) return;
    updateMutation.mutate({ id, updates: { teacher_reply: text } });
  };

  const getAreaBadge = (areaKey: string) => {
    const matched = AREAS.find(a => a.id === areaKey.toLowerCase());
    return matched ? matched.label : areaKey;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageSquareHeart size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Feedbacks dos Alunos</h1>
            <p className="text-sm text-text-muted">
              Acompanhe as opiniões, avaliações e sugestões enviadas pelos alunos sobre as atividades.
            </p>
          </div>
        </div>

        <Button variant="secondary" onClick={() => refetch()} className="gap-2 shrink-0">
          <RefreshCw size={16} /> Atualizar
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-3xl p-4 md:p-6 shadow-sm space-y-4">
        {/* Row 1: Search + Status */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              placeholder="Buscar por nome ou usuário do aluno..."
              className="w-full bg-bg border border-border rounded-2xl pl-10 pr-4 py-2.5 text-sm text-text outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-text-muted/40"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-bg border border-border rounded-2xl px-4 py-2.5 text-sm text-text font-medium outline-none focus:border-primary"
            >
              <option value="all">Todos os Status</option>
              <option value="pending">Pendentes</option>
              <option value="reviewed">Revisados</option>
            </select>

            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="bg-bg border border-border rounded-2xl px-4 py-2.5 text-sm text-text font-medium outline-none focus:border-primary"
            >
              <option value="all">Todos os Níveis</option>
              {LEVEL_OPTIONS.map(lvl => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Area Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider shrink-0 mr-1">
            Área:
          </span>
          {AREAS.map(a => {
            const Icon = a.icon;
            const active = filterArea === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setFilterArea(a.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border',
                  active
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-bg hover:bg-surface-hover text-text-muted border-border'
                )}
              >
                <Icon size={14} />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedbacks Grid / List */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="bg-surface border border-border rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <MessageSquareHeart size={44} className="mx-auto text-text-muted/40" />
          <h3 className="text-base font-bold text-text">Nenhum feedback encontrado</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            Não há feedbacks com os filtros selecionados ou os alunos ainda não enviaram recados nesta categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedbacks.map(item => {
            const isReviewed = item.status === 'reviewed';
            return (
              <div
                key={item.id}
                className={cn(
                  'bg-surface border rounded-3xl p-5 md:p-6 shadow-sm transition-all space-y-4 flex flex-col justify-between',
                  isReviewed ? 'border-border/80 bg-surface/80' : 'border-primary/40 bg-surface ring-1 ring-primary/10'
                )}
              >
                <div className="space-y-3">
                  {/* Top line: Student, Level, Area, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-accent text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-sm">
                        {(item.student_name || item.student_username || 'A')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-text text-sm truncate">
                          {item.student_name || item.student_username}
                        </h4>
                        <span className="text-xs text-text-muted">@{item.student_username}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-primary/10 text-primary border border-primary/20">
                        {item.cefr_level || 'A1'}
                      </span>
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border',
                          isReviewed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                        )}
                        title={isReviewed ? 'Clique para marcar como pendente' : 'Clique para marcar como revisado'}
                      >
                        {isReviewed ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        <span>{isReviewed ? 'Revisado' : 'Pendente'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Metadata: Area + Activity + Rating */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-bg border border-border text-text">
                      {getAreaBadge(item.area)}
                    </span>
                    {item.activity_title && (
                      <span className="px-2.5 py-1 rounded-xl text-xs bg-bg border border-border text-text-muted truncate max-w-[200px]">
                        {item.activity_title}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 ml-auto">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          size={14}
                          className={cn(
                            star <= item.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-border fill-transparent'
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Comment Box */}
                  <div className="bg-bg rounded-2xl p-4 border border-border/70 text-sm text-text leading-relaxed whitespace-pre-wrap">
                    &ldquo;{item.comment}&rdquo;
                  </div>

                  {/* Teacher Reply Section */}
                  {item.teacher_reply && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 text-xs space-y-1">
                      <span className="font-bold text-primary block">Resposta da Tatiana:</span>
                      <p className="text-text-subtle leading-relaxed whitespace-pre-wrap">{item.teacher_reply}</p>
                    </div>
                  )}
                </div>

                {/* Bottom line: Date + Reply input / toggle */}
                <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>

                  {/* Input to write/update Tatiana's response */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Responder ou deixar anotação pedagógica..."
                      value={replyTexts[item.id] !== undefined ? replyTexts[item.id] : item.teacher_reply || ''}
                      onChange={e => setReplyTexts(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="flex-1 bg-bg border border-border rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-primary"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveReply(item.id)}
                      disabled={updateMutation.isPending}
                      className="px-3 text-xs gap-1.5 h-8 shrink-0"
                    >
                      <Send size={12} /> Salvar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
