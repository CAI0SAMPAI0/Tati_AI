<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    state: 'idle' | 'listening' | 'processing' | 'speaking';
    audioElement?: HTMLAudioElement | null;
  }>(),
  {
    state: 'idle',
    audioElement: null,
  }
);

const FRAMES = {
  normal: '/avatar/avatar_tati_normal.webp',
  ouvindo: '/avatar/avatar_tati_ouvindo.webp',
  meio: '/avatar/avatar_tati_meio.webp',
  bem_aberta: '/avatar/avatar_tati_bem_aberta.webp',
  piscando: '/avatar/tati_piscando.webp',
};

const currentFrame = ref(FRAMES.normal);

let blinkTimer: any = null;
let mouthInterval: any = null;

function stopTimers() {
  if (blinkTimer) {
    clearTimeout(blinkTimer);
    blinkTimer = null;
  }
  if (mouthInterval) {
    clearInterval(mouthInterval);
    mouthInterval = null;
  }
}

function updateAnimation() {
  stopTimers();

  if (props.state === 'idle') {
    currentFrame.value = FRAMES.normal;
    const scheduleBlink = () => {
      const delay = 3500 + Math.random() * 2000;
      blinkTimer = setTimeout(() => {
        if (props.state !== 'idle') return;
        currentFrame.value = FRAMES.piscando;
        blinkTimer = setTimeout(() => {
          if (props.state !== 'idle') return;
          currentFrame.value = FRAMES.normal;
          scheduleBlink();
        }, 150);
      }, delay);
    };
    scheduleBlink();
  } else if (props.state === 'listening') {
    currentFrame.value = FRAMES.ouvindo;
  } else if (props.state === 'processing') {
    currentFrame.value = FRAMES.normal;
  } else if (props.state === 'speaking') {
    const speechFrames = [FRAMES.meio, FRAMES.bem_aberta, FRAMES.meio, FRAMES.normal];
    let frameIdx = 0;
    mouthInterval = setInterval(() => {
      frameIdx = (frameIdx + 1) % speechFrames.length;
      currentFrame.value = speechFrames[frameIdx];
    }, 140);
  }
}

watch(() => props.state, () => {
  updateAnimation();
});

onMounted(() => {
  // Preload images
  Object.values(FRAMES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
  updateAnimation();
});

onUnmounted(() => {
  stopTimers();
});
</script>

<template>
  <div class="relative flex items-center justify-center">
    <!-- Outer Pulsing Rings based on State -->
    <div
      v-if="state === 'listening'"
      class="absolute -inset-4 sm:-inset-6 rounded-full bg-primary/20 animate-ping opacity-60 pointer-events-none"
    />
    <div
      v-else-if="state === 'processing'"
      class="absolute -inset-4 sm:-inset-6 rounded-full bg-amber-500/20 animate-pulse pointer-events-none"
    />
    <div
      v-else-if="state === 'speaking'"
      class="absolute -inset-4 sm:-inset-6 rounded-full bg-emerald-500/20 animate-ping opacity-50 pointer-events-none"
    />

    <!-- Avatar Container -->
    <div
      class="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-full overflow-hidden border-4 transition-all duration-300 shadow-2xl bg-surface relative z-10"
      :class="{
        'border-primary ring-4 ring-primary/30 shadow-primary/30': state === 'listening',
        'border-amber-500 ring-4 ring-amber-500/30': state === 'processing',
        'border-emerald-500 ring-4 ring-emerald-500/30 shadow-emerald-500/30': state === 'speaking',
        'border-line shadow-xs': state === 'idle',
      }"
    >
      <img
        :src="currentFrame"
        alt="Teacher Tati Avatar"
        class="w-full h-full object-cover object-center select-none pointer-events-none transition-opacity duration-150"
      />
    </div>
  </div>
</template>