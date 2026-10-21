'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { useAuth } from '@/hooks/useAuth';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/lib/constants/accents';
import { MainHeader } from '@/components/layout/main-header';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Volume2, 
  RotateCcw, 
  Check, 
  X, 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  RefreshCw,
  MessageSquareHeart,
  Bug,
  AlertTriangle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { StudentFeedbackModal } from '@/components/feedback/student-feedback-modal';
import { DeveloperBugModal } from '@/components/feedback/developer-bug-modal';
import { cn } from '@/lib/utils';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

//    Types                                                                       

interface Flashcard {
  id?: string;
  front: string;    // word / term (correct answer)
  back: string;     // translation / meaning (prompt hint)
  options?: string[]; // 4 choices (1 correct + 3 distractors)
  image_url?: string;
  explanation?: string;
}

interface Deck {
  id: string;
  title: string;
  description: string;
  level?: string;
  flashcards: any[];
}

type CardStatus = 'correct' | 'wrong' | 'unknown' | null;

//    Normalizer                                                                  

function normalizeCard(raw: any, allRawCards: any[] = []): Flashcard {
  const vals = Object.values(raw) as string[];
  const front = String(raw.front ?? raw.word ?? raw.term ?? raw.question ?? vals[0] ?? '').trim();
  const back = String(raw.back ?? raw.definition ?? raw.meaning ?? raw.answer ?? vals[1] ?? '').trim();

  let options: string[] = [];
  if (Array.isArray(raw.options) && raw.options.length > 0) {
    options = raw.options.map((o: any) => String(o).trim()).filter(Boolean);
  }

  // Ensure correct term is included
  if (front && !options.includes(front)) {
    options.unshift(front);
  }

  // Fill up to 4 options using sibling cards from the deck
  if (options.length < 4 && allRawCards.length > 0) {
    for (const other of allRawCards) {
      const otherFront = String(other.front ?? other.word ?? other.term ?? '').trim();
      if (otherFront && otherFront.toLowerCase() !== front.toLowerCase() && !options.includes(otherFront)) {
        options.push(otherFront);
      }
      if (options.length >= 4) break;
    }
  }

  // Fallback alternatives if deck has fewer than 4 unique words
  const fallbackWords = ['Vocabulary', 'Expression', 'Grammar', 'Meaning', 'Concept', 'Practice'];
  for (const w of fallbackWords) {
    if (options.length >= 4) break;
    if (!options.includes(w) && w.toLowerCase() !== front.toLowerCase()) {
      options.push(w);
    }
  }

  return {
    id: raw.id ? String(raw.id) : undefined,
    front,
    back,
    options: options.slice(0, 4),
    image_url: raw.image_url ?? raw.imageUrl ?? raw.image ?? undefined,
    explanation: raw.explanation ?? raw.description ?? undefined,
  };
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function FlashcardsClientPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;
  const { user } = useAuth();

  const { data: deck, isLoading } = useQuery<Deck>({
    queryKey: ['deck', deckId],
    queryFn: () => apiGet<Deck>(`/activities/modules/${deckId}`),
    enabled: !!deckId,
  });

  const rawCards: any[] = Array.isArray(deck?.flashcards) ? deck!.flashcards : [];
  const initialCards: Flashcard[] = React.useMemo(() => {
    return rawCards.map((c, _, arr) => normalizeCard(c, arr)).filter(c => c.front);
  }, [rawCards]);

  //    Accent & Voice State                                                      
  const [selectedAccent, setSelectedAccent] = useState<string>(() => {
    const userProfile = user?.profile as { preferred_accent?: string; accent?: string } | undefined;
    const profileAccent = user?.preferred_accent || userProfile?.preferred_accent || userProfile?.accent;
    return getStoredAccent(profileAccent || 'en-US');
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync with user profile if loaded dynamically
  useEffect(() => {
    const userProfile = user?.profile as { preferred_accent?: string; accent?: string } | undefined;
    const profileAccent = user?.preferred_accent || userProfile?.preferred_accent || userProfile?.accent;
    if (profileAccent && !localStorage.getItem('tati_voice_accent')) {
      setSelectedAccent(profileAccent);
    }
  }, [user]);

  // Clean audio on unmount
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  //    Session & Queue State                                                     
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [cardStatus, setCardStatus] = useState<CardStatus>(null);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  // Tracking metrics
  const [firstTryCorrect, setFirstTryCorrect] = useState<Set<string>>(new Set());
  const [retriedCards, setRetriedCards] = useState<Set<string>>(new Set());
  const [retrySessionCount, setRetrySessionCount] = useState(0);

  // Modals
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isBugOpen, setIsBugOpen] = useState(false);

  const submittedRef = useRef(false);

  // Initialize queue once cards load
  useEffect(() => {
    if (initialCards.length > 0 && queue.length === 0) {
      setQueue(initialCards);
    }
  }, [initialCards, queue.length]);

  const currentCard = queue[currentIndex];
  const isReviewCard = currentIndex >= initialCards.length;

  // Whenever currentCard changes, shuffle its 4 options
  useEffect(() => {
    if (!currentCard) return;

    const opts = [...(currentCard.options || [currentCard.front])];
    // Fisher-Yates shuffle
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    setShuffledOptions(opts);
    setSelectedOption(null);
    setRevealed(false);
    setCardStatus(null);
  }, [currentIndex, currentCard]);

  // Save submission when finished
  useEffect(() => {
    if (finished && initialCards.length > 0 && !submittedRef.current) {
      submittedRef.current = true;
      const total = initialCards.length;
      const cleanCorrect = firstTryCorrect.size;
      const retrySuccess = total - cleanCorrect;
      // 100% for first-try, 70% for cards mastered after retry
      const weightedScore = Math.round(((cleanCorrect * 1.0 + retrySuccess * 0.7) / total) * 100);

      apiPost('/activities/submissions', {
        activity_id: deckId,
        activity_type: 'flashcards',
        score: weightedScore,
        status: 'completed',
        metadata: {
          title: deck?.title || 'Flashcards Deck',
          deck_id: deckId,
          total_cards: total,
          first_try_correct: cleanCorrect,
          retry_success: retrySuccess,
          total_retries: retrySessionCount,
          category: 'flashcards',
          status: 'completed',
          url: `/flashcards/${deckId}`,
        },
      }).catch(() => { });
    }
  }, [finished, deckId, deck?.title, initialCards.length, firstTryCorrect.size, retrySessionCount]);

  //    Handlers                                                                   

  const handleSelectOption = (chosen: string) => {
    if (revealed || !currentCard) return;

    setSelectedOption(chosen);
    setRevealed(true);

    const isMatch = chosen.trim().toLowerCase() === currentCard.front.trim().toLowerCase();

    if (isMatch) {
      setCardStatus('correct');
      if (!retriedCards.has(currentCard.front)) {
        setFirstTryCorrect(prev => new Set(prev).add(currentCard.front));
      }

      // Record progress to backend
      apiPost('/activities/flashcards/progress', {
        deck_id: deckId,
        card_front: currentCard.front,
        status: 'correct',
      }).catch(() => { });
    } else {
      setCardStatus('wrong');
      setRetriedCards(prev => new Set(prev).add(currentCard.front));
      setRetrySessionCount(c => c + 1);

      // Push card to the back of the queue so it reappears before finishing!
      setQueue(prev => [...prev, currentCard]);

      apiPost('/activities/flashcards/progress', {
        deck_id: deckId,
        card_front: currentCard.front,
        status: 'wrong',
      }).catch(() => { });
    }
  };

  const handleSkip = () => {
    if (revealed || !currentCard) return;

    setSelectedOption(null);
    setCardStatus('unknown');
    setRevealed(true);
    setRetriedCards(prev => new Set(prev).add(currentCard.front));
    setRetrySessionCount(c => c + 1);

    // Push card to the back of the queue!
    setQueue(prev => [...prev, currentCard]);

    apiPost('/activities/flashcards/progress', {
      deck_id: deckId,
      card_front: currentCard.front,
      status: 'unknown',
    }).catch(() => { });
  };

  const handleNext = () => {
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setFinished(true);
    }
  };

  const handlePlayAudio = async (text: string, e?: React.MouseEvent, overrideAccent?: string) => {
    if (e) e.stopPropagation();

    // Immediately stop any previously playing audio or native speech synthesis
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const accentToUse = overrideAccent || selectedAccent || 'en-US';
    setIsPlayingAudio(true);

    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { 
        text, 
        accent: accentToUse 
      });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        activeAudioRef.current = audio;
        audio.onended = () => {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        };
        audio.onerror = () => {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        };
        await audio.play();
        return;
      }
    } catch {
      // Fallback native browser TTS
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = accentToUse;
        u.onend = () => setIsPlayingAudio(false);
        u.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(u);
        return;
      }
    }
    setIsPlayingAudio(false);
  };

  const handleRestart = () => {
    submittedRef.current = false;
    setQueue([...initialCards]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setRevealed(false);
    setCardStatus(null);
    setFinished(false);
    setFirstTryCorrect(new Set());
    setRetriedCards(new Set());
    setRetrySessionCount(0);
  };

  //    Loading state                                                              

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!deck || initialCards.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <MainHeader onToggleMenu={() => { }} />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-8">
          <Sparkles size={48} className="text-primary/30" />
          <p className="text-text-muted max-w-sm">
            {!deck ? 'Deck not found.' : 'This deck does not have any flashcards yet.'}
          </p>
          <Button onClick={() => router.push('/activities')}>Back to Activities</Button>
        </div>
      </div>
    );
  }

  //    Summary / Completion Screen                                                

  if (finished) {
    const total = initialCards.length;
    const cleanCorrect = firstTryCorrect.size;
    const retrySuccess = total - cleanCorrect;
    const accuracy = Math.round((cleanCorrect / total) * 100);

    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <MainHeader onToggleMenu={() => { }} />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg bg-surface border border-border rounded-3xl p-8 md:p-10 text-center space-y-7 shadow-2xl"
          >
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-black bg-emerald-500/15 text-emerald-400 border-2 border-emerald-500/30">
              100%
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text mb-1">All Flashcards Mastered!</h2>
              <p className="text-text-muted text-sm">{deck.title} · {total} cards completed</p>
              <p className="text-xs font-semibold text-emerald-400 mt-1">
                You reviewed and mastered all cards in this deck! 🎉
              </p>
            </div>

            {/* Performance breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-emerald-400">{cleanCorrect}</div>
                <div className="text-[0.68rem] text-emerald-400/80 font-bold mt-0.5">First Try ({accuracy}%)</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-amber-400">{retrySuccess}</div>
                <div className="text-[0.68rem] text-amber-400/80 font-bold mt-0.5">After Review</div>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 col-span-2 sm:col-span-1">
                <div className="text-xl font-bold text-primary">{retrySessionCount}</div>
                <div className="text-[0.68rem] text-primary/80 font-bold mt-0.5">Total Retries</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1 gap-2" onClick={handleRestart}>
                  <RotateCcw size={16} /> Practice Again
                </Button>
                <Button className="flex-1 gap-2" onClick={() => router.push('/activities')}>
                  Activities <ArrowRight size={16} />
                </Button>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setIsFeedbackOpen(true)}
                  className="w-full gap-2 text-xs text-primary font-bold hover:bg-primary/10"
                >
                  <MessageSquareHeart size={16} /> Send feedback to Tatiana
                </Button>

                <button
                  type="button"
                  onClick={() => setIsBugOpen(true)}
                  className="text-[11px] text-text-muted hover:text-red-400 flex items-center justify-center gap-1.5 transition-colors pt-1"
                >
                  <Bug size={13} /> Report technical issue to developer
                </button>
              </div>
            </div>
          </MotionDiv>
        </main>

        <StudentFeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
          defaultArea="flashcards"
          activityId={deckId}
          activityTitle={deck.title}
          cefrLevel={deck.level || 'A1'}
        />

        <DeveloperBugModal
          isOpen={isBugOpen}
          onClose={() => setIsBugOpen(false)}
        />
      </div>
    );
  }

  //    Progress Calculation                                                       
  const totalInQueue = queue.length;
  const progressPct = totalInQueue > 0 ? (currentIndex / totalInQueue) * 100 : 0;
  const remainingInQueue = totalInQueue - currentIndex;
  const levelDisplay = deck.level && deck.level.toLowerCase() !== 'all' 
    ? `Level: ${deck.level.toUpperCase()}` 
    : 'Level: All';

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <MainHeader onToggleMenu={() => { }} />

      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        {/* Top bar: Back + Progress + Queue indicator */}
        <div className="w-full max-w-2xl mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/activities')}
              className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm font-medium"
            >
              <ArrowLeft size={16} /> Back to Activities
            </button>

            {isReviewCard && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                <RefreshCw size={13} /> Reviewing pending cards
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <MotionDiv
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-text-muted font-bold shrink-0">
              {currentIndex + 1} / {totalInQueue}
            </span>
          </div>
        </div>

        {/* Flashcard Area */}
        <AnimatePresence mode="wait">
          <MotionDiv
            key={`${currentIndex}-${currentCard?.front}`}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl space-y-5"
          >
            {/* Header Title */}
            <div className="text-center">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                {levelDisplay}
              </span>
              <h1 className="text-2xl font-bold text-text mt-2">{deck.title}</h1>
              <p className="text-xs text-text-muted mt-1">
                Choose the correct English option for the definition shown
              </p>
            </div>

            {/* Flashcard Surface */}
            <div
              className={cn(
                'bg-surface border-2 rounded-3xl overflow-hidden shadow-xl transition-all duration-300',
                revealed
                  ? cardStatus === 'correct'
                    ? 'border-emerald-500/60 ring-2 ring-emerald-500/20'
                    : 'border-rose-500/60 ring-2 ring-rose-500/20'
                  : 'border-border'
              )}
            >
              {/* Card Prompt Header: Meaning / Clue in English */}
              <div className="p-6 md:p-8 text-center space-y-3 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/50">
                <span className="text-xs uppercase font-black text-primary tracking-widest block">
                  Definition / Meaning
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-text leading-tight max-w-xl mx-auto">
                  {currentCard?.back || currentCard?.front}
                </h2>

                {currentCard?.image_url && (
                  <div className="flex justify-center pt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentCard.image_url}
                      alt="Context illustration"
                      className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border border-border/80 shadow-md"
                    />
                  </div>
                )}
              </div>

              {/* 4 Multiple-Choice Options */}
              <div className="p-5 md:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {shuffledOptions.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const isCorrectAnswer = opt.trim().toLowerCase() === currentCard?.front.trim().toLowerCase();

                    let optionStyle = 'bg-bg hover:bg-surface-hover border-border text-text';
                    let letterStyle = 'bg-surface text-text-muted border-border';

                    if (revealed) {
                      if (isCorrectAnswer) {
                        optionStyle = 'bg-emerald-500/15 border-emerald-500/80 text-emerald-300 shadow-sm';
                        letterStyle = 'bg-emerald-500 text-white border-emerald-400';
                      } else if (isSelected && !isCorrectAnswer) {
                        optionStyle = 'bg-rose-500/15 border-rose-500/80 text-rose-300';
                        letterStyle = 'bg-rose-500 text-white border-rose-400';
                      } else {
                        optionStyle = 'bg-bg/40 border-border/40 text-text-muted opacity-50';
                      }
                    }

                    return (
                      <button
                        key={`${opt}-${idx}`}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        disabled={revealed}
                        className={cn(
                          'p-4 rounded-2xl font-bold text-sm md:text-base border-2 text-left transition-all flex items-center justify-between gap-3 group',
                          optionStyle,
                          !revealed && 'hover:scale-[1.01] active:scale-[0.99] hover:border-primary/50'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border transition-colors',
                              letterStyle
                            )}
                          >
                            {OPTION_LETTERS[idx] || (idx + 1)}
                          </span>
                          <span className="truncate">{opt}</span>
                        </div>

                        {revealed && isCorrectAnswer && (
                          <Check size={18} className="text-emerald-400 shrink-0" />
                        )}
                        {revealed && isSelected && !isCorrectAnswer && (
                          <X size={18} className="text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Bottom interaction: revealed feedback OR Skip button */}
                {!revealed ? (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-hover border border-border text-text-muted transition-all flex items-center gap-2"
                    >
                      <HelpCircle size={15} /> Skip this card
                    </button>
                    <span className="text-xs text-text-muted font-medium">
                      {remainingInQueue} card{remainingInQueue > 1 ? 's' : ''} remaining
                    </span>
                  </div>
                ) : (
                  /* Revealed feedback box */
                  <div className="space-y-4 pt-2">
                    {/* Notice for wrong / skipped cards */}
                    {cardStatus !== 'correct' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-300 font-semibold leading-relaxed">
                          {cardStatus === 'wrong'
                            ? "Incorrect answer! Don't worry: this card will return for you to review before finishing the activity."
                            : "Card skipped! It will return before the end of the activity for you to try again."}
                        </p>
                      </div>
                    )}

                    {/* Correct answer display, accent selector & audio */}
                    <div className="bg-primary/10 border border-primary/25 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="text-[0.68rem] text-primary font-black uppercase tracking-wider block">
                          Correct English Term
                        </span>
                        <span className="text-xl md:text-2xl font-extrabold text-text mt-0.5 block truncate">
                          {currentCard.front}
                        </span>
                        {currentCard.explanation && (
                          <p className="text-xs text-text-subtle mt-1.5 italic">
                            &ldquo;{currentCard.explanation}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                        {/* Accent selector dropdown */}
                        <div className="relative">
                          <select
                            value={selectedAccent}
                            onChange={(e) => {
                              const newAccent = e.target.value;
                              setSelectedAccent(newAccent);
                              saveStoredAccent(newAccent);
                              if (currentCard?.front) {
                                handlePlayAudio(currentCard.front, undefined, newAccent);
                              }
                            }}
                            className="appearance-none bg-surface border border-border/80 rounded-xl px-3 py-2 pr-7 text-xs font-bold text-text hover:border-primary/50 focus:outline-none focus:border-primary cursor-pointer transition-colors shadow-sm"
                            title="Choose pronunciation accent"
                          >
                            {ACCENTS.map((acc) => (
                              <option key={acc.id} value={acc.id} className="bg-surface text-text">
                                {acc.flag} {acc.shortLabel}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Listen button */}
                        <button
                          type="button"
                          onClick={(e) => handlePlayAudio(currentCard.front, e, selectedAccent)}
                          disabled={isPlayingAudio}
                          className={cn(
                            "px-4 py-2 rounded-xl bg-primary text-white hover:scale-105 active:scale-95 transition-all shadow-glow flex items-center justify-center gap-2 text-xs font-bold shrink-0",
                            isPlayingAudio && "opacity-80"
                          )}
                          title="Listen to pronunciation"
                        >
                          <Volume2 size={15} className={isPlayingAudio ? "animate-pulse" : ""} />
                          {isPlayingAudio ? "Playing..." : "Listen"}
                        </button>
                      </div>
                    </div>

                    {/* Next / Proceed button */}
                    <button
                      type="button"
                      onClick={handleNext}
                      className="w-full py-4 rounded-2xl font-bold text-base bg-primary text-white hover:bg-primary/90 transition-all shadow-glow flex items-center justify-center gap-2"
                    >
                      {currentIndex === queue.length - 1 ? 'Finish Deck' : 'Next Card'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick helper feedback links - neatly centered with padding away from borders */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted pt-3 pb-8">
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(true)}
                className="px-4 py-2 rounded-xl bg-surface border border-border/70 hover:border-primary/50 text-text-muted hover:text-primary transition-all flex items-center gap-2 text-xs font-semibold shadow-sm"
              >
                <MessageSquareHeart size={15} className="text-primary" /> Send feedback to Tatiana
              </button>

              <button
                type="button"
                onClick={() => setIsBugOpen(true)}
                className="px-4 py-2 rounded-xl bg-surface border border-border/70 hover:border-red-400/50 text-text-muted hover:text-red-400 transition-all flex items-center gap-2 text-xs font-semibold shadow-sm"
              >
                <Bug size={15} className="text-red-400" /> Report card issue
              </button>
            </div>
          </MotionDiv>
        </AnimatePresence>
      </main>

      <StudentFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        defaultArea="flashcards"
        activityId={deckId}
        activityTitle={deck.title}
        cefrLevel={deck.level || 'A1'}
      />

      <DeveloperBugModal
        isOpen={isBugOpen}
        onClose={() => setIsBugOpen(false)}
      />
    </div>
  );
}
