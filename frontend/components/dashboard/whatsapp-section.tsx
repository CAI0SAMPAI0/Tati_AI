'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Power, CheckCircle, AlertCircle, QrCode, Loader2, RotateCw } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { apiGet, apiPost, API_BASE } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';
import { useAuth } from '@/providers/auth-provider';

interface SessionData {
  name: string;
  status: string;
  engine?: string;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
}

export function WhatsappSection() {
  const { user } = useAuth();
  
  // Define a sessão padrão com base no perfil do usuário
  const defaultSession = useMemo(() => {
    const role = user?.role?.toLowerCase();
    const uname = user?.username?.toLowerCase();
    if (role === 'professor' || uname === 'professor') return 'professor';
    if (role === 'programador' || uname === 'programador') return 'programador';
    return user?.username || 'programador';
  }, [user]);

  const [activeSession, setActiveSession] = useState<string>(defaultSession);
  const [qrBlobUrl, setQrBlobUrl] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isStartingOrStopping, setIsStartingOrStopping] = useState(false);

  useEffect(() => {
    if (defaultSession && !activeSession) {
      setActiveSession(defaultSession);
    }
  }, [defaultSession, activeSession]);

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

  // Carrega QR Code via fetch para passar header Authorization e evitar cache
  const loadQrCode = useCallback(async (isSilent = false) => {
    if (!isSilent && !qrBlobUrl) setLoadingQr(true);
    try {
      const response = await fetch(`${API_BASE}/dashboard/waha/session/qr?session=${activeSession}&t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
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
          setQrError('QR code expired or empty.');
        }
      } else {
        setQrError('QR code expired or session timed out.');
      }
    } catch (e) {
      console.error('[WAHA] Error loading QR code:', e);
      setQrError('Connection error loading QR.');
    } finally {
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

  const getStatusBadge = () => {
    switch (sessionStatus) {
      case 'WORKING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle size={14} />
            Conectado (WORKING)
          </span>
        );
      case 'SCAN_QR_CODE':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
            <QrCode size={14} />
            Aguardando Leitura (SCAN_QR_CODE)
          </span>
        );
      case 'STARTING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Loader2 size={14} className="animate-spin" />
            Iniciando... (STARTING)
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <AlertCircle size={14} />
            QR Expirado (FAILED)
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-danger/10 text-danger border border-danger/20">
            <AlertCircle size={14} />
            Desconectado ({sessionStatus || 'STOPPED'})
          </span>
        );
    }
  };

  // Lista de sessões conhecidas
  const sessionList = useMemo(() => {
    const defaultList = ['programador', 'professor'];
    if (sessions) {
      sessions.forEach(s => {
        if (!defaultList.includes(s.name)) {
          defaultList.push(s.name);
        }
      });
    }
    return defaultList;
  }, [sessions]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FaWhatsapp size={22} className="text-emerald-500" />
            <div>
              <h2 className="font-bold text-sm uppercase tracking-wider text-text">Sessões WhatsApp (WAHA)</h2>
              <p className="text-xs text-text-muted">Gerencie a conexão do WhatsApp para disparo de notificações e lembretes</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="p-2 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors"
            title="Atualizar status"
          >
            <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Session Selector Tabs */}
        <div className="px-6 pt-6 pb-2 border-b border-border/50 bg-bg-secondary/10 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-2">Sessão:</span>
          {sessionList.map((name) => {
            const sData = sessions?.find(s => s.name === name);
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
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-surface border-border hover:border-primary/40 text-text-muted hover:text-text'
                }`}
              >
                <span className="capitalize">@{name}</span>
                {name === 'professor' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                    Produção
                  </span>
                )}
                {name === 'programador' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    Dev / Testes
                  </span>
                )}
                {/* Status indicator dot */}
                <span
                  className={`w-2 h-2 rounded-full ${
                    isWorking
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

        {/* Status Card */}
        <div className="p-6 md:p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-bg-secondary/40 border border-border/50 rounded-2xl">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-text-subtle">Sessão Selecionada</p>
                {activeSession === 'professor' && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Sessão Oficial (Tatiana)
                  </span>
                )}
                {activeSession === 'programador' && (
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                    Sessão Desenvolvedor (Caio)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xl font-black text-text">@{activeSession}</span>
                {getStatusBadge()}
              </div>

              {/* Detalhes de quem está logado se estiver WORKING */}
              {currentSessionData?.me && currentSessionData.status === 'WORKING' && (
                <div className="text-xs text-text-muted bg-surface/60 p-2.5 rounded-xl border border-border/50 space-y-0.5">
                  <div className="font-semibold text-text">
                    📱 WhatsApp Conectado: <span className="text-emerald-500 font-bold">{currentSessionData.me.pushName || 'WhatsApp'}</span>
                  </div>
                  {currentSessionData.me.id && (
                    <div className="text-[11px] text-text-subtle font-mono">
                      ID: {currentSessionData.me.id}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-text-muted max-w-lg leading-relaxed">
                {activeSession === 'professor'
                  ? 'Esta sessão é a conexão principal da Professora Tatiana no Render. É utilizada pelo cron de notificações agendadas para disparar avisos e flashcards a todos os alunos.'
                  : 'Sessão exclusiva para o desenvolvedor testar disparos e integrações. Dispara apenas para o número configurado do desenvolvedor.'}
              </p>
            </div>

            {/* Ações da Sessão */}
            <div className="flex flex-col sm:flex-row gap-3">
              {sessionStatus === 'FAILED' && (
                <Button
                  onClick={handleRestartSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-primary text-white shadow-sm hover:brightness-105"
                >
                  <RotateCw size={16} className={isStartingOrStopping ? 'animate-spin' : ''} />
                  Reiniciar e Gerar Novo QR
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
                    Renovar QR Code
                  </Button>
                  <Button
                    onClick={handleStopSession}
                    disabled={isStartingOrStopping}
                    variant="secondary"
                    className="gap-2 font-bold px-4 py-2.5 rounded-xl text-danger border-danger/20 hover:bg-danger/10"
                  >
                    <Power size={16} />
                    Cancelar
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
                  Desconectar Sessão
                </Button>
              )}

              {(sessionStatus === 'DISCONNECTED' || sessionStatus === 'STOPPED') && (
                <Button
                  onClick={handleStartSession}
                  disabled={isStartingOrStopping}
                  className="gap-2 font-bold px-6 py-2.5 rounded-xl bg-primary text-white shadow-sm"
                >
                  <Power size={16} />
                  Iniciar Sessão
                </Button>
              )}
            </div>
          </div>

          {/* Banner de Sessão FAILED */}
          {sessionStatus === 'FAILED' && (
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-text">O QR Code expirou por inatividade</h4>
                  <p className="text-xs text-text-muted mt-0.5">
                    O WhatsApp encerra o pareamento se nenhum aparelho escanear dentro do tempo limite. Clique em reiniciar para gerar um código novo em folha.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRestartSession}
                disabled={isStartingOrStopping}
                className="gap-2 font-bold px-5 py-2 rounded-xl bg-primary text-white shrink-0"
              >
                <RotateCw size={14} className={isStartingOrStopping ? 'animate-spin' : ''} />
                Gerar Novo Código
              </Button>
            </div>
          )}

          {/* QR Code Scan Area */}
          {sessionStatus === 'SCAN_QR_CODE' && (
            <div className="flex flex-col items-center p-8 bg-bg border border-border rounded-2xl text-center space-y-6">
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-black text-text flex items-center justify-center gap-2">
                  <QrCode size={20} className="text-primary" />
                  Escanear QR Code no WhatsApp
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Abra o WhatsApp no seu celular, acesse <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar um aparelho</strong> e aponte para a imagem abaixo.
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-bold border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Atualização em tempo real ativa (renovado a cada 4s)
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
                      {qrError || 'Carregando novo código...'}
                    </p>
                    <Button onClick={() => handleRestartSession()} variant="secondary" className="text-[0.7rem] px-3 py-1.5 h-auto gap-1">
                      <RotateCw size={12} />
                      Gerar Novo QR Code
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-text-subtle max-w-xs">
                Não saia desta tela até escanear. Assim que a conexão for concluída, o status mudará automaticamente para <strong>Conectado</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
