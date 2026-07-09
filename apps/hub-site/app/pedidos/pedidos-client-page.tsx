'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { History } from 'lucide-react';
import { fetchMyOrders } from '@tati/hub-core';
import type { HubOrder } from '@tati/hub-core';
import { useHubAuth } from '@/components/auth-provider';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  revoked: 'Cancelado',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PedidosClientPage() {
  const { user, isLoaded, token } = useHubAuth();

  const { data: orders = [], error } = useQuery<HubOrder[]>({
    queryKey: ['hub-orders'],
    queryFn: () => fetchMyOrders(),
    enabled: isLoaded && Boolean(token),
  });

  if (!isLoaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-10 text-center">
        <h1 className="section-title mb-3">Pedidos</h1>
        <p className="mb-6 text-muted">Entre na sua conta para ver o histórico.</p>
        <Link href="/login" className="btn-primary inline-block">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-10">
      <div>
        <h1 className="section-title text-3xl">Pedidos</h1>
        <p className="mt-2 text-muted">Histórico de compras no Taty Hub.</p>
      </div>

      {error && (
        <p className="rounded-hub border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error instanceof Error ? error.message : 'Não foi possível carregar pedidos.'}
        </p>
      )}

      {!orders.length && !error ? (
        <div className="card-surface flex flex-col items-center p-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
            <History size={32} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">Nenhum pedido ainda</h2>
          <p className="mt-2 text-sm text-muted">Suas compras aparecerão aqui após o checkout.</p>
          <Link href="/materiais" className="btn-primary mt-6">
            Ver materiais
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id} className="card-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                    Pedido #{String(order.id).slice(0, 8)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{formatDate(order.created_at)}</p>
                </div>
                <span className="rounded-full bg-primarySoft px-3 py-1 text-xs font-bold text-primary">
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.content_id}`} className="flex justify-between text-sm">
                    <span className="font-medium text-ink">{item.title}</span>
                    <span className="text-muted">
                      R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-right text-sm font-bold text-ink">
                Total: R$ {order.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
