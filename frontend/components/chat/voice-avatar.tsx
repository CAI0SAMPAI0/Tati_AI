'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '@/lib/api/client';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvatarFrames {
  has_frames?: boolean;
  normal?: string;
  meio?: string;
  aberta?: string;
  bem_aberta?: string;
  frame_A?: string;
  frame_B?: string;
  frame_C?: string;
  frame_D?: string;
  frame_E?: string;
  frame_F?: string;
  ouvindo?: string;
  piscando?: string;
}

type MouthLevel = 0 | 1 | 2;

interface VoiceAvatarProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioElement?: HTMLAudioElement | null;
  lastAssistantText?: string;
}

// ─── Emotion detection ───────────────────────────────────────────────────────

const SURPRISE_RE = /!|uau|wow|incrível|incredible|que\b.{0,20}!/i;
const POSITIVE_RE = /parabéns|congratulations|perfeito|perfect|excelente|excellent|maravilhoso|wonderful|fantástico|fantastic|ótimo|great|brilliant|😊|😄|😃|🎉|👏/i;

function detectEmotion(text: string): 'surprise' | 'positive' | 'neutral' {
  if (!text) return 'neutral';
  if (SURPRISE_RE.test(text)) return 'surprise';
  if (POSITIVE_RE.test(text)) return 'positive';
  return 'neutral';
}

// ─── Amplitude smoothing (ring buffer) ───────────────────────────────────────

class AmplitudeSmoother {
  private buf: Float32Array;
  private ptr = 0;
  constructor(private size: number) {
    this.buf = new Float32Array(size);
  }
  push(v: number): number {
    this.buf[this.ptr] = v;
    this.ptr = (this.ptr + 1) % this.size;
    let s = 0;
    for (let i = 0; i < this.size; i++) s += this.buf[i];
    return s / this.size;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const INITIAL_SRC = '/images/tati_logo.jpg';
const MIN_HOLD_MS = 90;

export function VoiceAvatar({ state, audioElement, lastAssistantText }: VoiceAvatarProps) {
  const { data: frames } = useQuery<AvatarFrames>({
    queryKey: ['avatar-frames'],
    queryFn: () => apiGet<AvatarFrames>('/avatar/frames'),
    staleTime: Infinity,
  });

  // ── Rendering state ────────────────────────────────────────────────────────
  // mouthSrc / mouthKey: changing key re-triggers fade-in CSS animation
  const [mouthSrc, setMouthSrc] = useState(INITIAL_SRC);
  const [mouthKey, setMouthKey] = useState(0);
  const [reactionSrc, setReactionSrc] = useState<string | null>(null);
  const [blinkVisible, setBlinkVisible] = useState(false);

  // ── Refs (never cause stale closures) ─────────────────────────────────────
  const framesRef = useRef<AvatarFrames | undefined>(undefined);
  const currentMouthRef = useRef(INITIAL_SRC);   // source-of-truth for current mouth
  const mouthLevelRef = useRef<MouthLevel>(0);
  const lastChangeRef = useRef(0);
  const pendingRef = useRef<string | null>(null);
  const emotionRef = useRef<'surprise' | 'positive' | 'neutral'>('neutral');
  const lastTextRef = useRef<string | undefined>(undefined);

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const smootherRef = useRef(new AmplitudeSmoother(3)); // ~90ms at 30ms interval

  // Timer refs
  const mouthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep framesRef in sync
  useEffect(() => { framesRef.current = frames; }, [frames]);

  // ── Helpers (STABLE — empty deps, use only refs) ───────────────────────────

  const getUrl = useCallback((path?: string): string => {
    if (!path) return INITIAL_SRC;
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    return `${API_BASE}${path.startsWith('/') ? path : '/' + path}`;
  }, []);

  /**
   * changeMouth is STABLE (empty deps).
   * Reads framesRef/currentMouthRef instead of state → no stale closure.
   * Uses CSS animation for fade-in instead of manual opacity → no white screen.
   */
  const changeMouth = useCallback((newUrl: string) => {
    const now = Date.now();
    if (now - lastChangeRef.current < MIN_HOLD_MS) {
      // Schedule retry after hold expires
      pendingRef.current = newUrl;
      if (!holdTimerRef.current) {
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          const pending = pendingRef.current;
          pendingRef.current = null;
          if (pending) changeMouth(pending);
        }, MIN_HOLD_MS - (now - lastChangeRef.current) + 5);
      }
      return;
    }
    if (newUrl === currentMouthRef.current) return;

    currentMouthRef.current = newUrl;
    lastChangeRef.current = Date.now();

    // Update render state — CSS animation on key change handles fade-in
    setMouthSrc(newUrl);
    setMouthKey(k => k + 1);
  }, []); // ← stable, zero deps

  const frameForLevel = useCallback((level: MouthLevel, emotion: 'surprise' | 'positive' | 'neutral'): string => {
    const f = framesRef.current;
    if (!f) return INITIAL_SRC;
    if (level === 0) return getUrl(f.normal);
    if (level === 1) return getUrl(f.meio ?? f.frame_A ?? f.normal);
    // level 2 — only use wide-smile frames when text is actually positive
    if (emotion === 'positive') return getUrl(f.bem_aberta ?? f.aberta ?? f.meio ?? f.normal);
    return getUrl(f.meio ?? f.frame_A ?? f.normal);
  }, [getUrl]); // framesRef is a ref, not a dep

  const nextLevel = useCallback((smoothed: number, cur: MouthLevel): MouthLevel => {
    const target: MouthLevel = smoothed < 12 ? 0 : smoothed < 50 ? 1 : 2;
    if (target > cur) return (cur + 1) as MouthLevel;
    if (target < cur) return (cur - 1) as MouthLevel;
    return cur;
  }, []);

  // ── Initial frame ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (frames?.has_frames && frames.normal) {
      const url = getUrl(frames.normal);
      currentMouthRef.current = url;
      setMouthSrc(url);
    }
  }, [frames, getUrl]);

  // ── Emotion detection ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!lastAssistantText || lastAssistantText === lastTextRef.current) return;
    lastTextRef.current = lastAssistantText;

    const emotion = detectEmotion(lastAssistantText);
    emotionRef.current = emotion;

    const f = framesRef.current;
    if (emotion === 'surprise' && f?.has_frames) {
      const pool = [f.frame_B, f.frame_C, f.frame_D].filter(Boolean) as string[];
      if (pool.length === 0) return;
      const chosen = getUrl(pool[Math.floor(Math.random() * pool.length)]);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      setReactionSrc(chosen);
      reactionTimerRef.current = setTimeout(() => setReactionSrc(null), 450);
    }
  }, [lastAssistantText, getUrl]);

  // ── Blink: independent timer, overlay layer ────────────────────────────────

  useEffect(() => {
    const scheduleBlink = (): ReturnType<typeof setTimeout> => {
      const delay = 3000 + Math.random() * 3000;
      return setTimeout(() => {
        if (!framesRef.current?.piscando) {
          blinkTimerRef.current = scheduleBlink();
          return;
        }
        setBlinkVisible(true);
        blinkTimerRef.current = setTimeout(() => {
          setBlinkVisible(false);
          blinkTimerRef.current = scheduleBlink();
        }, 150);
      }, delay);
    };

    blinkTimerRef.current = scheduleBlink();
    return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
  }, []); // runs once — reads framesRef internally

  // ── Mouth animation ────────────────────────────────────────────────────────

  useEffect(() => {
    if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);

    if (state === 'listening') {
      const url = getUrl(framesRef.current?.ouvindo ?? framesRef.current?.normal);
      changeMouth(url);
      mouthLevelRef.current = 0;
      return;
    }

    if (state !== 'speaking' || !audioElement || !framesRef.current?.has_frames) {
      const url = getUrl(framesRef.current?.normal);
      changeMouth(url);
      mouthLevelRef.current = 0;
      return;
    }

    // ── Web Audio setup ──────────────────────────────────────────────────────
    let usingAudio = false;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // MediaElementSource can only be created once per element — reuse
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audioElement);
      }
      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        sourceRef.current.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      }

      smootherRef.current = new AmplitudeSmoother(3);
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
      usingAudio = true;

      mouthIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        const smoothed = smootherRef.current.push(sum / freqData.length);

        const level = nextLevel(smoothed, mouthLevelRef.current);
        mouthLevelRef.current = level;
        changeMouth(frameForLevel(level, emotionRef.current));
      }, 30);

    } catch (_e) {
      // ignore — fall through to CSS fallback
    }

    // Fallback: no Web Audio — simple toggle
    if (!usingAudio) {
      let toggle = false;
      mouthIntervalRef.current = setInterval(() => {
        toggle = !toggle;
        const f = framesRef.current;
        changeMouth(getUrl(toggle ? f?.meio ?? f?.normal : f?.normal));
      }, 200);
    }

    return () => {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
    };
    // changeMouth, frameForLevel, nextLevel, getUrl are all stable (empty deps)
  }, [state, audioElement, changeMouth, frameForLevel, nextLevel, getUrl]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const blinkUrl = framesRef.current?.piscando ? getUrl(framesRef.current.piscando) : null;

  return (
    <div className={cn(
      'relative w-[140px] h-[140px] md:w-[220px] md:h-[220px] lg:w-[230px] lg:h-[290px] shrink-0 transition-all duration-1000 ease-in-out',
      state === 'listening' && 'listening',
      state === 'processing' && 'processing',
      state === 'speaking' && 'speaking',
    )}>
      {/* Glow */}
      <div className={cn(
        'absolute inset-[-40px] rounded-full blur-[60px] transition-all duration-1000 opacity-0 z-0',
        state === 'listening' && 'opacity-30 bg-success',
        state === 'speaking' && 'opacity-30 bg-primary',
        state === 'processing' && 'opacity-30 bg-warning',
      )} />

      {/* Rings */}
      <div className={cn(
        'absolute inset-[-15px] rounded-full border-[3px] border-primary/20 z-0',
        state === 'idle' && 'animate-[ring-idle_4s_ease-in-out_infinite]',
        state === 'listening' && 'border-success/60 animate-[ring-listen_1.2s_ease-in-out_infinite]',
        state === 'processing' && 'border-warning/40 animate-[ring-process_1.8s_ease-in-out_infinite]',
        state === 'speaking' && 'border-primary/80 animate-[ring-speak_0.7s_ease-in-out_infinite]',
      )} />
      <div className={cn(
        'absolute inset-[-30px] rounded-full border-[2px] border-primary/10 z-0',
        state === 'idle' && 'animate-[ring-idle_4s_ease-in-out_infinite_1s]',
        state === 'listening' && 'border-success/30 animate-[ring-listen_1.2s_ease-in-out_infinite_0.4s]',
        state === 'processing' && 'border-warning/15 animate-[ring-process_1.8s_ease-in-out_infinite_0.6s]',
        state === 'speaking' && 'border-primary/40 animate-[ring-speak_0.7s_ease-in-out_infinite_0.25s]',
      )} />

      <div className="w-full h-full rounded-full border-[6px] border-primary shadow-[0_0_60px_rgba(124,58,237,0.3)] overflow-hidden bg-bg-secondary relative z-10 transition-transform duration-500 hover:scale-105">

        {/* Layer 1 — Boca (visema atual) */}
        {/* Changing `key` restarts the CSS fade-in animation — no opacity stuck at 0 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={mouthKey}
          src={mouthSrc}
          alt="Teacher Tati"
          className="absolute inset-0 w-full h-full object-cover avatar-mouth"
        />

        {/* Layer 2 — Reação emocional (surprise/choque) */}
        {reactionSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reactionSrc}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover avatar-reaction"
          />
        )}

        {/* Layer 3 — Piscar (overlay independente) */}
        {blinkVisible && blinkUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blinkUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes ring-idle    { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.8;transform:scale(1.02)} }
        @keyframes ring-listen  { 0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)} 70%{box-shadow:0 0 0 12px rgba(52,211,153,0)} 100%{box-shadow:0 0 0 0 rgba(52,211,153,0)} }
        @keyframes ring-process { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.03)} }
        @keyframes ring-speak   { 0%{box-shadow:0 0 0 0 rgba(124,58,237,.6)} 70%{box-shadow:0 0 0 14px rgba(124,58,237,0)} 100%{box-shadow:0 0 0 0 rgba(124,58,237,0)} }
        @keyframes mouthFadeIn  { from{opacity:.65} to{opacity:1} }
        @keyframes reactionFade { 0%{opacity:0} 15%{opacity:1} 80%{opacity:1} 100%{opacity:0} }
        .avatar-mouth    { animation: mouthFadeIn 80ms ease-out forwards; }
        .avatar-reaction { animation: reactionFade 450ms ease-in-out forwards; }
      `}</style>
    </div>
  );
}
