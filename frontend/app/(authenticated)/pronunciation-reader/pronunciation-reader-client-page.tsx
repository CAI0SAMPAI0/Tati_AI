'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import {
  ArrowLeft,
  Mic,
  Square,
  Volume2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
  XCircle,
  Sparkles,
  PenLine,
  MessageSquare,
  X,
  Globe,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { TatiLogo } from '@/components/ui/tati-logo';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/lib/constants/accents';

const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });

interface WordResult {
  word: string;
  score: number;
  accuracy: 'correct' | 'incorrect' | 'needs_work' | string;
  error_type?: string;
  tip?: string;
}

interface PronunciationResult {
  score: number;
  transcription: string;
  words: WordResult[];
  feedback: string;
  pedagogical_tip?: string;
  suggested_sentence?: string;
  correct_audio?: string;
  metadata?: {
    accuracy_score?: number;
    fluency_score?: number;
    completeness_score?: number;
    segments?: any[];
    language?: string;
    duration?: number;
    free_speech?: boolean;
  };
  phonetic?: any;
}

interface PracticeSentence {
  text: string;
  level: string;
  tip: string;
}

const PRACTICE_SENTENCES: PracticeSentence[] = [
  // A1 - Basic introductions, everyday objects, simple needs
  { text: "Hello, my name is Maria.", level: "A1", tip: "Focus on clear 'H' and 'L' sounds." },
  { text: "I am a student from Brazil.", level: "A1", tip: "Short 'a' in 'am' — don't draw it out." },
  { text: "I live in a small apartment.", level: "A1", tip: "The 'v' in 'live' touches your upper teeth." },
  { text: "This is my friend, John.", level: "A1", tip: "The 'th' in 'this' — tongue between teeth." },
  { text: "I like coffee and bread.", level: "A1", tip: "Stress 'cof-fee' on the first syllable." },
  { text: "She goes to school by bus.", level: "A1", tip: "The 's' in 'bus' is sharp, not like 'z'." },
  { text: "We have two cats at home.", level: "A1", tip: "Short 'a' in 'cats' — keep it quick." },
  { text: "He works in a big hospital.", level: "A1", tip: "Stress 'HOS-pi-tal' on the first syllable." },
  { text: "The book is on the table.", level: "A1", tip: "Clear 't' at the start of 'table'." },
  { text: "It is a sunny day today.", level: "A1", tip: "Double 'n' in 'sunny' — one smooth sound." },

  // A2 - Daily routines, travel, personal experiences
  { text: "I usually wake up at seven o'clock.", level: "A2", tip: "The 's' in 'usually' sounds like 'zh'." },
  { text: "She doesn't like to wake up early.", level: "A2", tip: "The 'ea' in 'early' is one long sound." },
  { text: "I have been learning English for three years.", level: "A2", tip: "TH sound: place tongue between teeth." },
  { text: "We went to the beach last weekend.", level: "A2", tip: "The 'ch' in 'beach' is a soft sound." },
  { text: "Could you repeat that, please?", level: "A2", tip: "Rising intonation on 'please' sounds polite." },
  { text: "I need to buy some milk and eggs.", level: "A2", tip: "Link words: 'milk and eggs' flows together." },
  { text: "The restaurant serves delicious Italian food.", level: "A2", tip: "Stress 'res-tau-rant' — three clear syllables." },
  { text: "My brother is taller than me.", level: "A2", tip: "The 'th' in 'than' — tongue between teeth." },
  { text: "It rained a lot during our vacation.", level: "A2", tip: "The 'ai' in 'rained' is a long sound." },
  { text: "Can you tell me where the station is?", level: "A2", tip: "The 's' in 'station' sounds like 'sh'." },

  // B1 - Opinions, experiences, work, future plans
  { text: "I think we should take a break now.", level: "B1", tip: "The 'th' in 'think' is unvoiced — tongue out." },
  { text: "I would have gone if I had known about it.", level: "B1", tip: "Past conditionals: rhythm matters more than speed." },
  { text: "The weather has been particularly warm this month.", level: "B1", tip: "Link words smoothly: 'has been', 'this month'." },
  { text: "She is considering applying for a promotion.", level: "B1", tip: "The 'ing' ending should be clear, not 'in'." },
  { text: "Despite the difficulties, we managed to finish on time.", level: "B1", tip: "Emphasize 'de-SPITE' and 'MA-naged'." },
  { text: "I enjoy reading books about history and science.", level: "B1", tip: "The 'j' in 'enjoy' — push air through." },
  { text: "They moved to a new city because of his job.", level: "B1", tip: "The 'c' in 'city' is soft like 's'." },
  { text: "We are looking forward to the weekend trip.", level: "B1", tip: "Phrasal verb stress: 'LOOK-ing for-WARD'." },
  { text: "He apologized for arriving late to the meeting.", level: "B1", tip: "Stress 'a-PO-lo-gized' on the second syllable." },
  { text: "The movie was not as good as I expected.", level: "B1", tip: "The 'x' in 'expected' sounds like 'ks'." },

  // B2 - Abstract ideas, debates, professional topics
  { text: "The instructions were quite straightforward, weren't they?", level: "B2", tip: "Tag questions rise at the end for real questions." },
  { text: "If I were you, I would reconsider the entire approach.", level: "B2", tip: "Subjunctive 'were' — don't skip it." },
  { text: "The committee has decided to postpone the project indefinitely.", level: "B2", tip: "Multi-syllable words: give each syllable space." },
  { text: "Notwithstanding the evidence, the jury reached a unanimous verdict.", level: "B2", tip: "Focus on consonant clusters: 'stand', 'ver-dict'." },
  { text: "The government ought to invest more in renewable energy.", level: "B2", tip: "The 'gh' in 'ought' is silent." },
  { text: "It is worth considering the long-term implications.", level: "B2", tip: "The 'th' in 'worth' — unvoiced, tongue out." },
  { text: "Her presentation was remarkably insightful and well-structured.", level: "B2", tip: "Stress 'pre-sen-TA-tion' on the third syllable." },
  { text: "The outbreak of the pandemic changed everything overnight.", level: "B2", tip: "The 'p' in 'pandemic' is aspirated (puff of air)." },
  { text: "We need to foster a culture of innovation and collaboration.", level: "B2", tip: "The 't' in 'culture' sounds like 'ch'." },
  { text: "The phenomenon is not as straightforward as it seems.", level: "B2", tip: "Stress 'phe-NO-me-non' on the second syllable." },

  // C1 - Complex topics, professional discourse, nuanced expression
  { text: "The pharmaceutical industry has undergone substantial regulatory reforms.", level: "C1", tip: "Focus on word stress: 'phar-ma-CEU-ti-cal', 're-GU-la-to-ry'." },
  { text: "Nevertheless, the implications of this socioeconomic phenomenon remain contentious.", level: "C1", tip: "Long words: break into syllables and maintain rhythm." },
  { text: "The government's austerity measures have precipitated widespread public dissent.", level: "C1", tip: "Consonant clusters: 'stri-ty', 'pre-CI-pi-ta-ted'." },
  { text: "From a pedagogical standpoint, the curriculum requires a more nuanced approach.", level: "C1", tip: "Stress: 'pe-da-GO-gi-cal', 'NU-an-ced'." },
  { text: "The discrepancy between the two reports is quite alarming.", level: "C1", tip: "Stress 'dis-CRE-pan-cy' on the second syllable." },
  { text: "The proposed legislation would fundamentally alter the healthcare landscape.", level: "C1", tip: "The 'g' in 'legislation' sounds like 'j'." },
  { text: "It is imperative that we address these issues without further delay.", level: "C1", tip: "Stress 'im-PE-ra-tive' on the second syllable." },
  { text: "The correlation between diet and cognitive function is well documented.", level: "C1", tip: "Stress 'cor-re-LA-tion' and 'COG-ni-tive'." },
  { text: "Her unequivocal stance on the matter surprised many of her colleagues.", level: "C1", tip: "The 'qu' in 'unequivocal' sounds like 'kw'." },
  { text: "The unprecedented scale of the challenge requires a coordinated global response.", level: "C1", tip: "Stress 'un-PRE-ce-den-ted' — five clear syllables." },

  // C2 - Highly abstract, specialized terminology, sophisticated structures
  { text: "The epistemological foundations of postmodernist discourse are inherently paradoxical.", level: "C2", tip: "Master complex word stress: 'e-pis-te-MO-lo-gi-cal', 'pos-TMO-dern-ist'." },
  { text: "Notwithstanding the aforementioned caveats, the extrapolation remains justifiable.", level: "C2", tip: "Smooth linking between long words — don't pause between them." },
  { text: "The phenomenological approach to research elucidates subjective experiential realities.", level: "C2", tip: "Natural rhythm: 'phe-no-me-no-LO-gi-cal', 'e-LU-ci-dates'." },
  { text: "A multidisciplinary synthesis of contemporaneous paradigms proves indispensable.", level: "C2", tip: "Intonation patterns in very long sentences — use pitch variation." },
  { text: "The quintessence of her argument lies in the ontological distinction she draws.", level: "C2", tip: "Stress 'quin-TES-sence' and 'on-to-LO-gi-cal'." },
  { text: "The juxtaposition of these two ideologies creates a fascinating dialectic.", level: "C2", tip: "Stress 'jux-ta-po-SI-tion' on the fourth syllable." },
  { text: "Her magnum opus constitutes an invaluable contribution to sociolinguistic theory.", level: "C2", tip: "Latin phrases: 'MAG-num O-pus' — maintain original pronunciation." },
  { text: "The inscrutable nature of the data renders any definitive conclusion untenable.", level: "C2", tip: "Stress 'in-SCRU-ta-ble' and 'un-TE-na-ble'." },
  { text: "The proliferation of disinformation necessitates a paradigm shift in media literacy.", level: "C2", tip: "Stress 'pro-li-fe-RA-tion' — six syllables with clear rhythm." },
  { text: "His peripatetic career has encompassed a panoply of interdisciplinary endeavors.", level: "C2", tip: "Stress 'pe-ri-pa-TE-tic' and 'PAN-o-ply'." },
];

type InputMode = 'preset' | 'custom' | 'free';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function exportWavRaw(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (v: DataView, off: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

export default function PronunciationReaderClientPage() {
  const router = useRouter();
  const { user } = useAuth();

  const userLevel = (user as any)?.level || 'A1';

  const getInitialAccent = useCallback(() => {
    const userProfile = user?.profile as { preferred_accent?: string; accent?: string } | undefined;
    const profileAccent = (user as any)?.preferred_accent || userProfile?.preferred_accent || userProfile?.accent;
    return getStoredAccent(profileAccent || 'en-US');
  }, [user]);

  const [selectedAccent, setSelectedAccent] = useState<string>(() => getInitialAccent());
  const [isAccentModalOpen, setIsAccentModalOpen] = useState(false);

  useEffect(() => {
    const handleAccentChange = () => {
      setSelectedAccent(getInitialAccent());
    };
    window.addEventListener('tati_accent_changed', handleAccentChange);
    window.addEventListener('storage', handleAccentChange);
    return () => {
      window.removeEventListener('tati_accent_changed', handleAccentChange);
      window.removeEventListener('storage', handleAccentChange);
    };
  }, [getInitialAccent]);

  const handleSelectAccent = (accId: string) => {
    setSelectedAccent(accId);
    saveStoredAccent(accId);
    setIsAccentModalOpen(false);
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordResult | null>(null);
  const [isPlayingWord, setIsPlayingWord] = useState<string | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<{ sentence: string; score: number }[]>([]);

  const setUserAudioBlobUrl = useCallback((url: string | null) => {
    setUserAudioUrl(prev => {
      if (prev) {
        try { URL.revokeObjectURL(prev); } catch (_) { }
      }
      return url;
    });
  }, []);

  const [inputMode, setInputMode] = useState<InputMode>('preset');
  const [customText, setCustomText] = useState('');
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);

  const currentSentence = PRACTICE_SENTENCES[currentIndex];

  const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const userIdx = levelOrder.indexOf(userLevel);

  const filteredSentences = PRACTICE_SENTENCES.filter(s => {
    const sIdx = levelOrder.indexOf(s.level);
    return Math.abs(sIdx - userIdx) <= 1;
  }).sort((a, b) => {
    const aIdx = levelOrder.indexOf(a.level);
    const bIdx = levelOrder.indexOf(b.level);
    const aDist = Math.abs(aIdx - userIdx);
    const bDist = Math.abs(bIdx - userIdx);
    if (aDist !== bDist) return aDist - bDist;
    return aIdx - bIdx;
  });

  const displaySentence = filteredSentences[currentIndex % filteredSentences.length] || PRACTICE_SENTENCES[0];

  const getActiveText = (): string => {
    if (inputMode === 'custom') return customText.trim();
    if (inputMode === 'free') return '';
    return displaySentence.text;
  };

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  const playReference = async () => {
    const text = getActiveText();
    if (!text) return;
    try {
      const res = await apiPost<{ audio: string }>(ENDPOINTS.CHAT_TTS, { text, accent: selectedAccent });
      if (res.ok && res.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio}`);
        audio.play();
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const isOperatingRef = useRef(false);

  // Limpeza completa de recursos de áudio no desmonte do componente
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) { }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (_) { }
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const getSupportedMimeType = (): string => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return '';
    }
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ];
    for (const type of types) {
      try {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (_) { }
    }
    return '';
  };

  const startRecording = async () => {
    if (isOperatingRef.current || isRecording) return;
    isOperatingRef.current = true;

    setResult(null);
    setSelectedWord(null);
    setUserAudioBlobUrl(null);
    setRecordingError(null);

    // 1. Limpa qualquer gravação ou stream anterior que ainda esteja em aberto
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) { }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (_) { }
      audioContextRef.current = null;
    }

    // 2. Validação de suporte à API do Navegador
    if (
      typeof window === 'undefined' ||
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setRecordingError(
        'Your browser does not support audio recording. Please use an updated version of Safari, Chrome or Edge.'
      );
      isOperatingRef.current = false;
      return;
    }

    try {
      // 3. Solicitação de permissão de microfone dentro do gesto do usuário
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 4. Inicializa Web Audio API para o waveform (se suportado e seguro no iOS)
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const audioContext = new AudioCtxClass();
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);

          audioContextRef.current = audioContext;
          analyserRef.current = analyser;
          drawWaveform();
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext waveform não disponível, continuando gravação:', audioCtxErr);
      }

      // 5. Configura MediaRecorder com mimeType compatível com o navegador atual (incluindo Mobile Safari)
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          // Finaliza e libera tracks do microfone agora que o recorder terminou com segurança
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            try {
              audioContextRef.current.close();
            } catch (_) { }
            audioContextRef.current = null;
          }
          cancelAnimationFrame(animFrameRef.current);

          const elapsed = Date.now() - recordingStartRef.current;
          if (elapsed < 1200) {
            setRecordingError('Recording too short. Please speak for at least 2 seconds.');
            setIsRecording(false);
            return;
          }

          if (audioChunksRef.current.length === 0) {
            setRecordingError('No audio data recorded. Please try again.');
            setIsRecording(false);
            return;
          }

          // Monta o blob com o tipo retornado pelo MediaRecorder
          const effectiveMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: effectiveMime });
          const audioUrl = URL.createObjectURL(blob);
          setUserAudioBlobUrl(audioUrl);

          // Converte diretamente para base64 sem instanciar novo AudioContext assíncrono (evita NotAllowedError no Safari/iOS)
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

          const activeText = getActiveText();
          await evaluatePronunciation(base64, activeText);
        } catch (err: any) {
          console.error('Audio processing error:', err);
          setRecordingError('Error processing audio. Please try again.');
        } finally {
          setIsRecording(false);
          isOperatingRef.current = false;
        }
      };

      mediaRecorder.onerror = (e: any) => {
        console.error('MediaRecorder error:', e);
        setRecordingError('Recording error occurred. Please check your microphone.');
        setIsRecording(false);
        isOperatingRef.current = false;
      };

      // Dispara o início da gravação com fatiamento em tempo real
      mediaRecorder.start(250);
      recordingStartRef.current = Date.now();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setRecordingError(
          'Microphone access denied. On Mobile Safari / iOS, tap "aA" or the lock icon in the address bar, open Website Settings, and allow Microphone access.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setRecordingError('No microphone found. Please connect or enable your microphone.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setRecordingError('Microphone is busy or being used by another app. Please close other audio apps and try again.');
      } else {
        setRecordingError(err.message || 'Could not access microphone. Please try again.');
      }
      setIsRecording(false);
    } finally {
      isOperatingRef.current = false;
    }
  };

  const stopRecording = () => {
    cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (stopErr) {
        console.error('Error stopping recorder:', stopErr);
      }
    } else {
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  const evaluatePronunciation = async (audioBase64: string, referenceText: string) => {
    setIsEvaluating(true);
    try {
      const body: Record<string, any> = { audio: audioBase64, accent: selectedAccent };
      if (referenceText) {
        body.reference_text = referenceText;
      }

      const res = await apiPost<PronunciationResult>(
        ENDPOINTS.SPEECH_VERIFY_PRONUNCIATION,
        body
      );
      if (res.ok && res.data) {
        setResult(res.data);
        setHistory(prev => [
          ...prev,
          {
            sentence: referenceText || '(free speech)',
            score: res.data.score,
          },
        ]);
      } else {
        setRecordingError('Evaluation failed. Please try speaking clearly and try again.');
      }
    } catch (err: any) {
      console.error('Pronunciation evaluation error:', err);
      setRecordingError('Error evaluating pronunciation. Please check your connection and try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const goNext = () => {
    setResult(null);
    setSelectedWord(null);
    setUserAudioBlobUrl(null);
    setCurrentIndex(prev => (prev + 1) % filteredSentences.length);
  };

  const goPrev = () => {
    setResult(null);
    setSelectedWord(null);
    setUserAudioBlobUrl(null);
    setCurrentIndex(prev => (prev - 1 + filteredSentences.length) % filteredSentences.length);
  };

  const scoreColor = (score: number) => {
    if (score >= 85) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Auto-play correct pronunciation when result comes in
  useEffect(() => {
    if (result?.correct_audio) {
      const audio = new Audio(`data:audio/mp3;base64,${result.correct_audio}`);
      audio.play().catch(e => console.warn('Could not auto-play audio:', e));
    }
  }, [result]);

  const playCorrectAudio = useCallback(() => {
    if (result?.correct_audio) {
      const audio = new Audio(`data:audio/mp3;base64,${result.correct_audio}`);
      audio.play().catch(e => console.warn('Could not play correct audio:', e));
    }
  }, [result]);

  const playUserAudio = useCallback(() => {
    if (userAudioUrl) {
      const audio = new Audio(userAudioUrl);
      audio.play().catch(e => console.warn('Could not play user audio:', e));
    }
  }, [userAudioUrl]);

  const playWordAudio = useCallback(async (wordToPlay: string) => {
    setIsPlayingWord(wordToPlay);
    const clean = wordToPlay.replace(/[^\w\s']/g, '').trim();
    try {
      const res = await apiPost<{ audio?: string; audio_b64?: string }>(ENDPOINTS.CHAT_TTS, { text: clean, accent: selectedAccent });
      const b64 = res.ok && (res.data?.audio || res.data?.audio_b64);
      if (b64) {
        const audio = new Audio(`data:audio/mp3;base64,${b64}`);
        audio.onended = () => setIsPlayingWord(null);
        audio.onerror = () => setIsPlayingWord(null);
        await audio.play();
        return;
      }
    } catch (_) {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = selectedAccent || 'en-US';
      u.rate = 0.85;
      u.onend = () => setIsPlayingWord(null);
      u.onerror = () => setIsPlayingWord(null);
      window.speechSynthesis.speak(u);
    } else {
      setIsPlayingWord(null);
    }
  }, [selectedAccent]);

  const avgScore = history.length > 0 ? Math.round(history.reduce((a, h) => a + h.score, 0) / history.length) : 0;
  const currentAccentObj = ACCENTS.find(a => a.id === selectedAccent) || ACCENTS[0];

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-bg-secondary/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <BookOpen size={20} className="text-primary" />
            Pronunciation Reader
          </h1>
          <p className="text-xs text-text-muted">Read aloud, write your own text, or just speak freely</p>
        </div>

        {/* Accent Selector Button */}
        <button
          onClick={() => setIsAccentModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all shadow-sm active:scale-95 shrink-0"
          title="Change Teacher Tati's accent"
        >
          <span className="text-base">{currentAccentObj.flag}</span>
          <span className="hidden sm:inline">{currentAccentObj.shortLabel}</span>
          <Globe size={13} className="text-text-muted ml-0.5" />
        </button>

        {history.length > 0 && (
          <div className="text-right">
            <div className={cn('text-lg font-bold', scoreColor(avgScore))}>{avgScore}%</div>
            <div className="text-[0.6rem] text-text-muted">Avg. Score</div>
          </div>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-2xl mx-auto w-full">
        {/* Input mode selector */}
        <div className="flex gap-2 mb-3 w-full">
          <button
            onClick={() => setInputMode('preset')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'preset'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <BookOpen size={14} />
            Preset Sentences
          </button>
          <button
            onClick={() => setInputMode('custom')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'custom'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <PenLine size={14} />
            Write Your Own
          </button>
          <button
            onClick={() => setInputMode('free')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'free'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
            )}
          >
            <MessageSquare size={14} />
            Free Speech
          </button>
        </div>

        {/* Accent Bar */}
        <div className="w-full flex items-center justify-between gap-2 mb-5 px-1 overflow-x-hidden">
          <span className="text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider flex items-center gap-1.5 shrink-0">
            <Globe size={12} className="text-primary" />
            Accent:
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            {ACCENTS.slice(0, 5).map((acc) => {
              const isSelected = acc.id === selectedAccent;
              return (
                <button
                  key={acc.id}
                  onClick={() => handleSelectAccent(acc.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shrink-0 active:scale-95 cursor-pointer",
                    isSelected
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : "bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30"
                  )}
                  title={acc.desc}
                >
                  <span>{acc.flag}</span>
                  <span>{acc.shortLabel}</span>
                </button>
              );
            })}
            <button
              onClick={() => setIsAccentModalOpen(true)}
              className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface border border-border text-primary hover:bg-surface-hover shrink-0 cursor-pointer"
              title="View all accents"
            >
              More...
            </button>
          </div>
        </div>

        {/* Sentence card / Custom input */}
        {inputMode === 'preset' ? (
          <>
            {/* Level badge */}
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-bold mb-6',
              displaySentence.level === 'A1' ? 'bg-green-500/20 text-green-400' :
                displaySentence.level === 'A2' ? 'bg-green-500/15 text-green-300' :
                  displaySentence.level === 'B1' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
            )}>
              {displaySentence.level}
            </div>

            <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
              <p className="text-xl md:text-2xl font-display font-bold text-text leading-relaxed mb-4">
                {displaySentence.text}
              </p>
              <p className="text-xs text-text-muted italic">
                💡 {displaySentence.tip}
              </p>
            </div>
          </>
        ) : inputMode === 'custom' ? (
          <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6">
            <label className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 block">
              Type or paste the text you want to practice
            </label>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. The quick brown fox jumps over the lazy dog..."
              className="w-full h-32 bg-bg border border-border rounded-xl p-4 text-text text-base resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-[0.65rem] text-text-muted">
                {customText.length}/500 characters
              </p>
              {customText.trim() && (
                <button
                  onClick={() => setCustomText('')}
                  className="text-[0.65rem] text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} />
            </div>
            <p className="text-lg font-bold text-text mb-2">Free Speech Mode</p>
            <p className="text-sm text-text-muted">
              Just tap the microphone and speak naturally. Tati will transcribe and analyze your pronunciation.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 mb-6">
          {inputMode === 'preset' && (
            <>
              <button
                onClick={goPrev}
                className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            </>
          )}

          <button
            onClick={playReference}
            disabled={!getActiveText() || isRecording || isEvaluating}
            className={cn(
              'p-4 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-primary',
              (!getActiveText() || isRecording || isEvaluating) && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Volume2 size={24} />
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isEvaluating}
            className={cn(
              'p-5 rounded-full shadow-lg transition-all duration-300',
              isRecording
                ? 'bg-red-500 shadow-red-500/30 animate-pulse scale-110'
                : 'bg-primary shadow-primary/20 hover:scale-105 active:scale-95',
              isEvaluating && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isRecording ? <Square size={28} className="text-white" /> : <Mic size={28} className="text-white" />}
          </button>

          <button
            onClick={() => { setResult(null); setRecordingError(null); }}
            className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
          >
            <RotateCcw size={20} />
          </button>

          {inputMode === 'preset' && (
            <>
              <button
                onClick={goNext}
                className="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4"
            >
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Recording — speak now...
              </div>
              <canvas
                ref={canvasRef}
                width={300}
                height={60}
                className="mt-2 rounded-lg"
              />
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Recording error */}
        <AnimatePresence>
          {recordingError && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 w-full"
            >
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 text-center">
                {recordingError}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Evaluating indicator */}
        <AnimatePresence>
          {isEvaluating && (
            <MotionDiv
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-4 flex items-center gap-2 text-primary text-sm"
            >
              <Sparkles size={16} className="animate-spin" />
              Analyzing your pronunciation...
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full"
            >
              <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
                {/* Score */}
                <div className="text-center">
                  <div className={cn('text-5xl font-black', scoreColor(result.score))}>
                    {result.score}%
                  </div>
                  <p className="text-xs text-text-subtle mt-1 font-medium">
                    {result.score >= 85 ? 'Excelente articulação e clareza!' : result.score >= 60 ? 'Bom esforço! Ajuste os fonemas destacados.' : 'Vamos praticar novamente ouvindo a Teacher Tati.'}
                  </p>
                </div>

                {/* 🎧 Player Comparativo: Sua Voz vs Teacher Tati */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={playUserAudio}
                    disabled={!userAudioUrl}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed text-primary rounded-xl text-xs font-bold transition-all"
                  >
                    <Volume2 size={16} />
                    Listen to your own voice
                  </button>
                  <button
                    onClick={playCorrectAudio}
                    disabled={!result.correct_audio}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-all"
                  >
                    <Volume2 size={16} />
                    Teacher Tati
                  </button>
                </div>

                {/* 💡 Frase sugerida pela Teacher Tati para fala livre ou concordância */}
                {result.suggested_sentence && (
                  <div className="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex flex-col gap-1.5 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.68rem] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={13} />
                        Sugestão natural da Teacher Tati:
                      </span>
                      {result.correct_audio && (
                        <button
                          type="button"
                          onClick={playCorrectAudio}
                          className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Volume2 size={13} />
                          Ouvir frase
                        </button>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-text leading-relaxed">
                      &ldquo;{result.suggested_sentence}&rdquo;
                    </p>
                  </div>
                )}

                {/* 👩‍🏫 Card da Dica da Teacher Tati em Português */}
                {result.pedagogical_tip && (
                  <div className="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col gap-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5">
                        <TatiLogo size={36} className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[0.7rem] font-bold text-primary uppercase tracking-wider">
                          Dica da Teacher Tati
                        </p>
                        <p className="text-xs md:text-sm text-foreground leading-relaxed">
                          {result.pedagogical_tip}
                        </p>
                      </div>
                    </div>

                    {/* Lista com TODAS as palavras com atenção ou erro */}
                    {result.words && result.words.filter(w => w.tip || w.accuracy !== 'correct').length > 0 && (
                      <div className="pt-3 border-t border-primary/20 space-y-2">
                        <p className="text-[0.68rem] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles size={13} />
                          Pontos para praticar:
                        </p>
                        <div className="space-y-1.5">
                          {result.words.filter(w => w.tip || w.accuracy !== 'correct').map((w, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedWord(w)}
                              className="w-full text-left flex items-start gap-2.5 p-2 rounded-xl bg-surface/70 hover:bg-surface border border-border/70 hover:border-primary/50 transition-all text-xs group"
                            >
                              <span className={cn(
                                "font-bold shrink-0 px-2 py-0.5 rounded text-[0.7rem] font-mono",
                                w.accuracy === 'needs_work'
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                              )}>
                                {w.word}
                              </span>
                              <span className="text-text-muted group-hover:text-text leading-relaxed flex-1">
                                {w.tip || "Ajuste a pronúncia desta palavra."}
                              </span>
                              <span className="text-[0.65rem] text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                Ver detalhe →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Feedback geral */}
                {result.feedback && (
                  <div className="bg-surface-hover/50 border border-border rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-text-subtle font-semibold uppercase tracking-wider mb-0.5">General Feedback</p>
                        <p className="text-sm text-text leading-relaxed italic">&quot;{result.feedback}&quot;</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Word-level breakdown (clique abre modal com dica e áudio) */}
                {result.words && result.words.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider">Word-by-Word</h3>
                      <span className="text-[0.65rem] text-text-muted">Toque na palavra para ver a dica</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.words.map((w, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedWord(w)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm',
                            w.accuracy === 'correct'
                              ? 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                              : w.accuracy === 'needs_work'
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-1 ring-amber-500/20'
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 line-through'
                          )}
                        >
                          <span className="font-bold">{w.word}</span>
                          <span className="text-[0.65rem] opacity-75 font-sans">
                            {Math.round(w.score)}%
                          </span>
                          {w.tip && (
                            <span className="text-[0.65rem] text-amber-500">💡</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}


                {/* Transcription */}
                {result.transcription && (
                  <div>
                    <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-1">What Tati heard</h3>
                    <p className="text-sm text-text italic">&quot;{result.transcription}&quot;</p>
                  </div>
                )}

                {/* Metadata */}
                {result.metadata && (
                  <div className="grid grid-cols-3 gap-2">
                    {result.metadata.accuracy_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.accuracy_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Accuracy</div>
                      </div>
                    )}
                    {result.metadata.fluency_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.fluency_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Fluency</div>
                      </div>
                    )}
                    {result.metadata.completeness_score != null && (
                      <div className="text-center p-2 bg-bg rounded-lg">
                        <div className="text-sm font-bold text-text">{Math.round(result.metadata.completeness_score)}%</div>
                        <div className="text-[0.6rem] text-text-muted">Completeness</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Phonetic (if available) */}
                {result.phonetic && result.phonetic.provider && (
                  <div className="text-[0.65rem] text-text-muted">
                    Phonetic provider: {result.phonetic.provider}
                  </div>
                )}
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 1 && (
          <div className="w-full mt-6">
            <h3 className="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2">Session History</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map((h, i) => (
                <div key={i} className="flex-shrink-0 bg-surface border border-border rounded-lg p-2 text-center min-w-[80px]">
                  <div className={cn('text-sm font-bold', scoreColor(h.score))}>{h.score}%</div>
                  <div className="text-[0.6rem] text-text-muted truncate max-w-[70px]">{h.sentence.substring(0, 15)}...</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🪟 Modal / Tooltip de Fonética da Palavra */}
        <AnimatePresence>
          {selectedWord && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setSelectedWord(null)}
            >
              <div
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-5 shadow-2xl space-y-4"
              >
                {/* Header do Modal */}
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl font-black text-text font-mono tracking-tight">
                      {selectedWord.word}
                    </span>
                    <span
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-xs font-bold font-sans',
                        selectedWord.accuracy === 'correct'
                          ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                          : selectedWord.accuracy === 'needs_work'
                            ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-500 border border-red-500/30'
                      )}
                    >
                      {Math.round(selectedWord.score)}%
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                    aria-label="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Status da Pronúncia */}
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {selectedWord.accuracy === 'correct' ? (
                    <span className="flex items-center gap-1.5 text-green-500">
                      <CheckCircle2 size={16} /> Pronúncia natural e clara
                    </span>
                  ) : selectedWord.accuracy === 'needs_work' ? (
                    <span className="flex items-center gap-1.5 text-amber-500">
                      <Sparkles size={16} /> Compreensível, mas com sotaque
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-500">
                      <XCircle size={16} /> Fonema impreciso ou trocado
                    </span>
                  )}
                </div>

                {/* Dica da Teacher Tati para a palavra */}
                {selectedWord.tip ? (
                  <div className="p-3.5 bg-primary/10 border border-primary/25 rounded-2xl flex items-start gap-3 text-left">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5">
                      <TatiLogo size={32} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.68rem] font-bold text-primary uppercase tracking-wider">
                        Dica da Teacher Tati
                      </p>
                      <p className="text-xs text-text leading-relaxed font-medium">
                        {selectedWord.tip}
                      </p>
                    </div>
                  </div>
                ) : selectedWord.accuracy === 'correct' ? (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-xs text-text-muted leading-relaxed">
                    Perfeito! Você articulou esse termo com precisão e clareza acústica.
                  </div>
                ) : null}

                {/* Botão de Ouvir Palavra */}
                <button
                  type="button"
                  onClick={() => playWordAudio(selectedWord.word)}
                  disabled={isPlayingWord === selectedWord.word}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
                >
                  <Volume2 size={16} className={isPlayingWord === selectedWord.word ? 'animate-pulse' : ''} />
                  {isPlayingWord === selectedWord.word ? 'Tocando pronúncia...' : `Ouvir pronúncia de "${selectedWord.word}"`}
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Accent Picker Modal */}
        <AnimatePresence>
          {isAccentModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 animate-in fade-in duration-200">
              <div
                className="fixed inset-0 cursor-pointer"
                onClick={() => setIsAccentModalOpen(false)}
              />
              <div className="relative w-full sm:max-w-md bg-white dark:bg-[#111322] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[85vh] flex flex-col space-y-4 animate-in slide-in-from-bottom-5 duration-300">
                <div className="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
                  <div className="space-y-0.5">
                    <h3 className="text-base sm:text-lg font-black text-text flex items-center gap-2">
                      <span>🌎</span> English Accents (Edge TTS)
                    </h3>
                    <p className="text-xs text-text-muted">Teacher Tati will practice with the selected accent</p>
                  </div>
                  <button
                    onClick={() => setIsAccentModalOpen(false)}
                    className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
                  {ACCENTS.map((acc) => {
                    const isSelected = acc.id === selectedAccent;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => handleSelectAccent(acc.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer",
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm text-primary ring-1 ring-primary/40 font-bold"
                            : "bg-surface border-border hover:border-primary/40 text-text"
                        )}
                      >
                        <span className="text-xl shrink-0">{acc.flag}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{acc.label}</p>
                          <p className="text-[0.65rem] text-text-muted truncate">{acc.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

