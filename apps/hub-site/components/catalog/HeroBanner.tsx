import BrandMark from '@/components/BrandMark';
import { Sparkles } from 'lucide-react';

export default function HeroBanner() {
  return (
    <section className="card-surface relative overflow-hidden bg-primarySoft p-8 md:p-10">
      <div className="relative z-10 max-w-2xl">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Taty&apos;s English Class
        </p>
        <BrandMark variant="hero" subtitle="English Class" className="mb-4" />
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          Materiais criados pela Teacher Tati
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
          E-books, planners e exercícios para acelerar seu inglês com o método da Tati.
        </p>
      </div>
      <div
        className="absolute right-6 top-1/2 hidden -translate-y-1/2 md:flex"
        aria-hidden
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-hub bg-surface shadow-sm">
          <Sparkles className="text-primary" size={40} strokeWidth={1.5} />
        </div>
      </div>
    </section>
  );
}
