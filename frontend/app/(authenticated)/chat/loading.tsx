export default function Loading() {
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-[280px] bg-bg-secondary border-r border-border flex-col">
        <div className="p-6">
          <div className="h-8 w-32 bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="flex-1 px-3 space-y-4 overflow-hidden">
          <div className="h-10 w-full bg-primary/10 rounded-lg animate-pulse" />
          <div className="space-y-3 mt-8">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-bg">
        {/* Topbar Skeleton */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
          <div className="h-5 w-32 bg-surface rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-surface rounded-lg animate-pulse" />
            <div className="h-8 w-8 bg-surface rounded-lg animate-pulse" />
          </div>
        </header>

        {/* Chat Messages Skeleton */}
        <div className="flex-1 p-6 space-y-6 overflow-hidden">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className={`h-16 w-64 rounded-2xl animate-pulse ${i % 2 === 0 ? 'bg-surface' : 'bg-primary/10'}`} />
            </div>
          ))}
        </div>

        {/* Input Skeleton */}
        <div className="p-6 border-t border-border bg-surface/30">
          <div className="max-w-4xl mx-auto h-12 bg-surface rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
