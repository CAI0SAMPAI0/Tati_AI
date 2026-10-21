'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';


interface PaymentStatus {
  status?: string;
  plan_type?: string | null;
  paid_at?: string | null;
  next_due_at?: string | null;
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale);
}

export default function ReceiptClientPage() {
  const searchParams = useSearchParams();

  const { data } = useQuery({
    queryKey: ['payments-status', 'receipt'],
    queryFn: () => apiGet<PaymentStatus>(ENDPOINTS.PAYMENTS_STATUS),
    staleTime: 30_000,
  });

  const values = useMemo(() => {
    const queryPlan = searchParams.get('plan');
    const queryPaidAt = searchParams.get('paid_at');
    const queryDueAt = searchParams.get('due_at');
    return {
      plan: queryPlan ?? data?.plan_type ?? 'full',
      paidAt: queryPaidAt ?? data?.paid_at ?? null,
      dueAt: queryDueAt ?? data?.next_due_at ?? null,
      status: data?.status ?? 'active',
    };
  }, [searchParams, data]);

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center p-4">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-surface shadow-xl p-6 md:p-8">
        <h1 className="text-2xl font-black text-text mb-1">Payment Confirmed!</h1>
        <p className="text-sm text-text-muted mb-6">Your premium access has been activated successfully</p>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Plan</span>
            <span className="font-semibold text-text">{values.plan === 'full' ? 'Full' : 'Chat & Voice'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Status</span>
            <span className="font-semibold text-success">{values.status === 'active' ? 'Active' : values.status}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Payment date</span>
            <span className="font-semibold text-text">{formatDate(values.paidAt, 'en-US')}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Next due date</span>
            <span className="font-semibold text-text">{formatDate(values.dueAt, 'en-US')}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/chat?receipt=success" className="flex-1 text-center rounded-xl px-4 py-3 bg-primary text-white font-bold">
            Go to Chat
          </Link>
          <Link href="/profile" className="flex-1 text-center rounded-xl px-4 py-3 border border-border text-text font-bold">
            View Profile
          </Link>
        </div>
      </section>
    </main>
  );
}
