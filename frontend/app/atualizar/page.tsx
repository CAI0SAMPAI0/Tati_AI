'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Download,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  Bug,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { DeveloperBugModal } from '@/components/feedback/developer-bug-modal';

const DIRECT_DOWNLOAD_URL = 'https://tati-ai.vercel.app/downloads/tati-ai.apk';

export default function AtualizarPage() {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [seconds, setSeconds] = useState(3);
  const [isAlreadyUpdated, setIsAlreadyUpdated] = useState(false);
  const [isOldApk, setIsOldApk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBugModal, setShowBugModal] = useState(false);
  const [activeImageZoom, setActiveImageZoom] = useState<string | null>(null);

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
    const isFlutter =
      typeof window !== 'undefined' &&
      Boolean((window as any).isFlutterApp || (window as any).flutter_inappwebview);
    if (isFlutter && (!code || Number(code) < 2)) {
      setIsOldApk(true);
      return;
    }

    // Contador regressivo para iniciar o download automaticamente (no navegador)
    const timer = setInterval(() => {
      setSeconds(prev => {
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

    try {
      if (typeof window !== 'undefined' && (window as any).flutter_inappwebview?.callHandler) {
        (window as any).flutter_inappwebview.callHandler('openExternalUrl', DIRECT_DOWNLOAD_URL);
      }
    } catch (_) {}

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
    if (typeof window !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(DIRECT_DOWNLOAD_URL);
        setCopied(true);
      } catch (_) {}
    }

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
          <h1 className="text-2xl font-bold text-[#1a1826] mb-2">Aplicativo Atualizado!</h1>
          <p className="text-[#524f64] text-sm mb-6 leading-relaxed">
            Você já está utilizando a versão mais recente do{' '}
            <strong className="text-[#6d28d9]">Teacher Tatiana AI</strong>.
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
    <main className="min-h-screen bg-[#f8f7fc] text-[#1a1826] flex flex-col items-center justify-start p-4 sm:p-6 pb-20">
      <div className="max-w-xl w-full flex flex-col items-center text-center">
        {/* Header / Logo */}
        <div className="relative mt-4 mb-4">
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
          <div className="absolute -bottom-2 -right-2 bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <Sparkles size={11} className="text-[#6d28d9]" /> Nova Versão
          </div>
        </div>

        {/* Título */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1a1826] mb-2">
          Atualização do Aplicativo Android
        </h1>
        <p className="text-[#524f64] text-sm leading-relaxed mb-6 max-w-md">
          Instale a versão atualizada do <strong className="text-[#6d28d9]">Teacher Tatiana AI</strong> com novos flashcards interativos, correção no login Google e mais estabilidade.
        </p>

        {/* ======================================================== */}
        {/* ALERTA CRÍTICO: DESINSTALAR VERSÃO ANTERIOR PRIMEIRO     */}
        {/* ======================================================== */}
        <div className="w-full bg-[#fffbeb] border-2 border-[#fcd34d] rounded-2xl p-5 mb-6 text-left shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#fef3c7] text-[#b45309] border border-[#fde68a] flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 size={20} />
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <h2 className="text-[#92400e] font-bold text-base flex items-center gap-1.5">
                <AlertTriangle size={18} className="text-[#b45309]" />
                Atenção: Já tinha o app instalado antes?
              </h2>
              <p className="text-[#78350f] leading-relaxed">
                Quem estava na versão anterior <strong className="text-[#92400e] underline underline-offset-2">precisa desinstalar o app antigo primeiro</strong> antes de instalar esta nova versão!
              </p>
              <div className="bg-white/80 border border-[#fde68a] rounded-xl p-3 text-xs text-[#78350f] leading-relaxed">
                Se você tentar instalar esta nova versão por cima da antiga sem desinstalar, o Android mostrará o erro <strong className="text-[#92400e]">&quot;App não instalado&quot;</strong>.
                <br />
                <span className="text-[#059669] font-bold mt-1.5 inline-block">
                  ✓ Após fazer esta atualização, as próximas serão automáticas e você não precisará mais desinstalar.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD PRINCIPAL DE DOWNLOAD                               */}
        {/* ======================================================== */}
        <div className="w-full bg-white border border-[#e8e5f0] rounded-2xl p-5 sm:p-6 shadow-sm mb-7 text-left">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center text-[#6d28d9]">
                <Smartphone size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1a1826]">tati-ai.apk</h2>
                <span className="text-xs text-[#6b6880] font-medium">17.3 MB • Android 8.0 ou superior</span>
              </div>
            </div>
            <span className="text-xs bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] px-3 py-1 rounded-full font-semibold flex items-center gap-1">
              <ShieldCheck size={14} /> Seguro
            </span>
          </div>

          {isOldApk ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-[#f5f3ff] border border-[#ddd6fe] rounded-xl text-xs text-[#524f64] leading-relaxed">
                O aplicativo antigo não permite download direto em segundo plano. Toque abaixo para abrir no <strong className="text-[#6d28d9]">Chrome</strong> ou copie o link:
              </div>

              <button
                onClick={handleOpenInChrome}
                className="w-full py-3.5 px-4 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.99] transition-all rounded-xl font-bold text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <ExternalLink size={18} />
                <span>Abrir no Chrome / Compartilhar</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#f8f7fc] border border-[#e8e5f0] transition-colors rounded-xl text-xs font-semibold text-[#524f64] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={15} className="text-[#059669]" />
                    <span className="text-[#059669] font-bold">Link copiado! Abra o Chrome e cole.</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    <span>Copiar Link do Download</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={triggerDownload}
                className="w-full py-3.5 px-4 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.99] transition-all rounded-xl font-bold text-white shadow-sm flex items-center justify-center gap-2 mb-3 cursor-pointer text-sm sm:text-base"
              >
                <Download size={18} />
                <span>Baixar Atualização (17.3 MB)</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#f8f7fc] border border-[#e8e5f0] transition-colors rounded-xl text-xs font-medium text-[#524f64] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-[#059669]" />
                    <span className="text-[#059669] font-semibold">Link copiado! Você pode colar no navegador.</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar link direto do download</span>
                  </>
                )}
              </button>

              <div className="mt-4 pt-3.5 border-t border-[#f0edf8] text-center">
                <p className="text-xs text-[#524f64]">
                  {downloadStarted ? (
                    <span className="text-[#059669] font-medium flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={15} /> Download iniciado! Acompanhe na barra de notificações do celular.
                    </span>
                  ) : (
                    <span>
                      Iniciando download automático em <strong className="text-[#6d28d9] font-bold">{seconds}s</strong>...
                    </span>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* ======================================================== */}
        {/* GUIA PASSO A PASSO DETALHADO COM IMAGENS REAIS           */}
        {/* ======================================================== */}
        <div className="w-full text-left space-y-6 mb-8">
          <div>
            <h2 className="text-lg font-bold text-[#1a1826] flex items-center gap-2">
              <HelpCircle size={20} className="text-[#6d28d9]" />
              Como instalar passo a passo no seu celular:
            </h2>
            <p className="text-xs text-[#6b6880] mt-1">
              Siga estas instruções ilustradas para instalar sem nenhum erro:
            </p>
          </div>

          {/* PASSO 1: Desinstalar versão antiga */}
          <div className="bg-white border border-[#e8e5f0] rounded-2xl p-4.5 sm:p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1a1826]">Desinstale a versão antiga (se já tiver o app)</h3>
                <p className="text-xs text-[#524f64] leading-relaxed">
                  Vá na tela inicial do celular, pressione e segure o ícone do <strong className="text-[#6d28d9]">Teacher Tati AI</strong> e toque em <strong>Desinstalar</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* PASSO 2: Baixar e abrir o arquivo */}
          <div className="bg-white border border-[#e8e5f0] rounded-2xl p-4.5 sm:p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1a1826]">Abra o arquivo baixado</h3>
                <p className="text-xs text-[#524f64] leading-relaxed">
                  Quando o download terminar, puxe a barra de notificações do seu celular ou acesse a pasta <strong>Downloads</strong> e toque em <strong className="text-[#1a1826]">tati-ai.apk</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* PASSO 3: Google Play Protect -> "Mais detalhes ˅" */}
          <div className="bg-white border border-[#e8e5f0] rounded-2xl p-4.5 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1a1826]">No aviso do Play Protect: Toque em &quot;Mais detalhes&quot;</h3>
                <p className="text-xs text-[#524f64] leading-relaxed">
                  Por se tratar de uma instalação direta fora da Play Store, o Android exibe o aviso <em>&quot;O app foi bloqueado para proteger seu dispositivo&quot;</em>.
                </p>
                <p className="text-xs font-semibold text-[#6d28d9]">
                  👉 Toque na setinha/texto &quot;Mais detalhes ˅&quot;, exatamente como destacado na imagem abaixo:
                </p>
              </div>
            </div>

            {/* Imagem Ilustrativa 1: Mais Detalhes */}
            <div className="mt-3 rounded-xl overflow-hidden border border-[#e8e5f0] bg-[#f8f7fc] p-2 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] max-h-[380px] rounded-lg overflow-hidden shadow-xs">
                <Image
                  src="/images/atualizar/mais_detalhes.jpeg"
                  alt="Tela do Google Play Protect com seta em Mais detalhes"
                  fill
                  className="object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setActiveImageZoom('/images/atualizar/mais_detalhes.jpeg')}
                />
              </div>
              <span className="text-[11px] text-[#6b6880] mt-2 italic">
                (Clique na foto para ampliar) • Toque em &quot;Mais detalhes ˅&quot;
              </span>
            </div>
          </div>

          {/* PASSO 4: Toque em "Instalar assim mesmo" */}
          <div className="bg-white border border-[#e8e5f0] rounded-2xl p-4.5 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#ddd6fe] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1a1826]">Toque em &quot;Instalar assim mesmo&quot;</h3>
                <p className="text-xs text-[#524f64] leading-relaxed">
                  Após tocar em Mais detalhes, o texto se expandirá. Toque na opção <strong className="text-[#059669] font-bold">&quot;Instalar assim mesmo&quot;</strong> logo acima do botão azul.
                </p>
                <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-2.5 text-xs text-[#991b1b] font-medium">
                  ⚠️ <strong>CUIDADO: NÃO aperte o botão azul &quot;Entendi&quot;</strong>, pois ele cancela e fecha a instalação! Toque apenas em &quot;Instalar assim mesmo&quot;.
                </div>
              </div>
            </div>

            {/* Imagem Ilustrativa 2: Instalar Mesmo Assim */}
            <div className="mt-3 rounded-xl overflow-hidden border border-[#e8e5f0] bg-[#f8f7fc] p-2 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] max-h-[380px] rounded-lg overflow-hidden shadow-xs">
                <Image
                  src="/images/atualizar/instalar_mesmo_assim.jpeg"
                  alt="Tela com opção Instalar assim mesmo"
                  fill
                  className="object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setActiveImageZoom('/images/atualizar/instalar_mesmo_assim.jpeg')}
                />
              </div>
              <span className="text-[11px] text-[#6b6880] mt-2 italic">
                (Clique na foto para ampliar) • Toque em &quot;Instalar assim mesmo&quot;
              </span>
            </div>
          </div>

          {/* PASSO 5: Entendendo o erro "App não instalado" */}
          <div className="bg-white border border-[#e8e5f0] rounded-2xl p-4.5 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-start gap-3.5">
              <span className="w-7 h-7 rounded-full bg-[#fef3c7] text-[#b45309] border border-[#fde68a] text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                !
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#1a1826]">Deu &quot;App não instalado&quot;? Veja por que:</h3>
                <p className="text-xs text-[#524f64] leading-relaxed">
                  A mensagem de <strong className="text-[#dc2626]">&quot;App não instalado&quot;</strong> só acontece em 2 situações específicas:
                </p>
                <ol className="list-decimal list-inside text-xs text-[#524f64] space-y-1.5 pt-1">
                  <li>
                    Se você <strong>não apertou em &quot;Instalar assim mesmo&quot;</strong> no aviso do Play Protect;
                  </li>
                  <li>
                    Ou se você <strong>tentou instalar a versão nova por cima da antiga</strong> sem desinstalar a versão anterior antes.
                  </li>
                </ol>
                <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-2.5 text-xs text-[#065f46] font-semibold mt-2">
                  ✅ Como resolver: Desinstale o aplicativo antigo do celular, abra o arquivo <em>tati-ai.apk</em> novamente e toque em <em>&quot;Instalar assim mesmo&quot;</em>.
                </div>
              </div>
            </div>

            {/* Imagem Ilustrativa 3: App Não Instalado */}
            <div className="mt-3 rounded-xl overflow-hidden border border-[#e8e5f0] bg-[#f8f7fc] p-2 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] max-h-[300px] rounded-lg overflow-hidden shadow-xs">
                <Image
                  src="/images/atualizar/nao_instalado.jpeg"
                  alt="Tela de erro App não instalado"
                  fill
                  className="object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setActiveImageZoom('/images/atualizar/nao_instalado.jpeg')}
                />
              </div>
              <span className="text-[11px] text-[#6b6880] mt-2 italic">
                (Clique na foto para ampliar) • Erro evitado desinstalando o app antigo primeiro
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RODAPÉ: REPORTAR BUG E VOLTAR PARA LOGIN                  */}
        {/* ======================================================== */}
        <div className="w-full pt-6 border-t border-[#e8e5f0] flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setShowBugModal(true)}
            className="inline-flex items-center gap-2 text-xs text-[#dc2626] hover:text-[#b91c1c] transition-colors py-1 cursor-pointer font-medium"
          >
            <Bug size={15} />
            <span>Teve algum problema na instalação? <strong>Reportar ao Desenvolvedor</strong></span>
          </button>

          <Link
            href="/login"
            className="text-xs text-[#6b6880] hover:text-[#1a1826] transition-colors inline-flex items-center gap-1 mt-1"
          >
            <span>Ir para a tela de login Web</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Modal de Zoom da Imagem */}
      {activeImageZoom && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveImageZoom(null)}
        >
          <div className="relative max-w-sm w-full max-h-[90vh] aspect-[9/16]">
            <Image
              src={activeImageZoom}
              alt="Zoom da imagem de instrução"
              fill
              className="object-contain rounded-2xl shadow-2xl"
            />
          </div>
          <p className="absolute bottom-6 text-white text-xs bg-black/60 px-4 py-1.5 rounded-full">
            Toque em qualquer lugar para fechar
          </p>
        </div>
      )}

      {/* Modal de Bug Report */}
      <DeveloperBugModal isOpen={showBugModal} onClose={() => setShowBugModal(false)} />
    </main>
  );
}
