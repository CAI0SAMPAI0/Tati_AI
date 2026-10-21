<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MessageSquare, Star, CheckCircle, RefreshCw } from 'lucide-vue-next';
import { apiGet, apiPatch } from '@/api/client';
import { formatDateTime } from '@/utils';
import { useToast } from '@/composables/useToast';

interface FeedbackItem {
  id: string;
  username: string;
  rating: number;
  comment: string;
  is_resolved?: boolean;
  created_at: string;
}

const toast = useToast();
const feedbacks = ref<FeedbackItem[]>([]);
const isLoading = ref(true);

async function loadFeedbacks() {
  isLoading.value = true;
  try {
    const res = await apiGet<any>('/dashboard/feedbacks');
    feedbacks.value = Array.isArray(res) ? res : res?.data || [];
  } catch (err) {
    console.error('Error loading feedbacks:', err);
  } finally {
    isLoading.value = false;
  }
}

async function toggleResolved(item: FeedbackItem) {
  try {
    await apiPatch(`/dashboard/feedbacks/${item.id}`, {
      is_resolved: !item.is_resolved,
    });
    item.is_resolved = !item.is_resolved;
    toast.success('Feedback status updated.');
  } catch (err) {
    console.error('Error updating feedback status:', err);
    toast.error('Failed to update status.');
  }
}

onMounted(() => {
  loadFeedbacks();
});
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div>
      <h3 class="font-bold text-base text-text flex items-center gap-2">
        <MessageSquare class="w-5 h-5 text-primary" />
        Student Feedback & Platform Reviews
      </h3>
      <p class="text-xs text-text-muted mt-0.5">
        Reviews, satisfaction ratings, and feature suggestions submitted by students.
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-16 text-center">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs font-bold text-text-muted">Loading feedbacks...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="feedbacks.length === 0" class="p-12 text-center bg-surface border border-border rounded-3xl">
      <MessageSquare class="w-12 h-12 text-text-subtle mx-auto mb-3 opacity-60" />
      <h4 class="font-bold text-text text-sm">No feedbacks recorded</h4>
      <p class="text-xs text-text-muted mt-1">Student suggestions and ratings will appear here.</p>
    </div>

    <!-- Feedbacks List -->
    <div v-else class="space-y-3">
      <div
        v-for="item in feedbacks"
        :key="item.id"
        class="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="space-y-1.5 min-w-0">
          <div class="flex items-center gap-3">
            <span class="font-bold text-sm text-text">@{{ item.username }}</span>
            <div class="flex items-center text-amber-400">
              <Star
                v-for="star in 5"
                :key="star"
                class="w-3.5 h-3.5"
                :class="star <= item.rating ? 'fill-current' : 'opacity-20'"
              />
            </div>
            <span class="text-[0.65rem] text-text-muted">{{ formatDateTime(item.created_at) }}</span>
          </div>

          <p class="text-xs text-text-muted leading-relaxed">{{ item.comment }}</p>
        </div>

        <button
          type="button"
          @click="toggleResolved(item)"
          class="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all self-start sm:self-auto shrink-0 flex items-center gap-1.5"
          :class="
            item.is_resolved
              ? 'bg-success/10 border-success/30 text-success'
              : 'border-border bg-bg-secondary text-text-muted hover:text-text'
          "
        >
          <CheckCircle class="w-3.5 h-3.5" />
          <span>{{ item.is_resolved ? 'Resolved' : 'Mark as Resolved' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
