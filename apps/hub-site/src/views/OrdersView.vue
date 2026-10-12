<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { History } from 'lucide-vue-next';
import { fetchMyOrders, type HubOrder } from '@tati/hub-core';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

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

const query = useQuery<HubOrder[]>({
  queryKey: computed(() => ['hub-orders', authStore.user?.id || authStore.user?.username]),
  queryFn: () => fetchMyOrders(),
  enabled: computed(() => authStore.isLoaded && Boolean(authStore.token) && Boolean(authStore.user)),
});

const orders = computed<HubOrder[]>(() => query.data.value ?? []);
const error = computed(() => query.error.value);
const isLoading = computed(() => query.isLoading.value);
</script>

<template>
  <div v-if="!authStore.isLoaded || isLoading" class="flex min-h-[50vh] items-center justify-center p-10">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>

  <div v-else-if="!authStore.user" class="mx-auto max-w-lg p-10 text-center">
    <h1 class="section-title mb-3">Pedidos</h1>
    <p class="mb-6 text-muted">Entre na sua conta para ver o histórico de pedidos.</p>
    <router-link to="/login" class="btn-primary inline-block">
      Entrar
    </router-link>
  </div>

  <div v-else class="space-y-8 p-6 md:p-10">
    <div>
      <h1 class="section-title text-3xl">Pedidos</h1>
      <p class="mt-2 text-muted">Histórico de compras em Taty's Materials.</p>
    </div>

    <p
      v-if="error"
      class="rounded-hub border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {{ (error as any)?.message || 'Não foi possível carregar pedidos.' }}
    </p>

    <div v-if="!orders.length && !error" class="card-surface flex flex-col items-center p-10 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-hub bg-primarySoft text-primary">
        <History :size="32" />
      </div>
      <h2 class="font-display text-xl font-bold text-ink">Nenhum pedido ainda</h2>
      <p class="mt-2 text-sm text-muted">Suas compras aparecerão aqui após o checkout.</p>
      <router-link to="/materiais" class="btn-primary mt-6">
        Ver materiais
      </router-link>
    </div>

    <div v-else class="space-y-4">
      <article v-for="order in orders" :key="order.id" class="card-surface p-5">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-subtle">
              Pedido #{{ String(order.id).slice(0, 8) }}
            </p>
            <p class="mt-1 text-sm text-muted">{{ formatDate(order.created_at) }}</p>
          </div>
          <span class="rounded-full bg-primarySoft px-3 py-1 text-xs font-bold text-primary">
            {{ statusLabels[order.status] ?? order.status }}
          </span>
        </div>
        <ul class="mt-4 space-y-2">
          <li
            v-for="item in order.items"
            :key="`${order.id}-${item.content_id}`"
            class="flex justify-between text-sm"
          >
            <span class="font-medium text-ink">{{ item.title }}</span>
            <span class="text-muted">
              R$ {{ item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
            </span>
          </li>
        </ul>
        <div class="mt-4 flex justify-between border-t border-line pt-3 text-sm font-bold text-ink">
          <span>Total</span>
          <span>R$ {{ order.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>
