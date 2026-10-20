import { ref } from 'vue';
import { getChatTts } from '../api/chat';
import { getStoredAccent } from '../constants/accents';

export function useTTS() {
  const isPlaying = ref(false);
  let currentAudio: HTMLAudioElement | null = null;

  async function speak(text: string, accent?: string): Promise<void> {
    stop();
    const effectiveAccent = accent || getStoredAccent();

    try {
      isPlaying.value = true;
      const res = await getChatTts(text, effectiveAccent);
      if (res?.audio_b64) {
        return playBase64(res.audio_b64);
      }
    } catch {
      // Fallback to Web Speech API
      fallbackSpeech(text, effectiveAccent);
    }
  }

  function playBase64(base64: string): Promise<void> {
    return new Promise((resolve) => {
      stop();
      isPlaying.value = true;
      const src = base64.startsWith('data:') ? base64 : `data:audio/mp3;base64,${base64}`;
      currentAudio = new Audio(src);
      currentAudio.onended = () => {
        isPlaying.value = false;
        resolve();
      };
      currentAudio.onerror = () => {
        isPlaying.value = false;
        resolve();
      };
      currentAudio.play().catch(() => {
        isPlaying.value = false;
        resolve();
      });
    });
  }

  function playUrl(url: string): Promise<void> {
    return new Promise((resolve) => {
      stop();
      isPlaying.value = true;
      currentAudio = new Audio(url);
      currentAudio.onended = () => {
        isPlaying.value = false;
        resolve();
      };
      currentAudio.onerror = () => {
        isPlaying.value = false;
        resolve();
      };
      currentAudio.play().catch(() => {
        isPlaying.value = false;
        resolve();
      });
    });
  }

  function fallbackSpeech(text: string, lang: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      isPlaying.value = false;
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => {
      isPlaying.value = false;
    };
    utterance.onerror = () => {
      isPlaying.value = false;
    };
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isPlaying.value = false;
  }

  return {
    isPlaying,
    speak,
    playBase64,
    playUrl,
    stop,
  };
}
