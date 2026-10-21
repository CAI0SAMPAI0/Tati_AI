import { apiGet } from './client';

export type WeeklyTopic = {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  redirect_url?: string;
};

export type WeeklyPlan = {
  created_at: string;
  topics: WeeklyTopic[];
};

/**
 * Busca o plano semanal unificado.
 * O backend agora retorna todos os pendentes (podcasts, simulations).
 */
export function normalizeWeeklyPlanData(data: unknown): WeeklyPlan {
  const payload = (data && typeof data === 'object' ? data : {}) as {
    topics?: unknown[];
    created_at?: string;
  };

  const topics: WeeklyTopic[] = (payload.topics || []).map((t: any) => ({
      id: String(t.id),
      title: String(t.title),
      description: t.description || '',
      status: t.status === 'completed' ? 'completed' : 'pending',
      redirect_url: t.redirect_url
    }));

  return {
    created_at: payload.created_at || new Date().toISOString(),
    topics,
  };
}

export async function fetchWeeklyPlan(): Promise<WeeklyPlan> {
  try {
    const data = await apiGet<unknown>('/users/progress/weekly-plan');
    return normalizeWeeklyPlanData(data);
  } catch (error) {
    console.error('[fetchWeeklyPlan] Failed:', error);
    return {
      created_at: new Date().toISOString(),
      topics: [],
    };
  }
}

/** Alias para retornar apenas os tópicos. */
export async function fetchWeeklyTopics(): Promise<WeeklyTopic[]> {
  const plan = await fetchWeeklyPlan();
  return plan.topics;
}
