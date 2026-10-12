<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const token = ref((route.query.token as string) || '');
const newPassword = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);

const loading = ref(false);
const error = ref('');
const success = ref(false);

async function handleResetPassword() {
  error.value = '';
  if (!token.value) {
    error.value = 'Token de redefinição ausente ou expirado. Solicite um novo link.';
    return;
  }
  if (newPassword.value.length < 6) {
    error.value = 'A nova senha deve ter no mínimo 6 caracteres.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'As senhas informadas não coincidem.';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token.value,
        new_password: newPassword.value,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Não foi possível redefinir a senha.');
    }

    success.value = true;
  } catch (err: any) {
    error.value = err?.message || 'Erro ao processar nova senha.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="relative flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 bg-bg">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Back to Login -->
      <router-link
        to="/login"
        class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft :size="16" />
        <span>Voltar ao login</span>
      </router-link>

      <div class="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <div class="text-center">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary">
            <Lock :size="24" />
          </div>
          <h2 class="font-display mt-4 text-xl font-bold text-ink">
            Criar Nova Senha
          </h2>
          <p class="mt-1 text-xs text-muted">
            Defina sua nova credencial de acesso à plataforma
          </p>
        </div>

        <!-- Success view -->
        <div v-if="success" class="mt-6 space-y-4 text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle :size="32" />
          </div>
          <p class="text-xs font-semibold text-ink">Senha redefinida com sucesso!</p>
          <p class="text-xs text-muted">Você já pode acessar sua conta com a nova senha.</p>
          <router-link to="/login" class="btn-primary w-full py-2.5 text-xs shadow-sm">
            Ir para o Login
          </router-link>
        </div>

        <!-- Form view -->
        <form v-else @submit.prevent="handleResetPassword" class="mt-6 space-y-4">
          <!-- Error Alert -->
          <div
            v-if="error"
            class="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger animate-fadeIn"
          >
            <AlertCircle :size="16" class="mt-0.5 flex-shrink-0" />
            <span class="flex-1 leading-relaxed">{{ error }}</span>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Nova senha (mínimo 6 dígitos)</label>
            <div class="relative">
              <input
                v-model="newPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                minlength="6"
                placeholder="Digite a nova senha"
                class="input-app w-full pr-10 text-xs"
              />
              <button
                type="button"
                class="absolute right-3 top-3 text-muted hover:text-ink"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Confirmar nova senha</label>
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              required
              minlength="6"
              placeholder="Repita a nova senha"
              class="input-app w-full text-xs"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="btn-primary w-full py-3 text-xs shadow-sm"
          >
            <Loader2 v-if="loading" :size="16" class="animate-spin" />
            <span v-else>Salvar Nova Senha</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
