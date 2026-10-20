import { apiGet, apiPost } from './client';
import { ENDPOINTS } from './endpoints';

export async function getMyFlashcards(): Promise<any[]> {
  return apiGet<any[]>(ENDPOINTS.ACTIVITIES_MODULES);
}

export async function getRanking(): Promise<any[]> {
  return apiGet<any[]>(ENDPOINTS.ACTIVITIES_RANKING);
}

export async function getNews(): Promise<any[]> {
  return apiGet<any[]>(ENDPOINTS.ACTIVITIES_NEWS);
}

export async function getMusics(): Promise<any[]> {
  return apiGet<any[]>(ENDPOINTS.ACTIVITIES_MUSICS);
}

export async function getPodcasts(): Promise<any[]> {
  return apiGet<any[]>(ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS);
}

export async function getAccessControl(): Promise<any> {
  return apiGet<any>(ENDPOINTS.ACCESS_CONTROL);
}
