<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { History, Loader2, ArrowRight } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import HubShell from '@/components/catalog/HubShell.vue';
import { formatPrice } from '@/types/catalog';

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

const { user } = useAuth();
const orders = ref<HubOrder[]>([]);
const isLoading = ref(true);
const error = ref('');

async function loadOrders() {
  if (!user.value) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  error.value = '';
  try {
    const res = await apiGet<HubOrder[]>('/catalog/orders');
    orders.value = res || [];
  } catch (err: any) {
    console.error('Error fetching orders:', err);
    error.value = err?.data?.detail || err?.message || 'Could not load orders.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadOrders();
});
</script>

<template>
  <HubShell>
    <div class="space-y-8 p-4 md:p-8">
      <div>
        <h1 class="text-3xl font-black text-text tracking-tight">Orders</h1>
        <p class="mt-1 text-sm text-text-muted">Purchase history on Taty's Materials.</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex min-h-[40vh] items-center justify-center">
        <Loader2 class="animate-spin text-primary" :size="36" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
        {{ error }}
      </div>

      <!-- Not Logged In -->
      <div v-else-if="!user" class="mx-auto max-w-lg p-10 text-center rounded-2xl border border-border bg-surface">
        <h2 class="text-xl font-bold text-text mb-2">Orders</h2>
        <p class="text-sm text-text-muted mb-6">Sign in to your account to view order history.</p>
        <RouterLink to="/login" class="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md">
          Sign in
        </RouterLink>
      </div>

      <!-- Empty Orders -->
      <div
        v-else-if="orders.length === 0"
        class="flex flex-col items-center rounded-2xl border border-border bg-surface p-12 text-center"
      >
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <History :size="32" />
        </div>
        <h2 class="text-xl font-bold text-text">No orders yet</h2>
        <p class="mt-2 text-xs text-text-muted">Your purchases will appear here after checkout.</p>
        <RouterLink
          to="/activities/hub"
          class="mt-6 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          View Materials
        </RouterLink>
      </div>

      <!-- Order List -->
      <div v-else class="space-y-4">
        <div
          v-for="order in orders"
          :key="order.id"
          class="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <span class="text-xs font-mono font-bold text-text-muted">Order #{{ order.id }}</span>
              <p class="text-xs text-text-muted mt-0.5">{{ formatDate(order.created_at) }}</p>
            </div>
            <div class="flex items-center gap-3">
              <span
                :class="[
                  'px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider',
                  order.status === 'paid' || order.status === 'confirmed'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : order.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-danger/10 text-danger'
                ]"
              >
                {{ statusLabels[order.status] || order.status }}
              </span>
              <span class="text-sm font-black text-text">{{ formatPrice(order.total_amount) }}</span>
            </div>
          </div>

          <!-- Items in Order -->
          <div class="space-y-2">
            <div
              v-for="item in order.items"
              :key="item.content_id"
              class="flex items-center justify-between text-xs"
            >
              <span class="font-semibold text-text">{{ item.title }}</span>
              <div class="flex items-center gap-3">
                <span class="text-text-muted">{{ formatPrice(item.price) }}</span>
                <RouterLink
                  :to="`/activities/hub/${item.content_id}/ler`"
                  class="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <span>Open</span>
                  <ArrowRight :size="12" />
                </RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </HubShell>
</template>
