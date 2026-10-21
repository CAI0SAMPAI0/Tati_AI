<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { X } from 'lucide-vue-next';
import { getConversations, deleteConversation } from '@/api/chat';
import type { Conversation } from '@/api/types';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  currentId: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', id: string, title: string): void;
  (e: 'delete', id: string): void;
}>();

const toast = useToast();
const conversations = ref<Conversation[]>([]);
const isLoading = ref(true);

async function load() {
  isLoading.value = true;
  try {
    const list = await getConversations(50, 0);
    conversations.value = list || [];
  } catch (err) {
    console.error('Error loading conversations:', err);
  } finally {
    isLoading.value = false;
  }
}

const groups = computed(() => {
  if (!conversations.value.length) return null;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const grouped: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    Earlier: [],
  };

  conversations.value.forEach((c) => {
    const d = new Date(c.updated_at || c.created_at).toDateString();
    if (d === today) grouped.Today.push(c);
    else if (d === yesterday) grouped.Yesterday.push(c);
    else grouped.Earlier.push(c);
  });

  return grouped;
});

async function handleDelete(e: MouseEvent, id: string) {
  e.stopPropagation();
  if (!confirm('Delete this conversation?')) return;

  try {
    await deleteConversation(id);
    conversations.value = conversations.value.filter((c) => c.id !== id);
    emit('delete', id);
    toast.success('Conversation deleted.');
  } catch (err) {
    console.error('Error deleting conversation:', err);
    toast.error('Could not delete conversation.');
  }
}

defineExpose({
  load,
  addConversation: (conv: Conversation) => {
    conversations.value.unshift(conv);
  },
  updateConversationTitle: (id: string, title: string) => {
    const c = conversations.value.find((item) => item.id === id);
    if (c) c.title = title;
  },
});

onMounted(() => {
  load();
});
</script>

<template>
  <div class="px-2 py-1">
    <div v-if="isLoading" class="p-4 text-center text-xs text-text-muted animate-pulse">
      Loading conversations...
    </div>

    <div v-else-if="conversations.length === 0" class="p-4 text-center text-xs text-text-muted">
      No conversations yet
    </div>

    <div v-else-if="groups">
      <div v-for="(items, label) in groups" :key="label" class="mb-4">
        <div v-if="items.length > 0">
          <h3 class="px-2 mb-1 text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">
            {{ label }}
          </h3>

          <div class="space-y-0.5">
            <div
              v-for="c in items"
              :key="c.id"
              @click="emit('select', c.id, c.title)"
              class="group relative flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors"
              :class="
                c.id === currentId
                  ? 'bg-primary text-white font-semibold'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              "
            >
              <span class="flex-1 text-[0.82rem] truncate leading-tight">
                {{ c.title }}
              </span>

              <button
                type="button"
                @click="(e) => handleDelete(e, c.id)"
                class="opacity-0 group-hover:opacity-100 p-1 hover:text-danger transition-opacity"
                title="Delete"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

