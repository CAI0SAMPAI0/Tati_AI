'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────

export interface VoiceAvatarProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioElement?: HTMLAudioElement | null;
  lastAssistantText?: string;
  className?: string;
}

// ── Frames locais estáticos ──────────────────────────────────────────

const FRAMES = {
  normal: '/avatar/avatar_tati_normal.webp',
  ouvindo: '/avatar/avatar_tati_ouvindo.webp',
  meio: '/avatar/avatar_tati_meio.webp',
  bem_aberta: '/avatar/avatar_tati_bem_aberta.webp',
  piscando: '/avatar/tati_piscando.webp',
};

// ── Cache de nós Web Audio (evita erro de duplicar createMediaElementSource) ──

const audioNodesCache = new WeakMap<
  HTMLAudioElement,
  {
    ctx: AudioContext;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
  }
>();

export function VoiceAvatar({
  state,
  audioElement,
  className,
}: VoiceAvatarProps) {
  const [currentFrame, setCurrentFrame] = useState(FRAMES.normal);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Pré-carrega todos os frames no cache do navegador para troca instantânea
  useEffect(() => {
    Object.values(FRAMES).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null = null;
    let mouthInterval: ReturnType<typeof setInterval> | null = null;

    const stopTimers = () => {
      if (blinkTimer) {
        clearTimeout(blinkTimer);
        clearInterval(blinkTimer as any);
        blinkTimer = null;
      }
      if (mouthInterval) {
        clearInterval(mouthInterval);
        mouthInterval = null;
      }
    };

    stopTimers();

    // ── 1. ESTADO: idle (Tatiana aguardando e piscando aleatoriamente) ──
    if (state === 'idle') {
      setCurrentFrame(FRAMES.normal);

      const scheduleBlink = () => {
        const delay = 3500 + Math.random() * 2000;
        blinkTimer = setTimeout(() => {
          if (stateRef.current !== 'idle') return;
          setCurrentFrame(FRAMES.piscando);
          blinkTimer = setTimeout(() => {
            if (stateRef.current !== 'idle') return;
            setCurrentFrame(FRAMES.normal);
            scheduleBlink();
          }, 140);
        }, delay);
      };

      scheduleBlink();
      return stopTimers;
    }

    // ── 2. ESTADO: listening (Quando o usuário está falando → frame ouvindo com piscar sutil) ──
    if (state === 'listening') {
      setCurrentFrame(FRAMES.ouvindo);
      const scheduleListeningBlink = () => {
        const delay = 3800 + Math.random() * 2500;
        blinkTimer = setTimeout(() => {
          if (stateRef.current !== 'listening') return;
          setCurrentFrame(FRAMES.piscando);
          blinkTimer = setTimeout(() => {
            if (stateRef.current !== 'listening') return;
            setCurrentFrame(FRAMES.ouvindo);
            scheduleListeningBlink();
          }, 140);
        }, delay);
      };
      scheduleListeningBlink();
      return stopTimers;
    }

    // ── 3. ESTADO: processing (Pensando / aguardando resposta com piscar rápido e natural) ──
    if (state === 'processing') {
      setCurrentFrame(FRAMES.normal);
      const scheduleProcessingBlink = () => {
        const delay = 2200 + Math.random() * 1500;
        blinkTimer = setTimeout(() => {
          if (stateRef.current !== 'processing') return;
          setCurrentFrame(FRAMES.piscando);
          blinkTimer = setTimeout(() => {
            if (stateRef.current !== 'processing') return;
            setCurrentFrame(FRAMES.normal);
            scheduleProcessingBlink();
          }, 140); // Pisca rápido (140ms) - olhos fechados por apenas um instante
        }, delay);
      };
      scheduleProcessingBlink();
      return stopTimers;
    }

    // ── 4. ESTADO: speaking (Tatiana falando → cadência suave e humana de fala) ──
    if (state === 'speaking') {
      // Cadência conversacional orgânica e suave: a boca abre e fecha num ritmo natural
      const mouthCycle = [
        FRAMES.meio,
        FRAMES.normal,
        FRAMES.meio,
        FRAMES.meio,
        FRAMES.bem_aberta,
        FRAMES.meio,
        FRAMES.normal,
        FRAMES.meio,
      ];
      let cycleIdx = 0;
      let smoothedAvg = 0;
      let lastFrameChangeTime = 0;

      let usingWebAudio = false;

      if (audioElement) {
        try {
          let nodes = audioNodesCache.get(audioElement);
          if (!nodes) {
            const AudioCtxClass =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtxClass) {
              const ctx = new AudioCtxClass();
              const source = ctx.createMediaElementSource(audioElement);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              analyser.smoothingTimeConstant = 0.3; // Suavização sonora agradável
              source.connect(analyser);
              analyser.connect(ctx.destination);
              nodes = { ctx, analyser, source };
              audioNodesCache.set(audioElement, nodes);
            }
          }

          if (nodes) {
            if (nodes.ctx.state === 'suspended') {
              nodes.ctx.resume().catch(() => {});
            }
            const freqData = new Uint8Array(nodes.analyser.frequencyBinCount);
            usingWebAudio = true;

            mouthInterval = setInterval(() => {
              if (stateRef.current !== 'speaking') return;

              nodes!.analyser.getByteFrequencyData(freqData);
              let sum = 0;
              for (let i = 0; i < freqData.length; i++) sum += freqData[i];
              const rawAvg = sum / freqData.length;
              smoothedAvg = smoothedAvg * 0.6 + rawAvg * 0.4;

              const now = Date.now();
              // Amortecimento: segura cada frame no mínimo 140ms para evitar flickering
              if (now - lastFrameChangeTime < 140) return;

              if (smoothedAvg >= 12) {
                lastFrameChangeTime = now;
                if (smoothedAvg < 20) {
                  setCurrentFrame(FRAMES.normal);
                } else if (smoothedAvg < 55) {
                  setCurrentFrame(FRAMES.meio);
                } else {
                  setCurrentFrame(FRAMES.bem_aberta);
                }
              } else {
                // Cadência suave em 180ms
                if (now - lastFrameChangeTime >= 180) {
                  lastFrameChangeTime = now;
                  cycleIdx = (cycleIdx + 1) % mouthCycle.length;
                  setCurrentFrame(mouthCycle[cycleIdx]);
                }
              }
            }, 60);
          }
        } catch {
          usingWebAudio = false;
        }
      }

      // Fallback sem Web Audio: cadência conversacional suave a cada 180ms
      if (!usingWebAudio) {
        mouthInterval = setInterval(() => {
          if (stateRef.current !== 'speaking') return;
          cycleIdx = (cycleIdx + 1) % mouthCycle.length;
          setCurrentFrame(mouthCycle[cycleIdx]);
        }, 180);
      }

      return () => {
        stopTimers();
        setCurrentFrame(FRAMES.normal);
      };
    }
  }, [state, audioElement]);

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
      {/* Glow Blur Suave */}
      <div
        className={cn(
          'absolute inset-[-30px] sm:inset-[-40px] rounded-full blur-[40px] transition-all duration-700 pointer-events-none z-0',
          state === 'idle' && 'opacity-0',
          state === 'listening' && 'opacity-25 bg-emerald-500',
          state === 'processing' && 'opacity-25 bg-amber-400',
          state === 'speaking' && 'opacity-25 bg-primary'
        )}
      />

      {/* Ring 1 (Pulso interno suave) */}
      <div
        className={cn(
          'absolute inset-[-10px] sm:inset-[-14px] rounded-full pointer-events-none transition-colors duration-500 z-0',
          state === 'idle' && 'border-2 border-primary/25 animate-ring-idle',
          state === 'listening' && 'border-2 border-emerald-400/70 animate-ring-listen',
          state === 'processing' && 'border-2 border-amber-400/60 animate-ring-process',
          state === 'speaking' && 'border-2 border-primary/75 animate-ring-speak'
        )}
      />

      {/* Ring 2 (Pulso externo mais sutil e com delay) */}
      <div
        className={cn(
          'absolute inset-[-20px] sm:inset-[-28px] rounded-full pointer-events-none transition-colors duration-500 z-0',
          state === 'idle' && 'border-[1.5px] border-primary/12 animate-ring-idle-delayed',
          state === 'listening' && 'border-[1.5px] border-emerald-400/30 animate-ring-listen-delayed',
          state === 'processing' && 'border-[1.5px] border-amber-400/25 animate-ring-process-delayed',
          state === 'speaking' && 'border-[1.5px] border-primary/35 animate-ring-speak-delayed'
        )}
      />

      {/* Frame Circular Principal */}
      <div className="w-full h-full rounded-full border-[4px] sm:border-[5px] md:border-[6px] border-primary shadow-[0_0_24px_rgba(124,58,237,0.25)] overflow-hidden bg-bg-secondary relative z-10 transition-transform duration-500 hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentFrame}
          alt="Teacher Tatiana"
          className="w-full h-full object-cover object-top select-none pointer-events-none transition-opacity duration-150"
        />
      </div>
    </div>
  );
}
