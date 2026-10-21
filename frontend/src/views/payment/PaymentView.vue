<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Crown, ArrowLeft, Check, Zap, Loader2, Copy, ExternalLink, X } from 'lucide-vue-next';
import { apiGet, apiPost, apiPut } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { formatPrice } from '@/types/catalog';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight?: boolean;
  available?: boolean;
  available_from?: string;
  notice?: string;
}

interface SubscribeResponse {
  subscriptionId: string;
  paymentId: string;
  invoiceUrl: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  value: number;
  planName: string;
  billingType?: string;
}

const router = useRouter();
const { user } = useAuth();
const toast = useToast();

const plans = ref<Plan[]>([]);
const isLoading = ref(true);
const selectedPlan = ref<Plan | null>(null);
const isCheckoutOpen = ref(false);

const docCpf = ref((user.value as any)?.cpf || (user.value as any)?.cpf_cnpj || '');
const paymentMethod = ref<'PIX' | 'CREDIT_CARD'>('PIX');
const isSubscribing = ref(false);

const pixData = ref<SubscribeResponse | null>(null);
const isPixModalOpen = ref(false);

const redirectData = ref<SubscribeResponse | null>(null);
const isRedirectModalOpen = ref(false);

async function loadPlans() {
  isLoading.value = true;
  try {
    const res = await apiGet<Plan[]>('/payments/plans');
    plans.value = res || [];
  } catch (err) {
    console.error('Error loading plans:', err);
    // Fallback plans if backend plans endpoint has issue
    plans.value = [
      {
        id: 'full',
        name: 'Plano Fluência Completa',
        price: 49.9,
        description: 'Acesso total a todas as ferramentas, conversação ilimitada e materiais.',
        features: [
          'Conversas ilimitadas por voz e texto',
          'Acesso completo a todas as atividades e exames',
          'Correção gramatical avançada em tempo real',
          'Todos os materiais do Taty’s Materials inclusos',
          'Feedback pedagógico individual e relatórios CEFR',
        ],
        highlight: true,
      },
      {
        id: 'chat_voice',
        name: 'Plano Prática Diária',
        price: 29.9,
        description: 'Prática de conversação por texto e voz ilimitada com Teacher Tati.',
        features: [
          'Conversas ilimitadas por voz e texto',
          'Dicionário integrado com pronúncia nativa',
          'Competições e rankings semanais',
          'Flashcards com repetição espaçada',
        ],
        highlight: false,
      },
    ];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadPlans();
});

function openCheckout(plan: Plan) {
  selectedPlan.value = plan;
  isCheckoutOpen.value = true;
}

async function handleSubscribe() {
  if (!selectedPlan.value) return;
  if (!docCpf.value.trim()) {
    toast.error('Please enter your CPF / document.');
    return;
  }

  isSubscribing.value = true;
  try {
    await apiPut('/profile/', { cpf: docCpf.value.trim(), cpf_cnpj: docCpf.value.trim() }).catch(() => {});

    const res = await apiPost<SubscribeResponse>('/payments/subscribe', {
      planType: selectedPlan.value.id,
      billingType: paymentMethod.value,
    });

    isCheckoutOpen.value = false;

    if (paymentMethod.value === 'PIX' && res?.pixQrCode) {
      pixData.value = { ...res, billingType: 'PIX' };
      isPixModalOpen.value = true;
    } else if (res?.invoiceUrl) {
      redirectData.value = { ...res, billingType: paymentMethod.value };
      isRedirectModalOpen.value = true;
    } else {
      router.push('/receipt?plan=' + selectedPlan.value.id);
    }
  } catch (err: any) {
    console.error('Subscribe error:', err);
    toast.error(err?.data?.detail || err?.message || 'Error processing subscription.');
  } finally {
    isSubscribing.value = false;
  }
}

function copyPixKey() {
  if (pixData.value?.pixCopyPaste) {
    navigator.clipboard.writeText(pixData.value.pixCopyPaste);
    toast.success('PIX code copied!');
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg text-text flex flex-col relative overflow-hidden">
    <!-- Header -->
    <header class="p-6 flex justify-between items-center border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-40">
      <div class="flex items-center gap-3">
        <div class="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center text-primary shadow-sm shadow-primary/20">
          <Crown :size="22" fill="currentColor" />
        </div>
        <div>
          <h1 class="text-xl font-black text-text">Premium Plan</h1>
          <p class="text-[10px] text-text-muted font-black uppercase tracking-widest">Upgrade your experience</p>
        </div>
      </div>
      <RouterLink
        to="/chat"
        class="flex items-center gap-2 text-text-muted hover:text-primary transition-colors font-bold text-xs"
      >
        <ArrowLeft :size="16" />
        <span>Back to Chat</span>
      </RouterLink>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col items-center">
      <div class="max-w-4xl w-full space-y-12 py-10">
        <header class="text-center space-y-4 max-w-2xl mx-auto">
          <h2 class="text-3xl md:text-5xl font-black tracking-tight leading-tight text-text">
            Acelere sua fluência com o <span class="text-primary italic">Plano Ilimitado</span>
          </h2>
          <p class="text-text-muted text-base md:text-lg">
            Pratique sem limites, acesse conteúdos exclusivos e receba feedbacks pedagógicos detalhados.
          </p>
        </header>

        <!-- Loading -->
        <div v-if="isLoading" class="flex justify-center py-20">
          <Loader2 class="animate-spin text-primary" :size="36" />
        </div>

        <!-- Plans Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          <div
            v-for="plan in plans"
            :key="plan.id"
            :class="[
              'rounded-3xl border p-8 flex flex-col justify-between transition-all duration-300 relative',
              plan.highlight
                ? 'border-primary bg-surface shadow-2xl shadow-primary/10 scale-102 ring-2 ring-primary/20'
                : 'border-border bg-surface shadow-sm hover:border-text-muted/40'
            ]"
          >
            <div
              v-if="plan.highlight"
              class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm"
            >
              Mais Popular
            </div>

            <div>
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-xl font-black text-text">{{ plan.name }}</h3>
                  <p class="text-xs text-text-muted mt-1">{{ plan.description }}</p>
                </div>
              </div>

              <div class="my-6">
                <span class="text-4xl font-black text-text">{{ formatPrice(plan.price) }}</span>
                <span class="text-xs text-text-muted font-bold"> / mês</span>
              </div>

              <!-- Features List -->
              <ul class="space-y-3 pt-4 border-t border-border/60">
                <li
                  v-for="(feature, idx) in plan.features"
                  :key="idx"
                  class="flex items-start gap-2.5 text-xs text-text"
                >
                  <div class="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Check :size="10" stroke-width="3" />
                  </div>
                  <span>{{ feature }}</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              @click="openCheckout(plan)"
              :class="[
                'w-full mt-8 rounded-2xl py-3.5 text-xs font-black transition-all cursor-pointer shadow-md',
                plan.highlight
                  ? 'bg-primary text-white hover:opacity-95 shadow-primary/20'
                  : 'bg-bgSecondary text-text hover:bg-border'
              ]"
            >
              Assinar {{ plan.name }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal: Checkout CPF + Payment Method -->
    <div
      v-if="isCheckoutOpen && selectedPlan"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click.self="isCheckoutOpen = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <h3 class="font-bold text-text text-base">Confirmar Assinatura</h3>
          <button @click="isCheckoutOpen = false" class="text-text-muted hover:text-text">
            <X :size="18" />
          </button>
        </div>

        <div class="rounded-xl bg-bgSecondary/60 p-3 flex justify-between items-center text-xs">
          <span class="font-bold text-text">{{ selectedPlan.name }}</span>
          <span class="font-black text-primary text-sm">{{ formatPrice(selectedPlan.price) }}/mês</span>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-text mb-1 uppercase tracking-wider">CPF / Documento</label>
            <input
              v-model="docCpf"
              type="text"
              class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-text mb-2 uppercase tracking-wider">Forma de Pagamento</label>
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                @click="paymentMethod = 'PIX'"
                :class="[
                  'rounded-xl border p-3 font-bold text-xs transition-all cursor-pointer',
                  paymentMethod === 'PIX'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted hover:border-text-muted/40'
                ]"
              >
                PIX
              </button>
              <button
                type="button"
                @click="paymentMethod = 'CREDIT_CARD'"
                :class="[
                  'rounded-xl border p-3 font-bold text-xs transition-all cursor-pointer',
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted hover:border-text-muted/40'
                ]"
              >
                Cartão de Crédito
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          :disabled="isSubscribing"
          @click="handleSubscribe"
          class="w-full rounded-xl bg-primary py-3 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-md"
        >
          <Loader2 v-if="isSubscribing" class="animate-spin" :size="16" />
          <span>{{ isSubscribing ? 'Processando...' : 'Finalizar Assinatura' }}</span>
        </button>
      </div>
    </div>

    <!-- Modal: PIX QR Code -->
    <div
      v-if="isPixModalOpen && pixData"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click.self="isPixModalOpen = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl text-center space-y-4">
        <h3 class="font-bold text-text text-base">Pagamento via PIX</h3>
        <p class="text-xs text-text-muted">Escaneie o QR Code abaixo pelo aplicativo do seu banco:</p>

        <div v-if="pixData.pixQrCode" class="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-xs">
          <img
            :src="pixData.pixQrCode.startsWith('data:') ? pixData.pixQrCode : `data:image/png;base64,${pixData.pixQrCode}`"
            alt="PIX QR Code"
            class="h-full w-full object-contain"
          />
        </div>

        <div v-if="pixData.pixCopyPaste" class="space-y-2">
          <p class="text-[11px] text-text-muted">Ou copie o código Copia e Cola:</p>
          <div class="flex items-center gap-2">
            <input
              type="text"
              readonly
              :value="pixData.pixCopyPaste"
              class="flex-1 truncate rounded-xl border border-border bg-bgSecondary px-3 py-2 text-xs font-mono text-text"
            />
            <button
              type="button"
              @click="copyPixKey"
              class="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:opacity-90 flex items-center gap-1"
            >
              <Copy :size="14" />
              <span>Copiar</span>
            </button>
          </div>
        </div>

        <div class="pt-4 flex justify-between gap-3">
          <RouterLink
            to="/receipt"
            class="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-white hover:opacity-90 shadow-md"
          >
            Já realizei o pagamento
          </RouterLink>
          <button
            type="button"
            @click="isPixModalOpen = false"
            class="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text hover:bg-bgSecondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Redirect Gateway -->
    <div
      v-if="isRedirectModalOpen && redirectData"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click.self="isRedirectModalOpen = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl text-center space-y-4">
        <h3 class="font-bold text-text text-base">Gateway Seguro de Pagamento</h3>
        <p class="text-xs text-text-muted">Clique no botão abaixo para concluir o pagamento com segurança no gateway:</p>

        <a
          :href="redirectData.invoiceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-xs font-bold text-white hover:opacity-90 shadow-md"
        >
          <ExternalLink :size="16" />
          <span>Ir para o Pagamento</span>
        </a>

        <div class="pt-4 flex justify-center">
          <button
            type="button"
            @click="isRedirectModalOpen = false"
            class="rounded-xl border border-border px-6 py-2.5 text-xs font-bold text-text hover:bg-bgSecondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
