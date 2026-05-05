'use client';

import { useTour } from '@/hooks/useTour';
import { TourModal } from './tour-modal';

export function TourLauncher() {
  const { isActive, currentStep, next, prev, skip, totalSteps, isLoading } = useTour();

  if (isLoading) return null;

  return (
    <TourModal
      isActive={isActive}
      currentStep={currentStep}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      totalSteps={totalSteps}
    />
  );
}
