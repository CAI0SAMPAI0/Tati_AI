<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue';
import {
  ShoppingCart,
  CheckCircle,
  Lock,
  X,
  Loader2,
  RefreshCw,
  Zap,
} from 'lucide-vue-next';
import { resolveApiUrl, formatPrice } from '@/lib/catalog';
import { useAuthStore } from '@/stores/auth';
import { loginWithCredentials, getStoredSession } from '@tati/hub-core';
import { usePaymentWebSocket } from '@/hooks/usePaymentWebSocket';

const props = defineProps<{
  item: {
    id: string;
    title: string;
    price: number;
  };
}>();

const emit = defineEmits<{
  (e: 'accessGranted'): void;
}>();

const authStore = useAuthStore();

const isOpen = ref(false);
const step = ref<'form' | 'payment' | 'confirmed' | 'cancelled'>('form');
const processing = ref(false);
const cancelling = ref(false);
const pollingStatus = ref<'idle' | 'polling' | 'confirmed' | 'error'>('idle');
const contentIsProcessing = ref(false);

const name = ref(authStore.user?.name || '');
const email = ref(authStore.user?.email || '');
const cpf = ref((authStore.user as any)?.cpf || (authStore.user as any)?.cpf_cnpj || '');
const billingType = ref('PIX');

const checkoutResult = ref<{
  paymentId?: string;
  pix?: { qrCode: string; copyPaste: string };
  invoiceUrl?: string;
  username?: string;
} | null>(null);

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let pollCount = 0;
const MAX_POLLS = 60;

const isAwaitingPayment = computed(() => step.value === 'payment' && pollingStatus.value === 'polling');

watch(
  () => authStore.user,
  (newUser) => {
    if (newUser) {
      if (!name.value) name.value = newUser.name || '';
      if (!email.value) email.value = newUser.email || '';
      if (!cpf.value) cpf.value = (newUser as any).cpf || (newUser as any).cpf_cnpj || '';
    }
  },
  { immediate: true }
);

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  pollCount = 0;
}

function handlePaymentConfirmed(isProcessing = false) {
  stopPolling();
  contentIsProcessing.value = isProcessing;
  pollingStatus.value = 'confirmed';
  step.value = 'confirmed';
  emit('accessGranted');
}

usePaymentWebSocket({
  enabled: isAwaitingPayment,
  onConfirmed(data) {
    if (!checkoutResult.value?.paymentId || data.payment_id !== checkoutResult.value.paymentId) return;
    handlePaymentConfirmed(false);
  },
  onRefused(data) {
    if (!checkoutResult.value?.paymentId || data.payment_id !== checkoutResult.value.paymentId) return;
    stopPolling();
    pollingStatus.value = 'error';
  },
});

function handleClose() {
  stopPolling();
  isOpen.value = false;
  setTimeout(() => {
    step.value = 'form';
    checkoutResult.value = null;
    pollingStatus.value = 'idle';
  }, 300);
}

function startPolling(paymentId: string) {
  pollingStatus.value = 'polling';
  pollCount = 0;

  pollingInterval = setInterval(async () => {
    pollCount += 1;
    if (pollCount > MAX_POLLS) {
      stopPolling();
      pollingStatus.value = 'error';
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const currentSession = getStoredSession();
      const activeToken = authStore.token || currentSession?.token;
      if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

      const res = await fetch(`${resolveApiUrl()}/activities/hub/${props.item.id}/access`, {
        headers,
      });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && (json.url || json.pages)) {
          handlePaymentConfirmed(false);
          return;
        }
      }

      if (res.status === 409) {
        handlePaymentConfirmed(true);
        return;
      }
    } catch {
      // Ignora erro e continua tentando
    }
  }, 5000);
}

function formatCPF(val: string) {
  const digits = val.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').substring(0, 14);
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').substring(0, 18);
}

async function handleCheckout() {
  processing.value = true;
  try {
    const localToken = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const authToken = authStore.token || localToken;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(`${resolveApiUrl()}/catalog/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content_id: props.item.id,
        name: name.value,
        email: email.value,
        cpf: cpf.value,
        billingType: billingType.value,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erro ao processar checkout');
    }

    const data = await res.json();
    checkoutResult.value = data;

    if (data.username && data.password) {
      try {
        const loginRes = await loginWithCredentials(data.username, data.password);
        if (loginRes?.data?.access_token && loginRes?.data?.user) {
          authStore.saveSession(loginRes.data.access_token, loginRes.data.user);
        }
      } catch (loginErr) {
        console.error('Erro ao autenticar automaticamente:', loginErr);
      }
    }

    step.value = 'payment';
    if (data.paymentId) {
      startPolling(data.paymentId);
    }
  } catch (error: any) {
    alert(error?.message || 'Erro no checkout');
  } finally {
    processing.value = false;
  }
}

async function handleCancel() {
  if (!checkoutResult.value?.paymentId) return;
  cancelling.value = true;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authStore.token) headers['Authorization'] = `Bearer ${authStore.token}`;

    const res = await fetch(
      `${resolveApiUrl()}/catalog/checkout/${checkoutResult.value.paymentId}/cancel`,
      { method: 'POST', headers }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 400 && err.detail?.includes('confirmado')) {
        stopPolling();
        step.value = 'confirmed';
        return;
      }
      throw new Error(err.detail || 'Erro ao cancelar pedido');
    }

    stopPolling();
    step.value = 'cancelled';
  } catch (err: any) {
    alert(err?.message || 'Erro ao cancelar');
  } finally {
    cancelling.value = false;
  }
}

function copyPixCode() {
  if (checkoutResult.value?.pix?.copyPaste) {
    navigator.clipboard.writeText(checkoutResult.value.pix.copyPaste);
    alert('Código Pix copiado para a área de transferência!');
  }
}

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div>
    <button
      type="button"
      class="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
      @click="isOpen = true"
    >
      <ShoppingCart :size="14" />
      Comprar
    </button>

    <!-- Modal Portal / Overlay -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      >
        <div class="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-card">
          <!-- Close button -->
          <button
            type="button"
            class="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-bgSecondary hover:text-ink"
            aria-label="Fechar"
            @click="handleClose"
          >
            <X :size="20" />
          </button>

          <!-- Modal Header -->
          <div class="mb-5 border-b border-line pb-4">
            <span class="text-[10px] font-bold uppercase tracking-wider text-primary">
              Checkout Seguro
            </span>
            <h3 class="font-display text-xl font-bold text-ink">{{ item.title }}</h3>
            <p class="mt-1 text-sm font-semibold text-primary">
              Total: {{ formatPrice(item.price) }}
            </p>
          </div>

          <!-- Step 1: Form -->
          <form v-if="step === 'form'" @submit.prevent="handleCheckout" class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Nome completo</label>
              <input
                v-model="name"
                required
                placeholder="Seu nome completo"
                class="input-hub w-full pl-3"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">E-mail</label>
              <input
                v-model="email"
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                class="input-hub w-full pl-3"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">CPF / CNPJ</label>
              <input
                :value="cpf"
                required
                placeholder="000.000.000-00"
                class="input-hub w-full pl-3"
                @input="cpf = formatCPF(($event.target as HTMLInputElement).value)"
              />
            </div>

            <div class="pt-2">
              <button
                type="submit"
                :disabled="processing"
                class="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm"
              >
                <Loader2 v-if="processing" :size="18" class="animate-spin" />
                <Zap v-else :size="18" />
                {{ processing ? 'Gerando pedido...' : 'Pagar com Pix' }}
              </button>
            </div>
          </form>

          <!-- Step 2: Payment (Pix) -->
          <div v-else-if="step === 'payment'" class="py-2 text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 v-if="pollingStatus === 'polling'" :size="32" class="animate-spin" />
              <RefreshCw v-else-if="pollingStatus === 'error'" :size="32" />
              <CheckCircle v-else :size="32" />
            </div>

            <h4 class="font-display text-xl font-bold text-ink">Pedido gerado!</h4>
            <p class="mt-2 text-sm text-muted">
              {{
                pollingStatus === 'polling'
                  ? 'Aguardando confirmação do pagamento...'
                  : pollingStatus === 'error'
                  ? 'Tempo esgotado. Recarregue a página após pagar.'
                  : 'Finalize o pagamento para liberar o acesso.'
              }}
            </p>

            <div v-if="checkoutResult?.pix?.qrCode" class="my-4 flex flex-col items-center">
              <img
                :src="`data:image/png;base64,${checkoutResult.pix.qrCode}`"
                alt="QR Code Pix"
                class="h-48 w-48 rounded-xl border border-line p-2 shadow-sm"
              />
              <button
                type="button"
                class="btn-secondary mt-3 text-xs"
                @click="copyPixCode"
              >
                Copiar código Pix
              </button>
            </div>

            <div class="mt-5 flex justify-center gap-3">
              <button
                type="button"
                :disabled="cancelling"
                class="rounded-lg px-4 py-2 text-xs font-semibold text-muted hover:bg-bgSecondary hover:text-ink"
                @click="handleCancel"
              >
                {{ cancelling ? 'Cancelando...' : 'Cancelar pedido' }}
              </button>
            </div>
          </div>

          <!-- Step 3: Confirmed -->
          <div v-else-if="step === 'confirmed'" class="py-6 text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle :size="36" />
            </div>
            <h4 class="font-display text-xl font-bold text-ink">Pagamento confirmado!</h4>
            <p class="mt-2 text-sm text-muted">
              Seu acesso ao material foi liberado com sucesso.
            </p>
            <div class="mt-6 flex justify-center gap-3">
              <router-link
                :to="`/materiais/${item.id}/ler`"
                class="btn-primary text-xs"
                @click="handleClose"
              >
                Ler agora
              </router-link>
              <button
                type="button"
                class="btn-secondary text-xs"
                @click="handleClose"
              >
                Concluir
              </button>
            </div>
          </div>

          <!-- Step 4: Cancelled -->
          <div v-else-if="step === 'cancelled'" class="py-6 text-center">
            <h4 class="font-display text-xl font-bold text-ink">Pedido cancelado</h4>
            <p class="mt-2 text-sm text-muted">
              Você pode reiniciar a compra quando desejar.
            </p>
            <button
              type="button"
              class="btn-secondary mt-5 text-xs"
              @click="handleClose"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
