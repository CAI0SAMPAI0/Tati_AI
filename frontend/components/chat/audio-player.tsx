'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredAccent } from '@/lib/constants/accents';
import { apiPost } from '@/lib/api/client';

interface AudioPlayerProps {
  url?: string;
  base64?: string;
  className?: string;
  autoPlay?: boolean;
  text?: string;
  onAudioUpdated?: (newBase64: string) => void;
}

export function AudioPlayer({ url, base64, className, autoPlay, text, onAudioUpdated }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeBase64, setActiveBase64] = useState<string | undefined>(base64);
  const [activeUrl, setActiveUrl] = useState<string | undefined>(url);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerIdRef = useRef<string>(`player-${Math.random().toString(36).slice(2, 9)}`);
  const autoPlayedSrcRef = useRef<string | null>(null);

  const initialAccentRef = useRef<string>(getStoredAccent());

  // Interrompe este áudio se outro player começar a tocar no chat
  useEffect(() => {
    const handleStopOther = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id !== playerIdRef.current) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };
    window.addEventListener('tati_pause_other_audio', handleStopOther);
    return () => {
      window.removeEventListener('tati_pause_other_audio', handleStopOther);
    };
  }, []);

  useEffect(() => {
    setActiveBase64(base64);
  }, [base64]);

  useEffect(() => {
    setActiveUrl(url);
  }, [url]);

  const audioSrc = activeBase64 ? `data:audio/mp3;base64,${activeBase64}` : activeUrl;

  useEffect(() => {
    if (autoPlay && audioRef.current && !isPlaying && audioSrc && autoPlayedSrcRef.current !== audioSrc) {
      autoPlayedSrcRef.current = audioSrc;
      window.dispatchEvent(
        new CustomEvent('tati_pause_other_audio', { detail: { id: playerIdRef.current } })
      );
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Navegadores podem bloquear autoplay sem interação prévia
        });
    }
  }, [audioSrc, autoPlay, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      const p = (audio.currentTime / audio.duration) * 100;
      setProgress(isNaN(p) ? 0 : p);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const currentStoredAccent = getStoredAccent();
    const accentChanged = Boolean(text && initialAccentRef.current && initialAccentRef.current !== currentStoredAccent);
    const missingAudio = !activeBase64 && !activeUrl && Boolean(text);

    if ((accentChanged || missingAudio) && text) {
      try {
        setIsLoadingAudio(true);
        const res = await apiPost<{ audio_b64?: string; audio?: string }>('/chat/tts', {
          text: text,
          message: text,
          accent: currentStoredAccent,
        });
        if (res.ok && (res.data?.audio_b64 || res.data?.audio)) {
          const newB64 = (res.data.audio_b64 || res.data.audio) as string;
          setActiveBase64(newB64);
          initialAccentRef.current = currentStoredAccent;
          onAudioUpdated?.(newB64);
          setTimeout(() => {
            if (audioRef.current) {
              window.dispatchEvent(
                new CustomEvent('tati_pause_other_audio', { detail: { id: playerIdRef.current } })
              );
              audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch((e) => console.error('Play error after TTS fetch:', e));
            }
          }, 50);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch TTS for updated accent:', err);
      } finally {
        setIsLoadingAudio(false);
      }
    }

    if (audioSrc) {
      window.dispatchEvent(
        new CustomEvent('tati_pause_other_audio', { detail: { id: playerIdRef.current } })
      );
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Play error:', err));
    }
  };

  const handleVolumeChange = (v: number) => {
    if (!audioRef.current) return;
    setVolume(v);
    audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      handleVolumeChange(0.5);
    }
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setSpeed(nextSpeed);
    audioRef.current.playbackRate = nextSpeed;
  };

  if (!audioSrc && !text) return null;

  return (
    <div className={cn("flex flex-col gap-2 mt-2 animate-in fade-in slide-in-from-top-1", className)}>
      <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border rounded-2xl px-3 py-2 w-fit shadow-sm">
        <audio ref={audioRef} src={audioSrc} />
        
        <button 
          onClick={togglePlay}
          disabled={isLoadingAudio}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover transition-all active:scale-90 shadow-md shadow-primary/20 disabled:opacity-75 cursor-pointer"
          title={isLoadingAudio ? "Loading accent audio..." : isPlaying ? "Pause audio" : "Play audio"}
        >
          {isLoadingAudio ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        <div className="w-28 h-1.5 bg-border rounded-full overflow-hidden relative mx-1">
          <div 
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-100" 
            style={{ width: `${progress}%` }} 
          />
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          {/* Speed Control */}
          <button 
            onClick={cycleSpeed}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-secondary border border-border hover:border-primary/30 transition-all text-[0.65rem] font-bold text-text-muted hover:text-primary active:scale-95"
            title="Velocidade"
          >
            <Gauge size={12} />
            <span>{speed}x</span>
          </button>

          {/* Volume Control */}
          <div className="relative flex items-center">
            <button 
              onClick={() => setShowVolume(!showVolume)}
              className={cn(
                "p-1.5 text-text-muted hover:text-text transition-colors rounded-lg",
                showVolume && "bg-bg-secondary text-primary"
              )}
            >
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            
            {showVolume && (
              <>
                <div 
                  className="fixed inset-0 z-0" 
                  onClick={() => setShowVolume(false)} 
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-surface border border-border rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 origin-bottom z-10">
                  <div className="flex flex-col items-center gap-2">
                    <input 
                      type="range" 
                      min="0" max="1" step="0.1" 
                      value={isMuted ? 0 : volume} 
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 h-1.5 bg-bg border border-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-[0.6rem] font-black text-text-muted">{Math.round(volume * 100)}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
