<script setup lang="ts">
import { ref } from 'vue';
import { Bug, X, Send } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/api/client';
import DialogModal from '../ui/DialogModal.vue';
import Button from '../ui/Button.vue';

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
const isSubmitting = ref(false);

async function handleSubmit() {
  if (!title.value.trim() || !description.value.trim()) {
    toast.error('Preencha o título e a descrição do problema.');
    return;
  }

  isSubmitting.value = true;
  try {
    await apiPost('/feedback/developer-bug', {
      title: title.value.trim(),
      description: description.value.trim(),
      contact_info: contactInfo.value.trim(),
    });
    toast.success('Relato de bug enviado com sucesso! Obrigado pelo feedback.');
    title.value = '';
    description.value = '';
    contactInfo.value = '';
    emit('close');
  } catch {
    toast.error('Erro ao enviar o relato. Tente novamente mais tarde.');
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <DialogModal
    :is-open="isOpen"
    title="Reportar Bug ou Dificuldade"
    cancel-text="Cancelar"
    confirm-text="Enviar Relatório"
    :is-loading="isSubmitting"
    @cancel="emit('close')"
    @close="emit('close')"
    @confirm="handleSubmit"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-semibold text-text-muted mb-1">Título do Problema</label>
        <input
          v-model="title"
          type="text"
          placeholder="Ex: Erro ao iniciar exame ou áudio travando"
          class="w-full px-3.5 py-2 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-text-muted mb-1">Descrição Detalhada</label>
        <textarea
          v-model="description"
          rows="3"
          placeholder="Explique o que aconteceu, qual botão clicou ou qual erro apareceu..."
          class="w-full px-3.5 py-2 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary resize-none"
        ></textarea>
      </div>

      <div>
        <label class="block text-xs font-semibold text-text-muted mb-1">Seu Contato (Email / WhatsApp)</label>
        <input
          v-model="contactInfo"
          type="text"
          placeholder="Opcional - para podermos avisar da correção"
          class="w-full px-3.5 py-2 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  </DialogModal>
</template>
