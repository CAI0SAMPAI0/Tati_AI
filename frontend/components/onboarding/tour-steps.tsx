'use client';

import React from 'react';
import {
  MessageCircle,
  Mic,
  BookOpen,
  BarChart3,
  Trophy,
  BookMarked,
  User,
  Settings,
} from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-chat',
    title: 'Chat with Tati',
    description:
      'This is your main learning space. Chat with Teacher Tati to practice English conversation, get corrections, and improve your skills.',
    icon: <MessageCircle size={28} className="text-primary" />,
    route: '/chat',
  },
  {
    targetId: 'tour-voice',
    title: 'Voice Conversations',
    description:
      'Switch to voice mode for pronunciation practice. Talk to Tati using your microphone and get real-time feedback.',
    icon: <Mic size={28} className="text-primary" />,
    route: '/voice',
  },
  {
    targetId: 'tour-activities',
    title: 'Activities & Exercises',
    description:
      'Access quizzes, flashcards, grammar, simulations, and listenings. All organized by type to help you practice different skills.',
    icon: <BookOpen size={28} className="text-primary" />,
    route: '/activities',
  },
  {
    targetId: 'tour-progress',
    title: 'Your Progress',
    description:
      'Track your XP, study streak, messages, conversations, and unique words. See charts of your weekly and monthly activity.',
    icon: <BarChart3 size={28} className="text-primary" />,
    route: '/progress',
  },
  {
    targetId: 'tour-achievements',
    title: 'Achievements & Trophies',
    description:
      'Earn medals and trophies as you learn. Track your streak milestones and see how far you have come!',
    icon: <Trophy size={28} className="text-primary" />,
    route: '/achievements',
  },
  {
    targetId: 'tour-vocab',
    title: 'Vocabulary Notebook',
    description:
      'Your personal word notebook. Save words you learn and review them with spaced repetition to never forget.',
    icon: <BookMarked size={28} className="text-primary" />,
    route: '/vocab',
  },
  {
    targetId: 'tour-profile',
    title: 'Profile & Account',
    description:
      'Edit your personal info, change your English level, update your learning focus, and manage your subscription plan.',
    icon: <User size={28} className="text-primary" />,
    route: '/profile',
  },
  {
    targetId: 'tour-settings',
    title: 'Settings',
    description:
      'Customize your experience: switch between dark and light themes, change audio speed, and configure chat preferences.',
    icon: <Settings size={28} className="text-primary" />,
    route: '/settings',
  },
];
