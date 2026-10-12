<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  Book,
  History,
  HelpCircle,
  LogOut,
  Menu,
} from 'lucide-vue-next';
import BrandMark from '@/components/BrandMark.vue';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const menuItems = [
  { name: 'Galeria', icon: LayoutDashboard, href: '/materiais' },
  { name: 'Meus Materiais', icon: Book, href: '/meus-materiais' },
  { name: 'Pedidos', icon: History, href: '/pedidos' },
];

const supportEmail =
  (import.meta as any).env?.VITE_SUPPORT_EMAIL ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPPORT_EMAIL ||
  '';
const supportHref = supportEmail
  ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}`
  : '#';

function isItemActive(href: string) {
  return route.path === href || route.path.startsWith(`${href}/`);
}

function handleLogout() {
  authStore.logout();
  emit('close');
  router.push('/materiais');
}
</script>

<template>
  <div>
    <!-- Backdrop Mobile -->
    <button
      v-if="isOpen"
      type="button"
      aria-label="Fechar menu"
      class="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm lg:hidden"
      @click="emit('close')"
    />

    <!-- Sidebar Drawer -->
    <aside
      :class="[
        'fixed left-0 top-0 z-[70] flex h-screen w-64 flex-col border-r border-line bg-surface shadow-sm transition-transform duration-300',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="flex items-center justify-between border-b border-line p-5">
        <router-link to="/materiais" @click="emit('close')">
          <BrandMark variant="compact" />
        </router-link>
        <button
          type="button"
          class="rounded-lg p-2 text-muted transition hover:bg-primarySoft hover:text-primary"
          aria-label="Fechar menu lateral"
          title="Fechar menu lateral"
          @click="emit('close')"
        >
          <Menu :size="20" />
        </button>
      </div>

      <nav class="mt-4 flex-grow space-y-1 px-3">
        <p class="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
          Menu Principal
        </p>
        <router-link
          v-for="item in menuItems"
          :key="item.name"
          :to="item.href"
          @click="emit('close')"
          :class="[
            'flex items-center gap-3 rounded-hub px-3 py-2.5 text-sm font-semibold transition-colors',
            isItemActive(item.href)
              ? 'bg-primarySoft text-primary'
              : 'text-muted hover:bg-bgSecondary hover:text-ink',
          ]"
        >
          <component :is="item.icon" :size="18" />
          {{ item.name }}
        </router-link>

        <p class="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-subtle">
          Utilidades
        </p>
        <a
          :href="supportHref"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-3 rounded-hub px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-bgSecondary hover:text-ink"
          @click="emit('close')"
        >
          <HelpCircle :size="18" />
          Suporte
        </a>
      </nav>

      <div v-if="authStore.user" class="space-y-3 border-t border-line p-4">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-hub px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-danger/10 hover:text-danger"
          @click="handleLogout"
        >
          <LogOut :size="18" />
          Sair da conta
        </button>
      </div>
    </aside>
  </div>
</template>
