'use client';

import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Briefcase,
  GraduationCap,
  Lock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Camera,
  Target,
  Zap,
  Trash2,
  Eye,
  EyeOff,
  Star,
  ChevronRight,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiGet, apiPut, apiPost, apiUpload } from '@/lib/api/client';
import { User } from '@/lib/api/types';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { LEVEL_OPTIONS, normalizeLevel } from '@/lib/constants/levels';

export default function ProfileClientPage() {
  const { user, logout, updateProfile } = useAuth();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    nickname: user?.nickname || '',
    email: user?.email || '',
    occupation: user?.occupation || '',
    level: normalizeLevel(user?.level),
    focus: user?.focus || 'General Conversation',
    responsible_email: user?.profile?.responsible_email || '',
    whatsapp_number: user?.profile?.whatsapp_number || '',
    allow_whatsapp_notifications: user?.profile?.allow_whatsapp_notifications ?? false,
  });

  const [pwData, setFormDataPw] = useState({
    current_pw: '',
    new_pw: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        nickname: user.nickname || '',
        email: user.email || '',
        occupation: user.occupation || '',
        level: normalizeLevel(user.level),
        focus: user.focus || 'General Conversation',
        responsible_email: user.profile?.responsible_email || '',
        whatsapp_number: user.profile?.whatsapp_number || '',
        allow_whatsapp_notifications: user.profile?.allow_whatsapp_notifications ?? false,
      });
    }
  }, [user]);



  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await apiPut<User>('/profile/', formData);
      if (res.ok) {
        updateProfile(res.data);
        toast.success('Profile updated successfully! ✔');
      } else {
        toast.error('Error saving. Please try again.');
      }
    } catch (err) {
      toast.error('Error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return toast.error('File too large (max 5MB)');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      toast.loading('Uploading...', { id: 'upload' });
      const result = await apiUpload<{ ok: boolean; avatar_url: string }>('/profile/avatar', formData);
      if (result.ok) {
        updateProfile({ avatar_url: result.data.avatar_url } as any);
        toast.success('Photo updated! ✔', { id: 'upload', duration: 4000 });
      } else {
        toast.error('Error uploading photo', { id: 'upload' });
      }
    } catch (err: any) {
      console.error('[Avatar] Upload error:', err);
      toast.error(err?.message || 'Connection error', { id: 'upload' });
    }
  };

  const handleChangePassword = async () => {
    if (!pwData.new_pw || pwData.new_pw.length < 6) {
      return toast.error('Password must be at least 6 characters.');
    }
    try {
      const res = await apiPost<{ detail?: string }>('/profile/change-password', pwData);
      if (res.ok) {
        toast.success('Saved successfully!');
        setFormDataPw({ current_pw: '', new_pw: '' });
      } else {
        toast.error(res.data?.detail || 'Error saving. Please try again.');
      }
    } catch (err) {
      toast.error('Error. Please try again.');
    }
  };

  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiGet<any>('/users/permissions/subscription'),
  });

  const isUnlocked = sub?.has_subscription || user?.plan_type === 'full';
  const daysLeft = sub?.days_left ?? 0;
  const isGracePeriod = sub?.in_grace_period ?? false;

  return (
    <div className="min-h-screen bg-bg flex flex-col">



      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 space-y-8 pb-32 animate-fade-in">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/chat')}
            className="p-2.5 rounded-xl bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-text leading-none">{'My Profile'}</h1>
            <p className="text-text-muted text-sm">{'Personal Information'}</p>
          </div>
        </header>


        {/* Forms */}
        <div className="space-y-6">
          <section className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-8">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <UserIcon size={20} className="text-primary" />
                {'Personal Information'}
              </h3>

              <div className="flex flex-col items-center sm:items-start sm:flex-row gap-6 mb-8">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 rounded-full bg-surface-hover border-2 border-border overflow-hidden flex items-center justify-center">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={40} className="text-text-muted" />
                    )}
                  </div>
                  <label className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-full transition-opacity cursor-pointer">
                    <Camera size={20} />
                    <span className="text-[0.65rem] font-bold mt-1 uppercase tracking-wider">Change</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <div className="text-center sm:text-left space-y-1">
                  <p className="text-sm font-bold text-text">Profile Picture</p>
                  <p className="text-xs text-text-muted max-w-[200px]">We recommend an image of at least 200x200px in PNG or JPEG format.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Full name'}</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Nickname'}</label>
                  <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Email'}</label>
                  <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Occupation'}</label>
                  <Input value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                <Target size={20} className="text-primary" />
                {'Study Preferences'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'English level'}</label>
                  <Select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: normalizeLevel(e.target.value) })}
                    options={LEVEL_OPTIONS}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Learning focus'}</label>
                  <Select
                    value={formData.focus}
                    onChange={(e) => setFormData({ ...formData, focus: e.target.value })}
                    options={[
                      { value: 'General Conversation', label: 'General Conversation' },
                      { value: 'Business English', label: 'Business English' },
                      { value: 'Travel English', label: 'Travel English' },
                      { value: 'Academic English', label: 'Academic English' },
                      { value: 'Job Interviews', label: 'Job Interviews' },
                    ]}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Guardian / Supervisor Email (Weekly Reports)'}</label>
                  <Input
                    type="email"
                    placeholder="guardian@example.com"
                    value={formData.responsible_email}
                    onChange={(e) => setFormData({ ...formData, responsible_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'WhatsApp Number'}</label>
                  <Input
                    type="tel"
                    placeholder="5511999999999"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex items-start gap-3 bg-bg-secondary/40 p-4 rounded-2xl border border-border/50 select-none">
                  <input
                    type="checkbox"
                    id="allow_whatsapp_notifications"
                    checked={formData.allow_whatsapp_notifications}
                    onChange={(e) => setFormData({ ...formData, allow_whatsapp_notifications: e.target.checked })}
                    className="mt-1 accent-emerald-500 w-4 h-4 rounded shrink-0"
                  />
                  <label htmlFor="allow_whatsapp_notifications" className="space-y-0.5 cursor-pointer">
                    <div className="text-xs font-bold text-text">
                      {'Allow notifications via WhatsApp'}
                    </div>
                    <div className="text-[0.65rem] text-text-subtle leading-normal">
                      {'Receive study materials, quiz alerts and reminders directly on WhatsApp.'}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <Button className="w-full h-12 text-sm font-bold gap-2 mt-4" onClick={handleSaveProfile} loading={isSaving}>
              {'Save changes'}
            </Button>
          </section>

          {/* Security */}
          <section className="bg-surface border border-border rounded-3xl p-6 md:p-8">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Lock size={20} className="text-primary" />
              {'Security'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'Current password'}</label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={pwData.current_pw}
                    onChange={(e) => setFormDataPw({ ...pwData, current_pw: e.target.value })}
                  />
                  <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-subtle uppercase ml-1">{'New password'}</label>
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={pwData.new_pw}
                  onChange={(e) => setFormDataPw({ ...pwData, new_pw: e.target.value })}
                />
              </div>
              <Button variant="secondary" className="md:col-span-2 font-bold" onClick={handleChangePassword}>
                {'Update password'}
              </Button>
            </div>
          </section>

          {/* Plan Banner */}
          <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-3xl p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-1000">
              <Star size={120} fill="currentColor" className="text-primary" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary text-white text-[0.65rem] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                    {isUnlocked ? 'Premium Access' : 'Free Plan'}
                  </span>
                </div>

                {isUnlocked ? (
                  <div className="space-y-2">
                    <p className="text-sm text-text-muted">
                      {isGracePeriod
                        ? "You are enjoying courtesy access to the FULL Plan! All features are unlocked until your next payment."
                        : "Full access to all features: unlimited AI, simulations, podcasts and more."}
                    </p>
                    {daysLeft > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <Zap size={14} className="text-primary animate-pulse" />
                        <span className="text-xs font-bold text-primary">
                          {daysLeft} {daysLeft === 1 ? 'day' : 'days'} of access remaining
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-text-muted">
                      Your premium access has expired. 
                      Subscribe now to regain full access to all features.
                    </p>
                  </div>
                )}              </div>

              {isUnlocked ? (
                isGracePeriod ? (
                  <div className="flex flex-col items-center gap-1 shrink-0 bg-primary/10 border border-primary/20 rounded-2xl px-5 py-3">
                    <span className="text-2xl font-black text-primary">{daysLeft}</span>
                    <span className="text-[0.6rem] font-bold text-primary uppercase tracking-widest">days</span>
                  </div>
                ) : (
                  <Button variant="secondary" className="gap-2 shrink-0" onClick={() => router.push('/payment')}>
                    <Zap size={16} />
                    Manage Plan
                  </Button>
                )
              ) : (
                <Button className="gap-2 shrink-0 shadow-glow" onClick={() => router.push('/payment')}>
                  <Zap size={16} />
                  Subscribe Now
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
              {[
                { icon: '🤖', label: 'Unlimited AI' },
                { icon: '🎙️', label: 'Voice & Pronunciation' },
                { icon: '🎭', label: 'Simulations' },
                { icon: '🎧', label: 'Podcasts' },
              ].map((f) => (
                <div key={f.label} className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-bold",
                  isUnlocked
                    ? "bg-primary/5 border-primary/15 text-text"
                    : "bg-yellow-500/5 border-yellow-500/15 text-text-muted opacity-60"
                )}>
                  <span>{f.icon}</span>
                  {f.label}
                  {!isUnlocked && <Lock size={10} className="ml-auto text-danger" />}
                </div>
              ))}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-danger/5 border border-danger/20 rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h3 className="text-lg font-bold">{'Danger Zone'}</h3>
            </div>
            <p className="text-sm text-text-muted mb-6">
              {'These actions are irreversible. Proceed with care.'}
            </p>
            <div className="flex flex-col md:flex-row gap-4">
              <Button variant="danger" className="gap-2 font-bold flex-1" onClick={logout}>
                <LogOut size={18} />
                {'Sign out'}
              </Button>
              <Button variant="ghost" className="gap-2 font-bold text-danger hover:bg-danger/10 flex-1">
                <Trash2 size={18} />
                {'Delete Account'}
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
