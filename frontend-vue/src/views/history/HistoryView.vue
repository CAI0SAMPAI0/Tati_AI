<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { History, Calendar, CheckCircle2 } from 'lucide-vue-next';
import { getExamHistory } from '@/api/exams';
import type { ExamHistoryItem } from '@/api/types';

const history = ref<ExamHistoryItem[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const list = await getExamHistory();
    history.value = list || [];
  } catch (err) {
    console.error('Error loading history:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Exam & Activity History</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Review your previous trimestral exams and milestone scores.
      </p>
    </div>

    <div v-if="loading" class="text-center py-12">
      <div class="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
      <p class="text-xs font-semibold text-text-muted">Loading history...</p>
    </div>

    <div v-else-if="history.length === 0" class="bg-surface border border-border rounded-2xl p-8 text-center">
      <History class="w-12 h-12 text-text-subtle mx-auto mb-3" />
      <h3 class="font-bold text-sm text-text">No completed exams yet</h3>
      <p class="text-xs text-text-muted mt-1">Complete your first trimestral exam to track your evolution.</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in history"
        :key="item.id"
        class="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
            <CheckCircle2 class="w-5 h-5" />
          </div>
          <div>
            <h4 class="font-bold text-sm text-text">Trimestral Exam (Level {{ item.level }})</h4>
            <span class="text-xs text-text-muted">{{ item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'Recent' }}</span>
          </div>
        </div>

        <div class="text-right">
          <span class="text-lg font-extrabold text-primary">{{ item.score }}%</span>
          <p class="text-[0.68rem] font-bold text-success uppercase">Completed</p>
        </div>
      </div>
    </div>
  </div>
</template>
