<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { Menu, ChevronDown, BookOpen, User, LogOut } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { getInitials } from '@/types/catalog';

defineProps<{
  onToggleMenu?: () => void;
}>();

const { user, logout } = useAuth();
const menuOpen = ref(false);
const menuRef = ref<HTMLDivElement | null>(null);
const imgError = ref(false);

const displayName = computed(() => user.value?.name || user.value?.username || 'Aluno');
const rawAvatar = computed(() => user.value?.avatar_url || (user.value as any)?.profile?.avatar_url);

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
</script>

<template>
  <header class="sticky top-0 z-40 flex h-18 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-md px-4 md:px-8">
    <div class="flex items-center gap-3">
      <button
        v-if="onToggleMenu"
        type="button"
        @click="onToggleMenu"
        class="rounded-xl p-2 text-text-muted hover:bg-bgSecondary hover:text-text transition-colors"
        aria-label="Toggle menu"
      >
        <Menu :size="20" />
      </button>

      <RouterLink to="/activities/hub" class="text-lg font-black text-text tracking-tight flex items-center gap-1.5">
        <span>Teacher</span>
        <span class="text-primary">Taty's Materials</span>
      </RouterLink>
    </div>

    <div class="flex items-center gap-3">
      <div v-if="user" class="relative" ref="menuRef">
        <button
          type="button"
          @click="menuOpen = !menuOpen"
          class="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 transition-colors hover:border-primary"
          :aria-expanded="menuOpen"
        >
          <span
            v-if="rawAvatar && !imgError"
            class="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10"
          >
            <img
              :src="rawAvatar"
              :alt="displayName"
              class="h-full w-full object-cover"
              @error="imgError = true"
            />
          </span>
          <span
            v-else
            class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
          >
            {{ getInitials(displayName) }}
          </span>

          <span class="hidden max-w-[120px] truncate text-xs font-bold text-text md:block">
            {{ displayName.split(' ')[0] }}
          </span>
          <ChevronDown :size="14" class="text-text-muted" />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="menuOpen"
          class="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl z-50 animate-fade-in"
          role="menu"
        >
          <p class="border-b border-border px-4 py-2 text-xs text-text-muted truncate">
            {{ user.email }}
          </p>
          <RouterLink
            to="/activities/hub/meus-materiais"
            class="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text hover:bg-bgSecondary transition-colors"
            @click="menuOpen = false"
          >
            <BookOpen :size="14" class="text-primary" />
            <span>My Materials</span>
          </RouterLink>
          <RouterLink
            to="/activities/hub/pedidos"
            class="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-text hover:bg-bgSecondary transition-colors"
            @click="menuOpen = false"
          >
            <User :size="14" class="text-primary" />
            <span>Orders & Invoices</span>
          </RouterLink>
          <div class="border-t border-border mt-1 pt-1">
            <button
              type="button"
              @click="logout"
              class="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors cursor-pointer text-left"
            >
              <LogOut :size="14" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      <RouterLink
        v-else
        to="/login"
        class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-sm shadow-primary/20"
      >
        Sign in
      </RouterLink>
    </div>
  </header>
</template>
