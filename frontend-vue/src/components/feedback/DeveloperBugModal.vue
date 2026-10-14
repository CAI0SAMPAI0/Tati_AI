<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Bug, Upload, X, Loader2, Send, CheckCircle2 } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const title = ref('');
const description = ref('');
const contactInfo = ref('');
const imageUrls = ref<string[]>([]);
const isUploading = ref(false);
const isSubmitting = ref(false);
const alertMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const fileInputRef = ref<HTMLInputElement | null>(null);

function handleRemoveImage(index: number) {
  imageUrls.value.splice(index, 1);
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alertMessage.value = { type: 'error', text: 'Por favor, selecione um arquivo de imagem.' };
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alertMessage.value = { type: 'error', text: 'A imagem deve ter no máximo 10MB.' };
    return;
  }

  isUploading.value = true;
  alertMessage.value = null;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/flashcard-assets/upload-image', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.url) {
        imageUrls.value.push(data.url);
        alertMessage.value = { type: 'success', text: 'Captura de tela anexada com sucesso!' };
      } else {
        alertMessage.value = { type: 'error', text: 'Erro ao fazer upload da imagem.' };
      }
    } else {
      alertMessage.value = { type: 'error', text: 'Erro ao fazer upload da imagem.' };
    }
  } catch {
    alertMessage.value = { type: 'error', text: 'Erro de conexão no upload.' };
  } finally {
    isUploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) {
    alertMessage.value = { type: 'error', text: 'Por favor, preencha o título e a descrição do problema.' };
    return;
  }

  isSubmitting.value = true;
  alertMessage.value = null;

  try {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const finalDescription = contactInfo.value.trim()
      ? `${description.value.trim()}\n\n---\nContato informado pelo usuário: ${contactInfo.value.trim()}`
      : description.value.trim();

    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/activities/developer-bug-report', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: title.value.trim(),
        description: finalDescription,
        image_urls: imageUrls.value,
        page_url: pageUrl,
        user_agent: userAgent,
      }),
    });

    if (!res.ok) {
      throw new Error('Falha ao enviar relatório.');
    }

    alertMessage.value = { type: 'success', text: 'Relatório de bug enviado ao programador! Obrigado por reportar.' };
    setTimeout(() => {
      title.value = '';
      description.value = '';
      contactInfo.value = '';
      imageUrls.value = [];
      alertMessage.value = null;
      emit('close');
    }, 1500);
  } catch {
    alertMessage.value = { type: 'error', text: 'Erro ao enviar relatório de bug. Tente novamente.' };
  } finally {
    isSubmitting.value = false;
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden"
    >
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/75 dark:bg-black/85 cursor-pointer transition-opacity"
        @click="emit('close')"
      />

      <!-- Modal Card -->
      <div
        class="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto z-10 animate-fadeIn"
      >
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-border mb-4">
          <h2 class="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Bug :size="18" class="text-red-500" />
            Reportar Problema Técnico ao Programador
          </h2>
          <button
            type="button"
            class="text-text-muted hover:text-text p-1 rounded-lg transition-colors"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4 pt-1">
          <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
              <Bug :size="18" />
            </div>
            <div class="text-xs text-text-subtle leading-relaxed">
              <p class="font-semibold text-text mb-0.5">Fale diretamente com a equipe de desenvolvimento</p>
              Encontrou algum bug, erro na tela ou botão que não responde? Descreva abaixo e anexe fotos se desejar para resolvermos o mais rápido possível.
            </div>
          </div>

          <!-- Alert feedback -->
          <div
            v-if="alertMessage"
            :class="alertMessage.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'"
            class="p-3 rounded-xl border text-xs font-medium"
          >
            {{ alertMessage.text }}
          </div>

          <!-- Título do bug -->
          <div>
            <label class="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              O que deu errado? (Título)
            </label>
            <input
              v-model="title"
              type="text"
              placeholder="Ex: Botão não avança no flashcard, áudio não toca..."
              class="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-text text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              required
            />
          </div>

          <!-- Descrição detalhada -->
          <div>
            <label class="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Detalhes do problema
            </label>
            <textarea
              v-model="description"
              rows="4"
              placeholder="O que você estava fazendo quando o erro ocorreu? Apareceu alguma mensagem?"
              class="w-full bg-bg border border-border rounded-2xl p-3.5 text-text text-sm placeholder:text-text-muted/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              required
            />
          </div>

          <!-- Contato opcional -->
          <div>
            <label class="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Seu Email ou WhatsApp <span class="text-text-muted/60 font-normal lowercase">(opcional para retorno)</span>
            </label>
            <input
              v-model="contactInfo"
              type="text"
              placeholder="Ex: aluno@gmail.com ou (11) 99999-9999"
              class="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-text text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <!-- Upload de fotos -->
          <div>
            <label class="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Fotos / Capturas de tela (Opcional)
            </label>

            <!-- Miniaturas -->
            <div v-if="imageUrls.length > 0" class="flex flex-wrap gap-2.5 mb-2.5">
              <div
                v-for="(url, idx) in imageUrls"
                :key="idx"
                class="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm"
              >
                <img :src="url" :alt="`Anexo ${idx + 1}`" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="handleRemoveImage(idx)"
                  class="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                  title="Remover anexo"
                >
                  <X :size="12" />
                </button>
              </div>
            </div>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
            />

            <button
              type="button"
              :disabled="isUploading"
              @click="fileInputRef?.click()"
              class="w-full py-2.5 border-dashed border-2 border-border hover:border-primary/50 rounded-xl text-xs font-semibold text-text flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Loader2 v-if="isUploading" :size="16" class="animate-spin text-primary" />
              <template v-else>
                <Upload :size="16" />
                <span>Anexar print / foto da tela</span>
              </template>
            </button>
          </div>

          <!-- Contexto automático da página -->
          <div class="text-[11px] text-text-muted bg-surface/50 rounded-xl p-2.5 border border-border/50 flex items-center gap-2">
            <CheckCircle2 :size="14" class="text-emerald-400 shrink-0" />
            <span>A URL da página e dados do navegador serão incluídos automaticamente no relatório.</span>
          </div>

          <!-- Ações -->
          <div class="flex gap-3 justify-end pt-2">
            <button
              type="button"
              :disabled="isSubmitting"
              @click="emit('close')"
              class="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-text hover:bg-bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || !title.trim() || !description.trim()"
              class="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Loader2 v-if="isSubmitting" :size="15" class="animate-spin" />
              <template v-else>
                <Send :size="15" />
                <span>Enviar ao Programador</span>
              </template>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
