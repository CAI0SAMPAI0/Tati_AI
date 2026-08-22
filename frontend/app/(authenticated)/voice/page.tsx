'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  RefreshCcw,
  Activity,
  CheckCircle2,
  Circle,
  Globe
} from 'lucide-react';
import dynamic from 'next/dynamic';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

import { useVoiceSocket } from '@/hooks/useVoiceSocket';
import { useVoiceLiveSocket } from '@/hooks/useVoiceLiveSocket';
import { VoiceAvatar } from '@/components/chat/voice-avatar';
import { VoiceMessageBubble } from '@/components/chat/voice-message-bubble';
import WordTooltip from '@/components/chat/word-tooltip';
import { apiGet, apiPost } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

function exportWavRaw(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
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

function VoicePageContent() {
  const [Markdown, setMarkdown] = useState<any>(null);
  useEffect(() => {
    import('react-markdown').then((mod) => {
      setMarkdown(() => mod.default);
    });
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const convIdParam = searchParams.get('conv_id');
  const simulationId = searchParams.get('simulation_id');

  const [convId, setConvId] = useState<string | null>(convIdParam);
  const [simulationTitle, setSimulationTitle] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const ACCENTS = [
    { id: 'en-US', label: '🇺🇸 American', shortLabel: 'US', desc: 'United States' },
    { id: 'en-GB', label: '🇬🇧 British', shortLabel: 'UK', desc: 'United Kingdom' },
    { id: 'en-AU', label: '🇦🇺 Australian', shortLabel: 'AU', desc: 'Australia' },
    { id: 'en-CA', label: '🇨🇦 Canadian', shortLabel: 'CA', desc: 'Canada' },
    { id: 'en-IE', label: '🇮🇪 Irish', shortLabel: 'IE', desc: 'Ireland' },
    { id: 'en-IN', label: '🇮🇳 Indian', shortLabel: 'IN', desc: 'India' },
    { id: 'en-ZA', label: '🇿🇦 South African', shortLabel: 'ZA', desc: 'South Africa' },
    { id: 'en-NZ', label: '🇳🇿 New Zealand', shortLabel: 'NZ', desc: 'New Zealand' },
  ];

  const [accentIndex, setAccentIndex] = useState(0);
  const [isChangingAccent, setIsChangingAccent] = useState(false);
  const [isAccentMenuOpen, setIsAccentMenuOpen] = useState(false);
  const accentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tati_voice_accent');
      if (saved) {
        const found = ACCENTS.findIndex(a => a.id === saved);
        if (found !== -1) {
          setAccentIndex(found);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accentMenuRef.current && !accentMenuRef.current.contains(e.target as Node)) {
        setIsAccentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeAccentToIndex = async (newIndex: number) => {
    const safeIndex = (newIndex + ACCENTS.length) % ACCENTS.length;
    setAccentIndex(safeIndex);
    const newAccent = ACCENTS[safeIndex];
    try {
      localStorage.setItem('tati_voice_accent', newAccent.id);
    } catch (_) {}

    toast.success(`Accent: ${newAccent.label}`, { id: 'accent-toast', duration: 2000 });

    const currentMessages = isLiveMode ? liveMessages : normalMessages;
    const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant');

    if (lastAssistantMsg && lastAssistantMsg.content) {
      setIsChangingAccent(true);
      try {
        const res = await apiPost<{ audio: string }>('/chat/tts', {
          text: lastAssistantMsg.content,
          accent: newAccent.id,
        });

        if (res.ok && res.data?.audio) {
          const newAudio = res.data.audio;

          const updater = (prev: typeof currentMessages) => {
            const lastIdx = prev.map(m => m.role).lastIndexOf('assistant');
            if (lastIdx !== -1) {
              const copy = [...prev];
              copy[lastIdx] = { ...copy[lastIdx], audio_b64: newAudio };
              return copy;
            }
            return prev;
          };

          if (isLiveMode) {
            setLiveMessages(updater);
          } else {
            setNormalMessages(updater);
          }

          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = `data:audio/mp3;base64,${newAudio}`;
            audioRef.current.load();
            audioRef.current.play().catch(e => {
              console.log('Audio autoplay prevented or interrupted:', e);
            });
            if (isLiveMode) {
              setLiveState('speaking');
            } else {
              setNormalState('speaking');
            }
          }
        }
      } catch (err) {
        console.error('Error reloading audio with new accent:', err);
      } finally {
        setIsChangingAccent(false);
      }
    }
  };

  const handleCycleAccent = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    changeAccentToIndex(accentIndex + 1);
  };

  const handleWheelAccent = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      changeAccentToIndex(accentIndex + 1);
    } else if (e.deltaY < 0) {
      changeAccentToIndex(accentIndex - 1);
    }
  };

  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isLiveMode, setIsLiveMode] = useState(false);

  const {
    state: normalState,
    setState: setNormalState,
    messages: normalMessages,
    setMessages: setNormalMessages,
    lastAudio: normalLastAudio,
    transcription: normalTranscription,
    sendAudio,
    activeConvId,
    completedObjectives,
    setCompletedObjectives
  } = useVoiceSocket(convId, simulationId);

  const {
    messages: liveMessages,
    setMessages: setLiveMessages,
    state: liveState,
    setState: setLiveState,
    lastAudio: liveLastAudio,
    transcription: liveTranscription,
    connect: connectLive,
    disconnect: disconnectLive,
    sendAudioChunk
  } = useVoiceLiveSocket();

  const state = isLiveMode ? liveState : normalState;
  const setState = isLiveMode ? setLiveState : setNormalState;
  const messages = isLiveMode ? liveMessages : normalMessages;
  const setMessages = isLiveMode ? setLiveMessages : setNormalMessages;
  const lastAudio = isLiveMode ? liveLastAudio : normalLastAudio;
  const transcription = isLiveMode ? liveTranscription : normalTranscription;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const liveStateRef = useRef(liveState);
  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);
  const silenceTimerRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const accumulatedAudioRef = useRef<Float32Array[]>([]);
  const hasSpokenRef = useRef(false);

  useEffect(() => {
    if (activeConvId && activeConvId !== convId) {
      setConvId(activeConvId);
    }
  }, [activeConvId, convId]);

  useEffect(() => {
    if (isLiveMode && liveState === 'listening') {
      accumulatedAudioRef.current = [];
      silenceTimerRef.current = 0;
      hasSpokenRef.current = false;
      console.log('[Live VAD] State transitioned back to listening. Cleared accumulated audio buffer, silence timer, and hasSpoken flag.');
    }
  }, [liveState, isLiveMode]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state === 'processing') {
      timer = setTimeout(() => {
        if (state === 'processing') {
          setState('idle');
        }
      }, 15000);
    }
    return () => clearTimeout(timer);
  }, [state, setState]);

  const [objectives, setObjectives] = useState<Array<{ id: string; text: string }>>([]);

  useEffect(() => {
    if (simulationId) {
      apiGet<any>(`/simulation/scenarios/${simulationId}`)
        .then(res => {
          setSimulationTitle(res.name);
          if (res.objectives) {
            setObjectives(res.objectives);
          }
        })
        .catch(() => {
          setSimulationTitle('Simulation');
        });
    }
  }, [simulationId]);

  const handleStartSimulation = async () => {
    if (!simulationId || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const res = await apiPost<any>('/simulation/start', { 
        scenario_id: simulationId,
        accent: ACCENTS[accentIndex].id
      });
      if (res.ok && res.data?.id) {
        const simData = res.data;
        setConvId(simData.id);
        if (simData.objectives) {
          setObjectives(simData.objectives);
        }
        if (simData.completed_objectives) {
          setCompletedObjectives(simData.completed_objectives);
        }
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
              audioRef.current.play().catch(() => {});
            }
          }
        }
        router.replace(`/voice?conv_id=${simData.id}&simulation_id=${simulationId}`);
        toast.success('Simulation started!');
      } else {
        setError('Could not start on server. Check your connection.');
      }
    } catch (err: any) {
      setError(`Error: ${err.message || 'Connection failed'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const queryClient = useQueryClient();
  const handleFinishSimulation = async () => {
    if (!simulationId) return;
    try {
      await apiPost(`/simulation/complete/${simulationId}`, {});
      await queryClient.invalidateQueries({ queryKey: ['activities-simulations-progress'] });
      toast.success('Simulation completed!');
      router.push('/activities');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, transcription]);

  useEffect(() => {
    if (lastAudio && audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      audio.src = `data:audio/mp3;base64,${lastAudio}`;
      audio.load();
      audio.play().catch(e => {
        if (e.name === 'NotAllowedError') {
          toast('Tap the avatar to listen.', { icon: '📢' });
        }
      });
    }
  }, [lastAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.playbackRate = speed;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setState('idle');
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [volume, speed, setState]);

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
    if (!convId && !!simulationId) return;
    
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
          sendAudio(base64, ACCENTS[accentIndex].id);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setState('listening');
    } catch (err) {
      toast.error('Mic error: permission denied.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === 'listening') {
      mediaRecorderRef.current.stop();
      setState('processing');
    }
  };

  const startLiveMode = async () => {
    if (user?.username !== 'programador') {
      toast.error('Modo Live está em desenvolvimento. Em breve disponível!');
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsLiveMode(true);
    setLiveMessages([]);
    connectLive();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (AudioCtx.state === 'suspended') {
        await AudioCtx.resume();
      }
      audioContextRef.current = AudioCtx;
      
      const source = AudioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const analyser = AudioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const workletCode = `
        class AudioAccumulator extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input[0]) {
              this.port.postMessage(new Float32Array(input[0]));
            }
            return true;
          }
        }
        registerProcessor('audio-accumulator', AudioAccumulator);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await AudioCtx.audioWorklet.addModule(workletUrl);

      const processor = new AudioWorkletNode(AudioCtx, 'audio-accumulator');
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(AudioCtx.destination);
      
      accumulatedAudioRef.current = [];
      setLiveState('listening');
      liveStateRef.current = 'listening';
      
      let buffer4096 = new Float32Array(4096);
      let bufferOffset = 0;

      processor.port.onmessage = (e) => {
        const chunk = e.data;
        let chunkOff = 0;
        while (chunkOff < chunk.length) {
          const space = 4096 - bufferOffset;
          const toCopy = Math.min(chunk.length - chunkOff, space);
          buffer4096.set(chunk.subarray(chunkOff, chunkOff + toCopy), bufferOffset);
          bufferOffset += toCopy;
          chunkOff += toCopy;

          if (bufferOffset < 4096) break;
          
          const inputData = new Float32Array(buffer4096);
          bufferOffset = 0;
          
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);

          if (rms >= 0.018) {
            if (!hasSpokenRef.current) {
              hasSpokenRef.current = true;
              console.log(`[Live VAD] Speech detected (RMS: ${rms.toFixed(5)}). Recording...`);
            }
          }
          
          if (liveStateRef.current === 'speaking' && rms > 0.02) {
            if (audioRef.current) {
              console.log('[Live VAD] User speech detected during playback. Interrupting AI audio.');
              audioRef.current.pause();
              setLiveState('listening');
              liveStateRef.current = 'listening';
            }
          }
          
          if (liveStateRef.current === 'listening') {
            accumulatedAudioRef.current.push(inputData);
            if (rms < 0.018) {
              if (hasSpokenRef.current) {
                silenceTimerRef.current += 4096 / AudioCtx.sampleRate;
                if (silenceTimerRef.current >= 0.3) {
                  console.log(`[Live VAD] Silence accumulating: ${silenceTimerRef.current.toFixed(2)}s / 1.0s (RMS: ${rms.toFixed(5)})`);
                }
                
                if (silenceTimerRef.current >= 1.0) {
                  const totalLength = accumulatedAudioRef.current.reduce((acc, val) => acc + val.length, 0);
                  if (totalLength > 16000) {
                    console.log(`[Live VAD] Silence threshold reached. Sending ${totalLength} samples of audio...`);
                    const resultBuffer = new Float32Array(totalLength);
                    let offset = 0;
                    for (const chunk of accumulatedAudioRef.current) {
                      resultBuffer.set(chunk, offset);
                      offset += chunk.length;
                    }
                    
                    const wavBuffer = exportWavRaw(resultBuffer, AudioCtx.sampleRate);
                    const bytes = new Uint8Array(wavBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.length; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    const base64 = btoa(binary);
                    sendAudioChunk(base64, ACCENTS[accentIndex].id);
                    
                    accumulatedAudioRef.current = [];
                    silenceTimerRef.current = 0;
                    hasSpokenRef.current = false;
                    setLiveState('processing');
                    liveStateRef.current = 'processing';
                  }
                }
              }
            } else {
              silenceTimerRef.current = 0;
            }
          }
        }
      };
    } catch (err) {
      toast.error('Failed to start Live Mode mic.');
    }
  };

  const stopLiveMode = () => {
    setIsLiveMode(false);
    disconnectLive();
    setLiveState('idle');
    liveStateRef.current = 'idle';
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !analyserRef.current || !isLiveMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#818cf8');
      gradient.addColorStop(1, '#ec4899');
      ctx.strokeStyle = gradient;
      
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [state, isLiveMode]);

  useEffect(() => {
    return () => {
      disconnectLive();
      if (processorRef.current) processorRef.current.disconnect();
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [disconnectLive]);

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
    <div className="fixed inset-0 bg-[#f4f7ff] dark:bg-[#05060b] flex flex-col md:flex-row font-sans overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[80%] h-[80%] rounded-full bg-primary/10 dark:bg-primary/5 blur-[140px] animate-pulse duration-[15s]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full bg-accent/15 dark:bg-accent/5 blur-[120px] animate-pulse duration-[20s] [animation-delay:5s]" />
      </div>

      <audio 
        ref={audioRef} 
        autoPlay
        onEnded={() => {
          if (isLiveMode) {
            setLiveState('listening');
          } else {
            setNormalState('idle');
          }
        }} 
        onPlay={() => {
          if (isLiveMode) {
            setLiveState('speaking');
          } else {
            setNormalState('speaking');
          }
        }} 
        onPause={() => {
          if (!isLiveMode) {
            setNormalState('idle');
          }
        }} 
      />

      <MotionDiv initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className="w-full md:w-[42%] lg:w-[38%] h-[38vh] sm:h-[40vh] md:h-full relative flex flex-col items-center justify-center p-4 sm:p-8 bg-white/40 dark:bg-[#0f1120]/60 backdrop-blur-3xl border-b md:border-b-0 md:border-r border-white/40 dark:border-white/10 z-20 shadow-2xl transition-all">
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 flex items-center gap-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text hover:text-primary transition-all active:scale-95 shadow-xl backdrop-blur-xl group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Back</span>
          </button>
        </div>

        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-3">
          {user?.username === 'programador' && (
            <button 
              onClick={() => isLiveMode ? stopLiveMode() : startLiveMode()} 
              className={cn(
                "px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center gap-2",
                isLiveMode ? "text-white" : "bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text"
              )}
              style={isLiveMode ? { backgroundColor: 'var(--accent)' } : undefined}
            >
              <Activity size={14} className={isLiveMode ? "animate-pulse" : ""} />
              {isLiveMode ? "Live: On" : "Live Mode"}
            </button>
          )}
          {simulationId && (
            <button onClick={handleFinishSimulation} className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-success text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-success/90 transition-all active:scale-95 shadow-xl">
              Finish
            </button>
          )}
          <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="p-1.5 sm:p-2.5 rounded-xl bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary transition-all active:scale-95 shadow-xl backdrop-blur-xl">
             {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 sm:gap-8 mt-10 sm:mt-0">
          <div className="cursor-pointer hover:scale-105 active:scale-95 transition-all duration-700 scale-[0.6] sm:scale-90 md:scale-100" onClick={() => {
            if (isLiveMode) return;
            if (!convId) return;
            if (state === 'idle' && !audioRef.current?.src) startRecording();
            else if (state === 'speaking') togglePlayback();
            else if (audioRef.current?.src) {
              if (audioRef.current.ended) audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }}>
            <VoiceAvatar
              state={state}
              audioElement={audioRef.current}
              lastAssistantText={messages.filter(m => m.role === 'assistant').at(-1)?.content}
            />
          </div>
          <div className="text-center space-y-0.5 sm:space-y-3 px-4">
            <h1 className="text-lg sm:text-3xl md:text-5xl font-black text-text tracking-tighter line-clamp-1 md:line-clamp-2">
              {simulationTitle || 'Teacher Tati'}
            </h1>
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-0.5 sm:py-1.5 rounded-full bg-success/10 border border-success/30 shadow-lg backdrop-blur-2xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[8px] sm:text-[10px] font-black text-success uppercase tracking-widest">{'Online'}</span>
                </div>

                <button 
                  onClick={handleCycleAccent}
                  onWheel={handleWheelAccent}
                  title="Clique para alternar ou use a roda do mouse para trocar de sotaque"
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-0.5 sm:py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 shadow-lg backdrop-blur-2xl text-[9px] sm:text-[11px] font-bold text-primary transition-all active:scale-95 cursor-pointer group select-none"
                >
                  {isChangingAccent ? (
                    <RotateCcw className="animate-spin text-primary shrink-0" size={12} />
                  ) : (
                    <span className="shrink-0">{ACCENTS[accentIndex].label}</span>
                  )}
                  <span className="text-[8px] sm:text-[10px] opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-transform">⚡</span>
                </button>

                <button
                  onClick={() => setIsAccentMenuOpen(true)}
                  title="Ver e escolher todos os sotaques"
                  className="p-1 sm:p-1.5 rounded-full bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary transition-all active:scale-95 shadow-md text-xs flex items-center justify-center cursor-pointer"
                >
                  <Globe size={14} className="text-primary" />
                </button>
              </div>

              {/* Horizontal Scrollable Accent Carousel (Sempre Visível) */}
              <div className="w-full max-w-[300px] sm:max-w-sm overflow-x-auto py-1 scrollbar-hide no-scrollbar flex items-center gap-1.5 px-1">
                {ACCENTS.map((acc, idx) => {
                  const isSelected = idx === accentIndex;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => changeAccentToIndex(idx)}
                      title={`${acc.label} (${acc.desc})`}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm",
                        isSelected
                          ? "bg-primary text-white shadow-primary/30 ring-2 ring-primary/40 font-black scale-105"
                          : "bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary hover:bg-white/80"
                      )}
                    >
                      <span>{acc.label.split(' ')[0]}</span>
                      <span>{acc.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Accent Picker Modal via React Portal (Garante que nunca seja cortado) */}
        {typeof document !== 'undefined' && isAccentMenuOpen && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
              className="fixed inset-0 cursor-pointer"
              onClick={() => setIsAccentMenuOpen(false)}
            />
            <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111322] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[85vh] flex flex-col space-y-4 animate-in slide-in-from-bottom-5 duration-300">
              <div className="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
                <div className="space-y-0.5">
                  <h3 className="text-base sm:text-lg font-black text-text flex items-center gap-2">
                    <span>🌎</span> Sotaques em Inglês (Edge TTS)
                  </h3>
                  <p className="text-xs text-text-muted">A Teacher Tati responderá com a pronúncia selecionada</p>
                </div>
                <button 
                  onClick={() => setIsAccentMenuOpen(false)}
                  className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
                {ACCENTS.map((acc, idx) => {
                  const isSelected = idx === accentIndex;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        changeAccentToIndex(idx);
                        setIsAccentMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer",
                        isSelected
                          ? "bg-primary text-white border-primary shadow-lg font-bold scale-[1.02]"
                          : "bg-surface/60 dark:bg-white/5 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-text"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{acc.label.split(' ')[0]}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{acc.label.split(' ').slice(1).join(' ')}</div>
                          <div className={cn("text-[10px]", isSelected ? "text-white/80" : "text-text-muted")}>{acc.desc || acc.shortLabel}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center text-xs font-black shrink-0 shadow">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
      </MotionDiv>

      <MotionDiv initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} className="flex-1 flex flex-col min-h-0 bg-white/5 dark:bg-[#05060b]/40 relative z-10">
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
              {simulationId && objectives.length > 0 && (
                <MotionDiv key="simulation-objectives" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 p-4 rounded-3xl mb-6 space-y-3 animate-fade-in shadow-xl backdrop-blur-xl">
                  <p className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">Mission Objectives</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {objectives.map(obj => {
                      const isCompleted = completedObjectives.includes(obj.id);
                      return (
                        <div key={obj.id} className={cn("flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-[0.7rem] transition-all font-bold tracking-tight", isCompleted ? "bg-success/15 border-success/30 text-success line-through" : "bg-white/60 dark:bg-[#111224]/80 border-white/60 dark:border-white/5 text-text-muted")}>
                          {isCompleted ? <CheckCircle2 size={14} className="shrink-0 text-success" /> : <Circle size={14} className="shrink-0 text-text-subtle" />}
                          <span className="truncate" title={obj.text}>{obj.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </MotionDiv>
              )}
              {messages.length === 0 && !transcription ? (
                 <MotionDiv key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4 p-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <Mic size={24} className="text-primary/50" />
                    </div>
                    <p className="text-sm sm:text-lg italic tracking-widest text-center">
                        {isLiveMode ? 'Live Mode Active. Start speaking continuous English...' : simulationId ? 'Waiting for simulation...' : 'Say "Hello" to start your class...'}
                    </p>
                 </MotionDiv>
              ) : (
                <MotionDiv key="messages-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full space-y-6">
                  <div className="w-full flex flex-col gap-6 sm:gap-8">
                    {messages.map((m, idx) => (
                      <MotionDiv key={m.id || `msg-${idx}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                        <VoiceMessageBubble message={m} onWordClick={handleWordClick} />
                      </MotionDiv>
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
                </MotionDiv>
              )}
            </AnimatePresence>
          )}
        </div>

        <footer className="p-2 sm:p-4 md:p-6 bg-white/60 dark:bg-[#0a0b14]/95 backdrop-blur-3xl border-t border-white/60 dark:border-white/10 shrink-0 pb-safe">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <div className="flex-1 w-full bg-white/30 dark:bg-white/5 rounded-2xl sm:rounded-3xl p-2 sm:p-4 space-y-2 shadow-lg border border-white/20">
              {isLiveMode ? (
                <div className="h-16 w-full flex items-center justify-center">
                  <canvas ref={canvasRef} width="400" height="60" className="w-full h-full max-h-[60px]" />
                </div>
              ) : (
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
              )}
            </div>
            {!isLiveMode && (
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
            )}
          </div>
          <p className="text-center mt-4 sm:mt-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-text-subtle animate-pulse">
            {isLiveMode ? 'Live continuous mode is active' : (!convId && simulationId) ? 'Start simulation above' : state === 'listening' ? '🎙 Listening…' : state === 'processing' ? '⏳ Processing…' : 'Tap to speak'}
          </p>
        </footer>
      </MotionDiv>

      {activeWord && (
        <WordTooltip 
          word={activeWord} 
          position={tooltipPos} 
          onClose={() => setActiveWord(null)} 
        />
      )}

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
