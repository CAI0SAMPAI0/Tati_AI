'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import {
  ArrowLeft,
  Mic,
  Square,
  Volume2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  PenLine,
  MessageSquare,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

interface WordResult {
  word: string;
  score: number;
  accuracy: 'correct' | 'incorrect';
  error_type?: string;
}

interface PronunciationResult {
  score: number;
  transcription: string;
  words: WordResult[];
  feedback: string;
  correct_audio?: string;
  metadata?: {
    accuracy_score?: number;
    fluency_score?: number;
    completeness_score?: number;
    segments?: any[];
    language?: string;
    duration?: number;
    free_speech?: boolean;
  };
  phonetic?: any;
}

interface PracticeSentence {
  text: string;
  level: string;
  tip: string;
}

const PRACTICE_SENTENCES: PracticeSentence[] = [
  { text: "Hello, my name is Maria.", level: "A1", tip: "Focus on clear 'H' and 'L' sounds." },
  { text: "I would like a coffee, please.", level: "A1", tip: "Stress the second syllable in 'cof-fee'." },
  { text: "Where is the nearest train station?", level: "A1", tip: "Rising intonation at the end for questions." },
  { text: "Can you help me find my way?", level: "A1", tip: "The 'h' in 'help' should be aspirated (breathy)." },
  { text: "I have been learning English for three years.", level: "A2", tip: "TH sound: place tongue between teeth." },
  { text: "She doesn't like to wake up early.", level: "A2", tip: "The 'ea' in 'early' is one long sound." },
  { text: "We are planning to travel next summer.", level: "A2", tip: "Stress 'trav-el' on the first syllable." },
  { text: "Could you repeat that, please?", level: "A2", tip: "Rising intonation on 'please' sounds polite." },
  { text: "I would have gone if I had known about it.", level: "B1", tip: "Past conditionals: rhythm matters more than speed." },
  { text: "The weather has been particularly warm this month.", level: "B1", tip: "Link words smoothly: 'has been', 'this month'." },
  { text: "She is considering applying for a promotion.", level: "B1", tip: "The 'ing' ending should be clear, not 'in'." },
  { text: "Despite the difficulties, we managed to finish on time.", level: "B1", tip: "Emphasize 'de-SPITE' and 'MA-naged'." },
  { text: "The instructions were quite straightforward, weren't they?", level: "B2", tip: "Tag questions rise at the end for real questions." },
  { text: "If I were you, I would reconsider the entire approach.", level: "B2", tip: "Subjunctive 'were' — don't skip it." },
  { text: "The committee has decided to postpone the project indefinitely.", level: "B2", tip: "Multi-syllable words: give each syllable space." },
  { text: "Notwithstanding the evidence, the jury reached an unanimous verdict.", level: "B2", tip: "Focus on consonant clusters: 'stand', 'ver-dict'." },
];

type InputMode = 'preset' | 'custom' | 'free';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function exportWavRaw(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (v: DataView, off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

export default function PronunciationReaderClientPage() {
  const router = useRouter();
  const { user } = useAuth();

  const userLevel = (user as any)?.level || 'A1';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [history, setHistory] = useState<{ sentence: string; score: number }[]>([]);

  const [inputMode, setInputMode] = useState<InputMode>('preset');
  const [customText, setCustomText] = useState('');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);

  const currentSentence = PRACTICE_SENTENCES[currentIndex];

  const filteredSentences = PRACTICE_SENTENCES;

  const displaySentence = filteredSentences[currentIndex % filteredSentences.length] || PRACTICE_SENTENCES[0];

  const getActiveText = (): string => {
    if (inputMode === 'custom') return customText.trim();
    if (inputMode === 'free') return '';
    return displaySentence.text;
  };

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const playReference = async () => {
    const text = getActiveText();
    if (!text) return;
    try {
      const res = await apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startRecording = async () => {
    setResult(null);
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          stream.getTracks().forEach(t => t.stop());
          audioContext.close();

          const elapsed = Date.now() - recordingStartRef.current;
          if (elapsed < 1500) {
            setRecordingError('Recording too short. Please hold the button for at least 2 seconds.');
            setIsRecording(false);
            return;
          }

          if (audioChunksRef.current.length === 0) {
            setRecordingError('No audio data recorded. Please try again.');
            setIsRecording(false);
            return;
          }

          const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();

          let wavBuffer: ArrayBuffer;
          try {
            const audioCtx = new AudioContext();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
            const offlineSource = offlineCtx.createBufferSource();
            offlineSource.buffer = audioBuffer;
            offlineSource.connect(offlineCtx.destination);
            offlineSource.start();

            const rendered = await offlineCtx.startRendering();
            wavBuffer = exportWavRaw(rendered.getChannelData(0), rendered.sampleRate);
            audioCtx.close();
          } catch (decodeErr) {
            console.error('Audio decode error, sending raw:', decodeErr);
            wavBuffer = arrayBuffer;
          }

          const base64 = uint8ToBase64(new Uint8Array(wavBuffer));
          const activeText = getActiveText();
          await evaluatePronunciation(base64, activeText);
        } catch (err) {
          console.error('Audio processing error:', err);
          setRecordingError('Error processing audio. Please try again.');
          setIsRecording(false);
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        setRecordingError('Recording error. Please check your microphone.');
        setIsRecording(false);
      };

      mediaRecorder.start(250);
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      drawWaveform();
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError') {
        setRecordingError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setRecordingError('No microphone found. Please connect a microphone.');
      } else {
        setRecordingError('Could not access microphone. Please try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    setIsRecording(false);
  };

  const evaluatePronunciation = async (audioBase64: string, referenceText: string) => {
    setIsEvaluating(true);
    try {
      const body: Record<string, any> = { audio: audioBase64 };
      if (referenceText) {
        body.reference_text = referenceText;
      }

      const res = await apiPost<PronunciationResult>(
        ENDPOINTS.SPEECH_VERIFY_PRONUNCIATION,
        body
      );
      if (res.ok) {
        setResult(res.data);
        setHistory(prev => [...prev, {
          sentence: referenceText || '(free speech)',
          score: res.data.score,
        }]);
      } else {
        setRecordingError('Evaluation failed. Please try again.');
      }
    } catch (err) {
      console.error('Pronunciation evaluation error:', err);
      setRecordingError('Error evaluating pronunciation. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const goNext = () => {
    setResult(null);
    setCurrentIndex(prev => (prev + 1) % filteredSentences.length);
  };

  const goPrev = () => {
    setResult(null);
    setCurrentIndex(prev => (prev - 1 + filteredSentences.length) % filteredSentences.length);
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Auto-play correct pronunciation when result comes in
  useEffect(() => {
    if (result?.correct_audio) {
      const audio = new Audio(`data:audio/mp3;base64,${result.correct_audio}`);
      audio.play();
    }
  }, [result]);

  const playCorrectAudio = useCallback(() => {
    if (result?.correct_audio) {
      const audio = new Audio(`data:audio/mp3;base64,${result.correct_audio}`);
      audio.play();
    }
  }, [result]);

  const avgScore = history.length > 0 ? Math.round(history.reduce((a, h) => a + h.score, 0) / history.length) : 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            Pronunciation Reader
          </h1>
          <p className="text-xs text-text-muted">Read aloud, write your own text, or just speak freely</p>
        </div>
        {history.length > 0 && (
          <div className="text-right">
            <div className={cn('text-lg font-bold', scoreColor(avgScore))}>{avgScore}%</div>
            <div className="text-[0.6rem] text-text-muted">Avg. Score</div>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-2xl mx-auto w-full">
        {/* Input mode selector */}
        <div className="flex gap-2 mb-6 w-full">
          <button
            onClick={() => setInputMode('preset')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'preset'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <BookOpen size={14} />
            Preset Sentences
          </button>
          <button
            onClick={() => setInputMode('custom')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'custom'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <PenLine size={14} />
            Write Your Own
          </button>
          <button
            onClick={() => setInputMode('free')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'free'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <MessageSquare size={14} />
            Free Speech
          </button>
        </div>

        {/* Sentence card / Custom input */}
        {inputMode === 'preset' ? (
          <>
            {/* Level badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-bold mb-6',
              displaySentence.level === 'A1' ? 'bg-green-500/20 text-green-400' :
              displaySentence.level === 'A2' ? 'bg-green-500/15 text-green-300' :
              displaySentence.level === 'B1' ? 'bg-blue-500/20 text-blue-400' :
              'bg-purple-500/20 text-purple-400'
            )}>
              {displaySentence.level}
            </div>

            <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
              <p className="text-xl md:text-2xl font-display font-bold text-text leading-relaxed mb-4">
                {displaySentence.text}
              </p>
              <p className="text-xs text-text-muted italic">
                💡 {displaySentence.tip}
              </p>
            </div>
          </>
        ) : inputMode === 'custom' ? (
          <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6">
            <label className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 block">
              Type or paste the text you want to practice
            </label>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. The quick brown fox jumps over the lazy dog..."
              className="w-full h-32 bg-bg border border-border rounded-xl p-4 text-text text-base resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-[0.65rem] text-text-muted">
                {customText.length}/500 characters
              </p>
              {customText.trim() && (
                <button
                  onClick={() => setCustomText('')}
                  className="text-[0.65rem] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} />
            </div>
            <p className="text-lg font-bold text-text mb-2">Free Speech Mode</p>
            <p className="text-sm text-text-muted">
              Just tap the microphone and speak naturally. Tati will transcribe and analyze your pronunciation.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 mb-6">
          {inputMode === 'preset' && (
            <>
              <button
                onClick={goPrev}
                className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            </>
          )}

          <button
            onClick={playReference}
            disabled={!getActiveText() || isRecording || isEvaluating}
            className={cn(
              'p-4 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-primary',
              (!getActiveText() || isRecording || isEvaluating) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Volume2 size={24} />
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isEvaluating}
            className={cn(
              'p-5 rounded-full shadow-lg transition-all duration-300',
              isRecording
                ? 'bg-red-500 shadow-red-500/30 animate-pulse scale-110'
                : 'bg-primary shadow-primary/20 hover:scale-105 active:scale-95',
              isEvaluating && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isRecording ? <Square size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
          </button>

          <button
            onClick={() => { setResult(null); setRecordingError(null); }}
            className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
          >
            <RotateCcw size={20} />
          </button>

          {inputMode === 'preset' && (
            <>
              <button
                onClick={goNext}
                className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4"
            >
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Recording — speak now...
              </div>
              <canvas
                ref={canvasRef}
                width={300}
                height={60}
                className="mt-2 rounded-lg"
              />
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Recording error */}
        <AnimatePresence>
          {recordingError && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 w-full"
            >
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 text-center">
                {recordingError}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Evaluating indicator */}
        <AnimatePresence>
          {isEvaluating && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 flex items-center gap-2 text-primary text-sm"
            >
              <Sparkles size={16} className="animate-spin" />
              Analyzing your pronunciation...
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full"
            >
              <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                {/* Score */}
                <div className="text-center">
                  <div className={cn('text-5xl font-black', scoreColor(result.score))}>
                    {result.score}%
                  </div>
                </div>

                {/* Conversational feedback */}
                {result.feedback && (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-text leading-relaxed">{result.feedback}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Listen to correct pronunciation */}
                {result.correct_audio && (
                  <div className="flex justify-center">
                    <button
                      onClick={playCorrectAudio}
                      className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-sm font-bold transition-all"
                    >
                      <Volume2 size={16} />
                      Listen to Correct Pronunciation
                    </button>
                  </div>
                )}

                {/* Word-level breakdown */}
                {result.words && result.words.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2">Word-by-Word</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {result.words.map((w, i) => (
                        <span
                          key={i}
                          className={cn(
                            'px-2 py-1 rounded-lg text-sm font-mono',
                            w.accuracy === 'correct'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30 line-through'
                          )}
                        >
                          {w.word}
                          {w.accuracy === 'incorrect' && w.score > 0 && (
                            <span className="text-[0.6rem] ml-1 opacity-60">{w.score}%</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcription */}
                {result.transcription && (
                  <div>
                    <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-1">What Tati heard</h3>
                    <p className="text-sm text-text italic">&quot;{result.transcription}&quot;</p>
                  </div>
                )}

                {/* Metadata */}
                {result.metadata && (
                  <div className="grid grid-cols-3 gap-2">
                    {result.metadata.accuracy_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.accuracy_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Accuracy</div>
                      </div>
                    )}
                    {result.metadata.fluency_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.fluency_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Fluency</div>
                      </div>
                    )}
                    {result.metadata.completeness_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.completeness_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Completeness</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Phonetic (if available) */}
                {result.phonetic && result.phonetic.provider && (
                  <div className="text-[0.65rem] text-text-muted">
                    Phonetic provider: {result.phonetic.provider}
                  </div>
                )}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 1 && (
          <div className="w-full mt-6">
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2">Session History</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map((h, i) => (
                <div key={i} className="flex-shrink-0 bg-surface border border-border rounded-lg p-2 text-center min-w-[80px]">
                  <div className={cn('text-sm font-bold', scoreColor(h.score))}>{h.score}%</div>
                  <div className="text-[0.6rem] text-text-muted truncate max-w-[70px]">{h.sentence.substring(0, 15)}...</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
