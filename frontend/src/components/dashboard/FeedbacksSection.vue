<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  MessageSquare,
  Star,
  CheckCircle,
  RefreshCw,
  BookOpen,
  User,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-vue-next';
import { apiGet, apiPatch } from '@/api/client';
import { formatDateTime } from '@/utils';
import { useToast } from '@/composables/useToast';
import { DEFAULT_AVATAR_URL } from '@/constants/user';

interface FeedbackItem {
  id: string;
  student_username: string;
  student_name?: string;
  student_avatar_url?: string;
  username?: string;
  cefr_level?: string;
  area?: string;
  activity_id?: string;
  activity_title?: string;
  rating: number;
  comment: string;
  teacher_reply?: string;
  status?: string;
  is_resolved?: boolean;
  created_at: string;
}

const toast = useToast();
const feedbacks = ref<FeedbackItem[]>([]);
const isLoading = ref(true);
const replyingToId = ref<string | null>(null);
const replyDrafts = ref<Record<string, string>>({});
const isSavingReply = ref<Record<string, boolean>>({});

async function loadFeedbacks() {
  isLoading.value = true;
  try {
    const res = await apiGet<any>('/dashboard/feedbacks');
    const rawList = Array.isArray(res) ? res : res?.data || [];
    feedbacks.value = rawList.map((f: any) => ({
      ...f,
      username: f.student_username || f.username || 'student',
      is_resolved: f.status === 'resolved' || Boolean(f.is_resolved),
    }));
    // Pre-popula rascunhos de resposta da professora
    for (const item of feedbacks.value) {
      if (item.teacher_reply && !replyDrafts.value[item.id]) {
        replyDrafts.value[item.id] = item.teacher_reply;
      }
    }
  } catch (err) {
    console.error('Error loading feedbacks:', err);
  } finally {
    isLoading.value = false;
  }
}

async function toggleResolved(item: FeedbackItem) {
  const nextStatus = item.is_resolved ? 'pending' : 'resolved';
  try {
    await apiPatch(`/dashboard/feedbacks/${item.id}`, {
      status: nextStatus,
    });
    item.is_resolved = !item.is_resolved;
    item.status = nextStatus;
    toast.success(item.is_resolved ? 'Feedback marcado como resolvido.' : 'Feedback reaberto.');
  } catch (err) {
    console.error('Error updating feedback status:', err);
    toast.error('Falha ao atualizar status.');
  }
}

async function handleSaveTeacherReply(item: FeedbackItem) {
  const draft = (replyDrafts.value[item.id] || '').trim();
  isSavingReply.value[item.id] = true;
  try {
    await apiPatch(`/dashboard/feedbacks/${item.id}`, {
      teacher_reply: draft,
    });
    item.teacher_reply = draft;
    toast.success('Resposta da Tatiana salva com sucesso!');
    replyingToId.value = null;
  } catch (err) {
    console.error('Error saving teacher reply:', err);
    toast.error('Erro ao salvar resposta da professora.');
  } finally {
    isSavingReply.value[item.id] = false;
  }
}

function getAreaBadgeClass(area?: string) {
  switch ((area || '').toLowerCase()) {
    case 'grammar':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'vocabulary':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'reading':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    case 'listening':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'music':
      return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    case 'games':
      return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    default:
      return 'bg-bg-secondary text-text-muted border-border';
  }
}

onMounted(() => {
  loadFeedbacks();
});
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-bold text-base text-text flex items-center gap-2">
          <MessageSquare class="w-5 h-5 text-primary" />
          <span>Feedbacks dos Alunos &amp; Dúvidas sobre Atividades</span>
        </h3>
        <p class="text-xs text-text-muted mt-0.5">
          Veja exatamente quem enviou cada mensagem, qual atividade gerou a dúvida ou sugestão, e responda ao aluno.
        </p>
      </div>

      <button
        type="button"
        @click="loadFeedbacks"
        :disabled="isLoading"
        class="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="isLoading ? 'animate-spin' : ''" />
        <span>Atualizar</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-16 text-center">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs font-bold text-text-muted">Carregando feedbacks dos alunos...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="feedbacks.length === 0" class="p-12 text-center bg-surface border border-border rounded-3xl">
      <MessageSquare class="w-12 h-12 text-text-subtle mx-auto mb-3 opacity-60" />
      <h4 class="font-bold text-text text-sm">Nenhum feedback registrado no momento</h4>
      <p class="text-xs text-text-muted mt-1">Dúvidas, sugestões e notas dos alunos aparecerão aqui automaticamente.</p>
    </div>

    <!-- Feedbacks List -->
    <div v-else class="space-y-4">
      <div
        v-for="item in feedbacks"
        :key="item.id"
        class="p-5 sm:p-6 rounded-2xl bg-surface border border-border shadow-xs hover:border-primary/30 transition-all space-y-3.5"
      >
        <!-- Header do Card: Aluno, Nível, Categoria, Estrelas, Status -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div class="flex items-center gap-3">
            <img
              :src="item.student_avatar_url || DEFAULT_AVATAR_URL"
              :alt="item.student_name || item.student_username"
              class="w-10 h-10 rounded-full border border-border object-cover bg-bg-secondary shrink-0"
              referrerpolicy="no-referrer"
              @error="($event.target as HTMLImageElement).src = DEFAULT_AVATAR_URL"
            />
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-sm text-text">
                  {{ item.student_name || item.student_username }}
                </span>
                <span class="text-xs font-medium text-text-muted">
                  @{{ item.student_username }}
                </span>
                <span
                  v-if="item.cefr_level"
                  class="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[0.65rem] font-bold border border-primary/20 uppercase"
                >
                  Nível {{ item.cefr_level }}
                </span>
                <span
                  v-if="item.area"
                  class="px-2 py-0.5 rounded-md text-[0.65rem] font-bold uppercase border"
                  :class="getAreaBadgeClass(item.area)"
                >
                  {{ item.area }}
                </span>
              </div>
              <span class="text-[0.68rem] text-text-muted block mt-0.5">
                {{ formatDateTime(item.created_at) }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-3 self-end sm:self-auto">
            <!-- Avaliação por estrelas -->
            <div class="flex items-center text-amber-400">
              <Star
                v-for="star in 5"
                :key="star"
                class="w-3.5 h-3.5"
                :class="star <= item.rating ? 'fill-current' : 'opacity-20'"
              />
            </div>

            <button
              type="button"
              @click="toggleResolved(item)"
              class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
              :class="
                item.is_resolved
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'border-border bg-bg-secondary text-text-muted hover:text-text'
              "
            >
              <CheckCircle class="w-3.5 h-3.5" />
              <span>{{ item.is_resolved ? 'Resolvido' : 'Marcar como Resolvido' }}</span>
            </button>
          </div>
        </div>

        <!-- Atividade / Exercício Relacionado -->
        <div
          v-if="item.activity_title"
          class="px-3.5 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs flex items-center gap-2"
        >
          <BookOpen class="w-4 h-4 text-primary shrink-0" />
          <span class="text-text-muted">Em referência à atividade:</span>
          <strong class="text-text font-bold">{{ item.activity_title }}</strong>
        </div>

        <!-- Mensagem / Comentário do Aluno -->
        <div class="p-3.5 rounded-xl bg-bg border border-border/70 space-y-1">
          <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block">
            Mensagem do Aluno:
          </span>
          <p class="text-xs text-text leading-relaxed whitespace-pre-wrap font-medium">
            "{{ item.comment }}"
          </p>
        </div>

        <!-- Resposta da Professora Tatiana (se houver ou se estiver respondendo) -->
        <div v-if="item.teacher_reply && replyingToId !== item.id" class="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <Sparkles class="w-3 h-3" /> Resposta da Professora Tatiana:
            </span>
            <button
              type="button"
              @click="replyingToId = item.id"
              class="text-[0.68rem] text-primary hover:underline cursor-pointer font-semibold"
            >
              Editar resposta
            </button>
          </div>
          <p class="text-xs text-text italic leading-relaxed">
            "{{ item.teacher_reply }}"
          </p>
        </div>

        <!-- Caixa de Resposta da Professora -->
        <div v-else-if="replyingToId === item.id" class="space-y-2 pt-1">
          <label class="text-xs font-bold text-text flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-primary" />
            <span>Sua resposta para {{ item.student_name || item.student_username }}:</span>
          </label>
          <textarea
            rows="2"
            v-model="replyDrafts[item.id]"
            placeholder="Ex: Excelente sugestão, Rafael! Vamos preparar uma aula especial focada nos Perfect Tenses..."
            class="w-full px-3.5 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
          ></textarea>
          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              @click="replyingToId = null"
              class="px-3 py-1.5 rounded-lg border border-border text-xs text-text-muted hover:text-text cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="handleSaveTeacherReply(item)"
              :disabled="isSavingReply[item.id]"
              class="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send class="w-3 h-3" :class="isSavingReply[item.id] ? 'animate-spin' : ''" />
              <span>{{ isSavingReply[item.id] ? 'Salvando...' : 'Salvar Resposta' }}</span>
            </button>
          </div>
        </div>

        <!-- Botão para responder se ainda não tiver resposta -->
        <div v-else class="flex justify-end pt-0.5">
          <button
            type="button"
            @click="replyingToId = item.id"
            class="text-[0.7rem] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
          >
            <Send class="w-3 h-3" />
            <span>Responder a este aluno</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
