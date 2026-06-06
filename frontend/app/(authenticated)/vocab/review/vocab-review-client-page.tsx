'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '@/lib/api/client';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

import { 
  CheckCircle2, 
  Brain,
  Sparkles,
  RefreshCcw,
  Volume2,
  Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface VocabSRS {
  id: string;
  word: string;
  definition?: string;
  example_sentence?: string;
  next_review: string;
}

export default function VocabReviewClientPage() {
  
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFinished, setIsFullyFinished] = useState(false);

  // Fetch words due for review
  const { data: dueWords = [], isLoading } = useQuery<VocabSRS[]>({
    queryKey: ['due-vocab'],
    queryFn: () => apiGet<VocabSRS[]>('/users/vocabulary/due'),
  });

  const currentWord = dueWords[currentIndex];

  const handleReview = async (score: number) => {
    if (!currentWord) return;

    try {
      await apiPost(`/users/vocabulary/review/${currentWord.id}?quality_score=${score}`, {});
      
      if (currentIndex < dueWords.length - 1) {
        setShowAnswer(false);
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsFullyFinished(true);
        queryClient.invalidateQueries({ queryKey: ['due-vocab'] });
      }
    } catch (err) {
      toast.error('Erro ao salvar revisão.');
    }
  };

  const playAudio = async (text: string) => {
    try {
      const res = await apiPost<{ audio: string }>('/chat/tts', { text });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      } else {
        throw new Error('TTS failed');
      }
    } catch (err) {
      console.error('TTS error:', err);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Spinner size="lg" />
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
          <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-500 py-10">
            
            <header className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-[0.65rem] font-black uppercase tracking-widest">
                <Brain size={12} />
                SRS Memory Training
              </div>
              <h1 className="text-3xl font-display font-bold text-text">
                Daily Review
              </h1>
              {!isFinished && dueWords.length > 0 && (
                 <p className="text-text-muted text-sm">
                    Reviewing {currentIndex + 1} of {dueWords.length} cards
                 </p>
              )}
            </header>

            {!isFinished && dueWords.length > 0 ? (
              <div className="perspective-1000 w-full flex flex-col items-center">
                <motion.div
                  key={currentWord.id}
                  initial={{ rotateY: -10, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  className="w-full h-80 relative"
                >
                  <div className={cn(
                    "w-full h-full bg-surface border-2 border-border rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center shadow-xl transition-all duration-500",
                    showAnswer ? "border-primary/40 bg-primary/5" : "hover:border-primary/20"
                  )}>
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 opacity-20">
                      <Sparkles size={40} />
                    </div>

                    <h2 className="text-4xl md:text-5xl font-display font-bold text-text mb-6">
                      {currentWord.word}
                    </h2>

                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => playAudio(currentWord.word)}
                        className="rounded-full h-12 w-12 hover:bg-primary/10 text-primary mb-4"
                    >
                        <Volume2 size={24} />
                    </Button>

                    <AnimatePresence>
                      {showAnswer && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          className="space-y-4"
                        >
                          <div className="h-px w-20 bg-border mx-auto my-4" />
                          <p className="text-xl font-medium text-primary">
                            {currentWord.definition || 'No definition available.'}
                          </p>
                          {currentWord.example_sentence && (
                            <p className="text-sm text-text-muted italic max-w-md mx-auto px-4">
                              "{currentWord.example_sentence}"
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                <div className="w-full mt-12">
                  {!showAnswer ? (
                    <Button 
                      className="w-full py-8 rounded-2xl text-lg font-bold shadow-glow" 
                      onClick={() => setShowAnswer(true)}
                    >
                      Show Answer
                    </Button>
                  ) : (
                    <div className="grid grid-cols-5 gap-2 md:gap-3">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => handleReview(score)}
                          className={cn(
                            "flex flex-col items-center justify-center py-4 rounded-xl border transition-all hover:scale-105 active:scale-95",
                            score <= 2 ? "bg-danger/5 border-danger/20 text-danger hover:bg-danger/10" :
                            score === 3 ? "bg-warning/5 border-warning/20 text-warning hover:bg-warning/10" :
                            "bg-success/5 border-success/20 text-success hover:bg-success/10"
                          )}
                        >
                          <span className="text-lg font-black">{score}</span>
                          <span className="text-[0.55rem] font-bold uppercase tracking-tighter hidden md:block">
                            {score === 1 ? 'Hard' : score === 5 ? 'Easy' : 'Good'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : isFinished ? (
              <div className="w-full bg-surface border border-border rounded-[2.5rem] p-12 text-center space-y-6 shadow-xl">
                 <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy size={40} />
                 </div>
                 <h2 className="text-3xl font-display font-bold">Review Complete!</h2>
                 <p className="text-text-muted">You've mastered {dueWords.length} words today. Consistency is the path to fluency.</p>
                 <Button onClick={() => window.location.href = '/activities'} className="px-10 py-6 rounded-2xl">
                    Back to Activities
                 </Button>
              </div>
            ) : (
              <div className="w-full bg-surface border border-border rounded-[2.5rem] p-12 text-center space-y-6 opacity-60">
                 <CheckCircle2 size={60} className="mx-auto text-success/40" />
                 <h2 className="text-2xl font-bold">You're all caught up!</h2>
                 <p className="text-text-muted">No words need reviewing right now. Keep chatting with Tati to learn new terms!</p>
                 <Button variant="secondary" onClick={() => window.location.href = '/activities'}>
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
