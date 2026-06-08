'use client';

/**
 * Skeleton screen para o catálogo do Hub.
 * Exibido enquanto os dados estão carregando — evita "falsos negativos"
 * (mensagem de "nenhum material" antes da resposta chegar).
 */
export function ProductCardSkeleton() {
  return (
    <article className="card-surface flex h-full flex-col overflow-hidden">
      {/* Header shimmer */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="h-3 w-16 animate-pulse rounded-full bg-border/60" />
        <div className="h-3 w-12 animate-pulse rounded-full bg-border/60" />
      </div>

      {/* Image placeholder */}
      <div className="mx-4 mt-4 aspect-[4/3] animate-pulse rounded-xl bg-border/40" />

      {/* Text lines */}
      <div className="px-4 pb-4 pt-3 space-y-2">
        <div className="h-5 w-3/4 animate-pulse rounded bg-border/50" />
        <div className="h-3 w-full animate-pulse rounded bg-border/30" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-border/30" />
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-line px-4 py-3">
        <div className="h-4 w-16 animate-pulse rounded bg-border/50" />
        <div className="h-8 w-24 animate-pulse rounded-xl bg-border/40" />
      </div>
    </article>
  );
}

export default function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
