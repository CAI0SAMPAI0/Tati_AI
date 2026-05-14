export const HUB_ENDPOINTS = {
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_GOOGLE: '/auth/google',
  PROFILE: '/profile',
  HUB_PAYMENT_STATUS: (paymentId: string) => `/activities/hub/payment-status/${paymentId}`,
  HUB_PUBLIC: '/activities/hub/public',
  HUB_ACCESS: (contentId: string) => `/activities/hub/${contentId}/access`,
  HUB_CHECKOUT: '/activities/hub/checkout',
  HUB_CHECKOUT_GUEST: '/activities/hub/checkout/guest',
  HUB_DOWNLOAD: (contentId: string) => `/hub/${contentId}/download`,
} as const;
