'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Sparkles, ShieldCheck, CheckCircle2, Smartphone, ExternalLink, Copy, Check, ArrowRight } from 'lucide-react';

const DIRECT_DOWNLOAD_URL = 'https://tati-ai.vercel.app/downloads/tati-ai.apk';

export default function AtualizarPage() {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [seconds, setSeconds] = useState(3);
  const [isAlreadyUpdated, setIsAlreadyUpdated] = useState(false);
  const [isOldApk, setIsOldApk] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Se o app já estiver na versão atualizada (versionCode >= 2), não precisa atualizar
    const code = typeof window !== 'undefined' ? (window as any).tatiAppVersionCode : null;
    if (code && Number(code) >= 2) {
      setIsAlreadyUpdated(true);
      const timer = setTimeout(() => {
        window.location.href = '/chat';
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Detecta se está dentro do WebView do APK antigo
    const isFlutter = typeof window !== 'undefined' && Boolean(
      (window as any).isFlutterApp || (window as any).flutter_inappwebview
    );
    if (isFlutter && (!code || Number(code) < 2)) {
      setIsOldApk(true);
      // No APK antigo, o WebView não suporta downloads automáticos em segundo plano.
      return;
    }

    // Contador regressivo para iniciar o download automaticamente (apenas no navegador padrão)
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerDownload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const triggerDownload = () => {
    setDownloadStarted(true);

    // 1. Se estiver no Flutter e tiver o handler nativo, abre direto no navegador externo
    try {
      if (typeof window !== 'undefined' && (window as any).flutter_inappwebview?.callHandler) {
        (window as any).flutter_inappwebview.callHandler('openExternalUrl', DIRECT_DOWNLOAD_URL);
      }
    } catch (_) {}

    // 2. Download direto no navegador padrão
    try {
      const a = document.createElement('a');
      a.href = DIRECT_DOWNLOAD_URL;
      a.download = 'tati-ai.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (_) {
      window.location.href = DIRECT_DOWNLOAD_URL;
    }
  };

  const handleOpenInChrome = async () => {
    // Sempre copia o link para a área de transferência primeiro
    if (typeof window !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(DIRECT_DOWNLOAD_URL);
        setCopied(true);
      } catch (_) {}
    }

    // Se navigator.share for suportado pelo Android, abre o menu nativo para escolher o Chrome
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Teacher Tatiana AI',
          text: 'Baixar atualização do aplicativo (APK)',
          url: DIRECT_DOWNLOAD_URL,
        });
        return;
      } catch (_) {}
    }

    // Fallback: se não tiver share, tenta disparar o download
    triggerDownload();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(DIRECT_DOWNLOAD_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (isAlreadyUpdated) {
    return (
      <main className="min-h-screen bg-[#f8f7fc] text-[#1a1826] flex flex-col items-center justify-center p-4 sm:p-6 relative">
        <div className="max-w-md w-full flex flex-col items-center text-center bg-white border border-[#e8e5f0] rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center text-[#059669] mb-5">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1826] mb-2">
            Aplicativo Atualizado!
          </h1>
          <p className="text-[#524f64] text-sm mb-6 leading-relaxed">
            Você já está utilizando a versão mais recente do <strong className="text-[#6d28d9]">Teacher Tatiana AI (v1.0.1)</strong>.
          </p>
          <Link
            href="/chat"
            className="w-full py-3 px-4 bg-[#6d28d9] hover:bg-[#5b21b6] transition-colors rounded-xl font-semibold text-white shadow-sm flex items-center justify-center gap-2 text-sm"
          >
            <span>Ir para o Aplicativo</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f7fc] text-[#1a1826] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full flex flex-col items-center text-center">
        {/* Logo / Badge */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-white border border-[#e8e5f0] p-1 shadow-sm flex items-center justify-center overflow-hidden">
            <Image
              src="/images/tati_logo.jpg"
              alt="Teacher Tatiana AI"
              width={72}
              height={72}
              className="object-contain rounded-xl"
              priority
            />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <Sparkles size={10} /> v1.0.1
          </div>
        </div>

        {/* Título & Status */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1a1826] mb-2">
          Atualização Disponível
        </h1>
        <p className="text-[#524f64] text-sm leading-relaxed mb-6">
          Uma nova versão do aplicativo <strong className="text-[#6d28d9]">Teacher Tatiana AI</strong> está disponível com melhorias essenciais e login Google corrigido.
        </p>

        {/* Card Principal de Download */}
        <div className="w-full bg-white border border-[#e8e5f0] rounded-2xl p-5 sm:p-6 shadow-sm mb-6 text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center text-[#6d28d9]">
                <Smartphone size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1a1826]">tati-ai.apk</h2>
                <span className="text-xs text-[#6b6880] font-medium">17.3 MB • Android Oficial</span>
              </div>
            </div>
            <span className="text-xs bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <ShieldCheck size={12} /> Seguro
            </span>
          </div>

          {isOldApk ? (
            /* Layout especial para quem está no APK antigo (WebView bloqueia download direto) */
            <div className="space-y-2.5">
              <div className="p-3 bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl text-xs text-[#524f64] leading-relaxed">
                O Android não permite baixar arquivos diretamente de dentro desta versão do aplicativo. Toque abaixo para abrir no <strong className="text-[#6d28d9]">Chrome</strong> ou copie o link:
              </div>

              <button
                onClick={handleOpenInChrome}
                className="w-full py-3 px-4 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.99] transition-all rounded-xl font-semibold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <ExternalLink size={16} />
                <span>Abrir no Chrome / Compartilhar</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#f8f7fc] border border-[#e8e5f0] transition-colors rounded-xl text-xs font-semibold text-[#524f64] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-[#059669]" />
                    <span className="text-[#059669] font-bold">Link copiado! Abra o Chrome e cole.</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar Link do Download</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Layout para quem está no navegador normal ou APK novo */
            <>
              <button
                onClick={triggerDownload}
                className="w-full py-3 px-4 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.99] transition-all rounded-xl font-semibold text-white shadow-sm flex items-center justify-center gap-2 mb-2.5 cursor-pointer text-sm"
              >
                <Download size={16} />
                <span>Baixar Atualização (17 MB)</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-3 bg-white hover:bg-[#f8f7fc] border border-[#e8e5f0] transition-colors rounded-xl text-xs font-medium text-[#524f64] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-[#059669]" />
                    <span className="text-[#059669] font-semibold">Link copiado! Cole no Chrome.</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar link do download</span>
                  </>
                )}
              </button>

              <div className="mt-4 pt-3 border-t border-[#f0edf8] text-center">
                <p className="text-xs text-[#524f64]">
                  {downloadStarted ? (
                    <span className="text-[#059669] font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 size={13} /> Download iniciado! Verifique a barra de notificações.
                    </span>
                  ) : (
                    <span>
                      Iniciando download automático em <strong className="text-[#6d28d9]">{seconds}s</strong>...
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Passo a Passo Simples */}
        <div className="w-full text-left space-y-2.5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6b6880]">Como instalar no seu celular:</p>
          <div className="bg-white border border-[#e8e5f0] rounded-xl p-3 flex items-start gap-3 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-[#f5f3ff] text-[#6d28d9] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p className="text-xs text-[#524f64]">
              Aguarde o download do arquivo <strong className="text-[#1a1826]">tati-ai.apk</strong> ser concluído.
            </p>
          </div>
          <div className="bg-white border border-[#e8e5f0] rounded-xl p-3 flex items-start gap-3 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-[#f5f3ff] text-[#6d28d9] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p className="text-xs text-[#524f64]">
              Puxe a barra de notificações do celular e toque no arquivo baixado.
            </p>
          </div>
          <div className="bg-white border border-[#e8e5f0] rounded-xl p-3 flex items-start gap-3 shadow-xs">
            <span className="w-5 h-5 rounded-full bg-[#f5f3ff] text-[#6d28d9] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p className="text-xs text-[#524f64]">
              Toque em <strong className="text-[#1a1826]">Instalar</strong> ou <strong className="text-[#1a1826]">Atualizar</strong>. Pronto! Abra o aplicativo e aproveite.
            </p>
          </div>
        </div>

        {/* Botão voltar para Login caso seja usuário web */}
        <Link
          href="/login"
          className="text-xs text-[#6b6880] hover:text-[#1a1826] transition-colors inline-flex items-center gap-1"
        >
          <span>Ir para a tela de login Web</span>
        </Link>
      </div>
    </main>
  );
}
