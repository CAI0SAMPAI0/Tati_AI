'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiUpload, apiDelete } from '@/lib/api/client';
import { 
  Search, 
  Send, 
  FileText, 
  HelpCircle, 
  X, 
  Users, 
  UploadCloud,
  FileCheck,
  Trash2,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Student {
  username: string;
  name?: string;
  level?: string;
  email: string;
}

interface Quiz {
  id: string;
  title: string;
  level?: string;
}

export function DispatchSection() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'file' | 'quiz' | 'history'>('file');
  const queryClient = useQueryClient();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  // Selected Students
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);

  // Dispatch States
  const [files, setFiles] = useState<File[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);

  // AI Quiz Generator States
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLevel, setAiLevel] = useState('B1');
  const [aiNumQuestions, setAiNumQuestions] = useState(5);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['admin-dispatch-students'],
    queryFn: () => apiGet<Student[]>('/dashboard/students'),
    refetchInterval: 10000, // Refetch silently every 10 seconds to keep emails/whatsapp numbers updated
  });

  const { data: quizzes, isLoading: loadingQuizzes, refetch: refetchQuizzes } = useQuery<Quiz[]>({
    queryKey: ['admin-dispatch-quizzes'],
    queryFn: () => apiGet<Quiz[]>('/dashboard/quizzes'),
    enabled: activeTab === 'quiz',
    refetchInterval: 10000, // Refetch silently every 10 seconds
  });

  const { data: dispatchedFiles = [], isLoading: loadingFiles } = useQuery<any[]>({
    queryKey: ['admin-dispatched-files'],
    queryFn: () => apiGet<any[]>('/dashboard/dispatched-files'),
    enabled: activeTab === 'history',
    refetchInterval: activeTab === 'history' ? 15000 : false,
  });

  const handleDeleteFile = async (username: string, filename: string) => {
    const key = `${username}::${filename}`;
    setIsDeletingFile(key);
    try {
      const res = await apiDelete(`/dashboard/dispatch-file/${encodeURIComponent(username)}/${encodeURIComponent(filename)}`);
      if ((res as any).ok !== false) {
        toast.success('File deleted successfully.');
        queryClient.invalidateQueries({ queryKey: ['admin-dispatched-files'] });
      } else {
        toast.error('Failed to delete file.');
      }
    } catch {
      toast.error('Error deleting file.');
    } finally {
      setIsDeletingFile(null);
    }
  };

  // Filter students list based on search and level
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => {
      const matchesSearch = 
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.username || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = 
        levelFilter === 'ALL' || 
        (s.level || '').toUpperCase() === levelFilter.toUpperCase();
      return matchesSearch && matchesLevel;
    });
  }, [students, searchQuery, levelFilter]);

  // Select all handler
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsernames(filteredStudents.map(s => s.username));
    } else {
      setSelectedUsernames([]);
    }
  };

  const handleToggleStudent = (username: string) => {
    setSelectedUsernames(prev => 
      prev.includes(username) 
        ? prev.filter(u => u !== username) 
        : [...prev, username]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const handleGenerateQuizAI = async () => {
    if (!aiTopic.trim()) {
      toast.error('Please enter a topic for the quiz.');
      return;
    }

    setIsGeneratingQuiz(true);
    const toastId = toast.loading('Generating quiz with AI...');

    try {
      const res = await apiPost<{ success: boolean; quiz_id: string; title: string; detail?: string }>(
        '/dashboard/generate-quiz-ai',
        {
          topic: aiTopic,
          num_questions: aiNumQuestions,
          level: aiLevel,
        }
      );

      if (res.ok && res.data.success) {
        toast.success(`Quiz "${res.data.title}" generated successfully!`, { id: toastId });
        await refetchQuizzes();
        setSelectedQuizId(res.data.quiz_id);
        setAiTopic('');
        setShowAiForm(false);
      } else {
        toast.error(res.data.detail || 'Error generating quiz.', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate quiz.', { id: toastId });
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSend = async () => {
    if (selectedUsernames.length === 0) {
      toast.error('Please select at least one student.');
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('Sending materials and notifications...');

    try {
      if (activeTab === 'file') {
        if (files.length === 0) {
          toast.error('Please select a file to send.', { id: toastId });
          setIsSending(false);
          return;
        }

        const formData = new FormData();
        files.forEach(f => {
          formData.append('files', f);
        });
        formData.append('student_usernames', JSON.stringify(selectedUsernames));
        if (customMessage.trim()) {
          formData.append('message', customMessage.trim());
        }

        const res = await apiUpload<{ success: boolean; detail?: string; dispatched_to?: number }>(
          '/dashboard/dispatch-file',
          formData
        );

        if (res.ok && res.data.success) {
          toast.success(`Materials successfully sent to ${res.data.dispatched_to} student(s)!`, { id: toastId });
          setFiles([]);
          setCustomMessage('');
          setSelectedUsernames([]);
        } else {
          toast.error(res.data.detail || 'Error sending materials.', { id: toastId });
        }
      } else {
        if (!selectedQuizId) {
          toast.error('Please select a quiz to send.', { id: toastId });
          setIsSending(false);
          return;
        }

        const res = await apiPost<{ success: boolean; detail?: string; dispatched_to?: number }>(
          '/dashboard/dispatch-quiz',
          {
            quiz_id: selectedQuizId,
            student_usernames: selectedUsernames,
          }
        );

        if (res.ok && res.data.success) {
          toast.success(`Quiz successfully dispatched to ${res.data.dispatched_to} student(s)!`, { id: toastId });
          setSelectedQuizId('');
          setSelectedUsernames([]);
        } else {
          toast.error(res.data.detail || 'Error dispatching quiz.', { id: toastId });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Connection failure with the server.', { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const levels = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full max-h-[80vh] overflow-hidden">
      {/* Column 1 & 2: Students Selection */}
      <div className="lg:col-span-2 bg-surface border border-border rounded-2xl flex flex-col h-[70vh] overflow-hidden shadow-sm">
        {/* Topbar: Search & Filters */}
        <div className="p-5 border-b border-border space-y-4 shrink-0 bg-surface/50 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span>Select Students</span>
              {selectedUsernames.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">
                  {selectedUsernames.length} selected
                </span>
              )}
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input 
                type="text"
                placeholder="Search by name or @username..."
                className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-bold whitespace-nowrap">CEFR Level:</span>
              <div className="flex bg-bg border border-border rounded-xl p-0.5 gap-0.5">
                {levels.map(l => (
                  <button
                    key={l}
                    onClick={() => setLevelFilter(l)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      levelFilter === l 
                        ? 'bg-primary text-white shadow-sm' 
                        : 'text-text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Students List Table */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 custom-scrollbar">
          {loadingStudents ? (
            <div className="h-full flex items-center justify-center text-text-muted text-sm gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>Loading students...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-muted opacity-55">
              <Users size={40} className="mb-2 text-text-subtle" />
              <p className="text-sm">No students found for the active filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-secondary/50 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-5 py-3.5 w-12">
                    <input 
                      type="checkbox"
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      checked={filteredStudents.length > 0 && selectedUsernames.length === filteredStudents.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Level</th>
                  <th className="px-5 py-3.5">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((s) => {
                  const isChecked = selectedUsernames.includes(s.username);
                  return (
                    <tr 
                      key={s.username}
                      onClick={() => handleToggleStudent(s.username)}
                      className={`hover:bg-bg-secondary/30 transition-colors cursor-pointer group ${isChecked ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                          checked={isChecked}
                          onChange={() => handleToggleStudent(s.username)}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {(s.name || s.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-text group-hover:text-primary transition-colors truncate">
                              {s.name || s.username}
                            </div>
                            <div className="text-[0.7rem] text-text-muted">
                              @{s.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full bg-surface-hover border border-border text-text-subtle uppercase tracking-wider">
                          {s.level || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-text-muted truncate">
                        {s.email}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Column 3: Dispatch Panel */}
      <div className="bg-surface border border-border rounded-2xl flex flex-col h-[70vh] overflow-hidden shadow-sm">
        {/* Type Selector */}
        <div className="flex border-b border-border bg-surface/50 shrink-0">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'file' 
                ? 'border-primary text-primary bg-primary/5' 
                : 'border-transparent text-text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <FileText size={16} />
            <span>Send Material</span>
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'quiz' 
                ? 'border-primary text-primary bg-primary/5' 
                : 'border-transparent text-text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <HelpCircle size={16} />
            <span>Send Quiz</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-muted hover:text-text hover:bg-surface-hover'
            }`}
          >
            <History size={16} />
            <span>Sent Files</span>
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {activeTab === 'history' ? (
              <div className="space-y-3">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wider">
                  Files Sent to Students
                </div>
                {loadingFiles ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted py-8 justify-center">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    Loading...
                  </div>
                ) : dispatchedFiles.length === 0 ? (
                  <div className="py-12 text-center text-text-muted text-sm border border-dashed border-border rounded-2xl">
                    No files sent yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {dispatchedFiles.map((f: any, i: number) => {
                      const key = `${f.username}::${f.filename}`;
                      const isDeleting = isDeletingFile === key;
                      const dateStr = f.date_received
                        ? new Date(f.date_received).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '';
                      return (
                        <div key={i} className="bg-bg border border-border rounded-xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text truncate">{f.filename}</p>
                            <p className="text-[0.65rem] text-text-muted">@{f.username} · {dateStr}</p>
                            {f.message && <p className="text-[0.6rem] text-primary italic truncate">"{f.message}"</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {f.url && (
                              <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors" title="Open file">
                                <FileText size={13} />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteFile(f.username, f.filename)}
                              disabled={isDeleting}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-colors disabled:opacity-40"
                              title="Delete"
                            >
                              {isDeleting ? (
                                <div className="w-3 h-3 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'file' ? (
              <div className="space-y-4">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wider leading-relaxed">
                  Upload Pedagogical Files (PDF, Docs, Images)
                </div>

                <label className="border-2 border-dashed border-border hover:border-primary/50 dark:hover:border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all bg-bg-secondary/20 hover:bg-primary/5">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange}
                    multiple
                  />
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud size={24} />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-primary hover:underline">Choose files</span>
                    <p className="text-xs text-text-muted mt-1">PDF, DOCX, PNG or JPG up to 15MB each</p>
                  </div>
                </label>

                {files.length > 0 && (
                  <div className="space-y-2 max-h-[20vh] overflow-y-auto pr-1 custom-scrollbar">
                    {files.map((file, idx) => (
                      <div key={idx} className="bg-bg border border-border p-3 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                            <FileCheck size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-text truncate">{file.name}</p>
                            <p className="text-[0.65rem] text-text-muted font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 hover:bg-surface-hover rounded-lg text-text-subtle transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-bold text-text-subtle">Personalized Message (Optional):</label>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Write a message to send along with the files..."
                    className="w-full min-h-[80px] p-3 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-text resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-text-muted font-medium uppercase tracking-wider leading-relaxed">
                    Select a quiz registered on the platform
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAiForm(prev => !prev)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    {showAiForm ? 'Select Quiz' : '✨ Generate with AI'}
                  </button>
                </div>

                {!showAiForm ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-text-subtle">Available Quizzes:</label>
                    {loadingQuizzes ? (
                      <div className="h-10 bg-bg border border-border rounded-xl flex items-center px-3 text-xs text-text-muted gap-2">
                        <div className="w-3.5 h-3.5 border border-primary/30 border-t-primary rounded-full animate-spin" />
                        <span>Fetching quizzes...</span>
                      </div>
                    ) : (
                      <select
                        className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-text"
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                      >
                        <option value="">Select a quiz...</option>
                        {quizzes?.map(q => (
                          <option key={q.id} value={q.id}>
                            [{q.level || '—'}] {q.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="bg-bg-secondary/20 border border-border p-4 rounded-2xl space-y-4 animate-fade-in">
                    <div className="text-xs font-bold text-primary">✨ AI Quiz Generator</div>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-text-subtle">Topic / Theme:</label>
                      <input
                        type="text"
                        placeholder="e.g., Present Perfect vs Past Simple"
                        className="w-full px-3.5 py-2 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-text font-medium"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-text-subtle">Level:</label>
                        <select
                          className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-text font-medium"
                          value={aiLevel}
                          onChange={(e) => setAiLevel(e.target.value)}
                        >
                          <option value="A1">A1 - Beginner</option>
                          <option value="A2">A2 - Elementary</option>
                          <option value="B1">B1 - Intermediate</option>
                          <option value="B2">B2 - Upper Intermediate</option>
                          <option value="C1">C1 - Advanced</option>
                          <option value="C2">C2 - Mastery</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-text-subtle">Questions:</label>
                        <select
                          className="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-text font-medium"
                          value={aiNumQuestions}
                          onChange={(e) => setAiNumQuestions(Number(e.target.value))}
                        >
                          <option value={3}>3 Questions</option>
                          <option value={5}>5 Questions</option>
                          <option value={10}>10 Questions</option>
                          <option value={15}>15 Questions</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isGeneratingQuiz || !aiTopic.trim()}
                      onClick={handleGenerateQuizAI}
                      className="w-full py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all disabled:opacity-40"
                    >
                      {isGeneratingQuiz ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <span>Generate Quiz</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeTab !== 'history' && (
          <div className="border-t border-border pt-5 mt-6 space-y-4 bg-surface shrink-0">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 text-xs text-primary leading-relaxed">
              💡 <strong>Notification Rule:</strong> Emails with the attached materials will be sent to the selected students' inbox, accompanied by a mobile push notification.
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || selectedUsernames.length === 0 || (activeTab === 'file' ? files.length === 0 : !selectedQuizId)}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending materials...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Send to {selectedUsernames.length} student(s)</span>
                </>
              )}
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
