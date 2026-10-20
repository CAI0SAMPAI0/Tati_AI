export const ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_GOOGLE: '/auth/google',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',

  // Profile
  PROFILE: '/profile',

  // Permissions
  ACCESS_CONTROL: '/users/permissions/access',

  // Progress & Gamification
  PROGRESS: '/users/progress',
  STREAK: '/users/streak',
  XP: '/users/xp',
  GOALS: '/users/goals',
  VOCABULARY: '/users/vocabulary',
  VOCABULARY_DUE: '/users/vocabulary/due',

  // Chat
  CONVERSATIONS: '/chat/conversations',
  CONVERSATION_MESSAGES: (id: string) => `/chat/conversations/${id}/messages`,
  EDIT_MESSAGE: (convId: string, msgId: string) => `/chat/conversations/${convId}/messages/${msgId}`,
  CONVERSATION_SUMMARY: (id: string) => `/chat/conversations/${id}/summary`,
  CHAT_TTS: '/chat/tts',
  CHAT_WS: '/chat/ws',
  LEVELING_START: '/chat/leveling/start',
  LEVELING_STATUS: '/chat/leveling/status',
  LEVELING_FINISH: '/chat/leveling/finish',

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',
  NOTIFICATIONS_FEEDBACK: '/notifications/feedback',

  // Speech & Pronunciation
  SPEECH_VERIFY_PRONUNCIATION: '/speech/verify-pronunciation',

  // Activities
  ACTIVITIES_MODULES: '/activities/flashcards/my',
  ACTIVITIES_RANKING: '/activities/ranking',
  ACTIVITIES_GAMES: '/activities/games',
  ACTIVITIES_NEWS: '/activities/news',
  ACTIVITIES_MUSICS: '/activities/musics',
  ACTIVITIES_PODCASTS_WARMUP: '/activities/podcasts/warmup',
  ACTIVITIES_PODCASTS_RECOMMENDATIONS: '/activities/podcasts/recommendations',
  ACTIVITIES_PODCAST_DETAIL: (id: string) => `/activities/podcasts/${id}`,

  // Trimestral Exams
  EXAMS_TRIMESTRAL_STATUS: '/exams/trimestral/status',
  EXAMS_TRIMESTRAL_START: '/exams/trimestral/start',
  EXAMS_TRIMESTRAL_CURRENT: '/exams/trimestral/current',
  EXAMS_TRIMESTRAL_SUBMIT: '/exams/trimestral/submit',
  EXAMS_TRIMESTRAL_HISTORY: '/exams/trimestral/history',
  EXAMS_TRIMESTRAL_RESET: '/exams/trimestral/reset',

  // Admin & Dashboard
  ADMIN_STUDENTS: '/dashboard/students',
  ADMIN_SIMULATIONS: '/dashboard/simulations',
} as const;
