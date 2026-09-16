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
  usedHint: boolean;
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
  const submittedRef = useRef(false);

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

  // Submit activity progress to submissions history when session completes
  useEffect(() => {
    if (finished && cards.length > 0 && !submittedRef.current) {
      submittedRef.current = true;
      const cleanCorrect = results.filter(r => r.status === 'correct' && !r.usedHint).length;
      const hintCorrect = results.filter(r => r.status === 'correct' && r.usedHint).length;
      const wrong = results.filter(r => r.status === 'wrong').length;
      const unknown = results.filter(r => r.status === 'unknown').length;
      const totalPoints = (cleanCorrect * 1.0) + (hintCorrect * 0.5);
      const scorePct = Math.round((totalPoints / cards.length) * 100);

      apiPost('/activities/submissions', {
        activity_id: deckId,
        activity_type: 'flashcards',
        score: scorePct,
        status: 'completed',
        metadata: {
          title: deck?.title || 'Flashcards Deck',
          deck_id: deckId,
          total_cards: cards.length,
          clean_correct: cleanCorrect,
          hint_correct: hintCorrect,
          wrong: wrong,
          skipped: unknown,
          score_points: totalPoints,
          category: 'flashcards',
          status: 'completed',
          url: `/flashcards/${deckId}`,
        },
      }).catch(() => {});
    }
  }, [finished, deckId, deck?.title, cards.length, results]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleCheck = () => {
    if (!currentCard || revealed) return;
    const match = isApproximateMatch(userInput, currentCard.front);
    const status: CardStatus = match ? 'correct' : 'wrong';
    setCardStatus(status);
    setRevealed(true);
    saveResult(status, showHint);
  };

  const handleIDontKnow = () => {
    if (revealed) return;
    setCardStatus('unknown');
    setRevealed(true);
    saveResult('unknown', showHint);
  };

  const handleShowAnswer = () => {
    if (revealed) return;
    setRevealed(true);
  };

  const handleSelfGrade = (status: CardStatus) => {
    setCardStatus(status);
    saveResult(status, false);
  };

  const saveResult = (status: CardStatus, usedHint: boolean) => {
    setResults(prev => [...prev, { card: currentCard, status, userAnswer: userInput, usedHint }]);
    // Save progress to backend
    apiPost('/activities/flashcards/progress', {
      deck_id: deckId,
      card_front: currentCard.front,
      status,
      used_hint: usedHint,
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
    submittedRef.current = false;
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
    const cleanCorrect = results.filter(r => r.status === 'correct' && !r.usedHint).length;
    const hintCorrect = results.filter(r => r.status === 'correct' && r.usedHint).length;
    const wrong = results.filter(r => r.status === 'wrong').length;
    const unknown = results.filter(r => r.status === 'unknown').length;
    
    // Regra:
    // - Acerto sem dica = 1.0 (100%)
    // - Acerto com dica = 0.5 (meio certo)
    // - Pulou ou Errou = 0.0
    const totalPoints = (cleanCorrect * 1.0) + (hintCorrect * 0.5);
    const pct = cards.length > 0 ? Math.round((totalPoints / cards.length) * 100) : 0;

    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <MainHeader onToggleMenu={() => {}} />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg bg-surface border border-border rounded-3xl p-8 md:p-10 text-center space-y-7 shadow-2xl"
          >
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-black
              ${pct >= 70 ? 'bg-green-500/15 text-green-400 border-2 border-green-500/30' : pct >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-2 border-yellow-500/30' : 'bg-red-500/15 text-red-400 border-2 border-red-500/30'}`}>
              {pct}%
            </div>

            <div>
              <h2 className="text-2xl font-bold text-text mb-1">Session Complete!</h2>
              <p className="text-text-muted text-sm">{deck.title} · {cards.length} cards</p>
              <p className="text-xs font-semibold text-primary mt-1">
                Score: {totalPoints.toFixed(1)} / {cards.length} points
              </p>
            </div>

            {/* Grid com os 4 status detalhados */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-green-400">{cleanCorrect}</div>
                <div className="text-[0.65rem] text-green-400/80 font-bold mt-0.5">Correct (100%)</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-amber-400">{hintCorrect}</div>
                <div className="text-[0.65rem] text-amber-400/80 font-bold mt-0.5">With Hint (50%)</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-red-400">{wrong}</div>
                <div className="text-[0.65rem] text-red-400/80 font-bold mt-0.5">Wrong (0%)</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-3">
                <div className="text-xl font-bold text-yellow-400">{unknown}</div>
                <div className="text-[0.65rem] text-yellow-400/80 font-bold mt-0.5">Skipped (0%)</div>
              </div>
            </div>

            {/* Cards that need review */}
            {(wrong + unknown + hintCorrect) > 0 && (
              <div className="text-left space-y-2">
                <p className="text-xs font-bold text-text-muted uppercase tracking-wider">To review next time:</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {results.filter(r => r.status !== 'correct' || r.usedHint).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-bg rounded-xl px-3 py-2 border border-border/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${r.status === 'wrong' ? 'bg-red-400' : r.status === 'unknown' ? 'bg-yellow-400' : 'bg-amber-400'}`} />
                        <span className="font-bold text-text truncate">{r.card.front}</span>
                      </div>
                      <span className="text-[10px] font-bold text-text-muted shrink-0">
                        {r.status === 'wrong' ? 'Wrong' : r.status === 'unknown' ? 'Skipped' : 'Used Hint'}
                      </span>
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
              <p className="text-sm text-text-muted mt-1">Pratique e memorize o vocabulário em inglês</p>
            </div>

            {/* Card */}
            <div className={`bg-surface border-2 rounded-3xl overflow-hidden shadow-xl transition-all duration-300
              ${revealed
                ? cardStatus === 'correct' ? 'border-green-500/60' 
                : cardStatus === 'wrong' ? 'border-red-500/60' 
                : cardStatus === 'unknown' ? 'border-yellow-500/60'
                : 'border-primary/50'
                : 'border-border'}`}
            >
              {/* Header: Meaning / Portuguese Translation (Clean & prominent) */}
              <div className="p-6 md:p-8 text-center space-y-3 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/50">
                <span className="text-xs uppercase font-black text-primary tracking-widest block">Significado / Tradução</span>
                <h2 className="text-2xl md:text-3xl font-bold text-text leading-tight">
                  {currentCard.back || currentCard.front}
                </h2>
                {currentCard.image_url && (
                  <div className="flex justify-center pt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentCard.image_url}
                      alt="Context illustration"
                      className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-border/80 shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Interaction area */}
              <div className="p-5 space-y-4">
                {!revealed ? (
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && userInput.trim()) handleCheck(); }}
                      placeholder="Digite a palavra em inglês (opcional)..."
                      className="w-full bg-bg border border-border rounded-2xl px-5 py-3.5 text-text text-base font-medium outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-text-muted/40"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleShowAnswer}
                        className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm bg-primary text-white hover:bg-primary/90 transition-all shadow-glow flex items-center justify-center gap-2"
                      >
                        <Sparkles size={16} /> Ver Resposta
                      </button>
                      {userInput.trim() && (
                        <button
                          onClick={handleCheck}
                          className="py-3.5 px-5 rounded-2xl font-bold text-sm bg-green-500/15 text-green-500 hover:bg-green-500/25 border border-green-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={16} /> Conferir
                        </button>
                      )}
                      <button
                        onClick={handleIDontKnow}
                        className="py-3.5 px-4 rounded-2xl font-bold text-sm bg-surface hover:bg-surface-hover border border-border text-text-muted transition-all flex items-center justify-center gap-2"
                      >
                        <HelpCircle size={16} /> Pular
                      </button>
                    </div>
                  </>
                ) : (
                  /* Revealed state */
                  <div className="space-y-5">
                    {/* Correct answer box */}
                    <div className="rounded-2xl bg-primary/10 border border-primary/25 p-5 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[0.68rem] text-primary font-black uppercase tracking-wider block">Resposta em Inglês</span>
                          <span className="text-2xl md:text-3xl font-extrabold text-text mt-1 block">{currentCard.front}</span>
                        </div>
                        <button
                          onClick={(e) => handlePlayAudio(currentCard.front, e)}
                          className="p-3.5 rounded-2xl bg-primary text-white hover:scale-105 active:scale-95 transition-all shadow-glow flex items-center gap-2 text-sm font-bold shrink-0"
                          title="Ouvir pronúncia"
                        >
                          <Volume2 size={18} /> Ouvir
                        </button>
                      </div>

                      {currentCard.explanation && (
                        <div className="text-xs md:text-sm text-text-subtle pt-3 border-t border-primary/15 leading-relaxed">
                          <span className="font-semibold text-text">Exemplo/Contexto: </span>{currentCard.explanation}
                        </div>
                      )}

                      {cardStatus === 'wrong' && userInput && (
                        <div className="text-xs text-red-400 pt-1">Sua resposta digitada: &quot;{userInput}&quot;</div>
                      )}
                    </div>

                    {/* Self grading when answer was just revealed */}
                    {cardStatus === null ? (
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-text-muted uppercase text-center tracking-wider">Como foi o seu desempenho?</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => handleSelfGrade('wrong')}
                            className="py-3.5 rounded-2xl font-bold text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center justify-center gap-2"
                          >
                            <X size={16} /> Preciso revisar
                          </button>
                          <button
                            onClick={() => handleSelfGrade('correct')}
                            className="py-3.5 rounded-2xl font-bold text-sm bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/30 transition-all flex items-center justify-center gap-2"
                          >
                            <Check size={16} /> Acertei!
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 py-1.5 text-xs font-bold">
                          {cardStatus === 'correct' ? (
                            <span className="text-green-400 flex items-center gap-1.5"><Check size={16} /> Registrado como acertado!</span>
                          ) : cardStatus === 'wrong' ? (
                            <span className="text-red-400 flex items-center gap-1.5"><X size={16} /> Marcado para revisão</span>
                          ) : (
                            <span className="text-yellow-400 flex items-center gap-1.5"><HelpCircle size={16} /> Pulado</span>
                          )}
                        </div>
                        <button
                          onClick={handleNext}
                          className="w-full py-4 rounded-2xl font-bold text-base bg-primary text-white hover:bg-primary/90 transition-all shadow-glow flex items-center justify-center gap-2"
                        >
                          {currentIndex === cards.length - 1 ? 'Finalizar Sessão' : 'Próximo Flashcard'}
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    )}
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
