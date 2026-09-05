'use client';

import { useState, useEffect } from 'react';
import {
  Palette,
  Volume2,
  MessageCircle,
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  Save,
  RotateCcw,
  Smartphone,
  Download,
  Bell
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';

import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import toast from 'react-hot-toast';
import { useTour } from '@/hooks/useTour';
import { apiGet, apiPut } from '@/lib/api/client';
import { useAuth } from '@/providers/auth-provider';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/lib/constants/accents';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { restartTour } = useTour();
  const { user, updateProfile } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [selectedAccent, setSelectedAccent] = useState('en-US');

  const [settings, setSettings] = useState({
    audioSpeed: '1',
    wordTooltip: true,
    enterSend: true,
    autoplayChatAudio: false,
  });

  const [prefs, setPrefs] = useState({
    streaks: { email: true, push: true },
    challenges: { email: true, push: true },
    cefr: { email: true, push: true },
  });

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [allowWhatsappNotifications, setAllowWhatsappNotifications] = useState(false);

  const handlePrefChange = (
    category: 'streaks' | 'challenges' | 'cefr',
    channel: 'email' | 'push',
    value: boolean
  ) => {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [channel]: value,
      },
    }));
  };

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('tati_settings');
    if (saved) {
      try {
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {}
    }

    async function loadPrefs() {
      try {
        const data = await apiGet<any>('/users/notification-preferences');
        if (data && data.streaks) {
          setPrefs(data);
        }
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      }
    }
    loadPrefs();
  }, []);

  useEffect(() => {
    if (user?.profile?.preferred_accent) {
      setSelectedAccent(user.profile.preferred_accent);
      saveStoredAccent(user.profile.preferred_accent);
    } else {
      setSelectedAccent(getStoredAccent());
    }
  }, [user]);

  const handleAccentSelect = async (accentId: string) => {
    setSelectedAccent(accentId);
    saveStoredAccent(accentId);
    const accentObj = ACCENTS.find((a) => a.id === accentId);
    toast.success(`Voice accent changed to ${accentObj?.label || accentId}`, { id: 'accent-sync' });

    try {
      await apiPut('/profile', { preferred_accent: accentId, accent: accentId });
      if (user) {
        updateProfile({
          ...user,
          preferred_accent: accentId,
          profile: {
            ...user.profile,
            preferred_accent: accentId,
            accent: accentId,
          },
        });
      }
    } catch (e) {
      console.error('Failed to sync accent to profile:', e);
    }
  };

  const handleSaveAll = async () => {
    localStorage.setItem('tati_settings', JSON.stringify(settings));
    saveStoredAccent(selectedAccent);
    try {
      await apiPut('/users/notification-preferences', prefs);
      
      await apiPut('/profile', {
        whatsapp_number: whatsappNumber.trim() || null,
        allow_whatsapp_notifications: allowWhatsappNotifications,
        preferred_accent: selectedAccent,
        accent: selectedAccent,
      });

      if (user) {
        updateProfile({
          ...user,
          preferred_accent: selectedAccent,
          profile: {
            ...user.profile,
            whatsapp_number: whatsappNumber.trim() || undefined,
            allow_whatsapp_notifications: allowWhatsappNotifications,
            preferred_accent: selectedAccent,
            accent: selectedAccent,
          }
        });
      }

      toast.success('Saved successfully!');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings.');
    }
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

          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Palette size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Appearance</h2>       
            </div>
            <div className="p-6 space-y-8">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Theme</p>
                    <p className="text-xs text-text-muted">Light, dark or match your device</p>
                  </div>
                  <div className="flex flex-wrap p-1 bg-bg border border-border rounded-xl gap-1">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'light' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                    >
                      <Sun size={14} /> {'Light'}
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                    >
                      <Moon size={14} /> {'Dark'}
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'system' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'}`}
                    >
                      <Monitor size={14} /> {'System'}
                    </button>
                  </div>
               </div>
            </div>
          </section>


          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Volume2 size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Audio & Voice Accent</h2>
            </div>
            <div className="p-6 space-y-6">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
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

               <label className="flex items-center justify-between cursor-pointer group pb-6 border-b border-border">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Autoplay chat audio</p>
                    <p className="text-xs text-text-muted">Automatically play voice messages when Teacher Tati replies in chat (Voice and Simulations are always automatic)</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all accent-primary"
                    checked={Boolean(settings.autoplayChatAudio)}
                    onChange={(e) => setSettings({...settings, autoplayChatAudio: e.target.checked})}
                  />
               </label>

               <div>
                  <div className="mb-3">
                    <p className="text-sm font-bold text-text mb-0.5">Teacher Tati Voice Accent</p>
                    <p className="text-xs text-text-muted">Default accent used across the platform (Chat, Voice, Flashcards, and Activities)</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    {ACCENTS.map((accent) => {
                      const isSelected = selectedAccent === accent.id;
                      return (
                        <button
                          key={accent.id}
                          type="button"
                          onClick={() => handleAccentSelect(accent.id)}
                          className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20'
                              : 'border-border bg-bg hover:border-text-muted/30 text-text'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span className="text-sm font-bold">{accent.label}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface border border-border uppercase">
                              {accent.shortLabel}
                            </span>
                          </div>
                          <span className="text-[11px] text-text-muted">{accent.desc}</span>
                        </button>
                      );
                    })}
                  </div>
               </div>
            </div>
          </section>


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


          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Bell size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Notifications</h2>
            </div>
            <div className="p-6 space-y-6">
               <div className="space-y-3 pb-6 border-b border-border">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-bold text-text mb-0.5">Streaks</p>
                     <p className="text-xs text-text-muted">Daily reminders and status alerts</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-6 pl-4">
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.streaks.email}
                       onChange={(e) => handlePrefChange('streaks', 'email', e.target.checked)}
                     />
                     Email
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.streaks.push}
                       onChange={(e) => handlePrefChange('streaks', 'push', e.target.checked)}
                     />
                     Push Notification
                   </label>
                 </div>
               </div>

               <div className="space-y-3 pb-6 border-b border-border">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-bold text-text mb-0.5">Challenges & Activities</p>
                     <p className="text-xs text-text-muted">New weekly challenges and completed activity updates</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-6 pl-4">
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.challenges.email}
                       onChange={(e) => handlePrefChange('challenges', 'email', e.target.checked)}
                     />
                     Email
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.challenges.push}
                       onChange={(e) => handlePrefChange('challenges', 'push', e.target.checked)}
                     />
                     Push Notification
                   </label>
                 </div>
               </div>

               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-sm font-bold text-text mb-0.5">CEFR Level Updates</p>
                     <p className="text-xs text-text-muted">Assessments schedule and level change notifications</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-6 pl-4">
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.cefr.email}
                       onChange={(e) => handlePrefChange('cefr', 'email', e.target.checked)}
                     />
                     Email
                   </label>
                   <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-muted hover:text-text">
                     <input
                       type="checkbox"
                       className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
                       checked={prefs.cefr.push}
                       onChange={(e) => handlePrefChange('cefr', 'push', e.target.checked)}
                     />
                     Push Notification
                   </label>
                 </div>
               </div>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <MessageCircle size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">WhatsApp Notifications</h2>
            </div>
            <div className="p-6 space-y-6">
               <div className="flex flex-col gap-2">
                 <label className="text-sm font-bold text-text">WhatsApp Number</label>
                 <div className="relative max-w-md">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                     +55
                   </span>
                   <input
                     type="tel"
                     placeholder="(11) 99999-9999"
                     value={whatsappNumber}
                     onChange={(e) => setWhatsappNumber(e.target.value)}
                     className="w-full pl-12 pr-4 py-3 bg-bg border border-border rounded-2xl text-sm font-bold text-text placeholder-text-muted/50 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                   />
                 </div>
                 <p className="text-[0.65rem] text-text-subtle leading-normal">
                   Informe o número com DDI/DDD (ex: 11999999999).
                 </p>
               </div>

               <label className="flex items-center justify-between cursor-pointer group pt-6 border-t border-border">
                  <div>
                    <p className="text-sm font-bold text-text mb-0.5">Enable WhatsApp Notifications</p>
                    <p className="text-xs text-text-muted">Receive study materials, quiz alerts, and teacher updates on WhatsApp</p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 transition-all accent-primary"
                    checked={allowWhatsappNotifications}
                    onChange={(e) => setAllowWhatsappNotifications(e.target.checked)}
                  />
               </label>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
              <Smartphone size={20} className="text-primary" />
          <h2 className="font-bold text-sm uppercase tracking-wider">Mobile App</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-text mb-0.5">Install Tati AI</p>
              <p className="text-xs text-text-muted">Get the native app for Android or add to Home Screen on iOS</p>
            </div>
            <Button
              variant="secondary"
              className="gap-2 text-xs font-bold"
              onClick={() => router.push('/install')}
            >
              <Download size={14} />
              Install App
            </Button>
          </div>
        </div>
      </section>


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
