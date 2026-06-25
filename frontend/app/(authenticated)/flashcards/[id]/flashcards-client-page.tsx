'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { MainHeader } from '@/components/layout/main-header';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, RotateCcw, Check, X, HelpCircle, Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

interface Flashcard {
  front: string;    // word / term (answer)
  back: string;     // translation / meaning (hint)
  image_url?: string;
  explanation?: string;
}

interface Deck {
  id: string;
  title: string;
  description: string;
  flashcards: any[];
}

type CardStatus = 'correct' | 'wrong' | 'unknown' | null;

// ── Levenshtein distance ───────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isApproximateMatch(input: string, answer: string): boolean {
  const a = input.trim().toLowerCase();
  const b = answer.trim().toLowerCase();
  if (a === b) return true;
  const maxAllowedErrors = Math.floor(b.length / 5); // 1 error per 5 chars
  return levenshtein(a, b) <= Math.max(1, maxAllowedErrors);
}

// ── Normalizer ─────────────────────────────────────────────────────────────────

function normalizeCard(raw: any): Flashcard {
  const vals = Object.values(raw) as string[];
  return {
    front: raw.front ?? raw.word ?? raw.term ?? raw.question ?? vals[0] ?? '',
    back: raw.back ?? raw.definition ?? raw.meaning ?? raw.answer ?? vals[1] ?? '',
    image_url: raw.image_url ?? raw.imageUrl ?? raw.image ?? undefined,
    explanation: raw.explanation ?? raw.description ?? undefined,
  };
}

// ── Flashcard Session ──────────────────────────────────────────────────────────

interface CardResult {
  card: Flashcard;
  status: CardStatus;
  userAnswer: string;
}

export default function FlashcardsClientPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;

  const { data: deck, isLoading } = useQuery<Deck>({
    queryKey: ['deck', deckId],
    queryFn: () => apiGet<Deck>(`/activities/modules/${deckId}`),
    enabled: !!deckId,
  });

  // ── Session state ────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [cardStatus, setCardStatus] = useState<CardStatus>(null);
  const [results, setResults] = useState<CardResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawCards: any[] = Array.isArray(deck?.flashcards) ? deck!.flashcards : [];
  const cards: Flashcard[] = rawCards.map(normalizeCard).filter(c => c.front);
  const currentCard = cards[currentIndex];

  // Focus input when card changes
  useEffect(() => {
    setUserInput('');
    setRevealed(false);
    setCardStatus(null);
    setShowHint(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentIndex]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleCheck = () => {
    if (!currentCard || revealed) return;
    const match = isApproximateMatch(userInput, currentCard.front);
    const status: CardStatus = match ? 'correct' : 'wrong';
    setCardStatus(status);
    setRevealed(true);
    saveResult(status);
  };

  const handleIDontKnow = () => {
    if (revealed) return;
    setCardStatus('unknown');
    setRevealed(true);
    saveResult('unknown');
  };

  const saveResult = (status: CardStatus) => {
    setResults(prev => [...prev, { card: currentCard, status, userAnswer: userInput }]);
    // Save progress to backend (fire and forget)
    apiPost('/activities/flashcard-progress', {
      deck_id: deckId,
      card_front: currentCard.front,
      status,
    }).catch(() => {});
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setFinished(true);
    }
  };

  const handlePlayAudio = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { text });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      }
    } catch {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setResults([]);
    setFinished(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  if (!deck || cards.length === 0) return (
    <div className="min-h-screen bg-bg flex flex-col">
      <MainHeader onToggleMenu={() => {}} />
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-8">
        <Sparkles size={48} className="text-primary/30" />
        <p className="text-text-muted max-w-sm">
          {!deck ? 'Deck not found.' : 'This deck has no cards yet.'}
        </p>
        <Button onClick={() => router.push('/activities')}>Back to Activities</Button>
      </div>
    </div>
  );

  // ── Summary Screen ────────────────────────────────────────────────────────────

  if (finished) {
    const correct = results.filter(r => r.status === 'correct').length;
    const wrong = results.filter(r => r.status === 'wrong').length;
    const unknown = results.filter(r => r.status === 'unknown').length;
    const pct = Math.round((correct / cards.length) * 100);

    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <MainHeader onToggleMenu={() => {}} />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg bg-surface border border-border rounded-3xl p-10 text-center space-y-8 shadow-2xl"
          >
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto text-4xl font-bold
              ${pct >= 70 ? 'bg-green-500/15 text-green-400' : pct >= 40 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
              {pct}%
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text mb-2">Session Complete!</h2>
              <p className="text-text-muted text-sm">{deck.title} · {cards.length} cards</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{correct}</div>
                <div className="text-xs text-green-400/70 font-bold mt-1">Correct</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{wrong}</div>
                <div className="text-xs text-red-400/70 font-bold mt-1">Wrong</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{unknown}</div>
                <div className="text-xs text-yellow-400/70 font-bold mt-1">Skipped</div>
              </div>
            </div>

            {/* Cards that need review */}
            {(wrong + unknown) > 0 && (
              <div className="text-left space-y-2">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">To review next time:</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {results.filter(r => r.status !== 'correct').map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-bg rounded-xl px-3 py-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'wrong' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                      <span className="font-bold text-text">{r.card.front}</span>
                      {r.userAnswer && <span className="text-text-muted">· Your answer: "{r.userAnswer}"</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1 gap-2" onClick={handleRestart}>
                <RotateCcw size={16} /> Try Again
              </Button>
              <Button className="flex-1 gap-2" onClick={() => router.push('/activities')}>
                Back <ArrowRight size={16} />
              </Button>
            </div>
          </MotionDiv>
        </main>
      </div>
    );
  }

  // ── Progress bar ──────────────────────────────────────────────────────────────

  const progress = (currentIndex / cards.length) * 100;

  // ── Main Card UI ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <MainHeader onToggleMenu={() => {}} />

      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        {/* Back + Progress */}
        <div className="w-full max-w-2xl mb-6 space-y-3">
          <button
            onClick={() => router.push('/activities')}
            className="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <MotionDiv
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs text-text-muted font-bold shrink-0">{currentIndex + 1}/{cards.length}</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <MotionDiv
            key={currentIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl space-y-5"
          >
            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-text">{deck.title}</h1>
              <p className="text-sm text-text-muted mt-1">What word or phrase does this image represent?</p>
            </div>

            {/* Card */}
            <div className={`bg-surface border-2 rounded-3xl overflow-hidden shadow-xl transition-all duration-300
              ${revealed
                ? cardStatus === 'correct' ? 'border-green-500/60' 
                : cardStatus === 'wrong' ? 'border-red-500/60' 
                : 'border-yellow-500/60'
                : 'border-border'}`}
            >
              {/* Image / Placeholder */}
              <div className="relative w-full h-56 md:h-72 bg-bg flex items-center justify-center overflow-hidden">
                {currentCard.image_url ? (
                  <img
                    src={currentCard.image_url}
                    alt="Flashcard image"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-30">
                    <ImageIcon size={48} />
                    <p className="text-sm font-medium">No image</p>
                  </div>
                )}

                {/* Status overlay when revealed */}
                {revealed && (
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center pb-4`}>
                    <div className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-sm
                      ${cardStatus === 'correct' ? 'bg-green-500 text-white' 
                      : cardStatus === 'wrong' ? 'bg-red-500 text-white' 
                      : 'bg-yellow-500 text-black'}`}>
                      {cardStatus === 'correct' ? <><Check size={16} /> Correct!</> 
                      : cardStatus === 'wrong' ? <><X size={16} /> Wrong</> 
                      : <><HelpCircle size={16} /> Skipped</>}
                    </div>
                  </div>
                )}
              </div>

              {/* Hint / explanation (optional) */}
              {(showHint || revealed) && currentCard.back && (
                <div className={`px-6 py-3 text-sm font-medium text-center border-t border-border bg-bg/50 transition-all
                  ${revealed ? 'text-text' : 'text-text-muted'}`}>
                  {revealed && <span className="text-[0.65rem] uppercase font-black text-text-muted block mb-1">Hint / Translation</span>}
                  {currentCard.back}
                </div>
              )}

              {/* Answer area */}
              <div className="p-5 space-y-3">
                {!revealed ? (
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) handleCheck(); }}
                      placeholder="Type the word or phrase..."
                      className="w-full bg-bg border border-border rounded-2xl px-5 py-4 text-text text-lg font-medium outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-text-muted/40"
                    />
                    <div className="flex gap-3">
                      {!showHint && currentCard.back && (
                        <button
                          onClick={() => setShowHint(true)}
                          className="flex-1 py-3 rounded-2xl font-bold text-sm border border-border text-text-muted hover:bg-surface-hover transition-all flex items-center justify-center gap-2"
                        >
                          <HelpCircle size={16} /> Show Hint
                        </button>
                      )}
                      <button
                        onClick={handleIDontKnow}
                        className="flex-1 py-3 rounded-2xl font-bold text-sm bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <X size={16} /> I don't know
                      </button>
                      <button
                        onClick={handleCheck}
                        disabled={!userInput.trim()}
                        className="flex-1 py-3 rounded-2xl font-bold text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-glow"
                      >
                        <Check size={16} /> Check
                      </button>
                    </div>
                  </>
                ) : (
                  /* Revealed state */
                  <div className="space-y-4">
                    {/* Correct answer */}
                    <div className="rounded-2xl bg-bg border border-border p-4 space-y-2">
                      <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Correct Answer</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-text">{currentCard.front}</span>
                        <button
                          onClick={(e) => handlePlayAudio(currentCard.front, e)}
                          className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
                        >
                          <Volume2 size={16} />
                        </button>
                      </div>
                      {cardStatus === 'wrong' && userInput && (
                        <div className="text-xs text-red-400 mt-1">Your answer: "{userInput}"</div>
                      )}
                      {currentCard.explanation && (
                        <p className="text-xs text-text-subtle leading-relaxed border-t border-border pt-2 mt-2">
                          {currentCard.explanation}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleNext}
                      className="w-full py-4 rounded-2xl font-bold text-base bg-primary text-white hover:bg-primary/90 transition-all shadow-glow flex items-center justify-center gap-2"
                    >
                      {currentIndex === cards.length - 1 ? 'Finish Session' : 'Next Card'}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </MotionDiv>
        </AnimatePresence>
      </main>
    </div>
  );
}
