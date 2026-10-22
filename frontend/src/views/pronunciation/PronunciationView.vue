<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
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
  History,
  Play,
  Pause,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { apiPost, apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

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

type InputMode = 'preset' | 'custom' | 'free';

const PRACTICE_SENTENCES: PracticeSentence[] = [
  // A1 - Apresentações básicas, objetos cotidianos e necessidades simples (ordenadas do mais básico ao progressivo)
  { text: 'Hello, my name is Maria.', level: 'A1', tip: "Focus on clear 'H' and 'L' sounds." },
  { text: 'I am a student from Brazil.', level: 'A1', tip: "Short 'a' in 'am' — don't draw it out." },
  { text: 'I live in a small apartment.', level: 'A1', tip: "The 'v' in 'live' touches your upper teeth." },
  { text: 'This is my friend, John.', level: 'A1', tip: "The 'th' in 'this' — tongue between teeth." },
  { text: 'I like coffee and fresh bread.', level: 'A1', tip: "Stress 'cof-fee' on the first syllable." },
  { text: 'She goes to school by bus.', level: 'A1', tip: "The 's' in 'bus' is sharp, not like 'z'." },
  { text: 'We have two friendly cats at home.', level: 'A1', tip: "Short 'a' in 'cats' — keep it quick." },
  { text: 'He works in a big city hospital.', level: 'A1', tip: "Stress 'HOS-pi-tal' on the first syllable." },
  { text: 'The notebook is on the wooden table.', level: 'A1', tip: "Clear 't' at the start of 'table'." },
  { text: 'It is a warm sunny day today.', level: 'A1', tip: "Double 'n' in 'sunny' — one smooth sound." },
  { text: 'Where is the train station?', level: 'A1', tip: "Clear 'w' sound with rounded lips." },
  { text: 'I drink water every morning.', level: 'A1', tip: "The 'r' in 'water' and 'drink' should be smooth." },
  { text: 'They play soccer in the park.', level: 'A1', tip: "Crisp 'k' at the end of 'park'." },
  { text: 'My sister is twenty years old.', level: 'A1', tip: "Pronounce 'twen-ty' clearly without dropping 't'." },
  { text: 'Can I have a cup of tea, please?', level: 'A1', tip: "Polite rising tone at the end of the sentence." },

  // A2 - Rotinas diárias, viagens e experiências pessoais
  { text: "I usually wake up at seven o'clock.", level: 'A2', tip: "The 's' in 'usually' sounds like 'zh'." },
  { text: "She doesn't like to wake up early.", level: 'A2', tip: "The 'ea' in 'early' is one long sound." },
  { text: 'I have been learning English for three years.', level: 'A2', tip: 'TH sound: place tongue between teeth.' },
  { text: 'We went to the beach last weekend.', level: 'A2', tip: "The 'ch' in 'beach' is a soft sound." },
  { text: 'Could you repeat that, please?', level: 'A2', tip: "Rising intonation on 'please' sounds polite." },
  { text: 'I need to buy some milk and eggs.', level: 'A2', tip: "Link words: 'milk and eggs' flows together." },
  { text: 'The restaurant serves delicious Italian food.', level: 'A2', tip: "Stress 'res-tau-rant' — three clear syllables." },
  { text: 'My brother is taller than me.', level: 'A2', tip: "The 'th' in 'than' — tongue between teeth." },
  { text: 'It rained a lot during our vacation.', level: 'A2', tip: "The 'ai' in 'rained' is a long sound." },
  { text: 'Can you tell me where the station is?', level: 'A2', tip: "The 's' in 'station' sounds like 'sh'." },
  { text: 'We cooked dinner together yesterday evening.', level: 'A2', tip: "Pronounce '-ed' in 'cooked' as a crisp 't'." },
  { text: 'She visited her grandparents last Saturday.', level: 'A2', tip: "Stress 'grand-par-ents' on the first syllable." },
  { text: 'How much does this pair of shoes cost?', level: 'A2', tip: "Link 'pair of' smoothly into one unit." },
  { text: 'I took the subway because the traffic was heavy.', level: 'A2', tip: "Short 'u' in 'subway' and clear 'v' in 'heavy'." },
  { text: 'He forgot his umbrella at the office.', level: 'A2', tip: "Stress 'um-BREL-la' on the second syllable." },

  // B1 - Opiniões, experiências, trabalho e planos futuros
  { text: 'I think we should take a break now.', level: 'B1', tip: "The 'th' in 'think' is unvoiced — tongue out." },
  { text: 'I would have gone if I had known about it.', level: 'B1', tip: 'Past conditionals: rhythm matters more than speed.' },
  { text: 'The weather has been particularly warm this month.', level: 'B1', tip: "Link words smoothly: 'has been', 'this month'." },
  { text: 'She is considering applying for a promotion.', level: 'B1', tip: "The 'ing' ending should be clear, not 'in'." },
  { text: 'Despite the difficulties, we managed to finish on time.', level: 'B1', tip: "Emphasize 'de-SPITE' and 'MA-naged'." },
  { text: 'I enjoy reading books about history and science.', level: 'B1', tip: "The 'j' in 'enjoy' — push air through." },
  { text: 'They moved to a new city because of his job.', level: 'B1', tip: "The 'c' in 'city' is soft like 's'." },
  { text: 'We are looking forward to the weekend trip.', level: 'B1', tip: "Phrasal verb stress: 'LOOK-ing for-WARD'." },
  { text: 'He apologized for arriving late to the meeting.', level: 'B1', tip: "Stress 'a-PO-lo-gized' on the second syllable." },
  { text: 'The movie was not as good as I expected.', level: 'B1', tip: "The 'x' in 'expected' sounds like 'ks'." },
  { text: 'I have never travelled abroad on my own before.', level: 'B1', tip: "Clear 'v' in 'travelled' and open vowel in 'abroad'." },
  { text: 'Could you give me some advice on my resume?', level: 'B1', tip: "Pronounce 'ad-VICE' with an unvoiced 's' sound." },
  { text: 'If it rains tomorrow, we will stay at home.', level: 'B1', tip: "First conditional: emphasize condition and result." },
  { text: 'She explained the process very clearly to everyone.', level: 'B1', tip: "Pronounce '-ed' in 'explained' as 'd'." },
  { text: 'I am used to getting up early every day.', level: 'B1', tip: "Pronounce 'used to' as 'yoost to'." },

  // B2 - Ideias abstratas, debates e temas profissionais
  { text: "The instructions were quite straightforward, weren't they?", level: 'B2', tip: 'Tag questions rise at the end for real questions.' },
  { text: 'If I were you, I would reconsider the entire approach.', level: 'B2', tip: "Subjunctive 'were' — don't skip it." },
  { text: 'The committee has decided to postpone the project indefinitely.', level: 'B2', tip: 'Multi-syllable words: give each syllable space.' },
  { text: 'Notwithstanding the evidence, the jury reached a unanimous verdict.', level: 'B2', tip: "Focus on consonant clusters: 'stand', 'ver-dict'." },
  { text: 'The government ought to invest more in renewable energy.', level: 'B2', tip: "The 'gh' in 'ought' is silent." },
  { text: 'It is worth considering the long-term implications.', level: 'B2', tip: "The 'th' in 'worth' — unvoiced, tongue out." },
  { text: 'Her presentation was remarkably insightful and well-structured.', level: 'B2', tip: "Stress 'pre-sen-TA-tion' on the third syllable." },
  { text: 'The outbreak of the pandemic changed everything overnight.', level: 'B2', tip: "The 'p' in 'pandemic' is aspirated (puff of air)." },
  { text: 'We need to foster a culture of innovation and collaboration.', level: 'B2', tip: "The 't' in 'culture' sounds like 'ch'." },
  { text: 'The phenomenon is not as straightforward as it seems.', level: 'B2', tip: "Stress 'phe-NO-me-non' on the second syllable." },
  { text: 'He managed to articulate his arguments with compelling clarity.', level: 'B2', tip: "Stress 'ar-TIC-u-late' and 'com-PEL-ling'." },
  { text: 'The sudden economic downturn took many investors by surprise.', level: 'B2', tip: "Compound noun stress: 'DOWN-turn'." },
  { text: 'She handled the critical feedback with admirable grace and composure.', level: 'B2', tip: "Stress 'AD-mir-a-ble' on the first syllable." },
  { text: 'Environmental sustainability requires collective responsibility.', level: 'B2', tip: "Long words: 'sus-tain-a-BIL-i-ty', 're-spon-si-BIL-i-ty'." },
  { text: 'There is a subtle distinction between confidence and arrogance.', level: 'B2', tip: "The 'b' in 'subtle' is completely silent." },

  // C1 - Tópicos complexos, discurso profissional e nuances avançadas
  { text: 'The pharmaceutical industry has undergone substantial regulatory reforms.', level: 'C1', tip: "Focus on word stress: 'phar-ma-CEU-ti-cal', 're-GU-la-to-ry'." },
  { text: 'Nevertheless, the implications of this socioeconomic phenomenon remain contentious.', level: 'C1', tip: 'Long words: break into syllables and maintain rhythm.' },
  { text: "The government's austerity measures have precipitated widespread public dissent.", level: 'C1', tip: "Consonant clusters: 'stri-ty', 'pre-CI-pi-ta-ted'." },
  { text: 'From a pedagogical standpoint, the curriculum requires a more nuanced approach.', level: 'C1', tip: "Stress: 'pe-da-GO-gi-cal', 'NU-an-ced'." },
  { text: 'The discrepancy between the two reports is quite alarming.', level: 'C1', tip: "Stress 'dis-CRE-pan-cy' on the second syllable." },
  { text: 'The proposed legislation would fundamentally alter the healthcare landscape.', level: 'C1', tip: "The 'g' in 'legislation' sounds like 'j'." },
  { text: 'It is imperative that we address these issues without further delay.', level: 'C1', tip: "Stress 'im-PE-ra-tive' on the second syllable." },
  { text: 'The correlation between diet and cognitive function is well documented.', level: 'C1', tip: "Stress 'cor-re-LA-tion' and 'COG-ni-tive'." },
  { text: 'Her unequivocal stance on the matter surprised many of her colleagues.', level: 'C1', tip: "The 'qu' in 'unequivocal' sounds like 'kw'." },
  { text: 'The unprecedented scale of the challenge requires a coordinated global response.', level: 'C1', tip: "Stress 'un-PRE-ce-den-ted' — five clear syllables." },
  { text: 'The empirical data corroborated our initial scientific hypothesis.', level: 'C1', tip: "Stress 'cor-ROB-o-ra-ted' and 'hy-POTH-e-sis'." },
  { text: 'He displayed an extraordinary capacity for strategic foresight.', level: 'C1', tip: "Pronounce 'ex-TRAOR-di-nar-y' with natural British or American rhythm." },
  { text: 'Public infrastructure projects frequently encounter bureaucratic hurdles.', level: 'C1', tip: "Pronounce 'bu-reau-CRAT-ic' with crisp plosives." },
  { text: 'Her dissertation examines the philosophical underpinnings of ethical dilemmas.', level: 'C1', tip: "Consonant transition: 'un-der-PIN-nings'." },
  { text: 'The technological disruption obsolete traditional manufacturing paradigms.', level: 'C1', tip: "Stress 'tech-no-LOG-i-cal' and 'PAR-a-digms'." },

  // C2 - Altamente abstrato, terminologia especializada e estruturas sofisticadas
  { text: 'The epistemological foundations of postmodernist discourse are inherently paradoxical.', level: 'C2', tip: "Master complex word stress: 'e-pis-te-MO-lo-gi-cal', 'pos-TMO-dern-ist'." },
  { text: 'Notwithstanding the aforementioned caveats, the extrapolation remains justifiable.', level: 'C2', tip: "Smooth linking between long words — don't pause between them." },
  { text: 'The phenomenological approach to research elucidates subjective experiential realities.', level: 'C2', tip: "Natural rhythm: 'phe-no-me-no-LO-gi-cal', 'e-LU-ci-dates'." },
  { text: 'A multidisciplinary synthesis of contemporaneous paradigms proves indispensable.', level: 'C2', tip: 'Intonation patterns in very long sentences — use pitch variation.' },
  { text: 'The quintessence of her argument lies in the ontological distinction she draws.', level: 'C2', tip: "Stress 'quin-TES-sence' and 'on-to-LO-gi-cal'." },
  { text: 'The juxtaposition of these two ideologies creates a fascinating dialectic.', level: 'C2', tip: "Stress 'jux-ta-po-SI-tion' on the fourth syllable." },
  { text: 'Her magnum opus constitutes an invaluable contribution to sociolinguistic theory.', level: 'C2', tip: "Latin phrases: 'MAG-num O-pus' — maintain original pronunciation." },
  { text: 'The Computerized inscrutable nature of the data renders any definitive conclusion untenable.', level: 'C2', tip: "Stress 'in-SCRU-ta-ble' and 'un-TE-na-ble'." },
  { text: 'The proliferation of disinformation necessitates a paradigm shift in media literacy.', level: 'C2', tip: "Stress 'pro-li-fe-RA-tion' — six syllables with clear rhythm." },
  { text: 'An ubiquitous sense of disillusionment permeated the intellectual zeitgeist of the era.', level: 'C2', tip: "Stress 'u-BIQ-ui-tous' and foreign loanword 'ZEIT-geist'." },
  { text: 'Hermeneutic interpretations often oscillate between intentionality and linguistic determinism.', level: 'C2', tip: "Stress 'her-me-NEU-tic' and 'OS-cil-late'." },
  { text: 'The idiosyncratic vernacular of the subculture resisted conventional lexicographical categorization.', level: 'C2', tip: "Stress 'id-i-o-syn-CRAT-ic' and 'lex-i-co-GRAPH-i-cal'." },
  { text: 'Her disquisition on constitutional law exhibited consummate erudition and eloquence.', level: 'C2', tip: "Stress 'dis-qui-SI-tion' and 'CON-sum-mate'." },
  { text: 'Such unmitigated hubris inevitably invites catastrophic geopolitical ramifications.', level: 'C2', tip: "Stress 'un-MIT-i-ga-ted' and 'ram-i-fi-CA-tions'." },
  { text: 'The ostensibly benign rhetoric cloaked deeply entrenched hegemony and subjugation.', level: 'C2', tip: "Stress 'os-TEN-si-bly' and 'he-GEM-o-ny'." },
];

const ACCENTS = [
  { id: 'en-US', flag: 'US', label: 'American', shortLabel: 'US', desc: 'United States' },
  { id: 'en-GB', flag: 'UK', label: 'British', shortLabel: 'UK', desc: 'United Kingdom' },
  { id: 'en-AU', flag: 'AU', label: 'Australian', shortLabel: 'AU', desc: 'Australia' },
  { id: 'en-CA', flag: 'CA', label: 'Canadian', shortLabel: 'CA', desc: 'Canada' },
  { id: 'en-IE', flag: 'IE', label: 'Irish', shortLabel: 'IE', desc: 'Ireland' },
  { id: 'en-IN', flag: 'IN', label: 'Indian', shortLabel: 'IN', desc: 'India' },
  { id: 'en-ZA', flag: 'ZA', label: 'South African', shortLabel: 'ZA', desc: 'South Africa' },
  { id: 'en-NZ', flag: 'NZ', label: 'New Zealand', shortLabel: 'NZ', desc: 'New Zealand' },
  { id: 'en-CN', flag: 'CN', label: 'Chinese', shortLabel: 'CN', desc: 'Chinese English' },
  { id: 'en-KR', flag: 'KR', label: 'Korean', shortLabel: 'KR', desc: 'Korean English' },
];

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const router = useRouter();
const { user, accent: authAccent, setAccent: setAuthAccent } = useAuth();
const logoError = ref(false);

const userLevel = computed(() => {
  const u = user.value as any;
  return u?.level || u?.profile?.level || u?.profile?.cefr_level || 'A1';
});

function getInitialAccent(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tati_voice_accent');
    if (stored && ACCENTS.some((a) => a.id === stored)) return stored;
  }
  const u = user.value as any;
  const profileAccent = u?.preferred_accent || u?.profile?.preferred_accent || u?.profile?.accent || authAccent.value;
  if (profileAccent && ACCENTS.some((a) => a.id === profileAccent)) return profileAccent;
  return 'en-US';
}

const selectedAccent = ref<string>(getInitialAccent());
const isAccentModalOpen = ref(false);

function handleSelectAccent(accId: string) {
  selectedAccent.value = accId;
  try {
    localStorage.setItem('tati_voice_accent', accId);
    window.dispatchEvent(new Event('tati_accent_changed'));
  } catch (_) { }
  if (setAuthAccent) setAuthAccent(accId);
  isAccentModalOpen.value = false;
}

const isRecording = ref(false);
const isEvaluating = ref(false);
const result = ref<PronunciationResult | null>(null);
const selectedWord = ref<WordResult | null>(null);
const isPlayingWord = ref<string | null>(null);
const userAudioUrl = ref<string | null>(null);
const history = ref<{ sentence: string; score: number }[]>([]);

const inputMode = ref<InputMode>('preset');
const customText = ref('');
const recordingError = ref<string | null>(null);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animFrame = 0;
let mediaStream: MediaStream | null = null;
let recordingStart = 0;
let isOperating = false;

function setUserAudioBlobUrl(url: string | null) {
  if (userAudioUrl.value) {
    try {
      URL.revokeObjectURL(userAudioUrl.value);
    } catch (_) { }
  }
  userAudioUrl.value = url;
}

const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Frases de prática estritamente ordenadas do nível mais básico (A1) ao mais avançado (C2)
const allOrderedSentences = computed(() => {
  return [...PRACTICE_SENTENCES].sort((a, b) => {
    return levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
  });
});

// Define o índice inicial correspondente ao nível atual do usuário
const initialLevelIndex = computed(() => {
  const uLevel = userLevel.value;
  const idx = allOrderedSentences.value.findIndex((s) => s.level === uLevel);
  return idx !== -1 ? idx : 0;
});

const currentIndex = ref(0);

// Inicializa currentIndex quando o nível do usuário for carregado
watch(
  userLevel,
  (lvl) => {
    const idx = allOrderedSentences.value.findIndex((s) => s.level === lvl);
    if (idx !== -1 && currentIndex.value === 0) {
      currentIndex.value = idx;
    }
  },
  { immediate: true }
);

const displaySentence = computed(() => {
  const list = allOrderedSentences.value;
  if (!list.length) return PRACTICE_SENTENCES[0];
  const safeIdx = ((currentIndex.value % list.length) + list.length) % list.length;
  return list[safeIdx] || PRACTICE_SENTENCES[0];
});

// Navega em direção ao nível mais fácil/básico (A1)
function goPrev() {
  result.value = null;
  selectedWord.value = null;
  setUserAudioBlobUrl(null);
  const list = allOrderedSentences.value;
  currentIndex.value = (currentIndex.value - 1 + list.length) % list.length;
}

// Navega em direção ao nível mais difícil/avançado (C2)
function goNext() {
  result.value = null;
  selectedWord.value = null;
  setUserAudioBlobUrl(null);
  const list = allOrderedSentences.value;
  currentIndex.value = (currentIndex.value + 1) % list.length;
}

function getActiveText(): string {
  if (inputMode.value === 'custom') return customText.value.trim();
  if (inputMode.value === 'free') return '';
  return displaySentence.value.text;
}

function drawWaveform() {
  if (!analyser || !canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    if (!analyser || !canvasRef.value) return;
    animFrame = requestAnimationFrame(draw);
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
}

async function playReference() {
  const text = getActiveText();
  if (!text) return;
  try {
    const res = await apiPost<any>(ENDPOINTS.CHAT_TTS || '/chat/tts', {
      text,
      accent: selectedAccent.value,
    });
    const audioB64 = res?.data?.audio || res?.audio || res?.audio_b64;
    if (audioB64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioB64}`);
      await audio.play();
    }
  } catch (err) {
    console.error('TTS error:', err);
  }
}

function getSupportedMimeType(): string {
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
}

function cleanupAudioResources() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (_) { }
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (audioContext && audioContext.state !== 'closed') {
    try {
      audioContext.close();
    } catch (_) { }
    audioContext = null;
  }
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = 0;
  }
}

async function startRecording() {
  if (isOperating || isRecording.value) return;
  isOperating = true;

  result.value = null;
  selectedWord.value = null;
  setUserAudioBlobUrl(null);
  recordingError.value = null;

  cleanupAudioResources();

  if (
    typeof window === 'undefined' ||
    !navigator?.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === 'undefined'
  ) {
    recordingError.value =
      'Your browser does not support audio recording. Please use an updated version of Safari, Chrome or Edge.';
    isOperating = false;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStream = stream;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioContext = new AudioCtxClass();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
      }
    } catch (audioCtxErr) {
      console.warn('AudioContext waveform não disponível, continuando gravação:', audioCtxErr);
    }

    const mimeType = getSupportedMimeType();
    const options = mimeType ? { mimeType } : undefined;
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      try {
        if (mediaStream) {
          mediaStream.getTracks().forEach((t) => t.stop());
          mediaStream = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
          try {
            audioContext.close();
          } catch (_) { }
          audioContext = null;
        }
        cancelAnimationFrame(animFrame);

        const elapsed = Date.now() - recordingStart;
        if (elapsed < 1200) {
          recordingError.value = 'Recording too short. Please speak for at least 2 seconds.';
          isRecording.value = false;
          return;
        }

        if (audioChunks.length === 0) {
          recordingError.value = 'No audio data recorded. Please try again.';
          isRecording.value = false;
          return;
        }

        const effectiveMime = mediaRecorder?.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunks, { type: effectiveMime });
        const audioUrl = URL.createObjectURL(blob);
        setUserAudioBlobUrl(audioUrl);

        const arrayBuffer = await blob.arrayBuffer();
        const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));

        const activeText = getActiveText();
        await evaluatePronunciation(base64, activeText);
      } catch (err: any) {
        console.error('Audio processing error:', err);
        recordingError.value = 'Error processing audio. Please try again.';
      } finally {
        isRecording.value = false;
        isOperating = false;
      }
    };

    mediaRecorder.onerror = (e: any) => {
      console.error('MediaRecorder error:', e);
      recordingError.value = 'Recording error occurred. Please check your microphone.';
      isRecording.value = false;
      isOperating = false;
    };

    mediaRecorder.start(250);
    recordingStart = Date.now();
    isRecording.value = true;

    setTimeout(() => {
      if (isRecording.value) drawWaveform();
    }, 50);
  } catch (err: any) {
    console.error('Microphone access error:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      recordingError.value =
        'Microphone access denied. On Mobile Safari / iOS, tap "aA" or the lock icon in the address bar, open Website Settings, and allow Microphone access.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      recordingError.value = 'No microphone found. Please connect or enable your microphone.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      recordingError.value =
        'Microphone is busy or being used by another app. Please close other audio apps and try again.';
    } else {
      recordingError.value = err.message || 'Could not access microphone. Please try again.';
    }
    isRecording.value = false;
  } finally {
    isOperating = false;
  }
}

function stopRecording() {
  cancelAnimationFrame(animFrame);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (stopErr) {
      console.error('Error stopping recorder:', stopErr);
    }
  } else {
    isRecording.value = false;
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }
}

async function evaluatePronunciation(audioBase64: string, referenceText: string) {
  isEvaluating.value = true;
  try {
    const body: Record<string, any> = { audio: audioBase64, accent: selectedAccent.value };
    if (referenceText) {
      body.reference_text = referenceText;
    }
    if (inputMode.value === 'custom') {
      body.mode = 'write';
    }

    const res = await apiPost<any>(ENDPOINTS.SPEECH_VERIFY_PRONUNCIATION, body);
    const rawData: PronunciationResult | null = res?.data ? res.data : res?.score !== undefined ? res : null;

    if (rawData) {
      const data: PronunciationResult = { ...rawData };
      if (data.words && data.words.length > 0) {
        const scores = data.words.map((w) => w.score || 0);
        const avgWord = scores.reduce((acc, s) => acc + s, 0) / scores.length;
        const minWord = Math.min(...scores);
        const allGood = scores.every((s) => s >= 80);

        if ((avgWord >= 85 || allGood) && (data.score < 85 || data.score < minWord || data.score < avgWord)) {
          data.score = Math.round(Math.max(data.score, avgWord) * 10) / 10;
          if (data.metadata) {
            data.metadata.accuracy_score = data.score;
          }
          if (
            data.score >= 85 &&
            data.feedback &&
            /tentativa|ritmo|confusa|cortou|incompleta|esforço/i.test(data.feedback)
          ) {
            data.feedback = 'Excelente pronúncia! Muito clara, natural e bem articulada.';
          }
        }

        if (data.feedback && /cortou|incompleto|incompleta/i.test(data.feedback)) {
          data.feedback = data.feedback.replace(
            /O áudio cortou no final ou a gravação foi incompleta,?\s*(?:mas\s*)?/gi,
            ''
          );
        }
      }

      result.value = data;
      loadPronunciationHistory();
      history.value.push({
        sentence: referenceText || '(free speech)',
        score: data.score,
      });
    } else {
      recordingError.value = 'Evaluation failed. Please try speaking clearly and try again.';
    }
  } catch (err: any) {
    console.error('Pronunciation evaluation error:', err);
    recordingError.value = 'Error evaluating pronunciation. Please check your connection and try again.';
  } finally {
    isEvaluating.value = false;
  }
}

watch(result, (newRes) => {
  if (newRes?.correct_audio) {
    const audio = new Audio(`data:audio/mp3;base64,${newRes.correct_audio}`);
    audio.play().catch((e) => console.warn('Could not auto-play audio:', e));
  }
});

function playCorrectAudio() {
  if (result.value?.correct_audio) {
    const audio = new Audio(`data:audio/mp3;base64,${result.value.correct_audio}`);
    audio.play().catch((e) => console.warn('Could not play correct audio:', e));
  }
}

function playUserAudio() {
  if (userAudioUrl.value) {
    const audio = new Audio(userAudioUrl.value);
    audio.play().catch((e) => console.warn('Could not play user audio:', e));
  }
}

async function playWordAudio(wordToPlay: string) {
  isPlayingWord.value = wordToPlay;
  const clean = wordToPlay.replace(/[^\w\s']/g, '').trim();
  try {
    const res = await apiPost<any>(ENDPOINTS.CHAT_TTS || '/chat/tts', {
      text: clean,
      accent: selectedAccent.value,
    });
    const b64 = res?.data?.audio || res?.data?.audio_b64 || res?.audio || res?.audio_b64;
    if (b64) {
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audio.onended = () => (isPlayingWord.value = null);
      audio.onerror = () => (isPlayingWord.value = null);
      await audio.play();
      return;
    }
  } catch (_) { }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = selectedAccent.value || 'en-US';
    u.rate = 0.85;
    u.onend = () => (isPlayingWord.value = null);
    u.onerror = () => (isPlayingWord.value = null);
    window.speechSynthesis.speak(u);
  } else {
    isPlayingWord.value = null;
  }
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

const wordsNeedingWork = computed(() => {
  if (!result.value?.words) return [];
  return result.value.words.filter((w) => w.tip || w.accuracy !== 'correct');
});

const avgScore = computed(() => {
  if (!history.value.length) return 0;
  return Math.round(history.value.reduce((a, h) => a + h.score, 0) / history.value.length);
});

const currentAccentObj = computed(
  () => ACCENTS.find((a) => a.id === selectedAccent.value) || ACCENTS[0]
);

function handleAccentSync() {
  selectedAccent.value = getInitialAccent();
}


interface SavedHistoryItem {
  id: string;
  target_phrase: string;
  spoken_phrase: string;
  score: number;
  accuracy_score: number;
  words_result: WordResult[];
  feedback: string;
  accent: string;
  mode: string;
  user_audio_b64?: string;
  created_at: string;
}

const savedHistory = ref<SavedHistoryItem[]>([]);
const isLoadingHistory = ref(false);
const isHistorySidebarOpen = ref(true);
const playingHistoryAudioId = ref<string | null>(null);
let historyAudioPlayer: HTMLAudioElement | null = null;
const selectedHistoryModalItem = ref<SavedHistoryItem | null>(null);
const isPlayingTatiReference = ref(false);

function openHistorySummaryModal(item: SavedHistoryItem) {
  selectedHistoryModalItem.value = item;
}

async function playTatiHistoryReference(text: string, accent?: string) {
  if (!text || isPlayingTatiReference.value) return;
  isPlayingTatiReference.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.CHAT_TTS || '/chat/tts', {
      text,
      accent: accent || selectedAccent.value || 'en-US',
    });
    const audioB64 = res?.data?.audio || res?.audio || res?.audio_b64;
    if (audioB64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioB64}`);
      audio.onended = () => { isPlayingTatiReference.value = false; };
      audio.onerror = () => { isPlayingTatiReference.value = false; };
      await audio.play();
    } else {
      isPlayingTatiReference.value = false;
    }
  } catch (err) {
    console.error('Error playing reference audio:', err);
    isPlayingTatiReference.value = false;
  }
}

async function loadPronunciationHistory() {
  isLoadingHistory.value = true;
  try {
    const list = await apiGet<SavedHistoryItem[]>(ENDPOINTS.SPEECH_PRONUNCIATION_HISTORY);
    if (Array.isArray(list)) {
      savedHistory.value = list;
    }
  } catch (err) {
    console.error('Error loading pronunciation history:', err);
  } finally {
    isLoadingHistory.value = false;
  }
}

function playHistoryAudio(item: SavedHistoryItem) {
  if (playingHistoryAudioId.value === item.id) {
    if (historyAudioPlayer) {
      historyAudioPlayer.pause();
      historyAudioPlayer = null;
    }
    playingHistoryAudioId.value = null;
    return;
  }

  if (historyAudioPlayer) {
    historyAudioPlayer.pause();
    historyAudioPlayer = null;
  }

  if (!item.user_audio_b64) return;

  const audioSrc = item.user_audio_b64.startsWith('data:')
    ? item.user_audio_b64
    : `data:audio/webm;base64,${item.user_audio_b64}`;

  historyAudioPlayer = new Audio(audioSrc);
  playingHistoryAudioId.value = item.id;

  historyAudioPlayer.onended = () => {
    playingHistoryAudioId.value = null;
    historyAudioPlayer = null;
  };

  historyAudioPlayer.onerror = () => {
    playingHistoryAudioId.value = null;
    historyAudioPlayer = null;
  };

  historyAudioPlayer.play().catch(() => {
    playingHistoryAudioId.value = null;
    historyAudioPlayer = null;
  });
}

function handleRetrySentence(item: SavedHistoryItem) {
  result.value = null;
  selectedWord.value = null;
  setUserAudioBlobUrl(null);
  selectedHistoryModalItem.value = null;

  // Frase a ser praticada novamente
  const phraseToPractice = (item.target_phrase || item.spoken_phrase || '').trim();
  customText.value = phraseToPractice;

  const foundIndex = allOrderedSentences.value.findIndex(
    (s) => s.text.trim().toLowerCase() === phraseToPractice.toLowerCase()
  );

  if (foundIndex !== -1 && item.mode !== 'custom' && item.mode !== 'free') {
    inputMode.value = 'preset';
    currentIndex.value = foundIndex;
  } else {
    inputMode.value = 'custom';
  }

  if (window.innerWidth < 1024) {
    isHistorySidebarOpen.value = false;
  }
}

onMounted(() => {
  loadPronunciationHistory();
  window.addEventListener('tati_accent_changed', handleAccentSync);
  window.addEventListener('storage', handleAccentSync);
});

onUnmounted(() => {
  window.removeEventListener('tati_accent_changed', handleAccentSync);
  window.removeEventListener('storage', handleAccentSync);
  cleanupAudioResources();
  setUserAudioBlobUrl(null);
});
</script>

<template>
  <div class="h-screen bg-bg flex flex-col overflow-hidden">
    <!-- Cabeçalho -->
    <header class="border-b border-border bg-bg-secondary/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
      <button type="button" @click="router.back()"
        class="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text">
        <ArrowLeft :size="20" />
      </button>

      <div class="flex-1">
        <h1 class="text-lg font-bold text-text flex items-center gap-2">
          <BookOpen :size="20" class="text-primary" />
          Pronunciation Reader
        </h1>
        <p class="text-xs text-text-muted">Read aloud, write your own text, or just speak freely</p>
      </div>

      <!-- Botão seletor de sotaque -->
      <button type="button" @click="isAccentModalOpen = true"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all shadow-sm active:scale-95 shrink-0"
        title="Change Teacher Tati's accent">
        <span
          class="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{{
            currentAccentObj.shortLabel }}</span>
        <span class="hidden sm:inline">{{ currentAccentObj.shortLabel }}</span>
        <Globe :size="13" class="text-text-muted ml-0.5" />
      </button>

      <div v-if="history.length > 0" class="text-right hidden sm:block">
        <div :class="['text-lg font-bold', scoreColor(avgScore)]">{{ avgScore }}%</div>
        <div class="text-[0.6rem] text-text-muted">Avg. Score</div>
      </div>

      <!-- Botão para alternar painel lateral de histórico -->
      <button type="button" @click="isHistorySidebarOpen = !isHistorySidebarOpen"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95"
        :class="isHistorySidebarOpen ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-surface border-border text-text hover:border-primary/40'"
        title="Toggle practice history">
        <History :size="15" />
        <span class="hidden md:inline">History</span>
        <span v-if="savedHistory.length" class="px-1.5 py-0.2 rounded-full text-[0.65rem] font-black"
          :class="isHistorySidebarOpen ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'">
          {{ savedHistory.length }}
        </span>
      </button>
    </header>

    <div class="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
      <!-- Painel principal de gravação e leitura -->
      <div class="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto custom-scrollbar w-full">
        <div class="w-full max-w-2xl space-y-4">
          <!-- Seletor do modo de entrada -->
          <div class="flex gap-2 mb-3 w-full">
            <button type="button" @click="inputMode = 'preset'" :class="[
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'preset'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover',
            ]">
              <BookOpen :size="14" />
              Preset Sentences
            </button>

            <button type="button" @click="inputMode = 'custom'" :class="[
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'custom'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover',
            ]">
              <PenLine :size="14" />
              Write Your Own
            </button>

            <button type="button" @click="inputMode = 'free'" :class="[
              'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all',
              inputMode === 'free'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-surface border border-border text-text-muted hover:bg-surface-hover',
            ]">
              <MessageSquare :size="14" />
              Free Speech
            </button>
          </div>

          <!-- Barra de sotaques -->
          <div class="w-full flex items-center justify-between gap-2 mb-5 px-1 overflow-x-hidden">
            <span
              class="text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Globe :size="12" class="text-primary" />
              Accent:
            </span>
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
              <button v-for="acc in ACCENTS.slice(0, 5)" :key="acc.id" type="button" @click="handleSelectAccent(acc.id)"
                :class="[
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shrink-0 active:scale-95 cursor-pointer',
                  acc.id === selectedAccent
                    ? 'bg-primary text-white shadow-sm shadow-primary/30'
                    : 'bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30',
                ]" :title="acc.desc">
                <span class="text-[9px] font-black tracking-wider uppercase">{{ acc.shortLabel }}</span>
              </button>

              <button type="button" @click="isAccentModalOpen = true"
                class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface border border-border text-primary hover:bg-surface-hover shrink-0 cursor-pointer"
                title="View all accents">
                More...
              </button>
            </div>
          </div>

          <!-- Cartão de frase / Entrada personalizada / Fala livre -->
          <template v-if="inputMode === 'preset'">
            <div :class="[
              'px-3 py-1 rounded-full text-xs font-bold mb-6',
              displaySentence.level === 'A1'
                ? 'bg-green-500/20 text-green-400'
                : displaySentence.level === 'A2'
                  ? 'bg-green-500/15 text-green-300'
                  : displaySentence.level === 'B1'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400',
            ]">
              {{ displaySentence.level }}
            </div>

            <div class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
              <p class="text-xl md:text-2xl font-display font-bold text-text leading-relaxed mb-4">
                {{ displaySentence.text }}
              </p>
              <p class="text-xs text-text-muted italic">
                <span class="text-primary font-bold mr-1">Tip:</span>{{ displaySentence.tip }}
              </p>
            </div>
          </template>

          <div v-else-if="inputMode === 'custom'"
            class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6">
            <label class="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 block">
              Type or paste the text you want to practice
            </label>
            <textarea v-model="customText" placeholder="e.g. The quick brown fox jumps over the lazy dog..."
              class="w-full h-32 bg-bg border border-border rounded-xl p-4 text-text text-base resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              maxlength="500" />
            <div class="flex justify-between items-center mt-2">
              <p class="text-[0.65rem] text-text-muted">{{ customText.length }}/500 characters</p>
              <button v-if="customText.trim()" type="button" @click="customText = ''"
                class="text-[0.65rem] text-primary hover:underline">
                Clear
              </button>
            </div>
          </div>

          <div v-else class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
            <div
              class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <MessageSquare :size="28" />
            </div>
            <p class="text-lg font-bold text-text mb-2">Free Speech Mode</p>
            <p class="text-sm text-text-muted">
              Just tap the microphone and speak naturally. Tati will transcribe and analyze your pronunciation.
            </p>
          </div>

          <!-- Controles principais -->
          <div class="w-full flex items-center justify-center gap-4 mb-6">
            <button v-if="inputMode === 'preset'" type="button" @click="goPrev"
              class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text">
              <ChevronLeft :size="20" />
            </button>

            <button type="button" @click="playReference" :disabled="!getActiveText() || isRecording || isEvaluating"
              :class="[
                'p-4 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-primary',
                (!getActiveText() || isRecording || isEvaluating) && 'opacity-40 cursor-not-allowed',
              ]">
              <Volume2 :size="24" />
            </button>

            <button type="button" @click="isRecording ? stopRecording() : startRecording()" :disabled="isEvaluating"
              :class="[
                'p-5 rounded-full shadow-lg transition-all duration-300',
                isRecording
                  ? 'bg-red-500 shadow-red-500/30 animate-pulse scale-110'
                  : 'bg-primary shadow-primary/20 hover:scale-105 active:scale-95',
                isEvaluating && 'opacity-50 cursor-not-allowed',
              ]">
              <Square v-if="isRecording" :size="28" class="text-white" />
              <Mic v-else :size="28" class="text-white" />
            </button>

            <button type="button" @click="
              result = null;
            recordingError = null;
            " class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text">
              <RotateCcw :size="20" />
            </button>

            <button v-if="inputMode === 'preset'" type="button" @click="goNext"
              class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text">
              <ChevronRight :size="20" />
            </button>
          </div>

          <!-- Indicador de gravação -->
          <div v-if="isRecording" class="mb-4 flex flex-col items-center animate-fade-in">
            <div class="flex items-center gap-2 text-red-400 text-sm font-bold">
              <div class="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Recording — speak now...
            </div>
            <canvas ref="canvasRef" width="300" height="60" class="mt-2 rounded-lg" />
          </div>

          <!-- Erro de gravação -->
          <div v-if="recordingError" class="mb-4 w-full animate-fade-in">
            <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 text-center">
              {{ recordingError }}
            </div>
          </div>

          <!-- Indicador de avaliação -->
          <div v-if="isEvaluating" class="mb-4 flex items-center gap-2 text-primary text-sm animate-fade-in">
            <Sparkles :size="16" class="animate-spin" />
            Analyzing your pronunciation...
          </div>

          <!-- Resultados da pronúncia -->
          <div v-if="result" class="w-full animate-fade-in">
            <div class="bg-surface border border-border rounded-2xl p-6 space-y-4">
              <!-- Pontuação geral -->
              <div class="text-center">
                <div :class="['text-5xl font-black', scoreColor(result.score)]">
                  {{ result.score }}%
                </div>
                <p class="text-xs text-text-subtle mt-1 font-medium">
                  {{
                    result.score >= 85
                      ? 'Excellent articulation and clarity!'
                      : result.score >= 60
                        ? 'Good effort! Focus on the highlighted sounds.'
                        : "Let's practice again listening to Teacher Tati."
                  }}
                </p>
              </div>

              <!-- Player Comparativo: Sua Voz vs Teacher Tati -->
              <div class="grid grid-cols-2 gap-3 pt-1">
                <button type="button" @click="playUserAudio" :disabled="!userAudioUrl"
                  class="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed text-primary rounded-xl text-xs font-bold transition-all">
                  <Volume2 :size="16" />
                  Listen to your own voice
                </button>
                <button type="button" @click="playCorrectAudio" :disabled="!result.correct_audio"
                  class="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-all">
                  <Volume2 :size="16" />
                  Teacher Tati
                </button>
              </div>

              <!-- Frase sugerida pela Teacher Tati -->
              <div v-if="result.suggested_sentence"
                class="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex flex-col gap-1.5 text-left">
                <div class="flex items-center justify-between">
                  <span
                    class="text-[0.68rem] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles :size="13" />
                    Teacher Tati's natural suggestion:
                  </span>
                  <button v-if="result.correct_audio" type="button" @click="playCorrectAudio"
                    class="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors">
                    <Volume2 :size="13" />
                    Listen to sentence
                  </button>
                </div>
                <p class="text-xs md:text-sm font-semibold text-text leading-relaxed">
                  &ldquo;{{ result.suggested_sentence }}&rdquo;
                </p>
              </div>

              <!-- Card da Teacher Tati's Tip em Português -->
              <div v-if="result.pedagogical_tip"
                class="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col gap-3 text-left">
                <div class="flex items-start gap-3">
                  <div
                    class="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5 bg-primary text-white font-black flex items-center justify-center">
                    <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati"
                      class="w-full h-full object-cover" @error="logoError = true" />
                    <span v-else class="text-xs">T</span>
                  </div>
                  <div class="space-y-1">
                    <p class="text-[0.7rem] font-bold text-primary uppercase tracking-wider">
                      Teacher Tati's Tip
                    </p>
                    <p class="text-xs md:text-sm text-text leading-relaxed">
                      {{ result.pedagogical_tip }}
                    </p>
                  </div>
                </div>

                <!-- Lista com TODAS as palavras com atenção ou erro -->
                <div v-if="wordsNeedingWork.length > 0" class="pt-3 border-t border-primary/20 space-y-2">
                  <p class="text-[0.68rem] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles :size="13" />
                    Focus areas:
                  </p>
                  <div class="space-y-1.5">
                    <button v-for="(w, idx) in wordsNeedingWork" :key="idx" type="button" @click="selectedWord = w"
                      class="w-full text-left flex items-start gap-2.5 p-2 rounded-xl bg-surface/70 hover:bg-surface border border-border/70 hover:border-primary/50 transition-all text-xs group">
                      <span :class="[
                        'font-bold shrink-0 px-2 py-0.5 rounded text-[0.7rem] font-mono',
                        w.accuracy === 'needs_work'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30',
                      ]">
                        {{ w.word }}
                      </span>
                      <span class="text-text-muted group-hover:text-text leading-relaxed flex-1">
                        {{ w.tip || 'Adjust the pronunciation of this word.' }}
                      </span>
                      <span
                        class="text-[0.65rem] text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        Details →
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Feedback geral -->
              <div v-if="result.feedback" class="bg-surface-hover/50 border border-border rounded-2xl p-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles :size="16" class="text-primary" />
                  </div>
                  <div>
                    <p class="text-xs text-text-subtle font-semibold uppercase tracking-wider mb-0.5">
                      General Feedback
                    </p>
                    <p class="text-sm text-text leading-relaxed italic">&quot;{{ result.feedback }}&quot;</p>
                  </div>
                </div>
              </div>

              <!-- Detalhamento palavra por palavra -->
              <div v-if="result.words && result.words.length > 0">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-xs font-bold text-text-subtle uppercase tracking-wider">Word-by-Word</h3>
                  <span class="text-[0.65rem] text-text-muted">Tap word to see phonetic tip</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="(w, i) in result.words" :key="i" type="button" @click="selectedWord = w" :class="[
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm',
                    w.accuracy === 'correct'
                      ? 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                      : w.accuracy === 'needs_work'
                        ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-1 ring-amber-500/20'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 line-through',
                  ]">
                    <span class="font-bold">{{ w.word }}</span>
                    <span class="text-[0.65rem] opacity-75 font-sans">{{ Math.round(w.score) }}%</span>
                    <span v-if="w.tip" class="text-[0.65rem] text-amber-500 font-bold">*</span>
                  </button>
                </div>
              </div>

              <!-- Transcrição do que foi falado -->
              <div v-if="result.transcription">
                <h3 class="text-xs font-bold text-text-subtle uppercase tracking-wider mb-1">
                  What Tati heard
                </h3>
                <p class="text-sm text-text italic">&quot;{{ result.transcription }}&quot;</p>
              </div>

              <!-- Metadados de pontuação -->
              <div v-if="result.metadata" class="grid grid-cols-3 gap-2">
                <div v-if="result.metadata.accuracy_score != null" class="text-center p-2 bg-bg rounded-lg">
                  <div class="text-sm font-bold text-text">{{ Math.round(result.metadata.accuracy_score) }}%</div>
                  <div class="text-[0.6rem] text-text-muted">Accuracy</div>
                </div>
                <div v-if="result.metadata.fluency_score != null" class="text-center p-2 bg-bg rounded-lg">
                  <div class="text-sm font-bold text-text">{{ Math.round(result.metadata.fluency_score) }}%</div>
                  <div class="text-[0.6rem] text-text-muted">Fluency</div>
                </div>
                <div v-if="result.metadata.completeness_score != null" class="text-center p-2 bg-bg rounded-lg">
                  <div class="text-sm font-bold text-text">{{ Math.round(result.metadata.completeness_score) }}%</div>
                  <div class="text-[0.6rem] text-text-muted">Completeness</div>
                </div>
              </div>

              <!-- Provedor de análise fonética -->
              <div v-if="result.phonetic?.provider" class="text-[0.65rem] text-text-muted">
                Phonetic provider: {{ result.phonetic.provider }}
              </div><div class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto custom-scrollbar w-full"></div>
            </div>
          </div>

          <!-- Fim do painel de conteúdo -->
        </div>
      </div>

      <!-- Barra lateral fixa / gaveta de histórico de pronúncia -->
      <aside v-if="isHistorySidebarOpen"
        class="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-bg-secondary/30 backdrop-blur-sm flex flex-col h-auto lg:h-full shrink-0 transition-all shadow-2xl">
        <!-- Topo da barra lateral -->
        <div class="p-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/60">
          <div class="flex items-center gap-2">
            <History :size="16" class="text-primary" />
            <h3 class="font-bold text-sm text-text">Practice History & Audio</h3>
            <span v-if="savedHistory.length"
              class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-primary/10 text-primary border border-primary/20">
              {{ savedHistory.length }}
            </span>
          </div>
          <button type="button" @click="isHistorySidebarOpen = false"
            class="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface" title="Close panel">
            <X :size="16" />
          </button>
        </div>

        <!-- Lista de treinos anteriores -->
        <div class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          <div v-if="isLoadingHistory" class="py-8 text-center text-xs text-text-muted">
            <RotateCcw :size="18" class="animate-spin mx-auto mb-2 text-primary" />
            Loading history...
          </div>

          <div v-else-if="savedHistory.length === 0"
            class="py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 text-text-muted text-xs space-y-1">
            <p class="font-bold text-text">No practice recorded yet</p>
            <p class="text-[0.7rem]">Record your pronunciation to start tracking your progress and listen to your
              recordings.
            </p>
          </div>

          <!-- Card de cada prática do histórico -->
          <div v-for="item in savedHistory" :key="item.id" @click="openHistorySummaryModal(item)"
            class="p-5.5 bg-surface border border-border/80 rounded-2xl space-y-2.5 transition-all hover:border-primary/50 hover:bg-surface-hover/30 shadow-xs cursor-pointer group">
            <!-- Topo do card: frase e nota -->
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p
                  class="font-bold text-xs text-text leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {{ item.target_phrase || item.spoken_phrase }}
                </p>
                <p v-if="item.spoken_phrase && item.spoken_phrase.toLowerCase() !== item.target_phrase.toLowerCase()"
                  class="text-[0.68rem] text-text-muted mt-0.5 line-clamp-1 italic">
                  You said: "{{ item.spoken_phrase }}"
                </p>
              </div>
              <span :class="[
                'px-2 py-0.5 rounded-full text-xs font-black shrink-0',
                item.score >= 80 ? 'bg-success/15 text-success border border-success/30' : item.score >= 60 ? 'bg-warning/15 text-warning border border-warning/30' : 'bg-destructive/15 text-destructive border border-destructive/30'
              ]">
                {{ Math.round(item.score) }}%
              </span>
            </div>

            <!-- Palavras avaliadas com destaque de erros -->
            <div v-if="item.words_result?.length" class="flex flex-wrap gap-1">
              <span v-for="(w, wIdx) in item.words_result" :key="wIdx" :class="[
                'text-[0.65rem] px-1.5 py-0.5 rounded font-medium border',
                w.accuracy === 'correct'
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-destructive/15 text-destructive border-destructive/30 font-bold'
              ]" :title="w.tip || ''">
                {{ w.word }}
              </span>
            </div>

            <!-- Feedback da Professora Tatiana -->
            <div v-if="item.feedback"
              class="text-[0.68rem] text-text-muted bg-bg-secondary/60 p-2 rounded-xl border border-border/40 leading-relaxed">
              {{ item.feedback }}
            </div>

            <!-- Barra de ações: ouvir áudio do aluno e refazer frase -->
            <div class="pt-2 border-t border-border/40 flex items-center justify-between gap-2" @click.stop>
              <div class="flex items-center gap-1.5">
                <!-- Botão de ouvir gravação do aluno -->
                <button v-if="item.user_audio_b64" type="button" @click.stop="playHistoryAudio(item)"
                  class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.65rem] font-bold border transition-all active:scale-95 cursor-pointer"
                  :class="playingHistoryAudioId === item.id ? 'bg-primary text-white border-primary' : 'bg-surface hover:bg-surface-hover border-border text-text'"
                  title="Listen to your recorded audio">
                  <Pause v-if="playingHistoryAudioId === item.id" :size="12" />
                  <Play v-else :size="12" />
                  <span>{{ playingHistoryAudioId === item.id ? 'Pause' : 'My Audio' }}</span>
                </button>

                <!-- Data e hora formatadas -->
                <span class="text-[0.6rem] text-text-muted">
                  {{ new Date(item.created_at).toLocaleDateString() }} {{ new
                    Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit' }) }}
                </span>
              </div>

              <!-- Botão de refazer frase -->
              <button type="button" @click.stop="handleRetrySentence(item)"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[0.65rem] font-bold transition-all active:scale-95 cursor-pointer"
                title="Load this sentence to practice again">
                <RotateCcw :size="11" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Modal de fonética da palavra -->
    <Teleport to="body">
      <div v-if="selectedWord"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="selectedWord = null">
        <div @click.stop
          class="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-5 shadow-2xl space-y-4">
          <!-- Cabeçalho do modal -->
          <div class="flex items-center justify-between border-b border-border/60 pb-3">
            <div class="flex items-center gap-2.5">
              <span class="text-2xl font-black text-text font-mono tracking-tight">
                {{ selectedWord.word }}
              </span>
              <span :class="[
                'px-2.5 py-0.5 rounded-full text-xs font-bold font-sans',
                selectedWord.accuracy === 'correct'
                  ? 'bg-green-500/15 text-green-500 border border-green-500/30'
                  : selectedWord.accuracy === 'needs_work'
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-red-500/15 text-red-500 border border-red-500/30',
              ]">
                {{ Math.round(selectedWord.score) }}%
              </span>
            </div>
            <button type="button" @click="selectedWord = null"
              class="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
              aria-label="Close">
              <X :size="18" />
            </button>
          </div>

          <!-- Status da pronúncia -->
          <div class="flex items-center gap-2 text-xs font-semibold">
            <span v-if="selectedWord.accuracy === 'correct'" class="flex items-center gap-1.5 text-green-500">
              <CheckCircle2 :size="16" /> Natural and clear pronunciation
            </span>
            <span v-else-if="selectedWord.accuracy === 'needs_work'" class="flex items-center gap-1.5 text-amber-500">
              <Sparkles :size="16" /> Understandable, but has accent
            </span>
            <span v-else class="flex items-center gap-1.5 text-red-500">
              <XCircle :size="16" /> Inaccurate or missing sound
            </span>
          </div>

          <!-- Dica pedagógica para a palavra -->
          <div v-if="selectedWord.tip"
            class="p-3.5 bg-primary/10 border border-primary/25 rounded-2xl flex items-start gap-3 text-left">
            <div
              class="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5 bg-primary text-white font-black flex items-center justify-center">
              <img v-if="!logoError" src="/images/tati_logo.jpg" alt="Teacher Tati" class="w-full h-full object-cover"
                @error="logoError = true" />
              <span v-else class="text-xs">T</span>
            </div>
            <div class="space-y-1">
              <p class="text-[0.68rem] font-bold text-primary uppercase tracking-wider">
                Teacher Tati's Tip
              </p>
              <p class="text-xs text-text leading-relaxed font-medium">
                {{ selectedWord.tip }}
              </p>
            </div>
          </div>

          <div v-else-if="selectedWord.accuracy === 'correct'"
            class="p-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-xs text-text-muted leading-relaxed">
            Perfect! You articulated this word with precision and clarity.
          </div>

          <!-- Botão de ouvir pronúncia da palavra -->
          <button type="button" @click="playWordAudio(selectedWord.word)"
            :disabled="isPlayingWord === selectedWord.word"
            class="w-full py-2.5 px-4 bg-primary hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer">
            <Volume2 :size="16" :class="isPlayingWord === selectedWord.word ? 'animate-pulse' : ''" />
            {{
              isPlayingWord === selectedWord.word
                ? 'Playing pronunciation...'
                : `Listen to pronunciation of "${selectedWord.word}"`
            }}
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Modal de seleção de sotaque -->
    <Teleport to="body">
      <div v-if="isAccentModalOpen"
        class="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 animate-fade-in">
        <div class="fixed inset-0 cursor-pointer" @click="isAccentModalOpen = false" />
        <div
          class="relative w-full sm:max-w-md bg-white dark:bg-[#111322] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[85vh] flex flex-col space-y-4">
          <div class="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
            <div class="space-y-0.5">
              <h3 class="text-base sm:text-lg font-black text-text flex items-center gap-2">
                <Globe :size="18" class="text-primary" /> English Accents (Edge TTS)
              </h3>
              <p class="text-xs text-text-muted">Teacher Tati will practice with the selected accent</p>
            </div>
            <button type="button" @click="isAccentModalOpen = false"
              class="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer">
              <X :size="18" />
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1">
            <button v-for="acc in ACCENTS" :key="acc.id" type="button" @click="handleSelectAccent(acc.id)" :class="[
              'flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer',
              acc.id === selectedAccent
                ? 'bg-primary/10 border-primary shadow-sm text-primary ring-1 ring-primary/40 font-bold'
                : 'bg-surface border-border hover:border-primary/40 text-text',
            ]">
              <span
                class="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 font-black text-xs flex items-center justify-center shrink-0">{{
                  acc.shortLabel }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold truncate">{{ acc.label }}</p>
                <p class="text-[0.65rem] text-text-muted truncate">{{ acc.desc }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- Modal de Resumo de Prática Anterior do Histórico -->
    <Teleport to="body">
      <div v-if="selectedHistoryModalItem"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
        @click="selectedHistoryModalItem = null">
        <div @click.stop
          class="relative w-full max-w-lg bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <!-- Cabeçalho do modal -->
          <div class="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 class="text-base font-bold text-text flex items-center gap-2">
                <Sparkles :size="18" class="text-primary" />
                Pronunciation Summary
              </h3>
              <p class="text-xs text-text-muted mt-0.5">
                {{ new Date(selectedHistoryModalItem.created_at).toLocaleDateString() }} {{ new
                  Date(selectedHistoryModalItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }}
              </p>
            </div>
            <button type="button" @click="selectedHistoryModalItem = null"
              class="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer"
              aria-label="Close">
              <X :size="18" />
            </button>
          </div>

          <!-- Nota e Status Geral -->
          <div class="flex items-center justify-between p-4 rounded-2xl bg-bg-secondary/40 border border-border">
            <div>
              <div class="text-[0.68rem] font-bold text-text-muted uppercase tracking-wider">Overall Score</div>
              <div :class="['text-3xl font-black mt-0.5', scoreColor(selectedHistoryModalItem.score)]">
                {{ Math.round(selectedHistoryModalItem.score) }}%
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {{ selectedHistoryModalItem.mode.toUpperCase() }} MODE
              </span>
              <span
                class="text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface border border-border text-text-muted">
                {{ selectedHistoryModalItem.accent }}
              </span>
            </div>
          </div>

          <!-- Comparativo: Frase Correta vs O Que o Aluno Falou -->
          <div class="space-y-3">
            <!-- Frase Correta (Target) -->
            <div class="p-3.5 bg-green-500/10 border border-green-500/25 rounded-2xl space-y-2">
              <div class="flex items-center justify-between">
                <span
                  class="text-[0.68rem] font-bold text-green-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 :size="13" />
                  Target Sentence (Correct)
                </span>
                <button type="button"
                  @click="playTatiHistoryReference(selectedHistoryModalItem.target_phrase, selectedHistoryModalItem.accent)"
                  :disabled="isPlayingTatiReference"
                  class="text-xs text-green-600 dark:text-green-400 hover:opacity-80 font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50">
                  <Volume2 :size="13" />
                  {{ isPlayingTatiReference ? 'Playing...' : 'Teacher Tati' }}
                </button>
              </div>
              <p class="text-sm font-semibold text-text leading-relaxed">
                {{ selectedHistoryModalItem.target_phrase || selectedHistoryModalItem.spoken_phrase }}
              </p>
            </div>

            <!-- Frase Falada pelo Aluno (Spoken) -->
            <div class="p-3.5 bg-primary/10 border border-primary/25 rounded-2xl space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[0.68rem] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Mic :size="13" />
                  What You Said
                </span>
                <button v-if="selectedHistoryModalItem.user_audio_b64" type="button"
                  @click="playHistoryAudio(selectedHistoryModalItem)"
                  class="text-xs text-primary hover:opacity-80 font-bold flex items-center gap-1 transition-all cursor-pointer">
                  <Volume2 :size="13" />
                  {{ playingHistoryAudioId === selectedHistoryModalItem.id ? 'Pause' : 'Listen to Your Audio' }}
                </button>
              </div>
              <p class="text-sm text-text italic leading-relaxed">
                "{{ selectedHistoryModalItem.spoken_phrase || selectedHistoryModalItem.target_phrase }}"
              </p>
            </div>
          </div>

          <!-- Palavras Avaliadas com Destaque -->
          <div v-if="selectedHistoryModalItem.words_result?.length" class="space-y-2">
            <h4 class="text-xs font-bold text-text-subtle uppercase tracking-wider">
              Word-by-Word Analysis
            </h4>
            <div class="flex flex-wrap gap-2">
              <div v-for="(w, idx) in selectedHistoryModalItem.words_result" :key="idx" :class="[
                'px-2.5 py-1 rounded-xl text-xs font-mono border flex items-center gap-1.5',
                w.accuracy === 'correct'
                  ? 'bg-green-500/10 text-green-500 border-green-500/25'
                  : w.accuracy === 'needs_work'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                    : 'bg-red-500/10 text-red-500 border-red-500/30 line-through'
              ]">
                <span class="font-bold">{{ w.word }}</span>
                <span v-if="w.score != null" class="text-[0.65rem] opacity-75 font-sans">
                  {{ Math.round(w.score) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Feedback da Professora Tatiana -->
          <div v-if="selectedHistoryModalItem.feedback"
            class="p-3.5 bg-surface-hover/60 border border-border rounded-2xl space-y-1">
            <p class="text-[0.68rem] font-bold text-text-subtle uppercase tracking-wider">Teacher Tati's Feedback</p>
            <p class="text-xs text-text leading-relaxed italic">
              "{{ selectedHistoryModalItem.feedback }}"
            </p>
          </div>

          <!-- Botões de Ação do Modal -->
          <div class="pt-3 border-t border-border/60 flex items-center justify-end gap-3">
            <button type="button" @click="selectedHistoryModalItem = null"
              class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
              Close
            </button>
            <button type="button" @click="handleRetrySentence(selectedHistoryModalItem)"
              class="px-5 py-2 rounded-xl bg-primary hover:opacity-95 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer">
              <RotateCcw :size="14" />
              <span>Retry This Sentence</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
