'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useRouter } from 'next/navigation';

import { TranscriptPanel } from './transcript-panel';
import { PronunciationPractice } from './pronunciation-practice';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  CirclePlay,
  Waves,
  Sparkles,
  Info,
  CheckCircle
} from 'lucide-react';
import { type Podcast } from '@/lib/api/types/podcast';
import { cn } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/api/client';

interface PodcastViewerProps {
  podcast: Podcast;
}

export function PodcastViewer({ podcast }: PodcastViewerProps) {
  const router = useRouter();
  const [practicePhrase, setPracticePhrase] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await apiPost(`/activities/podcasts/${podcast.id}/complete`, {});
      router.push('/activities');
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompleting(false);
    }
  };
  const { data: generated } = useQuery<{ exercises: Array<Record<string, any>> }>({
    queryKey: ['podcast-exercises', podcast.id],
    queryFn: () => apiGet(`/activities/podcasts/${podcast.id}/exercises`),
    staleTime: 1000 * 60 * 30,
  });

  const safeEmbedUrl = useMemo(() => {
    if (!podcast.embed_url) return '';
    try {
      const url = new URL(podcast.embed_url);
      if (url.hostname.includes('youtube.com')) {
        url.searchParams.set('enablejsapi', '1');
        url.searchParams.set('origin', typeof window !== 'undefined' ? window.location.origin : '');
        url.searchParams.set('playsinline', '1');
      }
      return url.toString();
    } catch {
      return podcast.embed_url;
    }
  }, [podcast.embed_url]);

  const levelColor = useMemo(() => {
    const l = podcast.level?.toLowerCase();
    if (l.includes('a1') || l.includes('beginner')) return 'bg-success/10 text-success border-success/20';
    if (l.includes('b1') || l.includes('intermediate')) return 'bg-primary/10 text-primary border-primary/20';
    if (l.includes('c1') || l.includes('advanced')) return 'bg-danger/10 text-danger border-danger/20';
    return 'bg-bg-secondary text-text-muted border-border';
  }, [podcast.level]);

  const exercises = generated?.exercises || [];
  const currentExercise = exercises[exerciseIndex];
  useEffect(() => {
    if (exerciseIndex > 0 && exerciseIndex >= exercises.length) setExerciseIndex(0);
  }, [exerciseIndex, exercises.length, podcast.id]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Player Section */}
      <div className="min-[1100px]:col-span-2 space-y-6">
        <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl group border border-border">
          {safeEmbedUrl ? (
            <iframe
              src={safeEmbedUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              title={podcast.title}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <Info size={48} className="text-text-subtle opacity-20 mb-4" />
              <p className="text-text-muted mb-4">{'Unable to load the embedded player for this content.'}</p>
              {podcast.external_url && (
                <Button
                  variant="secondary"
                  onClick={() => podcast.external_url && window.open(podcast.external_url, '_blank')}
                  className="gap-2"
                >
                  {'Open original source'}
                  <ArrowUpRight size={16} />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("text-[0.65rem] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border", levelColor)}>
              {podcast.level}
            </span>
            <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-bg-secondary border border-border text-text-muted">
              {podcast.media_type === 'audio' ? <Waves size={14} /> : <CirclePlay size={14} />}
              {podcast.media_type === 'audio' ? 'Audio mode' : 'Video mode'}
            </span>
            {podcast.duration && (
              <span className="text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-bg-secondary border border-border text-text-muted">
                {podcast.duration}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-text leading-tight">
              {podcast.title}
            </h1>
            <p className="text-text-muted leading-relaxed">
              {podcast.description}
            </p>
          </div>

          {podcast.recommendation_reason && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex gap-3">
              <Sparkles className="text-primary shrink-0" size={20} />
              <div className="text-xs">
                <span className="font-bold text-primary uppercase tracking-wider block mb-0.5">
                  {'AI recommendation'}
                </span>
                <p className="text-text-muted italic">{podcast.recommendation_reason}</p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => podcast.external_url && window.open(podcast.external_url, '_blank')}
            >
              <ArrowUpRight size={14} />
              {'Open original source'}
            </Button>
          </div>
        </div>
      </div>

      {/* Transcript Section */}
      <div className="min-[1100px]:col-span-1 h-fit min-[1100px]:sticky min-[1100px]:top-24 space-y-6">
        <TranscriptPanel
          segments={podcast.transcript_segments}
          onPhraseClick={(text) => setPracticePhrase(text)}
        />

        {practicePhrase ? (
          <PronunciationPractice
            phrase={practicePhrase}
            podcastId={podcast.id}
            onClose={() => setPracticePhrase(null)}
          />
        ) : (
          <div className="p-7 bg-surface border border-border rounded-2xl space-y-5 min-h-[360px]">
            <h4 className="text-sm font-bold text-text flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              {'Podcast Practice'}
            </h4>
            {exercises.length ? (
              <div className="space-y-4">
                <div className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                  Exercise {exerciseIndex + 1} of {exercises.length}
                </div>
                <div className="rounded-xl border border-border bg-bg-secondary/40 p-4 min-h-[170px]">
                  {currentExercise?.type === 'voice' ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">Pronunciation</p>
                      <p className="text-sm font-semibold text-text">{String(currentExercise?.question || 'Listen and answer with your voice.')}</p>
                      <p className="text-sm text-text">{String(currentExercise?.phrase || '')}</p>
                      <button className="text-xs font-bold text-primary underline" onClick={() => setPracticePhrase(String(currentExercise?.phrase || ''))}>
                        Practice this sentence
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-text">{String(currentExercise?.question || '')}</p>
                      {currentExercise?.translation_hint && <p className="text-xs text-text-muted">{String(currentExercise.translation_hint)}</p>}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setExerciseIndex((i) => Math.max(0, i - 1))}
                    disabled={exerciseIndex === 0}
                  >
                    Back
                  </Button>
                  {exerciseIndex >= exercises.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={handleComplete}
                      disabled={isCompleting}
                      className="bg-success text-white hover:bg-success/90 border-transparent"
                    >
                      {isCompleting ? <Sparkles size={16} className="mr-2 animate-pulse" /> : <CheckCircle size={16} className="mr-2" />}
                      Mark as Done
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setExerciseIndex((i) => Math.min(exercises.length - 1, i + 1))}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                {'Watch or listen to the content above and answer Teacher Tati questions.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
