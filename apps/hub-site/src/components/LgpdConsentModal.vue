<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Shield, Lock, FileText, ExternalLink, LogOut, CheckCircle2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { recordConsent } from '@tati/hub-core';

const router = useRouter();
const authStore = useAuthStore();

const acceptedTerms = ref(false);
const parentalConsent = ref(false);
const isSubmitting = ref(false);
const isDismissed = ref(false);

const shouldShowModal = computed(() => {
  if (!authStore.isLoaded || !authStore.token || !authStore.user) {
    return false;
  }
  const consent = (authStore.user as any)?.profile?.lgpd_consent;
  const hasAccepted = Boolean(consent?.accepted_terms && consent?.terms_version === '2.2');
  return !isDismissed.value && !hasAccepted;
});

function handleRefuse() {
  authStore.logout();
  router.push('/login');
}

async function handleAccept() {
  if (!acceptedTerms.value || !parentalConsent.value) return;
  isSubmitting.value = true;
  try {
    await recordConsent({
      accepted_terms: true,
      parental_consent: true,
    });
    isDismissed.value = true;
    await authStore.refreshProfile();
  } catch (err: any) {
    console.error('Erro ao registrar consentimento LGPD:', err);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shouldShowModal"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden bg-ink/60 backdrop-blur-sm"
    >
      <div class="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield :size="22" />
          </div>
          <div>
            <h3 class="font-display text-lg font-bold text-ink">Privacidade e Proteção de Dados</h3>
            <p class="text-xs text-muted">Termos de Uso e Política de Privacidade (LGPD)</p>
          </div>
        </div>

        <p class="text-sm leading-relaxed text-muted mb-4">
          Para continuar utilizando o Hub e acessar seus materiais com segurança, confirme que você leu e concorda com as nossas diretrizes de privacidade.
        </p>

        <div class="space-y-3 rounded-xl border border-line bg-bgSecondary/50 p-4 mb-5">
          <label class="flex items-start gap-3 cursor-pointer text-xs leading-relaxed text-ink">
            <input
              v-model="acceptedTerms"
              type="checkbox"
              class="mt-0.5 rounded text-primary focus:ring-primary"
            />
            <span>
              Li e concordo com os <strong>Termos de Uso</strong> e <strong>Política de Privacidade</strong>.
            </span>
          </label>

          <label class="flex items-start gap-3 cursor-pointer text-xs leading-relaxed text-ink">
            <input
              v-model="parentalConsent"
              type="checkbox"
              class="mt-0.5 rounded text-primary focus:ring-primary"
            />
            <span>
              Declaro que possuo mais de 18 anos ou autorização dos pais/responsáveis.
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="btn-secondary text-xs flex items-center gap-1.5"
            @click="handleRefuse"
          >
            <LogOut :size="14" />
            Recusar e Sair
          </button>
          <button
            type="button"
            :disabled="!acceptedTerms || !parentalConsent || isSubmitting"
            class="btn-primary text-xs flex items-center gap-1.5"
            @click="handleAccept"
          >
            <CheckCircle2 :size="14" />
            {{ isSubmitting ? 'Registrando...' : 'Concordar e Continuar' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
