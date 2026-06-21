'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { 
  Search, 
  Send, 
  FileText, 
  HelpCircle, 
  Check, 
  X, 
  Users, 
  UploadCloud,
  FileCheck
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
  const [activeTab, setActiveTab] = useState<'file' | 'quiz'>('file');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');

  // Selected Students
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);

  // Dispatch States
  const [file, setFile] = useState<File | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  // Queries
  const { data: students, isLoading: loadingStudents } = useQuery<Student[]>({
    queryKey: ['admin-dispatch-students'],
    queryFn: () => apiGet<Student[]>('/dashboard/students'),
  });

  const { data: quizzes, isLoading: loadingQuizzes } = useQuery<Quiz[]>({
    queryKey: ['admin-dispatch-quizzes'],
    queryFn: () => apiGet<Quiz[]>('/dashboard/quizzes'),
    enabled: activeTab === 'quiz',
  });

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
      setFile(e.target.files[0]);
    }
  };

  const handleSend = async () => {
    if (selectedUsernames.length === 0) {
      toast.error('Selecione pelo menos um aluno.');
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('Enviando materiais e notificações...');

    try {
      if (activeTab === 'file') {
        if (!file) {
          toast.error('Selecione um arquivo para enviar.', { id: toastId });
          setIsSending(false);
          return;
        }

        // Send file via Multipart Form Data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('student_usernames', JSON.stringify(selectedUsernames));

        const token = typeof window !== 'undefined' ? localStorage.getItem('tati_token') : null;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/dashboard/dispatch-file`, {
          method: 'POST',
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(`Arquivo enviado com sucesso para ${data.dispatched_to} aluno(s)!`, { id: toastId });
          setFile(null);
          setSelectedUsernames([]);
        } else {
          toast.error(data.detail || 'Erro ao enviar arquivo.', { id: toastId });
        }
      } else {
        if (!selectedQuizId) {
          toast.error('Selecione um quiz para enviar.', { id: toastId });
          setIsSending(false);
          return;
        }

        // Send quiz alert
        const token = typeof window !== 'undefined' ? localStorage.getItem('tati_token') : null;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/dashboard/dispatch-quiz`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            quiz_id: selectedQuizId,
            student_usernames: selectedUsernames,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(`Quiz disparado com sucesso para ${data.dispatched_to} aluno(s)!`, { id: toastId });
          setSelectedQuizId('');
          setSelectedUsernames([]);
        } else {
          toast.error(data.detail || 'Erro ao disparar quiz.', { id: toastId });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha de conexão com o servidor.', { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const levels = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full max-h-[80vh] overflow-hidden">
      {/* Coluna 1 & 2: Seleção de Alunos */}
      <div className="lg:col-span-2 bg-surface border border-border rounded-2xl flex flex-col h-[70vh] overflow-hidden shadow-sm">
        {/* Topbar: Busca e Filtros */}
        <div className="p-5 border-b border-border space-y-4 shrink-0 bg-surface/50 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-text flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span>Selecionar Alunos</span>
              {selectedUsernames.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">
                  {selectedUsernames.length} selecionado(s)
                </span>
              )}
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input 
                type="text"
                placeholder="Buscar por nome ou @username..."
                className="w-full pl-10 pr-4 py-2 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-bold whitespace-nowrap">Nível CEFR:</span>
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

        {/* Lista de Alunos com Checkboxes */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 custom-scrollbar">
          {loadingStudents ? (
            <div className="h-full flex items-center justify-center text-text-muted text-sm gap-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span>Carregando alunos...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-muted opacity-55">
              <Users size={40} className="mb-2 text-text-subtle" />
              <p className="text-sm">Nenhum aluno encontrado para os filtros ativos.</p>
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
                  <th className="px-5 py-3.5">Nome</th>
                  <th className="px-5 py-3.5">Nível</th>
                  <th className="px-5 py-3.5">E-mail</th>
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

      {/* Coluna 3: Painel de Envio */}
      <div className="bg-surface border border-border rounded-2xl flex flex-col h-[70vh] overflow-hidden shadow-sm">
        {/* Seletor de Tipo */}
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
            <span>Enviar Material</span>
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
            <span>Enviar Quiz</span>
          </button>
        </div>

        {/* Conteúdo do Painel */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {activeTab === 'file' ? (
              <div className="space-y-4">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wider leading-relaxed">
                  Upload de Arquivos Pedagógicos (PDF, Docs, Imagens)
                </div>

                <label className="border-2 border-dashed border-border hover:border-primary/50 dark:hover:border-primary/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group transition-all bg-bg-secondary/20 hover:bg-primary/5">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud size={24} />
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-primary hover:underline">Escolha um arquivo</span>
                    <p className="text-xs text-text-muted mt-1">PDF, DOCX, PNG ou JPG de até 15MB</p>
                  </div>
                </label>

                {file && (
                  <div className="bg-bg border border-border p-4 rounded-xl flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                        <FileCheck size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text truncate">{file.name}</p>
                        <p className="text-[0.65rem] text-text-muted font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setFile(null)}
                      className="p-1.5 hover:bg-surface-hover rounded-lg text-text-subtle transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-text-muted font-medium uppercase tracking-wider leading-relaxed">
                  Selecione um quiz cadastrado na plataforma
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-subtle">Quiz Disponíveis:</label>
                  {loadingQuizzes ? (
                    <div className="h-10 bg-bg border border-border rounded-xl flex items-center px-3 text-xs text-text-muted gap-2">
                      <div className="w-3.5 h-3.5 border border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span>Buscando quizzes...</span>
                    </div>
                  ) : (
                    <select
                      className="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-text"
                      value={selectedQuizId}
                      onChange={(e) => setSelectedQuizId(e.target.value)}
                    >
                      <option value="">Selecione um quiz...</option>
                      {quizzes?.map(q => (
                        <option key={q.id} value={q.id}>
                          [{q.level || '—'}] {q.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rodapé de Ação */}
          <div className="border-t border-border pt-5 mt-6 space-y-4 bg-surface shrink-0">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 text-xs text-primary leading-relaxed">
              💡 <strong>Regra de Notificação:</strong> Os e-mails contendo os materiais anexados chegarão na caixa de entrada dos alunos selecionados, acompanhados de uma notificação push no celular.
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || selectedUsernames.length === 0 || (activeTab === 'file' ? !file : !selectedQuizId)}
              className="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Disparando materiais...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Enviar para {selectedUsernames.length} aluno(s)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
