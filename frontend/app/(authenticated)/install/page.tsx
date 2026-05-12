'use client';

import { 
  ArrowLeft, 
  Smartphone, 
  Apple, 
  Laptop, 
  Download, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MainHeader } from '@/components/layout/main-header';
import { Button } from '@/components/ui/button';

export default function InstallPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-bg">
      <MainHeader />

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 pb-20 animate-fade-in">
        <header className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-surface-hover transition-all text-text-muted border border-border bg-surface">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display">Install Tati AI</h1>
            <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Get the best experience on any device</p>  
          </div>
        </header>

        <div className="space-y-6">
          {/* Android */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Smartphone size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Android</h2>       
            </div>
            <div className="p-6 space-y-4">
               <p className="text-sm text-text-muted">
                 Download our native Android app for offline support and push notifications.
               </p>
               <Button className="w-full gap-2 font-bold" onClick={() => window.open('/downloads/tati-ai.apk', '_blank')}>
                 <Download size={18} />
                 Download .APK (Direct)
               </Button>
               <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                 <Info size={16} className="text-primary mt-0.5 shrink-0" />
                 <p className="text-[0.7rem] text-primary/80 font-medium">
                   Note: You might need to allow "Install from unknown sources" in your Android settings.
                 </p>
               </div>
            </div>
          </section>

          {/* iOS / PWA */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Apple size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">iOS (iPhone/iPad)</h2>
            </div>
            <div className="p-6 space-y-4">
               <p className="text-sm text-text-muted">
                 Install Tati AI as a Web App (PWA) on your iOS device:
               </p>
               <ul className="space-y-3">
                 <li className="flex items-start gap-3">
                   <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">1</div>
                   <p className="text-xs font-medium">Open <b>tati-ai.vercel.app</b> in Safari</p>
                 </li>
                 <li className="flex items-start gap-3">
                   <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">2</div>
                   <p className="text-xs font-medium">Tap the <b>Share</b> button (square with arrow up)</p>
                 </li>
                 <li className="flex items-start gap-3">
                   <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[0.65rem] font-bold mt-0.5 shrink-0">3</div>
                   <p className="text-xs font-medium">Select <b>"Add to Home Screen"</b></p>
                 </li>
               </ul>
            </div>
          </section>

          {/* PC / Desktop */}
          <section className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
               <Laptop size={20} className="text-primary" />
               <h2 className="font-bold text-sm uppercase tracking-wider">Windows / Mac / Linux</h2>
            </div>
            <div className="p-6 space-y-4">
               <p className="text-sm text-text-muted">
                 Use Tati AI directly in your browser or install it as a desktop app.
               </p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <Button variant="outline" className="gap-2 font-bold" onClick={() => window.open('https://tati-ai.vercel.app', '_blank')}>
                   Open Web Version
                 </Button>
                 <Button className="gap-2 font-bold opacity-50 cursor-not-allowed">
                   Desktop App (Coming Soon)
                 </Button>
               </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
