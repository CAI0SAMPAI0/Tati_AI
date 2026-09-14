'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Send,
  Volume2,
  Square,
  Mic,
  MicOff,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Award,
  FileText,
  Download,
  User,
  Mail,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Flag,
} from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/spinner';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  audio_b64?: string;
  isInitial?: boolean;
}

interface ScoreBreakdown {
  [level: string]: { correct: number; total: number };
}

export default function PublicCefrTestPage() {
  const router = useRouter();
  const { saveSession } = useAuth();

  // Test state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [accent, setAccent] = useState<'en-US' | 'en-GB'>('en-US');
  const [isCompleted, setIsCompleted] = useState(false);
  const [assessedLevel, setAssessedLevel] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreBreakdown | null>(null);

  // Audio player state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Speech Recognition (Dictation)
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Completion Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [wantAccount, setWantAccount] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [downloadPdfB64, setDownloadPdfB64] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Audio cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Força tema claro no teste CEFR para manter harmonia visual com a landing page
  useEffect(() => {
    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains('dark');
    const prevTheme = htmlEl.getAttribute('data-theme');

    htmlEl.classList.remove('dark');
    htmlEl.setAttribute('data-theme', 'light');
    htmlEl.style.colorScheme = 'light';

    return () => {
      if (wasDark) {
        htmlEl.classList.add('dark');
      }
      if (prevTheme) {
        htmlEl.setAttribute('data-theme', prevTheme);
      } else {
        htmlEl.removeAttribute('data-theme');
      }
      htmlEl.style.colorScheme = '';
    };
  }, []);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = accent === 'en-GB' ? 'en-GB' : 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsRecording(false);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [accent]);

  // Start leveling session on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setIsInitializing(true);
        const res = await apiPost<any>(ENDPOINTS.LEVELING_PUBLIC_START, {
          total_questions: 8,
          accent: accent,
        });

        if (!isMounted) return;

        const data = res.data;
        setSessionId(data.session_id);
        setCurrentQuestion(data.current_question || 1);
        setTotalQuestions(data.total_questions || 8);

        const initialMsg: Message = {
          id: 'welcome',
          role: 'assistant',
          content: data.reply,
          audio_b64: data.audio_b64,
          isInitial: true,
        };
        setMessages([initialMsg]);

        // Auto play welcoming audio
        if (data.audio_b64) {
          playAudio(data.audio_b64, 'welcome');
        }
      } catch (err: any) {
        toast.error('Erro ao iniciar o teste. Tentando novamente...');
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [accent]);

  // Stop currently playing audio
  const stopAudio = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    } catch {
      // ignore
    }
    setPlayingAudioId(null);
  };

  // Play base64 audio
  const playAudio = (b64: string, id: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      const audioUrl = b64.startsWith('data:audio') ? b64 : `data:audio/mp3;base64,${b64}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingAudioId(id);

      audio.onended = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
      };

      audio.play().catch(() => {
        setPlayingAudioId(null);
        audioRef.current = null;
      });
    } catch {
      setPlayingAudioId(null);
      audioRef.current = null;
    }
  };

  // Toggle audio: stops if currently playing, plays otherwise
  const toggleAudio = (b64: string, id: string) => {
    if (playingAudioId === id) {
      stopAudio();
    } else {
      playAudio(b64, id);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast('Seu navegador não suporta ditado por voz. Você pode digitar sua resposta.', {
        icon: 'ℹ️',
      });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.lang = accent === 'en-GB' ? 'en-GB' : 'en-US';
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
      }
    }
  };

  // Send answer to step endpoint
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !sessionId || isLoading || isCompleted) return;

    stopAudio();
    const userText = inputText.trim();
    setInputText('');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await apiPost<any>(ENDPOINTS.LEVELING_PUBLIC_STEP, {
        session_id: sessionId,
        user_text: userText,
        accent: accent,
      });

      const data = res.data;
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        audio_b64: data.audio_b64,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.audio_b64) {
        playAudio(data.audio_b64, assistantMsg.id);
      }

      if (data.completed) {
        setIsCompleted(true);
        setAssessedLevel(data.new_level || 'A1');
        setScores(data.scores || null);
        toast.success('Parabéns! Você concluiu seu teste de nivelamento CEFR!');
      } else {
        setCurrentQuestion(data.current_question || currentQuestion + 1);
        setTotalQuestions(data.total_questions || totalQuestions);
      }
    } catch (err) {
      toast.error('Ocorreu um erro ao processar sua resposta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Conclude test early with /finish command
  const handleFinishEarly = () => {
    stopAudio();
    setInputText('/finish');
    setTimeout(() => {
      const form = document.getElementById('cefr-input-form') as HTMLFormElement | null;
      form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }, 50);
  };

  // Auto suggest username from email
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!username && val.includes('@')) {
      const prefix = val.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      setUsername(prefix);
    }
  };

  // Handle final form submit (Receive PDF & Create Account)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Por favor, informe um e-mail válido.');
      return;
    }
    if (wantAccount) {
      if (!password || password.length < 6) {
        toast.error('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('As senhas digitadas não coincidem.');
        return;
      }
    }

    setIsSubmittingForm(true);
    try {
      const payload = {
        session_id: sessionId,
        name: fullName.trim(),
        email: email.trim(),
        create_account: wantAccount,
        username: wantAccount ? username.trim() || undefined : undefined,
        password: wantAccount ? password : undefined,
      };

      const res = await apiPost<any>(ENDPOINTS.LEVELING_PUBLIC_SUBMIT, payload);
      const data = res.data;

      setFormSubmitted(true);
      if (data.pdf_b64) {
        setDownloadPdfB64(data.pdf_b64);
      }

      toast.success(data.message || 'Relatório enviado com sucesso!');

      // Se a conta foi criada e recebemos tokens, salva a sessão e redireciona
      if (wantAccount && data.token_response?.access_token) {
        await saveSession(data.token_response.access_token, data.token_response.user);
        toast.success('Conta criada com sucesso! Redirecionando para a Teacher Tati...', {
          duration: 3000,
        });
        setTimeout(() => {
          router.replace('/chat');
        }, 2000);
      }
    } catch (err: any) {
      const msg = err?.data?.detail || err?.message || 'Erro ao enviar dados. Tente novamente.';
      toast.error(msg);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Download PDF directly
  const handleDownloadPdf = () => {
    if (!downloadPdfB64) return;
    try {
      const linkSource = `data:application/pdf;base64,${downloadPdfB64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      downloadLink.download = `CEFR_Report_${fullName.replace(/\s+/g, '_') || 'Student'}.pdf`;
      downloadLink.click();
    } catch {
      toast.error('Não foi possível iniciar o download direto. Verifique seu e-mail.');
    }
  };

  const progressPercent = Math.min(100, Math.round((currentQuestion / totalQuestions) * 100));

  return (
    <div
      className="cefr-theme-light flex h-screen flex-col antialiased selection:bg-primary/20 selection:text-primary"
      style={{
        backgroundColor: '#f9f8f6',
        color: '#1a1826',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── TOPBAR DO TESTE CEFR ── */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="Voltar à Página Inicial"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-text sm:text-base">
                Teacher Tati <span className="text-primary">AI</span>
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                Desafio CEFR
              </span>
            </div>
            <p className="text-[11px] text-text-subtle">
              Teste oficial de nivelamento gratuito • A1 a B2
            </p>
          </div>
        </div>

        {/* Controles de Sotaque, Parar Áudio e Conclusão */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botão de parar áudio quando estiver reproduzindo */}
          {playingAudioId && (
            <button
              type="button"
              onClick={stopAudio}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition-all animate-pulse"
              title="Parar áudio da Teacher Tati"
            >
              <Square size={12} fill="currentColor" />
              <span>Parar Áudio</span>
            </button>
          )}

          {/* Seletor de voz */}
          <div className="flex items-center rounded-lg border border-border bg-bg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setAccent('en-US')}
              className={`rounded px-2 py-1 transition-all ${
                accent === 'en-US' ? 'bg-surface font-bold text-primary shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              title="Voz Americana (US)"
            >
              🇺🇸 US
            </button>
            <button
              onClick={() => setAccent('en-GB')}
              className={`rounded px-2 py-1 transition-all ${
                accent === 'en-GB' ? 'bg-surface font-bold text-primary shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              title="Voz Britânica (UK)"
            >
              🇬🇧 UK
            </button>
          </div>

          {!isCompleted && (
            <button
              onClick={handleFinishEarly}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
              title="Encerrar teste e ver meu nível agora"
            >
              <Flag size={13} />
              <span className="hidden sm:inline">Encerrar</span>
            </button>
          )}

          <Link
            href="/login"
            className="rounded-lg bg-surface px-3 py-1 text-xs font-semibold text-text-muted border border-border hover:text-text hover:bg-surface-hover"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* ── BARRA DE PROGRESSO ── */}
      <div className="h-1.5 w-full bg-bg-secondary">
        <div
          className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${isCompleted ? 100 : progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between border-b border-border/50 bg-surface/50 px-4 py-1.5 text-[11px] font-semibold text-text-muted sm:px-6">
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" />
          {isCompleted
            ? 'Avaliação concluída com sucesso!'
            : `Pergunta ${currentQuestion} de ${totalQuestions}`}
        </span>
        <span>{isCompleted ? '100%' : `${progressPercent}% concluído`}</span>
      </div>

      {/* ── CORPO DO CHAT ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Spinner de inicialização */}
          {isInitializing && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Spinner size="lg" />
              <p className="mt-4 text-sm font-semibold text-text-muted">
                Teacher Tati está preparando seu teste diagnóstico CEFR...
              </p>
            </div>
          )}

          {/* Mensagens trocadas no chat */}
          {messages.map((msg) => {
            const isAssistant = msg.role === 'assistant';
            const isPlaying = playingAudioId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
              >
                {isAssistant && (
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/tati_logo.jpg"
                      alt="Teacher Tati AI"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[78%] ${isAssistant ? 'items-start' : 'items-end'}`}>
                  <div
                    className={`rounded-3xl p-4 sm:p-5 shadow-sm leading-relaxed text-sm ${
                      isAssistant
                        ? 'rounded-tl-sm bg-surface border border-border text-text'
                        : 'rounded-tr-sm bg-primary text-white font-medium'
                    }`}
                  >
                    {/* Renderiza quebras de linha e negrito simples */}
                    <div className="whitespace-pre-wrap">
                      {msg.content.split('\n').map((line, idx) => {
                        // Formatação de destaque em negrito **
                        const formattedLine = line.split(/(\*\*.*?\*\*)/).map((part, pIdx) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <strong key={pIdx} className={isAssistant ? 'text-primary font-bold' : 'font-bold'}>
                                {part.slice(2, -2)}
                              </strong>
                            );
                          }
                          return part;
                        });

                        return (
                          <span key={idx} className="block">
                            {formattedLine}
                          </span>
                        );
                      })}
                    </div>

                    {/* Botão de Áudio da Teacher Tati */}
                    {isAssistant && msg.audio_b64 && (
                      <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
                        <button
                          type="button"
                          onClick={() => toggleAudio(msg.audio_b64!, msg.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                            isPlaying
                              ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm animate-pulse'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                          title={isPlaying ? 'Clique para parar o áudio' : 'Ouvir Teacher Tati'}
                        >
                          {isPlaying ? (
                            <>
                              <Square size={11} fill="currentColor" />
                              Parar áudio
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} />
                              Ouvir Teacher Tati
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!isAssistant && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface border border-border text-text-muted font-bold text-xs">
                    <User size={16} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Indicador de carregamento / IA avaliando */}
          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/tati_logo.jpg"
                  alt="Teacher Tati AI"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-surface border border-border px-4 py-3 text-xs text-text-muted">
                <Spinner size="sm" />
                <span>Teacher Tati está avaliando sua resposta em inglês...</span>
              </div>
            </div>
          )}

          {/* ── CARD DO FORMULÁRIO DE CONCLUSÃO DO TESTE CEFR ── */}
          {isCompleted && (
            <div className="my-8 rounded-3xl border border-primary/30 bg-surface p-6 sm:p-8 shadow-xl shadow-primary/10 animate-fade-in">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-2xl shadow-inner">
                  {assessedLevel || 'A1'}
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                  Seu Nível CEFR Avaliado
                </span>
                <h3 className="font-display mt-2 text-2xl font-extrabold text-text sm:text-3xl">
                  {assessedLevel === 'A1' && 'Nível A1 — Iniciante'}
                  {assessedLevel === 'A2' && 'Nível A2 — Básico'}
                  {assessedLevel === 'B1' && 'Nível B1 — Intermediário'}
                  {assessedLevel === 'B2' && 'Nível B2 — Independente'}
                  {!['A1', 'A2', 'B1', 'B2'].includes(assessedLevel || '') && `Nível ${assessedLevel}`}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-text-muted">
                  Preencha o formulário abaixo para receber seu <strong>Relatório Diagnóstico Oficial em PDF</strong> por e-mail, com todas as suas respostas analisadas e sugestões de evolução.
                </p>
              </div>

              {!formSubmitted ? (
                <form onSubmit={handleSubmitForm} className="mt-8 space-y-4">
                  {/* Nome Completo */}
                  <div>
                    <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">
                      Nome Completo <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full rounded-xl border border-border bg-bg pl-10 pr-4 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="block text-xs font-bold text-text uppercase tracking-wider mb-1.5">
                      E-mail para Envio do Relatório <span className="text-danger">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full rounded-xl border border-border bg-bg pl-10 pr-4 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  </div>

                  {/* Checkbox Criar Conta */}
                  <div className="rounded-2xl border border-border bg-bg/50 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wantAccount}
                        onChange={(e) => setWantAccount(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="text-xs font-bold text-text">
                          Quero criar uma conta gratuita no Teacher Tati AI
                        </span>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Tenha acesso imediato ao chat conversacional, atividades práticas e acompanhe sua evolução de nível.
                        </p>
                      </div>
                    </label>

                    {/* Campos de criação de conta (Username & Senha) */}
                    {wantAccount && (
                      <div className="mt-4 space-y-3 border-t border-border pt-3">
                        <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">
                            Nome de Usuário (Username)
                          </label>
                          <input
                            type="text"
                            required={wantAccount}
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            placeholder="ex: joaosilva"
                            className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text outline-none focus:border-primary"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">
                              Senha (mínimo 6 caracteres)
                            </label>
                            <input
                              type="password"
                              required={wantAccount}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">
                              Confirmar Senha
                            </label>
                            <input
                              type="password"
                              required={wantAccount}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2 text-sm text-text outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão de envio */}
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                  >
                    {isSubmittingForm ? (
                      <>
                        <Spinner size="sm" />
                        <span>Gerando seu relatório e enviando...</span>
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        <span>
                          {wantAccount
                            ? 'Receber Relatório & Criar Minha Conta'
                            : 'Receber Relatório em PDF por E-mail'}
                        </span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <p className="text-center text-[11px] text-text-subtle">
                    Seus dados estão protegidos de acordo com a{' '}
                    <Link href="/politica-de-privacidade" target="_blank" className="text-primary underline">
                      Política de Privacidade (LGPD)
                    </Link>
                    .
                  </p>
                </form>
              ) : (
                /* Sucesso após envio */
                <div className="mt-6 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="font-display text-xl font-bold text-text">
                    Relatório enviado para {email}!
                  </h4>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Verifique sua caixa de entrada (e a pasta de spam) para abrir o PDF com o diagnóstico completo de competências e correções.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    {downloadPdfB64 && (
                      <button
                        onClick={handleDownloadPdf}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-bold text-text hover:bg-surface-hover shadow-sm"
                      >
                        <Download size={14} />
                        Baixar PDF Diretamente
                      </button>
                    )}

                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/90"
                    >
                      Acessar o Sistema
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── BARRA DE DIGITAÇÃO / ENVIO ── */}
      {!isCompleted && (
        <footer className="shrink-0 border-t border-border bg-surface p-3 sm:p-4">
          <form
            id="cefr-input-form"
            onSubmit={handleSendMessage}
            className="mx-auto flex max-w-3xl items-center gap-2"
          >
            {/* Botão de ditado por voz */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all ${
                isRecording
                  ? 'border-danger bg-danger/10 text-danger animate-pulse'
                  : 'border-border bg-bg text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
              title={isRecording ? 'Parar gravação' : 'Falar em inglês'}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Input de texto */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Answer naturally in English... (type /finish anytime to conclude)"
              disabled={isLoading || isInitializing}
              className="flex-1 rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 transition-all"
            />

            {/* Botão Enviar */}
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading || isInitializing}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary/90 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
              title="Enviar resposta"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}
