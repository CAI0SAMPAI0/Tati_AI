'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Power,
  CheckCircle,
  AlertCircle,
  QrCode,
  Loader2,
  RotateCw,
  Search,
  Phone,
  Check,
  X,
  Edit2,
  Send,
  Bell,
  BellOff,
  UserCheck,
  Users,
  Flame,
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { apiGet, apiPost, apiFetch, apiPut } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';

interface SessionData {
  name: string;
  status: string;
  engine?: string;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
}

interface StudentWhatsAppData {
  username: string;
  name: string;
  email: string;
  role: string;
  level: string;
  streak_count: number;
  total_xp: number;
  whatsapp_number: string;
  formatted_phone: string;
  allow_whatsapp_notifications: boolean;
  whatsapp_status: 'active' | 'missing' | 'disabled';
}

interface WhatsAppStudentsResponse {
  students: StudentWhatsAppData[];
  total_students: number;
  active_count: number;
  missing_count: number;
  disabled_count: number;
}

export function WhatsappSection() {
  // Conexão oficial da Taty's Hubana (sessão 'professor')
  const [activeSession, setActiveSession] = useState<string>('professor');
  const [qrBlobUrl, setQrBlobUrl] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isStartingOrStopping, setIsStartingOrStopping] = useState(false);
  const isFetchingQrRef = useRef(false);

  // Student WhatsApp Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'missing' | 'disabled'>('all');
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [inputNumber, setInputNumber] = useState('');
  const [savingStudent, setSavingStudent] = useState<string | null>(null);
  const [testingStudent, setTestingStudent] = useState<string | null>(null);

  // Consulta status das sessões do WAHA com polling adaptativo
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery<SessionData[]>({
    queryKey: ['waha-sessions'],
    queryFn: () => apiGet<SessionData[]>('/dashboard/waha/sessions'),
    refetchInterval: (query) => {
      const data = query.state.data;
      const current = data?.find(s => s.name === activeSession);
      const status = current ? current.status : 'DISCONNECTED';
      if (status === 'WORKING') {
        return 30000;
      }
      if (status === 'DISCONNECTED' || status === 'STOPPED') {
        return 20000;
      }
      return 3000;
    },
  });

  const currentSessionData = sessions?.find(s => s.name === activeSession);
  const sessionStatus = currentSessionData ? currentSessionData.status : 'DISCONNECTED';

  // Carrega QR Code via apiFetch (resolve path sem double-slash e injeta Bearer token automaticamente)
  const loadQrCode = useCallback(async (isSilent = false) => {
    if (isFetchingQrRef.current) return;
    isFetchingQrRef.current = true;
    if (!isSilent && !qrBlobUrl) setLoadingQr(true);
    try {
      const sessionParam = encodeURIComponent(activeSession || 'professor');
      const response = await apiFetch(`/dashboard/waha/session/qr?session=${sessionParam}&t=${Date.now()}`, {
        headers: {
          Accept: 'image/png, image/*',
        },
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 100) {
          const newUrl = URL.createObjectURL(blob);
          setQrBlobUrl((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return newUrl;
          });
          setQrError(null);
        } else {
          setQrError('Generating QR code... Please wait a moment.');
        }
      } else if (response.status === 404) {
        setQrError('Generating QR code... Please wait a moment.');
      } else {
        setQrError('QR code expired or session timed out.');
      }
    } catch (e) {
      console.error('[WAHA] Error loading QR code:', e);
      setQrError('Connection error loading QR.');
    } finally {
      isFetchingQrRef.current = false;
      if (!isSilent) setLoadingQr(false);
    }
  }, [activeSession, qrBlobUrl]);

  // Auto-refresh do QR Code enquanto em SCAN_QR_CODE (a cada 4s para nunca expirar na tela)
  useEffect(() => {
    if (sessionStatus === 'SCAN_QR_CODE') {
      loadQrCode();
      const timer = setInterval(() => {
        loadQrCode(true);
      }, 4000);
      return () => clearInterval(timer);
    } else {
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl);
        setQrBlobUrl('');
      }
      setQrError(null);
    }
  }, [sessionStatus, activeSession]);

  const handleStartSession = async () => {
    setIsStartingOrStopping(true);
    const toastId = toast.loading(`Starting WAHA session @${activeSession}...`);
    try {
      const res = await apiPost<any>('/dashboard/waha/session/start', { session: activeSession });
      if (res.ok) {
        toast.success('Session started! Preparing QR code...', { id: toastId });
        await refetch();
      } else {
        toast.error('Error starting session.', { id: toastId });
      }
    } catch (e) {
      toast.error('Failed to communicate with the server.', { id: toastId });
    } finally {
      setIsStartingOrStopping(false);
    }
  };

  const handleRestartSession = async () => {
    setIsStartingOrStopping(true);
    const toastId = toast.loading(`Restarting session @${activeSession} to generate fresh QR...`);
    try {
      const res = await apiPost<any>('/dashboard/waha/session/restart', { session: activeSession });
      if (res.ok) {
        toast.success('Session restarted! Generating new QR Code...', { id: toastId });
        setQrBlobUrl('');
        setQrError(null);
        await refetch();
      } else {
        toast.error('Error restarting session.', { id: toastId });
      }
    } catch (e) {
      toast.error('Failed to communicate with the server.', { id: toastId });
    } finally {
      setIsStartingOrStopping(false);
    }
  };

  const handleStopSession = async () => {
    if (!confirm(`Are you sure you want to disconnect session @${activeSession}?`)) return;
    setIsStartingOrStopping(true);
    const toastId = toast.loading(`Stopping session @${activeSession}...`);
    try {
      const res = await apiPost<any>('/dashboard/waha/session/stop', { session: activeSession });
      if (res.ok) {
        toast.success('Session disconnected successfully.', { id: toastId });
        setQrBlobUrl('');
        await refetch();
      } else {
        toast.error('Error stopping session.', { id: toastId });
      }
    } catch (e) {
      toast.error('Failed to communicate with the server.', { id: toastId });
    } finally {
      setIsStartingOrStopping(false);
    }
  };

  // Consulta lista de alunos e status do WhatsApp
  const {
    data: studentsData,
    isLoading: loadingStudents,
    refetch: refetchStudents,
    isRefetching: isRefetchingStudents,
  } = useQuery<WhatsAppStudentsResponse>({
    queryKey: ['whatsapp-students', searchTerm, statusFilter],
    queryFn: () =>
      apiGet<WhatsAppStudentsResponse>(
        `/dashboard/whatsapp/students?search=${encodeURIComponent(searchTerm)}&status=${statusFilter}`
      ),
  });

  const handleStartEdit = (student: StudentWhatsAppData) => {
    setEditingUsername(student.username);
    setInputNumber(student.whatsapp_number || '');
  };

  const handleCancelEdit = () => {
    setEditingUsername(null);
    setInputNumber('');
  };

  const handleSaveNumber = async (username: string, allow: boolean) => {
    setSavingStudent(username);
    try {
      const res = await apiPut<any>(`/dashboard/whatsapp/students/${encodeURIComponent(username)}`, {
        whatsapp_number: inputNumber,
        allow_whatsapp_notifications: allow,
      });
      if (res.ok) {
        toast.success(`WhatsApp phone for @${username} updated successfully!`);
        setEditingUsername(null);
        setInputNumber('');
        await refetchStudents();
      } else {
        toast.error((res.data as any)?.detail || 'Failed to save phone number.');
      }
    } catch {
      toast.error('Failed to communicate with the server.');
    } finally {
      setSavingStudent(null);
    }
  };

  const handleToggleNotifications = async (student: StudentWhatsAppData) => {
    const newStatus = !student.allow_whatsapp_notifications;
    setSavingStudent(student.username);
    try {
      const res = await apiPut<any>(`/dashboard/whatsapp/students/${encodeURIComponent(student.username)}`, {
        whatsapp_number: student.whatsapp_number,
        allow_whatsapp_notifications: newStatus,
      });
      if (res.ok) {
        toast.success(
          newStatus
            ? `Notifications enabled for @${student.username}!`
            : `Notifications disabled for @${student.username}.`
        );
        await refetchStudents();
      } else {
        toast.error((res.data as any)?.detail || 'Failed to update notification settings.');
      }
    } catch {
      toast.error('Failed to communicate with the server.');
    } finally {
      setSavingStudent(null);
    }
  };

  const handleSendTestMessage = async (student: StudentWhatsAppData) => {
    if (sessionStatus !== 'WORKING') {
      toast.error('The official WhatsApp session (@professor) must be connected in WORKING status to dispatch messages.');
      return;
    }
    if (!student.whatsapp_number) {
      toast.error('Student has no WhatsApp phone number registered. Please add a phone number first.');
      return;
    }

    setTestingStudent(student.username);
    const toastId = toast.loading(`Sending test message to @${student.username}...`);
    try {
      const res = await apiPost<any>(`/dashboard/whatsapp/students/${encodeURIComponent(student.username)}/test`, {});
      if (res.ok) {
        toast.success(res.data?.message || 'Test message sent successfully!', { id: toastId });
      } else {
        toast.error((res.data as any)?.detail || 'Failed to send test message.', { id: toastId });
      }
    } catch {
      toast.error('Communication error while sending test message.', { id: toastId });
    } finally {
      setTestingStudent(null);
    }
  };

  const getStatusBadge = () => {
    switch (sessionStatus) {
      case 'WORKING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle size={14} />
            Connected (WORKING)
          </span>
        );
      case 'SCAN_QR_CODE':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
            <QrCode size={14} />
            Waiting for Scan (SCAN_QR_CODE)
          </span>
        );
      case 'STARTING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Loader2 size={14} className="animate-spin" />
            Starting... (STARTING)
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle size={14} />
            QR Expired (FAILED)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-danger/10 text-danger border border-danger/20">
            <AlertCircle size={14} />
            Disconnected ({sessionStatus || 'STOPPED'})
          </span>
        );
    }
  };

  // Known sessions list (apenas sessão oficial da Taty's Hubana)
  const sessionList = useMemo(() => {
    const defaultList = ['professor'];
    if (sessions) {
      sessions.forEach((s) => {
        if (s.name !== 'programador' && !defaultList.includes(s.name)) {
          defaultList.push(s.name);
        }
      });
    }
    return defaultList;
  }, [sessions]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* WAHA Session Connection Card */}
      <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FaWhatsapp size={22} />
            </div>
            <div>
              <h2 className="font-bold text-sm uppercase tracking-wider text-text">WhatsApp Connection (WAHA)</h2>
              <p className="text-xs text-text-muted">Official Taty's Hubana connection for automated streak reminders and student notifications</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="p-2 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors"
            title="Refresh status"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Session Selector (if multiple sessions exist) */}
        {sessionList.length > 1 && (
          <div className="px-6 pt-6 pb-2 border-b border-border/50 bg-bg-secondary/10 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-2">Session:</span>
            {sessionList.map((name) => {
              const sData = sessions?.find((s) => s.name === name);
              const isWorking = sData?.status === 'WORKING';
              const isScan = sData?.status === 'SCAN_QR_CODE';
              const isSelected = activeSession === name;

              return (
                <button
                  key={name}
                  onClick={() => {
                    setActiveSession(name);
                    setQrBlobUrl('');
                    setQrError(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSelected
                      ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                      : 'bg-surface border-border hover:border-primary/40 text-text-muted hover:text-text'
                    }`}
                >
                  <span className="capitalize">@{name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${isWorking
                        ? 'bg-emerald-400 animate-pulse'
                        : isScan
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-neutral-400'
                      }`}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Status Card */}
        <div className="p-6 md:p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-bg-secondary/40 border border-border/50 rounded-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-subtle">Active Session</p>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Taty's Hubana (Production)
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xl font-black text-text">@{activeSession}</span>
                {getStatusBadge()}
              </div>

              {/* Logged in user info if WORKING */}
              {currentSessionData?.me && currentSessionData.status === 'WORKING' && (
                <div className="text-xs text-text-muted bg-surface/60 p-2.5 rounded-xl border border-border/50 space-y-0.5">
                  <div className="font-semibold text-text">
                    📱 WhatsApp Connected: <span className="text-emerald-500 font-bold">{currentSessionData.me.pushName || 'Taty's Hubana'}</span>
                  </div>
                  {currentSessionData.me.id && (
                    <div className="text-[11px] text-text-subtle font-mono">
                      ID: {currentSessionData.me.id}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-text-muted max-w-lg leading-relaxed">
                Taty's Hubana&apos;s connection on Render (WAHA). Utilized by automated background tasks to dispatch daily streak alerts, weekly progress reports, and personalized encouragement to all students with a configured phone number.
              </p>
            </div>

            {/* Session Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {sessionStatus === 'FAILED' && (
                <Button
                  onClick={handleRestartSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-primary text-white shadow-sm hover:brightness-105"
                >
                  <RotateCw size={16} className={isStartingOrStopping ? 'animate-spin' : ''} />
                  Restart & Generate New QR
                </Button>
              )}

              {sessionStatus === 'SCAN_QR_CODE' && (
                <>
                  <Button
                    onClick={handleRestartSession}
                    disabled={isStartingOrStopping}
                    variant="secondary"
                    className="gap-2 font-bold px-4 py-2.5 rounded-xl border-border hover:bg-surface-hover text-text"
                  >
                    <RotateCw size={16} className={isStartingOrStopping ? 'animate-spin' : ''} />
                    Refresh QR Code
                  </Button>
                  <Button
                    onClick={handleStopSession}
                    disabled={isStartingOrStopping}
                    variant="secondary"
                    className="gap-2 font-bold px-4 py-2.5 rounded-xl text-danger border-danger/20 hover:bg-danger/10"
                  >
                    <Power size={16} />
                    Cancel
                  </Button>
                </>
              )}

              {sessionStatus === 'WORKING' && (
                <Button
                  onClick={handleStopSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-[#8A0303] hover:bg-[#6b0202] text-white border-none shadow-sm"
                >
                  <Power size={16} />
                  Disconnect Session
                </Button>
              )}

              {(sessionStatus === 'DISCONNECTED' || sessionStatus === 'STOPPED') && (
                <Button
                  onClick={handleStartSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-primary text-white shadow-sm"
                >
                  <Power size={16} />
                  Start Session
                </Button>
              )}
            </div>
          </div>

          {/* Banner for FAILED Session */}
          {sessionStatus === 'FAILED' && (
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-text">QR code expired due to inactivity</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    WhatsApp closes the pairing session if no device scans before timeout. Click restart to generate a fresh QR code.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRestartSession}
                disabled={isStartingOrStopping}
                className="gap-2 font-bold px-5 py-2 rounded-xl bg-primary text-white shrink-0"
              >
                <RotateCw size={14} className={isStartingOrStopping ? 'animate-spin' : ''} />
                Generate New QR Code
              </Button>
            </div>
          )}

          {/* QR Code Scan Area */}
          {sessionStatus === 'SCAN_QR_CODE' && (
            <div className="flex flex-col items-center p-8 bg-bg border border-border rounded-2xl text-center space-y-6">
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-black text-text flex items-center justify-center gap-2">
                  <QrCode size={20} className="text-primary" />
                  Scan WhatsApp QR Code
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Open WhatsApp on your phone, go to <strong>Linked Devices</strong> &gt; <strong>Link a device</strong>, and point your camera at the QR code below.
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-bold border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Real-time auto-refresh active (renewed every 4s)
                </div>
              </div>

              <div className="relative w-64 h-64 bg-white p-4 border border-border rounded-2xl flex items-center justify-center shadow-lg shadow-black/5">
                {loadingQr && !qrBlobUrl ? (
                  <Spinner size="md" />
                ) : qrBlobUrl ? (
                  <div className="relative w-full h-full">
                    <img src={qrBlobUrl} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="text-center p-4 space-y-3">
                    <p className="text-xs text-text-muted">
                      {qrError || 'QR code expired or session timed out.'}
                    </p>
                    <Button onClick={() => handleRestartSession()} variant="secondary" className="text-[0.7rem] px-3 py-1.5 h-auto gap-1">
                      <RotateCw size={12} />
                      Generate New QR Code
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-text-subtle max-w-xs">
                Please stay on this screen until scanned. Once pairing is complete, the status will automatically change to <strong>Connected</strong>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Student WhatsApp Management Card */}
      <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-border bg-bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Users size={22} />
            </div>
            <div>
              <h2 className="font-bold text-sm uppercase tracking-wider text-text">Student WhatsApp Notifications</h2>
              <p className="text-xs text-text-muted">
                Register and manage student phone numbers for automated daily streak reminders, weekly reports, and updates.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchStudents()}
            disabled={loadingStudents || isRefetchingStudents}
            className="self-start sm:self-auto p-2.5 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors flex items-center gap-2 text-xs font-semibold"
            title="Refresh student list"
          >
            <RefreshCw size={14} className={isRefetchingStudents ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="p-4 sm:p-6 border-b border-border/60 bg-bg-secondary/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Students</span>
            <div className="text-2xl font-black text-text mt-2">{studentsData?.total_students ?? 0}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active WhatsApp</span>
              <CheckCircle size={14} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-2">{studentsData?.active_count ?? 0}</div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Missing Phone</span>
              <AlertCircle size={14} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2">{studentsData?.missing_count ?? 0}</div>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Notif. Paused</span>
              <BellOff size={14} className="text-text-subtle" />
            </div>
            <div className="text-2xl font-black text-text-subtle mt-2">{studentsData?.disabled_count ?? 0}</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-4 sm:p-6 border-b border-border flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-bg-secondary/20">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <input
              type="text"
              placeholder="Search student by name, @username, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-surface border border-border text-xs text-text placeholder:text-text-subtle focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl overflow-x-auto max-w-full">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${statusFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
            >
              All ({studentsData?.total_students ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'active'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Active ({studentsData?.active_count ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('missing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'missing'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-amber-500 hover:bg-amber-500/10'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Missing ({studentsData?.missing_count ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('disabled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'disabled'
                  ? 'bg-zinc-600 text-white shadow-sm'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover'
                }`}
            >
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Disabled ({studentsData?.disabled_count ?? 0})
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div>
          {loadingStudents ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-text-muted">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="text-xs font-medium">Loading student list...</p>
            </div>
          ) : !studentsData?.students || studentsData.students.length === 0 ? (
            <div className="p-16 text-center text-text-muted space-y-2">
              <UserCheck size={36} className="mx-auto text-text-subtle opacity-40" />
              <p className="text-sm font-bold text-text">No students found</p>
              <p className="text-xs text-text-subtle">
                Try adjusting your search query or selected status filter.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List View (Visible on small screens) */}
              <div className="block md:hidden divide-y divide-border/60">
                {studentsData.students.map((student) => {
                  const isEditing = editingUsername === student.username;
                  const isSaving = savingStudent === student.username;
                  const isTesting = testingStudent === student.username;

                  return (
                    <div key={student.username} className="p-4 space-y-3 bg-surface hover:bg-bg-secondary/20 transition-colors">
                      {/* Top: Student Profile & Level */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase shrink-0">
                            {(student.name || student.username || '?').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-text truncate">
                              {student.name || student.username}
                            </div>
                            <div className="text-[11px] text-text-subtle truncate">
                              @{student.username} {student.email && `• ${student.email}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                            {student.level || 'A1'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            <Flame size={12} className="text-amber-500 fill-amber-500" />
                            {student.streak_count || 0}d
                          </span>
                        </div>
                      </div>

                      {/* Middle: Phone Number Input or Display */}
                      <div className="bg-bg-secondary/40 p-3 rounded-2xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-text-subtle block mb-1">
                            WhatsApp Phone
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={inputNumber}
                                onChange={(e) => setInputNumber(e.target.value)}
                                placeholder="e.g. 5511999999999"
                                className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-primary text-xs font-mono text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveNumber(student.username, student.allow_whatsapp_notifications);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleSaveNumber(student.username, student.allow_whatsapp_notifications)}
                                disabled={isSaving}
                                title="Save"
                                className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 shrink-0"
                              >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                title="Cancel"
                                className="p-1.5 rounded-lg border border-border text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {student.whatsapp_number ? (
                                <span className="font-mono text-xs font-bold text-text flex items-center gap-1.5">
                                  <Phone size={12} className="text-emerald-500" />
                                  {student.formatted_phone || student.whatsapp_number}
                                </span>
                              ) : (
                                <span className="text-xs text-text-subtle italic">Not configured</span>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(student)}
                            className="self-start sm:self-center px-2.5 py-1.5 rounded-xl bg-surface border border-border text-primary hover:bg-surface-hover transition-colors text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Edit2 size={12} />
                            <span>Edit Phone</span>
                          </button>
                        )}
                      </div>

                      {/* Bottom: Status Badges, Toggle & Send Test */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          {student.whatsapp_status === 'active' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle size={11} />
                              Active
                            </span>
                          )}
                          {student.whatsapp_status === 'missing' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <AlertCircle size={11} />
                              Missing
                            </span>
                          )}
                          {student.whatsapp_status === 'disabled' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                              <BellOff size={11} />
                              Disabled
                            </span>
                          )}

                          <button
                            onClick={() => handleToggleNotifications(student)}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${student.allow_whatsapp_notifications
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-surface text-text-subtle border-border'
                              }`}
                            title={student.allow_whatsapp_notifications ? 'Pause notifications' : 'Enable notifications'}
                          >
                            {student.allow_whatsapp_notifications ? (
                              <>
                                <Bell size={11} />
                                Enabled
                              </>
                            ) : (
                              <>
                                <BellOff size={11} />
                                Disabled
                              </>
                            )}
                          </button>
                        </div>

                        <Button
                          onClick={() => handleSendTestMessage(student)}
                          disabled={isTesting || sessionStatus !== 'WORKING' || !student.whatsapp_number}
                          variant="secondary"
                          className="text-xs px-3 py-1.5 h-auto rounded-xl gap-1.5 font-bold border-border hover:border-primary/40 disabled:opacity-40"
                        >
                          {isTesting ? (
                            <>
                              <Loader2 size={12} className="animate-spin text-primary" />
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <Send size={12} className="text-emerald-500" />
                              <span>Send Test</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (Visible on medium screens and larger) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[0.65rem] font-black text-text-subtle uppercase tracking-wider border-b border-border bg-bg-secondary/40">
                    <tr>
                      <th className="px-6 py-3.5">Student</th>
                      <th className="px-6 py-3.5">Level / Streak</th>
                      <th className="px-6 py-3.5">WhatsApp Phone</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Notifications</th>
                      <th className="px-6 py-3.5 text-right">Test Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {studentsData.students.map((student) => {
                      const isEditing = editingUsername === student.username;
                      const isSaving = savingStudent === student.username;
                      const isTesting = testingStudent === student.username;

                      return (
                        <tr key={student.username} className="hover:bg-bg-secondary/20 transition-colors">
                          {/* Student Info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase shrink-0">
                                {(student.name || student.username || '?').charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-text truncate">
                                  {student.name || student.username}
                                </div>
                                <div className="text-[11px] text-text-subtle truncate flex items-center gap-1.5">
                                  <span>@{student.username}</span>
                                  {student.email && <span>• {student.email}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Level & Streak */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                                {student.level || 'A1'}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                <Flame size={12} className="text-amber-500 fill-amber-500" />
                                {student.streak_count || 0}d
                              </span>
                            </div>
                          </td>

                          {/* WhatsApp Phone editable field */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={inputNumber}
                                  onChange={(e) => setInputNumber(e.target.value)}
                                  placeholder="e.g. 5511999999999"
                                  className="w-36 sm:w-44 px-2.5 py-1 rounded-lg bg-surface border border-primary text-xs font-mono text-text focus:outline-none focus:ring-1 focus:ring-primary"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveNumber(student.username, student.allow_whatsapp_notifications);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit();
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveNumber(student.username, student.allow_whatsapp_notifications)}
                                  disabled={isSaving}
                                  title="Save"
                                  className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
                                >
                                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={isSaving}
                                  title="Cancel"
                                  className="p-1.5 rounded-lg border border-border text-text-muted hover:bg-surface-hover transition-colors"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                {student.whatsapp_number ? (
                                  <span className="font-mono text-xs font-bold text-text flex items-center gap-1.5">
                                    <Phone size={12} className="text-emerald-500" />
                                    {student.formatted_phone || student.whatsapp_number}
                                  </span>
                                ) : (
                                  <span className="text-xs text-text-subtle italic">Not configured</span>
                                )}
                                <button
                                  onClick={() => handleStartEdit(student)}
                                  title="Edit phone"
                                  className="opacity-60 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-hover text-primary transition-all"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            {student.whatsapp_status === 'active' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <CheckCircle size={12} />
                                Active
                              </span>
                            )}
                            {student.whatsapp_status === 'missing' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <AlertCircle size={12} />
                                Missing
                              </span>
                            )}
                            {student.whatsapp_status === 'disabled' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                                <BellOff size={12} />
                                Disabled
                              </span>
                            )}
                          </td>

                          {/* Notifications Toggle */}
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleNotifications(student)}
                              disabled={isSaving}
                              title={
                                student.allow_whatsapp_notifications
                                  ? 'Click to pause automated WhatsApp messages for this student'
                                  : 'Click to enable automated WhatsApp messages for this student'
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold border transition-all ${student.allow_whatsapp_notifications
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-surface text-text-subtle border-border hover:text-text hover:bg-surface-hover'
                                }`}
                            >
                              {student.allow_whatsapp_notifications ? (
                                <>
                                  <Bell size={12} />
                                  Enabled
                                </>
                              ) : (
                                <>
                                  <BellOff size={12} />
                                  Disabled
                                </>
                              )}
                            </button>
                          </td>

                          {/* Test Action */}
                          <td className="px-6 py-4 text-right">
                            <Button
                              onClick={() => handleSendTestMessage(student)}
                              disabled={
                                isTesting ||
                                sessionStatus !== 'WORKING' ||
                                !student.whatsapp_number
                              }
                              variant="secondary"
                              className="text-xs px-3 py-1.5 h-auto rounded-xl gap-1.5 font-bold border-border hover:border-primary/40 disabled:opacity-40"
                              title={
                                sessionStatus !== 'WORKING'
                                  ? 'Connect WhatsApp session (@professor) before sending a test'
                                  : !student.whatsapp_number
                                    ? 'Add a phone number before sending a test message'
                                    : `Send test message to ${student.name || student.username}`
                              }
                            >
                              {isTesting ? (
                                <>
                                  <Loader2 size={12} className="animate-spin text-primary" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <Send size={12} className="text-emerald-500" />
                                  <span>Send Test</span>
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer info note */}
        <div className="p-4 border-t border-border bg-bg-secondary/30 text-[11px] text-text-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>
            💡 Tip: For Brazilian phone numbers, country code +55 is automatically applied if only DDD + number is provided (e.g. 11999999999).
          </span>
          <span className="font-semibold text-text-muted">
            Active dispatch session: <strong className="text-emerald-500">@{activeSession}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
