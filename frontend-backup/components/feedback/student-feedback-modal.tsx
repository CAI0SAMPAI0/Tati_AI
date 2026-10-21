'use client';

import React, { useState } from 'react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Star, MessageSquareHeart, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultArea?: string;
  activityId?: string;
  activityTitle?: string;
  cefrLevel?: string;
}

const AREAS = [
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'games', label: 'Jogos / Games' },
  { id: 'grammar', label: 'Gramática' },
  { id: 'listening', label: 'Listening / Áudio' },
  { id: 'reading', label: 'Reading / Leituras' },
  { id: 'simulations', label: 'Simulações com IA' },
  { id: 'music', label: 'Músicas / LingoClip' },
  { id: 'general', label: 'Geral / Aulas' },
];

export function StudentFeedbackModal({
  isOpen,
  onClose,
  defaultArea = 'general',
  activityId = '',
  activityTitle = '',
  cefrLevel = 'A1',
}: StudentFeedbackModalProps) {
  const [area, setArea] = useState(defaultArea);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Por favor, escreva uma mensagem ou sugestão.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost('/activities/student-feedback', {
        area,
        activity_id: activityId,
        activity_title: activityTitle,
        rating,
        comment: comment.trim(),
        cefr_level: cefrLevel,
      });

      toast.success('Feedback enviado para a Professora Tatiana! Obrigado!', {
        icon: '💌',
        duration: 4000,
      });
      setComment('');
      onClose();
    } catch {
      toast.error('Erro ao enviar feedback. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title="Enviar Feedback para a Tatiana"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <MessageSquareHeart size={20} />
          </div>
          <p className="text-xs text-text-subtle leading-relaxed">
            Sua opinião é fundamental para a Teacher Tatiana personalizar seus conteúdos e atividades!
          </p>
        </div>

        {/* Área / Categoria */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
            Área / Categoria
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AREAS.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setArea(a.id)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all border',
                  area === a.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-surface hover:bg-surface-hover text-text-muted border-border'
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Título da Atividade (se houver) */}
        {activityTitle && (
          <div className="bg-bg rounded-xl px-3 py-2 border border-border text-xs text-text-muted">
            <span className="font-semibold text-text">Atividade: </span>
            {activityTitle}
          </div>
        )}

        {/* Avaliação em Estrelas */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
            Como você avalia?
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map(star => {
              const active = (hoverRating !== null ? hoverRating : rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 active:scale-95 transition-transform"
                >
                  <Star
                    size={24}
                    className={cn(
                      'transition-colors',
                      active ? 'fill-amber-400 text-amber-400' : 'text-border fill-transparent'
                    )}
                  />
                </button>
              );
            })}
            <span className="text-xs font-bold text-amber-400 ml-2">
              {rating === 5 ? 'Excelente! 🌟' : rating === 4 ? 'Muito bom 👍' : rating === 3 ? 'Regular' : 'Precisa melhorar'}
            </span>
          </div>
        </div>

        {/* Comentário */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
            Seu recado / sugestão para a Tatiana:
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            placeholder="Conte o que achou, dúvidas ou ideias para próximas atividades..."
            className="w-full bg-bg border border-border rounded-2xl p-3.5 text-text text-sm placeholder:text-text-muted/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            required
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !comment.trim()} className="gap-2">
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send size={16} /> Enviar para a Tatiana
              </>
            )}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
