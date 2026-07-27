// Endpoints mapeados do legado — usados com apiGet/apiPost/etc.
export const ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_GOOGLE: '/auth/google',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',

  // Profile
  PROFILE: '/profile',

  // Permissions
  ACCESS_CONTROL: '/users/permissions/access',

  // Onboarding
  ONBOARDING: '/users/onboarding',

  // Weekly plan
  WEEKLY_PLAN: '/users/weekly-plan',
  WEEKLY_PLAN_TRANSITION: '/users/weekly-plan/transition',

  // Progress
  PROGRESS: '/users/progress',
  PROGRESS_WEEKLY: '/users/progress/reports/weekly',
  PROGRESS_MONTHLY: '/users/progress/reports/monthly',
  PROGRESS_WEEKLY_PLAN: '/users/progress/weekly-plan',
  PROGRESS_WEEKLY_PLAN_PROGRESS: '/users/progress/weekly-plan/progress',
  STREAK: '/users/streak',
  XP: '/users/xp',

  // Vocabulary
  VOCABULARY: '/users/vocabulary',

  // Goals
  GOALS: '/users/goals',

  // Chat
  CONVERSATIONS: '/chat/conversations',
  CONVERSATION_MESSAGES: (id: string) => `/chat/conversations/${id}/messages`,
  EDIT_MESSAGE: (convId: string, msgId: string) => `/chat/conversations/${convId}/messages/${msgId}`,
  CONVERSATION_SUMMARY: (id: string) => `/chat/conversations/${id}/summary`,
  CHAT_DOWNLOAD_REPORT: '/chat/download_report',
  CHAT_TTS: '/chat/tts',
  CHAT_WS: '/chat/ws',

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

  // Validation
  VALIDATE_DOCUMENT: (doc: string) => `/validation/validate-document/${doc}`,

  // Grammar (Sprint 20 — substitui AI Exercises)
  GRAMMAR: '/grammar',
  GRAMMAR_CACHE_CLEAR: '/grammar/cache-clear',

  // Speech
  SPEECH_VERIFY_PRONUNCIATION: '/speech/verify-pronunciation',

  // Listening content ingestion
  LISTENINGS_INGEST: '/activities/listenings/ingest',
  LISTENINGS_CLEANUP: '/activities/listenings/cleanup-legacy',

  // CEFR Images
  CEFR_IMAGE_RESOLVE: '/cefr/images/resolve',
  CEFR_IMAGE_RESOLVE_BATCH: '/cefr/images/resolve-batch',

  // Activities
  ACTIVITIES_MODULES: '/activities/modules',
  ACTIVITIES_QUIZZES: '/activities/quizzes',
  ACTIVITIES_RANKING: '/activities/ranking',
  ACTIVITIES_PODCASTS_WARMUP: '/activities/podcasts/warmup',
  ACTIVITIES_PODCASTS_RECOMMENDATIONS: '/activities/podcasts/recommendations',
  ACTIVITIES_PODCAST_DETAIL: (id: string) => `/activities/podcasts/${id}`,
  ACTIVITIES_PODCASTS_EXERCISES: (id: string) => `/activities/podcasts/${id}/exercises`,
  ACTIVITIES_PODCASTS_EVALUATE: '/activities/podcasts/evaluate',
  ACTIVITIES_PODCASTS_PROGRESS: '/activities/podcasts/progress',
  ACTIVITIES_PODCASTS_COMPLETE: (id: string) => `/activities/podcasts/${id}/complete`,

  // Test English (external content)
  TEST_ENGLISH_CONTENT: (level: string, category: string) =>
    `/activities/test-english/content?level=${level}&category=${category}`,

  // Admin
  ADMIN_MODULES: '/activities/modules/admin',
  ADMIN_MODULE_ALL: '/activities/modules/admin/all',
  ADMIN_MODULE_GENERATE_QUIZ: '/activities/modules/admin/generate-quiz',
  ADMIN_MODULE_GENERATE_FLASHCARDS: '/activities/modules/admin/generate-flashcards',
  ADMIN_SIMULATIONS: '/dashboard/simulations',
  ADMIN_SIMULATION_DETAIL: (id: string) => `/dashboard/simulations/${id}`,
  ADMIN_STUDENTS: '/dashboard/students',
  ADMIN_BUYERS: '/dashboard/buyers',
  ADMIN_DIFFICULTIES: '/dashboard/difficulties',
  ADMIN_PREMIUM: '/admin/premium',
  ADMIN_PREMIUM_UPLOAD: '/admin/premium/upload',

  // Premium (Aluno)
  PREMIUM_HUB: '/activities/premium',
  PREMIUM_ACCESS: (id: string) => `/activities/premium/${id}/access`,
  PREMIUM_BUY: (id: string) => `/activities/premium/${id}/buy`,

  // Keep-alive
  CORS_TEST: '/cors-test',
} as const;
