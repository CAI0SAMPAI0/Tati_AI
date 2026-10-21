<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioElement?: HTMLAudioElement | null;
  className?: string;
}>();

const FRAMES = {
  normal: '/avatar/avatar_tati_normal.webp',
  ouvindo: '/avatar/avatar_tati_ouvindo.webp',
  meio: '/avatar/avatar_tati_meio.webp',
  bem_aberta: '/avatar/avatar_tati_bem_aberta.webp',
  piscando: '/avatar/tati_piscando.webp',
};

const audioNodesCache = new WeakMap<
  HTMLAudioElement,
  {
    ctx: AudioContext;
    analyser: AnalyserNode;
    source: MediaElementAudioSourceNode;
  }
>();

const currentFrame = ref(FRAMES.normal);

let blinkTimer: any = null;
let mouthInterval: any = null;

function stopTimers() {
  if (blinkTimer) {
    clearTimeout(blinkTimer);
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
  if (mouthInterval) {
    clearInterval(mouthInterval);
    mouthInterval = null;
  }
}

function updateStateAnimation() {
  stopTimers();

  // 1. idle: normal with natural random blinks
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
        }, 140);
      }, delay);
    };
    scheduleBlink();
    return;
  }

  // 2. listening: ouvindo frame with subtle blinks
  if (props.state === 'listening') {
    currentFrame.value = FRAMES.ouvindo;
    const scheduleListeningBlink = () => {
      const delay = 3800 + Math.random() * 2500;
      blinkTimer = setTimeout(() => {
        if (props.state !== 'listening') return;
        currentFrame.value = FRAMES.piscando;
        blinkTimer = setTimeout(() => {
          if (props.state !== 'listening') return;
          currentFrame.value = FRAMES.ouvindo;
          scheduleListeningBlink();
        }, 140);
      }, delay);
    };
    scheduleListeningBlink();
    return;
  }

  // 3. processing: thinking with quick natural blinks
  if (props.state === 'processing') {
    currentFrame.value = FRAMES.normal;
    const scheduleProcessingBlink = () => {
      const delay = 2200 + Math.random() * 1500;
      blinkTimer = setTimeout(() => {
        if (props.state !== 'processing') return;
        currentFrame.value = FRAMES.piscando;
        blinkTimer = setTimeout(() => {
          if (props.state !== 'processing') return;
          currentFrame.value = FRAMES.normal;
          scheduleProcessingBlink();
        }, 140);
      }, delay);
    };
    scheduleProcessingBlink();
    return;
  }

  // 4. speaking: lipsync via Web Audio API or fallback cadence
  if (props.state === 'speaking') {
    const mouthCycle = [
      FRAMES.meio,
      FRAMES.normal,
      FRAMES.meio,
      FRAMES.meio,
      FRAMES.bem_aberta,
      FRAMES.meio,
      FRAMES.normal,
      FRAMES.meio,
    ];
    let cycleIdx = 0;
    let smoothedAvg = 0;
    let lastFrameChangeTime = 0;
    let usingWebAudio = false;

    if (props.audioElement) {
      try {
        let nodes = audioNodesCache.get(props.audioElement);
        if (!nodes) {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtxClass) {
            const ctx = new AudioCtxClass();
            const source = ctx.createMediaElementSource(props.audioElement);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            nodes = { ctx, analyser, source };
            audioNodesCache.set(props.audioElement, nodes);
          }
        }

        if (nodes) {
          if (nodes.ctx.state === 'suspended') {
            nodes.ctx.resume().catch(() => {});
          }
          const freqData = new Uint8Array(nodes.analyser.frequencyBinCount);
          usingWebAudio = true;

          mouthInterval = setInterval(() => {
            if (props.state !== 'speaking') return;

            nodes!.analyser.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) sum += freqData[i];
            const rawAvg = sum / freqData.length;
            smoothedAvg = smoothedAvg * 0.6 + rawAvg * 0.4;

            const now = Date.now();
            if (now - lastFrameChangeTime < 140) return;

            if (smoothedAvg >= 12) {
              lastFrameChangeTime = now;
              if (smoothedAvg < 20) {
                currentFrame.value = FRAMES.normal;
              } else if (smoothedAvg < 55) {
                currentFrame.value = FRAMES.meio;
              } else {
                currentFrame.value = FRAMES.bem_aberta;
              }
            } else {
              if (now - lastFrameChangeTime >= 180) {
                lastFrameChangeTime = now;
                cycleIdx = (cycleIdx + 1) % mouthCycle.length;
                currentFrame.value = mouthCycle[cycleIdx];
              }
            }
          }, 60);
        }
      } catch {
        usingWebAudio = false;
      }
    }

    if (!usingWebAudio) {
      mouthInterval = setInterval(() => {
        if (props.state !== 'speaking') return;
        cycleIdx = (cycleIdx + 1) % mouthCycle.length;
        currentFrame.value = mouthCycle[cycleIdx];
      }, 180);
    }
  }
}

watch(
  () => [props.state, props.audioElement],
  () => {
    updateStateAnimation();
  }
);

onMounted(() => {
  Object.values(FRAMES).forEach((src) => {
    const img = new Image();
    img.src = src;
  });
  updateStateAnimation();
});

onUnmounted(() => {
  stopTimers();
});
</script>

<template>
  <div
    class="relative w-[140px] h-[140px] sm:w-[200px] sm:h-[200px] md:w-[220px] md:h-[220px] lg:w-[230px] lg:h-[230px] shrink-0 transition-all duration-700 ease-in-out"
    :class="[
      className,
      {
        'listening': state === 'listening',
        'processing': state === 'processing',
        'speaking': state === 'speaking',
      }
    ]"
  >
    <!-- Soft Glow Blur -->
    <div
      class="absolute inset-[-30px] sm:inset-[-40px] rounded-full blur-[40px] transition-all duration-700 pointer-events-none z-0"
      :class="{
        'opacity-0': state === 'idle',
        'opacity-25 bg-emerald-500': state === 'listening',
        'opacity-25 bg-amber-400': state === 'processing',
        'opacity-25 bg-primary': state === 'speaking',
      }"
    />

    <!-- Ring 1 (Inner pulse) -->
    <div
      class="absolute inset-[-10px] sm:inset-[-14px] rounded-full pointer-events-none transition-colors duration-500 z-0"
      :class="{
        'border-2 border-primary/25 animate-ring-idle': state === 'idle',
        'border-2 border-emerald-400/70 animate-ring-listen': state === 'listening',
        'border-2 border-amber-400/60 animate-ring-process': state === 'processing',
        'border-2 border-primary/75 animate-ring-speak': state === 'speaking',
      }"
    />

    <!-- Ring 2 (Outer delayed pulse) -->
    <div
      class="absolute inset-[-20px] sm:inset-[-28px] rounded-full pointer-events-none transition-colors duration-500 z-0"
      :class="{
        'border-[1.5px] border-primary/12 animate-ring-idle-delayed': state === 'idle',
        'border-[1.5px] border-emerald-400/30 animate-ring-listen-delayed': state === 'listening',
        'border-[1.5px] border-amber-400/25 animate-ring-process-delayed': state === 'processing',
        'border-[1.5px] border-primary/35 animate-ring-speak-delayed': state === 'speaking',
      }"
    />

    <!-- Main Circular Frame -->
    <div
      class="w-full h-full rounded-full border-[4px] sm:border-[5px] md:border-[6px] border-primary shadow-[0_0_24px_rgba(124,58,237,0.25)] overflow-hidden bg-bg-secondary relative z-10 transition-transform duration-500 hover:scale-105"
    >
      <img
        :src="currentFrame"
        alt="Teacher Tatiana"
        class="w-full h-full object-cover object-top select-none pointer-events-none transition-opacity duration-150"
      />
    </div>
  </div>
</template>
