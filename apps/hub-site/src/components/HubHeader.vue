<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Menu, ChevronDown, LogOut, BookOpen } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { getInitials } from '@/lib/catalog';

defineProps<{
  onToggleMenu?: () => void;
  isSidebarOpen?: boolean;
}>();

const router = useRouter();
const authStore = useAuthStore();
const menuOpen = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);
const imgError = ref(false);

function handleClickOutside(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});

function handleLogout() {
  authStore.logout();
  menuOpen.value = false;
  router.push('/materiais');
}
</script>

<template>
  <header class="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-line bg-bg px-4 md:px-6">
    <div class="flex items-center gap-3">
      <!-- Exibe o botão de abrir somente quando a sidebar estiver fechada -->
      <button
        v-if="onToggleMenu && !isSidebarOpen"
        type="button"
        class="rounded-md p-2 text-muted transition hover:bg-bgSecondary hover:text-primary"
        aria-label="Abrir menu lateral"
        title="Abrir menu lateral"
        @click="onToggleMenu"
      >
        <Menu :size="20" />
      </button>
      <router-link to="/materiais" class="font-display text-lg font-bold tracking-tight">
        Teacher <span class="text-primary">Taty</span>
      </router-link>
    </div>

    <div class="flex items-center gap-2 md:gap-4">
      <div v-if="!authStore.isLoaded" class="h-9 w-24 animate-pulse rounded-hub bg-bgSecondary" />

      <div v-else-if="authStore.user" ref="menuRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-hub border border-line bg-surface px-2 py-1.5 transition hover:border-primary md:px-3"
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          @click="menuOpen = !menuOpen"
        >
          <span
            v-if="authStore.user.avatar_url && !imgError"
            class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10"
          >
            <img
              :src="authStore.user.avatar_url"
              :alt="authStore.user.name || 'User'"
              class="h-full w-full object-cover"
              @error="imgError = true"
            />
          </span>
          <span
            v-else
            class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
          >
            {{ getInitials(authStore.user.name || authStore.user.username || 'Aluno') }}
          </span>
          <span class="hidden max-w-[120px] truncate text-sm font-semibold text-ink md:block">
            {{ (authStore.user.name || authStore.user.username || 'Aluno').split(' ')[0] }}
          </span>
          <ChevronDown :size="16" class="text-muted" />
        </button>

        <div
          v-if="menuOpen"
          role="menu"
          class="absolute right-0 mt-2 w-52 overflow-hidden rounded-hub border border-line bg-surface py-1 shadow-card"
        >
          <p class="border-b border-line px-4 py-2 text-xs text-muted">
            {{ authStore.user.email }}
          </p>
          <router-link
            to="/meus-materiais"
            role="menuitem"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-primarySoft"
            @click="menuOpen = false"
          >
            <BookOpen :size="16" />
            Meus materiais
          </router-link>
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
            @click="handleLogout"
          >
            <LogOut :size="16" />
            Sair
          </button>
        </div>
      </div>

      <router-link v-else to="/login" class="btn-primary px-4 py-2 text-sm">
        Entrar
      </router-link>
    </div>
  </header>
</template>
