'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '@/lib/api/client';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────

export interface AvatarFrames {
  has_frames?: boolean;
  normal?: string;
  meio?: string;
  aberta?: string;
  bem_aberta?: string;
  ouvindo?: string;
  piscando?: string;
  surpresa?: string;
  frame_A?: string;
  frame_B?: string;
  frame_C?: string;
  frame_D?: string;
  frame_E?: string;
  frame_F?: string;
}

interface VoiceAvatarProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioElement?: HTMLAudioElement | null;
  lastAssistantText?: string;
  className?: string;
}

// ── Default local asset frames (always available with 0 latency) ─────

const DEFAULT_FRAMES: AvatarFrames = {
  has_frames: true,
  normal: '/avatar/avatar_tati_normal.webp',
  meio: '/avatar/avatar_tati_meio.webp',
  aberta: '/avatar/avatar_tati_aberta.webp',
  bem_aberta: '/avatar/avatar_tati_bem_aberta.webp',
  ouvindo: '/avatar/avatar_tati_ouvindo.webp',
  piscando: '/avatar/tati_piscando.webp',
  surpresa: '/avatar/tati_surpresa.webp',
  frame_A: '/avatar/frame_A.webp',
  frame_B: '/avatar/frame_B.webp',
  frame_C: '/avatar/frame_C.webp',
  frame_D: '/avatar/frame_D.webp',
  frame_E: '/avatar/frame_E.webp',
  frame_F: '/avatar/frame_F.webp',
};

// ── Emotion detection ────────────────────────────────────────────────

const SURPRISE_RE = /!|uau|wow|incrível|incredible|que\b.{0,20}!/i;
const POSITIVE_RE = /parabéns|congratulations|perfeito|perfect|excelente|excellent|maravilhoso|wonderful|fantástico|fantastic|ótimo|great|brilliant|😊|😄|😃|🎉|👏/i;

function detectEmotion(text?: string): 'surprise' | 'positive' | 'neutral' {
  if (!text) return 'neutral';
  if (SURPRISE_RE.test(text)) return 'surprise';
  if (POSITIVE_RE.test(text)) return 'positive';
  return 'neutral';
}

function resolveFrameUrl(path?: string): string {
  if (!path) return DEFAULT_FRAMES.normal!;
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('/avatar/') || path.startsWith('/images/')) {
    return path;
  }
  return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
}

// ── Web Audio Node Cache (prevents duplicate MediaElementAudioSourceNode) ──

const mediaSourceCache = new WeakMap<
  HTMLAudioElement,
  {
    ctx: AudioContext;
    source: MediaElementAudioSourceNode;
    analyser: AnalyserNode;
  }
>();

function getAudioNodes(audio: HTMLAudioElement) {
  let nodes = mediaSourceCache.get(audio);
  if (!nodes) {
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      const ctx = new AudioCtxClass();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.2;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      nodes = { ctx, source, analyser };
      mediaSourceCache.set(audio, nodes);
    } catch {
      return null;
    }
  }

  if (nodes && nodes.ctx.state === 'suspended') {
    nodes.ctx.resume().catch(() => {});
  }
  return nodes;
}

// ── Main Component ───────────────────────────────────────────────────

export function VoiceAvatar({
  state,
  audioElement,
  lastAssistantText,
  className,
}: VoiceAvatarProps) {
  // Query backend frames if custom frames exist, otherwise fallback to DEFAULT_FRAMES
  const { data: remoteFrames } = useQuery<AvatarFrames>({
    queryKey: ['avatar-frames'],
    queryFn: () => apiGet<AvatarFrames>('/avatar/frames'),
    staleTime: Infinity,
  });

  const framesRef = useRef<AvatarFrames>(DEFAULT_FRAMES);
  useEffect(() => {
    framesRef.current =
      remoteFrames?.has_frames && remoteFrames.normal ? remoteFrames : DEFAULT_FRAMES;
  }, [remoteFrames]);

  // Current frame state
  const [currentFrame, setCurrentFrame] = useState<string>(DEFAULT_FRAMES.normal!);
  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  const setFrame = useCallback((frameKeyOrUrl: string) => {
    const f = framesRef.current;
    let url = frameKeyOrUrl;
    if (frameKeyOrUrl in f) {
      url = (f as Record<string, string | undefined>)[frameKeyOrUrl] || DEFAULT_FRAMES.normal!;
    }
    const resolved = resolveFrameUrl(url);
    if (resolved && resolved !== currentFrameRef.current) {
      currentFrameRef.current = resolved;
      setCurrentFrame(resolved);
    }
  }, []);

  // Preload all frames into browser cache for zero-latency switching
  useEffect(() => {
    const urls = Object.values(DEFAULT_FRAMES).filter(
      (v): v is string => typeof v === 'string' && v.startsWith('/')
    );
    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  // ── State Animation Engine ──────────────────────────────────────────

  useEffect(() => {
    let isCancelled = false;
    let timerId: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null = null;

    // 1. IDLE STATE: Tatiana looks normal and blinks naturally every 3.2s – 5.2s
    if (state === 'idle') {
      setFrame('normal');

      const scheduleIdleBlink = () => {
        const delay = 3200 + Math.random() * 2000;
        timerId = setTimeout(() => {
          if (isCancelled) return;
          setFrame('piscando');
          timerId = setTimeout(() => {
            if (isCancelled) return;
            setFrame('normal');
            scheduleIdleBlink();
          }, 150);
        }, delay);
      };

      scheduleIdleBlink();

      return () => {
        isCancelled = true;
        if (timerId) clearTimeout(timerId);
      };
    }

    // 2. LISTENING STATE: Tatiana tilts head attentively in 'ouvindo' pose
    if (state === 'listening') {
      setFrame('ouvindo');
      return () => {
        isCancelled = true;
      };
    }

    // 3. PROCESSING STATE: Thoughtful slow blinking indicating reflection
    if (state === 'processing') {
      setFrame('normal');
      let isBlinking = false;
      timerId = setInterval(() => {
        if (isCancelled) return;
        isBlinking = !isBlinking;
        setFrame(isBlinking ? 'piscando' : 'normal');
      }, 2200);

      return () => {
        isCancelled = true;
        if (timerId) clearInterval(timerId);
      };
    }

    // 4. SPEAKING STATE: Lip-sync with audio volume or natural cadence loop
    if (state === 'speaking') {
      const emotion = detectEmotion(lastAssistantText);
      let cadenceIndex = 0;

      const CADENCE_FRAMES = [
        'meio',
        'frame_A',
        'aberta',
        'frame_B',
        'meio',
        'frame_C',
        'bem_aberta',
        'frame_D',
        'normal',
        'frame_E',
        'meio',
        'frame_F',
      ];

      // If emotion is surprise/excitement, show surprise expression briefly
      let surpriseTimer: ReturnType<typeof setTimeout> | null = null;
      if (emotion === 'surprise') {
        setFrame('surpresa');
        surpriseTimer = setTimeout(() => {
          if (!isCancelled) setFrame('meio');
        }, 350);
      } else {
        setFrame('meio');
      }

      // Audio frequency setup
      const audioNodes = audioElement ? getAudioNodes(audioElement) : null;
      const freqData = audioNodes ? new Uint8Array(audioNodes.analyser.frequencyBinCount) : null;

      // Real-time animation interval (~70ms)
      const mouthInterval = setInterval(() => {
        if (isCancelled) return;

        // If audio element is paused or ended, close mouth to normal
        if (audioElement && (audioElement.paused || audioElement.ended)) {
          setFrame('normal');
          return;
        }

        let avgVolume = 0;
        if (audioNodes && freqData) {
          try {
            audioNodes.analyser.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) {
              sum += freqData[i];
            }
            avgVolume = sum / freqData.length;
          } catch {
            avgVolume = 0;
          }
        }

        if (avgVolume >= 12) {
          // Dynamic mouth animation based on audio frequency energy
          if (avgVolume < 18) {
            setFrame('normal');
          } else if (avgVolume < 65) {
            const mediumPool = ['meio', 'frame_A', 'frame_C', 'frame_B'];
            setFrame(mediumPool[cadenceIndex % mediumPool.length]);
          } else {
            const highPool = ['bem_aberta', 'aberta', 'frame_E', 'frame_D'];
            setFrame(highPool[cadenceIndex % highPool.length]);
          }
          cadenceIndex++;
        } else {
          // Cadence fallback: ensures mouth animates whenever audio is playing
          cadenceIndex++;
          setFrame(CADENCE_FRAMES[cadenceIndex % CADENCE_FRAMES.length]);
        }
      }, 75);

      // Periodic blink during long speech (every 4.5s)
      const speechBlinkInterval = setInterval(() => {
        if (isCancelled) return;
        setFrame('piscando');
        setTimeout(() => {
          if (!isCancelled) setFrame('meio');
        }, 120);
      }, 4500);

      return () => {
        isCancelled = true;
        if (surpriseTimer) clearTimeout(surpriseTimer);
        clearInterval(mouthInterval);
        clearInterval(speechBlinkInterval);
        setFrame('normal');
      };
    }
  }, [state, audioElement, lastAssistantText, setFrame]);

  return (
    <div
      className={cn(
        'relative w-[140px] h-[140px] sm:w-[200px] sm:h-[200px] md:w-[220px] md:h-[220px] lg:w-[230px] lg:h-[230px] shrink-0 transition-all duration-700 ease-in-out',
        state === 'listening' && 'listening',
        state === 'processing' && 'processing',
        state === 'speaking' && 'speaking',
        className
      )}
    >
      {/* Glow Blur */}
      <div
        className={cn(
          'absolute inset-[-30px] sm:inset-[-40px] rounded-full blur-[50px] transition-all duration-700 pointer-events-none z-0',
          state === 'idle' && 'opacity-0',
          state === 'listening' && 'opacity-40 bg-emerald-500',
          state === 'processing' && 'opacity-40 bg-amber-400',
          state === 'speaking' && 'opacity-40 bg-primary'
        )}
      />

      {/* Ring 1 (Inner pulse) */}
      <div
        className={cn(
          'absolute inset-[-10px] sm:inset-[-14px] rounded-full pointer-events-none transition-colors duration-500 z-0',
          state === 'idle' && 'border-2 border-primary/30 animate-ring-idle',
          state === 'listening' && 'border-2 border-emerald-400/80 animate-ring-listen',
          state === 'processing' && 'border-2 border-amber-400/70 animate-ring-process',
          state === 'speaking' && 'border-2 border-primary/90 animate-ring-speak'
        )}
      />

      {/* Ring 2 (Outer pulse delayed) */}
      <div
        className={cn(
          'absolute inset-[-20px] sm:inset-[-28px] rounded-full pointer-events-none transition-colors duration-500 z-0',
          state === 'idle' && 'border-[1.5px] border-primary/15 animate-ring-idle-delayed',
          state === 'listening' && 'border-[1.5px] border-emerald-400/40 animate-ring-listen-delayed',
          state === 'processing' && 'border-[1.5px] border-amber-400/30 animate-ring-process-delayed',
          state === 'speaking' && 'border-[1.5px] border-primary/50 animate-ring-speak-delayed'
        )}
      />

      {/* Main Avatar Circular Frame */}
      <div className="w-full h-full rounded-full border-[4px] sm:border-[5px] md:border-[6px] border-primary shadow-[0_0_30px_rgba(124,58,237,0.35)] overflow-hidden bg-bg-secondary relative z-10 transition-transform duration-500 hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentFrame}
          alt="Teacher Tatiana"
          className="w-full h-full object-cover object-top select-none pointer-events-none transition-opacity duration-75"
          onError={(e) => {
            if (e.currentTarget.src !== DEFAULT_FRAMES.normal) {
              e.currentTarget.src = DEFAULT_FRAMES.normal!;
            }
          }}
        />
      </div>
    </div>
  );
}
