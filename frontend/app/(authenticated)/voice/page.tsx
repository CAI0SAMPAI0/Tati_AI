'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Mic, 
  Square, 
  Play, 
  RotateCcw, 
  ArrowLeft, 
  Volume2, 
  X, 
  Sparkles,
  Moon,
  Sun,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceSocket } from '@/hooks/useVoiceSocket';
import { VoiceAvatar } from '@/components/chat/voice-avatar';
import { VoiceMessageBubble } from '@/components/chat/voice-message-bubble';
import WordTooltip from '@/components/chat/word-tooltip';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

function VoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const convIdParam = searchParams.get('conv_id');
  const simulationId = searchParams.get('simulation_id');

  const [convId, setConvId] = useState<string | null>(convIdParam);
  const [simulationTitle, setSimulationTitle] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {
    state,
    setState,
    messages,
    setMessages,
    lastAudio,
    transcription,
    sendAudio,
    activeConvId,
  } = useVoiceSocket(convId);

  // Sincroniza convId local com o activeConvId do hook (importante para novas conversas)
  useEffect(() => {
    if (activeConvId && activeConvId !== convId) {
      setConvId(activeConvId);
    }
  }, [activeConvId, convId]);

  // Safety timeout for "processing" state
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === 'processing') {
      timer = setTimeout(() => {
        if (state === 'processing') {
          console.warn('[VoicePage] Processing timeout - forcing idle');
          setState('idle');
        }
      }, 15000); // 15s safety
    }
    return () => clearTimeout(timer);
  }, [state, setState]);

  // Load simulation details if needed
  useEffect(() => {
    if (simulationId) {
      apiGet<any>(`/simulation/scenarios/${simulationId}`)
        .then(res => setSimulationTitle(res.name))
        .catch(() => setSimulationTitle('Simulation'));
    }
  }, [simulationId]);

  const handleStartSimulation = async () => {
    if (!simulationId || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/simulation/start', { scenario_id: simulationId });
      if (res.ok && res.data?.id) {
        const simData = res.data;
        setConvId(simData.id);
        if (simData.initial_message) {
          setMessages([{
            id: 'init',
            conversation_id: simData.id,
            role: 'assistant',
            content: simData.initial_message.content,
            created_at: new Date().toISOString()
          }]);
          
          if (simData.initial_message.audio) {
            const audioSrc = `data:audio/mp3;base64,${simData.initial_message.audio}`;
            if (audioRef.current) {
              audioRef.current.src = audioSrc;
              audioRef.current.play().catch(e => console.error("Audio auto-play failed:", e));
            }
          }
        }
        router.replace(`/voice?conv_id=${simData.id}&simulation_id=${simulationId}`);
        toast.success('Simulation started!');
      } else {
        setError('Could not start on server. Check your connection.');
      }
    } catch (err: any) {
      console.error('Start simulation error:', err);
      setError(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsStarting(false);
    }
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, transcription]);

  // Play audio when source changes
  useEffect(() => {
    if (lastAudio && audioRef.current) {
      const audio = audioRef.current;
      audio.src = `data:audio/mp3;base64,${lastAudio}`;
      audio.play().catch(e => {
        console.warn('Audio play blocked:', e);
        if (e.name === 'NotAllowedError') {
          toast('Tap the avatar to listen.', { icon: '📢' });
        }
      });
    }
  }, [lastAudio]);

  // Audio listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.playbackRate = speed;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [volume, speed]);

  const handleSeek = (val: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleWordClick = (word: string, x: number, y: number) => {
    setActiveWord(word);
    setTooltipPos({ x, y });
  };

  const startRecording = async () => {
    // Permite gravar se tiver convId OU se não for uma simulação (chat livre)
    if (!convId && !!simulationId) return;
    
    // Pause any playing audio from Tati
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          sendAudio(base64);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setState('listening');
    } catch (err) {
      toast.error('Connection error. Check if the server is running.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'listening') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (state === 'speaking') {
      audioRef.current.pause();
      setState('idle');
    } else if (audioRef.current.src) {
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch(() => {});
      setState('speaking');
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="p-4 rounded-full bg-danger/10 text-danger"><X size={48} /></div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Simulation Failed</h2>
          <p className="text-text-muted">{error}</p>
        </div>
        <button onClick={handleStartSimulation} className="px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:scale-105 transition-all flex items-center gap-2">
          <RefreshCcw size={18} /> Try Again
        </button>
        <button onClick={() => router.back()} className="text-sm text-text-muted hover:underline">Back</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#f4f7ff] dark:bg-[#05060b] flex flex-col md:flex-row font-sans overflow-hidden transition-colors duration-1000">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[80%] h-[80%] rounded-full bg-primary/10 dark:bg-primary/5 blur-[140px] animate-pulse duration-[15s]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full bg-accent/15 dark:bg-accent/5 blur-[120px] animate-pulse duration-[20s] [animation-delay:5s]" />
      </div>

      <audio ref={audioRef} onEnded={() => setState('idle')} onPlay={() => setState('speaking')} onPause={() => setState('idle')} />

      {/* LEFT SECTION: Avatar */}
      <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="w-full md:w-[42%] lg:w-[38%] h-[25vh] sm:h-[30vh] md:h-full relative flex flex-col items-center justify-center p-4 sm:p-8 bg-white/40 dark:bg-[#0f1120]/60 backdrop-blur-3xl border-b md:border-b-0 md:border-r border-white/40 dark:border-white/10 z-20 shadow-2xl transition-all">
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text hover:text-primary transition-all active:scale-95 shadow-xl backdrop-blur-xl group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Back</span>
          </button>
        </div>

        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-3">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 sm:p-2.5 rounded-xl bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary transition-all active:scale-95 shadow-xl backdrop-blur-xl">
             {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 sm:gap-8 mt-2 md:mt-0">
          <div className="cursor-pointer hover:scale-105 active:scale-95 transition-all duration-700 scale-[0.6] sm:scale-90 md:scale-100" onClick={() => {
            if (!convId) return;
            if (state === 'idle' && !audioRef.current?.src) startRecording();
            else if (state === 'speaking') togglePlayback();
            else if (audioRef.current?.src) {
              if (audioRef.current.ended) audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }}>
            <VoiceAvatar state={state} audioElement={audioRef.current} />
          </div>
          <div className="text-center space-y-0.5 sm:space-y-3 px-4">
            <h1 className="text-lg sm:text-3xl md:text-5xl font-black text-text tracking-tighter line-clamp-1 md:line-clamp-2">
              {simulationTitle || 'Teacher Tati'}
            </h1>
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-0.5 sm:py-2 rounded-full bg-success/10 border border-success/30 shadow-lg backdrop-blur-2xl">
              <span className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[7px] sm:text-[10px] font-black text-success uppercase tracking-widest">{'Online'}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RIGHT SECTION: Chat */}
      <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col min-h-0 bg-white/5 dark:bg-[#05060b]/40 relative z-10">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10 space-y-6 sm:space-y-8 scrollbar-hide mask-fade-top-giant">
          {!convId && simulationId ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-8 p-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-surface border border-border flex items-center justify-center shadow-2xl">
                        <Sparkles size={40} className="text-primary animate-bounce" />
                    </div>
                </div>
                <div className="max-w-xs space-y-4">
                    <h3 className="text-2xl font-black tracking-tight">Conversation Scenario</h3>
                    <p className="text-sm text-text-muted leading-relaxed">Click the button below to enter the scenario and practice your English with Teacher Tati.</p>
                </div>
                <button 
                    onClick={handleStartSimulation}
                    disabled={isStarting}
                    className="group relative px-10 py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                    <div className="flex items-center gap-3">
                        {isStarting ? <RotateCcw className="animate-spin" size={24} /> : <Play fill="white" size={24} />}
                        {isStarting ? 'Starting...' : 'Start Practice'}
                    </div>
                </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {messages.length === 0 && !transcription ? (
                 <div className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4 p-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <Mic size={24} className="text-primary/50" />
                    </div>
                    <p className="text-sm sm:text-lg italic tracking-widest text-center">
                        {simulationId ? 'Waiting for simulation...' : 'Say "Hello" to start your class...'}
                    </p>
                 </div>
              ) : (
                <>
                  <div className="w-full flex flex-col gap-6 sm:gap-8">
                    {messages.map((m) => (
                      <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                        <VoiceMessageBubble message={m} onWordClick={handleWordClick} />
                      </motion.div>
                    ))}
                  </div>
                  {state === 'processing' && (
                    <div className="flex gap-2 items-center px-4 py-2 text-text-subtle animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="w-2 h-2 rounded-full bg-primary" style={{ animationDelay: '200ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary" style={{ animationDelay: '400ms' }} />
                    </div>
                  )}
                  {transcription && state === 'listening' && (
                    <div className="flex justify-end italic text-primary/70 pr-4 text-sm">&ldquo;{transcription}&rdquo;</div>
                  )}
                </>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Footer: Controls */}
        <footer className="p-2 sm:p-4 md:p-6 bg-white/60 dark:bg-[#0a0b14]/95 backdrop-blur-3xl border-t border-white/60 dark:border-white/10 shrink-0 pb-safe">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <div className="flex-1 w-full bg-white/30 dark:bg-white/5 rounded-2xl sm:rounded-3xl p-2 sm:p-4 space-y-2 shadow-lg border border-white/20">
              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={togglePlayback} disabled={!audioRef.current?.src} className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90", state === 'speaking' ? "bg-danger text-white" : "bg-primary text-white hover:scale-105")}>
                  {state === 'speaking' ? <Square size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}
                </button>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-[7px] sm:text-[9px] tabular-nums text-text-muted w-5 sm:w-7">{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}</span>
                    <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => handleSeek(parseFloat(e.target.value))} className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                    <span className="text-[7px] sm:text-[9px] tabular-nums text-text-muted w-5 sm:w-7">{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4">
                       <div className="flex items-center gap-1.5 group">
                          <Volume2 size={10} className="text-text-muted group-hover:text-primary transition-colors" />
                          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-12 sm:w-16 h-0.5 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                       </div>
                       <div className="flex items-center gap-1.5 sm:gap-2">
                         {[0.75, 1, 1.25, 1.5].map(v => (
                           <button key={v} onClick={() => setSpeed(v)} className={cn("text-[7px] sm:text-[9px] font-black transition-all px-1 rounded-sm", speed === v ? "text-primary bg-primary/5" : "text-text-muted hover:text-text")}>{v}x</button>
                         ))}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button 
              onClick={state === 'listening' ? stopRecording : startRecording} 
              disabled={state === 'processing' || (!convId && !!simulationId)} 
              className={cn(
                "w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl active:scale-95 border-4 border-white/20 shrink-0", 
                (!convId && simulationId) ? "bg-text-subtle/20 opacity-50 cursor-not-allowed" : state === 'listening' ? "bg-danger" : state === 'processing' ? "bg-warning" : "bg-primary hover:scale-105"
              )}
            >
              {state === 'listening' ? <Square fill="white" size={24} /> : state === 'processing' ? <RotateCcw className="animate-spin text-white" /> : <Mic size={32} className="text-white" />}
            </button>
          </div>
          <p className="text-center mt-4 sm:mt-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-text-subtle animate-pulse">
            {(!convId && simulationId) ? 'Start simulation above' : state === 'listening' ? '🎙 Listening…' : state === 'processing' ? '⏳ Processing…' : 'Tap to speak'}
          </p>
        </footer>
      </motion.div>

      {activeWord && (
        <WordTooltip 
          word={activeWord} 
          position={tooltipPos} 
          onClose={() => setActiveWord(null)} 
        />
      )}

      <AnimatePresence>
        {isSummaryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSummaryOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-xl bg-white dark:bg-[#0f1120] rounded-[30px] sm:rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
               <div className="p-6 sm:p-8 border-b border-border flex justify-between items-center">
                  <h2 className="text-xl sm:text-2xl font-black">Pedagogical Summary</h2>
                  <button onClick={() => setIsSummaryOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl"><X /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 sm:p-8 prose dark:prose-invert max-w-none text-sm sm:text-base">
                  {loadingSummary ? <div className="py-10 sm:py-20 text-center animate-pulse">Generating summary...</div> : <ReactMarkdown>{summary || ''}</ReactMarkdown>}
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-fade-top-giant { mask-image: linear-gradient(to bottom, transparent, black 15%); }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
      `}</style>
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg flex items-center justify-center text-text-muted">Loading...</div>}>
      <VoicePageContent />
    </Suspense>
  );
}
