<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  Lock,
  Mail,
  User as UserIcon,
  Sparkles,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

type Tab = 'login' | 'register' | 'forgot';
const activeTab = ref<Tab>(
  route.query.tab === 'register' ? 'register' : route.query.tab === 'forgot' ? 'forgot' : 'login'
);

// Login state
const identifier = ref('');
const password = ref('');
const showPassword = ref(false);

// Register state
const registerName = ref('');
const registerEmail = ref('');
const registerUsername = ref('');
const registerPassword = ref('');
const showRegisterPassword = ref(false);
const registerLevel = ref('A1');
const acceptedTerms = ref(false);

// Forgot state
const forgotEmail = ref('');

// Status feedback
const loading = ref(false);
const error = ref('');
const success = ref('');

const googleBtnRef = ref<HTMLDivElement | null>(null);
const clientId =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  '237918390149-kh6ta3o2d011ehkqn2s3iept839asarl.apps.googleusercontent.com';

let googleRetryTimer: any = null;

function clearMessages() {
  error.value = '';
  success.value = '';
}

function switchTab(tab: Tab) {
  activeTab.value = tab;
  clearMessages();
  if (tab === 'login') {
    nextTick(() => renderGoogleButton());
  }
}

async function handleGoogleCredential(response: { credential?: string }) {
  if (!response?.credential) return;
  clearMessages();
  loading.value = true;
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, is_hub_only: false }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Falha ao autenticar com Google');
    }

    const data = await res.json();
    if (data.access_token && data.user) {
      authStore.saveSession(data.access_token, data.user, data.refresh_token);
      const redirectPath = (route.query.redirect as string) || '/chat';
      router.replace(redirectPath);
    } else {
      throw new Error('Resposta de autenticação inválida.');
    }
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível entrar com Google. Tente novamente.';
  } finally {
    loading.value = false;
  }
}

function renderGoogleButton() {
  if (typeof window === 'undefined') return;
  const google = (window as any).google;
  if (!google?.accounts?.id || !googleBtnRef.value) {
    if (!googleRetryTimer) {
      googleRetryTimer = setTimeout(() => {
        googleRetryTimer = null;
        renderGoogleButton();
      }, 400);
    }
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    googleBtnRef.value.innerHTML = '';
    google.accounts.id.renderButton(googleBtnRef.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320,
      logo_alignment: 'left',
    });
  } catch (e) {
    console.warn('Erro ao inicializar botão do Google:', e);
  }
}

async function handleLogin() {
  clearMessages();
  loading.value = true;
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: identifier.value.trim(),
        username: identifier.value.trim(),
        password: password.value,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Usuário ou senha incorretos.');
    }

    const data = await res.json();
    if (data.access_token && data.user) {
      authStore.saveSession(data.access_token, data.user, data.refresh_token);
      const redirectPath = (route.query.redirect as string) || '/chat';
      router.replace(redirectPath);
    } else {
      throw new Error('Falha ao processar credenciais.');
    }
  } catch (err: any) {
    error.value = err?.message || 'Erro ao realizar login.';
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  clearMessages();
  if (!acceptedTerms.value) {
    error.value = 'Você precisa aceitar os termos de uso e política de privacidade.';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: registerName.value.trim(),
        email: registerEmail.value.trim().toLowerCase(),
        username: registerUsername.value.trim().toLowerCase(),
        password: registerPassword.value,
        level: registerLevel.value,
        parental_consent: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Não foi possível criar sua conta.');
    }

    const data = await res.json();
    if (data.access_token && data.user) {
      authStore.saveSession(data.access_token, data.user, data.refresh_token);
      router.replace('/chat');
    } else {
      success.value = 'Conta criada com sucesso! Faça login para continuar.';
      activeTab.value = 'login';
    }
  } catch (err: any) {
    error.value = err?.message || 'Erro ao criar conta.';
  } finally {
    loading.value = false;
  }
}

async function handleForgotPassword() {
  clearMessages();
  if (!forgotEmail.value) {
    error.value = 'Por favor, informe seu e-mail cadastrado.';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: forgotEmail.value.trim() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erro ao solicitar redefinição.');
    }

    success.value = 'Instruções para redefinição enviadas para o seu e-mail.';
  } catch (err: any) {
    error.value = err?.message || 'Erro ao enviar e-mail de recuperação.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (activeTab.value === 'login') {
    nextTick(() => renderGoogleButton());
  }
});

onUnmounted(() => {
  if (googleRetryTimer) clearTimeout(googleRetryTimer);
});
</script>

<template>
  <div class="relative flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8 bg-bg">
    <!-- Background Glow -->
    <div class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[450px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px]" />

    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <!-- Back to Landing Link -->
      <router-link
        to="/"
        class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft :size="16" />
        <span>Voltar para a página inicial</span>
      </router-link>

      <!-- Logo & Title -->
      <div class="text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primarySoft shadow-sm">
          <img src="/images/tati_logo.jpg" alt="Teacher Tati Logo" class="h-full w-full object-cover" />
        </div>
        <h2 class="font-display mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Teacher Tati AI
        </h2>
        <p class="mt-1 text-xs text-muted">
          Sua professora de inglês com IA personalizada 24/7
        </p>
      </div>

      <!-- Tabs Navigation -->
      <div class="mt-8 flex rounded-xl border border-line bg-surface p-1 shadow-sm">
        <button
          type="button"
          class="flex-1 rounded-lg py-2 text-xs font-bold transition"
          :class="activeTab === 'login' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
          @click="switchTab('login')"
        >
          Entrar
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg py-2 text-xs font-bold transition"
          :class="activeTab === 'register' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
          @click="switchTab('register')"
        >
          Criar Conta
        </button>
      </div>

      <!-- Main Card -->
      <div class="mt-4 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/10 p-3 text-xs text-danger animate-fadeIn"
        >
          <AlertCircle :size="16" class="mt-0.5 flex-shrink-0" />
          <span class="flex-1 leading-relaxed">{{ error }}</span>
        </div>

        <!-- Success Alert -->
        <div
          v-if="success"
          class="mb-5 flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/10 p-3 text-xs text-success animate-fadeIn"
        >
          <CheckCircle :size="16" class="mt-0.5 flex-shrink-0" />
          <span class="flex-1 leading-relaxed">{{ success }}</span>
        </div>

        <!-- TAB 1: LOGIN -->
        <div v-if="activeTab === 'login'" class="space-y-4">
          <!-- Google Auth Button Container -->
          <div class="flex flex-col items-center">
            <div ref="googleBtnRef" class="min-h-[44px] w-full flex justify-center" />
          </div>

          <div class="relative my-4 flex items-center justify-center">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-line" />
            </div>
            <span class="relative bg-surface px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              ou com suas credenciais
            </span>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Usuário ou E-mail</label>
              <div class="relative">
                <input
                  v-model="identifier"
                  type="text"
                  required
                  autocomplete="username"
                  placeholder="Seu usuário ou e-mail"
                  class="input-app w-full pl-9 text-xs"
                />
                <UserIcon :size="15" class="absolute left-3 top-3 text-muted" />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold text-muted">Senha</label>
                <button
                  type="button"
                  class="text-[11px] font-semibold text-primary hover:underline"
                  @click="switchTab('forgot')"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div class="relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="Sua senha secreta"
                  class="input-app w-full pl-9 pr-10 text-xs"
                />
                <Lock :size="15" class="absolute left-3 top-3 text-muted" />
                <button
                  type="button"
                  class="absolute right-3 top-3 text-muted hover:text-ink"
                  aria-label="Alternar visibilidade da senha"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="btn-primary w-full py-3 text-xs shadow-sm"
            >
              <Loader2 v-if="loading" :size="16" class="animate-spin" />
              <span v-else>Entrar na Plataforma</span>
            </button>
          </form>
        </div>

        <!-- TAB 2: REGISTER -->
        <div v-else-if="activeTab === 'register'" class="space-y-4">
          <form @submit.prevent="handleRegister" class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Nome completo</label>
              <input
                v-model="registerName"
                type="text"
                required
                placeholder="Como a Teacher Tati deve te chamar?"
                class="input-app w-full text-xs"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">E-mail</label>
              <input
                v-model="registerEmail"
                type="email"
                required
                placeholder="seu.email@exemplo.com"
                class="input-app w-full text-xs"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Nome de usuário</label>
              <input
                v-model="registerUsername"
                type="text"
                required
                placeholder="ex: caio_aluno"
                class="input-app w-full text-xs"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Nível de Inglês Inicial</label>
              <select
                v-model="registerLevel"
                class="input-app w-full text-xs"
              >
                <option value="A1">A1 - Iniciante (Primeiro contato)</option>
                <option value="A2">A2 - Básico (Frases simples do dia a dia)</option>
                <option value="B1">B1 - Intermediário (Consigo conversar um pouco)</option>
                <option value="B2">B2 - Independente (Fluente em diversos tópicos)</option>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">Senha (mínimo 6 caracteres)</label>
              <div class="relative">
                <input
                  v-model="registerPassword"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  placeholder="Crie uma senha forte"
                  class="input-app w-full pr-10 text-xs"
                />
                <button
                  type="button"
                  class="absolute right-3 top-3 text-muted hover:text-ink"
                  aria-label="Alternar visibilidade da senha"
                  @click="showRegisterPassword = !showRegisterPassword"
                >
                  <EyeOff v-if="showRegisterPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </div>

            <div class="flex items-start gap-2 pt-1 text-xs text-muted">
              <input
                v-model="acceptedTerms"
                type="checkbox"
                required
                id="termsCheck"
                class="mt-0.5 rounded border-line text-primary focus:ring-primary"
              />
              <label for="termsCheck" class="leading-relaxed">
                Li e concordo com os
                <router-link to="/privacy" class="text-primary hover:underline" target="_blank">Termos de Uso</router-link>
                e a Política de Privacidade (LGPD).
              </label>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="btn-primary w-full py-3 text-xs shadow-sm"
            >
              <Loader2 v-if="loading" :size="16" class="animate-spin" />
              <span v-else>Criar Minha Conta Grátis</span>
            </button>
          </form>
        </div>

        <!-- TAB 3: FORGOT PASSWORD -->
        <div v-else-if="activeTab === 'forgot'" class="space-y-4">
          <p class="text-xs leading-relaxed text-muted">
            Informe seu e-mail cadastrado. Enviaremos um link seguro para você redefinir sua senha em poucos minutos.
          </p>

          <form @submit.prevent="handleForgotPassword" class="space-y-4">
            <div>
              <label class="mb-1 block text-xs font-semibold text-muted">E-mail cadastrado</label>
              <div class="relative">
                <input
                  v-model="forgotEmail"
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  class="input-app w-full pl-9 text-xs"
                />
                <Mail :size="15" class="absolute left-3 top-3 text-muted" />
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="btn-primary w-full py-3 text-xs shadow-sm"
            >
              <Loader2 v-if="loading" :size="16" class="animate-spin" />
              <span v-else>Enviar Link de Redefinição</span>
            </button>

            <button
              type="button"
              class="btn-secondary w-full py-2.5 text-xs"
              @click="switchTab('login')"
            >
              Voltar ao Login
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
