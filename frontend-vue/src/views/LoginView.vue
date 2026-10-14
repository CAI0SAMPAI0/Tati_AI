<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, Bug, Eye, EyeOff, Loader2 } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import DeveloperBugModal from '@/components/feedback/DeveloperBugModal.vue';

type Tab = 'login' | 'register' | 'forgot' | 'reset';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const activeTab = ref<Tab>(
  route.query.tab === 'register' ? 'register' : route.query.tab === 'forgot' ? 'forgot' : 'login'
);

const error = ref('');
const success = ref('');
const loading = ref(false);
const showBugModal = ref(false);

// Password visibility
const showLoginPassword = ref(false);
const showRegPassword = ref(false);
const showResetPassword = ref(false);
const showConfirmPassword = ref(false);

// Login state
const loginId = ref('');
const loginPw = ref('');

// Register state
const regName = ref('');
const regEmail = ref('');
const regUsername = ref('');
const regPassword = ref('');
const regLevel = ref('A1');
const acceptedTerms = ref(false);
const parentalConsent = ref(false);

// Forgot state
const forgotId = ref('');
const forgotResult = ref<{ type: 'success' | 'error'; html: string } | null>(null);

// Reset state
const resetToken = ref('');
const resetPw = ref('');
const resetConfirmPw = ref('');
const resetDone = ref(false);

const levelOptions = [
  { value: 'A1', label: 'A1 - Beginner' },
  { value: 'A2', label: 'A2 - Pre-Intermediate' },
  { value: 'B1', label: 'B1 - Intermediate' },
  { value: 'B2', label: 'B2 - Upper-Intermediate' },
  { value: 'C1', label: 'C1 - Advanced' },
];

const isHubAccess = computed(() => route.query.access === 'hub');

function clearMessages() {
  error.value = '';
  success.value = '';
  forgotResult.value = null;
}

function switchTab(tab: Tab) {
  activeTab.value = tab;
  clearMessages();
}

async function handleGoogleCredential(response: { credential: string }) {
  clearMessages();
  loading.value = true;
  try {
    const res = await fetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential, is_hub_only: isHubAccess.value }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.detail || 'Error authenticating with Google.';
      return;
    }

    authStore.saveSession(data.access_token, data.user, data.refresh_token);
    const user = data.user as any;
    if (isHubAccess.value || user?.is_hub_only) {
      window.location.href = 'http://localhost:3001/materiais';
    } else {
      router.push('/chat');
    }
  } catch {
    error.value = 'Connection error. Check if the server is running.';
  } finally {
    loading.value = false;
  }
}

function handleGoogleLogin() {
  clearMessages();
  loading.value = true;
  error.value = '';

  if (typeof window !== 'undefined') {
    const isFlutter = (window as any).isFlutterApp || (window as any).flutter_inappwebview;
    if (isFlutter && (window as any).flutter_inappwebview?.callHandler) {
      (window as any).flutter_inappwebview
        .callHandler('googleLogin')
        .then(async (res: any) => {
          try {
            if (res && res.token && res.user) {
              authStore.saveSession(res.token, res.user, res.refreshToken || res.refresh_token);
              router.push('/chat');
            } else if (res && res.success) {
              router.push('/chat');
            } else {
              loading.value = false;
            }
          } catch (sessionErr) {
            console.error('[Login] Flutter google session error:', sessionErr);
            loading.value = false;
            error.value = 'Erro ao salvar sessão.';
          }
        })
        .catch(() => {
          loading.value = false;
        });
      return;
    }
  }

  const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const hubParam = isHubAccess.value ? '&access=hub' : '';
  window.location.href = `/auth/google/login?origin=${origin}${hubParam}`;
}

async function handleLogin() {
  clearMessages();
  if (!loginId.value || !loginPw.value) {
    error.value = 'Please fill in all fields.';
    return;
  }
  loading.value = true;
  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginId.value.trim(),
        identifier: loginId.value.trim(),
        password: loginPw.value,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.detail || 'Invalid credentials.';
      return;
    }

    authStore.saveSession(data.access_token, data.user, data.refresh_token);
    const user = data.user as any;
    if (isHubAccess.value || user?.is_hub_only) {
      window.location.href = 'http://localhost:3001/materiais';
    } else {
      router.push('/chat');
    }
  } catch {
    error.value = 'Connection error. Check if the server is running.';
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  clearMessages();
  if (!regName.value || !regEmail.value || !regUsername.value || !regPassword.value) {
    error.value = 'Please fill in all fields.';
    return;
  }
  if (regPassword.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    return;
  }
  if (!acceptedTerms.value) {
    error.value = 'É obrigatório aceitar os Termos de Uso e Política de Privacidade (LGPD).';
    return;
  }
  if (!parentalConsent.value) {
    error.value = 'Por favor, confirme a declaração de maioridade ou autorização dos pais/responsáveis (Art. 14 da LGPD).';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: regName.value.trim(),
        email: regEmail.value.trim().toLowerCase(),
        username: regUsername.value.trim().toLowerCase(),
        password: regPassword.value,
        level: regLevel.value,
        is_hub_only: isHubAccess.value,
        accepted_terms: acceptedTerms.value,
        parental_consent: parentalConsent.value,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.detail || 'Error creating account.';
      return;
    }

    // Tenta login automático pós-cadastro
    const loginRes = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: regUsername.value.trim(),
        password: regPassword.value,
      }),
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json().catch(() => ({}));
      authStore.saveSession(loginData.access_token, loginData.user, loginData.refresh_token);
      router.push('/chat');
      return;
    }

    success.value = 'Account created! Sign in now.';
    setTimeout(() => switchTab('login'), 1500);
  } catch {
    error.value = 'Connection error. Check if the server is running.';
  } finally {
    loading.value = false;
  }
}

async function handleForgot() {
  clearMessages();
  if (!forgotId.value) {
    error.value = 'Please enter your username or email.';
    return;
  }
  loading.value = true;
  try {
    const base_url = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: forgotId.value.trim(), base_url }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.detail || 'Error requesting password reset.';
      return;
    }

    if (data.reset_token) {
      resetToken.value = data.reset_token;
      forgotResult.value = { type: 'success', html: 'Enter your new password below.' };
      activeTab.value = 'reset';
    } else {
      forgotResult.value = { type: 'success', html: data.message || 'Check your email for the reset link.' };
    }
  } catch {
    error.value = 'Connection error. Check if the server is running.';
  } finally {
    loading.value = false;
  }
}

async function handleResetSubmit() {
  clearMessages();
  if (!resetToken.value) {
    error.value = 'No reset token.';
    return;
  }
  if (resetPw.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    return;
  }
  if (resetPw.value !== resetConfirmPw.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  try {
    const res = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken.value, new_password: resetPw.value }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value = data.detail || 'Error resetting password.';
      return;
    }

    resetDone.value = true;
    forgotResult.value = { type: 'success', html: 'Password reset successfully! Redirecting to login...' };
    setTimeout(() => {
      switchTab('login');
      resetDone.value = false;
      resetToken.value = '';
      resetPw.value = '';
      resetConfirmPw.value = '';
    }, 2000);
  } catch {
    error.value = 'Connection error. Check if the server is running.';
  } finally {
    loading.value = false;
  }
}

function handleGoogleMessage(event: MessageEvent) {
  if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.token) {
    authStore.saveSession(
      event.data.token,
      event.data.user || { username: 'student' },
      event.data.refreshToken || event.data.refresh_token
    );
    if (isHubAccess.value || event.data.user?.is_hub_only) {
      window.location.href = 'http://localhost:3001/materiais';
    } else {
      router.replace('/chat');
    }
  }
}

onMounted(() => {
  window.addEventListener('message', handleGoogleMessage);

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refreshToken = params.get('refresh_token');
  const userParam = params.get('user');

  if (token) {
    let userObj: any = null;
    try {
      if (userParam) {
        try {
          userObj = JSON.parse(userParam);
        } catch {
          userObj = JSON.parse(decodeURIComponent(userParam));
        }
      }
    } catch (_) {}

    window.history.replaceState({}, '', window.location.pathname);

    authStore.saveSession(token, userObj || { username: 'student' }, refreshToken || undefined);
    if (isHubAccess.value || userObj?.is_hub_only) {
      window.location.href = 'http://localhost:3001/materiais';
    } else {
      router.replace('/chat');
    }
    return;
  }

  const credential = params.get('credential');
  if (credential) {
    handleGoogleCredential({ credential });
    window.history.replaceState({}, '', window.location.pathname);
  }
});

onUnmounted(() => {
  window.removeEventListener('message', handleGoogleMessage);
});
</script>

<template>
  <main class="min-h-screen w-full flex flex-col items-center justify-center bg-bg relative overflow-y-auto py-6 px-4 sm:px-6">
    <div class="relative z-10 w-full max-w-[28.125rem] flex flex-col items-center my-auto">

      <!-- Voltar para a página inicial -->
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors mb-6 group self-start sm:self-center"
      >
        <ArrowLeft :size="14" class="group-hover:-translate-x-0.5 transition-transform" />
        <span>Go to Home Page</span>
      </router-link>

      <!-- Logo / Header -->
      <div class="text-center mb-6 w-full">
        <img
          src="/images/tati_logo.jpg"
          alt="Taty's Hub"
          class="w-[72px] h-[72px] rounded-full object-cover object-top border-[3px] border-border shadow-[0_4px_16px_rgba(0,0,0,0.1)] mb-3 mx-auto"
        />
        <h1 class="font-display text-2xl font-extrabold text-text tracking-tight mb-1">Taty's Hub</h1>
        <p class="text-[0.83rem] text-text-muted max-w-[17.5rem] leading-relaxed mx-auto">
          Your AI English teacher. Practice whenever you want, at your own pace.
        </p>
      </div>

      <!-- Tabs - Sign in / Create Account -->
      <div
        v-if="activeTab !== 'forgot' && activeTab !== 'reset'"
        class="flex bg-bg-secondary rounded-full p-[4px] mb-5 w-full max-w-[23.75rem] border border-border shadow-sm"
      >
        <button
          type="button"
          @click="switchTab('login')"
          class="flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-base cursor-pointer"
          :class="activeTab === 'login' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          Sign in
        </button>
        <button
          type="button"
          @click="switchTab('register')"
          class="flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-base cursor-pointer"
          :class="activeTab === 'register' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          Create Account
        </button>
      </div>

      <!-- Formulário Card Responsivo -->
      <div class="w-full bg-surface rounded-[24px] border border-border shadow-lg p-6 sm:p-7.5">
        <!-- Error Alert -->
        <div
          v-if="error"
          class="mb-4 bg-danger/10 border border-danger/30 text-danger px-4 py-2.5 rounded-xl text-sm font-medium animate-fadeIn"
        >
          {{ error }}
        </div>

        <!-- Success Alert -->
        <div
          v-if="success"
          class="mb-4 bg-success/10 border border-success/30 text-success px-4 py-2.5 rounded-xl text-sm font-medium animate-fadeIn"
        >
          {{ success }}
        </div>

        <!-- Social Google OAuth Button -->
        <div v-if="activeTab !== 'forgot' && activeTab !== 'reset'">
          <button
            type="button"
            @click="handleGoogleLogin"
            class="w-full py-2.5 bg-input text-text border border-border rounded-full text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-bg-secondary transition-colors cursor-pointer shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div class="flex items-center gap-3 my-4 text-text-subtle text-[0.73rem] tracking-wider">
            <span class="flex-1 h-px bg-border" />
            <span>or</span>
            <span class="flex-1 h-px bg-border" />
          </div>
        </div>

        <!-- Login Form -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="space-y-4">
          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Username or Email
            </label>
            <input
              v-model="loginId"
              type="text"
              autocomplete="username"
              placeholder="Username or Email"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle"
              required
            />
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div class="relative flex items-center">
              <input
                v-model="loginPw"
                :type="showLoginPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="Password"
                class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle pr-11"
                required
              />
              <button
                type="button"
                tabindex="-1"
                @click="showLoginPassword = !showLoginPassword"
                class="absolute right-3 text-text-muted hover:text-primary transition-colors p-1"
              >
                <EyeOff v-if="showLoginPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="text-right -mt-2 mb-3">
            <button
              type="button"
              @click="switchTab('forgot')"
              class="text-primary text-[0.78rem] font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            >
              I forgot my password
            </button>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="relative inline-flex items-center justify-center font-semibold font-body rounded-md transition-all duration-base ease focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-hover hover:shadow-glow hover:-translate-y-px w-full text-sm px-4 py-2.5 cursor-pointer"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
            <span>Sign in</span>
          </button>
        </form>

        <!-- Register Form -->
        <form v-else-if="activeTab === 'register'" @submit.prevent="handleRegister" class="space-y-4">
          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Full name</label>
            <input
              v-model="regName"
              type="text"
              placeholder="Full name"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle"
              required
            />
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Email</label>
            <input
              v-model="regEmail"
              type="email"
              placeholder="Email"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle"
              required
            />
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Username</label>
            <input
              v-model="regUsername"
              type="text"
              placeholder="Username"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle"
              required
            />
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">Password</label>
            <div class="relative flex items-center">
              <input
                v-model="regPassword"
                :type="showRegPassword ? 'text' : 'password'"
                placeholder="Password"
                minlength="6"
                class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle pr-11"
                required
              />
              <button
                type="button"
                tabindex="-1"
                @click="showRegPassword = !showRegPassword"
                class="absolute right-3 text-text-muted hover:text-primary transition-colors p-1"
              >
                <EyeOff v-if="showRegPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">English level</label>
            <select
              v-model="regLevel"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none appearance-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)]"
            >
              <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="space-y-3 my-4 p-3.5 rounded-xl bg-bg-secondary/40 border border-border/80 text-left">
            <label class="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
              <input
                v-model="acceptedTerms"
                type="checkbox"
                class="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <span>
                Li e aceito os
                <router-link
                  to="/privacy"
                  target="_blank"
                  class="text-primary font-bold underline hover:opacity-80 inline-flex items-center gap-0.5 ml-1"
                >
                  Termos de Uso e Política de Privacidade (LGPD)
                </router-link>.
              </span>
            </label>
            <label class="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
              <input
                v-model="parentalConsent"
                type="checkbox"
                class="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <span>
                Declaro que sou maior de 18 anos ou possuo autorização expressa dos pais/responsáveis legais (Art. 14 da LGPD).
              </span>
            </label>
          </div>

          <button
            type="submit"
            :disabled="loading || !acceptedTerms || !parentalConsent"
            class="relative inline-flex items-center justify-center font-semibold font-body rounded-md transition-all duration-base ease focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-hover hover:shadow-glow hover:-translate-y-px w-full text-sm px-4 py-2.5 cursor-pointer"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
            <span>Create Account</span>
          </button>
        </form>

        <!-- Forgot Password Form -->
        <form v-else-if="activeTab === 'forgot'" @submit.prevent="handleForgot" class="space-y-4">
          <button
            type="button"
            @click="switchTab('login')"
            class="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors cursor-pointer"
          >
            ← Back to login
          </button>
          <p class="text-base font-bold text-text mb-1">Forgot my password</p>
          <p class="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Enter your username or email.</p>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Username or Email
            </label>
            <input
              v-model="forgotId"
              type="text"
              autocomplete="username"
              placeholder="Username or Email"
              class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle"
              required
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="relative inline-flex items-center justify-center font-semibold font-body rounded-md transition-all duration-base ease focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-hover hover:shadow-glow hover:-translate-y-px w-full text-sm px-4 py-2.5 cursor-pointer"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
            <span>Reset your password</span>
          </button>

          <div
            v-if="forgotResult"
            :class="forgotResult.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'"
            class="mt-4 p-3.5 rounded-md text-[0.83rem] leading-relaxed border"
          >
            {{ forgotResult.html }}
          </div>
        </form>

        <!-- Reset Password Form (in-app) -->
        <form v-else-if="activeTab === 'reset'" @submit.prevent="handleResetSubmit" class="space-y-4">
          <button
            type="button"
            @click="switchTab('forgot')"
            class="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors cursor-pointer"
          >
            ← Back
          </button>
          <p class="text-base font-bold text-text mb-1">🔐 Reset your password</p>
          <p class="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Choose your new password.</p>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              New Password
            </label>
            <div class="relative flex items-center">
              <input
                v-model="resetPw"
                :type="showResetPassword ? 'text' : 'password'"
                minlength="6"
                placeholder="At least 6 characters"
                class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle pr-11"
                required
              />
              <button
                type="button"
                tabindex="-1"
                @click="showResetPassword = !showResetPassword"
                class="absolute right-3 text-text-muted hover:text-primary transition-colors p-1"
              >
                <EyeOff v-if="showResetPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="mb-4 relative z-[1]">
            <label class="block text-[0.73rem] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
              Confirm Password
            </label>
            <div class="relative flex items-center">
              <input
                v-model="resetConfirmPw"
                :type="showConfirmPassword ? 'text' : 'password'"
                placeholder="Repeat your new password"
                class="w-full px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm font-body outline-none transition-[border-color,box-shadow] duration-base focus:border-border-focus focus:shadow-[0_0_0_3px_hsla(258,80%,58%,0.12)] placeholder:text-text-subtle pr-11"
                required
              />
              <button
                type="button"
                tabindex="-1"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-3 text-text-muted hover:text-primary transition-colors p-1"
              >
                <EyeOff v-if="showConfirmPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="relative inline-flex items-center justify-center font-semibold font-body rounded-md transition-all duration-base ease focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-hover hover:shadow-glow hover:-translate-y-px w-full text-sm px-4 py-2.5 cursor-pointer"
          >
            <Loader2 v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
            <span>Reset Password</span>
          </button>

          <div
            v-if="forgotResult"
            :class="forgotResult.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'"
            class="mt-4 p-3.5 rounded-md text-[0.83rem] leading-relaxed border"
          >
            {{ forgotResult.html }}
          </div>
        </form>
      </div>

      <!-- Rodapé - Suporte Técnico e Feedback -->
      <div class="mt-8 flex flex-col items-center gap-2 text-center w-full">
        <button
          type="button"
          @click="showBugModal = true"
          class="inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-red-500 transition-colors py-1 cursor-pointer font-medium"
        >
          <Bug :size="14" class="text-red-400" />
          <span>Problemas para acessar? <strong class="underline underline-offset-2">Reportar Bug ao Desenvolvedor</strong></span>
        </button>

        <router-link
          to="/atualizar"
          class="inline-flex items-center justify-center gap-1 text-[0.76rem] text-primary/80 hover:text-primary hover:underline transition-colors"
        >
          <span>Baixar ou Atualizar Aplicativo Android (APK)</span>
        </router-link>
      </div>

      <!-- Modal para Reports de Bug do Sistema -->
      <DeveloperBugModal :isOpen="showBugModal" @close="showBugModal = false" />
    </div>
  </main>
</template>
