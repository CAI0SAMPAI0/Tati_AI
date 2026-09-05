'use client';

import React, { useState } from 'react';
import { Target, Clock, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

interface LevelingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (totalQuestions: number) => Promise<void> | void;
  loading?: boolean;
}

interface OptionCard {
  count: number;
  label: string;
  time: string;
  desc: string;
  recommended?: boolean;
}

const QUESTION_OPTIONS: OptionCard[] = [
  {
    count: 4,
    label: '4 Perguntas',
    time: '~3 min',
    desc: 'Express • 1 pergunta de cada nível (A1, A2, B1, B2)',
  },
  {
    count: 8,
    label: '8 Perguntas',
    time: '~6 min',
    desc: 'Rápido • 2 perguntas de cada nível (A1, A2, B1, B2)',
    recommended: true,
  },
  {
    count: 12,
    label: '12 Perguntas',
    time: '~10 min',
    desc: 'Padrão • 3 perguntas de cada nível (A1, A2, B1, B2)',
  },
  {
    count: 16,
    label: '16 Perguntas',
    time: '~15 min',
    desc: 'Completo • 4 perguntas de cada nível (A1, A2, B1, B2)',
  },
  {
    count: 20,
    label: '20 Perguntas',
    time: '~20 min',
    desc: 'Aprofundado • 5 perguntas de cada nível (A1, A2, B1, B2)',
  },
];

export function LevelingModal({ isOpen, onClose, onStart, loading = false }: LevelingModalProps) {
  const [selectedCount, setSelectedCount] = useState<number>(8);
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (count: number) => {
    setSelectedCount(count);
    setIsCustom(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomValue(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 4 && num <= 24) {
      setSelectedCount(num);
    }
  };

  const handleConfirm = () => {
    const finalCount = isCustom && customValue ? parseInt(customValue, 10) : selectedCount;
    const safeCount = Math.max(4, Math.min(24, isNaN(finalCount) ? 8 : finalCount));
    onStart(safeCount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-sm">
              <Target size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                Desafio de Nivelamento CEFR
              </h2>
              <p className="text-xs text-text-muted">
                Avaliação oficial de proficiência (A1 a B2) com Teacher Tati
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">
              Quantas perguntas você deseja responder?
            </label>
            <p className="text-xs text-text-muted mb-3">
              As perguntas serão sorteadas e distribuídas de forma equilibrada entre os níveis A1, A2, B1 e B2.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUESTION_OPTIONS.map((opt) => {
                const isSelected = !isCustom && selectedCount === opt.count;
                return (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => handleSelect(opt.count)}
                    className={`relative text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                        : 'border-border/70 bg-surface hover:bg-surface-hover hover:border-border'
                    }`}
                  >
                    {opt.recommended && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-primary text-white shadow-xs">
                        Recomendado
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-sm text-text">{opt.label}</span>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Clock size={12} /> {opt.time}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}

              {/* Custom option */}
              <div
                onClick={() => setIsCustom(true)}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                  isCustom
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                    : 'border-border/70 bg-surface hover:bg-surface-hover hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-text">Número personalizado</span>
                  <span className="text-xs text-text-muted">4 a 24</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={4}
                    max={24}
                    placeholder="Ex: 10"
                    value={customValue}
                    onChange={handleCustomChange}
                    onFocus={() => setIsCustom(true)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-text-muted shrink-0">perguntas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips and Info */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-start gap-2.5 text-xs text-text">
              <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Sem enrolação:</strong> A Teacher Tati avaliará sua resposta com dicas gramaticais rápidas e seguirá direto para as próximas perguntas.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-text">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Comando /finish no chat:</strong> Quer parar antes? Basta digitar{' '}
                <code className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-bold text-primary">
                  /finish
                </code>{' '}
                no chat a qualquer momento. A IA avaliará o que você respondeu e dará nota 0 nas que faltaram.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-text">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Relatório em PDF por e-mail:</strong> Ao concluir, você receberá um diagnóstico detalhado com erros e correções no seu e-mail cadastrado.
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-surface flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Iniciando...
              </>
            ) : (
              <>
                <Target size={15} />
                Iniciar Desafio ({isCustom && customValue ? customValue : selectedCount} perguntas)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
