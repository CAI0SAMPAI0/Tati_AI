import { apiGet, apiPost } from './client';
import { ENDPOINTS } from './endpoints';
import type { ExamStatus, ExamActive, ExamHistoryItem } from './types';

export async function getExamStatus(): Promise<ExamStatus> {
  return apiGet<ExamStatus>(ENDPOINTS.EXAMS_TRIMESTRAL_STATUS);
}

export async function startExam(): Promise<ExamActive> {
  return apiPost<ExamActive>(ENDPOINTS.EXAMS_TRIMESTRAL_START);
}

export async function getCurrentExam(): Promise<ExamActive> {
  return apiGet<ExamActive>(ENDPOINTS.EXAMS_TRIMESTRAL_CURRENT);
}

export async function submitExam(payload: {
  exam_id: string;
  answers: Array<{
    question_id: string;
    answer: string;
    audio_data?: string;
  }>;
}): Promise<{
  exam_id?: string;
  score: number;
  level: string;
  total_questions: number;
  correct_count: number;
  skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
  can_do_statements?: string[];
  points_to_improve?: string[];
  summary?: string;
  summary_feedback?: string;
  passed: boolean;
  corrections?: Array<{
    question_id: string;
    question: string;
    type: string;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
    points_earned: number;
    explanation: string;
  }>;
}> {
  return apiPost(ENDPOINTS.EXAMS_TRIMESTRAL_SUBMIT, payload);
}

export async function getExamHistory(): Promise<ExamHistoryItem[]> {
  return apiGet<ExamHistoryItem[]>(ENDPOINTS.EXAMS_TRIMESTRAL_HISTORY);
}

export async function resetExam(): Promise<{ message: string }> {
  return apiPost<{ message: string }>(ENDPOINTS.EXAMS_TRIMESTRAL_RESET);
}

export async function getTtsAudio(text: string, accent: string = 'en-US'): Promise<{ audio_b64: string }> {
  return apiPost<{ audio_b64: string }>(ENDPOINTS.CHAT_TTS, { text, accent });
}

