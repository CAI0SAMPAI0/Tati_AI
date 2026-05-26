'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, BookOpen, PenTool, Check, Trash2, Edit2, Play, Sparkles, RefreshCw, X, Save } from 'lucide-react';
import { apiUpload, apiPost, apiGet, apiPut, apiDelete } from '@/lib/api/client';

export function CefrSection() {
  const [activeTab, setActiveTab] = useState<'generator' | 'review'>('generator');
  
  // Tab Generator state
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{success: boolean; message: string} | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [resultType, setResultType] = useState<'flashcards'|'exercises'|null>(null);

  // Tab Review state
  const [pendingFlashcards, setPendingFlashcards] = useState<any[]>([]);
  const [pendingExercises, setPendingExercises] = useState<any[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [triggeringScheduler, setTriggeringScheduler] = useState(false);
  const [schedulerMessage, setSchedulerMessage] = useState<string | null>(null);

  // Editing state
  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(null);
  const [editFlashcardData, setEditFlashcardData] = useState<any>(null);
  
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExerciseData, setEditExerciseData] = useState<any>(null);

  const fetchPending = async () => {
    setIsLoadingPending(true);
    try {
      const res = await apiGet<any>('/cefr/admin/pending');
      if (res.success) {
        setPendingFlashcards(res.flashcards || []);
        setPendingExercises(res.exercises || []);
      }
    } catch (err) {
      console.error('Error fetching pending items:', err);
    } finally {
      setIsLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'review') {
      fetchPending();
    }
  }, [activeTab]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await apiUpload<{success: boolean; message: string; chunks_indexed: number}>(
        `/cefr/admin/upload-material?level=${level}`, 
        formData
      );
      
      if (res.ok) {
        setUploadStatus({
          success: true, 
          message: `${res.data.message} (${res.data.chunks_indexed} chunks indexed)`
        });
        setFile(null);
      } else {
        setUploadStatus({success: false, message: 'Upload failed'});
      }
    } catch (err: any) {
      setUploadStatus({success: false, message: err.message || 'Error uploading file'});
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async (type: 'flashcards' | 'exercises') => {
    if (!topic.trim()) return;
    setGenerating(true);
    setResultType(type);
    setResults([]);
    
    try {
      const endpoint = type === 'flashcards' 
        ? `/cefr/admin/generate-flashcards?level=${level}&topic=${encodeURIComponent(topic)}&count=5`
        : `/cefr/admin/generate-exercises?level=${level}&topic=${encodeURIComponent(topic)}&count=3`;
        
      const res = await apiPost<{success: boolean; data: any[]}>(endpoint, null);
      
      if (res.ok && res.data.success) {
        setResults(res.data.data);
      } else {
        alert('Failed to generate content');
      }
    } catch (err: any) {
      alert(err.message || 'Error generating content');
    } finally {
      setGenerating(false);
    }
  };

  // Trigger Scheduler
  const handleTriggerScheduler = async () => {
    setTriggeringScheduler(true);
    setSchedulerMessage(null);
    try {
      const res = await apiPost<any>('/cefr/admin/trigger-scheduler', null);
      if (res.ok) {
        setSchedulerMessage('Weekly generator triggered successfully! Wait a few seconds for LLM generation...');
        setTimeout(() => {
          fetchPending();
          setSchedulerMessage(null);
        }, 6000);
      } else {
        setSchedulerMessage('Failed to trigger scheduler.');
      }
    } catch (err: any) {
      setSchedulerMessage(err.message || 'Error triggering scheduler.');
    } finally {
      setTriggeringScheduler(false);
    }
  };

  // Action: Publish Flashcard
  const handlePublishFlashcard = async (id: string, updatedData?: any) => {
    try {
      const payload = updatedData ? { ...updatedData, is_published: true } : { is_published: true };
      const res = await apiPut<any>(`/cefr/admin/flashcards/${id}`, payload);
      if (res.ok) {
        setPendingFlashcards(prev => prev.filter(item => item.id !== id));
        if (editingFlashcardId === id) setEditingFlashcardId(null);
      } else {
        alert('Failed to publish flashcard.');
      }
    } catch (err: any) {
      alert(err.message || 'Error publishing flashcard.');
    }
  };

  // Action: Delete Flashcard
  const handleDeleteFlashcard = async (id: string) => {
    if (!confirm('Are you sure you want to reject and delete this flashcard?')) return;
    try {
      const res = await apiDelete(`/cefr/admin/flashcards/${id}`);
      if (res.ok) {
        setPendingFlashcards(prev => prev.filter(item => item.id !== id));
        if (editingFlashcardId === id) setEditingFlashcardId(null);
      } else {
        alert('Failed to delete flashcard.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting flashcard.');
    }
  };

  // Action: Save Flashcard changes
  const handleSaveFlashcard = async (id: string) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/flashcards/${id}`, editFlashcardData);
      if (res.ok) {
        setPendingFlashcards(prev => prev.map(item => item.id === id ? { ...item, ...editFlashcardData } : item));
        setEditingFlashcardId(null);
      } else {
        alert('Failed to save flashcard.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving flashcard.');
    }
  };

  // Action: Publish Exercise
  const handlePublishExercise = async (id: string, updatedData?: any) => {
    try {
      const payload = updatedData ? { ...updatedData, is_published: true } : { is_published: true };
      const res = await apiPut<any>(`/cefr/admin/exercises/${id}`, payload);
      if (res.ok) {
        setPendingExercises(prev => prev.filter(item => item.id !== id));
        if (editingExerciseId === id) setEditingExerciseId(null);
      } else {
        alert('Failed to publish exercise.');
      }
    } catch (err: any) {
      alert(err.message || 'Error publishing exercise.');
    }
  };

  // Action: Delete Exercise
  const handleDeleteExercise = async (id: string) => {
    if (!confirm('Are you sure you want to reject and delete this exercise?')) return;
    try {
      const res = await apiDelete(`/cefr/admin/exercises/${id}`);
      if (res.ok) {
        setPendingExercises(prev => prev.filter(item => item.id !== id));
        if (editingExerciseId === id) setEditingExerciseId(null);
      } else {
        alert('Failed to delete exercise.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting exercise.');
    }
  };

  // Action: Save Exercise changes
  const handleSaveExercise = async (id: string) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/exercises/${id}`, editExerciseData);
      if (res.ok) {
        setPendingExercises(prev => prev.map(item => item.id === id ? { ...item, ...editExerciseData } : item));
        setEditingExerciseId(null);
      } else {
        alert('Failed to save exercise.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving exercise.');
    }
  };

  const startEditFlashcard = (card: any) => {
    setEditingFlashcardId(card.id);
    setEditFlashcardData({
      front: card.front,
      back: card.back,
      explanation: card.explanation || '',
      topic: card.topic || '',
      level: card.level
    });
  };

  const startEditExercise = (ex: any) => {
    setEditingExerciseId(ex.id);
    setEditExerciseData({
      question: ex.question,
      options: [...(ex.options || [])],
      correct_index: ex.correct_index,
      explanation: ex.explanation || '',
      topic: ex.topic || '',
      level: ex.level
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tabs Menu */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('generator')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'generator'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Upload size={16} />
          Upload & Manual Generator
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 relative ${
            activeTab === 'review'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text'
          }`}
        >
          <Sparkles size={16} />
          Pending Review
          {(pendingFlashcards.length + pendingExercises.length) > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
              {pendingFlashcards.length + pendingExercises.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'generator' ? (
        <>
          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
              <Upload size={24} className="text-primary" />
              Upload CEFR Diagnostic PDF
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Target Level</label>
                <select 
                  value={level} 
                  onChange={e => setLevel(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-subtle">Diagnostic PDF File</label>
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={e => {
                        const selectedFile = e.target.files?.[0] || null;
                        setFile(selectedFile);
                        if (selectedFile) {
                          const match = selectedFile.name.match(/(A1|A2|B1|B2|C1|C2)/i);
                          if (match) {
                            setLevel(match[1].toUpperCase());
                          }
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full border border-border rounded-xl bg-surface-hover flex items-center px-3 py-2 gap-3 overflow-hidden">
                      <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-bold shrink-0">
                        Choose File
                      </div>
                      <span className="text-sm text-text-muted font-medium truncate flex-1">
                        {file ? file.name : "No file chosen"}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Upload
                  </button>
                </div>
              </div>
            </div>

            {uploadStatus && (
              <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${uploadStatus.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                {uploadStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {uploadStatus.message}
              </div>
            )}
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
              <BookOpen size={24} className="text-primary" />
              Generate Content from PDFs
            </h2>
            
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-sm font-bold text-text-subtle">Topic / Situation</label>
                <input 
                  type="text" 
                  placeholder="e.g. Shopping at the supermarket"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              
              <button 
                onClick={() => handleGenerate('flashcards')}
                disabled={!topic.trim() || generating}
                className="px-6 py-3 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {generating && resultType === 'flashcards' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Generate Flashcards
              </button>

              <button 
                onClick={() => handleGenerate('exercises')}
                disabled={!topic.trim() || generating}
                className="px-6 py-3 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {generating && resultType === 'exercises' ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                Generate Exercises
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="bg-surface border border-border p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-text mb-4">
                Generated {resultType === 'flashcards' ? 'Flashcards' : 'Exercises'}
                <span className="ml-3 text-xs font-normal text-text-muted bg-bg-secondary px-3 py-1 rounded-full">
                  Automatically saved to database
                </span>
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                {resultType === 'flashcards' && results.map((card, i) => (
                  <div key={i} className="p-4 border border-border bg-bg rounded-xl flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="text-xs font-bold text-text-muted uppercase">Front (English)</div>
                      <div className="text-sm font-medium text-text bg-surface p-3 rounded-lg border border-border/50">{card.front}</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="text-xs font-bold text-text-muted uppercase">Back (Translation)</div>
                      <div className="text-sm font-medium text-text bg-surface p-3 rounded-lg border border-border/50">{card.back}</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="text-xs font-bold text-text-muted uppercase">Explanation</div>
                      <div className="text-xs text-text-muted bg-surface p-3 rounded-lg border border-border/50 h-full">{card.explanation}</div>
                    </div>
                  </div>
                ))}

                {resultType === 'exercises' && results.map((ex, i) => (
                  <div key={i} className="p-4 border border-border bg-bg rounded-xl space-y-4">
                    <div className="font-bold text-text text-sm">
                      <span className="text-primary mr-2">Q{i + 1}.</span>
                      {ex.question}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {ex.options?.map((opt: string, idx: number) => (
                        <div 
                          key={idx} 
                          className={`p-3 text-sm rounded-lg border ${idx === ex.correct_index ? 'bg-green-500/10 border-green-500/50 text-green-500 font-bold' : 'bg-surface border-border/50 text-text-muted'}`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs text-text-subtle">
                      <span className="font-bold text-primary mr-2">Explanation:</span>
                      {ex.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tab Pending Review */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-surface border border-border p-5 rounded-2xl gap-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-text">Review Weekly AI Materials</h2>
              <p className="text-xs text-text-muted">Review, edit, and publish activities generated automatically by the robot scheduler.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={fetchPending}
                disabled={isLoadingPending}
                className="p-3 bg-surface border border-border text-text hover:bg-surface-hover rounded-xl font-bold text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
                title="Refresh pending items"
              >
                <RefreshCw size={16} className={isLoadingPending ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                onClick={handleTriggerScheduler}
                disabled={triggeringScheduler}
                className="px-5 py-3 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-sm disabled:opacity-50 transition-colors flex items-center gap-2 shadow-glow"
              >
                {triggeringScheduler ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                Trigger Weekly Generator
              </button>
            </div>
          </div>

          {schedulerMessage && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3 text-sm font-medium text-primary animate-pulse">
              <Sparkles size={18} />
              {schedulerMessage}
            </div>
          )}

          {isLoadingPending ? (
            <div className="flex flex-col items-center justify-center p-12 bg-surface border border-border rounded-2xl gap-4">
              <Loader2 size={36} className="text-primary animate-spin" />
              <p className="text-sm text-text-muted">Fetching materials from queue...</p>
            </div>
          ) : (pendingFlashcards.length === 0 && pendingExercises.length === 0) ? (
            <div className="text-center p-12 bg-surface border border-border rounded-2xl space-y-3">
              <CheckCircle2 size={48} className="text-green-500 mx-auto" />
              <h3 className="font-bold text-lg text-text">All Clean!</h3>
              <p className="text-sm text-text-muted max-w-md mx-auto">No pending materials to review. Everything generated has been published or reviewed!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Flashcards Queue */}
              {pendingFlashcards.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-text flex items-center gap-2 uppercase tracking-wider text-indigo-500">
                    <FileText size={18} />
                    Pending Flashcards ({pendingFlashcards.length})
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {pendingFlashcards.map(card => (
                      <div key={card.id} className="bg-surface border border-border p-5 rounded-2xl shadow-sm hover:border-border/80 transition-all space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold px-3 py-1 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-full">
                              {card.level}
                            </span>
                            <span className="text-xs text-text-muted font-bold truncate max-w-xs md:max-w-md">
                              Topic: {card.topic || 'General'}
                            </span>
                          </div>
                          
                          {/* Item Actions */}
                          <div className="flex items-center gap-2">
                            {editingFlashcardId === card.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveFlashcard(card.id)}
                                  className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Save size={14} /> Save
                                </button>
                                <button
                                  onClick={() => setEditingFlashcardId(null)}
                                  className="p-2 bg-surface-hover text-text-muted hover:text-text rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditFlashcard(card)}
                                  className="p-2 bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Edit2 size={14} /> Edit
                                </button>
                                <button
                                  onClick={() => handlePublishFlashcard(card.id)}
                                  className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Check size={14} /> Publish
                                </button>
                                <button
                                  onClick={() => handleDeleteFlashcard(card.id)}
                                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Trash2 size={14} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingFlashcardId === card.id ? (
                          /* Edit Card Form */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Front (English)</label>
                              <input 
                                type="text"
                                value={editFlashcardData.front}
                                onChange={e => setEditFlashcardData({...editFlashcardData, front: e.target.value})}
                                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Back (Translation)</label>
                              <input 
                                type="text"
                                value={editFlashcardData.back}
                                onChange={e => setEditFlashcardData({...editFlashcardData, back: e.target.value})}
                                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Explanation</label>
                              <textarea 
                                value={editFlashcardData.explanation}
                                onChange={e => setEditFlashcardData({...editFlashcardData, explanation: e.target.value})}
                                rows={2}
                                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Read Mode Card */
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 border border-border bg-bg/50 rounded-xl space-y-1">
                              <span className="text-[10px] font-black text-text-muted uppercase">Front</span>
                              <p className="text-sm font-semibold text-text">{card.front}</p>
                            </div>
                            <div className="p-3 border border-border bg-bg/50 rounded-xl space-y-1">
                              <span className="text-[10px] font-black text-text-muted uppercase">Back</span>
                              <p className="text-sm font-semibold text-text">{card.back}</p>
                            </div>
                            {card.explanation && (
                              <div className="md:col-span-2 p-3 border border-border bg-bg/30 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-text-muted uppercase">Explanation</span>
                                <p className="text-xs text-text-subtle leading-relaxed">{card.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises Queue */}
              {pendingExercises.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-text flex items-center gap-2 uppercase tracking-wider text-orange-500">
                    <PenTool size={18} />
                    Pending Exercises ({pendingExercises.length})
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {pendingExercises.map(ex => (
                      <div key={ex.id} className="bg-surface border border-border p-5 rounded-2xl shadow-sm hover:border-border/80 transition-all space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold px-3 py-1 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-full">
                              {ex.level}
                            </span>
                            <span className="text-xs text-text-muted font-bold truncate max-w-xs md:max-w-md">
                              Topic: {ex.topic || 'General'}
                            </span>
                          </div>
                          
                          {/* Item Actions */}
                          <div className="flex items-center gap-2">
                            {editingExerciseId === ex.id ? (
                              <>
                                <button
                                  onClick={() => handleSaveExercise(ex.id)}
                                  className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Save size={14} /> Save
                                </button>
                                <button
                                  onClick={() => setEditingExerciseId(null)}
                                  className="p-2 bg-surface-hover text-text-muted hover:text-text rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditExercise(ex)}
                                  className="p-2 bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Edit2 size={14} /> Edit
                                </button>
                                <button
                                  onClick={() => handlePublishExercise(ex.id)}
                                  className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Check size={14} /> Publish
                                </button>
                                <button
                                  onClick={() => handleDeleteExercise(ex.id)}
                                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                >
                                  <Trash2 size={14} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingExerciseId === ex.id ? (
                          /* Edit Exercise Form */
                          <div className="space-y-3 pt-2">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Question</label>
                              <input 
                                type="text"
                                value={editExerciseData.question}
                                onChange={e => setEditExerciseData({...editExerciseData, question: e.target.value})}
                                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Options (Select the correct option with the checkbox)</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {editExerciseData.options.map((opt: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-3 bg-bg border border-border rounded-xl px-3 py-2">
                                    <input 
                                      type="radio" 
                                      name={`correct_idx_${ex.id}`}
                                      checked={editExerciseData.correct_index === idx}
                                      onChange={() => setEditExerciseData({...editExerciseData, correct_index: idx})}
                                      className="h-4 w-4 text-primary focus:ring-primary/20 border-border"
                                    />
                                    <input 
                                      type="text"
                                      value={opt}
                                      onChange={e => {
                                        const newOpts = [...editExerciseData.options];
                                        newOpts[idx] = e.target.value;
                                        setEditExerciseData({...editExerciseData, options: newOpts});
                                      }}
                                      className="flex-1 bg-transparent border-none p-0 text-sm text-text outline-none focus:ring-0"
                                      placeholder={`Option ${idx + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-bold text-text-subtle uppercase">Explanation</label>
                              <textarea 
                                value={editExerciseData.explanation}
                                onChange={e => setEditExerciseData({...editExerciseData, explanation: e.target.value})}
                                rows={2}
                                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Read Mode Exercise */
                          <div className="space-y-4">
                            <p className="text-sm font-semibold text-text leading-relaxed">
                              {ex.question}
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {ex.options?.map((opt: string, idx: number) => (
                                <div 
                                  key={idx} 
                                  className={`p-3 text-sm rounded-xl border flex items-center justify-between ${idx === ex.correct_index ? 'bg-green-500/10 border-green-500/30 text-green-500 font-bold' : 'bg-bg/50 border-border/80 text-text-muted'}`}
                                >
                                  <span>{opt}</span>
                                  {idx === ex.correct_index && (
                                    <Check size={14} className="text-green-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {ex.explanation && (
                              <div className="p-3 border border-border bg-bg/30 rounded-xl space-y-1">
                                <span className="text-[10px] font-black text-text-muted uppercase">Explanation</span>
                                <p className="text-xs text-text-subtle leading-relaxed">{ex.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
