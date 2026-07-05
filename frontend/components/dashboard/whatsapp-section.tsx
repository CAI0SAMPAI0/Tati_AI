'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Power, CheckCircle, AlertCircle, QrCode, Loader2 } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { apiGet, apiPost, API_BASE } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';
import { useAuth } from '@/providers/auth-provider';

interface SessionData {
  name: string;
  status: string;
  engine: string;
}

export function WhatsappSection() {
  const { user } = useAuth();
  const sessionName = user?.username || 'default';
  
  const [qrBlobUrl, setQrBlobUrl] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [isStartingOrStopping, setIsStartingOrStopping] = useState(false);

  // Consulta status das sessões do WAHA
  const { data: sessions, isLoading, refetch, isRefetching } = useQuery<SessionData[]>({
    queryKey: ['waha-sessions'],
    queryFn: () => apiGet<SessionData[]>('/dashboard/waha/sessions'),
    refetchInterval: (query) => {
      const data = query.state.data;
      const mySession = data?.find(s => s.name === sessionName);
      const status = mySession ? mySession.status : 'DISCONNECTED';
      if (status === 'WORKING') {
        return 60000; // Poll every 60s when connected to avoid waking up Railway
      }
      if (status === 'DISCONNECTED') {
        return 30000; // Poll every 30s when disconnected
      }
      return 5000; // Poll every 5s during setup/scan phases
    },
  });

  const mySession = sessions?.find(s => s.name === sessionName);
  const sessionStatus = mySession ? mySession.status : 'DISCONNECTED';

  // Carrega QR Code via fetch para passar header Authorization
  const loadQrCode = async () => {
    if (sessionStatus !== 'SCAN_QR_CODE') return;
    setLoadingQr(true);
    try {
      const response = await fetch(`${API_BASE}/dashboard/waha/session/qr?session=${sessionName}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (response.ok) {
        const blob = await response.blob();
        if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
        setQrBlobUrl(URL.createObjectURL(blob));
      } else {
        setQrBlobUrl('');
      }
    } catch (e) {
      console.error('[WAHA] Error loading QR code:', e);
    } finally {
      setLoadingQr(false);
    }
  };



  useEffect(() => {
    if (sessionStatus === 'SCAN_QR_CODE') {
      loadQrCode();
    } else {
      setQrBlobUrl('');
    }
  }, [sessionStatus]);

  const handleStartSession = async () => {
    setIsStartingOrStopping(true);
    const toastId = toast.loading('Initializing WAHA session...');
    try {
      const res = await apiPost<any>('/dashboard/waha/session/start', {});
      if (res.ok) {
        toast.success('Session started! Waiting for QR code...', { id: toastId });
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

  const handleStopSession = async () => {
    if (!confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    setIsStartingOrStopping(true);
    const toastId = toast.loading('Stopping WAHA session...');
    try {
      const res = await apiPost<any>('/dashboard/waha/session/stop', {});
      if (res.ok) {
        toast.success('Session stopped successfully.', { id: toastId });
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
            Waiting for QR Code (SCAN_QR_CODE)
          </span>
        );
      case 'STARTING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Loader2 size={14} className="animate-spin" />
            Starting... (STARTING)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-danger/10 text-danger border border-danger/20">
            <AlertCircle size={14} />
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaWhatsapp size={20} className="text-primary" />
            <div>
              <h2 className="font-bold text-sm uppercase tracking-wider text-text">WhatsApp Session (WAHA)</h2>
              <p className="text-xs text-text-muted">Manage the WhatsApp connection for notification delivery</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="p-2 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Status Card */}
        <div className="p-6 md:p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-bg-secondary/40 border border-border/50 rounded-2xl">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-text-subtle">Active Session</p>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-text">@{sessionName}</span>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-text-muted max-w-md">
                This session will be used to send notifications via WhatsApp. In production, use the corresponding session for Teacher Tatiana. In development, use it for local testing.
              </p>
            </div>
            
            <div className="flex gap-3">
              {sessionStatus === 'DISCONNECTED' ? (
                <Button
                  onClick={handleStartSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-primary text-white"
                >
                  <Power size={16} />
                  Start Session
                </Button>
              ) : (
                <Button
                  onClick={handleStopSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-[#8A0303] hover:bg-[#6b0202] text-white border-none shadow-sm"
                >
                  <Power size={16} />
                  Disconnect Session
                </Button>
              )}
            </div>
          </div>

          {/* QR Code Scan Area */}
          {sessionStatus === 'SCAN_QR_CODE' && (
            <div className="flex flex-col items-center p-8 bg-bg border border-border rounded-2xl text-center space-y-6">
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-black text-text flex items-center justify-center gap-2">
                  <QrCode size={20} className="text-primary" />
                  Scan the QR Code
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Open WhatsApp on your phone, go to <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong> and scan the code below.
                </p>
              </div>

              <div className="relative w-64 h-64 bg-white p-4 border border-border rounded-2xl flex items-center justify-center shadow-lg shadow-black/5">
                {loadingQr ? (
                  <Spinner size="md" />
                ) : qrBlobUrl ? (
                  <img src={qrBlobUrl} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-text-muted mb-3">Error loading QR code or expired.</p>
                    <Button onClick={loadQrCode} variant="secondary" className="text-[0.7rem] px-3 py-1.5 h-auto">
                      Reload QR
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}


          )}
        </div>
      </div>
    </div>
  );
}
