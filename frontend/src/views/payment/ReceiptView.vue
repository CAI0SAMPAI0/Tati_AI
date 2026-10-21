<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { CheckCircle2, ArrowRight } from 'lucide-vue-next';
import { apiGet } from '@/api/client';

interface PaymentStatus {
  status?: string;
  plan_type?: string | null;
  paid_at?: string | null;
  next_due_at?: string | null;
}

const route = useRoute();
const data = ref<PaymentStatus | null>(null);

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

onMounted(async () => {
  try {
    const res = await apiGet<PaymentStatus>('/payments/status');
    data.value = res;
  } catch (err) {
    console.error('Error fetching payment status:', err);
  }
});

const values = computed(() => {
  const queryPlan = route.query.plan as string | undefined;
  const queryPaidAt = route.query.paid_at as string | undefined;
  const queryDueAt = route.query.due_at as string | undefined;
  return {
    plan: queryPlan ?? data.value?.plan_type ?? 'full',
    paidAt: queryPaidAt ?? data.value?.paid_at ?? new Date().toISOString(),
    dueAt: queryDueAt ?? data.value?.next_due_at ?? null,
    status: data.value?.status ?? 'active',
  };
});
</script>

<template>
  <main class="min-h-screen bg-bg flex items-center justify-center p-4">
    <section class="w-full max-w-xl rounded-3xl border border-border bg-surface shadow-2xl p-6 md:p-8">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
          <CheckCircle2 :size="28" />
        </div>
        <div>
          <h1 class="text-2xl font-black text-text">Payment Confirmed!</h1>
          <p class="text-xs text-text-muted">Your premium access has been activated successfully</p>
        </div>
      </div>

      <div class="space-y-3.5 text-xs border-y border-border/60 py-5">
        <div class="flex justify-between gap-4">
          <span class="text-text-muted">Plan</span>
          <span class="font-bold text-text">{{ values.plan === 'full' ? 'Full Fluency Plan' : 'Daily Practice' }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-text-muted">Status</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            {{ values.status === 'active' ? 'Active' : values.status }}
          </span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-text-muted">Payment date</span>
          <span class="font-semibold text-text">{{ formatDate(values.paidAt) }}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-text-muted">Next due date</span>
          <span class="font-semibold text-text">{{ formatDate(values.dueAt) }}</span>
        </div>
      </div>

      <div class="mt-8 flex flex-col sm:flex-row gap-3">
        <RouterLink
          to="/chat?receipt=success"
          class="flex-1 text-center rounded-xl px-4 py-3 bg-primary text-white font-bold text-xs shadow-md hover:opacity-90 transition-opacity"
        >
          Go to Chat
        </RouterLink>
        <RouterLink
          to="/profile"
          class="flex-1 text-center rounded-xl px-4 py-3 border border-border text-text font-bold text-xs hover:bg-bgSecondary transition-colors"
        >
          View Profile
        </RouterLink>
      </div>
    </section>
  </main>
</template>
