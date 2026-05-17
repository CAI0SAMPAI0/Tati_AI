'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { History } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';
import HubShell from '@/components/catalog/HubShell';

type OrderItem = {
  content_id: string;
  price: number;
  title: string;
};

type HubOrder = {
  id: string | number;
  status: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items: OrderItem[];
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  revoked: 'Cancelled',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrdersPage() {
  const { user, isLoaded } = useAuth();

  const { data: orders = [], isLoading, error } = useQuery<HubOrder[]>({
    queryKey: ['hub-orders'],
    queryFn: () => apiGet<HubOrder[]>('/catalog/orders'),
    enabled: isLoaded && !!user,
  });

  if (!isLoaded || isLoading) {
    return (
      <HubShell>
        <div className="flex min-h-[50vh] items-center justify-center p-10">
          <Spinner />
        </div>
      </HubShell>
    );
  }

  if (!user) {
    return (
      <HubShell>
        <div className="mx-auto max-w-lg p-10 text-center">
          <h1 className="section-title mb-3">Orders</h1>
          <p className="mb-6 text-muted">Sign in to your account to view the history.</p>
        </div>
      </HubShell>
    );
  }

  return (
    <HubShell>
      <div className="space-y-8 p-6 md:p-10">
        <div>
          <h1 className="section-title text-3xl">Orders</h1>
          <p className="mt-2 text-muted">Purchase history on Tati Hub.</p>
        </div>

        {error && (
          <p className="rounded-hub border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error instanceof Error ? error.message : 'Could not load orders.'}
          </p>
        )}

        {!orders.length && !error ? (
          <div className="card-surface flex flex-col items-center p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
              <History size={32} />
            </div>
            <h2 className="font-display text-xl font-bold text-ink">No orders yet</h2>
            <p className="mt-2 text-sm text-muted">Your purchases will appear here after checkout.</p>
            <Link href="/activities/hub" className="btn-primary mt-6">
              View materials
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <article key={order.id} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-subtle">
                      Order #{String(order.id).slice(0, 8)}
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
                        R$ {item.price.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-right text-sm font-bold text-ink">
                  Total: R$ {order.total_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </HubShell>
  );
}