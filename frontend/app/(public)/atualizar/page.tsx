'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Sparkles, ShieldCheck, CheckCircle2, RefreshCw, Smartphone, ExternalLink } from 'lucide-react';

const APK_DOWNLOAD_URL = '/downloads/tati-ai.apk';
const DIRECT_DOWNLOAD_URL = 'https://tati-ai.vercel.app/downloads/tati-ai.apk';

export default function AtualizarPage() {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    // Contador regressivo para iniciar o download automaticamente
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
    const link = document.createElement('a');
    link.href = APK_DOWNLOAD_URL;
    link.setAttribute('download', 'tati-ai.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-[#0A0B10] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Luz ambiente de fundo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 flex flex-col items-center text-center">
        {/* Logo / Badge */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-1 shadow-2xl shadow-purple-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-[#12131C] rounded-[22px] flex items-center justify-center overflow-hidden">
              <Image
                src="/images/tati_logo.jpg"
                alt="Teacher Tatiana AI"
                width={88}
                height={88}
                className="object-cover"
                priority
              />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-black text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
            <Sparkles size={10} /> v1.0.1
          </div>
        </div>

        {/* Título & Status */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
          Atualização Obrigatória
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Uma nova versão oficial do aplicativo <strong className="text-purple-400">Teacher Tatiana AI</strong> está disponível com login Google nativo corrigido e melhorias essenciais.
        </p>

        {/* Card Principal de Download */}
        <div className="w-full bg-[#131520] border border-purple-500/20 rounded-2xl p-5 sm:p-6 shadow-xl mb-6 text-left relative overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Smartphone size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">tati-ai.apk</h2>
                <span className="text-xs text-slate-400 font-medium">17.3 MB • Android Oficial</span>
              </div>
            </div>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <ShieldCheck size={12} /> Seguro
            </span>
          </div>

          {/* Botão de Download */}
          <button
            onClick={triggerDownload}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition-all rounded-xl font-bold text-white shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 mb-3 cursor-pointer"
          >
            <Download size={18} />
            <span>Baixar Atualização (17 MB)</span>
          </button>

          {/* Link para abrir no navegador padrão se estiver travado no webview */}
          <a
            href={DIRECT_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            <span>Abrir download no Navegador do Celular</span>
          </a>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400">
              {downloadStarted ? (
                <span className="text-emerald-400 font-medium flex items-center justify-center gap-1">
                  <CheckCircle2 size={13} /> Download iniciado! Verifique a barra de notificações.
                </span>
              ) : (
                <span>
                  Iniciando download automático em <strong className="text-purple-400">{seconds}s</strong>...
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Passo a Passo Simples */}
        <div className="w-full text-left space-y-2.5 mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Como instalar no seu celular:</p>
          <div className="bg-[#12131C] border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p className="text-xs text-slate-300">
              Aguarde o download do arquivo <strong className="text-white">tati-ai.apk</strong> ser concluído.
            </p>
          </div>
          <div className="bg-[#12131C] border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p className="text-xs text-slate-300">
              Puxe a barra de notificações do celular e toque no arquivo baixado.
            </p>
          </div>
          <div className="bg-[#12131C] border border-slate-800/80 rounded-xl p-3 flex items-start gap-3">
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p className="text-xs text-slate-300">
              Toque em <strong className="text-white">Instalar</strong> ou <strong className="text-white">Atualizar</strong>. Pronto! Abra o aplicativo e aproveite.
            </p>
          </div>
        </div>

        {/* Botão voltar para Login caso seja usuário web */}
        <Link
          href="/login"
          className="text-xs text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1"
        >
          <span>Ir para a tela de login Web</span>
        </Link>
      </div>
    </main>
  );
}
