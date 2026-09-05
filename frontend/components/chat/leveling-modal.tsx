'use client';

import React, { useState } from 'react';
import { Target, Clock, CheckCircle2, AlertCircle, Sparkles, X, MessageSquare, Mic } from 'lucide-react';

interface LevelingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (totalQuestions: number, mode: 'chat' | 'voice') => Promise<void> | void;
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
    label: '4 Questions',
    time: '~3 mins',
    desc: 'Express • 1 question per level (A1, A2, B1, B2)',
  },
  {
    count: 8,
    label: '8 Questions',
    time: '~6 mins',
    desc: 'Quick • 2 questions per level (A1, A2, B1, B2)',
    recommended: true,
  },
  {
    count: 12,
    label: '12 Questions',
    time: '~10 mins',
    desc: 'Standard • 3 questions per level (A1, A2, B1, B2)',
  },
  {
    count: 16,
    label: '16 Questions',
    time: '~15 mins',
    desc: 'Full • 4 questions per level (A1, A2, B1, B2)',
  },
  {
    count: 20,
    label: '20 Questions',
    time: '~20 mins',
    desc: 'In-depth • 5 questions per level (A1, A2, B1, B2)',
  },
];

export function LevelingModal({ isOpen, onClose, onStart, loading = false }: LevelingModalProps) {
  const [selectedCount, setSelectedCount] = useState<number>(8);
  const [customValue, setCustomValue] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');

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
    onStart(safeCount, mode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-surface border border-border/80 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
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
                CEFR English Leveling Challenge
              </h2>
              <p className="text-xs text-text-muted">
                Official proficiency assessment (A1 to B2) with Teacher Tati
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
          {/* Assessment Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">
              Choose your assessment format
            </label>
            <p className="text-xs text-text-muted mb-3">
              Select whether you prefer typing in the chat or speaking live via voice mode.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('chat')}
                className={`relative text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  mode === 'chat'
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                    : 'border-border/70 bg-surface hover:bg-surface-hover hover:border-border'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${mode === 'chat' ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text">Chat Mode</span>
                    {mode === 'chat' && (
                      <span className="text-[0.65rem] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Interactive chat with text and audio recording support.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('voice')}
                className={`relative text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                  mode === 'voice'
                    ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                    : 'border-border/70 bg-surface hover:bg-surface-hover hover:border-border'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${mode === 'voice' ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}>
                  <Mic size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text">Voice Mode</span>
                    {mode === 'voice' && (
                      <span className="text-[0.65rem] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Live speech conversation with real-time audio interaction.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">
              How many questions would you like to answer?
            </label>
            <p className="text-xs text-text-muted mb-3">
              Questions will be randomly drawn and balanced across CEFR levels (A1, A2, B1, and B2).
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
                        Recommended
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
                  <span className="font-bold text-sm text-text">Custom number</span>
                  <span className="text-xs text-text-muted">4 to 24</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={4}
                    max={24}
                    placeholder="e.g. 10"
                    value={customValue}
                    onChange={handleCustomChange}
                    onFocus={() => setIsCustom(true)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-text focus:outline-none focus:border-primary"
                  />
                  <span className="text-xs text-text-muted shrink-0">questions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips and Info */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <div className="flex items-start gap-2.5 text-xs text-text">
              <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Direct & focused:</strong> Teacher Tati will evaluate your answers with concise grammatical feedback and advance promptly to the next question.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-text">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>/finish command:</strong> Wish to conclude early? Simply say or type{' '}
                <code className="px-1.5 py-0.5 rounded bg-background border border-border font-mono font-bold text-primary">
                  /finish
                </code>{' '}
                at any time. Teacher Tati will grade your responses so far and record remaining questions as 0.
              </span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-text">
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Diagnostic PDF report by email:</strong> Upon completion, a detailed assessment breakdown with errors, corrections, and CEFR level will be delivered to your inbox.
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
            Cancel
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
                Starting...
              </>
            ) : (
              <>
                {mode === 'voice' ? <Mic size={15} /> : <Target size={15} />}
                Start in {mode === 'voice' ? 'Voice Mode' : 'Chat Mode'} ({isCustom && customValue ? customValue : selectedCount} questions)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
