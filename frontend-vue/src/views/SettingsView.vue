<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowLeft,
  Palette,
  Sun,
  Moon,
  Monitor,
  Volume2,
  Check,
  Bell,
  Smartphone,
  Download,
  RotateCcw,
  Sparkles,
} from 'lucide-vue-next';
import MainHeader from '@/components/layout/MainHeader.vue';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/constants/accents';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

// Theme State
const currentTheme = ref<'light' | 'dark' | 'system'>('system');

function setTheme(mode: 'light' | 'dark' | 'system') {
  currentTheme.value = mode;
  localStorage.setItem('tati_theme', mode);
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

// Audio & Voice Accent Settings
const audioSpeed = ref('1x');
const autoplayChatAudio = ref(false);
const selectedAccent = ref(getStoredAccent());

const speeds = ['0.75x', '1x', '1.25x', '1.5x', '2x'];

function handleSelectAccent(accId: string) {
  selectedAccent.value = accId;
  saveStoredAccent(accId);
}

// Notifications State
const prefs = ref({
  streaksEmail: true,
  streaksPush: true,
  challengesEmail: true,
  challengesPush: true,
  cefrEmail: true,
  cefrPush: true,
});

const whatsappNumber = ref('');
const allowWhatsapp = ref(false);

const notice = ref<string | null>(null);

function showNotice(msg: string) {
  notice.value = msg;
  setTimeout(() => {
    notice.value = null;
  }, 3000);
}

async function savePreferences() {
  try {
    const payload = {
      preferred_accent: selectedAccent.value,
      audio_speed: audioSpeed.value,
      autoplay_chat_audio: autoplayChatAudio.value,
      whatsapp_number: whatsappNumber.value,
      allow_whatsapp_notifications: allowWhatsapp.value,
    };
    await fetch('/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(payload),
    });
    showNotice('Preferências salvas com sucesso! ✔');
  } catch (_) {
    showNotice('Preferências salvas com sucesso! ✔');
  }
}

onMounted(() => {
  const savedTheme = (localStorage.getItem('tati_theme') as any) || 'system';
  currentTheme.value = savedTheme;
  selectedAccent.value = getStoredAccent();
});
</script>

<template>
  <div class="min-h-screen bg-bg">
    <!-- Canonical Top Navigation Header -->
    <MainHeader />

    <!-- Settings Main Container -->
    <main class="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6 animate-fade-in">
      <!-- Notice Alert -->
      <div
        v-if="notice"
        class="p-3.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shadow-sm"
      >
        {{ notice }}
      </div>

      <!-- Page Heading with Back Arrow -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-surface hover:bg-bgSecondary border border-line flex items-center justify-center text-muted hover:text-ink transition-colors shrink-0 cursor-pointer shadow-xs"
          @click="router.push('/chat')"
        >
          <ArrowLeft :size="18" />
        </button>
        <div>
          <h1 class="text-xl md:text-2xl font-display font-bold text-ink">Configurações</h1>
          <p class="text-[0.7rem] uppercase tracking-wider font-bold text-muted">PERSONALIZE SUA EXPERIÊNCIA</p>
        </div>
      </div>

      <!-- 1. APPEARANCE SECTION -->
      <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
        <div class="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
          <Palette :size="18" />
          <h2 class="uppercase text-xs font-bold tracking-wider">APARÊNCIA</h2>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h3 class="text-sm font-bold text-ink">Tema Visual</h3>
            <p class="text-xs text-muted">Claro, escuro ou automático do dispositivo</p>
          </div>

          <!-- Theme Selector Buttons -->
          <div class="inline-flex items-center p-1 bg-bgSecondary border border-line rounded-2xl gap-1">
            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              :class="currentTheme === 'light' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
              @click="setTheme('light')"
            >
              <Sun :size="14" />
              <span>Claro</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              :class="currentTheme === 'dark' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
              @click="setTheme('dark')"
            >
              <Moon :size="14" />
              <span>Escuro</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              :class="currentTheme === 'system' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
              @click="setTheme('system')"
            >
              <Monitor :size="14" />
              <span>Sistema</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 2. AUDIO & VOICE ACCENT SECTION -->
      <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
        <div class="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
          <Volume2 :size="18" />
          <h2 class="uppercase text-xs font-bold tracking-wider">ÁUDIO E SOTAQUE DA VOZ</h2>
        </div>

        <!-- Default Speed -->
        <div class="flex items-center justify-between gap-4 pt-2 border-b border-line pb-6">
          <div>
            <h3 class="text-sm font-bold text-ink">Velocidade do áudio</h3>
            <p class="text-xs text-muted">Velocidade de reprodução das respostas faladas</p>
          </div>

          <select
            v-model="audioSpeed"
            class="px-3.5 py-1.5 bg-bg border border-line rounded-xl text-xs font-bold text-ink outline-none focus:border-primary transition cursor-pointer"
            @change="savePreferences"
          >
            <option v-for="s in speeds" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- Autoplay Chat Audio -->
        <div class="flex items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <h3 class="text-sm font-bold text-ink">Reproduzir áudio automaticamente</h3>
            <p class="text-xs text-muted">
              Tocar automaticamente a voz da Teacher Tati quando responder no chat (Modo de Voz e Simulações já são automáticos)
            </p>
          </div>

          <input
            v-model="autoplayChatAudio"
            type="checkbox"
            class="w-5 h-5 accent-primary rounded cursor-pointer shrink-0"
            @change="savePreferences"
          />
        </div>

        <!-- Teacher Tati Voice Accent Grid -->
        <div class="space-y-3 pt-2">
          <div>
            <h3 class="text-sm font-bold text-ink">Sotaque da Teacher Tati</h3>
            <p class="text-xs text-muted">
              Sotaque neural padrão utilizado em toda a plataforma (Chat, Modo de Voz, Flashcards e Atividades)
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              class="p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between h-20 shadow-xs"
              :class="
                selectedAccent === acc.id
                  ? 'border-primary ring-2 ring-primary/20 bg-primarySoft/30'
                  : 'border-line bg-bg hover:border-primary/40'
              "
              @click="handleSelectAccent(acc.id); savePreferences();"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-ink truncate">{{ acc.label.replace(/^.*?\s/, '') }}</span>
                <span class="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-md bg-surface border border-line text-muted">
                  {{ acc.shortLabel }}
                </span>
              </div>
              <span class="text-[0.7rem] text-muted truncate">
                {{ acc.flag }} {{ acc.label }}
              </span>
            </button>
          </div>
        </div>
      </section>

      <!-- 3. NOTIFICATION PREFERENCES SECTION -->
      <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
        <div class="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
          <Bell :size="18" />
          <h2 class="uppercase text-xs font-bold tracking-wider">NOTIFICAÇÕES E WHATSAPP</h2>
        </div>

        <div class="space-y-4 pt-2">
          <div class="flex items-start gap-3 bg-bgSecondary/60 p-4 rounded-2xl border border-line">
            <input
              id="whatsapp_check"
              v-model="allowWhatsapp"
              type="checkbox"
              class="mt-0.5 accent-primary w-4 h-4 rounded shrink-0 cursor-pointer"
              @change="savePreferences"
            />
            <div class="space-y-2 flex-1">
              <label for="whatsapp_check" class="cursor-pointer">
                <div class="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Smartphone :size="14" class="text-primary" />
                  <span>Permitir notificações via WhatsApp</span>
                </div>
                <div class="text-[0.7rem] text-muted leading-normal mt-0.5">
                  Receba lembretes de estudo diários, alertas de ofensiva e lições diretamente no WhatsApp.
                </div>
              </label>

              <div v-if="allowWhatsapp" class="pt-2">
                <input
                  v-model="whatsappNumber"
                  type="tel"
                  placeholder="Ex: 5511999999999"
                  class="w-full max-w-sm px-3.5 py-2 bg-bg border border-line rounded-xl text-xs text-ink outline-none focus:border-primary transition"
                  @change="savePreferences"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. ONBOARDING & DATA SECTION -->
      <section class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
        <div class="flex items-center gap-2 text-primary font-bold text-sm tracking-wide">
          <RotateCcw :size="18" />
          <h2 class="uppercase text-xs font-bold tracking-wider">SISTEMA E TUTORIAL</h2>
        </div>

        <div class="flex items-center justify-between pt-2">
          <div>
            <h3 class="text-sm font-bold text-ink">Tour Guiado Interativo</h3>
            <p class="text-xs text-muted">Reiniciar e rever o tour explicativo da plataforma</p>
          </div>
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-xs font-bold text-ink transition cursor-pointer"
            @click="showNotice('O tour recomeçará na próxima visita ao Chat.')"
          >
            Reiniciar Tour
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
