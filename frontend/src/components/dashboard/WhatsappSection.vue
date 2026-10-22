<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  RefreshCw,
  Power,
  CheckCircle,
  AlertCircle,
  QrCode,
  Loader2,
  RotateCw,
  Search,
  Phone,
  Check,
  X,
  Edit2,
  Send,
  Bell,
  BellOff,
  UserCheck,
  Users,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPut, apiFetch } from '@/api/client';
import { useToast } from '@/composables/useToast';

interface SessionData {
  name: string;
  status: string;
  engine?: string;
  me?: {
    id?: string;
    pushName?: string;
  } | null;
}

interface StudentWhatsAppData {
  username: string;
  name: string;
  email: string;
  role: string;
  level: string;
  streak_count: number;
  total_xp: number;
  whatsapp_number: string;
  formatted_phone?: string;
  allow_whatsapp_notifications: boolean;
  whatsapp_status: 'active' | 'missing' | 'disabled';
}

interface WhatsAppStudentsResponse {
  students: StudentWhatsAppData[];
  total_students: number;
  active_count: number;
  missing_count: number;
  disabled_count: number;
}

const toast = useToast();

const activeSession = ref('professor');
const sessions = ref<SessionData[]>([]);
const qrBlobUrl = ref<string>('');
const loadingQr = ref(false);
const qrError = ref<string | null>(null);
const isStartingOrStopping = ref(false);
const isRefetching = ref(false);

// Students state
const studentsData = ref<WhatsAppStudentsResponse | null>(null);
const loadingStudents = ref(false);
const isRefetchingStudents = ref(false);
const searchTerm = ref('');
const statusFilter = ref<'all' | 'active' | 'missing' | 'disabled'>('all');
const editingUsername = ref<string | null>(null);
const inputNumber = ref('');
const savingStudent = ref<string | null>(null);
const testingStudent = ref<string | null>(null);

let pollTimer: any = null;

const currentSessionData = computed(() => {
  return sessions.value.find((s) => s.name === activeSession.value);
});

const sessionStatus = computed(() => {
  return currentSessionData.value ? currentSessionData.value.status : 'DISCONNECTED';
});

async function loadSessions(silent = false) {
  if (!silent) isRefetching.value = true;
  try {
    const res = await apiGet<SessionData[]>('/dashboard/waha/sessions');
    sessions.value = Array.isArray(res) ? res : [];
    if (sessionStatus.value === 'SCAN_QR_CODE') {
      loadQrCode(true);
    }
  } catch (err) {
    console.error('Error fetching WAHA sessions:', err);
  } finally {
    isRefetching.value = false;
  }
}

async function loadQrCode(isSilent = false) {
  if (!isSilent && !qrBlobUrl.value) loadingQr.value = true;
  qrError.value = null;
  try {
    const sessionParam = encodeURIComponent(activeSession.value || 'professor');
    const response = await apiFetch(`/dashboard/waha/session/qr?session=${sessionParam}&t=${Date.now()}`, {
      headers: { Accept: 'image/png, image/*' },
    });
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 100) {
        if (qrBlobUrl.value) URL.revokeObjectURL(qrBlobUrl.value);
        qrBlobUrl.value = URL.createObjectURL(blob);
      } else {
        qrError.value = 'QR code is generating, please wait a moment...';
      }
    } else {
      qrError.value = 'QR code not available yet. Waiting for session...';
    }
  } catch (err) {
    qrError.value = 'Error fetching QR code.';
  } finally {
    loadingQr.value = false;
  }
}

async function handleStartSession() {
  isStartingOrStopping.value = true;
  try {
    await apiPost('/dashboard/waha/session/start', { session: activeSession.value });
    toast.success('Starting WhatsApp session...');
    await loadSessions();
    loadQrCode();
  } catch (err: any) {
    toast.error(err?.message || 'Error starting WhatsApp session.');
  } finally {
    isStartingOrStopping.value = false;
  }
}

async function handleStopSession() {
  if (!confirm('Disconnect this WhatsApp session? Automated reminders will be paused.')) return;
  isStartingOrStopping.value = true;
  try {
    await apiPost('/dashboard/waha/session/stop', { session: activeSession.value });
    toast.success('Session disconnected.');
    if (qrBlobUrl.value) URL.revokeObjectURL(qrBlobUrl.value);
    qrBlobUrl.value = '';
    await loadSessions();
  } catch (err: any) {
    toast.error(err?.message || 'Error disconnecting session.');
  } finally {
    isStartingOrStopping.value = false;
  }
}

async function handleRestartSession() {
  isStartingOrStopping.value = true;
  try {
    await apiPost('/dashboard/waha/session/restart', { session: activeSession.value });
    toast.success('Session restarted. Fresh QR generating...');
    if (qrBlobUrl.value) URL.revokeObjectURL(qrBlobUrl.value);
    qrBlobUrl.value = '';
    await loadSessions();
    setTimeout(() => loadQrCode(), 2000);
  } catch (err: any) {
    toast.error(err?.message || 'Error restarting WhatsApp session.');
  } finally {
    isStartingOrStopping.value = false;
  }
}

// Students Directory
async function loadStudents(silent = false) {
  if (!silent) loadingStudents.value = true;
  else isRefetchingStudents.value = true;
  try {
    const res = await apiGet<WhatsAppStudentsResponse>('/dashboard/whatsapp/students');
    studentsData.value = res;
  } catch (err) {
    console.error('Error fetching WhatsApp students:', err);
  } finally {
    loadingStudents.value = false;
    isRefetchingStudents.value = false;
  }
}

const filteredStudents = computed(() => {
  if (!studentsData.value?.students) return [];
  let list = studentsData.value.students;

  if (statusFilter.value !== 'all') {
    list = list.filter((s) => s.whatsapp_status === statusFilter.value);
  }

  if (searchTerm.value.trim()) {
    const q = searchTerm.value.toLowerCase();
    list = list.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.whatsapp_number || '').includes(q)
    );
  }

  return list;
});

function handleStartEditNumber(student: StudentWhatsAppData) {
  editingUsername.value = student.username;
  inputNumber.value = student.whatsapp_number || '';
}

async function handleSaveNumber(student: StudentWhatsAppData) {
  savingStudent.value = student.username;
  try {
    await apiPut(`/dashboard/whatsapp/students/${student.username}`, {
      whatsapp_number: inputNumber.value.trim(),
      allow_whatsapp_notifications: student.allow_whatsapp_notifications,
    });
    student.whatsapp_number = inputNumber.value.trim();
    student.whatsapp_status = inputNumber.value.trim() ? (student.allow_whatsapp_notifications ? 'active' : 'disabled') : 'missing';
    toast.success('WhatsApp number saved!');
    editingUsername.value = null;
  } catch (err: any) {
    toast.error(err?.message || 'Error saving number.');
  } finally {
    savingStudent.value = null;
  }
}

async function handleToggleNotifications(student: StudentWhatsAppData) {
  const newVal = !student.allow_whatsapp_notifications;
  try {
    await apiPut(`/dashboard/whatsapp/students/${student.username}`, {
      whatsapp_number: student.whatsapp_number,
      allow_whatsapp_notifications: newVal,
    });
    student.allow_whatsapp_notifications = newVal;
    student.whatsapp_status = student.whatsapp_number ? (newVal ? 'active' : 'disabled') : 'missing';
    toast.success(newVal ? 'Notifications enabled' : 'Notifications paused');
  } catch {
    toast.error('Failed to update notification preferences.');
  }
}

async function handleSendTestMessage(student: StudentWhatsAppData) {
  testingStudent.value = student.username;
  try {
    const res = await apiPost<any>(`/dashboard/whatsapp/students/${student.username}/test`, {});
    toast.success((res as any)?.message || 'Test message sent to student via WhatsApp! 📲');
  } catch (err: any) {
    toast.error(err?.message || 'Failed to dispatch test message.');
  } finally {
    testingStudent.value = null;
  }
}

onMounted(() => {
  loadSessions();
  loadStudents();
  pollTimer = setInterval(() => {
    loadSessions(true);
  }, 10000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (qrBlobUrl.value) URL.revokeObjectURL(qrBlobUrl.value);
});
</script>

<template>
  <div class="space-y-8 pb-12 animate-fade-in text-text">
    <!-- WAHA Session Connection Card -->
    <div class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
      <!-- Header -->
      <div class="p-6 border-b border-border bg-bg-secondary/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <span class="text-xl">💬</span>
          </div>
          <div>
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">WhatsApp Connection (WAHA)</h2>
            <p class="text-xs text-text-muted">
              Official Teacher Tatiana connection for automated streak reminders and student nudges
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="loadSessions()"
          :disabled="isRefetching"
          class="p-2.5 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw class="w-4 h-4" :class="isRefetching ? 'animate-spin' : ''" />
        </button>
      </div>

      <!-- Status Card Body -->
      <div class="p-6 md:p-8 space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-bg-secondary/40 border border-border/50 rounded-2xl">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-black uppercase tracking-wider text-text-subtle">Active Session</span>
              <span class="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                Teacher Tatiana (Production)
              </span>
            </div>

            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-xl font-black text-text">@{{ activeSession }}</span>

              <!-- Status Badge -->
              <span
                v-if="sessionStatus === 'WORKING'"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              >
                <CheckCircle class="w-3.5 h-3.5" />
                <span>Connected (WORKING)</span>
              </span>

              <span
                v-else-if="sessionStatus === 'SCAN_QR_CODE'"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse"
              >
                <QrCode class="w-3.5 h-3.5" />
                <span>Waiting for Scan (SCAN_QR_CODE)</span>
              </span>

              <span
                v-else
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-danger/10 text-danger border border-danger/20"
              >
                <AlertCircle class="w-3.5 h-3.5" />
                <span>Disconnected ({{ sessionStatus }})</span>
              </span>
            </div>

            <p class="text-xs text-text-muted max-w-lg leading-relaxed">
              Teacher Tatiana's automated background agent uses this session to dispatch reminder messages, weekly study reports, and encouragement to students.
            </p>
          </div>

          <!-- Session Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              v-if="sessionStatus === 'SCAN_QR_CODE'"
              type="button"
              @click="handleRestartSession"
              :disabled="isStartingOrStopping"
              class="px-4 py-2.5 rounded-xl border border-border hover:bg-surface-hover text-text text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw class="w-4 h-4" :class="isStartingOrStopping ? 'animate-spin' : ''" />
              <span>Refresh QR Code</span>
            </button>

            <button
              v-if="sessionStatus === 'WORKING'"
              type="button"
              @click="handleStopSession"
              :disabled="isStartingOrStopping"
              class="px-5 py-2.5 rounded-xl bg-danger text-white text-xs font-bold hover:bg-danger/90 shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Power class="w-4 h-4" />
              <span>Disconnect Session</span>
            </button>

            <button
              v-if="sessionStatus === 'DISCONNECTED' || sessionStatus === 'STOPPED'"
              type="button"
              @click="handleStartSession"
              :disabled="isStartingOrStopping"
              class="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Power class="w-4 h-4" />
              <span>Start Session</span>
            </button>
          </div>
        </div>

        <!-- QR Code Scan Section -->
        <div
          v-if="sessionStatus === 'SCAN_QR_CODE'"
          class="flex flex-col items-center p-8 bg-bg border border-border rounded-2xl text-center space-y-5 animate-in fade-in"
        >
          <div class="space-y-1.5 max-w-sm">
            <h3 class="text-base font-black text-text flex items-center justify-center gap-2">
              <QrCode class="w-5 h-5 text-primary" />
              <span>Scan WhatsApp QR Code</span>
            </h3>
            <p class="text-xs text-text-muted">
              Open WhatsApp on your phone, go to <strong>Linked Devices</strong> &gt; <strong>Link a device</strong>, and scan the QR code below.
            </p>
          </div>

          <div class="relative w-60 h-60 bg-white p-4 border border-border rounded-2xl flex items-center justify-center shadow-md">
            <Loader2 v-if="loadingQr && !qrBlobUrl" class="w-8 h-8 text-primary animate-spin" />
            <img v-else-if="qrBlobUrl" :src="qrBlobUrl" alt="WhatsApp QR Code" class="w-full h-full object-contain" />
            <div v-else class="text-xs text-text-muted space-y-2">
              <p>{{ qrError || 'Generating QR code...' }}</p>
              <button
                type="button"
                @click="loadQrCode()"
                class="px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Students WhatsApp Directory Card -->
    <div class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
      <!-- Header -->
      <div class="p-6 border-b border-border bg-bg-secondary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Users class="w-5 h-5" />
          </div>
          <div>
            <h2 class="font-bold text-sm uppercase tracking-wider text-text">Student WhatsApp Directory</h2>
            <p class="text-xs text-text-muted">
              Manage student phone numbers for automated notifications and streak alerts
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="loadStudents()"
          :disabled="loadingStudents || isRefetchingStudents"
          class="p-2.5 rounded-xl border border-border hover:bg-surface-hover text-text-muted transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="isRefetchingStudents ? 'animate-spin' : ''" />
          <span>Refresh List</span>
        </button>
      </div>

      <!-- Metrics Grid -->
      <div class="p-4 sm:p-6 border-b border-border/60 bg-bg-secondary/10 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between">
          <span class="text-[11px] font-bold uppercase tracking-wider text-text-muted">Total Students</span>
          <div class="text-2xl font-black text-text mt-2">{{ studentsData?.total_students ?? 0 }}</div>
        </div>

        <div class="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active WhatsApp</span>
            <CheckCircle class="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div class="text-2xl font-black text-emerald-600 mt-2">{{ studentsData?.active_count ?? 0 }}</div>
        </div>

        <div class="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-amber-600">Missing Phone</span>
            <AlertCircle class="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div class="text-2xl font-black text-amber-600 mt-2">{{ studentsData?.missing_count ?? 0 }}</div>
        </div>

        <div class="p-4 rounded-2xl bg-surface border border-border flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-text-subtle">Notif. Paused</span>
            <BellOff class="w-3.5 h-3.5 text-text-subtle" />
          </div>
          <div class="text-2xl font-black text-text-subtle mt-2">{{ studentsData?.disabled_count ?? 0 }}</div>
        </div>
      </div>

      <!-- Search & Status Abas de filtro -->
      <div class="p-4 sm:p-6 border-b border-border flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-bg-secondary/20">
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Search student by name, @username or phone..."
            class="w-full pl-10 pr-8 py-2.5 rounded-xl bg-surface border border-border text-xs text-text placeholder:text-text-subtle focus:outline-none focus:border-primary transition-all font-medium"
          />
        </div>

        <!-- Abas de filtro -->
        <div class="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl overflow-x-auto">
          <button
            type="button"
            @click="statusFilter = 'all'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            :class="statusFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            All ({{ studentsData?.total_students ?? 0 }})
          </button>
          <button
            type="button"
            @click="statusFilter = 'active'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            :class="statusFilter === 'active' ? 'bg-emerald-500 text-white shadow-xs' : 'text-text-muted hover:text-emerald-500'"
          >
            Active ({{ studentsData?.active_count ?? 0 }})
          </button>
          <button
            type="button"
            @click="statusFilter = 'missing'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            :class="statusFilter === 'missing' ? 'bg-amber-500 text-white shadow-xs' : 'text-text-muted hover:text-amber-500'"
          >
            Missing ({{ studentsData?.missing_count ?? 0 }})
          </button>
          <button
            type="button"
            @click="statusFilter = 'disabled'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            :class="statusFilter === 'disabled' ? 'bg-zinc-600 text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            Disabled ({{ studentsData?.disabled_count ?? 0 }})
          </button>
        </div>
      </div>

      <!-- Students Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="bg-bg-secondary/40 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest border-b border-border">
            <tr>
              <th class="px-5 py-3">Student</th>
              <th class="px-5 py-3">WhatsApp Phone</th>
              <th class="px-5 py-3">Notifications</th>
              <th class="px-5 py-3">Status</th>
              <th class="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="s in filteredStudents"
              :key="s.username"
              class="hover:bg-bg-secondary/20 transition-colors"
            >
              <!-- Student Profile -->
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary shrink-0">
                    {{ (s.name || s.username || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-text truncate text-xs">{{ s.name || s.username }}</p>
                    <p class="text-[0.65rem] text-text-muted truncate">@{{ s.username }} • Level {{ s.level || 'A1' }}</p>
                  </div>
                </div>
              </td>

              <!-- Phone Number / Inline Edit -->
              <td class="px-5 py-3.5">
                <div v-if="editingUsername === s.username" class="flex items-center gap-1.5">
                  <input
                    v-model="inputNumber"
                    type="text"
                    placeholder="+5511999999999"
                    class="px-2.5 py-1 rounded-lg bg-bg border border-primary text-xs font-mono outline-none w-36"
                  />
                  <button
                    type="button"
                    @click="handleSaveNumber(s)"
                    :disabled="savingStudent === s.username"
                    class="p-1 rounded-md bg-primary text-white hover:bg-primary-hover cursor-pointer"
                  >
                    <Check class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    @click="editingUsername = null"
                    class="p-1 rounded-md bg-surface border border-border text-text-muted hover:text-text cursor-pointer"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>

                <div v-else class="flex items-center gap-2">
                  <span class="font-mono text-xs" :class="s.whatsapp_number ? 'text-text font-semibold' : 'text-text-subtle italic'">
                    {{ s.formatted_phone || s.whatsapp_number || 'Not registered' }}
                  </span>
                  <button
                    type="button"
                    @click="handleStartEditNumber(s)"
                    title="Edit phone number"
                    class="p-1 rounded text-text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    <Edit2 class="w-3 h-3" />
                  </button>
                </div>
              </td>

              <!-- Notifications Toggle -->
              <td class="px-5 py-3.5">
                <button
                  type="button"
                  @click="handleToggleNotifications(s)"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="
                    s.allow_whatsapp_notifications
                      ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 hover:bg-zinc-500/20'
                  "
                >
                  <Bell v-if="s.allow_whatsapp_notifications" class="w-3.5 h-3.5" />
                  <BellOff v-else class="w-3.5 h-3.5" />
                  <span>{{ s.allow_whatsapp_notifications ? 'Allowed' : 'Paused' }}</span>
                </button>
              </td>

              <!-- Status Badge -->
              <td class="px-5 py-3.5">
                <span
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
                  :class="
                    s.whatsapp_status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : s.whatsapp_status === 'missing'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20'
                  "
                >
                  {{ s.whatsapp_status === 'active' ? 'Active' : s.whatsapp_status === 'missing' ? 'Missing Phone' : 'Disabled' }}
                </span>
              </td>

              <!-- Actions: Test Dispatch -->
              <td class="px-5 py-3.5 text-right">
                <button
                  type="button"
                  @click="handleSendTestMessage(s)"
                  :disabled="testingStudent === s.username || !s.whatsapp_number"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                  title="Send test WhatsApp message"
                >
                  <Send class="w-3 h-3 text-emerald-500" />
                  <span>{{ testingStudent === s.username ? 'Sending...' : 'Test WhatsApp' }}</span>
                </button>
              </td>
            </tr>

            <tr v-if="filteredStudents.length === 0">
              <td colspan="5" class="py-12 text-center text-xs text-text-muted italic">
                No students match the current filter or search query.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
