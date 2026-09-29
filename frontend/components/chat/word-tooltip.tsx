'use client';

import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { Languages, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState, useLayoutEffect } from 'react';

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
  english_definition?: string;
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
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 16, top: 16 });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isSentence = Boolean(word && (word.includes(' ') || word.length > 30));

  // 1. Reposicionamento inteligente para nunca cortar na tela (qualquer resolução / orientação)
  const updatePosition = () => {
    if (!position || typeof window === 'undefined') return;

    const tooltipEl = tooltipRef.current;
    const width = tooltipEl?.offsetWidth || 320;
    const height = tooltipEl?.offsetHeight || 160;
    const padding = 12;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Posição inicial desejada: logo abaixo e à direita do clique
    let left = position.x + 8;
    let top = position.y + 8;

    // Se ultrapassar a borda direita, posiciona à esquerda ou ajusta
    if (left + width > viewportWidth - padding) {
      left = position.x - width - 8;
      if (left < padding) {
        left = Math.max(padding, viewportWidth - width - padding);
      }
    }

    // Se ultrapassar a borda inferior, posiciona acima do clique
    if (top + height > viewportHeight - padding) {
      top = position.y - height - 8;
      if (top < padding) {
        top = Math.max(padding, viewportHeight - height - padding);
      }
    }

    // Garante que não ultrapasse nenhuma das bordas da viewport
    left = Math.max(padding, Math.min(left, viewportWidth - width - padding));
    top = Math.max(padding, Math.min(top, viewportHeight - height - padding));

    setCoords({ left, top });
  };

  useLayoutEffect(() => {
    updatePosition();
  }, [position, data, loading]);

  useEffect(() => {
    updatePosition();
    const timer = setTimeout(updatePosition, 50);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [position, data]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [onClose]);

  // 2. Busca dos dados e áudio
  useEffect(() => {
    if (!word) return;

    const fetchData = async () => {
      setLoading(true);
      setData(null);
      setTatiAudio(null);

      const cleanedWord = isSentence ? word.trim() : word.toLowerCase().replace(/[^a-z'-]/g, '');
      if (!cleanedWord) {
        setLoading(false);
        return;
      }

      try {
        // Busca no backend oficial Tati's Hub (Groq / Gemini / Google Translate com áudio Teacher Tati)
        const res = await apiPost<WordLookupData>(ENDPOINTS.WORD_LOOKUP, { word: cleanedWord });

        if (res.ok && res.data && res.data.translation) {
          setData(res.data);
          const audio = res.data.audio || res.data.audio_b64;
          if (audio) {
            setTatiAudio(audio);
          } else {
            apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: cleanedWord })
              .then((ttsRes) => ttsRes.ok && setTatiAudio(ttsRes.data.audio))
              .catch(() => {});
          }
        } else {
          // Fallback seguro em caso de falha de conexão
          let fallbackTranslation = cleanedWord;
          try {
            const gtRes = await fetch(
              `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(cleanedWord)}`
            );
            if (gtRes.ok) {
              const gtData = await gtRes.json();
              if (gtData && gtData[0]) {
                fallbackTranslation = gtData[0].map((p: any) => p[0]).join('') || cleanedWord;
              }
            }
          } catch (_) {}

          setData({
            word: cleanedWord,
            partOfSpeech: isSentence ? 'sentence' : 'word',
            phonetic: isSentence ? '' : `/${cleanedWord}/`,
            translation: fallbackTranslation,
          });

          apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text: cleanedWord })
            .then((ttsRes) => ttsRes.ok && setTatiAudio(ttsRes.data.audio))
            .catch(() => {});
        }
      } catch (err) {
        console.error('Error fetching word translation:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [word, isSentence]);

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

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] w-[calc(100vw-24px)] max-w-[340px] sm:max-w-[380px] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 pointer-events-auto"
      style={{ left: coords.left, top: coords.top }}
    >
      {/* Top Header */}
      <div className="p-3 bg-bg-secondary flex items-center justify-between border-b border-border">
        <div className="flex items-baseline gap-2 min-w-0 pr-2">
          <span
            className="font-bold text-text text-sm sm:text-base leading-snug line-clamp-2 select-text"
            title={data?.word || word}
          >
            {data?.word || word}
          </span>
          {data?.lemma && data.lemma !== (data?.word || word).toLowerCase() && !isSentence && (
            <span className="text-[0.68rem] text-primary font-mono font-medium truncate shrink-0">
              (base: {data.lemma})
            </span>
          )}
          <span className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest italic shrink-0">
            {data?.partOfSpeech || (isSentence ? 'sentence' : '')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface rounded-md text-text-muted transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
        {/* Pronunciation & Audio */}
        <div className="flex items-center gap-2">
          <button
            disabled={!tatiAudio}
            onClick={() => tatiAudio && playAudio(tatiAudio, 'tati', true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.72rem] font-bold transition-all border shadow-sm',
              tatiAudio
                ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 active:scale-95'
                : 'bg-bg-secondary border-border text-text-muted opacity-50 cursor-not-allowed'
            )}
          >
            <Volume2 size={14} className={isPlaying === 'tati' ? 'animate-pulse' : ''} />
            PRONOUNCE
          </button>

          {data?.phonetic && !isSentence && (
            <span className="text-[0.75rem] font-mono text-text-subtle font-medium truncate">
              {data.phonetic}
            </span>
          )}
        </div>

        {/* Portuguese Translation (Tradução em Português) */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary shrink-0">
            <Languages size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.65rem] font-black text-primary uppercase tracking-tight mb-1 leading-none">
              Tradução em Português
            </p>
            {loading ? (
              <div className="space-y-1.5 pt-1">
                <div className="h-2.5 bg-primary/10 rounded w-full animate-pulse" />
                <div className="h-2.5 bg-primary/10 rounded w-3/4 animate-pulse" />
              </div>
            ) : data?.translation ? (
              <div>
                <p className="text-[0.88rem] sm:text-[0.92rem] font-semibold text-text leading-snug select-text">
                  {data.translation}
                </p>
                {data.portuguese_explanation && (
                  <p className="text-[0.72rem] text-text-muted mt-1.5 leading-relaxed italic">
                    💡 {data.portuguese_explanation}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[0.75rem] text-text-subtle italic">Traduzindo frase...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
