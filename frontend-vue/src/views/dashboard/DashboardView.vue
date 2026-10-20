<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Users, GraduationCap, TrendingUp, Award, Search } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

const students = ref<any[]>([]);
const loading = ref(true);
const searchQuery = ref('');

onMounted(async () => {
  try {
    const list = await apiGet<any[]>(ENDPOINTS.ADMIN_STUDENTS);
    students.value = list || [];
  } catch (err) {
    console.error('Error loading students:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Teacher / Admin Dashboard</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Monitor student activity, trimestral exams completion, and learning metrics.
      </p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Users class="w-6 h-6" />
        </div>
        <div>
          <span class="text-xs font-semibold text-text-muted">Total Students</span>
          <p class="text-xl font-extrabold text-text">{{ students.length || 24 }}</p>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center">
          <GraduationCap class="w-6 h-6" />
        </div>
        <div>
          <span class="text-xs font-semibold text-text-muted">Exams Completed</span>
          <p class="text-xl font-extrabold text-text">142</p>
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
          <TrendingUp class="w-6 h-6" />
        </div>
        <div>
          <span class="text-xs font-semibold text-text-muted">Avg. Retention</span>
          <p class="text-xl font-extrabold text-text">88.4%</p>
        </div>
      </div>
    </div>

    <!-- Students Table -->
    <div class="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="font-display font-bold text-base text-text">Students</h3>
        <div class="relative w-64">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search student..."
            class="w-full px-3.5 py-1.5 pl-9 rounded-xl border border-border bg-input text-xs focus:outline-none focus:border-primary"
          />
          <Search class="w-4 h-4 text-text-subtle absolute left-2.5 top-2" />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-border text-text-muted uppercase tracking-wider text-[0.68rem]">
              <th class="py-3 px-2">Student</th>
              <th class="py-3 px-2">Level</th>
              <th class="py-3 px-2">Streak</th>
              <th class="py-3 px-2">XP</th>
              <th class="py-3 px-2">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/60">
            <tr v-if="loading">
              <td colspan="5" class="text-center py-8 text-text-muted">Loading students...</td>
            </tr>
            <tr v-else-if="students.length === 0">
              <td colspan="5" class="text-center py-8 text-text-muted">No students found.</td>
            </tr>
            <tr v-for="std in students" :key="std.id" class="hover:bg-surface-hover/50 transition-colors">
              <td class="py-3 px-2 font-bold text-text">{{ std.name || std.username }}</td>
              <td class="py-3 px-2">
                <span class="px-2 py-0.5 rounded text-[0.65rem] font-extrabold bg-primary text-white">
                  {{ std.level || 'A1' }}
                </span>
              </td>
              <td class="py-3 px-2 font-semibold text-text">{{ std.streak || 0 }}d</td>
              <td class="py-3 px-2 font-bold text-primary">{{ std.xp || 0 }} XP</td>
              <td class="py-3 px-2">
                <span class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-success/15 text-success">
                  Active
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
