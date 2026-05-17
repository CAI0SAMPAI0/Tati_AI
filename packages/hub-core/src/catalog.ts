import { apiGet } from './client';
import { HUB_ENDPOINTS } from './endpoints';
import type { HubOrder, SecureViewerAccess } from './types';

export async function fetchMyOrders(): Promise<HubOrder[]> {
  return apiGet<HubOrder[]>(HUB_ENDPOINTS.CATALOG_ORDERS);
}

export async function fetchSecureAccess(contentId: string): Promise<SecureViewerAccess> {
  return apiGet<SecureViewerAccess>(HUB_ENDPOINTS.HUB_ACCESS(contentId));
}
