'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ExternalLink, CheckCircle2, Clock, X, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  slug?: string;
  title: string;
  image?: string;
  url: string;
  route?: string;
  level?: string;
  category?: string;
  source?: string;
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
    (activity.url.includes('test-english')
      ? 'test-english.com'
      : activity.url.includes('liveworksheets')
      ? 'liveworksheets.com'
      : 'WordWall');

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Blur + dim overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        style={{ zIndex: -1 }}
      />

      {/* Modal card */}
      <div className="bg-surface border border-border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full text-text-subtle hover:text-text hover:bg-bg transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header Badges */}
        <div className="flex items-center gap-2 flex-wrap pr-8">
          {activity.level && (
            <span className="text-xs font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase">
              {activity.level}
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

        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-text leading-snug">{activity.title}</h2>
        </div>

        {/* Image Preview */}
        {activity.image && (
          <div className="h-40 rounded-2xl overflow-hidden bg-bg-secondary border border-border/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activity.image} alt={activity.title} className="w-full h-full object-cover" />
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
                To mark this activity as <strong>Completed</strong>, click{' '}
                <strong>1. Open on {sourceName}</strong>, finish the exercise on the website,
                and then click <strong>2. Mark as Completed</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleOpenLink}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-bg-secondary border border-border text-text font-bold text-sm transition-all shadow-sm group"
          >
            <ExternalLink size={18} className="text-primary group-hover:scale-110 transition-transform" />
            1. Open on {sourceName}
          </button>

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
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
