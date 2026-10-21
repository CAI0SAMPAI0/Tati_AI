<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ShoppingCart,
  CheckCircle2,
  Lock,
  X,
  Loader2,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldAlert,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPost } from '@/api/client';
import { formatPrice } from '@/types/catalog';

const props = defineProps<{
  item: {
    id: string;
    title: string;
    price: number;
  };
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'accessGranted'): void;
}>();

const router = useRouter();
const { user, token } = useAuth();
const toast = useToast();

const step = ref<'form' | 'payment' | 'confirmed' | 'cancelled'>('form');
const processing = ref(false);
const cancelling = ref(false);
const pollingStatus = ref<'idle' | 'polling' | 'confirmed' | 'error'>('idle');
const contentIsProcessing = ref(false);

const name = ref(user.value?.name || user.value?.username || '');
const email = ref(user.value?.email || '');
const cpf = ref((user.value as any)?.cpf || (user.value as any)?.cpf_cnpj || '');
const billingType = ref('PIX');

const checkoutResult = ref<{
  paymentId?: string;
  pix?: { qrCode: string; copyPaste: string };
  invoiceUrl?: string;
  username?: string;
} | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollCount = 0;
const MAX_POLLS = 60; // 5 min

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  pollCount = 0;
}

onUnmounted(() => {
  stopPolling();
});

watch(
  () => props.isOpen,
  (open) => {
    if (!open) {
      stopPolling();
      setTimeout(() => {
        step.value = 'form';
        checkoutResult.value = null;
        pollingStatus.value = 'idle';
      }, 300);
    } else {
      if (user.value) {
        if (!name.value) name.value = user.value.name || user.value.username || '';
        if (!email.value) email.value = user.value.email || '';
        if (!cpf.value) cpf.value = (user.value as any)?.cpf || (user.value as any)?.cpf_cnpj || '';
      }
    }
  }
);

function formatCPF(val: string) {
  const digits = val.replace(/\D/g, '');
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .substring(0, 14);
  }
  return digits
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    .substring(0, 18);
}

function handleCpfInput(e: Event) {
  const target = e.target as HTMLInputElement;
  cpf.value = formatCPF(target.value);
}

function startPolling(paymentId: string) {
  pollingStatus.value = 'polling';
  pollCount = 0;

  pollTimer = setInterval(async () => {
    pollCount += 1;
    if (pollCount > MAX_POLLS) {
      stopPolling();
      pollingStatus.value = 'error';
      return;
    }

    try {
      const res = await apiGet<any>(`/activities/hub/${props.item.id}/access`);
      if (res && (res.url || res.pages)) {
        stopPolling();
        contentIsProcessing.value = false;
        pollingStatus.value = 'confirmed';
        step.value = 'confirmed';
        emit('accessGranted');
      }
    } catch (err: any) {
      if (err?.status === 409) {
        stopPolling();
        contentIsProcessing.value = true;
        pollingStatus.value = 'confirmed';
        step.value = 'confirmed';
        emit('accessGranted');
      }
      // 403 / 404 = waiting for payment confirmation, keep polling
    }
  }, 5000);
}

async function handleCheckout() {
  if (!name.value.trim() || !email.value.trim() || !cpf.value.trim()) {
    toast.error('Please fill in Name, Email and CPF.');
    return;
  }

  processing.value = true;
  try {
    const data = await apiPost<any>('/catalog/checkout', {
      content_id: props.item.id,
      name: name.value.trim(),
      email: email.value.trim(),
      cpf: cpf.value.trim(),
      billingType: billingType.value,
    });

    checkoutResult.value = data;
    step.value = 'payment';

    if (data?.paymentId) {
      startPolling(data.paymentId);
    }
  } catch (err: any) {
    console.error('Checkout error:', err);
    toast.error(err?.data?.detail || err?.message || 'Error processing checkout.');
  } finally {
    processing.value = false;
  }
}

async function handleCancel() {
  if (!checkoutResult.value?.paymentId) {
    emit('close');
    return;
  }
  cancelling.value = true;
  try {
    await apiPost(`/catalog/checkout/${checkoutResult.value.paymentId}/cancel`, {});
    stopPolling();
    step.value = 'cancelled';
  } catch (err) {
    console.error('Cancel checkout error:', err);
    emit('close');
  } finally {
    cancelling.value = false;
  }
}

function copyPixKey() {
  if (checkoutResult.value?.pix?.copyPaste) {
    navigator.clipboard.writeText(checkoutResult.value.pix.copyPaste);
    toast.success('PIX code copied to clipboard!');
  }
}

function handleGoToReader() {
  emit('close');
  router.push(`/activities/hub/${props.item.id}/ler`);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      @click.self="emit('close')"
    >
      <div
        class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface p-6 md:p-8 shadow-2xl transition-all"
        role="dialog"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border pb-4">
          <div class="flex items-center gap-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingCart :size="18" />
            </div>
            <div>
              <h3 class="font-bold text-text text-base">Checkout</h3>
              <p class="text-xs text-text-muted truncate max-w-[280px]">{{ item.title }}</p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-text-muted hover:bg-bgSecondary hover:text-text transition-colors"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- 1. STEP: FORM -->
        <div v-if="step === 'form'" class="mt-5 space-y-4">
          <div class="rounded-xl border border-border bg-bgSecondary/40 p-4 flex items-center justify-between">
            <span class="text-sm font-semibold text-text truncate pr-2">{{ item.title }}</span>
            <span class="text-lg font-black text-primary shrink-0">{{ formatPrice(item.price) }}</span>
          </div>

          <form @submit.prevent="handleCheckout" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-text mb-1 uppercase tracking-wider">Full Name</label>
              <input
                v-model="name"
                type="text"
                required
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-hidden"
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1 uppercase tracking-wider">Email</label>
              <input
                v-model="email"
                type="email"
                required
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-hidden"
                placeholder="seu.email@exemplo.com"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1 uppercase tracking-wider">CPF / Document</label>
              <input
                :value="cpf"
                @input="handleCpfInput"
                type="text"
                required
                maxlength="18"
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-hidden"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-2 uppercase tracking-wider">Payment Method</label>
              <div class="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  @click="billingType = 'PIX'"
                  :class="[
                    'flex items-center justify-center gap-2 rounded-xl border p-3 font-bold text-xs transition-all',
                    billingType === 'PIX'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-text-muted hover:border-text-muted/40'
                  ]"
                >
                  PIX (Instant)
                </button>
                <button
                  type="button"
                  @click="billingType = 'CREDIT_CARD'"
                  :class="[
                    'flex items-center justify-center gap-2 rounded-xl border p-3 font-bold text-xs transition-all',
                    billingType === 'CREDIT_CARD'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-text-muted hover:border-text-muted/40'
                  ]"
                >
                  Credit Card
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="processing"
              class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:opacity-95 transition-opacity disabled:opacity-50 mt-4 cursor-pointer"
            >
              <Loader2 v-if="processing" class="animate-spin" :size="18" />
              <Lock v-else :size="16" />
              <span>{{ processing ? 'Processing...' : 'Proceed to Payment' }}</span>
            </button>
          </form>
        </div>

        <!-- 2. STEP: PAYMENT (PIX / CARD) -->
        <div v-else-if="step === 'payment'" class="mt-5 space-y-5 text-center">
          <div v-if="checkoutResult?.pix?.qrCode" class="space-y-4">
            <h4 class="font-bold text-text text-sm">Scan the QR Code with your bank app</h4>
            <div class="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-sm">
              <img
                :src="`data:image/png;base64,${checkoutResult.pix.qrCode}`"
                alt="QR Code PIX"
                class="h-full w-full object-contain"
              />
            </div>

            <div class="space-y-2">
              <p class="text-xs text-text-muted">Or copy the PIX Copy & Paste code:</p>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="checkoutResult.pix.copyPaste"
                  class="flex-1 truncate rounded-xl border border-border bg-bgSecondary/60 px-3 py-2 text-xs font-mono text-text"
                />
                <button
                  type="button"
                  @click="copyPixKey"
                  class="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:opacity-90 flex items-center gap-1 shrink-0"
                >
                  <Copy :size="14" />
                  <span>Copy</span>
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="checkoutResult?.invoiceUrl" class="space-y-4 py-4">
            <h4 class="font-bold text-text text-sm">Finish payment on secure gateway</h4>
            <a
              :href="checkoutResult.invoiceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 shadow-md"
            >
              <ExternalLink :size="16" />
              <span>Open Payment Gateway</span>
            </a>
          </div>

          <!-- Polling indicator -->
          <div class="rounded-xl border border-border bg-bgSecondary/30 p-3 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 class="animate-spin text-primary" :size="16" />
            <span>Waiting for payment confirmation automatically...</span>
          </div>

          <div class="pt-2 flex justify-center">
            <button
              type="button"
              :disabled="cancelling"
              @click="handleCancel"
              class="text-xs text-danger font-semibold hover:underline cursor-pointer"
            >
              {{ cancelling ? 'Cancelling...' : 'Cancel payment' }}
            </button>
          </div>
        </div>

        <!-- 3. STEP: CONFIRMED -->
        <div v-else-if="step === 'confirmed'" class="mt-6 space-y-6 text-center py-4">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 :size="36" />
          </div>
          <div>
            <h4 class="text-xl font-bold text-text">Payment Confirmed!</h4>
            <p v-if="contentIsProcessing" class="mt-1 text-sm text-text-muted">
              Your material is being prepared and will be available in your library.
            </p>
            <p v-else class="mt-1 text-sm text-text-muted">
              You now have full access to this exclusive material.
            </p>
          </div>

          <div class="flex gap-3">
            <button
              type="button"
              @click="handleGoToReader"
              class="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 shadow-md cursor-pointer"
            >
              Open Material Now
            </button>
            <button
              type="button"
              @click="emit('close')"
              class="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-text hover:bg-bgSecondary cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        <!-- 4. STEP: CANCELLED -->
        <div v-else-if="step === 'cancelled'" class="mt-6 space-y-4 text-center py-4">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ShieldAlert :size="32" />
          </div>
          <h4 class="text-base font-bold text-text">Payment Cancelled</h4>
          <p class="text-xs text-text-muted">Your order was cancelled without charges.</p>
          <button
            type="button"
            @click="emit('close')"
            class="rounded-xl bg-surface border border-border px-6 py-2.5 text-xs font-bold text-text hover:bg-bgSecondary cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
