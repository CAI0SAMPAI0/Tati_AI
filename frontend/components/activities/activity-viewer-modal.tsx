'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ExternalLink, CheckCircle2, Clock, X, AlertCircle, RefreshCw, CheckSquare, Keyboard, Mic, Music, MessageSquareHeart, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentFeedbackModal } from '@/components/feedback/student-feedback-modal';
import { DeveloperBugModal } from '@/components/feedback/developer-bug-modal';

interface ActivityItem {
  id: string;
  slug?: string;
  title: string;
  artist?: string;
  image?: string;
  url: string;
  route?: string;
  level?: string;
  category?: string;
  genre?: string;
  source?: string;
  modes?: {
    choice: string;
    typing: string;
    karaoke: string;
  };
}

interface ActivityViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityItem | null;
  isDone: boolean;
  onMarkDone: (activity: ActivityItem) => Promise<void>;
  onMarkPending: (activity: ActivityItem) => Promise<void>;
}

export function ActivityViewerModal({
  isOpen,
  onClose,
  activity,
  isDone,
  onMarkDone,
  onMarkPending,
}: ActivityViewerModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isBugOpen, setIsBugOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOpenLink = () => {
    if (!activity) return;
    if (activity.route) {
      router.push(activity.route);
      onClose();
    } else {
      window.open(activity.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleDone = async () => {
    if (!activity) return;
    setLoading(true);
    try {
      if (isDone) {
        await onMarkPending(activity);
      } else {
        await onMarkDone(activity);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen || !activity) return null;

  const sourceName =
    activity.source ||
    (activity.url?.includes('test-english')
      ? 'test-english.com'
      : activity.url?.includes('liveworksheets')
      ? 'liveworksheets.com'
      : 'Online Exercise');

  const targetUrl =
    activity.url ||
    (sourceName.includes('liveworksheets')
      ? `https://www.liveworksheets.com/worksheet/en/esl-grammar/${activity.id || activity.slug || ''}`
      : `https://test-english.com/grammar-points/${(activity.level || 'a1').toLowerCase()}/${activity.slug || ''}`);

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dim overlay */}
      <div
        className="absolute inset-0 bg-black/75 dark:bg-black/85"
        style={{ zIndex: -1 }}
      />

      {/* Modal card */}
      <div className="bg-surface border border-border rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden transform-gpu animate-in zoom-in-95 duration-200">
        {/* Header - Fixed */}
        <div className="p-6 pb-4 border-b border-border/40 shrink-0 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-2 rounded-full text-text-subtle hover:text-text hover:bg-bg transition-colors"
          >
            <X size={20} />
          </button>

          {/* Header Badges */}
          <div className="flex items-center gap-2 flex-wrap pr-10">
            {activity.level && (
              <span className="text-xs font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase">
                {activity.level}
              </span>
            )}
            {activity.genre && (
              <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
                {activity.genre}
              </span>
            )}
            <span className="text-xs font-semibold bg-bg text-text-muted px-2.5 py-1 rounded-full border border-border">
              {sourceName}
            </span>
            {isDone ? (
              <span className="flex items-center gap-1 text-xs font-bold bg-success/15 text-success border border-success/30 px-3 py-1 rounded-full uppercase">
                <CheckCircle2 size={14} /> Completed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold bg-warning/15 text-warning border border-warning/30 px-3 py-1 rounded-full uppercase">
                <Clock size={14} /> Pending
              </span>
            )}
          </div>

          {/* Title & Artist */}
          <div className="mt-3">
            <h2 className="text-lg sm:text-xl font-bold text-text leading-snug">{activity.title}</h2>
            {activity.artist && (
              <p className="text-sm font-medium text-text-muted mt-0.5">{activity.artist}</p>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin">
          {/* Image Preview */}
          {activity.image && (
            <div className="h-36 sm:h-44 rounded-2xl overflow-hidden bg-bg-secondary border border-border/50 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activity.image} alt={activity.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* If activity has game modes (Musics) */}
          {activity.modes && (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">
                Game Modes:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <a
                  href={activity.modes.choice}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <CheckSquare size={16} />
                  </div>
                  <span className="text-xs font-bold text-text group-hover:text-primary">Multiple Choice</span>
                  <span className="text-[0.65rem] text-text-muted mt-0.5">Quiz mode</span>
                </a>

                <a
                  href={activity.modes.typing}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <Keyboard size={16} />
                  </div>
                  <span className="text-xs font-bold text-text group-hover:text-primary">Typing</span>
                  <span className="text-[0.65rem] text-text-muted mt-0.5">Fill in the blanks</span>
                </a>

                <a
                  href={activity.modes.karaoke}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-sm"
                >
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                    <Mic size={16} />
                  </div>
                  <span className="text-xs font-bold text-text group-hover:text-primary">Karaoke</span>
                  <span className="text-[0.65rem] text-text-muted mt-0.5">Sing along</span>
                </a>
              </div>
            </div>
          )}

          {/* Status Callout Banner */}
          {isDone ? (
            <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="text-success shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-success">Activity Completed!</p>
                <p className="text-xs text-text-muted mt-0.5">
                  You have recorded completion for this exercise. To re-try or reset to pending, use the button below.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-2xl flex items-start gap-3">
              <AlertCircle className="text-warning shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-warning">Status: Pending</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {activity.modes ? (
                    <>
                      Choose one of the game modes above, practice on <strong>LingoClip</strong>, and then click <strong>2. Mark as Completed</strong> to earn XP and maintain your streak!
                    </>
                  ) : (
                    <>
                      To mark this activity as <strong>Completed</strong>, click{' '}
                      <strong>1. Open on {sourceName}</strong>, finish the exercise on the website,
                      and then click <strong>2. Mark as Completed</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="p-5 border-t border-border/50 bg-surface shrink-0 flex flex-col sm:flex-row gap-3">
          {activity.route ? (
            <button
              onClick={() => {
                router.push(activity.route!);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-bg-secondary border border-border text-text font-bold text-sm transition-all shadow-sm group"
            >
              <ExternalLink size={18} className="text-primary group-hover:scale-110 transition-transform" />
              1. Open Activity
            </button>
          ) : (
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-bg-secondary border border-border text-text font-bold text-sm transition-all shadow-sm group text-center"
            >
              <ExternalLink size={18} className="text-primary group-hover:scale-110 transition-transform" />
              1. Open on {sourceName}
            </a>
          )}

          <button
            onClick={handleToggleDone}
            disabled={loading}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl text-white font-bold text-sm transition-all shadow-md',
              isDone
                ? 'bg-bg-secondary text-text-muted hover:bg-warning/20 hover:text-warning border border-border'
                : 'bg-success hover:bg-success/90 shadow-success/20'
            )}
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : isDone ? (
              <>
                <Clock size={18} /> Revert to Pending
              </>
            ) : (
              <>
                <CheckCircle2 size={18} /> 2. Mark as Completed
              </>
            )}
          </button>
        </div>

        {/* Feedback & Bug report links */}
        <div className="flex items-center justify-center gap-6 px-6 py-3.5 border-t border-border/50 text-xs text-text-muted bg-surface/60">
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <MessageSquareHeart size={14} className="text-primary" /> Send feedback to Tatiana
          </button>
          <button
            type="button"
            onClick={() => setIsBugOpen(true)}
            className="hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Bug size={14} className="text-red-400" /> Report issue
          </button>
        </div>
      </div>

      <StudentFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        defaultArea={activity?.category || 'general'}
        activityId={activity?.id || ''}
        activityTitle={activity?.title || ''}
        cefrLevel={activity?.level || 'A1'}
      />

      <DeveloperBugModal
        isOpen={isBugOpen}
        onClose={() => setIsBugOpen(false)}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
}
