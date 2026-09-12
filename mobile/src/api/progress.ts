import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from './client';

export interface ProgressHistoryItem {
  videoId: string;
  exerciseType: string;
  status: string;
  overallScore: number | null;
  totalReps: number | null;
  analyzedAt: string;
}

export interface ProgressHistoryResponse {
  sessions: ProgressHistoryItem[];
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface ScorePoint {
  timestamp: string;
  score: number;
  reps: number;
}

export interface ProgressTrendResponse {
  exerciseType: string;
  totalSessions: number;
  bestScore: number;
  averageScore: number;
  averageLastN: number | null;
  averagePreviousN: number | null;
  scoreDelta: number | null;
  consistency: number | null;
  trend: string;
  scorePoints: ScorePoint[];
}

export interface TopError {
  error: string;
  occurrences: number;
  percentageOfSessions: number;
}

export interface ProgressInsightResponse {
  exerciseType: string;
  totalSessions: number;
  overallTrend: string;
  insights: string[];
  topErrors: TopError[];
}

const progressApi = axios.create({ baseURL: BASE_URL });

progressApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});


export async function getProgressHistory(
  exerciseType?: string,
  fromDate?: string,
  toDate?: string,
  page: number = 0,
  size: number = 20,
) {
  const params: Record<string, any> = { page, size };
  if (exerciseType) params.exerciseType = exerciseType;
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const { data } = await progressApi.get<ProgressHistoryResponse>('/progress/history', { params });
  return data;
}

export async function getProgressTrends(exerciseType: string) {
  const { data } = await progressApi.get<ProgressTrendResponse>(`/progress/trends/${exerciseType}`);
  return data;
}

export async function getProgressInsights(exerciseType: string) {
  const { data } = await progressApi.get<ProgressInsightResponse>(`/progress/insights/${exerciseType}`);
  return data;
}
