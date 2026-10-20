<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Bug, ArrowLeft } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import {
  loginWithCredentials,
  loginWithGoogle,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
} from '@/api/auth';
import { LEVEL_OPTIONS } from '@/constants/levels';
import { API_BASE } from '@/api/client';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';
import DeveloperBugModal from '@/components/feedback/DeveloperBugModal.vue';

type Tab = 'login' | 'register' | 'forgot' | 'reset';

const router = useRouter();
const route = useRoute();
const { setSession } = useAuth();
const toast = useToast();

const activeTab = ref<Tab>('login');
const error = ref('');
const success = ref('');
const loading = ref(false);
const showBugModal = ref(false);

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
const forgotResult = ref<{ type: string; html: string } | null>(null);

// Reset state
const resetToken = ref('');
const resetPw = ref('');
const resetConfirmPw = ref('');

function clearMessages() {
  error.value = '';
  success.value = '';
  forgotResult.value = null;
}

function switchTab(tab: Tab) {
  activeTab.value = tab;
  clearMessages();
}

onMounted(() => {
  // Check for google callback tokens in query params
  const token = route.query.token as string | undefined;
  const refreshToken = route.query.refresh_token as string | undefined;
  const userParam = route.query.user as string | undefined;

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
    } catch {}

    setSession(token, userObj || { username: 'student' }, refreshToken);
    router.replace('/chat');
  }
});

function handleGoogleLogin() {
  clearMessages();
  loading.value = true;
  const base = API_BASE || '';
  const origin = encodeURIComponent(window.location.origin);
  const targetUrl = `${base.replace(/\/+$/, '')}/auth/google/login?origin=${origin}`;
  window.location.href = targetUrl;
}

async function handleLogin() {
  clearMessages();
  if (!loginId.value.trim() || !loginPw.value) {
    error.value = 'Please fill in all fields.';
    return;
  }
  loading.value = true;
  try {
    const res = await loginWithCredentials(loginId.value.trim(), loginPw.value);
    setSession(res.access_token, res.user, res.refresh_token);
    router.push('/chat');
  } catch (err: any) {
    error.value = err?.data?.detail || err?.message || 'Invalid credentials.';
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
    error.value = 'Por favor, confirme a declaração de maioridade ou autorização dos pais/responsáveis.';
    return;
  }

  loading.value = true;
  try {
    await registerUser({
      name: regName.value,
      email: regEmail.value,
      username: regUsername.value,
      password: regPassword.value,
      level: regLevel.value,
      accepted_terms: acceptedTerms.value,
      parental_consent: parentalConsent.value,
    });

    const loginRes = await loginWithCredentials(regUsername.value, regPassword.value);
    setSession(loginRes.access_token, loginRes.user, loginRes.refresh_token);
    router.push('/chat');
  } catch (err: any) {
    error.value = err?.data?.detail || err?.message || 'Error creating account.';
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
    const res = await requestPasswordReset(forgotId.value);
    if (res.reset_token) {
      resetToken.value = res.reset_token;
      forgotResult.value = { type: 'success', html: 'Enter your new password below.' };
      activeTab.value = 'reset';
    } else {
      forgotResult.value = {
        type: 'success',
        html: res.message || 'Check your email for the reset link.',
      };
    }
  } catch (err: any) {
    error.value = err?.data?.detail || err?.message || 'Error requesting password reset.';
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
    await resetPasswordWithToken(resetToken.value, resetPw.value);
    forgotResult.value = {
      type: 'success',
      html: 'Password reset successfully! Redirecting to login...',
    };
    setTimeout(() => {
      switchTab('login');
      resetToken.value = '';
      resetPw.value = '';
      resetConfirmPw.value = '';
    }, 2000);
  } catch (err: any) {
    error.value = err?.data?.detail || err?.message || 'Error resetting password.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen w-full flex flex-col items-center justify-center bg-bg relative overflow-y-auto py-6 px-4 sm:px-6">
    <div class="relative z-10 w-full max-w-[28.125rem] flex flex-col items-center my-auto">
      
      <!-- Logo / Header -->
      <div class="text-center mb-6 w-full">
        <img
          src="/images/tati_logo.jpg"
          alt="Taty's Hub"
          class="w-18 h-18 rounded-full object-cover object-top border-[3px] border-border shadow-[0_4px_16px_rgba(0,0,0,0.1)] mb-3 mx-auto"
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
          class="flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-200"
          :class="activeTab === 'login' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          Sign in
        </button>
        <button
          type="button"
          @click="switchTab('register')"
          class="flex-1 py-2 text-[0.855rem] font-semibold rounded-full transition-all duration-200"
          :class="activeTab === 'register' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          Create Account
        </button>
      </div>

      <!-- Card -->
      <div class="w-full bg-surface rounded-[24px] border border-border shadow-lg p-6 sm:p-7.5">
        <div v-if="error" class="mb-4 bg-danger/10 border border-danger/30 text-danger px-4 py-2.5 rounded-xl text-sm font-medium">
          {{ error }}
        </div>
        <div v-if="success" class="mb-4 bg-success/10 border border-success/30 text-success px-4 py-2.5 rounded-xl text-sm font-medium">
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
          <Input
            label="Username or Email"
            placeholder="Username or Email"
            auto-complete="username"
            v-model="loginId"
          />
          <Input
            label="Password"
            type="password"
            placeholder="Password"
            auto-complete="current-password"
            v-model="loginPw"
          />
          <div class="text-right -mt-2 mb-3">
            <button
              type="button"
              @click="switchTab('forgot')"
              class="text-primary text-[0.78rem] font-medium underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
            >
              I forgot my password
            </button>
          </div>
          <Button type="submit" full-width :loading="loading">
            Sign in
          </Button>
        </form>

        <!-- Register Form -->
        <form v-else-if="activeTab === 'register'" @submit.prevent="handleRegister" class="space-y-4">
          <Input label="Full name" placeholder="Full name" v-model="regName" />
          <Input label="Email" type="email" placeholder="Email" v-model="regEmail" />
          <Input label="Username" placeholder="Username" v-model="regUsername" />
          <Input label="Password" type="password" placeholder="Password" v-model="regPassword" />
          <Select label="English level" v-model="regLevel" :options="LEVEL_OPTIONS" />

          <div class="space-y-3 my-4 p-3.5 rounded-xl bg-bg-secondary/40 border border-border/80 text-left">
            <label class="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="acceptedTerms"
                class="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <span>
                Li e aceito os
                <a href="/privacy" target="_blank" class="text-primary font-bold underline hover:opacity-80">
                  Termos de Uso e Política de Privacidade (LGPD)
                </a>.
              </span>
            </label>
            <label class="flex items-start gap-2.5 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                v-model="parentalConsent"
                class="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <span>
                Declaro que sou maior de 18 anos ou possuo autorização expressa dos pais/responsáveis legais (Art. 14 da LGPD).
              </span>
            </label>
          </div>

          <Button type="submit" full-width :loading="loading" :disabled="!acceptedTerms || !parentalConsent">
            Create Account
          </Button>
        </form>

        <!-- Forgot Form -->
        <form v-else-if="activeTab === 'forgot'" @submit.prevent="handleForgot" class="space-y-4">
          <button
            type="button"
            @click="switchTab('login')"
            class="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors"
          >
            ← Back to login
          </button>
          <p class="text-base font-bold text-text mb-1">Forgot my password</p>
          <p class="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Enter your username or email.</p>
          <Input label="Username or Email" placeholder="Username or Email" v-model="forgotId" />
          <Button type="submit" full-width :loading="loading">
            Reset your password
          </Button>
          <div
            v-if="forgotResult"
            class="mt-4 p-3.5 rounded-xl text-[0.83rem] leading-relaxed"
            :class="forgotResult.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : 'bg-danger/10 border border-danger/30 text-danger'"
          >
            {{ forgotResult.html }}
          </div>
        </form>

        <!-- Reset Form -->
        <form v-else-if="activeTab === 'reset'" @submit.prevent="handleResetSubmit" class="space-y-4">
          <button
            type="button"
            @click="switchTab('forgot')"
            class="flex items-center gap-1.5 text-text-muted text-[0.82rem] font-medium mb-4 hover:text-primary transition-colors"
          >
            ← Back
          </button>
          <p class="text-base font-bold text-text mb-1">🔐 Reset your password</p>
          <p class="text-[0.82rem] text-text-muted mb-4 leading-relaxed">Choose your new password.</p>
          <Input label="New Password" type="password" placeholder="At least 6 characters" v-model="resetPw" />
          <Input label="Confirm Password" type="password" placeholder="Repeat your new password" v-model="resetConfirmPw" />
          <Button type="submit" full-width :loading="loading">
            Reset Password
          </Button>
          <div
            v-if="forgotResult"
            class="mt-4 p-3.5 rounded-xl text-[0.83rem] leading-relaxed"
            :class="forgotResult.type === 'success' ? 'bg-success/10 border border-success/30 text-success' : 'bg-danger/10 border border-danger/30 text-danger'"
          >
            {{ forgotResult.html }}
          </div>
        </form>
      </div>

      <!-- Footer Bug Report Modal Trigger -->
      <div class="mt-8 flex flex-col items-center gap-2 text-center w-full">
        <button
          type="button"
          @click="showBugModal = true"
          class="inline-flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-red-500 transition-colors py-1 cursor-pointer font-medium"
        >
          <Bug class="w-3.5 h-3.5 text-red-400" />
          <span>Problemas para acessar? <strong class="underline underline-offset-2">Reportar Bug ao Desenvolvedor</strong></span>
        </button>
      </div>

      <DeveloperBugModal :is-open="showBugModal" @close="showBugModal = false" />
    </div>
  </main>
</template>
