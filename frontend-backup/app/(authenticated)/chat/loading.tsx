// Este skeleton é renderizado pelo servidor (SSR) e aparece instantaneamente
// antes de qualquer JavaScript carregar — é o que resolve o LCP de 22s.
export default function Loading() {
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-[280px] bg-bg-secondary border-r border-border flex-col">
        <div className="p-6">
          <div className="h-8 w-32 bg-surface rounded-lg" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
        </div>
        <div className="flex-1 px-3 space-y-3 overflow-hidden pt-2">
          <div className="h-10 w-full bg-primary/10 rounded-lg" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
          <div className="space-y-2 mt-6">
            {[1,2,3,4,5,6].map((i) => (
              <div
                key={i}
                className="h-11 w-full bg-surface rounded-xl"
                style={{ animation: `pulse 2s cubic-bezier(0.4,0,0.6,1) ${i * 0.1}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-bg">
        {/* Topbar Skeleton */}
        <header className="h-16 border-b border-border flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-surface rounded-lg" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            <div className="h-5 w-36 bg-surface rounded" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-surface rounded-lg" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            <div className="h-8 w-8 bg-surface rounded-lg" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
          </div>
        </header>

        {/* Empty chat state — LCP element */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div
            className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20"
            style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}
          />
          <div className="h-5 w-48 bg-surface rounded" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
          <div className="h-4 w-64 bg-surface rounded" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) 0.1s infinite' }} />
        </div>

        {/* Input Skeleton */}
        <div className="p-4 md:p-6">
          <div className="max-w-4xl mx-auto h-14 bg-surface rounded-2xl border border-border" style={{ animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
        </div>
      </div>
    </div>
  );
}
