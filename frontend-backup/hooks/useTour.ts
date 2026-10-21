'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

const TOUR_DISMISSED_KEY = 'tati_tour_dismissed';

export function useTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const data = await apiGet<{ has_seen_onboarding: boolean }>(ENDPOINTS.ONBOARDING);
        if (!data.has_seen_onboarding && !localStorage.getItem(TOUR_DISMISSED_KEY)) {
          setIsActive(true);
          setCurrentStep(0);
        }
      } catch {
        if (!localStorage.getItem(TOUR_DISMISSED_KEY)) {
          setIsActive(true);
          setCurrentStep(0);
        }
      } finally {
        setIsLoading(false);
      }
    }
    checkOnboarding();
  }, []);

  const next = useCallback(() => {
    setCurrentStep((prev) => prev + 1);
  }, []);

  const prev = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skip = useCallback(async () => {
    setIsActive(false);
    localStorage.setItem(TOUR_DISMISSED_KEY, 'true');
    try {
      await apiPost(ENDPOINTS.ONBOARDING, { has_seen_onboarding: true });
    } catch {}
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStep(index);
  }, []);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_DISMISSED_KEY);
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return {
    isActive,
    currentStep,
    isLoading,
    next,
    prev,
    skip,
    goToStep,
    restartTour,
    totalSteps: 8,
  };
}
