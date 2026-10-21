export default function Loading() {
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-[280px] bg-bg-secondary border-r border-border flex-col">
        <div className="p-6">
          <div className="h-6 w-32 bg-surface rounded animate-pulse" />
        </div>
        <div className="flex-1 px-4 space-y-2 mt-4">
          {Array(7)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface rounded-xl animate-pulse" />
            ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Header Skeleton */}
        <header className="h-16 border-b border-border bg-bg flex items-center justify-between px-8">
          <div className="h-6 w-40 bg-surface rounded animate-pulse" />
          <div className="h-8 w-8 bg-surface rounded-full animate-pulse" />
        </header>

        {/* Content Skeleton */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          <header className="flex justify-between items-end">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-surface rounded animate-pulse" />
              <div className="h-4 w-64 bg-surface rounded animate-pulse" />
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="h-28 bg-surface border border-border rounded-2xl animate-pulse" />
              ))}
          </div>

          <div className="h-12 w-full bg-surface rounded-xl animate-pulse" />

          <div className="space-y-3">
            {Array(5)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="h-20 bg-surface border border-border rounded-2xl animate-pulse" />
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
