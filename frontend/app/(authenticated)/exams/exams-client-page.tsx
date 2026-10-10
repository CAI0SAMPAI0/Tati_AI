'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { MainHeader } from '@/components/layout/main-header';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  TrendingUp,
  RotateCcw,
  Trophy,
  Flame,
  ShieldCheck,
  Award,
  Lightbulb,
  Check,
  BrainCircuit,
  BookmarkCheck,
  FileText,
  Headphones,
} from 'lucide-react';

// TYPES

interface ExamStatus {
  can_start: boolean;
  status: 'available' | 'locked' | 'in_progress' | 'forbidden' | string;
  days_remaining: number;
  next_available_date?: string | null;
  last_exam_date?: string | null;
  active_exam_id?: string | null;
  current_level: string;
  last_exam_evolution?: {
    score: number;
    level: string;
    total_questions: number;
    completed_at?: string;
    summary?: string;
    can_do_statements?: string[];
    skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
    points_to_improve?: string[];
  };
}

interface Question {
  id: string;
  type: string;
  question: string;
  points: number;
  options: string[];
  audio_url?: string | null;
  reading_text?: string | null;
}

interface ExamActive {
  exam_id: string;
  level: string;
  total_questions: number;
  started_at: string;
  questions: Question[];
}

interface CorrectionItem {
  question_id: string;
  question: string;
  type: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points_earned: number;
  explanation: string;
}

interface ExamResult {
  exam_id: string;
  score: number;
  passed: boolean;
  recommended_level?: string | null;
  xp_earned: number;
  next_exam_date: string;
  summary_feedback: string;
  can_do_statements?: string[];
  points_to_improve?: string[];
  skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
  corrections: CorrectionItem[];
}

interface HistoryItem {
  id: string;
  level: string;
  score: number;
  passed: boolean;
  completed_at: string;
  total_questions: number;
  feedback?: string;
  can_do_statements?: string[];
  skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
  points_to_improve?: string[];
}

export default function ExamsClientPage() {
  const { sidebarOpen, toggleSidebar, closeSidebar } = useSidebarState();
  const { user } = useAuth();

  // Estados principais da tela
  const [view, setView] = useState<'dashboard' | 'taking' | 'result'>('dashboard');
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Estados do exame ativo
  const [activeExam, setActiveExam] = useState<ExamActive | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Estados do resultado
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Carrega status e histórico
  const fetchStatusAndHistory = async () => {
    try {
      setLoadingStatus(true);
      const [statusData, historyData] = await Promise.all([
        apiGet<ExamStatus>(ENDPOINTS.EXAMS_TRIMESTRAL_STATUS),
        apiGet<HistoryItem[]>(ENDPOINTS.EXAMS_TRIMESTRAL_HISTORY),
      ]);

      if (statusData) {
        setStatus(statusData);
      }
      if (Array.isArray(historyData)) {
        setHistory(historyData);
      }
    } catch (err) {
      console.error('[Exams] Erro ao carregar dados:', err);
      toast.error('Erro ao carregar status do exame trimestral.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatusAndHistory();
  }, []);

  // Iniciar Exame
  const handleStartExam = async (force: boolean = false) => {
    try {
      setIsStarting(true);
      const res = await apiPost<ExamActive>(ENDPOINTS.EXAMS_TRIMESTRAL_START, {
        num_questions: 10,
        force,
      });

      if (res.ok && res.data) {
        setActiveExam(res.data);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setView('taking');
        toast.success('Exame Trimestral iniciado! Boa sorte!');
      } else {
        const errDetail = (res as any)?.data?.detail || 'Não foi possível iniciar o exame.';
        toast.error(errDetail);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao conectar ao servidor para gerar o exame.');
    } finally {
      setIsStarting(false);
    }
  };

  // Retomar Exame em Andamento
  const handleResumeActiveExam = async () => {
    try {
      setIsStarting(true);
      const res = await apiGet<ExamActive>(ENDPOINTS.EXAMS_TRIMESTRAL_CURRENT);
      if (res && res.exam_id) {
        setActiveExam(res);
        setCurrentQuestionIndex(0);
        setView('taking');
      } else {
        handleStartExam(false);
      }
    } catch {
      handleStartExam(false);
    } finally {
      setIsStarting(false);
    }
  };

  // Submeter Exame
  const handleSubmitExam = async () => {
    if (!activeExam) return;

    const answeredCount = Object.keys(answers).length;
    const totalCount = activeExam.questions.length;

    if (answeredCount < totalCount) {
      const confirmSubmit = window.confirm(
        `Você respondeu ${answeredCount} de ${totalCount} questões. Deseja finalizar mesmo com questões em branco?`
      );
      if (!confirmSubmit) return;
    }

    try {
      setIsSubmitting(true);
      const payloadAnswers = Object.entries(answers).map(([qId, val]) => ({
        question_id: qId,
        answer: val,
      }));

      const res = await apiPost<ExamResult>(ENDPOINTS.EXAMS_TRIMESTRAL_SUBMIT, {
        exam_id: activeExam.exam_id,
        answers: payloadAnswers,
      });

      if (res.ok && res.data) {
        setExamResult(res.data);
        setView('result');
        toast.success(`Exame concluído! Você obteve ${res.data.score}% de aproveitamento! 🎉`);
        fetchStatusAndHistory();
      } else {
        toast.error('Erro ao submeter as respostas do exame.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao enviar respostas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset para Desenvolvimento
  const handleResetDev = async () => {
    if (!window.confirm('Deseja resetar o ciclo de exames para poder testar novamente de imediato?')) return;
    try {
      const res = await apiPost<{ success: boolean; message: string }>(ENDPOINTS.EXAMS_TRIMESTRAL_RESET, {});
      if (res.ok) {
        toast.success('Exames resetados! Ciclo liberado para novo teste.');
        setView('dashboard');
        setActiveExam(null);
        setExamResult(null);
        fetchStatusAndHistory();
      }
    } catch {
      toast.error('Erro ao resetar exames.');
    }
  };

  // Helper de formatação de data
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--/--/----';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Habilidades consolidadas da última avaliação ou histórico
  const latestEvolution = status?.last_exam_evolution || (history.length > 0 ? history[0] : null);

  // ==============================================================================
  // RENDER: TELA DE REALIZAÇÃO DO EXAME
  // ==============================================================================
  if (view === 'taking' && activeExam) {
    const currentQ = activeExam.questions[currentQuestionIndex];
    const progressPercent = Math.round(((currentQuestionIndex + 1) / activeExam.total_questions) * 100);

    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <MainHeader onToggleMenu={toggleSidebar} />

        <div className="flex-1 flex max-w-5xl w-full mx-auto p-4 md:p-8 flex-col">
          {/* Header do Exame com Progresso */}
          <div className="bg-surface border border-border rounded-2xl p-4 md:p-6 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h1 className="font-bold text-lg text-text">Exame Trimestral CEFR</h1>
                  <p className="text-xs text-text-muted">Nível de Avaliação: <span className="font-bold text-primary">{activeExam.level}</span></p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold text-text-muted">
                <span>Questão <strong className="text-primary text-sm">{currentQuestionIndex + 1}</strong> de {activeExam.total_questions}</span>
                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-border" />
                <span className="text-success flex items-center gap-1 font-bold">
                  <Check size={14} /> {Object.keys(answers).length} respondidas
                </span>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-bg-secondary h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Card da Questão */}
          {currentQ && (
            <div className="bg-surface border border-border rounded-3xl p-5 md:p-8 shadow-sm flex-1 flex flex-col justify-between">
              <div>
                {/* Tipo de Questão (Badge) */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className={cn(
                    "text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider",
                    currentQ.type === 'reading' && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                    currentQ.type === 'grammar' && "bg-purple-500/10 text-purple-500 border border-purple-500/20",
                    currentQ.type === 'vocabulary' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                    currentQ.type === 'listening' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                  )}>
                    {currentQ.type === 'reading' ? '📖 Reading Comprehension' :
                     currentQ.type === 'grammar' ? '⚡ Grammar' :
                     currentQ.type === 'vocabulary' ? '✨ Vocabulary' :
                     currentQ.type === 'listening' ? '🎧 Listening & Dialogue' : currentQ.type}
                  </span>
                  <span className="text-xs font-bold text-text-muted">10 pontos</span>
                </div>

                {/* Bloco de Reading Comprehension (quando aplicável) */}
                {currentQ.reading_text && (
                  <div className="bg-bg-secondary/60 border border-border rounded-2xl p-5 md:p-6 mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                      <BookOpen size={16} className="text-primary" />
                      Texto para Leitura e Interpretação:
                    </div>
                    <p className="text-sm md:text-base leading-relaxed text-text font-serif italic">
                      &quot;{currentQ.reading_text}&quot;
                    </p>
                  </div>
                )}

                {/* Bloco de Diálogo / Listening (quando aplicável) */}
                {(currentQ as any).audio_text && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 md:p-6 mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">
                      <Headphones size={16} />
                      Diálogo em Inglês:
                    </div>
                    <p className="text-sm md:text-base leading-relaxed text-text font-mono">
                      {(currentQ as any).audio_text}
                    </p>
                  </div>
                )}

                {/* Enunciado da Pergunta */}
                <h2 className="text-base md:text-xl font-bold text-text mb-6">
                  {currentQ.question}
                </h2>

                {/* Opções de Resposta (Marcar X com visual elegante) */}
                <div className="space-y-3 mb-8">
                  {currentQ.options.map((optionText, optIdx) => {
                    const isSelected = answers[currentQ.id] === optionText;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: optionText }))}
                        className={cn(
                          "w-full text-left p-4 md:p-5 rounded-2xl border transition-all flex items-center justify-between group",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                            : "border-border bg-bg-secondary/40 hover:bg-surface-hover hover:border-primary/40 text-text"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <span className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-surface border border-border text-text-muted group-hover:border-primary group-hover:text-primary"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className={cn(
                            "text-sm md:text-base font-medium",
                            isSelected ? "text-primary font-bold" : "text-text"
                          )}>
                            {optionText}
                          </span>
                        </div>

                        <div className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-border group-hover:border-primary"
                        )}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões de Ação na Base */}
              <div className="pt-4 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-border font-bold text-sm text-text-muted hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ChevronLeft size={18} /> Anterior
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {currentQuestionIndex < activeExam.total_questions - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((prev) => Math.min(activeExam.total_questions - 1, prev + 1))}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-sm flex items-center justify-center gap-2"
                    >
                      Próxima <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitExam}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-3 rounded-xl bg-success text-white font-bold text-sm hover:opacity-90 shadow-md flex items-center justify-center gap-2 animate-pulse"
                    >
                      {isSubmitting ? (
                        <>Processando resultado...</>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> Finalizar e Ver Resultado
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==============================================================================
  // RENDER: TELA DE RESULTADO & FEEDBACK PEDAGÓGICO
  // ==============================================================================
  if (view === 'result' && examResult) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <MainHeader onToggleMenu={toggleSidebar} />

        <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
          {/* Banner de Resultado */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-10 shadow-sm text-center mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-purple-500 to-success" />

            <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-inner">
              <Trophy size={40} className="text-primary animate-bounce" />
            </div>

            <span className={cn(
              "text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-wider inline-block mb-3",
              examResult.passed ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"
            )}>
              {examResult.passed ? '🎉 Aprovado na Avaliação Trimestral' : '📚 Avaliação Concluída'}
            </span>

            <h1 className="text-3xl md:text-5xl font-black text-text mb-2 tracking-tight">
              {examResult.score}% <span className="text-xl md:text-2xl font-normal text-text-muted">de aproveitamento</span>
            </h1>

            <p className="text-sm md:text-base text-text-muted max-w-xl mx-auto mb-6 leading-relaxed">
              {examResult.summary_feedback}
            </p>

            {/* Badges de Conquistas */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-6">
              <div className="bg-bg-secondary px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-sm font-bold">
                <Flame size={18} className="text-amber-500" />
                <span>+{examResult.xp_earned} XP Conquistados</span>
              </div>

              {examResult.recommended_level && (
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl flex items-center gap-2 border border-primary/20 text-sm font-bold">
                  <Sparkles size={18} />
                  <span>Recomendado para o nível {examResult.recommended_level}!</span>
                </div>
              )}

              <div className="bg-bg-secondary px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-sm font-bold text-text-muted">
                <Calendar size={18} className="text-primary" />
                <span>Próximo teste: {formatDate(examResult.next_exam_date)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setView('dashboard')}
              className="px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-md inline-flex items-center gap-2"
            >
              Ver Meu Painel de Evolução <ArrowRight size={18} />
            </button>
          </div>

          {/* O Que Você Já Domina (Can-Do Statements) */}
          {examResult.can_do_statements && examResult.can_do_statements.length > 0 && (
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center font-bold">
                  <BookmarkCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-text">Habilidades Demonstradas no Teste</h2>
                  <p className="text-xs text-text-muted">Competências CEFR validadas neste trimestre</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {examResult.can_do_statements.map((statement, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-bg-secondary/60 border border-border">
                    <div className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <p className="text-sm font-medium text-text leading-snug">{statement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gabarito e Correções Detalhadas Questão por Questão */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg md:text-xl font-bold text-text mb-2 flex items-center gap-2">
              <FileText size={20} className="text-primary" /> Revisão e Gabarito do Exame
            </h2>
            <p className="text-xs text-text-muted mb-6">Confira as explicações didáticas da Teacher Tati para cada alternativa</p>

            <div className="space-y-4">
              {examResult.corrections.map((corr, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-5 rounded-2xl border transition-all",
                    corr.is_correct
                      ? "border-success/30 bg-success/5"
                      : "border-danger/30 bg-danger/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Questão {idx + 1} • {corr.type}
                    </span>
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1",
                      corr.is_correct
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-danger/10 text-danger border border-danger/20"
                    )}>
                      {corr.is_correct ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {corr.is_correct ? 'Correta (+10 pts)' : 'Incorreta (0 pts)'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-text mb-3">{corr.question}</p>

                  <div className="text-xs space-y-1 mb-3">
                    <p className="text-text-muted">
                      Sua resposta: <strong className={corr.is_correct ? "text-success" : "text-danger"}>{corr.student_answer || '(em branco)'}</strong>
                    </p>
                    {!corr.is_correct && (
                      <p className="text-text-muted">
                        Resposta correta: <strong className="text-success">{corr.correct_answer}</strong>
                      </p>
                    )}
                  </div>

                  <div className="bg-bg/60 p-3 rounded-xl border border-border text-xs text-text-muted flex items-start gap-2">
                    <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
                    <span><strong>Explicação:</strong> {corr.explanation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================================
  // RENDER: DASHBOARD DO EXAME TRIMESTRAL & PAINEL DE EVOLUÇÃO
  // ==============================================================================
  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-clip text-text">
      <SidebarActivities isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={toggleSidebar} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">
          {/* Header da Página */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
                <GraduationCap size={16} /> Avaliação Periódica • A Cada 3 Meses
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-text tracking-tight">
                Exame Trimestral CEFR
              </h1>
              <p className="text-xs md:text-sm text-text-muted">
                Acompanhe a sua evolução real em Reading, Grammar e Vocabulary a cada 3 meses com métricas oficiais.
              </p>
            </div>

            {/* Ações / Status Badge */}
            {status && (
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-text-muted flex items-center gap-2 shadow-sm">
                  <span>Nível Atual:</span>
                  <strong className="text-primary text-sm">{status.current_level}</strong>
                </span>

                {/* Botão de Reset (Dev) */}
                <button
                  type="button"
                  onClick={handleResetDev}
                  title="Resetar ciclo de exames para testar novamente (Dev)"
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-primary hover:border-primary/40 flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw size={13} /> Resetar (Dev)
                </button>
              </div>
            )}
          </div>

          {/* CARD DE STATUS PRINCIPAL */}
          {loadingStatus ? (
            <div className="h-44 bg-surface border border-border rounded-3xl animate-pulse flex items-center justify-center">
              <span className="text-xs text-text-muted font-bold">Carregando status do exame trimestral...</span>
            </div>
          ) : status?.status === 'in_progress' ? (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-surface border border-amber-500/30 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Clock size={16} /> Exame em Andamento
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text">Você tem uma avaliação trimestral ativa</h2>
                <p className="text-xs md:text-sm text-text-muted max-w-xl">
                  Suas perguntas já foram geradas. Continue de onde parou para registrar sua evolução trimestral e garantir seus pontos de XP!
                </p>
              </div>

              <button
                type="button"
                onClick={handleResumeActiveExam}
                disabled={isStarting}
                className="px-8 py-3.5 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:opacity-90 shadow-md shrink-0 flex items-center gap-2"
              >
                {isStarting ? 'Carregando...' : <>Continuar Exame <ArrowRight size={18} /></>}
              </button>
            </div>
          ) : status?.can_start ? (
            <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-surface border border-primary/30 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Sparkles size={16} /> Liberado para Realização
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text">Seu Exame Trimestral está disponível!</h2>
                <p className="text-xs md:text-sm text-text-muted max-w-xl leading-relaxed">
                  Avaliação oficial com 8 a 15 questões personalizadas para o nível <strong>{status.current_level}</strong>. 
                  Responda textos de leitura fáceis e questões objetivas sem pegadinhas. Duração média: 15 minutos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleStartExam(false)}
                disabled={isStarting}
                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-primary/20 shrink-0 flex items-center gap-2.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isStarting ? 'Gerando questões...' : (
                  <>
                    <GraduationCap size={20} /> Iniciar Exame Trimestral <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                    <Clock size={16} className="text-primary" /> Ciclo de 3 Meses em Andamento
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-text">
                    Próximo exame liberado em <span className="text-primary">{status?.days_remaining ?? 90} dias</span>
                  </h2>
                  <p className="text-xs md:text-sm text-text-muted max-w-xl">
                    Data prevista de liberação: <strong>{formatDate(status?.next_available_date)}</strong>. Continue praticando suas atividades diárias e acumulando streak enquanto isso!
                  </p>

                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleStartExam(true)}
                      disabled={isStarting}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Sparkles size={14} /> {isStarting ? 'Gerando questões...' : 'Iniciar Agora (Bypass Dev)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDev}
                      className="px-4 py-2 rounded-xl border border-border text-text-muted hover:text-primary text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} /> Resetar Ciclo
                    </button>
                  </div>
                </div>

                {/* Mini Progresso dos 90 dias */}
                <div className="w-full md:w-64 bg-bg-secondary p-4 rounded-2xl border border-border">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-text-muted">Ciclo Trimestral</span>
                    <span className="text-primary">{Math.max(0, 90 - (status?.days_remaining ?? 90))}/90 dias</span>
                  </div>
                  <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(5, ((90 - (status?.days_remaining ?? 90)) / 90) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAINEL DE EVOLUÇÃO DO ALUNO ("O QUE VOCÊ JÁ SABE FAZER") */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1 e 2: Competências Demonstradas & Can-Do Descriptors */}
            <div className="lg:col-span-2 bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <BrainCircuit size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-text">O Que Você Já Domina</h2>
                    <p className="text-xs text-text-muted">Habilidades comunicativas comprovadas nos seus testes</p>
                  </div>
                </div>

                {latestEvolution && (
                  <span className="text-xs font-bold px-3 py-1 bg-bg-secondary border border-border rounded-xl text-text-muted">
                    Nível {latestEvolution.level} • {latestEvolution.score}%
                  </span>
                )}
              </div>

              {latestEvolution?.can_do_statements && latestEvolution.can_do_statements.length > 0 ? (
                <div className="space-y-3">
                  {latestEvolution.can_do_statements.map((statement, idx) => (
                    <div key={idx} className="flex items-start gap-3.5 p-4 rounded-2xl bg-bg-secondary/40 border border-border hover:border-primary/30 transition-all">
                      <div className="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <p className="text-sm font-medium text-text leading-relaxed">
                        {statement}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-bg-secondary/30 rounded-2xl border border-dashed border-border text-text-muted text-sm">
                  <Lightbulb size={28} className="mx-auto mb-2 text-primary opacity-60" />
                  <p className="font-semibold text-text">Nenhuma avaliação trimestral registrada ainda.</p>
                  <p className="text-xs mt-1">Assim que você concluir seu primeiro teste trimestral, este painel listará exatamente tudo o que você aprendeu a fazer em inglês!</p>
                </div>
              )}

              {/* Dica da Teacher Tati para o Trimestre */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs text-text-muted">
                <Lightbulb size={18} className="text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Diretriz Pedagógica CEFR:</strong> Nosso exame trimestral mede sua evolução através dos descritores oficiais do Conselho da Europa. Cada acerto reflete uma habilidade comunicativa real do seu dia a dia.
                </span>
              </div>
            </div>

            {/* Coluna 3: Aproveitamento por Competência (Skills Breakdown) */}
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-text">Domínio por Área</h2>
                    <p className="text-xs text-text-muted">Aproveitamento no último exame</p>
                  </div>
                </div>

                {latestEvolution?.skills_breakdown && Object.keys(latestEvolution.skills_breakdown).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(latestEvolution.skills_breakdown).map(([key, skillData]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-text">{skillData.label}</span>
                          <span className="text-primary">{skillData.percentage}% ({skillData.correct}/{skillData.total})</span>
                        </div>
                        <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              skillData.percentage >= 80 ? "bg-success" :
                              skillData.percentage >= 60 ? "bg-primary" : "bg-warning"
                            )}
                            style={{ width: `${skillData.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-text-muted">
                    Faça seu teste trimestral para visualizar a divisão gráfica entre Leitura, Gramática e Vocabulário.
                  </div>
                )}
              </div>

              <div className="bg-bg-secondary p-4 rounded-2xl border border-border text-center">
                <span className="text-xs text-text-muted block mb-1">Última Nota Geral</span>
                <span className="text-2xl font-black text-primary">
                  {latestEvolution?.score !== undefined ? `${latestEvolution.score}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* LINHA DO TEMPO TRIMESTRAL (HISTÓRICO) */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Award size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-text">Histórico de Exames Trimestrais</h2>
                  <p className="text-xs text-text-muted">Sua linha do tempo de evolução a cada 3 meses</p>
                </div>
              </div>

              <span className="text-xs font-bold text-text-muted">
                {history.length} {history.length === 1 ? 'exame realizado' : 'exames realizados'}
              </span>
            </div>

            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((hItem, idx) => (
                  <div
                    key={hItem.id || idx}
                    className="p-5 rounded-2xl bg-bg-secondary/40 border border-border hover:border-primary/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                          Nível {hItem.level}
                        </span>
                        <span className="text-xs text-text-muted font-bold flex items-center gap-1">
                          <Calendar size={13} /> {formatDate(hItem.completed_at)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text max-w-xl">
                        {hItem.feedback || 'Avaliação concluída com sucesso.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-xl font-black text-primary block leading-none">{hItem.score}%</span>
                        <span className="text-[10px] text-text-muted font-bold uppercase">{hItem.passed ? 'Aprovado' : 'Concluído'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-bg-secondary/20 rounded-2xl border border-dashed border-border text-text-muted text-xs">
                Nenhum histórico passado ainda. Seu primeiro exame aparecerá registrado aqui.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
