'use client';

import { useState, useEffect } from 'react';
import {
  Palette,
  Volume2,
  MessageCircle,
  ArrowLeft,
  Moon,
  Sun,
  Save,
  RotateCcw
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';

import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import toast from 'react-hot-toast';
import { useTour } from '@/hooks/useTour';

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const { restartTour } = useTour();
  const [mounted, setMounted] = useState(false);

  const [settings, setSettings] = useState({
    audioSpeed: '1',
    wordTooltip: true,
    enterSend: true,
  });

  // Evita erro de hidratação com next-themes
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('tati_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const handleSaveAll = () => {
    localStorage.setItem('tati_settings', JSON.stringify(settings));
    toast.success('Saved successfully!');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-bg">
      <MainHeader />

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 pb-20 animate-fade-in">
        <header className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-hover transition-all text-text-muted border border-border bg-surface">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display">Settings</h1>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Personalize your experience</p>  
          </div>
        </header>

        <div className="space-y-6">
          {/* Aparência */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Palette size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Appearance</h2>       
            </div>
            <div className="p-6 space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Theme</p>
                    <p className="text-xs text-text-muted">Choose between light and dark mode</p>
                  </div>
                  <div className="flex p-1 bg-bg border border-border rounded-xl">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'dark' || resolvedTheme === 'dark' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                    >
                      <Moon size={14} /> {'Dark'}
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'light' || resolvedTheme === 'light' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                    >
                      <Sun size={14} /> {'Light'}
                    </button>
                  </div>
               </div>
            </div>
          </section>

          {/* Áudio */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Volume2 size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Audio</h2>
            </div>
            <div className="p-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Default speed</p>
                    <p className="text-xs text-text-muted">Playback speed for audio responses</p>
                  </div>
                  <Select
                    className="w-32"
                    value={settings.audioSpeed}
                    onChange={(e) => setSettings({...settings, audioSpeed: e.target.value})}
                    options={[
                      { value: '0.75', label: '0.75x' },
                      { value: '1', label: '1x' },
                      { value: '1.25', label: '1.25x' },
                      { value: '1.5', label: '1.5x' },
                      { value: '2', label: '2x' },
                    ]}
                  />
               </div>
            </div>
          </section>

          {/* Chat */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <MessageCircle size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Chat</h2>
            </div>
            <div className="p-6 space-y-6">
               <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Word tooltip</p>
                    <p className="text-xs text-text-muted">Click English words to see translation and pronunciation</p>
                  </div>
                  <input
                    type="checkbox" 
                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all accent-primary"
                    checked={settings.wordTooltip}
                    onChange={(e) => setSettings({...settings, wordTooltip: e.target.checked})}
                  />
               </label>

               <label className="flex items-center justify-between cursor-pointer group pt-6 border-t border-border">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Send with Enter</p>
                    <p className="text-xs text-text-muted">Enter sends the message (Shift+Enter for new line)</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all accent-primary"
                    checked={settings.enterSend}
                    onChange={(e) => setSettings({...settings, enterSend: e.target.checked})}
                  />
               </label>
            </div>
      </section>

      {/* Tour */}
      <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
          <RotateCcw size={20} className="text-primary" />
          <h2 className="font-bold text-sm uppercase tracking-wider">Onboarding Tour</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-text mb-0.5">Restart guided tour</p>
              <p className="text-xs text-text-muted">Walk through the app features again with the step-by-step tour</p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 text-xs font-bold"
              onClick={() => {
                restartTour();
                toast.success('Tour restarted! Look for the tour modal.');
              }}
            >
              <RotateCcw size={14} />
              Restart Tour
            </Button>
          </div>
        </div>
      </section>

      <Button className="w-full h-14 rounded-2xl text-base font-bold gap-3 shadow-glow" onClick={handleSaveAll}>
            <Save size={20} />
            {'Save Changes'}
          </Button>
        </div>
      </main>
    </div>
  );
}
