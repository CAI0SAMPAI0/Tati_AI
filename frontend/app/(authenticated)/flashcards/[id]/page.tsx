'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { MainHeader } from '@/components/layout/main-header';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Volume2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { SidebarActivities } from '@/components/activities/sidebar-activities';

interface Flashcard {
  front: string;
  back: string;
  image_url?: string;
}

interface Deck {
  id: string;
  title: string;
  description: string;
  flashcards: any[];
}

/** Normalizes any card shape the AI may have returned */
function normalizeCard(raw: any): Flashcard {
  const vals = Object.values(raw) as string[];
  return {
    front: raw.front ?? raw.word ?? raw.term ?? raw.question ?? vals[0] ?? '',
    back:  raw.back  ?? raw.definition ?? raw.meaning ?? raw.answer ?? vals[1] ?? '',
    image_url: raw.image_url ?? raw.imageUrl ?? raw.image ?? null
  };
}

export default function FlashcardDeckPage() {
  const params = useParams();
  const router = useRouter();
  const deckId = params.id as string;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: deck, isLoading } = useQuery<Deck>({
    queryKey: ['deck', deckId],
    queryFn: () => apiGet<Deck>(`/activities/modules/${deckId}`),
    enabled: !!deckId,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  if (isLoading) return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );

  const rawCards: any[] = Array.isArray(deck?.flashcards) ? deck!.flashcards : [];
  const cards: Flashcard[] = rawCards.map(normalizeCard).filter(c => c.front);

  if (!deck || cards.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center p-8">
          <Sparkles size={48} className="text-primary/30" />
          <p className="text-text-muted max-w-sm">
            {!deck
              ? 'Deck not found.'
              : 'This deck has no cards yet. Use the Admin Dashboard to generate cards with AI.'}
          </p>
          <Button onClick={() => router.push('/activities')}>Back to Activities</Button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(p => p + 1);
    } else {
      setFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(p => p - 1);
  };

  const playAudio = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { text });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      } else {
        throw new Error('TTS failed');
      }
    } catch (err) {
      console.error('TTS error, falling back to browser:', err);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex-1 flex flex-col min-w-0">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-4xl mb-6">
            <button
              onClick={() => router.push('/activities')}
              className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>

          <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-500 py-4">
            <header className="text-center space-y-2">
              <h1 className="text-3xl font-display font-bold text-text">{deck.title}</h1>
              {!finished && (
                <p className="text-text-muted text-sm">Card {currentIndex + 1} of {cards.length}</p>
              )}
            </header>

            {!finished ? (
              <div className="w-full flex flex-col items-center" style={{ perspective: '1000px' }}>
                <div
                  className="w-full h-[500px] relative cursor-pointer"
                  onClick={() => setIsFlipped(f => !f)}
                >
                  <motion.div
                    initial={false}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.55, type: 'spring', stiffness: 280, damping: 22 }}
                    style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%' }}
                  >
                    {/* Front */}
                    <div
                      className="absolute inset-0 bg-surface border-2 border-border hover:border-primary/30 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-xl"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <div className="flex flex-col items-center gap-6">
                        <h2 className="text-4xl md:text-6xl font-display font-bold text-text tracking-tight">
                          {currentCard.front}
                        </h2>
                        <Button
                          variant="secondary" size="lg"
                          onClick={(e) => playAudio(currentCard.front, e)}
                          className="rounded-full h-14 w-14 text-primary bg-primary/10 hover:bg-primary/20 border-none shadow-sm transition-all hover:scale-110"
                        >
                          <Volume2 size={28} />
                        </Button>
                      </div>
                      <p className="text-[0.7rem] text-text-muted absolute bottom-10 uppercase tracking-[0.3em] font-bold opacity-50">Tap to flip</p>
                    </div>

                    {/* Back */}
                    <div
                      className="absolute inset-0 bg-surface border-2 border-primary/40 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      {currentCard.image_url ? (
                        <>
                          <div className="relative h-[45%] w-full flex items-center justify-center p-6">
                            <img 
                              src={currentCard.image_url} 
                              alt={currentCard.front}
                              className="max-w-full max-h-full object-contain drop-shadow-xl"
                            />
                          </div>
                          
                          <div className="flex-1 flex flex-col items-center justify-between p-8 md:p-10 text-center relative">
                            <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                              <h2 className="text-xl md:text-2xl font-display font-bold text-text leading-relaxed max-w-md">
                                {currentCard.back}
                              </h2>
                              
                              <Button
                                variant="secondary" size="md"
                                onClick={(e) => playAudio(currentCard.back, e)}
                                className="rounded-full h-12 w-12 text-primary bg-primary/10 hover:bg-primary/20 border-none shadow-sm transition-transform hover:scale-110"
                              >
                                <Volume2 size={22} />
                              </Button>
                            </div>

                            <p className="text-[0.6rem] text-text-muted uppercase tracking-[0.3em] font-black opacity-30 mt-4">Explanation</p>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative space-y-10">
                           <h2 className="text-2xl md:text-4xl font-display font-medium text-text leading-tight max-w-md">
                            {currentCard.back}
                          </h2>
                          <Button
                            variant="secondary" size="lg"
                            onClick={(e) => playAudio(currentCard.back, e)}
                            className="rounded-full h-16 w-16 text-primary bg-primary/10 hover:bg-primary/20 border-none shadow-sm transition-transform hover:scale-110"
                          >
                            <Volume2 size={32} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                <div className="w-full mt-10 flex items-center gap-4">
                  <Button
                    variant="secondary" className="flex-1 py-6 rounded-2xl font-bold"
                    onClick={handlePrev} disabled={currentIndex === 0}
                  >
                    <ArrowLeft size={18} className="mr-2" /> Previous
                  </Button>
                  <Button
                    className="flex-1 py-6 rounded-2xl font-bold shadow-glow"
                    onClick={handleNext}
                  >
                    {currentIndex === cards.length - 1 ? 'Finish' : 'Next'}
                    <ArrowRight size={18} className="ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full bg-surface border border-border rounded-[2.5rem] p-12 text-center space-y-6 shadow-xl">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                  <Sparkles size={40} />
                </div>
                <h2 className="text-3xl font-display font-bold">Awesome!</h2>
                <p className="text-text-muted">You reviewed all {cards.length} cards in this deck.</p>
                <Button onClick={() => router.push('/activities')} className="px-10 py-6 rounded-2xl">
                  Back to Activities
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
