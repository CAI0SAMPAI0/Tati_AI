<script setup lang="ts">
import { ref, computed } from 'vue';

interface BarDataPoint {
  name: string;
  messages: number;
}

const props = withDefaults(
  defineProps<{
    data: BarDataPoint[];
    barSize?: number;
  }>(),
  {
    barSize: 28,
  }
);

const hoveredIndex = ref<number | null>(null);
const hoveredPos = ref<{ x: number; y: number } | null>(null);

const width = 500;
const height = 220;
const padding = { top: 20, right: 16, bottom: 32, left: 32 };

const chartWidth = computed(() => width - padding.left - padding.right);
const chartHeight = computed(() => height - padding.top - padding.bottom);

const maxVal = computed(() => {
  if (!props.data || props.data.length === 0) return 10;
  const mx = Math.max(...props.data.map((d) => d.messages || 0));
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
    const val = Math.max(0, d.messages || 0);
    const barH = (val / maxVal.value) * chartHeight.value;
    const y = padding.top + chartHeight.value - barH;

    return {
      name: d.name,
      messages: val,
      x,
      y,
      width: effectiveBarWidth,
      height: barH,
      columnX: padding.left + i * step,
      columnWidth: step,
      centerX: center,
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

          <!-- Actual filled bar -->
          <rect
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="Math.max(bar.height, bar.messages > 0 ? 3 : 0)"
            fill="var(--primary)"
            rx="6"
            ry="6"
            class="transition-all duration-300"
            :class="hoveredIndex === idx ? 'brightness-110' : ''"
          />
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

    <!-- Floating Tooltip -->
    <div
      v-if="hoveredIndex !== null && barPositions[hoveredIndex]"
      class="absolute pointer-events-none z-20 bg-surface border border-border rounded-xl shadow-md px-3 py-2 text-xs transition-opacity duration-150"
      :style="{
        left: `${(barPositions[hoveredIndex].centerX / width) * 100}%`,
        top: '15px',
        transform: 'translateX(-50%)',
      }"
    >
      <div class="text-[11px] text-text-muted mb-0.5 font-medium">
        {{ barPositions[hoveredIndex].name }}
      </div>
      <div class="text-text font-bold">
        <span class="text-primary mr-1">{{ barPositions[hoveredIndex].messages }}</span> Messages
      </div>
    </div>
  </div>
</template>
