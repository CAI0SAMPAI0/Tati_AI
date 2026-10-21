'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
import { normalizeLevel, levelLabel } from '@/lib/constants/levels';

interface ListeningViewerProps {
  podcast: Podcast;
}

export function ListeningViewer({ podcast }: ListeningViewerProps) {
  const router = useRouter();
  const [practicePhrase, setPracticePhrase] = useState<string | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const queryClient = useQueryClient();
  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await apiPost(`/activities/podcasts/${podcast.id}/complete`, {});
      await queryClient.invalidateQueries({ queryKey: ['activities-podcasts-progress'] });
      setIsCompleted(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompleting(false);
    }
  }, [podcast.id, queryClient]);
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
    const code = normalizeLevel(podcast.level);
    if (code === 'A1' || code === 'A2') return 'bg-success/10 text-success border-success/20';
    if (code === 'B1' || code === 'B2') return 'bg-primary/10 text-primary border-primary/20';
    if (code === 'C1' || code === 'C2') return 'bg-danger/10 text-danger border-danger/20';
    return 'bg-bg-secondary text-text-muted border-border';
  }, [podcast.level]);

  const exercises = useMemo(() => generated?.exercises ?? [], [generated?.exercises]);
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
              {levelLabel(podcast.level)}
            </span>
            <span className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-bg-secondary border border-border text-text-muted">
              {podcast.media_type === 'audio' ? <Waves size={14} /> : <CirclePlay size={14} />}
              {podcast.media_type === 'audio' ? 'Audio mode' : 'Video mode'}
            </span>
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
          <div className="p-7 bg-surface border border-border rounded-2xl space-y-5">
            <h4 className="text-sm font-bold text-text flex items-center gap-2">
              <CheckCircle size={16} className="text-primary" />
              {'Finished watching?'}
            </h4>
            <p className="text-xs text-text-muted">
              Watch or listen to the content and follow along with the transcript. When you are done, mark this activity as completed to update your progress.
            </p>
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={isCompleting || isCompleted}
              className="w-full bg-success text-white hover:bg-success/90 border-transparent mt-4"
            >
              {isCompleting ? <Sparkles size={16} className="mr-2 animate-pulse" /> : <CheckCircle size={16} className="mr-2" />}
              {isCompleted ? 'Completed!' : 'Mark as Done'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
