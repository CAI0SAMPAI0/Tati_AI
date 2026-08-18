'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Trash2,
  Save,
  Brain,
  Target,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  Send,
  BarChart2,
  CheckCircle
} from 'lucide-react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { apiPut, apiPost, apiDelete, apiGet, API_BASE } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { cn, formatTime, formatDateTime } from '@/lib/utils/index';
import { CEFR_LEVELS, normalizeLevel, levelLabel } from '@/lib/constants/levels';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onUpdate: () => void;
}

export function StudentModal({ isOpen, onClose, student, onUpdate }: StudentModalProps) {

  const [activeTab, setActiveTab] = useState<'info' | 'prompt' | 'insight' | 'interests' | 'analytics' | 'progress'>('info');
  const [localStudent, setLocalStudent] = useState(student);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingInterests, setIsAnalyzingInterests] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [promptText, setPromptText] = useState(student?.custom_prompt || '');
  const [analytics, setAnalytics] = useState<any>(null);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [isNudging, setIsNudging] = useState(false);
  const [activityProgress, setActivityProgress] = useState<any>(null);
  const [isFetchingProgress, setIsFetchingProgress] = useState(false);
  const lang = 'en-US';

  const fetchActivityProgress = async () => {
    setIsFetchingProgress(true);
    try {
      const res = await apiGet<any>(`/dashboard/students/${encodeURIComponent(localStudent.username)}/activity-progress`);
      setActivityProgress(res);
    } catch (err) {
      toast.error('Failed to load activity progress.');
    } finally {
      setIsFetchingProgress(false);
    }
  };

  // Reset local state when student changes
  useEffect(() => {
    setLocalStudent(student);
    setPromptText(student?.custom_prompt || '');
    setInsight(null);
    setInterests([]);
    setRecommendations([]);
    setAnalytics(null);
    setActivityProgress(null);
    if (student) {
      setNudgeMessage(`Hi ${student.name || student.username}! Teacher Tati here. I noticed you haven't practiced English lately. Let's do a quick chat session today?`);
    }
  }, [student]);



  const handleUpdateLevel = async (level: string) => {
    try {
      await apiPut(`/dashboard/students/${encodeURIComponent(localStudent.username)}`, { level });
      setLocalStudent({ ...localStudent, level });
      toast.success('✔ Level updated successfully!');
      onUpdate();
    } catch (err) {
      toast.error('✗ Error saving. Please try again.');
    }
  };



  const handleSavePrompt = async () => {
    try {
      await apiPut(`/dashboard/students/${encodeURIComponent(localStudent.username)}`, { custom_prompt: promptText });
      setLocalStudent({ ...localStudent, custom_prompt: promptText });
      toast.success('✔ Prompt saved! Takes effect on next message.');
      onUpdate();
    } catch (err) {
      toast.error('✗ Error saving. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('This action is irreversible.')) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/dashboard/students/${encodeURIComponent(localStudent.username)}`);
      toast.success('Saved successfully!');
      onClose();
      onUpdate();
    } catch (err) {
      toast.error('✗ Error saving. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateInsight = async () => {
    setIsGenerating(true);
    try {
      const res = await apiGet<{ insight: string }>(`/dashboard/students/${encodeURIComponent(localStudent.username)}/insight?lang=${lang}`);
      setInsight(res.insight);
      toast.success('Saved successfully!');
    } catch (err) {
      toast.error('Error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateGrammarErrors = async () => {
    setIsGenerating(true);
    try {
      const res = await apiGet<{ errors: any[] }>(`/dashboard/students/${encodeURIComponent(localStudent.username)}/grammar-errors?lang=${lang}`);
      // Formatting errors for display
      const errorList = res.errors?.map((e: any) => `${e.category}: ${e.count}x`).join('\n') || 'No grammar errors detected in the latest messages.';
      setInsight(`🧩 ${'Grammar Errors'}\n\n${errorList}`);
      toast.success('Saved successfully!');
    } catch (err) {
      toast.error('Error. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchInterests = async () => {
    setIsAnalyzingInterests(true);
    try {
      const res = await apiGet<{ interests: string[]; recommendations: any[] }>(`/dashboard/students/${encodeURIComponent(localStudent.username)}/recommendations?lang=${lang}`);
      setInterests(res.interests || []);
      setRecommendations(res.recommendations || []);
      toast.success('Interests analyzed successfully!');
    } catch (err) {
      toast.error('Error. Please try again.');
    } finally {
      setIsAnalyzingInterests(false);
    }
  };


  const fetchAnalytics = async () => {
    setIsFetchingAnalytics(true);
    try {
      const res = await apiGet<any>(`/dashboard/students/${encodeURIComponent(localStudent.username)}/analytics`);
      setAnalytics(res);
    } catch (err) {
      toast.error('Failed to load student analytics.');
    } finally {
      setIsFetchingAnalytics(false);
    }
  };

  const handleSendNudge = async () => {
    if (!nudgeMessage.trim()) return;
    setIsNudging(true);
    try {
      await apiPost(`/dashboard/students/${encodeURIComponent(localStudent.username)}/nudge`, { message: nudgeMessage });
      toast.success('✔ Student nudged successfully!');
    } catch (err) {
      toast.error('✗ Failed to send nudge.');
    } finally {
      setIsNudging(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'analytics' && localStudent) {
      fetchAnalytics();
    }
    if (activeTab === 'progress' && localStudent) {
      fetchActivityProgress();
    }
  }, [activeTab, localStudent]);

  if (!localStudent) return null;

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title={localStudent.name || localStudent.username}
    >
      <div className="flex flex-col gap-6">
        {/* Header/Tabs */}
        <div className="flex bg-bg-secondary p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'info', icon: <User size={14} />, label: 'Profile' },
            { id: 'analytics', icon: <BarChart2 size={14} />, label: 'Analytics' },
            { id: 'progress', icon: <CheckCircle size={14} />, label: 'Progress' },
            { id: 'prompt', icon: <AlertCircle size={14} />, label: 'Prompt' },
            { id: 'insight', icon: <Brain size={14} />, label: 'Insight' },
            { id: 'interests', icon: <Target size={14} />, label: 'Interests' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[350px]">
          {activeTab === 'info' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-4 p-4 bg-bg-secondary/50 rounded-2xl border border-border">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                  {localStudent.avatar_url ? <img src={localStudent.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : localStudent.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-text">@{localStudent.username}</h3>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    <Clock size={12} /> {'Joined'}: {formatDateTime(localStudent.created_at)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface border border-border rounded-xl">
                  <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Messages</span>
                  <p className="text-sm font-bold text-text mt-1">{localStudent.total_messages || 0}</p>
                </div>
                <div className="p-3 bg-surface border border-border rounded-xl">
                  <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Streak</span>
                  <p className="text-sm font-bold text-warning mt-1">🔥 {localStudent.current_streak || 0} days</p>
                </div>
                <div className="p-3 bg-surface border border-border rounded-xl">
                  <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Freezes</span>
                  <p className="text-sm font-bold text-info mt-1">❄️ {localStudent.streak_freeze_count || 0}/3</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">{'Level'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {CEFR_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleUpdateLevel(lvl)}
                      className={cn(
                        "px-2 py-2 rounded-lg text-[0.65rem] font-bold border transition-all",
                        normalizeLevel(localStudent.level) === lvl ? "bg-primary border-primary text-white" : "border-border hover:border-primary/40 text-text-subtle"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  variant="secondary"
                  className="w-full text-danger hover:bg-danger/10 hover:text-danger border-danger/20"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} className="mr-2" />
                  Delete student
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-warning/5 border border-warning/10 rounded-2xl">
                <p className="text-xs text-warning leading-relaxed">Add extra instructions for Tati to follow <strong>only with this student</strong>.</p>
              </div>
              <textarea
                className="w-full h-40 p-4 bg-bg border border-border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                placeholder="Ex: Foque em corrigir o uso de preposições..."
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
              />
              <Button onClick={handleSavePrompt} className="w-full gap-2">
                <Save size={16} />
                Save prompt
              </Button>
            </div>
          )}

          {activeTab === 'insight' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-text">{'🧠 Generate Insight'}</h4>
                  <p className="text-xs text-text-muted mt-1">{'Click 🧠 Generate Insight to analyze this student\'s history or Grammar Errors to see recurring mistakes.'}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    onClick={handleGenerateInsight}
                    disabled={isGenerating}
                    className="flex-1 gap-2"
                  >
                    {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
                    {isGenerating ? '⏳ Analyzing...' : 'Generate Insight'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleGenerateGrammarErrors}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    🧩 {'Grammar Errors'}
                  </Button>
                </div>
              </div>

              {insight && (
                <div className="p-4 bg-surface border border-border rounded-2xl animate-fade-in">
                  <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Brain size={14} /> AI Analysis
                  </h5>
                  <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{insight}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'interests' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-10 text-center border border-dashed border-border rounded-3xl">
                <Target size={32} className="mx-auto text-text-subtle mb-3" />
                <p className="text-sm text-text-muted">{'The AI will analyze the history to map hobbies and suggest study plans.'}</p>
                <Button
                  variant="secondary"
                  className="mt-4 gap-2"
                  onClick={handleFetchInterests}
                  disabled={isAnalyzingInterests}
                >
                  {isAnalyzingInterests ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {isAnalyzingInterests ? 'Analyzing...' : 'Analyze Interests'}
                </Button>
              </div>

              {interests.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest, i) => (
                      <span key={i} className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20">
                        {interest}
                      </span>
                    ))}
                  </div>
                  {recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">{'Practical Recommendations'}</h4>
                      {recommendations.map((rec: any, i) => (
                        <div key={i} className="p-3 bg-surface border border-border rounded-xl text-xs leading-relaxed">
                          <span className="font-bold text-primary mr-2">✦</span>
                          <span className="font-bold">{rec.recommendation || rec}:</span> {rec.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              {isFetchingAnalytics ? (
                <div className="flex justify-center items-center py-12">
                  <RefreshCw size={24} className="animate-spin text-primary" />
                </div>
              ) : !analytics ? (
                <p className="text-center text-xs text-text-muted">No analytics data available.</p>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-surface border border-border rounded-xl">
                      <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Weekly Study</span>
                      <p className="text-sm font-bold text-text mt-0.5">{analytics.summary?.total_study_minutes_weekly || 0} min</p>
                      <span className="text-[0.6rem] text-text-muted">Avg {analytics.summary?.avg_study_minutes_daily || 0}m/day</span>
                    </div>
                    <div className="p-3 bg-surface border border-border rounded-xl">
                      <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Interactions</span>
                      <p className="text-sm font-bold text-text mt-0.5">{analytics.summary?.total_messages_weekly || 0} msgs</p>
                      <span className="text-[0.6rem] text-text-muted">This week</span>
                    </div>
                    <div className="p-3 bg-surface border border-border rounded-xl">
                      <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Activities</span>
                      <p className="text-sm font-bold text-text mt-0.5">{analytics.summary?.total_activities_weekly || 0} done</p>
                      <span className="text-[0.6rem] text-text-muted">Quizzes/Lessons</span>
                    </div>
                  </div>

                  {/* Study Time Chart */}
                  <div className="p-4 bg-surface border border-border rounded-2xl">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <BarChart2 size={14} /> Study Time (last 7 days)
                    </h4>
                    <div className="h-28 flex items-end gap-3 px-2 pt-2 border-b border-border pb-1">
                      {(analytics.study_time_chart || []).map((day: any, idx: number) => {
                        const maxVal = Math.max(...(analytics.study_time_chart || []).map((d: any) => d.study_minutes), 10);
                        const heightPct = Math.min(100, Math.max(8, (day.study_minutes / maxVal) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Bar Tooltip */}
                            <div className="absolute bottom-full mb-1 bg-neutral-950 text-white text-[0.6rem] p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg border border-border/20">
                              <span className="font-bold">{day.study_minutes} min</span>
                              <br />
                              <span className="text-neutral-400">{day.messages_sent} msgs</span>
                            </div>
                            {/* Bar */}
                            <div
                              className={cn(
                                "w-full rounded-t-md transition-all duration-300",
                                day.study_minutes > 0 ? "bg-primary group-hover:bg-primary/80" : "bg-border/30"
                              )}
                              style={{ height: `${heightPct}%` }}
                            />
                            {/* Label */}
                            <span className="text-[0.65rem] text-text-muted mt-1.5 font-bold uppercase tracking-wider">{day.day_name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Module Progress */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Syllabus Progress</h4>
                    <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                      {(!analytics.module_progress || analytics.module_progress.length === 0) ? (
                        <p className="text-xs text-text-muted italic">No module progression found.</p>
                      ) : (
                        analytics.module_progress.map((mod: any) => (
                          <div key={mod.module_id} className="p-3 bg-bg-secondary/40 border border-border/80 rounded-xl space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-text truncate max-w-[70%]">{mod.title}</span>
                              <span className="text-[0.65rem] font-bold text-text-muted">
                                {mod.completed_quizzes}/{mod.total_quizzes} {mod.type_label || "Quizzes"}
                              </span>
                            </div>
                            <div className="w-full bg-border/40 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full transition-all duration-500"
                                style={{ width: `${mod.progress_pct}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Risk Alert & Nudge Panel */}
                  <div className={cn(
                    "p-4 border rounded-2xl space-y-3",
                    localStudent.risk_level !== 'active'
                      ? "bg-warning/5 border-warning/20"
                      : "bg-primary/5 border-primary/10"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        localStudent.risk_level !== 'active' ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                      )}>
                        <AlertCircle size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-text">
                          {localStudent.risk_level !== 'active'
                            ? `Inactive for ${localStudent.days_inactive} days!`
                            : "Engagement status is healthy"}
                        </h4>
                        <p className="text-[0.7rem] text-text-muted mt-0.5">
                          {localStudent.risk_level !== 'active'
                            ? "Send a custom message directly to their chat to wake them up."
                            : "Keep them motivated! You can send an encouraging message anytime."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <textarea
                        className="w-full h-20 p-2.5 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none text-text"
                        placeholder="Write a nudge message..."
                        value={nudgeMessage}
                        onChange={(e) => setNudgeMessage(e.target.value)}
                      />
                      <Button
                        onClick={handleSendNudge}
                        disabled={isNudging || !nudgeMessage.trim()}
                        className="w-full text-xs py-1.5 h-auto gap-2"
                      >
                        {isNudging ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                        Send Nudge
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-5 animate-fade-in">
              {isFetchingProgress ? (
                <div className="flex justify-center items-center py-12">
                  <RefreshCw size={24} className="animate-spin text-primary" />
                </div>
              ) : !activityProgress ? (
                <p className="text-center text-xs text-text-muted">No activity progress data.</p>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Grammar</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.grammar || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Vocab</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.vocabulary || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Listening</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.listening || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Reading</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.reading || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Flashcards</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.flashcards || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Simulations</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.simulations || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Games</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.games || 0}</p>
                    </div>
                    <div className="p-2.5 bg-surface border border-border rounded-xl">
                      <span className="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">News</span>
                      <p className="text-base font-black text-text mt-0.5">{activityProgress.summary?.news || 0}</p>
                    </div>
                  </div>

                  {/* Submissions List */}
                  {activityProgress.submissions?.length > 0 && (() => {
                    // Local state for categorizing the list in student-modal
                    const categories = ['all', 'grammar', 'vocabulary', 'listening', 'reading', 'simulations', 'games', 'news'];

                    // Filter submissions based on a local state defined at the component wrapper if possible
                    // However since this is inline, we can define a tab selector or simply list them categorized
                    // Let's group them or render a tab list. Since we want an interactive tab selection, let's create a local filter state!
                    return <StudentSubmissionsSection submissions={activityProgress.submissions} />;
                  })()}

                  {/* Flashcards List */}
                  {activityProgress.flashcards?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Flashcards Completed</h4>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                        {activityProgress.flashcards.map((f: any, i: number) => (
                          <div key={f.id || i} className="p-2.5 bg-bg-secondary/40 border border-border/80 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                              <span className="font-bold text-text truncate">Card #{f.card_index ?? i + 1}</span>
                            </div>
                            <span className="text-[0.6rem] text-success font-bold shrink-0">✓ Correct</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vocabulary List */}
                  {activityProgress.vocabulary?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Vocabulary Learned</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {activityProgress.vocabulary.map((v: any, i: number) => (
                          <span key={v.id || i} className="px-2.5 py-1 bg-primary/10 text-primary text-[0.65rem] font-bold rounded-lg border border-primary/20">
                            {v.word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pronunciation */}
                  {activityProgress.pronunciation?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Pronunciation Challenges</h4>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                        {activityProgress.pronunciation.map((p: any, i: number) => (
                          <div key={i} className="p-2.5 bg-bg-secondary/40 border border-border/80 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", p.is_done ? "bg-success" : "bg-warning")} />
                              <span className="font-bold text-text truncate">{p.word || p.phrase || `Challenge #${i + 1}`}</span>
                            </div>
                            {p.score != null && <span className="text-text-muted shrink-0">{p.score}%</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </DialogModal>
  );
}

function StudentSubmissionsSection({ submissions }: { submissions: any[] }) {
  const [filter, setFilter] = useState<'all' | 'grammar' | 'vocabulary' | 'listening' | 'reading' | 'simulations' | 'games' | 'news'>('all');

  const filtered = submissions.filter(s => {
    if (filter === 'all') return true;
    const cat = strNormalize(s.category || s.activity_type);
    if (filter === 'vocabulary') return cat === 'vocab' || cat === 'vocabulary';
    if (filter === 'listening') return cat === 'listening' || cat === 'listenings' || cat === 'podcast' || cat === 'podcasts';
    if (filter === 'simulations') return cat === 'simulation' || cat === 'simulations';
    if (filter === 'games') return cat === 'game' || cat === 'games';
    if (filter === 'news') return cat === 'news' || cat === 'article' || cat === 'articles';
    return cat === filter;
  });

  function strNormalize(val: any): string {
    return String(val || '').toLowerCase().trim();
  }

  const tabs: Array<{ id: typeof filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'grammar', label: 'Grammar' },
    { id: 'vocabulary', label: 'Vocab' },
    { id: 'listening', label: 'Listening' },
    { id: 'reading', label: 'Reading' },
    { id: 'simulations', label: 'Simulations' },
    { id: 'games', label: 'Games' },
    { id: 'news', label: 'News' }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-widest">Completed Activities & Exercises</h4>
        <span className="text-[0.6rem] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
          {filtered.length} found
        </span>
      </div>

      {/* Sub-tabs inside progress modal */}
      <div className="flex bg-bg-secondary p-0.5 rounded-lg overflow-x-auto no-scrollbar gap-0.5 max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-2.5 py-1 rounded text-[0.6rem] font-bold transition-all whitespace-nowrap",
              filter === tab.id ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-xs text-text-muted">No completed items in this category.</p>
        ) : (
          filtered.map((s: any) => (
            <div key={s.id} className="p-3 bg-bg-secondary/40 border border-border/80 rounded-xl flex items-center justify-between text-xs hover:border-primary/20 transition-all">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-text truncate max-w-[260px]">
                    {s.title && s.title.includes('') ? s.title.replace(/-/g, '–') : (s.title || 'Exercise')}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="px-1.5 py-0.2 bg-primary/5 border border-primary/10 text-primary rounded text-[0.5rem] font-bold uppercase tracking-wider">
                      {s.category || 'general'}
                    </span>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[0.55rem] text-text-muted hover:text-primary hover:underline truncate max-w-[150px]"
                      >
                        {s.url.includes('test-english.com') ? 'test-english.com' : new URL(s.url).hostname}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                {s.score != null && (
                  <span className="font-extrabold text-success bg-success/15 px-2 py-0.5 rounded text-[0.65rem]">
                    {s.score}%
                  </span>
                )}
                <span className="text-[0.6rem] text-text-muted capitalize">
                  {s.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
