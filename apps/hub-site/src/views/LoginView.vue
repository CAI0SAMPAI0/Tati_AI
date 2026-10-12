<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-vue-next';
import BrandMark from '@/components/BrandMark.vue';
import { useAuthStore } from '@/stores/auth';
import {
  loginWithCredentials,
  loginWithGoogle,
  registerUser,
} from '@tati/hub-core';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const activeTab = ref<'login' | 'register'>(
  route.query.tab === 'register' ? 'register' : 'login'
);

const identifier = ref('');
const password = ref('');
const showPassword = ref(false);

const registerName = ref('');
const registerEmail = ref('');
const registerUsername = ref('');
const registerPassword = ref('');
const showRegisterPassword = ref(false);

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

async function handleGoogleCredential(response: { credential?: string }) {
  if (!response?.credential) return;
  clearMessages();
  loading.value = true;
  try {
    const res = await loginWithGoogle(response.credential, true);
    if (res?.data?.access_token && res?.data?.user) {
      authStore.saveSession(res.data.access_token, res.data.user);
      router.replace('/materiais');
    } else {
      throw new Error('Falha ao autenticar com o Google.');
    }
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível entrar com Google. Tente novamente.';
  } finally {
    loading.value = false;
  }
}

function initGoogleButton(retries = 0) {
  const g = (window as any).google;
  if (!g?.accounts?.id || !googleBtnRef.value) {
    if (retries < 15) {
      googleRetryTimer = setTimeout(() => initGoogleButton(retries + 1), 400);
    }
    return;
  }

  try {
    g.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    googleBtnRef.value.innerHTML = '';
    g.accounts.id.renderButton(googleBtnRef.value, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text: 'continue_with',
      size: 'large',
      width: Math.min(googleBtnRef.value.clientWidth || 320, 360),
      logo_alignment: 'left',
    });
  } catch (err) {
    console.warn('[Google Auth] Erro ao renderizar botão:', err);
  }
}

function loadGoogleScript() {
  if ((window as any).google?.accounts?.id) {
    nextTick(() => initGoogleButton());
    return;
  }

  const existing = document.getElementById('google-jssdk');
  if (!existing) {
    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => nextTick(() => initGoogleButton());
    document.head.appendChild(script);
  } else {
    initGoogleButton();
  }
}

onMounted(() => {
  if (authStore.user) {
    router.replace('/materiais');
    return;
  }

  // Verifica se veio credential por redirect da URL
  if (route.query.credential) {
    handleGoogleCredential({ credential: String(route.query.credential) });
    return;
  }

  loadGoogleScript();
});

onUnmounted(() => {
  if (googleRetryTimer) clearTimeout(googleRetryTimer);
});

// Re-renderiza o botão ao alternar de aba para garantir layout correto
watch(activeTab, () => {
  clearMessages();
  nextTick(() => {
    initGoogleButton();
  });
});

async function handleLogin() {
  clearMessages();
  if (!identifier.value || !password.value) {
    error.value = 'Preencha seu usuário/e-mail e sua senha.';
    return;
  }

  loading.value = true;
  try {
    const res = await loginWithCredentials(identifier.value, password.value);
    if (res?.data?.access_token && res?.data?.user) {
      authStore.saveSession(res.data.access_token, res.data.user);
      router.replace('/materiais');
    } else {
      throw new Error('Credenciais inválidas');
    }
  } catch (err: any) {
    error.value = err?.message || 'Falha ao entrar. Verifique seu login e senha.';
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  clearMessages();

  if (!registerName.value || !registerEmail.value || !registerUsername.value || !registerPassword.value) {
    error.value = 'Preencha todos os campos para criar sua conta.';
    return;
  }

  if (registerPassword.value.length < 6) {
    error.value = 'A senha precisa ter pelo menos 6 caracteres.';
    return;
  }

  loading.value = true;
  try {
    // No Hub, não precisa de seleção de nível de inglês: envia A1 por padrão transparente
    await registerUser({
      name: registerName.value,
      email: registerEmail.value,
      username: registerUsername.value,
      password: registerPassword.value,
      level: 'A1',
      is_hub_only: true,
    });

    success.value = 'Conta criada com sucesso! Agora você já pode entrar no hub.';
    activeTab.value = 'login';
    identifier.value = registerEmail.value;
    password.value = registerPassword.value;
  } catch (err: any) {
    error.value = err?.message || 'Falha ao cadastrar. Tente novamente.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center p-4 bg-bg">
    <div class="w-full max-w-md">
      <!-- Botão Voltar -->
      <router-link
        to="/materiais"
        class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition"
      >
        <ArrowLeft :size="16" />
        Voltar à galeria
      </router-link>

      <!-- Card Principal -->
      <div class="card-surface p-6 sm:p-8 shadow-card">
        <!-- Logo e Marca -->
        <div class="mb-6 flex flex-col items-center text-center">
          <BrandMark variant="hero" subtitle="Materials Hub" class="mb-2" />
          <p class="text-xs text-muted">Acesse seus materiais de inglês exclusivos</p>
        </div>

        <!-- Abas: Entrar / Criar conta -->
        <div class="mb-6 flex rounded-xl border border-line bg-bgSecondary p-1">
          <button
            type="button"
            :class="[
              'flex-1 rounded-lg py-2 text-xs font-bold transition-all',
              activeTab === 'login' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            ]"
            @click="activeTab = 'login'"
          >
            Entrar
          </button>
          <button
            type="button"
            :class="[
              'flex-1 rounded-lg py-2 text-xs font-bold transition-all',
              activeTab === 'register' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            ]"
            @click="activeTab = 'register'"
          >
            Criar conta
          </button>
        </div>

        <!-- Mensagens de Feedback -->
        <div
          v-if="error"
          class="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger animate-fade-in"
        >
          {{ error }}
        </div>

        <div
          v-if="success"
          class="mb-4 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-xs text-success animate-fade-in"
        >
          {{ success }}
        </div>

        <!-- Botão Oficial Google OAuth -->
        <div class="mb-5 flex w-full flex-col items-center justify-center">
          <div ref="googleBtnRef" class="w-full flex justify-center min-h-[44px]" />
        </div>

        <!-- Separador 'ou' -->
        <div class="mb-5 flex items-center gap-3">
          <span class="h-px flex-1 bg-border" />
          <span class="text-[10px] font-bold uppercase tracking-wider text-subtle">
            ou com credenciais
          </span>
          <span class="h-px flex-1 bg-border" />
        </div>

        <!-- Formulário: Login -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Usuário ou E-mail</label>
            <input
              v-model="identifier"
              type="text"
              required
              placeholder="seu_usuario ou email@exemplo.com"
              class="input-hub w-full pl-3 text-xs"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Senha</label>
            <div class="relative">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                placeholder="Sua senha"
                class="input-hub w-full pl-3 pr-10 text-xs"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
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
            class="btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-xs"
          >
            <Loader2 v-if="loading" :size="16" class="animate-spin" />
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <!-- Formulário: Cadastro (Sem nível de inglês) -->
        <form v-else @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Nome Completo</label>
            <input
              v-model="registerName"
              type="text"
              required
              placeholder="Seu nome completo"
              class="input-hub w-full pl-3 text-xs"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">E-mail</label>
            <input
              v-model="registerEmail"
              type="email"
              required
              placeholder="seu.email@exemplo.com"
              class="input-hub w-full pl-3 text-xs"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Nome de Usuário</label>
            <input
              v-model="registerUsername"
              type="text"
              required
              placeholder="usuario (letras e números)"
              class="input-hub w-full pl-3 text-xs"
            />
          </div>

          <div>
            <label class="mb-1 block text-xs font-semibold text-muted">Senha</label>
            <div class="relative">
              <input
                v-model="registerPassword"
                :type="showRegisterPassword ? 'text' : 'password'"
                required
                placeholder="Mínimo 6 caracteres"
                class="input-hub w-full pl-3 pr-10 text-xs"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink"
                @click="showRegisterPassword = !showRegisterPassword"
              >
                <EyeOff v-if="showRegisterPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3 text-xs"
          >
            <Loader2 v-if="loading" :size="16" class="animate-spin" />
            {{ loading ? 'Criando conta...' : 'Cadastrar' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
