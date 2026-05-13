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
 * O backend agora retorna todos os pendentes (podcasts, simulations, ai-exercises).
 */
export async function fetchWeeklyPlan(): Promise<WeeklyPlan> {
  try {
    const data = await apiGet<any>('/users/progress/weekly-plan');
    
    // Garantir que topics venha como array
    const topics: WeeklyTopic[] = (data.topics || []).map((t: any) => ({
      id: String(t.id),
      title: String(t.title),
      description: t.description || '',
      status: t.status === 'completed' ? 'completed' : 'pending',
      redirect_url: t.redirect_url
    }));

    return {
      created_at: data.created_at || new Date().toISOString(),
      topics,
    };
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
