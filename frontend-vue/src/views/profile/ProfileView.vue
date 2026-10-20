<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { User as UserIcon, Globe, Shield, Award, Check } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { updateProfile } from '@/api/profile';
import { LEVEL_OPTIONS } from '@/constants/levels';
import { ACCENTS } from '@/constants/accents';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Select from '@/components/ui/Select.vue';

const { user, userLevel, accent, setAccent, updateUserData } = useAuth();
const toast = useToast();

const name = ref('');
const username = ref('');
const email = ref('');
const selectedLevel = ref('A1');
const selectedAccent = ref('en-US');
const isSaving = ref(false);

onMounted(() => {
  if (user.value) {
    name.value = user.value.name || '';
    username.value = user.value.username || '';
    email.value = user.value.email || '';
    selectedLevel.value = user.value.level || 'A1';
    selectedAccent.value = user.value.preferred_accent || accent.value || 'en-US';
  }
});

async function handleSave() {
  isSaving.value = true;
  try {
    const updated = await updateProfile({
      name: name.value.trim(),
      level: selectedLevel.value as any,
      preferred_accent: selectedAccent.value,
    });
    updateUserData(updated);
    setAccent(selectedAccent.value);
    toast.success('Perfil atualizado com sucesso!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao atualizar perfil.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <!-- Header banner -->
    <div class="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
      <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 shadow-md flex-shrink-0 bg-primary/10">
        <img
          :src="user?.avatar_url || DEFAULT_AVATAR_URL"
          alt="Avatar"
          class="w-full h-full object-cover"
        />
      </div>

      <div class="flex-1 text-center sm:text-left">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 class="font-display text-2xl font-extrabold text-text">
            {{ user?.name || user?.username || 'Aluno' }}
          </h1>
          <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white self-center sm:self-auto">
            Level {{ userLevel }}
          </span>
        </div>
        <p class="text-xs text-text-muted mt-1">{{ user?.email }}</p>

        <div class="flex items-center justify-center sm:justify-start gap-4 mt-4 pt-4 border-t border-border/60">
          <div class="text-center sm:text-left">
            <span class="text-[0.68rem] uppercase font-bold text-text-subtle">Streak</span>
            <p class="text-sm font-extrabold text-text">{{ user?.streak || 0 }} days</p>
          </div>
          <div class="text-center sm:text-left">
            <span class="text-[0.68rem] uppercase font-bold text-text-subtle">XP</span>
            <p class="text-sm font-extrabold text-primary">{{ user?.xp || 0 }} XP</p>
          </div>
          <div class="text-center sm:text-left">
            <span class="text-[0.68rem] uppercase font-bold text-text-subtle">Role</span>
            <p class="text-sm font-extrabold text-text capitalize">{{ user?.role || 'student' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Profile Form -->
    <form @submit.prevent="handleSave" class="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
      <h3 class="font-display font-bold text-base text-text pb-3 border-b border-border">
        Account Settings
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Full Name" v-model="name" />
        <Input label="Username" v-model="username" :disabled="true" />
      </div>

      <Input label="Email" v-model="email" :disabled="true" />

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <Select label="CEFR English Level" v-model="selectedLevel" :options="LEVEL_OPTIONS" />
        
        <div>
          <label class="block text-xs font-semibold text-text-muted mb-1.5">Preferred Accent / Voice</label>
          <select
            v-model="selectedAccent"
            class="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
          >
            <option v-for="acc in ACCENTS" :key="acc.id" :value="acc.id">
              {{ acc.flag }} {{ acc.label }} ({{ acc.desc }})
            </option>
          </select>
        </div>
      </div>

      <div class="pt-4 flex justify-end">
        <Button type="submit" :loading="isSaving">
          <Check class="w-4 h-4 mr-1.5" />
          <span>Save Changes</span>
        </Button>
      </div>
    </form>
  </div>
</template>
