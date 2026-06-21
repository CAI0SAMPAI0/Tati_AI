'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Volume2, Book, Sparkles, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface WordTooltipProps {
  word: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

interface DictData {
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
  phonetics: { text?: string; audio?: string }[];
}

export default function WordTooltip({ word, position, onClose }: WordTooltipProps) {
  const [loading, setLoading] = useState(true);
  const [dict, setDict] = useState<DictData | null>(null);
  const [tatiAudio, setTatiAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [addingToVocab, setAddingToVocab] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsAdded(false);
    setAddingToVocab(false);
    if (!word) return;

    const fetchData = async () => {
      setLoading(true);
      setDict(null);
      setTatiAudio(null);

      const cleanedWord = word.toLowerCase().replace(/[^a-z'-]/g, '');

      try {
        const [dictRes, ttsRes] = await Promise.all([
          fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanedWord)}`).then(r => r.ok ? r.json() : null),
          apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: cleanedWord }).then(r => r.ok ? r.data.audio : null)
        ]);

        if (dictRes && dictRes[0]) setDict(dictRes[0]);
        setTatiAudio(ttsRes);
      } catch (err) {
        console.error('Error fetching word data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [word]);

  const handleAddToVocab = async () => {
    if (!word) return;
    setAddingToVocab(true);
    const cleanedWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
    try {
      const definition = dict?.meanings[0]?.definitions[0]?.definition || "Word from Chat";
      const example = dict?.meanings[0]?.definitions[0]?.example || "";
      const res = await apiPost('/users/vocabulary/add', {
        word: cleanedWord,
        definition,
        example
      });
      if (res.ok) {
        setIsAdded(true);
      }
    } catch (err) {
      console.error('Error adding word to vocabulary:', err);
    } finally {
      setAddingToVocab(false);
    }
  };

  const playAudio = (src: string, id: string, isBase64 = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const url = isBase64 ? `data:audio/mp3;base64,${src}` : src;
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsPlaying(id);
    audio.onended = () => setIsPlaying(null);
    audio.play().catch(() => setIsPlaying(null));
  };

  if (!word || !position) return null;

  const x = Math.min(position.x + 10, typeof window !== 'undefined' ? window.innerWidth - 280 : 0);
  const y = Math.min(position.y + 10, typeof window !== 'undefined' ? window.innerHeight - 300 : 0);

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-[100] w-64 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      style={{ left: x, top: y }}
    >
      <div className="p-3 bg-bg-secondary flex items-center justify-between border-b border-border">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-text truncate max-w-[140px]">{word}</span>
          <span className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest italic">
            {dict?.meanings[0]?.partOfSpeech || ''}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface rounded-md text-text-muted transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Phonetics & Audio */}
        <div className="flex items-center gap-2">
          <button 
            disabled={!tatiAudio}
            onClick={() => tatiAudio && playAudio(tatiAudio, 'tati', true)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.65rem] font-bold transition-all border",
              tatiAudio 
                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20" 
                : "bg-bg-secondary border-border text-text-muted opacity-50 cursor-not-allowed"
            )}
          >
            <Volume2 size={12} className={isPlaying === 'tati' ? 'animate-pulse' : ''} />
            PRONOUNCE
          </button>
          
          {dict?.phonetics.find(p => p.audio) && (
            <button 
              onClick={() => {
                const p = dict.phonetics.find(p => p.audio);
                if (p?.audio) playAudio(p.audio, 'dict');
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[0.65rem] font-bold bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted transition-all"
            >
              <Volume2 size={12} className={isPlaying === 'dict' ? 'animate-pulse' : ''} />
              DICT
            </button>
          )}

          <span className="text-[0.7rem] font-mono text-text-subtle">
            {dict?.phonetics.find(p => p.text)?.text}
          </span>
        </div>

        {/* Definition (EN ONLY) */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary">
            <Sparkles size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] font-black text-text-muted uppercase tracking-tighter mb-1 leading-none">English Meaning</p>
            {loading ? (
              <div className="space-y-1 pt-1">
                <div className="h-2 bg-bg-secondary rounded w-full animate-pulse" />
                <div className="h-2 bg-bg-secondary rounded w-3/4 animate-pulse" />
              </div>
            ) : dict?.meanings[0]?.definitions[0] ? (
              <p className="text-[0.75rem] text-text leading-snug italic">
                "{dict.meanings[0].definitions[0].definition}"
              </p>
            ) : (
              <p className="text-[0.7rem] text-text-subtle italic">No English definition found.</p>
            )}
          </div>
        </div>

        {/* Additional Examples if available */}
        {!loading && dict?.meanings[0]?.definitions[0].example && (
           <div className="flex items-start gap-2.5 pt-1 border-t border-border/50">
             <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/10 text-blue-500">
               <Book size={12} />
             </div>
             <div>
               <p className="text-[0.6rem] font-black text-text-muted uppercase tracking-tighter mb-0.5">Example</p>
               <p className="text-[0.7rem] text-text-subtle leading-tight italic">
                 "{dict.meanings[0].definitions[0].example}"
               </p>
             </div>
           </div>
        )}
        {/* Add to Dictionary Button */}
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={handleAddToVocab}
            disabled={addingToVocab || isAdded}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[0.7rem] font-bold transition-all border",
              isAdded
                ? "bg-success/10 border-success/20 text-success cursor-default"
                : addingToVocab
                  ? "bg-surface border-border text-text-muted opacity-50 cursor-wait"
                  : "bg-primary border-primary text-white hover:bg-primary/90 hover:border-primary/90"
            )}
          >
            {isAdded ? (
              <>
                <Check size={12} />
                ADDED TO DICTIONARY
              </>
            ) : addingToVocab ? (
              "ADDING..."
            ) : (
              <>
                <Plus size={12} />
                ADD TO DICTIONARY
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
