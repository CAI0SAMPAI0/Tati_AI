import { apiGet, apiPost } from '@/api/client';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Never register service worker in Capacitor native platform to avoid reload loops
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.()) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    reg.update().catch(() => {});
    return reg;
  } catch (err) {
    console.debug('[Push] Error registering service worker:', err);
    return null;
  }
}

function urlB64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return false;
  }

  try {
    let permission = window.Notification.permission;
    if (permission === 'default') {
      permission = await window.Notification.requestPermission();
    }
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const keyData = await apiGet<{ public_key: string }>('/notifications/vapid-key').catch(() => null);
    if (!keyData || !keyData.public_key) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
        try {
          await apiPost('/notifications/subscribe', {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            },
            user_agent: navigator.userAgent,
          });
          return true;
        } catch {
          // If expired, unsubscribe and re-create
          try {
            await subscription.unsubscribe();
          } catch {}
          subscription = null;
        }
      }
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(keyData.public_key),
    });

    if (subscription) {
      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
        await apiPost('/notifications/subscribe', {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          user_agent: navigator.userAgent,
        });
        console.log('[Push] User subscribed to push notifications successfully!');
        return true;
      }
    }
  } catch (err) {
    console.debug('[Push] Subscription notice:', err);
  }
  return false;
}
