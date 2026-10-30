<script lang="ts">
export interface ModalityItem {
  grammar?: number;
  reading?: number;
  listening?: number;
  pronunciation?: number;
  speaking?: number;
  vocabulary?: number;
  flashcards?: number;
  games?: number;
  musics?: number;
  news?: number;
  exam?: number;
  other?: number;
  [key: string]: any;
}

export interface BarDataPoint extends ModalityItem {
  name?: string;
  day?: string;
  messages?: number;
  total?: number;
}

export const MODALITY_CONFIG = [
  { key: 'grammar', label: 'Grammar', color: '#312e81' }, // Deep Indigo / Dark Navy
  { key: 'reading', label: 'Reading', color: '#38bdf8' }, // Bright Sky Blue (Claro)
  { key: 'listening', label: 'Listening', color: '#eab308' }, // Warm Gold / Yellow (Ouvir)
  { key: 'pronunciation', label: 'Pronunciation Practice', color: '#10b981' }, // Emerald Green
  { key: 'speaking', label: 'Speaking', color: '#ea580c' }, // Vivid Tangerine Orange
  { key: 'vocabulary', label: 'Vocabulary', color: '#ec4899' }, // Hot Pink
  { key: 'flashcards', label: 'Flashcards', color: '#8b5cf6' }, // Violet / Purple
  { key: 'games', label: 'Games (WordWall)', color: '#06b6d4' }, // Cyan / Teal
  { key: 'musics', label: 'Musics (LingoClip)', color: '#d946ef' }, // Magenta / Fuchsia
  { key: 'news', label: 'News / Reels', color: '#65a30d' }, // Olive Lime
  { key: 'exam', label: 'Exams', color: '#ef4444' }, // Crimson Red
  { key: 'other', label: 'Other', color: '#64748b' }, // Neutral Slate
] as const;
</script>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(
  defineProps<{
    data: BarDataPoint[];
    barSize?: number;
    tooltipPosition?: 'top' | 'bottom';
  }>(),
  {
    barSize: 28,
    tooltipPosition: 'bottom',
  }
);

const hoveredIndex = ref<number | null>(null);
const hoveredPos = ref<{ x: number; y: number } | null>(null);

const width = 500;
const height = 220;
const padding = { top: 20, right: 16, bottom: 32, left: 32 };

const chartWidth = computed(() => width - padding.left - padding.right);
const chartHeight = computed(() => height - padding.top - padding.bottom);

const isStacked = computed(() => {
  if (!props.data || props.data.length === 0) return false;
  return props.data.some((d) =>
    MODALITY_CONFIG.some((m) => typeof d[m.key] === 'number')
  );
});

function calculateTotal(d: BarDataPoint): number {
  if (isStacked.value) {
    return MODALITY_CONFIG.reduce((acc, m) => acc + (Number(d[m.key]) || 0), 0);
  }
  return Math.max(0, Number(d.messages ?? d.total ?? 0));
}

const maxVal = computed(() => {
  if (!props.data || props.data.length === 0) return 10;
  const mx = Math.max(...props.data.map(calculateTotal));
  if (mx <= 5) return 5;
  if (mx <= 10) return 10;
  if (mx <= 20) return 20;
  if (mx <= 50) return 50;
  return Math.ceil(mx / 10) * 10;
});

const yTicks = computed(() => {
  const m = maxVal.value;
  return [0, Math.round(m / 2), m];
});

const barPositions = computed(() => {
  const count = props.data.length;
  if (count === 0) return [];

  const step = chartWidth.value / count;
  const effectiveBarWidth = Math.min(props.barSize, step * 0.75);

  return props.data.map((d, i) => {
    const center = padding.left + i * step + step / 2;
    const x = center - effectiveBarWidth / 2;
    const total = calculateTotal(d);
    const totalH = (total / maxVal.value) * chartHeight.value;
    const barY = padding.top + chartHeight.value - totalH;

    const segments: Array<{
      key: string;
      label: string;
      color: string;
      count: number;
      y: number;
      height: number;
    }> = [];

    if (isStacked.value) {
      let currentBottom = padding.top + chartHeight.value;
      for (const mod of MODALITY_CONFIG) {
        const val = Math.max(0, Number(d[mod.key]) || 0);
        if (val > 0) {
          const segH = (val / maxVal.value) * chartHeight.value;
          currentBottom -= segH;
          segments.push({
            key: mod.key,
            label: mod.label,
            color: mod.color,
            count: val,
            y: currentBottom,
            height: segH,
          });
        }
      }
    } else {
      if (total > 0) {
        segments.push({
          key: 'messages',
          label: 'Messages',
          color: 'var(--primary)',
          count: total,
          y: barY,
          height: totalH,
        });
      }
    }

    const breakdown = MODALITY_CONFIG.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      count: Math.max(0, Number(d[m.key]) || 0),
    }));

    return {
      name: d.day || d.name || `D${i + 1}`,
      total,
      x,
      y: barY,
      width: effectiveBarWidth,
      height: totalH,
      columnX: padding.left + i * step,
      columnWidth: step,
      centerX: center,
      segments,
      breakdown,
    };
  });
});

function handleMouseMove(idx: number, event: MouseEvent) {
  hoveredIndex.value = idx;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  hoveredPos.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function handleMouseLeave() {
  hoveredIndex.value = null;
  hoveredPos.value = null;
}
</script>

<template>
  <div
    class="relative h-[220px] w-full select-none"
    @mouseleave="handleMouseLeave"
  >
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
      class="w-full h-full overflow-visible"
    >
      <defs>
        <clipPath
          v-for="(bar, idx) in barPositions"
          :id="`bar-clip-${idx}`"
          :key="`clip-${idx}`"
        >
          <rect
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="Math.max(bar.height, bar.total > 0 ? 3 : 0)"
            rx="6"
            ry="6"
          />
        </clipPath>
      </defs>

      <!-- Horizontal Grid Lines -->
      <g class="grid-lines">
        <line
          v-for="tick in yTicks"
          :key="tick"
          :x1="padding.left"
          :y1="padding.top + chartHeight - (tick / maxVal) * chartHeight"
          :x2="width - padding.right"
          :y2="padding.top + chartHeight - (tick / maxVal) * chartHeight"
          stroke="var(--border)"
          stroke-dasharray="4 4"
          stroke-width="1"
          opacity="0.8"
        />
      </g>

      <!-- Y-Axis Labels -->
      <g class="y-labels">
        <text
          v-for="tick in yTicks"
          :key="tick"
          :x="padding.left - 8"
          :y="padding.top + chartHeight - (tick / maxVal) * chartHeight + 4"
          text-anchor="end"
          class="fill-text-subtle text-[11px] font-medium"
        >
          {{ tick }}
        </text>
      </g>

      <!-- Column Hover Overlay Background -->
      <rect
        v-if="hoveredIndex !== null && barPositions[hoveredIndex]"
        :x="barPositions[hoveredIndex].columnX"
        :y="padding.top"
        :width="barPositions[hoveredIndex].columnWidth"
        :height="chartHeight"
        fill="var(--border)"
        opacity="0.25"
        rx="8"
      />

      <!-- Bars -->
      <g class="bars">
        <g
          v-for="(bar, idx) in barPositions"
          :key="idx"
          class="cursor-pointer"
          @mouseenter="hoveredIndex = idx"
          @mousemove="handleMouseMove(idx, $event)"
        >
          <!-- Transparent clickable hit target -->
          <rect
            :x="bar.columnX"
            :y="padding.top"
            :width="bar.columnWidth"
            :height="chartHeight"
            fill="transparent"
          />

          <!-- Base indicator for zero activities -->
          <rect
            v-if="bar.total === 0"
            :x="bar.x + bar.width * 0.25"
            :y="padding.top + chartHeight - 2"
            :width="bar.width * 0.5"
            :height="2"
            fill="var(--border)"
            opacity="0.6"
            rx="1"
          />

          <!-- Actual stacked bar segments clipped to rounded column -->
          <g
            v-if="bar.total > 0"
            :clip-path="`url(#bar-clip-${idx})`"
          >
            <rect
              v-for="seg in bar.segments"
              :key="seg.key"
              :x="bar.x"
              :y="seg.y"
              :width="bar.width"
              :height="Math.max(seg.height, 1)"
              :fill="seg.color"
              class="transition-all duration-300"
              :class="hoveredIndex === idx ? 'brightness-110' : ''"
            />
          </g>
        </g>
      </g>

      <!-- X-Axis Labels -->
      <g class="x-labels">
        <text
          v-for="(bar, idx) in barPositions"
          :key="idx"
          :x="bar.centerX"
          :y="height - 8"
          text-anchor="middle"
          class="fill-text-muted text-[11px] font-medium"
        >
          {{ bar.name }}
        </text>
      </g>
    </svg>

    <!-- Floating Tooltip Below / Top -->
    <div
      v-if="hoveredIndex !== null && barPositions[hoveredIndex]"
      class="absolute pointer-events-none z-30 bg-surface/95 backdrop-blur-md border border-border rounded-2xl shadow-xl p-3 text-xs transition-opacity duration-150 min-w-[190px]"
      :style="{
        left: `${(barPositions[hoveredIndex].centerX / width) * 100}%`,
        ...(props.tooltipPosition === 'top'
          ? { top: '8px' }
          : { top: 'calc(100% + 10px)' }),
        transform: hoveredIndex === 0
          ? 'translateX(-15%)'
          : hoveredIndex === barPositions.length - 1
          ? 'translateX(-85%)'
          : 'translateX(-50%)',
      }"
    >
      <!-- Pointer arrow when positioned at bottom -->
      <div
        v-if="props.tooltipPosition === 'bottom'"
        class="absolute -top-1.5 w-3 h-3 bg-surface border-t border-l border-border rotate-45 pointer-events-none"
        :style="{
          left: hoveredIndex === 0 ? '22%' : hoveredIndex === barPositions.length - 1 ? '78%' : '50%',
          transform: 'translateX(-50%)',
        }"
      />

      <!-- Header: Day and Total -->
      <div class="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-border/60">
        <span class="font-bold text-text text-sm">{{ barPositions[hoveredIndex].name }}</span>
        <span
          class="px-2 py-0.5 rounded-full text-[10px] font-extrabold"
          :class="barPositions[hoveredIndex].total > 0 ? 'bg-primary/10 text-primary' : 'bg-bg-secondary text-text-muted'"
        >
          {{ barPositions[hoveredIndex].total }} {{ isStacked ? 'activities' : 'msgs' }}
        </span>
      </div>

      <!-- Stacked Breakdown by Modality -->
      <div v-if="isStacked" class="space-y-1.5">
        <template v-if="barPositions[hoveredIndex].total > 0">
          <div
            v-for="item in barPositions[hoveredIndex].breakdown.filter((m) => m.count > 0)"
            :key="item.key"
            class="flex items-center justify-between text-[11px]"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: item.color }"
              />
              <span class="text-text-muted">{{ item.label }}</span>
            </div>
            <span class="font-bold text-text tabular-nums">{{ item.count }}</span>
          </div>
        </template>
        <div v-else class="text-text-subtle text-[11px] italic py-0.5">
          No activities recorded
        </div>
      </div>

      <!-- Legacy Single Metric View -->
      <div v-else class="text-text font-bold text-xs">
        <span class="text-primary mr-1">{{ barPositions[hoveredIndex].total }}</span> Messages
      </div>
    </div>
  </div>
</template>
