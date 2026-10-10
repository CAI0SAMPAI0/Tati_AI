'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Copy, Check } from 'lucide-react';
import type { Message } from '@/lib/api/types';
import { cn, parseAIResponse } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ClickableText } from './clickable-text';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface VoiceMessageBubbleProps {
  message: Message;
  onWordClick?: (word: string, x: number, y: number) => void;
  isSpeaking?: boolean;
  isProcessing?: boolean;
}

export function VoiceMessageBubble({
  message,
  onWordClick,
  isSpeaking,
  isProcessing,
}: VoiceMessageBubbleProps) {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayingCorrection, setIsPlayingCorrection] = useState(false);
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const correctionAudioRef = useRef<HTMLAudioElement | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = parseAIResponse(message.content);
  const displayReply = parsed.reply || message.content;

  const handleCopy = () => {
    const textToCopy = isUser ? message.content : parsed.reply;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (correctionAudioRef.current) {
        correctionAudioRef.current.pause();
        correctionAudioRef.current = null;
      }
    };
  }, []);

  // Sincroniza o áudio se ele mudar (durante o stream ou após carregar)
  useEffect(() => {
    if (message.audio_b64) {
      const newSrc = `data:audio/mp3;base64,${message.audio_b64}`;
      if (!audioRef.current) {
        audioRef.current = new Audio(newSrc);
        audioRef.current.onplay = () => setIsPlaying(true);
        audioRef.current.onpause = () => setIsPlaying(false);
        audioRef.current.onended = () => setIsPlaying(false);
      } else if (audioRef.current.src !== newSrc) {
        audioRef.current.src = newSrc;
      }
    }
  }, [message.audio_b64]);

  const toggleAudio = () => {
    if (!message.audio_b64) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(`data:audio/mp3;base64,${message.audio_b64}`);
      audioRef.current.onplay = () => setIsPlaying(true);
      audioRef.current.onpause = () => setIsPlaying(false);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (audioRef.current.ended || audioRef.current.currentTime > 0) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch(console.error);
    }
  };

  const handlePlayCorrection = async (textToPlay: string) => {
    if (isPlayingCorrection && correctionAudioRef.current) {
      correctionAudioRef.current.pause();
      setIsPlayingCorrection(false);
      return;
    }

    if (correctionAudioRef.current) {
      correctionAudioRef.current.currentTime = 0;
      correctionAudioRef.current.play().catch(console.error);
      return;
    }

    setIsLoadingCorrection(true);
    try {
      const res = await apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: textToPlay });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        correctionAudioRef.current = audio;
        audio.onplay = () => setIsPlayingCorrection(true);
        audio.onpause = () => setIsPlayingCorrection(false);
        audio.onended = () => setIsPlayingCorrection(false);
        audio.play().catch(console.error);
      }
    } catch (err) {
      console.error('Error playing correction audio:', err);
    } finally {
      setIsLoadingCorrection(false);
    }
  };

  const isTranscribing = isUser && (
    message.content?.includes('Transcribing') ||
    message.id.startsWith('live-temp-') ||
    message.id.startsWith('voice-temp-')
  );

  return (
    <div className={cn(
      "flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-700 group",
      isUser ? "items-end ml-auto text-right" : "items-start mr-auto text-left"
    )}>
      <div className="flex items-center gap-2 px-2">
        <span className="text-[0.55rem] font-black text-text-subtle uppercase tracking-[0.2em]">
          {isUser ? 'You' : 'Teacher Tati'}
        </span>
      </div>
      <div className="flex items-end gap-2 relative">
        {isUser && !isTranscribing && message.audio_b64 && (
          <button
            onClick={toggleAudio}
            className="p-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-300 shadow-md flex items-center justify-center shrink-0 active:scale-90"
            title="Listen to your voice"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
        )}
        {isUser && !isTranscribing && (
          <button
            onClick={handleCopy}
            className="p-2 rounded-full border border-border bg-surface text-text-subtle hover:text-primary transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center shrink-0"
            title="Copy message"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        )}
        <div className={cn(
          "px-5 py-3.5 rounded-[22px] text-[0.9rem] md:text-sm font-medium leading-relaxed shadow-xl border transition-all duration-500",
          isUser
            ? "bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl border-primary/20 text-text rounded-tr-md hover:border-primary/40"
            : "bg-surface/90 dark:bg-[#151726]/80 backdrop-blur-2xl border-border/60 dark:border-white/10 text-text rounded-tl-md hover:border-primary/30 shadow-primary/5",
        )}>
          {isUser ? (
            isTranscribing ? (
              <div className="flex items-center gap-2 text-primary font-medium text-xs sm:text-sm py-0.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="italic">Transcribing audio...</span>
              </div>
            ) : (
              message.content
            )
          ) : (isProcessing && !displayReply) ? (
            <div className="flex items-center gap-2 py-1 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              </div>
              <span className="text-xs text-text-subtle font-medium italic">Teacher Tati is preparing your answer...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="inline">
                <ClickableText
                  content={displayReply}
                  onWordClick={onWordClick || (() => { })}
                />
              </div>
              {parsed.correction && (
                <div className="mt-2 text-xs bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl p-3 flex flex-col gap-2 max-w-full text-left">
                  <div className="flex items-start gap-2">
                    <span className="text-base select-none">💡</span>
                    <div className="flex-1">
                      <span className="font-bold text-amber-800 dark:text-amber-200">Teacher Tati noticed: </span>
                      <span className="italic">{parsed.correction}</span>
                    </div>
                  </div>
                  <div className="pt-1.5 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePlayCorrection(parsed.correction || '')}
                      disabled={isLoadingCorrection}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[0.7rem] font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                    >
                      <Volume2 size={12} className={isPlayingCorrection ? "animate-pulse text-amber-600" : ""} />
                      <span>
                        {isLoadingCorrection
                          ? "Carregando áudio..."
                          : isPlayingCorrection
                            ? "Pausar pronúncia da Tati"
                            : "Ouvir pronúncia da Teacher Tati"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {!isUser && !isProcessing && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              disabled={!message.audio_b64}
              className={cn(
                "p-2.5 rounded-full transition-all duration-300 shadow-lg active:scale-90 shrink-0",
                !message.audio_b64 && "opacity-30 cursor-not-allowed grayscale",
                isPlaying
                  ? "bg-primary text-white scale-110"
                  : "bg-surface dark:bg-white/5 text-text-subtle hover:text-primary hover:scale-110 border border-border/40"
              )}
            >
              {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} />}
            </button>
            <button
              onClick={handleCopy}
              className="p-2.5 rounded-full border border-border bg-surface text-text-subtle hover:text-primary transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg flex items-center justify-center shrink-0"
              title="Copy message"
            >
              {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
