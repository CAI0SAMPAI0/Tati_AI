import { apiGet, apiPatch } from './client';
import { ENDPOINTS } from './endpoints';
import type { User } from './types';

export async function getProfile(): Promise<User> {
  return apiGet<User>(ENDPOINTS.PROFILE);
}

export async function updateProfile(data: Partial<User>): Promise<User> {
  return apiPatch<User>(ENDPOINTS.PROFILE, data);
}

export async function getStreak(): Promise<{ current_streak: number; is_active: boolean }> {
  return apiGet<{ current_streak: number; is_active: boolean }>(ENDPOINTS.STREAK);
}

export async function getXp(): Promise<{ xp: number }> {
  return apiGet<{ xp: number }>(ENDPOINTS.XP);
}

