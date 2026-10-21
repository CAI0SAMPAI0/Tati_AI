'use client';

import { useState, useEffect, useRef } from 'react';

import { useVoiceSocket } from '@/hooks/useVoiceSocket';
import { Mic, X, Volume2, Sparkles, PhoneOff, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function VoiceOnlyPage() {
  
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const { state, transcription: lastTranscript, setState } = useVoiceSocket(null);

  const isProcessing = state === 'processing';
  const isRecording = state === 'listening';
  const isConnected = true;

  const startRecording = () => {
    setIsActive(true);
    setState('listening');
  };

  const stopRecording = () => {
    setIsActive(false);
    setState('idle');
  };

  const toggleSession = () => {
    if (isActive) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0e0c1a] text-white flex flex-col items-center justify-between p-8 z-[100] safe-area-inset">
      {/* Header */}
      <header className="w-full flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <span className="font-bold text-sm tracking-tight">Tati Voice Mode</span>
        </div>
        <button 
          onClick={() => router.back()}
          className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={24} />
        </button>
      </header>

      {/* Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full gap-12">
        <div className="relative">
          <AnimatePresence>
            {(isRecording || isProcessing) && (
              <>
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0.2 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                  className="absolute inset-0 bg-primary rounded-full"
                />
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.2, opacity: 0.4 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2, delay: 0.5, ease: "easeOut" }}
                  className="absolute inset-0 bg-accent rounded-full"
                />
              </>
            )}
          </AnimatePresence>
          
          <button
            onClick={toggleSession}
            className={cn(
              "relative w-48 h-48 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10",
              isActive ? "bg-danger shadow-danger/20 scale-105" : "bg-primary shadow-primary/20 hover:scale-105 active:scale-95"
            )}
          >
            {isActive ? (
              isRecording ? <Mic size={64} className="animate-pulse" /> : <Sparkles size={64} />
            ) : (
              <Mic size={64} />
            )}
          </button>
        </div>

        <div className="text-center space-y-4 max-w-sm px-4">
          <h2 className="text-2xl font-display font-bold">
            {isProcessing ? "Tati is thinking..." : isRecording ? "I'm listening..." : "Tap to start talking"}
          </h2>
          <p className="text-white/40 text-sm italic min-h-[3rem] leading-relaxed">
            {lastTranscript ? `"${lastTranscript}"` : "Try saying 'Hello Tati, how are you today?'"}
          </p>
        </div>
      </div>

      {/* Footer Controls */}
      <footer className="w-full flex justify-around items-center pt-8 pb-4">
        <button className="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity">
           <div className="p-4 bg-white/5 rounded-full"><Volume2 size={24} /></div>
           <span className="text-[0.6rem] font-bold uppercase tracking-widest">Speaker</span>
        </button>
        
        <button 
            onClick={() => router.push('/chat')}
            className="flex flex-col items-center gap-2 text-danger opacity-80 hover:opacity-100 transition-opacity"
        >
           <div className="p-4 bg-danger/10 rounded-full border border-danger/20"><PhoneOff size={24} /></div>
           <span className="text-[0.6rem] font-bold uppercase tracking-widest">End Session</span>
        </button>

        <button 
            onClick={stopRecording}
            className="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity"
        >
           <div className="p-4 bg-white/5 rounded-full"><MicOff size={24} /></div>
           <span className="text-[0.6rem] font-bold uppercase tracking-widest">Mute</span>
        </button>
      </footer>
    </div>
  );
}
