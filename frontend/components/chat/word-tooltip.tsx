'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Volume2, Book, Sparkles, Plus, Check, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface WordTooltipProps {
  word: string | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

interface WordLookupData {
  word: string;
  lemma?: string;
  partOfSpeech?: string;
  phonetic?: string;
  translation: string;
  english_definition: string;
  portuguese_explanation?: string;
  example?: string;
  example_pt?: string;
  audio?: string;
  audio_b64?: string;
}

export default function WordTooltip({ word, position, onClose }: WordTooltipProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WordLookupData | null>(null);
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
      setData(null);
      setTatiAudio(null);

      const cleanedWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
      if (!cleanedWord) {
        setLoading(false);
        return;
      }

      try {
        // 1. Busca inteligente no backend oficial Teacher Tati (IA + Dicionário Bilíngue + Fonética)
        const res = await apiPost<WordLookupData>(ENDPOINTS.WORD_LOOKUP, { word: cleanedWord });

        if (res.ok && res.data && (res.data.translation || res.data.english_definition)) {
          setData(res.data);
          const audio = res.data.audio || res.data.audio_b64;
          if (audio) {
            setTatiAudio(audio);
          } else {
            // Busca áudio complementar se necessário
            apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: cleanedWord })
              .then(ttsRes => ttsRes.ok && setTatiAudio(ttsRes.data.audio))
              .catch(() => {});
          }
        } else {
          // Fallback secundário caso a rede externa direta falhe
          const [dictRes, ttsRes] = await Promise.all([
            fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanedWord)}`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null),
            apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: cleanedWord })
              .then(r => r.ok ? r.data.audio : null)
              .catch(() => null)
          ]);

          if (dictRes && dictRes[0]) {
            const entry = dictRes[0];
            setData({
              word: cleanedWord,
              partOfSpeech: entry.meanings?.[0]?.partOfSpeech || 'word',
              phonetic: entry.phonetics?.find((p: any) => p.text)?.text || `/${cleanedWord}/`,
              translation: cleanedWord,
              english_definition: entry.meanings?.[0]?.definitions?.[0]?.definition || `Form of ${cleanedWord}`,
              example: entry.meanings?.[0]?.definitions?.[0]?.example || '',
            });
          }
          if (ttsRes) setTatiAudio(ttsRes);
        }
      } catch (err) {
        console.error('Error fetching word data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [word]);

  const handleAddToVocab = async () => {
    if (!word || !data) return;
    setAddingToVocab(true);
    const cleanedWord = word.toLowerCase().replace(/[^a-z'-]/g, '');
    try {
      const definition = data.translation
        ? `${data.translation} — ${data.english_definition}`
        : data.english_definition || 'Word from Chat';
      const example = data.example || '';
      const res = await apiPost('/users/vocabulary/add', {
        word: data.lemma || cleanedWord,
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

  const x = Math.min(position.x + 10, typeof window !== 'undefined' ? window.innerWidth - 320 : 0);
  const y = Math.min(position.y + 10, typeof window !== 'undefined' ? window.innerHeight - 360 : 0);

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-[100] w-72 sm:w-80 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      style={{ left: Math.max(10, x), top: Math.max(10, y) }}
    >
      {/* Top Header */}
      <div className="p-3 bg-bg-secondary flex items-center justify-between border-b border-border">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-text text-base truncate">{data?.word || word}</span>
          {data?.lemma && data.lemma !== (data?.word || word).toLowerCase() && (
            <span className="text-[0.68rem] text-primary font-mono font-medium truncate">
              (base: {data.lemma})
            </span>
          )}
          <span className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest italic shrink-0">
            {data?.partOfSpeech || ''}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface rounded-md text-text-muted transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
        {/* Phonetics & Audio Pronounce */}
        <div className="flex items-center gap-2">
          <button 
            disabled={!tatiAudio}
            onClick={() => tatiAudio && playAudio(tatiAudio, 'tati', true)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[0.68rem] font-bold transition-all border shadow-sm",
              tatiAudio 
                ? "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 active:scale-95" 
                : "bg-bg-secondary border-border text-text-muted opacity-50 cursor-not-allowed"
            )}
          >
            <Volume2 size={13} className={isPlaying === 'tati' ? 'animate-pulse' : ''} />
            PRONOUNCE
          </button>
          
          {data?.phonetic && (
            <span className="text-[0.72rem] font-mono text-text-subtle font-medium">
              {data.phonetic}
            </span>
          )}
        </div>

        {/* Portuguese Translation (Tradução em Português) */}
        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-primary/5 border border-primary/15">
          <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary shrink-0">
            <Languages size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.62rem] font-black text-primary uppercase tracking-tight mb-0.5 leading-none">
              Tradução em Português
            </p>
            {loading ? (
              <div className="space-y-1 pt-1">
                <div className="h-2 bg-primary/10 rounded w-full animate-pulse" />
                <div className="h-2 bg-primary/10 rounded w-2/3 animate-pulse" />
              </div>
            ) : data?.translation ? (
              <div>
                <p className="text-[0.82rem] font-semibold text-text leading-snug">
                  {data.translation}
                </p>
                {data.portuguese_explanation && (
                  <p className="text-[0.68rem] text-text-muted mt-1 leading-tight italic">
                    💡 {data.portuguese_explanation}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[0.72rem] text-text-subtle italic">Tradução contextual em andamento...</p>
            )}
          </div>
        </div>

        {/* English Meaning (Definição em Inglês) */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
            <Sparkles size={12} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.6rem] font-black text-text-muted uppercase tracking-tighter mb-1 leading-none">
              English Meaning
            </p>
            {loading ? (
              <div className="space-y-1 pt-1">
                <div className="h-2 bg-bg-secondary rounded w-full animate-pulse" />
                <div className="h-2 bg-bg-secondary rounded w-3/4 animate-pulse" />
              </div>
            ) : data?.english_definition ? (
              <p className="text-[0.75rem] text-text leading-snug italic">
                "{data.english_definition}"
              </p>
            ) : (
              <p className="text-[0.7rem] text-text-subtle italic">Looking up English definition...</p>
            )}
          </div>
        </div>

        {/* Practical Example */}
        {!loading && data?.example && (
          <div className="flex items-start gap-2.5 pt-1.5 border-t border-border/50">
            <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/10 text-blue-500 shrink-0">
              <Book size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[0.6rem] font-black text-text-muted uppercase tracking-tighter mb-0.5">
                Example
              </p>
              <p className="text-[0.72rem] text-text leading-tight italic font-medium">
                "{data.example}"
              </p>
              {data.example_pt && (
                <p className="text-[0.66rem] text-text-subtle leading-tight mt-0.5">
                  ({data.example_pt})
                </p>
              )}
            </div>
          </div>
        )}

        {/* Add to Dictionary Button */}
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={handleAddToVocab}
            disabled={addingToVocab || isAdded || loading}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[0.72rem] font-bold transition-all border shadow-sm",
              isAdded
                ? "bg-success/10 border-success/20 text-success cursor-default"
                : addingToVocab
                  ? "bg-surface border-border text-text-muted opacity-50 cursor-wait"
                  : "bg-primary border-primary text-white hover:bg-primary/90 hover:border-primary/90 active:scale-98"
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
