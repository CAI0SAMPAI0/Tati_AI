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
  Clock
} from 'lucide-react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { apiPut, apiPost, apiDelete, apiGet } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { cn, formatTime, formatDateTime } from '@/lib/utils/index';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onUpdate: () => void;
}

export function StudentModal({ isOpen, onClose, student, onUpdate }: StudentModalProps) {
  
  const [activeTab, setActiveTab] = useState<'info' | 'prompt' | 'insight' | 'interests'>('info');
  const [localStudent, setLocalStudent] = useState(student);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingInterests, setIsAnalyzingInterests] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [promptText, setPromptText] = useState(student?.custom_prompt || '');
  const lang = 'en-US';

  // Reset local state when student changes
  useEffect(() => {
    setLocalStudent(student);
    setPromptText(student?.custom_prompt || '');
    setInsight(null);
    setInterests([]);
    setRecommendations([]);
  }, [student]);

  if (!localStudent) return null;

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
      toast.success('Saved successfully!');
    } catch (err) {
      toast.error('Error. Please try again.');
    } finally {
      setIsAnalyzingInterests(false);
    }
  };

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

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-surface border border-border rounded-xl">
                  <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">{'Msgs'}</span>
                  <p className="text-lg font-bold text-text">{localStudent.total_messages || 0}</p>
                </div>
                <div className="p-3 bg-surface border border-border rounded-xl">
                  <span className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">{'Level'}</span>
                  <p className="text-lg font-bold text-primary">{localStudent.level || '—'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">{'Level'}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Beginner', 'Pre-Intermediate', 'Intermediate', 'Advanced', 'Business'].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => handleUpdateLevel(lvl)}
                      className={cn(
                        "px-2 py-2 rounded-lg text-[0.65rem] font-bold border transition-all",
                        localStudent.level === lvl ? "bg-primary border-primary text-white" : "border-border hover:border-primary/40 text-text-subtle"
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
                    {isAnalyzingInterests ? '⏳ Analyzing...' : 'Analyze Interests'}
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
        </div>
      </div>
    </DialogModal>
  );
}
