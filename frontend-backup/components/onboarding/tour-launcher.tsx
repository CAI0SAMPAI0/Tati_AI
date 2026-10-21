'use client';

import { useTour } from '@/hooks/useTour';
import dynamic from 'next/dynamic';

import { TourModal } from './tour-modal';

export function TourLauncher() {
  const { isActive, currentStep, next, prev, skip, totalSteps, isLoading } = useTour();

  if (isLoading) return null;
  if (!isActive) return null; // não carrega o modal se o tour não está ativo

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