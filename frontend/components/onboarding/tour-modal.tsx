'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, SkipForward, X } from 'lucide-react';
import { TOUR_STEPS } from './tour-steps';

interface TourModalProps {
  isActive: boolean;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  totalSteps: number;
}

export function TourModal({
  isActive,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  totalSteps,
}: TourModalProps) {
  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === totalSteps - 1;

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={onSkip}
          />

          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with step indicator */}
            <div className="relative px-6 pt-6 pb-4">
              <button
                onClick={onSkip}
                className="absolute top-4 right-4 p-2 hover:bg-surface-hover rounded-full transition-colors text-text-muted hover:text-text"
              >
                <X size={18} />
              </button>

              {/* Progress bar */}
              <div className="flex gap-1.5 mb-6">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                      i <= currentStep
                        ? 'bg-primary'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>

              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                {step.icon}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-2">
              <h2 className="text-xl font-bold text-text font-display mb-2">
                {step.title}
              </h2>
              <p className="text-sm text-text-muted leading-relaxed">
                {step.description}
              </p>
              <p className="text-[0.65rem] text-text-subtle mt-3 font-medium">
                Find it at: <span className="text-primary font-bold">{step.route}</span>
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-5 flex items-center justify-between">
              <button
                onClick={onSkip}
                className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text transition-colors"
              >
                <SkipForward size={14} />
                Skip Tour
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={onPrev}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-text-muted hover:text-text rounded-xl hover:bg-surface-hover transition-all"
                  >
                    <ChevronLeft size={14} />
                    Back
                  </button>
                )}

                <button
                  onClick={isLast ? onSkip : onNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-glow"
                >
                  {isLast ? 'Get Started' : 'Next'}
                  {!isLast && <ChevronRight size={14} />}
                </button>
              </div>
            </div>

            {/* Step counter */}
            <div className="px-6 pb-4 text-center">
              <span className="text-[0.6rem] text-text-subtle font-bold uppercase tracking-widest">
                {currentStep + 1} of {totalSteps}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
