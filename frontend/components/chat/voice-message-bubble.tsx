'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/api/types';

interface VoiceMessageBubbleProps {
  message: Message;
}

export function VoiceMessageBubble({ message }: VoiceMessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const toggleAudio = () => {
    if (!message.audio_b64) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(`data:audio/mp3;base64,${message.audio_b64}`);
      audioRef.current.onplay = () => setIsPlaying(true);
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    
    audioRef.current.play().catch(console.error);
  };
  
  return (
    <div className={cn(
      "flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-700 group",
      isUser ? "items-end ml-auto text-right" : "items-start mr-auto text-left"
    )}>
      <div className="flex items-center gap-2 px-2">
        <span className="text-[0.55rem] font-black text-text-subtle uppercase tracking-[0.2em]">
          {isUser ? 'Você' : 'Teacher Tati'}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div className={cn(
          "px-5 py-3.5 rounded-[22px] text-[0.9rem] md:text-sm font-medium leading-relaxed shadow-xl border transition-all duration-500",
          isUser 
            ? "bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl border-primary/20 text-text rounded-tr-md hover:border-primary/40"
            : "bg-surface/90 dark:bg-[#151726]/80 backdrop-blur-2xl border-border/60 dark:border-white/10 text-text rounded-tl-md hover:border-primary/30 shadow-primary/5",
        )}>
          {message.content}
        </div>
        {!isUser && message.audio_b64 && (
          <button 
            onClick={toggleAudio}
            className={cn(
              "p-2.5 rounded-full transition-all duration-300 shadow-lg active:scale-90 shrink-0",
              isPlaying 
                ? "bg-primary text-white scale-110" 
                : "bg-surface dark:bg-white/5 text-text-subtle hover:text-primary hover:scale-110 border border-border/40"
            )}
          >
            {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
