import { ref } from 'vue';

export function useAudioRecorder() {
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let timerInterval: number | null = null;

  async function startRecording(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported on this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    audioChunks = [];
    recordingDuration.value = 0;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : '';

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    // Continuous 200ms slicing guarantees data chunks in buffer
    mediaRecorder.start(200);
    isRecording.value = true;

    timerInterval = window.setInterval(() => {
      recordingDuration.value += 1;
    }, 1000);
  }

  function stopRecording(): Promise<{ blob: Blob; base64: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        return reject(new Error('Recorder not initialized'));
      }

      mediaRecorder.onstop = () => {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }

        const mime = mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: mime });

        // Stop all tracks
        mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const pureB64 = base64data.includes(',') ? base64data.split(',')[1] : base64data;
          isRecording.value = false;
          resolve({
            blob,
            base64: pureB64,
            duration: recordingDuration.value,
          });
        };
        reader.onerror = (err) => {
          isRecording.value = false;
          reject(err);
        };
      };

      mediaRecorder.stop();
    });
  }

  function cancelRecording() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      mediaRecorder.stop();
    }
    isRecording.value = false;
    recordingDuration.value = 0;
    audioChunks = [];
  }

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

