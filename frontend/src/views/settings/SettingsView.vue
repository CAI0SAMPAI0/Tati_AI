<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowLeft,
  Palette,
  Sun,
  Moon,
  Monitor,
  Volume2,
  MessageCircle,
  Bell,
  Save,
  Check,
} from 'lucide-vue-next';
import MainHeader from '@/components/layout/MainHeader.vue';
import { useAuth } from '@/composables/useAuth';
import { useThemeStore } from '@/stores/theme';
import { useToast } from '@/composables/useToast';
import { apiGet, apiPut } from '@/api/client';
import { ACCENTS, saveStoredAccent } from '@/constants/accents';

const router = useRouter();
const toast = useToast();
const { user, accent, setAccent, updateUserData } = useAuth();
const themeStore = useThemeStore();

const selectedAccent = ref(accent.value || 'en-US');
const isSaving = ref(false);

const settings = ref({
  audioSpeed: '1',
  wordTooltip: true,
  tooltipMode: 'sentence' as 'sentence' | 'word',
  enterSend: true,
  autoplayChatAudio: false,
});

const prefs = ref({
  streaks: { email: true, push: true },
  challenges: { email: true, push: true },
  cefr: { email: true, push: true },
});

const whatsappNumber = ref('');
const allowWhatsappNotifications = ref(false);

function persistLocalSettings() {
  localStorage.setItem('tati_settings', JSON.stringify(settings.value));
  window.dispatchEvent(new Event('tati_settings_changed'));
}

onMounted(async () => {
  // Load local settings
  const saved = localStorage.getItem('tati_settings');
  if (saved) {
    try {
      settings.value = { ...settings.value, ...JSON.parse(saved) };
    } catch {}
  }

  // Load from backend
  try {
    const data = await apiGet<any>('/users/notification-preferences');
    if (data) {
      if (data.streaks) prefs.value.streaks = data.streaks;
      if (data.challenges) prefs.value.challenges = data.challenges;
      if (data.cefr) prefs.value.cefr = data.cefr;
      if (typeof data.allow_whatsapp_notifications === 'boolean') {
        allowWhatsappNotifications.value = data.allow_whatsapp_notifications;
      }
      if (typeof data.whatsapp_number === 'string') {
        whatsappNumber.value = data.whatsapp_number;
      }
      if (typeof data.autoplay_chat_audio === 'boolean') {
        settings.value.autoplayChatAudio = data.autoplay_chat_audio;
      }
    }
  } catch (err) {
    console.error('Failed to load notification preferences:', err);
  }

  if (user.value) {
    const prof = (user.value as any)?.profile || {};
    if (prof.whatsapp_number) {
      whatsappNumber.value = prof.whatsapp_number;
    }
    if (prof.preferred_accent) {
      selectedAccent.value = prof.preferred_accent;
    }
  }
});

function handleThemeChange(t: 'light' | 'dark' | 'system') {
  themeStore.setTheme(t);
}

function handleAccentChange(accId: string) {
  selectedAccent.value = accId;
  setAccent(accId);
  saveStoredAccent(accId);
  const acc = ACCENTS.find((a) => a.id === accId);
  toast.success(`Voice accent changed to ${acc?.label || accId}`);
}

function setTooltipMode(mode: 'sentence' | 'word') {
  settings.value.tooltipMode = mode;
  persistLocalSettings();
  toast.success(
    mode === 'sentence'
      ? 'Modo de tradução: Frase completa (até o ponto)'
      : 'Modo de tradução: Palavra por palavra'
  );
}

function handleWordTooltipToggle() {
  persistLocalSettings();
}

async function handleSave() {
  isSaving.value = true;
  persistLocalSettings();
  setAccent(selectedAccent.value);

  try {
    const clean = (whatsappNumber.value || '').replace(/\D/g, '');
    const formatted =
      (clean.length === 10 || clean.length === 11) && !clean.startsWith('55')
        ? `55${clean}`
        : clean;

    await apiPut('/users/notification-preferences', {
      ...prefs.value,
      whatsapp_number: formatted || null,
      allow_whatsapp_notifications: allowWhatsappNotifications.value,
      whatsapp_enabled: allowWhatsappNotifications.value,
      autoplay_chat_audio: Boolean(settings.value.autoplayChatAudio),
      preferred_accent: selectedAccent.value,
    });

    await apiPut('/profile/', {
      whatsapp_number: formatted || null,
      allow_whatsapp_notifications: allowWhatsappNotifications.value,
      preferred_accent: selectedAccent.value,
      accent: selectedAccent.value,
      autoplay_chat_audio: Boolean(settings.value.autoplayChatAudio),
      notification_preferences: prefs.value,
    });

    updateUserData({
      preferred_accent: selectedAccent.value,
    });
    toast.success('Settings saved successfully!');
  } catch (err) {
    console.error('Failed to save settings:', err);
    toast.error('Failed to save settings.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg text-foreground">
    <MainHeader />

    <main class="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-20 animate-fade-in">
      <!-- Top header -->
      <header class="flex items-center gap-4">
        <button
          type="button"
          @click="router.back()"
          class="p-2 rounded-xl hover:bg-surface-hover transition-all text-text-muted border border-border bg-surface cursor-pointer"
        >
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div>
          <h1 class="text-2xl font-bold font-display">Settings</h1>
          <p class="text-xs text-text-muted font-bold uppercase tracking-widest">
            Personalize your experience
          </p>
        </div>
      </header>

      <div class="space-y-6">
        <!-- 1. APPEARANCE -->
        <section class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
          <div class="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
            <Palette class="w-5 h-5 text-primary" />
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">Appearance</h2>
          </div>
          <div class="p-6 space-y-8">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p class="text-sm font-bold text-text mb-0.5">Theme</p>
                <p class="text-xs text-text-muted">Light, dark or match your device</p>
              </div>
              <div class="flex p-1 bg-bg border border-border rounded-xl gap-2">
                <button
                  type="button"
                  @click="handleThemeChange('light')"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="themeStore.theme === 'light' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
                >
                  <Sun class="w-4 h-4" /> Light
                </button>
                <button
                  type="button"
                  @click="handleThemeChange('dark')"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="themeStore.theme === 'dark' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
                >
                  <Moon class="w-4 h-4" /> Dark
                </button>
                <button
                  type="button"
                  @click="handleThemeChange('system')"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="themeStore.theme === 'system' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
                >
                  <Monitor class="w-4 h-4" /> System
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. AUDIO & ACCENT -->
        <section class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
          <div class="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
            <Volume2 class="w-5 h-5 text-primary" />
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">Audio & Voice Accent</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Speed -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
              <div>
                <p class="text-sm font-bold text-text mb-0.5">Default Speed</p>
                <p class="text-xs text-text-muted">Playback speed for assistant responses</p>
              </div>
              <select
                v-model="settings.audioSpeed"
                @change="persistLocalSettings"
                class="px-3 py-2 bg-bg border border-border rounded-xl text-xs font-bold text-text outline-none cursor-pointer"
              >
                <option value="0.75">0.75x</option>
                <option value="1">1.0x (Normal)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
              </select>
            </div>

            <!-- Accents grid -->
            <div>
              <p class="text-sm font-bold text-text mb-1">Teacher Tati Voice Accent</p>
              <p class="text-xs text-text-muted mb-4">Default accent used across the platform (Chat, Voice, Flashcards, and Activities)</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <button
                  v-for="acc in ACCENTS"
                  :key="acc.id"
                  type="button"
                  @click="handleAccentChange(acc.id)"
                  class="p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer"
                  :class="
                    selectedAccent === acc.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border bg-surface hover:border-primary/40'
                  "
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">{{ acc.flag }}</span>
                    <div>
                      <p class="text-xs font-bold text-text">{{ acc.label }}</p>
                      <p class="text-[0.65rem] text-text-muted">{{ acc.desc }}</p>
                    </div>
                  </div>
                  <div
                    v-if="selectedAccent === acc.id"
                    class="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0"
                  >
                    <Check class="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. CHAT PREFERENCES -->
        <section class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
          <div class="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
            <MessageCircle class="w-5 h-5 text-primary" />
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">Chat Preferences</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Word Tooltip Checkbox -->
            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <p class="text-sm font-bold text-text">Word Tooltip</p>
                <p class="text-xs text-text-muted">Click English words/sentences to see translation and pronunciation</p>
              </div>
              <input
                type="checkbox"
                v-model="settings.wordTooltip"
                @change="handleWordTooltipToggle"
                class="w-5 h-5 rounded-md accent-primary cursor-pointer"
              />
            </label>

            <!-- Translation Mode: Sentence vs Word -->
            <div v-if="settings.wordTooltip" class="pt-6 border-t border-border space-y-3">
              <div>
                <p class="text-sm font-bold text-text mb-0.5">Translation Mode</p>
                <p class="text-xs text-text-muted">
                  Choose whether clicking text translates the entire sentence or individual words
                </p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  @click="setTooltipMode('sentence')"
                  class="p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer"
                  :class="
                    settings.tooltipMode === 'sentence'
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20'
                      : 'border-border bg-bg hover:border-text-muted/30 text-text'
                  "
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm font-bold">Sentence Translation</span>
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface border border-border uppercase">
                      Recommended
                    </span>
                  </div>
                  <span class="text-[11px] text-text-muted">
                    Translates the full sentence, or up to the first period for long sentences.
                  </span>
                </button>

                <button
                  type="button"
                  @click="setTooltipMode('word')"
                  class="p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer"
                  :class="
                    settings.tooltipMode === 'word'
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20'
                      : 'border-border bg-bg hover:border-text-muted/30 text-text'
                  "
                >
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-sm font-bold">Word Translation</span>
                  </div>
                  <span class="text-[11px] text-text-muted">
                    Translates each word individually when clicked.
                  </span>
                </button>
              </div>
            </div>

            <label class="flex items-center justify-between cursor-pointer pt-2">
              <div>
                <p class="text-sm font-bold text-text">Autoplay Audio</p>
                <p class="text-xs text-text-muted">Automatically play teacher responses</p>
              </div>
              <input
                type="checkbox"
                v-model="settings.autoplayChatAudio"
                @change="persistLocalSettings"
                class="w-5 h-5 rounded-md accent-primary cursor-pointer"
              />
            </label>

            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <p class="text-sm font-bold text-text">Enter to Send</p>
                <p class="text-xs text-text-muted">Press Enter to send, Shift+Enter for new line</p>
              </div>
              <input
                type="checkbox"
                v-model="settings.enterSend"
                @change="persistLocalSettings"
                class="w-5 h-5 rounded-md accent-primary cursor-pointer"
              />
            </label>
          </div>
        </section>

        <!-- 4. WHATSAPP & NOTIFICATIONS -->
        <section class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
          <div class="p-6 border-b border-border bg-bg-secondary/30 flex items-center gap-3">
            <Bell class="w-5 h-5 text-primary" />
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">WhatsApp & Notifications</h2>
          </div>
          <div class="p-6 space-y-6">
            <div class="space-y-2">
              <label class="block text-sm font-bold text-text">WhatsApp Phone Number</label>
              <input
                type="tel"
                v-model="whatsappNumber"
                placeholder="+55 (11) 99999-9999"
                class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm text-text outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              <p class="text-xs text-text-muted">Receive daily practice nudges and streak warnings on WhatsApp</p>
            </div>

            <label class="flex items-center justify-between cursor-pointer pt-2">
              <div>
                <p class="text-sm font-bold text-text">Allow WhatsApp Reminders</p>
                <p class="text-xs text-text-muted">Permit Teacher Tati to message you to keep your streak</p>
              </div>
              <input
                type="checkbox"
                v-model="allowWhatsappNotifications"
                class="w-5 h-5 rounded-md accent-primary cursor-pointer"
              />
            </label>
          </div>
        </section>

        <!-- Save button bar -->
        <div class="flex justify-end pt-4">
          <button
            type="button"
            @click="handleSave"
            :disabled="isSaving"
            class="px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save class="w-4 h-4" />
            <span>{{ isSaving ? 'Saving...' : 'Save Settings' }}</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
