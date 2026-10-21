import { watch, onUnmounted, type Ref } from 'vue';

export function useBodyScrollLock(isLocked: Ref<boolean>) {
  watch(
    isLocked,
    (locked) => {
      if (typeof document === 'undefined') return;
      if (locked) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  });
}
