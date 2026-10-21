export default function Loading() {
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex w-[280px] bg-bg-secondary border-r border-border flex-col">
        <div className="p-6">
          <div className="h-6 w-32 bg-surface rounded animate-pulse" />
        </div>
        <div className="flex-1 px-4 space-y-2 mt-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-12 w-full bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Header Skeleton */}
        <header className="h-16 border-b border-border bg-bg flex items-center justify-between px-8">
          <div className="h-6 w-40 bg-surface rounded animate-pulse" />
          <div className="h-8 w-32 bg-surface rounded-full animate-pulse" />
        </header>

        {/* Content Skeleton */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          <div className="flex justify-between items-center">
            <div className="h-10 w-64 bg-surface rounded animate-pulse" />
            <div className="h-10 w-32 bg-surface rounded-xl animate-pulse" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-48 bg-surface border border-border rounded-3xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
