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

  // Onboarding
  ONBOARDING: '/users/onboarding',

  // Weekly plan
  WEEKLY_PLAN: '/users/weekly-plan',
  WEEKLY_PLAN_TRANSITION: '/users/weekly-plan/transition',

  // Progress & Gamification
  PROGRESS: '/users/progress',
  PROGRESS_WEEKLY: '/users/progress/reports/weekly',
  PROGRESS_MONTHLY: '/users/progress/reports/monthly',
  PROGRESS_WEEKLY_PLAN: '/users/progress/weekly-plan',
  PROGRESS_WEEKLY_PLAN_PROGRESS: '/users/progress/weekly-plan/progress',
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
  CHAT_MESSAGE: '/chat/message',
  CHAT_DOWNLOAD_REPORT: '/chat/download_report',
  CHAT_TTS: '/chat/tts',
  CHAT_WS: '/chat/ws',
  LEVELING_START: '/chat/leveling/start',
  LEVELING_STATUS: '/chat/leveling/status',
  LEVELING_FINISH: '/chat/leveling/finish',
  LEVELING_PUBLIC_START: '/chat/leveling/public/start',
  LEVELING_PUBLIC_STEP: '/chat/leveling/public/step',
  LEVELING_PUBLIC_SUBMIT: '/chat/leveling/public/submit',
  WORD_LOOKUP: '/chat/word-lookup',

  // Avatar
  AVATAR_FRAMES: '/avatar/frames',

  // Payments
  PAYMENTS_SUBSCRIBE: '/payments/subscribe',
  PAYMENTS_STATUS: '/payments/status',

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',
  NOTIFICATIONS_FEEDBACK: '/notifications/feedback',

  // Speech & Pronunciation
  SPEECH_VERIFY_PRONUNCIATION: '/speech/verify-pronunciation',
  SPEECH_PRONUNCIATION_HISTORY: '/speech/pronunciation-history',

  // Activities
  ACTIVITIES_MODULES: '/activities/flashcards/my',
  ACTIVITIES_RANKING: '/activities/ranking',
  ACTIVITIES_GAMES: '/activities/games',
  ACTIVITIES_NEWS: '/activities/news',
  ACTIVITIES_MUSICS: '/activities/musics',
  ACTIVITIES_PODCASTS_WARMUP: '/activities/podcasts/warmup',
  ACTIVITIES_PODCASTS_RECOMMENDATIONS: '/activities/podcasts/recommendations',
  ACTIVITIES_PODCAST_DETAIL: (id: string) => `/activities/podcasts/${id}`,
  ACTIVITIES_PODCASTS_EXERCISES: (id: string) => `/activities/podcasts/${id}/exercises`,
  ACTIVITIES_PODCASTS_EVALUATE: '/activities/podcasts/evaluate',
  ACTIVITIES_PODCASTS_PROGRESS: '/activities/podcasts/progress',
  ACTIVITIES_PODCASTS_COMPLETE: (id: string) => `/activities/podcasts/${id}/complete`,

  // Trimestral Exams
  EXAMS_TRIMESTRAL_STATUS: '/exams/trimestral/status',
  EXAMS_TRIMESTRAL_START: '/exams/trimestral/start',
  EXAMS_TRIMESTRAL_CURRENT: '/exams/trimestral/current',
  EXAMS_TRIMESTRAL_SUBMIT: '/exams/trimestral/submit',
  EXAMS_TRIMESTRAL_HISTORY: '/exams/trimestral/history',
  EXAMS_TRIMESTRAL_RESET: '/exams/trimestral/reset',

  // Admin & Dashboard
  DASHBOARD_STATS: '/dashboard/stats',
  DASHBOARD_STUDENTS: '/dashboard/students',
  DASHBOARD_DIFFICULTIES: '/dashboard/difficulties',
  DASHBOARD_BUYERS: '/dashboard/buyers',
  ADMIN_STUDENTS: '/dashboard/students',
  ADMIN_SIMULATIONS: '/dashboard/simulations',
  ADMIN_GAMES: '/dashboard/games',
  ADMIN_NEWS: '/dashboard/news',
  ADMIN_FLASHCARDS_GENERATE: '/dashboard/flashcards/generate',
  DASHBOARD_EXAMS_OVERVIEW: '/dashboard/exams/overview',
  DASHBOARD_EXAMS_STUDENT: (username: string) => `/dashboard/exams/students/${encodeURIComponent(username)}`,
  DASHBOARD_EXAMS_SYNC_ACTIVITIES: (username: string) => `/dashboard/exams/students/${encodeURIComponent(username)}/sync-activities`,
  DASHBOARD_EXAMS_GENERATE: (username: string) => `/dashboard/exams/students/${encodeURIComponent(username)}/generate`,
  DASHBOARD_EXAMS_RESET: (username: string) => `/dashboard/exams/students/${encodeURIComponent(username)}/reset`,
  DASHBOARD_EXAMS_QUESTION_STATUS: (examId: string, questionId: string) => `/dashboard/exams/${examId}/questions/${questionId}/status`,
  DASHBOARD_EXAMS_APPROVE_ALL: (examId: string) => `/dashboard/exams/${examId}/approve-all`,
  DASHBOARD_EXAMS_AI_IMPROVE: (examId: string, questionId: string) => `/dashboard/exams/${examId}/questions/${questionId}/ai-improve`,
  DASHBOARD_EXAMS_QUESTION_EDIT: (examId: string, questionId: string) => `/dashboard/exams/${examId}/questions/${questionId}`,
  ADMIN_PREMIUM: '/admin/premium',
  ADMIN_PREMIUM_UPLOAD: '/admin/premium/upload',

  TEST_ENGLISH_CONTENT: (level: string, category: string) =>
    `/activities/test-english/content?level=${level}&category=${category}`,

  // Keep-alive
  CORS_TEST: '/cors-test',
} as const;


