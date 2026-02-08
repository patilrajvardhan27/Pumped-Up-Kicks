import { apiClient, API_ENDPOINTS } from './api';
import type { ChatRequest, ChatResponse, HistoryItem, HealthResponse } from '@/types/api';

export class ChatService {
  async query(request: ChatRequest): Promise<ChatResponse> {
    return apiClient.post<ChatResponse>(API_ENDPOINTS.CHAT_QUERY, request);
  }

  async getHistory(limit: number = 10, sessionId?: string): Promise<HistoryItem[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(sessionId && { session_id: sessionId }),
    });

    return apiClient.get<HistoryItem[]>(
      `${API_ENDPOINTS.CHAT_HISTORY}?${params.toString()}`
    );
  }

  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>(API_ENDPOINTS.CHAT_HEALTH);
  }
}

export const chatService = new ChatService();
