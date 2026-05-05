/**
 * ErrorCountStore
 *
 * Tracks consecutive grammar/usage errors detected by the AI in the chat.
 * The exercise generation trigger fires at exactly 3 errors (===3).
 * The reset MUST happen BEFORE the generation call — never after —
 * so that a failed API call does not keep re-triggering the exercise.
 *
 * Usage:
 *   const { errorCount, increment, reset } = useErrorCountStore();
 *
 *   // In the message handler, after detecting an error:
 *   increment();
 *
 *   // Before calling the exercise API:
 *   if (errorCount === 3) {
 *     reset();           // ← reset first (fail-safe)
 *     await generateExercise(); // ← then call the API
 *   }
 */

import { create } from 'zustand';

interface ErrorCountState {
  errorCount: number;
  /** Increment the counter. Capped at 3 — never goes above to avoid stale triggers. */
  increment: () => void;
  /** Reset the counter to 0. Always call this BEFORE the generation API call. */
  reset: () => void;
}

export const useErrorCountStore = create<ErrorCountState>((set) => ({
  errorCount: 0,

  increment: () =>
    set((state) => ({
      // Cap at 3 so we never get stuck at > 3 if reset fails
      errorCount: Math.min(state.errorCount + 1, 3),
    })),

  reset: () => set({ errorCount: 0 }),
}));
