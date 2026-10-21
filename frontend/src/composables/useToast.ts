import { ref } from 'vue';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

const toasts = ref<ToastMessage[]>([]);

export function useToast() {
  function show(text: string, type: 'success' | 'error' | 'info' = 'info', duration = 3500) {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastMessage = { id, type, text };
    toasts.value.push(toast);

    setTimeout(() => {
      remove(id);
    }, duration);
  }

  function success(text: string, duration?: number) {
    show(text, 'success', duration);
  }

  function error(text: string, duration?: number) {
    show(text, 'error', duration);
  }

  function info(text: string, duration?: number) {
    show(text, 'info', duration);
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return {
    toasts,
    show,
    success,
    error,
    info,
    remove,
  };
}

