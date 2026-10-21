<script setup lang="ts">
import { ref } from 'vue';
import { Bug, Upload, X, Loader2, Send, CheckCircle2 } from 'lucide-vue-next';
import { apiPost, apiUpload } from '@/api/client';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const toast = useToast();
const title = ref('');
const description = ref('');
const contactInfo = ref('');
const imageUrls = ref<string[]>([]);
const isUploading = ref(false);
const isSubmitting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast.error('Por favor, selecione um arquivo de imagem.');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    toast.error('A imagem deve ter no máximo 10MB.');
    return;
  }

  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', file);
    // Tenta upload via endpoint público de screenshot, fallback para assets
    let res: { url?: string } | null = null;
    try {
      res = await apiUpload<{ url: string }>('/activities/upload-bug-screenshot', formData);
    } catch {
      res = await apiUpload<{ url: string }>('/flashcard-assets/upload-image', formData);
    }

    if (res && res.url) {
      imageUrls.value.push(res.url);
      toast.success('Captura de tela anexada com sucesso!');
    } else {
      toast.error('Erro ao fazer upload da imagem.');
    }
  } catch (err) {
    toast.error('Erro de conexão no upload da imagem.');
  } finally {
    isUploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
}

function handleRemoveImage(indexToRemove: number) {
  imageUrls.value = imageUrls.value.filter((_, idx) => idx !== indexToRemove);
}

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) {
    toast.error('Por favor, preencha o título e a descrição do problema.');
    return;
  }

  isSubmitting.value = true;
  try {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const finalDescription = contactInfo.value.trim()
      ? `${description.value.trim()}\n\n---\nContato informado pelo usuário: ${contactInfo.value.trim()}`
      : description.value.trim();

    await apiPost('/activities/developer-bug-report', {
      title: title.value.trim(),
      description: finalDescription,
      image_urls: imageUrls.value,
      page_url: pageUrl,
      user_agent: userAgent,
    });

    toast.success('Relatório de bug enviado ao programador! Obrigado por reportar.');
    title.value = '';
    description.value = '';
    contactInfo.value = '';
    imageUrls.value = [];
    emit('close');
  } catch (err) {
    toast.error('Erro ao enviar o relato. Tente novamente mais tarde.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      @click="emit('close')"
    >
      <div
        class="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border/40 pb-3">
          <div class="flex items-center gap-2 text-red-500 font-bold text-base">
            <Bug class="w-5 h-5 text-red-500" />
            <h3 class="text-text font-bold">Reportar Problema Técnico ao Programador</h3>
          </div>
          <button
            type="button"
            @click="emit('close')"
            class="p-1 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Banner Info -->
        <div class="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bug class="w-4 h-4" />
          </div>
          <div class="text-xs text-text-subtle leading-relaxed">
            <p class="font-semibold text-text mb-0.5">Fale diretamente com a equipe de desenvolvimento</p>
            Encontrou algum bug, erro na tela ou botão que não responde? Descreva abaixo e anexe fotos se desejar para resolvermos o mais rápido possível.
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Título -->
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

          <!-- Descrição -->
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
            ></textarea>
          </div>

          <!-- Contato Opcional -->
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

          <!-- Upload Fotos -->
          <div>
            <label class="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
              Fotos / Capturas de tela (Opcional)
            </label>

            <!-- Thumbnails -->
            <div v-if="imageUrls.length > 0" class="flex flex-wrap gap-2.5 mb-2.5">
              <div
                v-for="(url, idx) in imageUrls"
                :key="idx"
                class="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-xs"
              >
                <img :src="url" :alt="`Anexo ${idx + 1}`" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="handleRemoveImage(idx)"
                  class="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                  title="Remover anexo"
                >
                  <X class="w-3 h-3" />
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

            <Button
              type="button"
              variant="secondary"
              @click="fileInputRef?.click()"
              :disabled="isUploading"
              class="w-full text-xs gap-2 py-2.5 border-dashed border-2 hover:border-primary/50"
            >
              <template v-if="isUploading">
                <Loader2 class="w-4 h-4 animate-spin" /> Fazendo upload da foto...
              </template>
              <template v-else>
                <Upload class="w-4 h-4" /> Anexar print / foto da tela
              </template>
            </Button>
          </div>

          <!-- Informações de Contexto -->
          <div class="text-[11px] text-text-muted bg-surface/50 rounded-xl p-2.5 border border-border/50 flex items-center gap-2">
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>A URL da página e dados do navegador serão incluídos automaticamente no relatório.</span>
          </div>

          <!-- Footer Buttons -->
          <div class="flex gap-3 justify-end pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="secondary"
              @click="emit('close')"
              :disabled="isSubmitting"
            >
              Cancelar
            </Button>
            <button
              type="submit"
              :disabled="isSubmitting || !title.trim() || !description.trim()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <template v-if="isSubmitting">
                <Loader2 class="w-4 h-4 animate-spin" /> Enviando ao programador...
              </template>
              <template v-else>
                <Send class="w-4 h-4" /> Enviar ao Programador
              </template>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
