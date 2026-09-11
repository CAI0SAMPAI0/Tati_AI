'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Smartphone, 
  Apple, 
  Laptop, 
  Download, 
  Info, 
  AlertTriangle 
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { Button } from '@/components/ui/button';

export default function InstallPage() {
  const router = useRouter();
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      setDevice('ios');
    } else if (/android/i.test(ua)) {
      setDevice('android');
    } else {
      setDevice('desktop');
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <MainHeader />

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 pb-20 animate-fade-in">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-xl hover:bg-surface-hover transition-all text-text-muted border border-border bg-surface"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display">Install Tati AI</h1>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">
              Get the best experience on any device
            </p>
          </div>
        </header>

        <div className="space-y-6">
          {/* Se for iOS, mostra o card de iOS em primeiro lugar com destaque */}
          {device === 'ios' && (
            <section className="bg-surface border-2 border-primary/40 rounded-3xl overflow-hidden shadow-md">
              <div className="p-6 border-b border-border bg-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Apple size={22} className="text-primary" />
                  <h2 className="font-bold text-sm uppercase tracking-wider">iOS (iPhone / iPad)</h2>
                </div>
                <span className="text-[0.7rem] bg-primary text-white font-bold px-2.5 py-0.5 rounded-full">
                  Seu Dispositivo
                </span>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-text-muted">
                  Instale o Tati AI direto na sua tela de início pelo Safari (Web App / PWA):
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">1</div>
                    <p className="text-xs font-medium">Abra o <b>Safari</b> e acesse <b>tati-ai.vercel.app</b></p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">2</div>
                    <p className="text-xs font-medium">Toque no botão <b>Compartilhar</b> (ícone do quadrado com seta para cima)</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">3</div>
                    <p className="text-xs font-medium">Role para baixo e selecione <b>"Adicionar à Tela de Início"</b></p>
                  </li>
                </ul>
              </div>
            </section>
          )}

          {/* Android Section */}
          <section className={`bg-surface border rounded-3xl overflow-hidden shadow-sm ${device === 'android' ? 'border-2 border-primary/40 shadow-md' : 'border-border'}`}>
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-primary" />
                <h2 className="font-bold text-sm uppercase tracking-wider">Android</h2>
              </div>
              {device === 'android' && (
                <span className="text-[0.7rem] bg-primary text-white font-bold px-2.5 py-0.5 rounded-full">
                  Seu Dispositivo
                </span>
              )}
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-muted">
                Baixe o aplicativo nativo para Android com suporte a notificações e funcionamento offline.
              </p>

              {device === 'ios' ? (
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-relaxed">
                    Arquivos <b>.APK</b> são exclusivos para celulares Android e não abrem no iPhone. Para instalar no seu dispositivo Apple, utilize o passo a passo do <b>iOS acima</b>.
                  </p>
                </div>
              ) : (
                <>
                  <Button className="w-full gap-2 font-bold" onClick={() => window.open('/downloads/tati-ai.apk', '_blank')}>
                    <Download size={18} />
                    Download .APK (Direto)
                  </Button>
                  <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                    <Info size={16} className="text-primary mt-0.5 shrink-0" />
                    <p className="text-[0.7rem] text-primary/80 font-medium">
                      Nota: Se for a primeira vez instalando, você precisará autorizar a "Instalação de fontes desconhecidas" no Android.
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Se NÃO for iOS, mostra a seção do iOS abaixo do Android */}
          {device !== 'ios' && (
            <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
                <Apple size={20} className="text-primary" />
                <h2 className="font-bold text-sm uppercase tracking-wider">iOS (iPhone/iPad)</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-text-muted">
                  Instale o Tati AI como Web App (PWA) no seu iPhone:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">1</div>
                    <p className="text-xs font-medium">Abra o <b>Safari</b> e acesse <b>tati-ai.vercel.app</b></p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">2</div>
                    <p className="text-xs font-medium">Toque no botão <b>Compartilhar</b> (ícone do quadrado com seta para cima)</p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">3</div>
                    <p className="text-xs font-medium">Role para baixo e selecione <b>"Adicionar à Tela de Início"</b></p>
                  </li>
                </ul>
              </div>
            </section>
          )}

          {/* PC / Desktop */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
              <Laptop size={20} className="text-primary" />
              <h2 className="font-bold text-sm uppercase tracking-wider">Windows / Mac / Linux</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-muted">
                Use Tati AI diretamente no seu navegador ou instale como app no computador.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button variant="secondary" className="gap-2 font-bold" onClick={() => window.open('https://tati-ai.vercel.app', '_blank')}>
                  Abrir Versão Web
                </Button>
                <Button className="gap-2 font-bold opacity-50 cursor-not-allowed">
                  Desktop App (Em breve)
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
