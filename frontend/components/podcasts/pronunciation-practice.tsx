'use client';

import { useState, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { 
  Mic, 
  Square, 
  Volume2, 
  RefreshCcw, 
  Sparkles,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { motion, AnimatePresence } from 'framer-motion';

interface PronunciationPracticeProps {
  phrase: string;
  podcastId?: string;
  onClose?: () => void;
}

export function PronunciationPractice({ phrase, podcastId, onClose }: PronunciationPracticeProps) {
  
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
    transcription: string;
    words?: { word: string; score: number; accuracy: string }[];
  } | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const playReference = async () => {
    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { text: phrase });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      } else {
        throw new Error('TTS failed');
      }
    } catch (err) {
      console.error('TTS error:', err);
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
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
          transcription: string;
          words?: { word: string; score: number; accuracy: string }[];
        }>('/speech/verify-pronunciation', {
          audio: base64Audio,
          reference_text: phrase
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
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
            <RefreshCcw size={16} className="text-text-muted" />
          </Button>
        )}
      </div>

      <div className="p-4 bg-bg rounded-2xl border border-border italic text-center text-lg md:text-xl font-display text-text relative group flex items-center justify-center min-h-[64px]">
        {result && result.words && result.words.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
            {result.words.map((w, idx) => (
              <span
                key={idx}
                className={cn(
                  "font-bold transition-all duration-300",
                  w.accuracy === 'correct' 
                    ? "text-success drop-shadow-[0_1.5px_1.5px_rgba(34,197,94,0.15)]" 
                    : "text-danger line-through decoration-wavy decoration-danger/40"
                )}
              >
                {w.word}
              </span>
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
            <motion.div 
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
                <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="text-[0.65rem] uppercase font-bold tracking-widest gap-2">
                  <RefreshCcw size={14} />
                  {'Retry'}
                </Button>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                <p className="text-[0.65rem] font-bold text-primary uppercase tracking-widest mb-2">
                  {'Tati\'s Feedback'}
                </p>
                <p className="text-xs text-text-muted italic leading-relaxed">
                  "{result.feedback}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isRecording && !result && !isEvaluating && (
          <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">
            {'Click on the microphone to speak.'}
          </p>
        )}
      </div>
    </div>
  );
}
