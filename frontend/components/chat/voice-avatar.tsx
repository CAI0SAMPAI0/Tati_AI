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

// ── Frames locais estáticos (0ms de latência, sem base64 pesado) ─────

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
        const delay = 3200 + Math.random() * 2000;
        blinkTimer = setTimeout(() => {
          if (stateRef.current !== 'idle') return;
          setCurrentFrame(FRAMES.piscando);
          blinkTimer = setTimeout(() => {
            if (stateRef.current !== 'idle') return;
            setCurrentFrame(FRAMES.normal);
            scheduleBlink();
          }, 150);
        }, delay);
      };

      scheduleBlink();
      return stopTimers;
    }

    // ── 2. ESTADO: listening (Quando o usuário está falando → frame ouvindo) ──
    if (state === 'listening') {
      setCurrentFrame(FRAMES.ouvindo);
      return stopTimers;
    }

    // ── 3. ESTADO: processing (Pensando / aguardando resposta com piscar lento) ──
    if (state === 'processing') {
      setCurrentFrame(FRAMES.normal);
      let isBlink = false;
      blinkTimer = setInterval(() => {
        if (stateRef.current !== 'processing') return;
        isBlink = !isBlink;
        setCurrentFrame(isBlink ? FRAMES.piscando : FRAMES.normal);
      }, 2200) as any;
      return stopTimers;
    }

    // ── 4. ESTADO: speaking (Tatiana falando → abrindo e fechando a boca) ──
    if (state === 'speaking') {
      // Ciclo contínuo de abrir e fechar a boca: normal -> meio -> bem_aberta -> meio
      const mouthCycle = [FRAMES.normal, FRAMES.meio, FRAMES.bem_aberta, FRAMES.meio];
      let cycleIdx = 0;

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
              analyser.smoothingTimeConstant = 0.15;
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
              const avg = sum / freqData.length;

              // Se a Web Audio API detectar energia real de volume
              if (avg >= 12) {
                if (avg < 20) {
                  setCurrentFrame(FRAMES.normal);
                } else if (avg < 50) {
                  setCurrentFrame(FRAMES.meio);
                } else {
                  setCurrentFrame(FRAMES.bem_aberta);
                }
              } else {
                // Fallback de cadência quando o volume retornado for 0 (áudio em data-URI ou CORS)
                // Abre e fecha a boca dinamicamente enquanto o áudio estiver tocando!
                cycleIdx = (cycleIdx + 1) % mouthCycle.length;
                setCurrentFrame(mouthCycle[cycleIdx]);
              }
            }, 80);
          }
        } catch {
          usingWebAudio = false;
        }
      }

      // Fallback sem Web Audio: abre e fecha a boca a cada 100ms
      if (!usingWebAudio) {
        mouthInterval = setInterval(() => {
          if (stateRef.current !== 'speaking') return;
          cycleIdx = (cycleIdx + 1) % mouthCycle.length;
          setCurrentFrame(mouthCycle[cycleIdx]);
        }, 100);
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
          key={currentFrame}
          src={currentFrame}
          alt="Teacher Tatiana"
          className="w-full h-full object-cover object-top select-none pointer-events-none"
        />
      </div>
    </div>
  );
}
