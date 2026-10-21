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
          <div className="h-8 w-8 bg-surface rounded-full animate-pulse" />
        </header>

        {/* Content Skeleton */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          <header className="flex justify-between items-end">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-surface rounded animate-pulse" />
              <div className="h-4 w-64 bg-surface rounded animate-pulse" />
            </div>
            <div className="h-12 w-48 bg-surface rounded-2xl animate-pulse" />
          </header>

          <div className="h-40 w-full bg-surface border border-border rounded-3xl animate-pulse" />

          <div className="flex gap-2">
            <div className="h-8 w-24 bg-surface rounded-xl animate-pulse" />
            <div className="h-8 w-24 bg-surface rounded-xl animate-pulse" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-2xl animate-pulse" />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-surface border border-border rounded-3xl animate-pulse" />
            <div className="h-80 bg-surface border border-border rounded-3xl animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}
