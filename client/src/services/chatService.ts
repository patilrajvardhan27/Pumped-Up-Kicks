/**
 * Chat Service
 * Handles all chat-related API calls
 */

import { apiClient, API_ENDPOINTS } from './api';
import type { ChatRequest, ChatResponse, HistoryItem, HealthResponse } from '@/types/api';

export class ChatService {
  /**
   * Send a question to the AI chatbot
   */
  async query(request: ChatRequest): Promise<ChatResponse> {
    return apiClient.post<ChatResponse>(API_ENDPOINTS.CHAT_QUERY, request);
  }

  /**
   * Get chat history
   */
  async getHistory(limit: number = 10, sessionId?: string): Promise<HistoryItem[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(sessionId && { session_id: sessionId }),
    });

    return apiClient.get<HistoryItem[]>(
      `${API_ENDPOINTS.CHAT_HISTORY}?${params.toString()}`
    );
  }

  /**
   * Check RAG system health
   */
  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>(API_ENDPOINTS.CHAT_HEALTH);
  }
}

export const chatService = new ChatService();
