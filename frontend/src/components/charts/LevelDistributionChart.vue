<script setup lang="ts">
import { ref, computed } from 'vue';

interface SliceData {
  name: string;
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

const props = defineProps<{
  data: SliceData[];
  selectedLevel?: string | null;
}>();

const emit = defineEmits<{
  (e: 'sliceClick', name: string | null): void;
}>();

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b', '#3b82f6'];

const hoveredIndex = ref<number | null>(null);

const totalValue = computed(() => {
  return props.data.reduce((sum, item) => sum + (item.value || 0), 0);
});

// Calculate arc paths for donut
const size = 300;
const center = size / 2;
const innerRadius = 70;
const outerRadius = 95;
const hoverOuterRadius = 102;

interface ArcSegment {
  index: number;
  data: SliceData;
  color: string;
  path: string;
  hoverPath: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  startAngle: number,
  endAngle: number
) {
  // If full circle
  if (endAngle - startAngle >= 359.9) {
    endAngle = 359.99;
  }

  const p1 = polarToCartesian(cx, cy, rOut, endAngle);
  const p2 = polarToCartesian(cx, cy, rOut, startAngle);
  const p3 = polarToCartesian(cx, cy, rIn, startAngle);
  const p4 = polarToCartesian(cx, cy, rIn, endAngle);

  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${p2.x} ${p2.y}`,
    `A ${rOut} ${rOut} 0 ${arcSweep} 1 ${p1.x} ${p1.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${rIn} ${rIn} 0 ${arcSweep} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

const arcs = computed<ArcSegment[]>(() => {
  const total = totalValue.value;
  if (total === 0) return [];

  let currentAngle = 0;
  const paddingAngle = props.data.length > 1 ? 4 : 0;

  return props.data.map((item, idx) => {
    const sliceAngle = (item.value / total) * 360;
    const start = currentAngle + paddingAngle / 2;
    const end = currentAngle + sliceAngle - paddingAngle / 2;
    currentAngle += sliceAngle;

    const color = item.color || COLORS[idx % COLORS.length];
    const path = describeArc(center, center, innerRadius, outerRadius, start, end);
    const hoverPath = describeArc(center, center, innerRadius, hoverOuterRadius, start, end);

    return {
      index: idx,
      data: item,
      color,
      path,
      hoverPath,
      startAngle: start,
      endAngle: end,
      midAngle: (start + end) / 2,
    };
  });
});

function handleSliceClick(item: SliceData) {
  emit('sliceClick', props.selectedLevel === item.name ? null : item.name);
}
</script>

<template>
  <div class="relative w-full h-[300px] flex items-center justify-center select-none">
    <svg :viewBox="`0 0 ${size} ${size}`" class="w-full h-full max-w-[300px] max-h-[300px]">
      <g>
        <path
          v-for="arc in arcs"
          :key="arc.data.name"
          :d="hoveredIndex === arc.index || selectedLevel === arc.data.name ? arc.hoverPath : arc.path"
          :fill="arc.color"
          class="cursor-pointer transition-all duration-200"
          :class="[
            selectedLevel && selectedLevel !== arc.data.name ? 'opacity-40' : 'opacity-100',
            hoveredIndex === arc.index ? 'filter drop-shadow-md' : '',
          ]"
          @mouseenter="hoveredIndex = arc.index"
          @mouseleave="hoveredIndex = null"
          @click="handleSliceClick(arc.data)"
        />
      </g>
    </svg>

    <!-- Center Text: Total Students -->
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <span class="text-3xl font-black text-text leading-tight">{{ totalValue }}</span>
      <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">Students</span>
    </div>

    <!-- Floating Hover Tooltip -->
    <div
      v-if="hoveredIndex !== null && arcs[hoveredIndex]"
      class="absolute top-2 pointer-events-none bg-surface border border-border px-3 py-1.5 rounded-xl shadow-lg text-xs font-bold z-20 transition-all duration-150 animate-in fade-in"
    >
      <span class="mr-1.5 inline-block w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: arcs[hoveredIndex].color }"></span>
      <span class="text-text">{{ arcs[hoveredIndex].data.label || arcs[hoveredIndex].data.name }}:</span>
      <span class="text-primary ml-1">{{ arcs[hoveredIndex].data.value }}</span>
      <span class="text-text-muted ml-1">({{ arcs[hoveredIndex].data.percentage }}%)</span>
    </div>
  </div>
</template>
