'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { MainHeader } from '@/components/layout/main-header';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/hooks/useAuth';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { getStoredAccent } from '@/lib/constants/accents';
import toast from 'react-hot-toast';
import {
  GraduationCap,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  TrendingUp,
  RotateCcw,
  Trophy,
  Flame,
  Award,
  Lightbulb,
  Check,
  BrainCircuit,
  BookmarkCheck,
  FileText,
  Headphones,
  Play,
  Pause,
  Mic,
  Square,
} from 'lucide-react';

// TYPES

interface ExamStatus {
  can_start: boolean;
  status: 'available' | 'locked' | 'in_progress' | 'ready' | 'forbidden' | string;
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
  audio_text?: string | null;
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

  // Screen main views
  const [view, setView] = useState<'dashboard' | 'taking' | 'result'>('dashboard');
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const studentAccent = user?.preferred_accent || (user?.profile as any)?.preferred_accent || (user?.profile as any)?.accent || getStoredAccent() ||
  'en-US';

  // Active exam states
  const [activeExam, setActiveExam] = useState<ExamActive | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recordedAudioB64, setRecordedAudioB64] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Exam result
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  // Audio (Listening) and voice recording (Speaking)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioListenCount, setAudioListenCount] = useState<Record<string, number>>({});
  const [showTranscript, setShowTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudios, setRecordedAudios] = useState<Record<string, string>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Record<string, string>>({});

  // Fallback speech synthesis
  const fallbackSpeechSynthesis = (phrase: string, studentAccent: string, qId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsPlayingAudio(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = studentAccent || 'en-US';
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const prefix = studentAccent.split('-')[0] || 'en';
    const matchedVoice = voices.find(v => v.lang.startsWith(prefix) && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Sonia')));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => {
      setIsPlayingAudio(false);
      setAudioListenCount(prev => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
    };
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  // Play audio dialogue using Edge TTS in student's preferred accent
  const handlePlayListeningAudio = async (text: string, qId: string) => {
    // If audio is currently playing, pause it
    if (isPlayingAudio) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      return;
    }

    const clean = text.replace(/^(Station Announcer|Speaker\s*\w*|Woman|Man|Announcer|Flight Attendant|Receptionist):\s*/gim, '').trim();
    const phrase = clean || text;

    // Student accent
    const studentAccent = user?.preferred_accent || (user?.profile as any)?.preferred_accent || (user?.profile as any)?.accent || getStoredAccent();

    try {
      setIsPlayingAudio(true);

      // Check cache first
      let audioB64 = audioCacheRef.current[qId];

      if (!audioB64) {
        const res = await apiPost<{ audio?: string; audio_b64?: string }>('/chat/tts', {
          text: phrase,
          accent: studentAccent, // pega o sotaque escolhido pelo user
        });
        if (res.ok && (res.data?.audio || res.data?.audio_b64)) {
          audioB64 = res.data.audio || res.data.audio_b64 || '';
          audioCacheRef.current[qId] = audioB64;
        }
      }

      if (audioB64) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audioSrc = audioB64.startsWith('data:') ? audioB64 : `data:audio/mp3;base64,${audioB64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onended = () => {
          setIsPlayingAudio(false);
          setAudioListenCount(prev => ({ ...prev, [qId]: (prev[qId] || 0) + 1 }));
        };

        audio.onerror = () => {
          setIsPlayingAudio(false);
          fallbackSpeechSynthesis(phrase, studentAccent, qId);
        };

        await audio.play();
        return;
      }

      throw new Error('TTS response was empty');
    } catch (err) {
      console.warn('Backend TTS call failed, using Web Speech API fallback:', err);
      fallbackSpeechSynthesis(phrase, studentAccent, qId);
    }
  };

  // Microphone recording for speaking tasks
  const startRecording = async (qId: string) => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        toast.error('Microphone recording is not supported on this browser or device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudios(prev => ({ ...prev, [qId]: audioUrl }));

        const reader = new FileReader();
        reader.onloadend = () => {
          const b64Data = reader.result as string;
          setRecordedAudioB64(prev => ({ ...prev, [qId]: b64Data }));
          setAnswers(prev => ({ ...prev, [qId]: '[Audio recorded]' }));
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(sec => {
          if (sec >= 45) {
            stopRecording();
            return 45;
          }
          return sec + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Clean audio and recording when changing question
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setShowTranscript(false);
    if (isRecording) {
      stopRecording();
    }
  }, [currentQuestionIndex]);

  // Load status and history
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
      console.error('[Exams] Failed to load data:', err);
      toast.error('Error loading quarterly exam status.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatusAndHistory();
  }, []);

  // Start Exam
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
        setRecordedAudioB64({});
        setView('taking');
        toast.success('Quarterly CEFR Exam started! Good luck!');
      } else {
        const errDetail = (res as any)?.data?.detail || 'Unable to start quarterly exam.';
        toast.error(errDetail);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error connecting to the server to start the exam.');
    } finally {
      setIsStarting(false);
    }
  };

  // Resume active or ready exam
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

  // Submit Exam
  const handleSubmitExam = async () => {
    if (!activeExam) return;

    const answeredCount = activeExam.questions.filter(
      (q) => Boolean(answers[q.id]) || Boolean(recordedAudioB64[q.id])
    ).length;
    const totalCount = activeExam.questions.length;

    if (answeredCount < totalCount) {
      const confirmSubmit = window.confirm(
        `You answered ${answeredCount} of ${totalCount} questions. Do you want to submit anyway?`
      );
      if (!confirmSubmit) return;
    }

    try {
      setIsSubmitting(true);
      const payloadAnswers = activeExam.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || (recordedAudioB64[q.id] ? '[Audio Recorded]' : ''),
        audio_data: recordedAudioB64[q.id] || undefined,
      }));

      const res = await apiPost<ExamResult>(ENDPOINTS.EXAMS_TRIMESTRAL_SUBMIT, {
        exam_id: activeExam.exam_id,
        answers: payloadAnswers,
      });

      if (res.ok && res.data) {
        setExamResult(res.data);
        setView('result');
        toast.success(`Exam completed! You scored ${res.data.score}%! 🎉`);
        fetchStatusAndHistory();
      } else {
        toast.error('Failed to submit exam answers.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error submitting exam answers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset for Development Testing
  const handleResetDev = async () => {
    if (!window.confirm('Do you want to reset the exam cycle to test again immediately?')) return;
    try {
      const res = await apiPost<{ success: boolean; message: string }>(ENDPOINTS.EXAMS_TRIMESTRAL_RESET, {});
      if (res.ok) {
        toast.success('Exam cycle reset! Background AI will prepare a new exam.');
        setView('dashboard');
        setActiveExam(null);
        setExamResult(null);
        fetchStatusAndHistory();
      }
    } catch {
      toast.error('Error resetting exam cycle.');
    }
  };

  // Date formatting helper in English
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '--/--/----';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const latestEvolution = status?.last_exam_evolution || (history.length > 0 ? history[0] : null);

  // ==============================================================================
  // RENDER: EXAM TAKING VIEW (100% ENGLISH - CONTINUOUS SCROLL LAYOUT)
  // ==============================================================================
  if (view === 'taking' && activeExam) {
    const answeredTotal = activeExam.questions.filter(
      (q) => Boolean(answers[q.id]) || Boolean(recordedAudioB64[q.id])
    ).length;
    const progressPercent = Math.round((answeredTotal / activeExam.total_questions) * 100);

    const scrollToQuestion = (qId: string) => {
      const el = document.getElementById(`question-card-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <MainHeader onToggleMenu={toggleSidebar} />

        <div className="flex-1 flex max-w-5xl w-full mx-auto p-4 md:p-8 flex-col space-y-6">
          {/* Sticky Progress & Navigation Bar */}
          <div className="sticky top-16 z-20 bg-surface/95 backdrop-blur-md border border-border rounded-2xl p-4 shadow-md transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h1 className="font-bold text-base md:text-lg text-text leading-tight">
                    Quarterly CEFR Exam
                  </h1>
                  <p className="text-xs text-text-muted">
                    Level <span className="font-bold text-primary">{activeExam.level}</span> • Total {activeExam.total_questions} Questions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold text-text-muted">
                <span className={cn(
                  "px-3 py-1 rounded-full font-bold transition-all",
                  answeredTotal === activeExam.total_questions
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-primary/10 text-primary border border-primary/20"
                )}>
                  {answeredTotal} of {activeExam.total_questions} answered ({progressPercent}%)
                </span>
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Submit
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-bg-secondary h-2 rounded-full overflow-hidden mb-3">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Question Quick Jump Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
                Jump to:
              </span>
              {activeExam.questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id]) || Boolean(recordedAudioB64[q.id]);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => scrollToQuestion(q.id)}
                    className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center justify-center border cursor-pointer",
                      isAnswered
                        ? "bg-success/15 border-success/40 text-success"
                        : "bg-surface border-border text-text-muted hover:border-primary/50 hover:text-primary"
                    )}
                    title={`Jump to Question ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Questions Rendered in Sequence */}
          <div className="space-y-6">
            {activeExam.questions.map((q, idx) => {
              const isAnswered = Boolean(answers[q.id]) || Boolean(recordedAudioB64[q.id]);

              return (
                <div
                  key={q.id}
                  id={`question-card-${q.id}`}
                  className={cn(
                    "bg-surface border rounded-3xl p-5 md:p-8 shadow-sm transition-all scroll-mt-36",
                    isAnswered ? "border-border" : "border-border/80"
                  )}
                >
                  {/* Question Header: Number & Badge */}
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center border border-primary/20">
                        {idx + 1}
                      </span>
                      <span className={cn(
                        "text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider",
                        q.type === 'reading' && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                        q.type === 'grammar' && "bg-purple-500/10 text-purple-500 border border-purple-500/20",
                        q.type === 'vocabulary' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                        q.type === 'listening' && "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                        q.type === 'speaking' && "bg-rose-500/10 text-rose-500 border border-rose-500/20",
                      )}>
                        {q.type === 'reading' && "Reading Comprehension"}
                        {q.type === 'grammar' && "Applied Grammar"}
                        {q.type === 'vocabulary' && "Vocabulary in Context"}
                        {q.type === 'listening' && "Listening Comprehension"}
                        {q.type === 'speaking' && "🎙 Oral Expression & Speaking"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-muted">
                        {q.points} pts
                      </span>
                      {isAnswered && (
                        <span className="text-[11px] font-bold text-success flex items-center gap-1 bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                          <Check size={12} strokeWidth={2.5} /> Done
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reading Passage Block */}
                  {q.reading_text && (
                    <div className="bg-bg-secondary/60 border border-border rounded-2xl p-5 md:p-6 mb-6">
                      <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                        <BookOpen size={16} className="text-primary" />
                        Reading Passage:
                      </div>
                      <p className="text-sm md:text-base leading-relaxed text-text font-serif italic">
                        &quot;{q.reading_text}&quot;
                      </p>
                    </div>
                  )}

                  {/* Listening Comprehension Audio Player (Edge TTS in Student Accent) */}
                  {q.type === 'listening' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 md:p-6 mb-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
                          <Headphones size={18} /> Audio Track • Accent: <strong className="text-primary">{studentAccent}</strong>
                        </div>
                        <span className="text-xs text-text-muted font-medium">
                          Times played: <strong className="text-emerald-500">{audioListenCount[q.id] || 0}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handlePlayListeningAudio(q.audio_text || '', q.id)}
                          className={cn(
                            "px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2.5 transition-all shadow-md active:scale-95 cursor-pointer",
                            isPlayingAudio
                              ? "bg-danger text-white animate-pulse"
                              : "bg-emerald-500 text-white hover:bg-emerald-600"
                          )}
                        >
                          {isPlayingAudio ? (
                            <>
                              <Pause size={18} /> Stop Audio Playback
                            </>
                          ) : (
                            <>
                              <Play size={18} /> Play Audio Dialogue
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowTranscript(prev => !prev)}
                          className="text-xs font-bold text-text-muted hover:text-emerald-500 underline ml-auto transition-colors cursor-pointer"
                        >
                          {showTranscript ? 'Hide Audio Transcript' : 'Show Audio Transcript (Practice)'}
                        </button>
                      </div>

                      {showTranscript && q.audio_text && (
                        <div className="mt-4 p-4 rounded-xl bg-surface/90 border border-emerald-500/20 text-xs md:text-sm font-mono text-text animate-fade-in">
                          <p className="text-text-muted text-[11px] uppercase tracking-wider mb-1 font-sans font-bold">Transcript:</p>
                          {q.audio_text}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Speaking Task with Voice Recording */}
                  {q.type === 'speaking' && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 md:p-6 mb-6">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-rose-500 uppercase tracking-wider">
                          <Mic size={18} /> Spoken Task • Voice Recording
                        </div>
                        {recordedAudioB64[q.id] && (
                          <span className="text-xs font-bold text-success flex items-center gap-1">
                            <CheckCircle2 size={14} /> Response Recorded
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-muted mb-4">
                        Click the microphone to record your response in English. Speak clearly for 15 to 30 seconds.
                      </p>

                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={() => startRecording(q.id)}
                            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer"
                          >
                            <Mic size={18} />
                            {recordedAudios[q.id] ? 'Re-record Spoken Response' : 'Start Recording Voice'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-danger hover:opacity-90 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2.5 transition-all animate-pulse cursor-pointer"
                          >
                            <Square size={16} fill="currentColor" />
                            Stop Recording ({recordingSeconds}s / 45s)
                          </button>
                        )}

                        {isRecording && (
                          <div className="flex items-center gap-2 text-xs font-bold text-danger">
                            <span className="w-2.5 h-2.5 rounded-full bg-danger animate-ping" />
                            Recording in progress...
                          </div>
                        )}
                      </div>

                      {recordedAudios[q.id] && (
                        <div className="mt-4 pt-4 border-t border-rose-500/20 flex items-center gap-3">
                          <span className="text-xs text-text-muted font-bold">Listen to your recording:</span>
                          <audio src={recordedAudios[q.id]} controls className="h-8 max-w-xs" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Question Prompt */}
                  <h2 className="text-base md:text-xl font-bold text-text leading-snug mb-6">
                    {q.question}
                  </h2>

                  {/* Multiple Choice Options (for reading, grammar, vocabulary, listening) */}
                  {q.type !== 'speaking' && (
                    <div className="space-y-3">
                      {q.options.map((optionText, optIdx) => {
                        const isSelected = answers[q.id] === optionText;

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              setAnswers((prev) => ({
                                ...prev,
                                [q.id]: optionText,
                              }));
                            }}
                            className={cn(
                              "w-full p-4 md:p-5 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer",
                              isSelected
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border bg-surface hover:border-primary/40 hover:bg-surface-hover"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <span className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0",
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
                              "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
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
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Submission Banner */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-lg font-bold text-text mb-1">
                {answeredTotal === activeExam.total_questions
                  ? 'All questions completed! Ready to finalize?'
                  : `You answered ${answeredTotal} of ${activeExam.total_questions} questions.`}
              </h3>
              <p className="text-xs text-text-muted">
                {answeredTotal === activeExam.total_questions
                  ? 'Click the button below to submit and receive Teacher Tati\'s diagnostic evaluation.'
                  : `You still have ${activeExam.total_questions - answeredTotal} unanswered questions. You can submit now or complete them above.`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSubmitExam}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-success text-white font-bold text-sm hover:opacity-90 shadow-md flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>Processing results with AI...</>
              ) : (
                <>
                  <CheckCircle2 size={18} /> Finalize & Submit Exam
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================================
  // RENDER: EXAM RESULT & PEDAGOGICAL FEEDBACK (100% ENGLISH)
  // ==============================================================================
  if (view === 'result' && examResult) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <MainHeader onToggleMenu={toggleSidebar} />

        <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
          {/* Result Banner */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-10 shadow-sm text-center mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-purple-500 to-success" />

            <div className="w-20 h-20 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-inner">
              <Trophy size={40} className="text-primary animate-bounce" />
            </div>

            <span className={cn(
              "text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-wider inline-block mb-3",
              examResult.passed ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"
            )}>
              {examResult.passed ? '🎉 Quarterly Assessment Passed' : '📚 Assessment Completed'}
            </span>

            <h1 className="text-3xl md:text-5xl font-black text-text mb-2 tracking-tight">
              {examResult.score}% <span className="text-xl md:text-2xl font-normal text-text-muted">Overall Score</span>
            </h1>

            <p className="text-sm md:text-base text-text-muted max-w-xl mx-auto mb-6 leading-relaxed">
              {examResult.summary_feedback}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-6">
              <div className="bg-bg-secondary px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-sm font-bold">
                <Flame size={18} className="text-amber-500" />
                <span>+{examResult.xp_earned} XP Earned</span>
              </div>

              {examResult.recommended_level && (
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl flex items-center gap-2 border border-primary/20 text-sm font-bold">
                  <Sparkles size={18} />
                  <span>Recommended for Level {examResult.recommended_level}!</span>
                </div>
              )}

              <div className="bg-bg-secondary px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-sm font-bold text-text-muted">
                <Calendar size={18} className="text-primary" />
                <span>Next Exam: {formatDate(examResult.next_exam_date)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setView('dashboard')}
              className="px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-md inline-flex items-center gap-2"
            >
              View Evolution Dashboard <ArrowRight size={18} />
            </button>
          </div>

          {/* Validated CEFR Can-Do Statements */}
          {examResult.can_do_statements && examResult.can_do_statements.length > 0 && (
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 mb-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center font-bold">
                  <BookmarkCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-text">Demonstrated Competencies</h2>
                  <p className="text-xs text-text-muted">Official CEFR competencies proven in this assessment</p>
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

          {/* Question-by-Question Detailed Review & Explanations */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg md:text-xl font-bold text-text mb-2 flex items-center gap-2">
              <FileText size={20} className="text-primary" /> Exam Review & Pedagogical Feedback
            </h2>
            <p className="text-xs text-text-muted mb-6">Review Teacher Tati&apos;s explanations and AI evaluations for each question</p>

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
                      Question {idx + 1} • {corr.type.toUpperCase()}
                    </span>
                    <span className={cn(
                      "text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1",
                      corr.is_correct
                        ? "bg-success/10 text-success border border-success/20"
                        : "bg-danger/10 text-danger border border-danger/20"
                    )}>
                      {corr.is_correct ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {corr.is_correct ? `Correct (+${corr.points_earned} pts)` : 'Incorrect (0 pts)'}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-text mb-3">{corr.question}</p>

                  <div className="text-xs space-y-1 mb-3">
                    <p className="text-text-muted">
                      Your answer: <strong className={corr.is_correct ? "text-success" : "text-danger"}>{corr.student_answer || '(not answered)'}</strong>
                    </p>
                    {!corr.is_correct && (
                      <p className="text-text-muted">
                        Target answer: <strong className="text-success">{corr.correct_answer}</strong>
                      </p>
                    )}
                  </div>

                  <div className="bg-bg/60 p-3 rounded-xl border border-border text-xs text-text-muted flex items-start gap-2">
                    <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
                    <span><strong>Pedagogical Feedback:</strong> {corr.explanation}</span>
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
  // RENDER: QUARTERLY EXAM DASHBOARD & EVOLUTION PANEL (100% ENGLISH)
  // ==============================================================================
  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-clip text-text">
      <SidebarActivities isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={toggleSidebar} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
                <GraduationCap size={16} /> Periodic Assessment • Every 3 Months
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-text tracking-tight">
                Quarterly CEFR Exam
              </h1>
              <p className="text-xs md:text-sm text-text-muted">
                Track your actual proficiency in Reading, Grammar, Vocabulary, Listening, and Speaking every 3 months.
              </p>
            </div>

            {/* Actions / Status Badge */}
            {status && (
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-text-muted flex items-center gap-2 shadow-sm">
                  <span>Current Level:</span>
                  <strong className="text-primary text-sm">{status.current_level}</strong>
                </span>

                {/* Reset Dev Button */}
                <button
                  type="button"
                  onClick={handleResetDev}
                  title="Reset exam cycle to test again immediately (Dev)"
                  className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-primary hover:border-primary/40 flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw size={13} /> Reset (Dev)
                </button>
              </div>
            )}
          </div>

          {/* MAIN STATUS CARD */}
          {loadingStatus ? (
            <div className="h-44 bg-surface border border-border rounded-3xl animate-pulse flex items-center justify-center">
              <span className="text-xs text-text-muted font-bold">Loading quarterly exam status...</span>
            </div>
          ) : status?.status === 'in_progress' ? (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-surface border border-amber-500/30 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Clock size={16} /> Exam in Progress
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text">You have an active quarterly assessment</h2>
                <p className="text-xs md:text-sm text-text-muted max-w-xl">
                  Your questions are already prepared. Continue where you left off to register your quarterly evolution and claim your XP!
                </p>
              </div>

              <button
                type="button"
                onClick={handleResumeActiveExam}
                disabled={isStarting}
                className="px-8 py-3.5 rounded-2xl bg-amber-500 text-white font-bold text-sm hover:opacity-90 shadow-md shrink-0 flex items-center gap-2"
              >
                {isStarting ? 'Loading...' : <>Resume Exam <ArrowRight size={18} /></>}
              </button>
            </div>
          ) : status?.can_start ? (
            <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-surface border border-primary/30 rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
              <div className="space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                  <Sparkles size={16} /> Ready to Take
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-text">Your Quarterly Exam is Available!</h2>
                <p className="text-xs md:text-sm text-text-muted max-w-xl leading-relaxed">
                  Official CEFR assessment with 8 to 15 questions tailored for level <strong>{status.current_level}</strong>. 
                  Short reading texts, grammar, listening dialogue, and speaking tasks. Average duration: 15 minutes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleStartExam(false)}
                disabled={isStarting}
                className="px-8 py-4 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-primary/20 shrink-0 flex items-center gap-2.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isStarting ? 'Loading exam questions...' : (
                  <>
                    <GraduationCap size={20} /> Start Quarterly Exam <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                    <Clock size={16} className="text-primary" /> 3-Month Cycle in Progress
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-text">
                    Next exam unlocked in <span className="text-primary">{status?.days_remaining ?? 90} days</span>
                  </h2>
                  <p className="text-xs md:text-sm text-text-muted max-w-xl">
                    Expected unlock date: <strong>{formatDate(status?.next_available_date)}</strong>. Continue practicing your daily activities and building your streak!
                  </p>

                  <div className="pt-2 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleStartExam(true)}
                      disabled={isStarting}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 flex items-center gap-2 shadow-sm transition-all"
                    >
                      <Sparkles size={14} /> {isStarting ? 'Loading questions...' : 'Start Now (Bypass Dev)'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetDev}
                      className="px-4 py-2 rounded-xl border border-border text-text-muted hover:text-primary text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <RotateCcw size={13} /> Reset Cycle
                    </button>
                  </div>
                </div>

                {/* 90-Day Progress */}
                <div className="w-full md:w-64 bg-bg-secondary p-4 rounded-2xl border border-border">
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-text-muted">Quarterly Cycle</span>
                    <span className="text-primary">{Math.max(0, 90 - (status?.days_remaining ?? 90))}/90 days</span>
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

          {/* STUDENT EVOLUTION PANEL ("WHAT YOU HAVE MASTERED") */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Demonstrated Competencies & Can-Do Descriptors */}
            <div className="lg:col-span-2 bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <BrainCircuit size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-text">What You Have Mastered</h2>
                    <p className="text-xs text-text-muted">Communicative competencies proven in your assessments</p>
                  </div>
                </div>

                {latestEvolution && (
                  <span className="text-xs font-bold px-3 py-1 bg-bg-secondary border border-border rounded-xl text-text-muted">
                    Level {latestEvolution.level} • {latestEvolution.score}%
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
                  <p className="font-semibold text-text">No quarterly assessments recorded yet.</p>
                  <p className="text-xs mt-1">As soon as you complete your first quarterly exam, this panel will display everything you can do in English!</p>
                </div>
              )}

              {/* CEFR Pedagogical Guideline Note */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3 text-xs text-text-muted">
                <Lightbulb size={18} className="text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>CEFR Pedagogical Standard:</strong> Our quarterly exam measures your evolution through official Council of Europe descriptors. Every correct answer reflects a real communicative ability.
                </span>
              </div>
            </div>

            {/* Skills Breakdown */}
            <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-bold text-text">Skills Breakdown</h2>
                    <p className="text-xs text-text-muted">Proficiency in your latest quarterly assessment</p>
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
                    Take your quarterly exam to view your visual breakdown across Reading, Grammar, Vocabulary, Listening, and Speaking.
                  </div>
                )}
              </div>

              <div className="bg-bg-secondary p-4 rounded-2xl border border-border text-center">
                <span className="text-xs text-text-muted block mb-1">Latest Overall Score</span>
                <span className="text-2xl font-black text-primary">
                  {latestEvolution?.score !== undefined ? `${latestEvolution.score}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* QUARTERLY TIMELINE (HISTORY) */}
          <div className="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Award size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-text">Quarterly Exam History</h2>
                  <p className="text-xs text-text-muted">Your evolution timeline every 3 months</p>
                </div>
              </div>

              <span className="text-xs font-bold text-text-muted">
                {history.length} {history.length === 1 ? 'exam completed' : 'exams completed'}
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
                          Level {hItem.level}
                        </span>
                        <span className="text-xs text-text-muted font-bold flex items-center gap-1">
                          <Calendar size={13} /> {formatDate(hItem.completed_at)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text max-w-xl">
                        {hItem.feedback || 'Assessment completed successfully.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-xl font-black text-primary block leading-none">{hItem.score}%</span>
                        <span className="text-[10px] text-text-muted font-bold uppercase">{hItem.passed ? 'Passed' : 'Completed'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-bg-secondary/20 rounded-2xl border border-dashed border-border text-text-muted text-xs">
                No past history yet. Your completed exams will appear here.
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
