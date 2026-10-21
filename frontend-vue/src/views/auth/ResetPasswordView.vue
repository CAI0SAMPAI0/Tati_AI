<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const route = useRoute();
const router = useRouter();

const token = ref<string>((route.query.token as string) || '');
const newPassword = ref('');
const confirmPassword = ref('');
const error = ref('');
const success = ref('');
const loading = ref(false);

onMounted(() => {
  if (!token.value) {
    error.value = 'Invalid or missing reset token. Please request a new link.';
  }
});

async function handleSubmit() {
  error.value = '';
  success.value = '';

  if (!token.value) {
    error.value = 'Invalid or missing reset link.';
    return;
  }
  if (!newPassword.value || !confirmPassword.value) {
    error.value = 'Please fill in all fields.';
    return;
  }
  if (newPassword.value.length < 6) {
    error.value = 'Password must be at least 6 characters.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.';
    return;
  }

  loading.value = true;
  try {
    await apiPost(ENDPOINTS.AUTH_RESET_PASSWORD, {
      token: token.value,
      new_password: newPassword.value,
    });
    success.value = 'Password reset successfully! Redirecting to login...';
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  } catch (err: any) {
    error.value = err?.message || 'Error resetting password. The link may have expired.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden py-4 px-4 select-none">
    <div
      class="fixed -top-[20%] -left-[10%] w-[65%] h-[65%] pointer-events-none -z-10"
      style="background: radial-gradient(ellipse, hsla(258, 80%, 50%, 0.14) 0%, transparent 70%);"
    ></div>

    <div class="relative z-10 grid grid-cols-1 md:grid-cols-[18.75rem_1fr] w-full max-w-[50rem] rounded-2xl border border-border shadow-2xl animate-fade-in mx-auto overflow-hidden bg-surface">
      <!-- Left Panel -->
      <div class="relative flex flex-col items-center justify-center py-10 px-7 overflow-hidden bg-gradient-to-br from-[hsl(270,60%,18%)] via-[hsl(258,70%,34%)] to-[hsl(280,55%,20%)] text-white text-center">
        <div class="absolute inset-0 animate-pulse opacity-30 bg-radial-gradient"></div>
        <div class="relative z-10 space-y-4">
          <img
            src="/images/tati_logo.jpg"
            alt="Taty's Hub"
            class="w-24 h-24 rounded-full object-cover object-top border-4 border-white/30 shadow-2xl mx-auto"
            @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
          />
          <div>
            <h1 class="font-display text-2xl font-black tracking-tight">Taty's Hub</h1>
            <p class="text-xs opacity-80 mt-1 max-w-[14rem] mx-auto leading-relaxed">
              Your AI English teacher. Practice whenever you want, at your own pace.
            </p>
          </div>
        </div>
      </div>

      <!-- Right Form Panel -->
      <div class="flex items-center justify-center p-6 md:p-10">
        <div class="w-full max-w-[20rem] space-y-5">
          <div>
            <h2 class="font-display text-xl font-extrabold tracking-tight text-text">
              Reset Password
            </h2>
            <p class="text-xs text-text-muted mt-0.5">
              {{ token ? 'Enter your new password below.' : 'This reset link is invalid or expired.' }}
            </p>
          </div>

          <!-- Alert Notices -->
          <div v-if="error" class="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
            {{ error }}
          </div>
          <div v-if="success" class="p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs font-semibold">
            {{ success }}
          </div>

          <div v-if="!token">
            <Button full-width @click="router.push('/login')">
              Back to Login
            </Button>
          </div>

          <form v-else @submit.prevent="handleSubmit" class="space-y-4">
            <Input
              v-model="newPassword"
              label="New Password"
              type="password"
              placeholder="••••••••"
              required
            />

            <Input
              v-model="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              required
            />

            <Button type="submit" full-width :loading="loading">
              Reset Password
            </Button>

            <div class="text-center pt-2">
              <button
                type="button"
                @click="router.push('/login')"
                class="text-xs font-bold text-primary hover:underline"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </main>
</template>
