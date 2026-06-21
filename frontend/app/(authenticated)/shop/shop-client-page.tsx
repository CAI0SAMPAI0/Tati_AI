'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Snowflake, Zap, Lock, Coins, Menu } from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/spinner';

interface XpData {
  xp?: number;
  level?: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_freeze_count?: number;
}

export default function ShopClientPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const queryClient = useQueryClient();

  const { data: xpData, isLoading: xpLoading } = useQuery<XpData>({
    queryKey: ['my-stats'],
    queryFn: () => apiGet<XpData>('/dashboard/stats/my'),
  });

  const { data: streakData, isLoading: streakLoading } = useQuery<StreakData>({
    queryKey: ['progress-streak'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
  });

  const handlePurchaseFreeze = async () => {
    setIsPurchasing(true);
    try {
      const res = await apiPost<any>('/users/streaks/purchase-freeze', {});
      if (!res.ok) {
        const errorDetail = (res.data as any)?.detail || 'Erro ao realizar a compra';
        throw new Error(errorDetail);
      }
      toast.success('Streak Freeze acquired! 🧊 Your streak is now protected.');
      

      queryClient.invalidateQueries({ queryKey: ['my-stats'] });
      queryClient.invalidateQueries({ queryKey: ['progress-streak'] });
      queryClient.invalidateQueries({ queryKey: ['streak-data'] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error processing purchase. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const userXp = xpData?.xp ?? 0;
  const freezeCount = streakData?.streak_freeze_count ?? 0;
  const canBuy = userXp >= 150;

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary/30 relative h-screen">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-8 max-w-5xl w-full mx-auto animate-fade-in overflow-y-auto custom-scrollbar">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black text-text tracking-tight">Rewards Shop</h2>
              <p className="text-sm text-text-muted">
                Spend your accumulated XP to buy items that help you learn and keep your streaks.
              </p>
            </div>


            <div className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 shrink-0 shadow-lg shadow-primary/5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap size={22} className="text-amber-500 fill-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="text-[0.6rem] font-bold text-text-muted uppercase tracking-wider leading-none">
                  Your Balance
                </p>
                {xpLoading ? (
                  <div className="h-5 w-16 bg-bg-secondary rounded animate-pulse mt-1" />
                ) : (
                  <p className="text-lg font-black text-text tabular-nums">
                    {userXp.toLocaleString()} <span className="text-text-muted text-xs font-bold">XP</span>
                  </p>
                )}
              </div>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-between gap-6 transition-all hover:border-cyan-500/30 group hover:shadow-lg hover:shadow-cyan-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -mr-4 -mt-4 transition-all group-hover:bg-cyan-500/10" />

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shrink-0">
                    <Snowflake size={24} className="animate-spin-slow" />
                  </div>
                  {streakLoading ? (
                    <div className="h-5 w-14 bg-bg-secondary rounded animate-pulse" />
                  ) : (
                    <span className="text-xs font-bold text-cyan-500 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                      Owned: {freezeCount}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-text">Streak Freeze</h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Protects your consecutive study days streak from resetting if you miss a day. It is consumed automatically when you do not practice.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-text-subtle">
                  <Coins size={16} className="text-amber-500" />
                  <span className="text-sm">150 XP</span>
                </div>

                <Button
                  onClick={handlePurchaseFreeze}
                  disabled={isPurchasing || !canBuy || xpLoading}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  {isPurchasing ? (
                    <Spinner size="sm" className="mr-1.5" />
                  ) : (
                    'Buy Freeze'
                  )}
                </Button>
              </div>
            </div>


            <div className="bg-surface/50 border border-border rounded-3xl p-6 flex flex-col justify-between gap-6 relative overflow-hidden opacity-80 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl -mr-4 -mt-4" />

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
                    <Zap size={24} />
                  </div>
                  <span className="text-[0.6rem] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1">
                    <Lock size={10} /> Lock
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-text-subtle flex items-center gap-2">
                    XP Booster <span className="text-xs font-normal text-text-muted">(Coming Soon)</span>
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    Double all XP earned from chats, tasks, and exercises for 24 hours. Climb the leaderboard and earn premium badges!
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-text-muted">
                  <Coins size={16} className="text-text-muted" />
                  <span className="text-sm">300 XP</span>
                </div>

                <Button
                  disabled
                  className="bg-surface border border-border text-text-muted font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Locked
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
