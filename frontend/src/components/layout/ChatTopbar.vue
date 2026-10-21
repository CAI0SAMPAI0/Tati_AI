<script setup lang="ts">
import { ref } from 'vue';
import { Menu, Globe, Volume2, Moon, Sun } from 'lucide-vue-next';
import { ACCENTS } from '@/constants/accents';
import { useAuth } from '@/composables/useAuth';
import { useThemeStore } from '@/stores/theme';

defineProps<{
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'toggleMenu'): void;
}>();

const { accent, setAccent } = useAuth();
const themeStore = useThemeStore();
const showAccentDropdown = ref(false);

function selectAccent(id: string) {
  setAccent(id);
  showAccentDropdown.value = false;
}
</script>

<template>
  <div class="h-14 border-b border-border bg-surface px-4 flex items-center justify-between gap-3 z-30 transition-colors">
    <div class="flex items-center gap-2">
      <button
        type="button"
        @click="emit('toggleMenu')"
        class="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover md:hidden transition-colors"
      >
        <Menu class="w-5 h-5" />
      </button>
      <div class="flex items-center gap-2">
        <h3 class="font-display font-bold text-sm text-text truncate max-w-[200px] sm:max-w-xs">
          {{ title || 'Teacher Tatiana' }}
        </h3>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-success/15 text-success">
          Online
        </span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- Accent Selector -->
      <div class="relative">
        <button
          type="button"
          @click="showAccentDropdown = !showAccentDropdown"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border bg-input hover:bg-surface-hover text-xs font-semibold text-text transition-colors"
          title="Selecionar sotaque de voz"
        >
          <Globe class="w-3.5 h-3.5 text-primary" />
          <span class="hidden sm:inline">{{ ACCENTS.find(a => a.id === accent)?.shortLabel || 'US' }}</span>
          <span>{{ ACCENTS.find(a => a.id === accent)?.flag || '🇺🇸' }}</span>
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="showAccentDropdown"
          class="absolute right-0 mt-1.5 w-52 bg-surface border border-border rounded-xl shadow-xl py-1.5 z-50 animate-fade-in"
        >
          <div class="px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-text-subtle border-b border-border/50">
            Accent / Voice
          </div>
          <div class="max-h-60 overflow-y-auto custom-scrollbar">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              @click="selectAccent(acc.id)"
              class="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-surface-hover transition-colors"
              :class="acc.id === accent ? 'text-primary font-bold bg-primary/5' : 'text-text font-medium'"
            >
              <span>{{ acc.label }}</span>
              <span class="text-[0.68rem] text-text-subtle">{{ acc.shortLabel }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Theme Switch -->
      <button
        type="button"
        @click="themeStore.toggleTheme"
        class="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        :title="themeStore.isDark ? 'Tema claro' : 'Tema escuro'"
      >
        <Sun v-if="themeStore.isDark" class="w-4 h-4 text-yellow-400" />
        <Moon v-else class="w-4 h-4 text-text-muted" />
      </button>
    </div>
  </div>
</template>

