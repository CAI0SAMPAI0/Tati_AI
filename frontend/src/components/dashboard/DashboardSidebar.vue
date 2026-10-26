<script setup lang="ts">
import {
  PieChart,
  Users,
  LineChart,
  Layers,
  Drama,
  Gamepad2,
  Newspaper,
  BookOpen,
  Zap,
  MessageSquare,
  Settings,
  X,
} from 'lucide-vue-next';
import TatiLogo from '../ui/TatiLogo.vue';
import WhatsAppIcon from '../icons/WhatsAppIcon.vue';
import ExamIcon from '../icons/ExamIcon.vue';

export type DashSection =
  | 'overview'
  | 'students'
  | 'reports'
  | 'flashcards'
  | 'simulations'
  | 'games'
  | 'news'
  | 'cefr'
  | 'exams'
  | 'premium'
  | 'feedbacks'
  | 'whatsapp';

defineProps<{
  activeSection: DashSection;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'setSection', section: DashSection): void;
  (e: 'close'): void;
}>();

const navItems: Array<{ id: DashSection; icon: any; label: string }> = [
  { id: 'overview', icon: PieChart, label: 'Overview' },
  { id: 'students', icon: Users, label: 'Students' },
  { id: 'reports', icon: LineChart, label: 'Reports' },
  { id: 'flashcards', icon: Layers, label: 'Flashcards' },
  { id: 'simulations', icon: Drama, label: 'Simulations' },
  { id: 'games', icon: Gamepad2, label: 'Games' },
  { id: 'news', icon: Newspaper, label: 'News' },
  { id: 'cefr', icon: BookOpen, label: 'CEFR Materials' },
  { id: 'exams', icon: ExamIcon, label: 'Exams' },
  { id: 'premium', icon: Zap, label: "Taty's Materials" },
  { id: 'feedbacks', icon: MessageSquare, label: 'Feedbacks' },
  { id: 'whatsapp', icon: WhatsAppIcon, label: 'WhatsApp Config' },
];

function handleSelectSection(id: DashSection) {
  emit('setSection', id);
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    emit('close');
  }
}
</script>

<template>
  <div>
    <!-- Mobile Overlay -->
    <div
      class="fixed inset-0 bg-black/60 z-[60] transition-opacity md:hidden"
      :class="isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      @click="emit('close')"
    ></div>

    <!-- Aside container -->
    <aside
      class="fixed inset-y-0 left-0 z-[70] w-[280px] bg-bg-secondary border-r border-border flex flex-col h-screen shrink-0 transition-transform duration-300"
      :class="isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <!-- Header -->
      <div class="p-6 shrink-0 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-primary/10">
            <TatiLogo :size="32" class="w-full h-full rounded-lg" />
          </div>
          <div class="min-w-0">
            <div class="font-display text-[0.9rem] font-bold tracking-tight text-text truncate">
              Taty's Hub
            </div>
            <div class="text-[0.65rem] font-bold text-primary uppercase tracking-widest leading-none">
              Dashboard
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted md:hidden"
        >
          <X class="w-4.5 h-4.5" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          @click="handleSelectSection(item.id)"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group"
          :class="
            activeSection === item.id
              ? 'bg-primary text-white shadow-glow'
              : 'text-text-muted hover:bg-primary/10 hover:text-primary'
          "
        >
          <component
            :is="item.icon"
            class="w-5 h-5 shrink-0"
            :class="activeSection === item.id ? 'text-white' : 'text-text-subtle group-hover:text-primary'"
          />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- Footer -->
      <div class="p-4 border-t border-border space-y-2 shrink-0">
        <router-link
          to="/chat"
          class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-all"
        >
          <MessageSquare class="w-5 h-5" />
          <span>Go to Chat</span>
        </router-link>

        <router-link
          to="/settings"
          class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text-muted hover:bg-bg-secondary transition-all"
        >
          <Settings class="w-5 h-5" />
          <span>Settings</span>
        </router-link>
      </div>
    </aside>
  </div>
</template>

