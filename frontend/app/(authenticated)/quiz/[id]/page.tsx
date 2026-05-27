'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  ArrowRight, 
  RotateCcw, 
  Target,
  CircleCheck,
  CircleX,
  FileText
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api/client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';


const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  originalIndices?: number[];
}
interface QuizPayload {
  title: string;
  description?: string;
  module_title?: string;
  image_url?: string;
  youtube_url?: string;
  spotify_url?: string;
  file_url?: string;
  questions: QuizQuestion[];
}
interface QuizResult {
  score: number;
  correct_count: number;
  total: number;
  passed: boolean;
}

export default function QuizPage() {
  
  const router = useRouter();
  const { id } = useParams();

  const [step, setStep] = useState<'intro' | 'question' | 'result'>('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [isChecked, setIsChecked] = useState(false);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quiz, isLoading } = useQuery<QuizPayload>({
    queryKey: ['quiz', id],
    queryFn: () => apiGet<QuizPayload>(`/activities/quizzes/${id}`),
    enabled: !!id,
  });

  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestion[]>([]);

  const currentQuestion = shuffledQuestions?.[currentIdx];
  const isLast = currentIdx === (shuffledQuestions?.length || 0) - 1;

  const shuffleArray = <T,>(array: T[]) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const handleStart = () => {
    if (!quiz?.questions) return;

    // 1. Embaralha as perguntas
    const questionsCopy = shuffleArray(quiz.questions).map((q: any) => {
      // 2. Embaralha as opções de cada pergunta
      const originalCorrectOption = q.options[q.correct_index];
      const newOptions = shuffleArray(q.options);
      const newCorrectIndex = newOptions.indexOf(originalCorrectOption);
      const originalIndices = newOptions.map(opt => q.options.indexOf(opt));
      
      return {
        ...q,
        options: newOptions,
        correct_index: newCorrectIndex,
        originalIndices
      };
    });

    setShuffledQuestions(questionsCopy);
    setStep('question');
    setCurrentIdx(0);
    setUserAnswers([]);
    setIsChecked(false);
    setSelectedOpt(null);
  };

  const handleCheck = () => {
    if (selectedOpt === null) return;
    setIsChecked(true);
    const newAnswers = [...userAnswers];
    newAnswers[currentIdx] = selectedOpt;
    setUserAnswers(newAnswers);
  };

  const handleNext = async () => {
    if (isLast) {
      await handleSubmit();
    } else {
      setCurrentIdx(currentIdx + 1);
      setIsChecked(false);
      setSelectedOpt(null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        answers: userAnswers.map((selected_index, idx) => {
          const original_index = shuffledQuestions[idx].originalIndices 
            ? shuffledQuestions[idx].originalIndices[selected_index] 
            : selected_index;
          return {
            question_id: shuffledQuestions[idx].id,
            selected_index: original_index
          };
        })
      };
      const res = await apiPost<QuizResult>(`/activities/quizzes/${id}/submit`, payload);
      if (res.ok) {
        setResult(res.data);
        setStep('result');
      }
    } catch (err) {
      toast.error('Erro ao enviar quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!quiz) return <div className="min-h-screen bg-bg flex items-center justify-center text-text-muted">Quiz não encontrado.</div>;

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-surface shrink-0 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-bg transition-all text-text-muted">
           <ChevronLeft size={24} />
        </button>
        <div className="text-center">
           <p className="text-[0.65rem] font-bold text-primary uppercase tracking-widest leading-none mb-1">{quiz.module_title || 'Quiz'}</p>
           <h1 className="text-sm font-bold text-text truncate max-w-[200px]">{quiz.title}</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
           {step === 'question' ? `${currentIdx + 1}/${shuffledQuestions.length}` : <Target size={20} />}
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto shadow-glow">
                 <Target size={48} />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-text">Ready to practice?</h2>
                {quiz.image_url && (
                  <div className="w-full max-w-md mx-auto rounded-2xl overflow-hidden shadow-lg border border-border">
                    <img src={quiz.image_url} alt={quiz.title} className="w-full h-auto object-cover" />
                  </div>
                )}
                {quiz.youtube_url && (() => {
                  const m = quiz.youtube_url.match(/(?:youtu\.be\/|watch\?v=|embed\/)([\w-]{11})/);
                  return m ? (
                    <div className="w-full max-w-lg mx-auto rounded-2xl overflow-hidden border border-border aspect-video">
                      <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${m[1]}`} allowFullScreen />
                    </div>
                  ) : null;
                })()}
                {quiz.spotify_url && (
                  <iframe
                    className="w-full max-w-lg mx-auto rounded-2xl border border-border block"
                    src={quiz.spotify_url.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                    height="80"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  />
                )}
                {quiz.file_url && (
                  <div className="w-full max-w-lg mx-auto space-y-3">
                    <div className="w-full rounded-2xl overflow-hidden border border-border aspect-[3/4] md:aspect-video bg-white/5 shadow-inner relative group">
                      <iframe
                        src={quiz.file_url.split('?')[0].toLowerCase().endsWith('.pdf') 
                          ? quiz.file_url 
                          : `https://docs.google.com/gview?url=${encodeURIComponent(quiz.file_url)}&embedded=true`}
                        className="w-full h-full border-none bg-white"
                        title="Document viewer"
                      />
                      <div className="absolute inset-0 bg-black/5 pointer-events-none group-hover:bg-transparent transition-colors" />
                    </div>
                    <div className="flex justify-center">
                      <a 
                        href={quiz.file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full transition-all"
                      >
                        <FileText size={14} />
                        Open document in new tab
                      </a>
                    </div>
                  </div>
                )}
                <div className="text-text-muted leading-relaxed max-w-2xl mx-auto prose prose-invert prose-sm text-left">
                   {quiz.description ? (
                     <ReactMarkdown>{quiz.description}</ReactMarkdown>
                   ) : (
                     <p className="text-center">This quiz will help you consolidate your knowledge with immediate feedback.</p>
                   )}
                </div>
              </div>
              <Button size="lg" className="w-full h-14 text-lg font-bold shadow-glow" onClick={handleStart}>
                 Start Quiz
              </Button>
            </motion.div>
          )}

          {step === 'question' && currentQuestion && (
            <motion.div 
              key={currentIdx}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              {/* Progress Bar */}
              <div className="w-full space-y-2">
                 <div className="flex justify-between text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                    <span>Progress</span>
                    <span>{Math.round(((currentIdx + 1) / shuffledQuestions.length) * 100)}%</span>
                 </div>
                 <div className="w-full h-1.5 bg-surface border border-border rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary" 
                      initial={{ width: 0 }} animate={{ width: `${((currentIdx + 1) / shuffledQuestions.length) * 100}%` }} 
                    />
                 </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl md:text-2xl font-bold text-text leading-tight">
                   {currentQuestion.question}
                </h3>

                <div className="grid grid-cols-1 gap-3">
                   {currentQuestion.options.map((opt: string, i: number) => {
                     const isCorrect = i === currentQuestion.correct_index;
                     const isSelected = selectedOpt === i;
                     
                     let btnClass = "text-left px-5 py-4 rounded-2xl border-2 font-medium transition-all relative overflow-hidden group ";
                     
                     if (!isChecked) {
                        btnClass += isSelected ? "border-primary bg-primary/5 text-primary" : "border-border bg-surface hover:border-primary/40 hover:bg-bg-secondary";
                     } else {
                        if (isCorrect) btnClass += "border-success bg-success/10 text-success";
                        else if (isSelected) btnClass += "border-danger bg-danger/10 text-danger";
                        else btnClass += "border-border bg-surface opacity-50 grayscale";
                     }

                     return (
                       <button
                         key={i}
                         disabled={isChecked}
                         onClick={() => setSelectedOpt(i)}
                         className={btnClass}
                       >
                         <span className="relative z-10">{opt}</span>
                         {isChecked && isCorrect && <CircleCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-success" size={20} />}
                         {isChecked && isSelected && !isCorrect && <CircleX className="absolute right-4 top-1/2 -translate-y-1/2 text-danger" size={20} />}
                       </button>
                     );
                   })}
                </div>
              </div>

              {/* Explanation */}
              {isChecked && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    "p-5 rounded-2xl border-2 space-y-2",
                    selectedOpt === currentQuestion.correct_index ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
                  )}
                >
                  <p className={cn("text-xs font-bold uppercase tracking-widest", selectedOpt === currentQuestion.correct_index ? "text-success" : "text-danger")}>
                    {selectedOpt === currentQuestion.correct_index ? 'Correct!' : 'Incorrect.'}
                  </p>
                  <p className="text-sm text-text-muted leading-relaxed italic">
                    {currentQuestion.explanation || `The correct answer is: ${currentQuestion.options[currentQuestion.correct_index]}`}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center w-full space-y-10"
            >
              <div className="relative inline-block">
                {/* Circular Progress Ring */}
                <svg className="w-48 h-48 -rotate-90">
                   <circle cx="96" cy="96" r="88" className="stroke-surface fill-none stroke-[8]" />
                   <motion.circle 
                     cx="96" cy="96" r="88" 
                     className="stroke-primary fill-none stroke-[8]" 
                     strokeDasharray={552}
                     initial={{ strokeDashoffset: 552 }}
                     animate={{ strokeDashoffset: 552 - (552 * result.correct_count) / result.total }}
                     transition={{ duration: 1, ease: 'easeOut' }}
                   />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-5xl font-black text-text">{Math.round((result.correct_count / result.total) * 100)}%</span>
                   <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">Score</span>
                </div>
              </div>

              <div className="space-y-2">
                 <h2 className="text-3xl font-black text-text">Good job!</h2>
                 <p className="text-text-muted font-medium">You got {result.correct_count} out of {result.total} questions correct.</p>
              </div>

              <div className="flex flex-col gap-3 w-full">
                 <Button size="lg" className="h-14 font-bold shadow-glow" onClick={handleStart}>
                    <RotateCcw size={18} className="mr-2" /> Retake Quiz
                 </Button>
                 <Button variant="secondary" size="lg" className="h-14 font-bold" onClick={() => router.push('/activities')}>
                    Back to Activities
                 </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Check/Next */}
      {step === 'question' && (
        <footer className="p-6 border-t border-border bg-surface shrink-0 z-20">
          <div className="max-w-2xl mx-auto">
            {!isChecked ? (
              <Button 
                className="w-full h-14 text-base font-bold shadow-glow" 
                disabled={selectedOpt === null}
                onClick={handleCheck}
              >
                Check Answer
              </Button>
            ) : (
              <Button 
                className={cn("w-full h-14 text-base font-bold shadow-glow", isLast && "bg-success hover:bg-success/90")}
                onClick={handleNext}
                loading={isSubmitting}
              >
                {isLast ? 'View Results' : 'Next Question'}
                {!isLast && <ArrowRight size={18} className="ml-2" />}
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
