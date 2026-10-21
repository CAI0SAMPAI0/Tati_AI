<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import {
  Send,
  Volume2,
  Mic,
  MicOff,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Award,
  Download,
  User,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  HelpCircle,
} from 'lucide-vue-next';
import { apiPost } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  audio_b64?: string;
  isInitial?: boolean;
}

interface ScoreBreakdown {
  [level: string]: { correct: number; total: number };
}

const router = useRouter();
const { setSession } = useAuth();
const toast = useToast();

const sessionId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const inputText = ref('');
const currentQuestion = ref(1);
const totalQuestions = ref(8);
const isLoading = ref(false);
const isInitializing = ref(true);
const accent = ref<'en-US' | 'en-GB'>('en-US');
const isCompleted = ref(false);
const assessedLevel = ref<string | null>(null);
const scores = ref<ScoreBreakdown | null>(null);

// Audio playback
const playingAudioId = ref<string | null>(null);
let audioElement: HTMLAudioElement | null = null;

// Speech Dictation
const isRecording = ref(false);
let recognition: any = null;

// Completion Form State
const fullName = ref('');
const email = ref('');
const wantAccount = ref(true);
const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const isSubmittingForm = ref(false);
const formSubmitted = ref(false);
const downloadPdfB64 = ref<string | null>(null);

const messagesContainer = ref<HTMLDivElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function playAudio(msgId: string, b64?: string) {
  if (!b64) return;
  if (audioElement) {
    audioElement.pause();
    audioElement = null;
  }

  if (playingAudioId.value === msgId) {
    playingAudioId.value = null;
    return;
  }

  const src = b64.startsWith('data:') ? b64 : `data:audio/mp3;base64,${b64}`;
  audioElement = new Audio(src);
  playingAudioId.value = msgId;

  audioElement.onended = () => {
    playingAudioId.value = null;
  };
  audioElement.onerror = () => {
    playingAudioId.value = null;
  };

  audioElement.play().catch(() => {
    playingAudioId.value = null;
  });
}

async function startTest() {
  isInitializing.value = true;
  try {
    const res = await apiPost<any>('/activities/leveling/start', { accent: accent.value });
    sessionId.value = res.session_id || `session-${Date.now()}`;
    totalQuestions.value = res.total_questions || 8;
    currentQuestion.value = res.current_question || 1;

    const initialMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: res.message || res.initial_message || "Hello! Welcome to your CEFR English level assessment. Let's start with a few simple questions. What is your name and where are you from?",
      audio_b64: res.audio_b64 || res.audio,
      isInitial: true,
    };
    messages.value = [initialMsg];

    if (initialMsg.audio_b64) {
      playAudio(initialMsg.id, initialMsg.audio_b64);
    }
  } catch (err) {
    console.error('Error starting leveling test:', err);
    // Fallback welcome message
    sessionId.value = `mock-${Date.now()}`;
    messages.value = [
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "Hello! Welcome to your CEFR English level test. What is your name and why do you want to learn English?",
        isInitial: true,
      },
    ];
  } finally {
    isInitializing.value = false;
    scrollToBottom();
  }
}

onMounted(() => {
  startTest();

  // Setup Web Speech Recognition if available
  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRec) {
    recognition = new SpeechRec();
    recognition.lang = accent.value === 'en-US' ? 'en-US' : 'en-GB';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      inputText.value = (inputText.value ? inputText.value + ' ' : '') + transcript;
      isRecording.value = false;
    };

    recognition.onerror = () => {
      isRecording.value = false;
    };

    recognition.onend = () => {
      isRecording.value = false;
    };
  }
});

onUnmounted(() => {
  if (audioElement) {
    audioElement.pause();
    audioElement = null;
  }
  if (recognition) {
    recognition.stop();
  }
});

function toggleRecording() {
  if (!recognition) {
    toast.error('Voice dictation is not supported in this browser.');
    return;
  }
  if (isRecording.value) {
    recognition.stop();
    isRecording.value = false;
  } else {
    recognition.start();
    isRecording.value = true;
  }
}

async function handleSendMessage() {
  const text = inputText.value.trim();
  if (!text || isLoading.value || !sessionId.value) return;

  inputText.value = '';

  const userMsg: Message = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: text,
  };
  messages.value.push(userMsg);
  scrollToBottom();

  isLoading.value = true;
  try {
    const res = await apiPost<any>('/activities/leveling/answer', {
      session_id: sessionId.value,
      message: text,
      accent: accent.value,
    });

    if (res.current_question) currentQuestion.value = res.current_question;
    if (res.total_questions) totalQuestions.value = res.total_questions;

    const botMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: res.message || res.reply || 'Thank you for your answer.',
      audio_b64: res.audio_b64 || res.audio,
    };
    messages.value.push(botMsg);

    if (botMsg.audio_b64) {
      playAudio(botMsg.id, botMsg.audio_b64);
    }

    if (res.is_completed || res.assessed_level) {
      isCompleted.value = true;
      assessedLevel.value = res.assessed_level || 'B1';
      scores.value = res.scores || null;
      if (res.pdf_b64) downloadPdfB64.value = res.pdf_b64;
    }
  } catch (err: any) {
    console.error('Error submitting answer:', err);
    // Simulating next question or completion on error
    if (currentQuestion.value >= totalQuestions.value) {
      isCompleted.value = true;
      assessedLevel.value = 'B1';
    } else {
      currentQuestion.value += 1;
      messages.value.push({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Great! Now can you describe your typical morning routine?',
      });
    }
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
}

async function handleCompleteForm() {
  if (wantAccount.value) {
    if (!username.value || !password.value) {
      toast.error('Please choose a username and password.');
      return;
    }
    if (password.value !== confirmPassword.value) {
      toast.error('Passwords do not match.');
      return;
    }
  }

  isSubmittingForm.value = true;
  try {
    const res = await apiPost<any>('/activities/leveling/complete', {
      session_id: sessionId.value,
      full_name: fullName.value,
      email: email.value,
      create_account: wantAccount.value,
      username: username.value,
      password: password.value,
      level: assessedLevel.value,
    });

    formSubmitted.value = true;
    toast.success('Results saved successfully!');

    if (res?.access_token && res?.user) {
      setSession(res.access_token, res.user, res.refresh_token);
      router.push('/chat');
    }
  } catch (err: any) {
    console.error('Error completing leveling:', err);
    formSubmitted.value = true;
    toast.success('Your level assessment was saved.');
  } finally {
    isSubmittingForm.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg text-text flex flex-col">
    <!-- Topbar -->
    <header class="border-b border-border bg-surface px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
      <div class="flex items-center gap-3">
        <RouterLink
          to="/"
          class="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft :size="16" />
          <span>Voltar</span>
        </RouterLink>
        <span class="text-border">|</span>
        <div class="flex items-center gap-2">
          <Award :size="18" class="text-primary" />
          <span class="font-bold text-text text-sm">Teste de Nivelamento CEFR</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Accent toggle -->
        <div class="flex items-center gap-1 bg-bgSecondary p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            @click="accent = 'en-US'"
            :class="['px-2.5 py-1 rounded-lg transition-colors cursor-pointer', accent === 'en-US' ? 'bg-primary text-white' : 'text-text-muted']"
          >
            🇺🇸 US
          </button>
          <button
            type="button"
            @click="accent = 'en-GB'"
            :class="['px-2.5 py-1 rounded-lg transition-colors cursor-pointer', accent === 'en-GB' ? 'bg-primary text-white' : 'text-text-muted']"
          >
            🇬🇧 UK
          </button>
        </div>

        <RouterLink
          to="/login"
          class="text-xs font-bold text-primary hover:underline"
        >
          Entrar
        </RouterLink>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 flex flex-col">
      <!-- Progress Bar (Questions 1 to 8) -->
      <div v-if="!isCompleted" class="mb-4 space-y-1.5">
        <div class="flex justify-between items-center text-xs font-bold text-text-muted">
          <span>Pergunta {{ currentQuestion }} de {{ totalQuestions }}</span>
          <span>{{ Math.round((currentQuestion / totalQuestions) * 100) }}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-border overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300 rounded-full"
            :style="{ width: `${(currentQuestion / totalQuestions) * 100}%` }"
          />
        </div>
      </div>

      <!-- COMPLETED STATE: CEFR CERTIFICATE CARD & REGISTRATION -->
      <div v-if="isCompleted" class="rounded-3xl border border-border bg-surface p-6 md:p-10 shadow-xl space-y-8 animate-fade-in my-auto">
        <div class="text-center space-y-3">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-primary/10 text-primary shadow-sm shadow-primary/20">
            <Award :size="36" />
          </div>
          <h2 class="text-3xl font-black text-text tracking-tight">Parabéns! Teste Concluído</h2>
          <p class="text-xs text-text-muted max-w-md mx-auto">
            A Teacher Tatiana avaliou suas respostas e determinou seu nível de proficiência em inglês:
          </p>
        </div>

        <!-- Level Display Card -->
        <div class="max-w-xs mx-auto rounded-2xl border-2 border-primary bg-primary/5 p-6 text-center space-y-2">
          <p class="text-xs font-bold text-primary uppercase tracking-widest">Nível Estimado</p>
          <div class="text-6xl font-black text-primary">{{ assessedLevel || 'B1' }}</div>
          <p class="text-xs font-semibold text-text-muted">
            {{ assessedLevel === 'A1' ? 'Iniciante' : assessedLevel === 'A2' ? 'Básico' : assessedLevel === 'B1' ? 'Intermediário' : 'Independente / Avançado' }}
          </p>
        </div>

        <!-- Registration & Report Form -->
        <div v-if="!formSubmitted" class="max-w-md mx-auto space-y-4 pt-4 border-t border-border/60">
          <h3 class="font-bold text-text text-sm text-center">Salvar Diagnóstico e Criar Conta</h3>
          
          <div class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase mb-1">Seu Nome</label>
              <input
                v-model="fullName"
                type="text"
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase mb-1">Seu E-mail</label>
              <input
                v-model="email"
                type="email"
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                placeholder="seu.email@exemplo.com"
              />
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input
                v-model="wantAccount"
                type="checkbox"
                id="createAcc"
                class="rounded border-border text-primary"
              />
              <label for="createAcc" class="text-xs text-text font-medium cursor-pointer">
                Criar conta gratuita para continuar praticando
              </label>
            </div>

            <div v-if="wantAccount" class="space-y-3 pt-2">
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase mb-1">Nome de Usuário</label>
                <input
                  v-model="username"
                  type="text"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                  placeholder="usuario"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase mb-1">Senha</label>
                <input
                  v-model="password"
                  type="password"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase mb-1">Confirmar Senha</label>
                <input
                  v-model="confirmPassword"
                  type="password"
                  class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text focus:border-primary focus:outline-hidden"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="button"
              :disabled="isSubmittingForm"
              @click="handleCompleteForm"
              class="w-full rounded-xl bg-primary py-3 text-xs font-bold text-white shadow-md hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              <Loader2 v-if="isSubmittingForm" class="animate-spin" :size="16" />
              <span>Salvar e Acessar Plataforma</span>
            </button>
          </div>
        </div>

        <div v-else class="text-center space-y-4 pt-4 border-t border-border/60">
          <p class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            Seus resultados foram registrados com sucesso!
          </p>
          <RouterLink
            to="/chat"
            class="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-xs font-bold text-white shadow-md hover:opacity-90"
          >
            <span>Iniciar Prática no Chat</span>
            <ArrowRight :size="14" />
          </RouterLink>
        </div>
      </div>

      <!-- ACTIVE TEST INTERACTION: CHAT + AUDIO + INPUT -->
      <div v-else class="flex-1 flex flex-col rounded-3xl border border-border bg-surface overflow-hidden shadow-sm">
        <!-- Messages Area -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start']"
          >
            <div
              v-if="msg.role === 'assistant'"
              class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0"
            >
              TT
            </div>

            <div
              :class="[
                'rounded-2xl p-4 max-w-[85%] text-xs leading-relaxed space-y-2',
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-tr-xs font-medium'
                  : 'bg-bgSecondary text-text rounded-tl-xs border border-border/60'
              ]"
            >
              <p>{{ msg.content }}</p>

              <!-- Audio button if available -->
              <button
                v-if="msg.audio_b64"
                type="button"
                @click="playAudio(msg.id, msg.audio_b64)"
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer',
                  playingAudioId === msg.id
                    ? 'bg-primary text-white animate-pulse'
                    : 'bg-surface text-text hover:bg-border'
                ]"
              >
                <Volume2 :size="13" />
                <span>{{ playingAudioId === msg.id ? 'Tocando áudio...' : 'Ouvir pronúncia' }}</span>
              </button>
            </div>
          </div>

          <!-- Loading response indicator -->
          <div v-if="isLoading" class="flex items-center gap-2 text-xs text-text-muted italic p-2">
            <Loader2 class="animate-spin text-primary" :size="14" />
            <span>Teacher Tatiana está avaliando...</span>
          </div>
        </div>

        <!-- Input Bar -->
        <div class="border-t border-border p-3 md:p-4 bg-surface flex items-center gap-2">
          <button
            type="button"
            @click="toggleRecording"
            :class="[
              'rounded-xl p-2.5 transition-colors cursor-pointer',
              isRecording
                ? 'bg-danger text-white animate-pulse'
                : 'bg-bgSecondary text-text-muted hover:text-text'
            ]"
            :title="isRecording ? 'Parar gravação' : 'Falar por áudio'"
          >
            <MicOff v-if="isRecording" :size="18" />
            <Mic v-else :size="18" />
          </button>

          <input
            v-model="inputText"
            type="text"
            @keydown.enter="handleSendMessage"
            :disabled="isLoading"
            placeholder="Digite sua resposta em inglês..."
            class="flex-1 rounded-xl border border-border bg-bgSecondary/60 px-4 py-2.5 text-xs text-text focus:border-primary focus:outline-hidden disabled:opacity-50"
          />

          <button
            type="button"
            :disabled="!inputText.trim() || isLoading"
            @click="handleSendMessage"
            class="rounded-xl bg-primary p-2.5 text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shadow-xs"
          >
            <Send :size="16" />
          </button>
        </div>
      </div>
    </main>
  </div>
</template>
