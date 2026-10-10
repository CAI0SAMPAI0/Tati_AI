'use client';

import { useState, useRef, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Mic,
  Square,
  Volume2,
  RefreshCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  X,
  Globe,
} from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import dynamic from 'next/dynamic';
import { TatiLogo } from '../ui/tati-logo';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/lib/constants/accents';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

interface PronunciationPracticeProps {
  phrase: string;
  podcastId?: string;
  onClose?: () => void;
}

export function PronunciationPractice({ phrase, onClose }: PronunciationPracticeProps) {
  const [selectedAccent, setSelectedAccent] = useState<string>(() => getStoredAccent());
  const [isAccentModalOpen, setIsAccentModalOpen] = useState(false);

  useEffect(() => {
    const handleAccentChange = () => {
      setSelectedAccent(getStoredAccent());
    };
    window.addEventListener('tati_accent_changed', handleAccentChange);
    window.addEventListener('storage', handleAccentChange);
    return () => {
      window.removeEventListener('tati_accent_changed', handleAccentChange);
      window.removeEventListener('storage', handleAccentChange);
    };
  }, []);

  const handleSelectAccent = (accId: string) => {
    setSelectedAccent(accId);
    saveStoredAccent(accId);
    setIsAccentModalOpen(false);
  };

  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<{ word: string; score: number; accuracy: string; tip?: string } | null>(null);
  const [isPlayingWord, setIsPlayingWord] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
    pedagogical_tip?: string;
    suggested_sentence?: string;
    correct_audio?: string;
    transcription: string;
    words?: { word: string; score: number; accuracy: string; tip?: string }[];
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const playReference = async () => {
    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { text: phrase, accent: selectedAccent });
      if (res.ok && res.data.audio) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audioRef.current = audio;
        audio.play();
      } else {
        throw new Error('TTS failed');
      }
    } catch (err) {
      console.error('TTS error:', err);
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = selectedAccent || 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const playUserAudio = () => {
    if (userAudioUrl) {
      const audio = new Audio(userAudioUrl);
      audio.play();
    }
  };

  const playWordAudio = async (wordToPlay: string) => {
    setIsPlayingWord(wordToPlay);
    const clean = wordToPlay.replace(/[^\w\s']/g, '').trim();
    try {
      const res = await apiPost<{ audio?: string; audio_b64?: string }>('/chat/tts', { text: clean, accent: selectedAccent });
      const b64 = res.ok && (res.data?.audio || res.data?.audio_b64);
      if (b64) {
        const audio = new Audio(`data:audio/mp3;base64,${b64}`);
        audio.onended = () => setIsPlayingWord(null);
        audio.onerror = () => setIsPlayingWord(null);
        await audio.play();
        return;
      }
    } catch (_) {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = selectedAccent || 'en-US';
      u.rate = 0.85;
      u.onend = () => setIsPlayingWord(null);
      u.onerror = () => setIsPlayingWord(null);
      window.speechSynthesis.speak(u);
    } else {
      setIsPlayingWord(null);
    }
  };


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setUserAudioUrl(url);

        await evaluatePronunciation(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const evaluatePronunciation = async (blob: Blob) => {
    setIsEvaluating(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const res = await apiPost<{
          score: number;
          feedback: string;
          pedagogical_tip?: string;
          suggested_sentence?: string;
          correct_audio?: string;
          transcription: string;
          words?: { word: string; score: number; accuracy: string; tip?: string }[];
        }>('/speech/verify-pronunciation', {
          audio: base64Audio,
          reference_text: phrase,
          accent: selectedAccent,
        });
        if (res.ok) {
          setResult(res.data);
        }
        setIsEvaluating(false);
      };
    } catch (err) {
      console.error('Error evaluating pronunciation:', err);
      setIsEvaluating(false);
    }
  };

  const currentAccentObj = ACCENTS.find(a => a.id === selectedAccent) || ACCENTS[0];

  return (
    <div className="p-6 bg-surface border border-border rounded-3xl space-y-6 shadow-xl animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <Sparkles size={16} />
            {'Pronunciation'}
          </h4>
          <p className="text-xs text-text-muted">
            {'Repeat the phrase below:'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Accent selector pill */}
          <button
            type="button"
            onClick={() => setIsAccentModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface border border-border hover:border-primary/40 text-[11px] font-bold text-text transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Change pronunciation accent"
          >
            <span>{currentAccentObj.flag}</span>
            <span>{currentAccentObj.shortLabel}</span>
            <Globe size={11} className="text-text-muted ml-0.5" />
          </button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
              <RefreshCcw size={16} className="text-text-muted" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 bg-bg rounded-2xl border border-border italic text-center text-lg md:text-xl font-display text-text relative group flex items-center justify-center min-h-[64px]">
        {result && result.words && result.words.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {result.words.map((w, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedWord(w)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm md:text-base font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm",
                  w.accuracy === 'correct'
                    ? "text-success bg-success/10 border-success/30 hover:bg-success/20"
                    : w.accuracy === 'needs_work'
                      ? "text-amber-500 bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/20 ring-1 ring-amber-500/20"
                      : "text-danger bg-danger/10 border-danger/40 line-through decoration-wavy hover:bg-danger/20"
                )}
              >
                <span>{w.word}</span>
                <span className="text-[0.65rem] opacity-75 font-sans">
                  {Math.round(w.score)}%
                </span>
                {w.tip && (
                  <span className="text-[0.65rem] text-amber-500">💡</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <span>"{phrase}"</span>
        )}

        <button
          onClick={playReference}
          className="absolute -right-2 -top-2 bg-primary text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Volume2 size={16} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        {!result && !isEvaluating && (
          <Button
            size="lg"
            variant={isRecording ? 'danger' : 'primary'}
            className={cn(
              "w-20 h-20 rounded-full shadow-xl transition-all duration-300",
              isRecording ? "animate-pulse scale-110" : "hover:scale-105"
            )}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <Square size={32} /> : <Mic size={32} />}
          </Button>
        )}

        {isEvaluating && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Spinner size="lg" />
            <p className="text-xs font-bold text-primary animate-pulse">
              Tati is listening...
            </p>
          </div>
        )}

        <AnimatePresence>
          {result && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-4"
            >
              <div className="flex items-center justify-between p-4 bg-bg rounded-2xl border border-border">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center font-black text-lg",
                    result.score >= 80 ? "bg-success/10 text-success" :
                      result.score >= 50 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                  )}>
                    {result.score}%
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-tighter">
                      {'Your Score'}
                    </p>
                    <div className="flex items-center gap-1">
                      {result.score >= 80 ? (
                        <CheckCircle2 size={14} className="text-success" />
                      ) : (
                        <XCircle size={14} className="text-danger" />
                      )}
                      <span className="text-sm font-bold">
                        {result.score >= 80 ? 'Perfect!' : result.score >= 50 ? 'Good!' : 'Try again!'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setResult(null); setUserAudioUrl(null); setSelectedWord(null); }} className="text-[0.65rem] uppercase font-bold tracking-widest gap-2">
                  <RefreshCcw size={14} />
                  {'Retry'}
                </Button>
              </div>

              {/* 🎧 Player Comparativo: Você vs Teacher Tati */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={playUserAudio}
                  disabled={!userAudioUrl}
                  className="rounded-xl flex items-center justify-center gap-2 text-xs font-bold py-2.5"
                >
                  <Volume2 size={16} className="text-primary" />
                  Listen to your voice
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={playReference}
                  className="rounded-xl flex items-center justify-center gap-2 text-xs font-bold py-2.5"
                >
                  <Volume2 size={16} className="text-purple-600" />
                  Teacher Tati
                </Button>
              </div>

              {/* 💡 Frase sugerida pela Teacher Tati para fala livre ou concordância */}
              {result.suggested_sentence && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex flex-col gap-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.68rem] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} />
                      Sugestão natural da Teacher Tati:
                    </span>
                    {result.correct_audio && (
                      <button
                        type="button"
                        onClick={playReference}
                        className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Volume2 size={13} />
                        Ouvir frase
                      </button>
                    )}
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-text leading-relaxed">
                    &ldquo;{result.suggested_sentence}&rdquo;
                  </p>
                </div>
              )}

              {/* 👩‍🏫 Card da Dica da Teacher Tati em Português */}
              {result.pedagogical_tip && (
                <div className="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col gap-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5">
                      <TatiLogo size={36} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.7rem] font-bold text-primary uppercase tracking-wider">
                        Dica da Teacher Tati
                      </p>
                      <p className="text-xs md:text-sm text-foreground leading-relaxed">
                        {result.pedagogical_tip}
                      </p>
                    </div>
                  </div>

                  {/* Lista com TODAS as palavras com atenção ou erro */}
                  {result.words && result.words.filter(w => w.tip || w.accuracy !== 'correct').length > 0 && (
                    <div className="pt-2.5 border-t border-primary/20 space-y-1.5">
                      <p className="text-[0.68rem] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={13} />
                        Pontos para praticar:
                      </p>
                      <div className="space-y-1.5">
                        {result.words.filter(w => w.tip || w.accuracy !== 'correct').map((w, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedWord(w)}
                            className="w-full text-left flex items-start gap-2.5 p-2 rounded-xl bg-surface/70 hover:bg-surface border border-border/70 hover:border-primary/50 transition-all text-xs group"
                          >
                            <span className={cn(
                              "font-bold shrink-0 px-2 py-0.5 rounded text-[0.7rem] font-mono",
                              w.accuracy === 'needs_work'
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                            )}>
                              {w.word}
                            </span>
                            <span className="text-text-muted group-hover:text-text leading-relaxed flex-1">
                              {w.tip || "Ajuste a pronúncia desta palavra."}
                            </span>
                            <span className="text-[0.65rem] text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              Ver detalhe →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-surface-hover/50 border border-border rounded-2xl text-left">
                <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest mb-1.5">
                  General Feedback
                </p>
                <p className="text-xs text-text-muted italic leading-relaxed">
                  "{result.feedback}"
                </p>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {!isRecording && !result && !isEvaluating && (
          <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">
            {'Click on the microphone to speak.'}
          </p>
        )}

        {/* 🪟 Modal / Tooltip de Fonética da Palavra */}
        <AnimatePresence>
          {selectedWord && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setSelectedWord(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-5 shadow-2xl space-y-4"
              >
                {/* Header do Modal */}
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl font-black text-text font-mono tracking-tight">
                      {selectedWord.word}
                    </span>
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-bold font-sans',
                        selectedWord.accuracy === 'correct'
                          ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                          : selectedWord.accuracy === 'needs_work'
                            ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-500 border border-red-500/30'
                      )}
                    >
                      {Math.round(selectedWord.score)}%
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                    aria-label="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Status da Pronúncia */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {selectedWord.accuracy === 'correct' ? (
                    <span className="flex items-center gap-1.5 text-green-500">
                      <CheckCircle2 size={16} /> Pronúncia natural e clara
                    </span>
                  ) : selectedWord.accuracy === 'needs_work' ? (
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <Sparkles size={16} /> Compreensível, mas com sotaque
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <XCircle size={16} /> Fonema impreciso ou trocado
                    </span>
                  )}
                </div>

                {/* Dica da Teacher Tati para a palavra */}
                {selectedWord.tip ? (
                  <div className="p-3.5 bg-primary/10 border border-primary/25 rounded-2xl flex items-start gap-3 text-left">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5">
                      <TatiLogo size={32} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.68rem] font-bold text-primary uppercase tracking-wider">
                        Dica da Teacher Tati
                      </p>
                      <p className="text-xs text-text leading-relaxed font-medium">
                        {selectedWord.tip}
                      </p>
                    </div>
                  </div>
                ) : selectedWord.accuracy === 'correct' ? (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-xs text-text-muted leading-relaxed">
                    Perfeito! Você articulou esse termo com precisão e clareza acústica.
                  </div>
                ) : null}

                {/* Botão de Ouvir Palavra */}
                <button
                  type="button"
                  onClick={() => playWordAudio(selectedWord.word)}
                  disabled={isPlayingWord === selectedWord.word}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
                >
                  <Volume2 size={16} className={isPlayingWord === selectedWord.word ? 'animate-pulse' : ''} />
                  {isPlayingWord === selectedWord.word ? 'Tocando pronúncia...' : `Ouvir pronúncia de "${selectedWord.word}"`}
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Accent Picker Modal */}
        <AnimatePresence>
          {isAccentModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 animate-in fade-in duration-200">
              <div
                className="fixed inset-0 cursor-pointer"
                onClick={() => setIsAccentModalOpen(false)}
              />
              <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111322] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[85vh] flex flex-col space-y-4 animate-in slide-in-from-bottom-5 duration-300">
                <div className="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
                  <div className="space-y-0.5">
                    <h3 className="text-base sm:text-lg font-black text-text flex items-center gap-2">
                      <span>🌎</span> English Accents (Edge TTS)
                    </h3>
                    <p className="text-xs text-text-muted">Teacher Tati will speak with the selected accent</p>
                  </div>
                  <button
                    onClick={() => setIsAccentModalOpen(false)}
                    className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
                  {ACCENTS.map((acc) => {
                    const isSelected = acc.id === selectedAccent;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => handleSelectAccent(acc.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer",
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm text-primary ring-1 ring-primary/40 font-bold"
                            : "bg-surface border-border hover:border-primary/40 text-text"
                        )}
                      >
                        <span className="text-xl shrink-0">{acc.flag}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{acc.label}</p>
                          <p className="text-[0.65rem] text-text-muted truncate">{acc.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

