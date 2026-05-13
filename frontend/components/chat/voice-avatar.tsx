'use client';

import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface AvatarFrames {
  has_frames?: boolean;
  normal?: string;
  piscando?: string;
  meio?: string;
  bem_aberta?: string;
  ouvindo?: string;
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
}

export function VoiceAvatar({ state, audioElement }: VoiceAvatarProps) {
  const { data: frames } = useQuery<AvatarFrames>({
    queryKey: ['avatar-frames'],
    queryFn: () => apiGet<AvatarFrames>('/avatar/frames'),
    staleTime: Infinity, // Frames are static
  });
  const [currentFrame, setCurrentFrame] = useState('/images/tati_logo.jpg');
  const [isBlinking, setIsBlinking] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mouthTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getFrameUrl = (path?: string) => {
    if (!path) return '/images/tati_logo.jpg';
    // Se for Base64 ou URL completa, não anexa API_BASE
    if (path.startsWith('data:') || path.startsWith('http')) return path;
    // Garante que o caminho comece com / se for relativo
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE}${cleanPath}`;
  };

  useEffect(() => {
    if (frames?.has_frames && frames.normal) {
      setCurrentFrame(getFrameUrl(frames.normal));
    }
  }, [frames]);

  useEffect(() => {
    if (state !== 'idle') return;
    
    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 2000;
      return setTimeout(() => {
        if (frames?.piscando) setCurrentFrame(getFrameUrl(frames.piscando));
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          if (frames?.normal) setCurrentFrame(getFrameUrl(frames.normal));
          blinkTimer = scheduleBlink();
        }, 150);
      }, delay);
    };

    let blinkTimer = scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, [state, frames]);

  useEffect(() => {
    if (state === 'speaking' && audioElement && frames?.has_frames) {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
        const source = ctx.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        
        mouthTimerRef.current = setInterval(() => {
          analyser.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < freqData.length; i++) sum += freqData[i];
          const avgVolume = sum / freqData.length;

          if (avgVolume < 10) {
            setCurrentFrame(getFrameUrl(frames.normal));
          } else {
            // Animação baseada no volume usando os frames A-F
            const framesList = [frames.frame_A, frames.frame_B, frames.frame_C, frames.frame_D, frames.frame_E, frames.frame_F].filter(Boolean);
            if (framesList.length > 0) {
              const index = Math.floor((avgVolume / 100) * framesList.length);
              setCurrentFrame(getFrameUrl(framesList[Math.min(index, framesList.length - 1)]));
            } else {
              setCurrentFrame(getFrameUrl(frames.bem_aberta || frames.normal));
            }
          }
        }, 60);
      } catch (e) {
        let toggle = false;
        mouthTimerRef.current = setInterval(() => {
           toggle = !toggle;
           setCurrentFrame(getFrameUrl(toggle ? frames.meio : frames.normal));
        }, 200);
      }
    } else if (state === 'listening' && frames?.ouvindo) {
      setCurrentFrame(getFrameUrl(frames.ouvindo));
    } else if (frames?.normal) {
      setCurrentFrame(getFrameUrl(frames.normal));
    }

    return () => {
      if (mouthTimerRef.current) clearInterval(mouthTimerRef.current);
    };
  }, [state, audioElement, frames]);

  return (
    <div className={cn(
      "relative w-[140px] h-[140px] md:w-[220px] md:h-[220px] lg:w-[230px] lg:h-[290px] shrink-0 transition-all duration-1000 ease-in-out",
      state === 'listening' && "listening",
      state === 'processing' && "processing",
      state === 'speaking' && "speaking"
    )}>
      {/* Immersive Deep Glow */}
      <div className={cn(
        "absolute inset-[-40px] rounded-full blur-[60px] transition-all duration-1000 opacity-0 z-0",
        state === 'listening' && "opacity-30 bg-success",
        state === 'speaking' && "opacity-30 bg-primary",
        state === 'processing' && "opacity-30 bg-warning"
      )} />

      {/* Dynamic Interactive Rings */}
      <div className={cn(
        "absolute inset-[-15px] rounded-full border-[3px] border-primary/20 z-0",
        state === 'idle' && "animate-[ring-idle_4s_ease-in-out_infinite]",
        state === 'listening' && "border-success/60 animate-[ring-listen_1.2s_ease-in-out_infinite]",
        state === 'processing' && "border-warning/40 animate-[ring-process_1.8s_ease-in-out_infinite]",
        state === 'speaking' && "border-primary/80 animate-[ring-speak_0.7s_ease-in-out_infinite]"
      )} />
      
      <div className={cn(
        "absolute inset-[-30px] rounded-full border-[2px] border-primary/10 z-0",
        state === 'idle' && "animate-[ring-idle_4s_ease-in-out_infinite_1s]",
        state === 'listening' && "border-success/30 animate-[ring-listen_1.2s_ease-in-out_infinite_0.4s]",
        state === 'processing' && "border-warning/15 animate-[ring-process_1.8s_ease-in-out_infinite_0.6s]",
        state === 'speaking' && "border-primary/40 animate-[ring-speak_0.7s_ease-in-out_infinite_0.25s]"
      )} />

      <div className="w-full h-full rounded-full border-[6px] border-primary shadow-[0_0_60px_rgba(124,58,237,0.3)] overflow-hidden bg-bg-secondary relative z-10 transition-transform duration-500 hover:scale-105">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          key={currentFrame}
          src={currentFrame} 
          alt="Teacher Tati" 
          className="w-full h-full object-cover transition-opacity duration-200" 
        />
      </div>

      <style jsx global>{`
        @keyframes ring-idle { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.02); } }
        @keyframes ring-listen { 0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6); } 70% { box-shadow: 0 0 0 12px rgba(52, 211, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }
        @keyframes ring-process { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }
        @keyframes ring-speak { 0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.6); } 70% { box-shadow: 0 0 0 14px rgba(124, 58, 237, 0); } 100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); } }
      `}</style>
    </div>
  );
}
