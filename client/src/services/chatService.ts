import { apiClient, API_ENDPOINTS } from './api';
import type {
  ChatRequest,
  ChatResponse,
  ConversationDetail,
  ConversationItem,
  HealthResponse,
  StreamEvent,
  UsageSummary,
} from '@/types/api';

export class ChatService {
  async query(request: ChatRequest): Promise<ChatResponse> {
    return apiClient.post<ChatResponse>(API_ENDPOINTS.CHAT_QUERY, request);
  }

  /** Streams the answer as it is written. Resolves when the stream closes. */
  async streamQuery(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return apiClient.postStream<StreamEvent>(API_ENDPOINTS.CHAT_STREAM, request, onEvent, signal);
  }

  /** Threads, optionally only those about one lecture. */
  async listConversations(videoId?: number | null): Promise<ConversationItem[]> {
    const params = new URLSearchParams();
    if (videoId != null) params.set('video_id', String(videoId));
    const query = params.toString();
    return apiClient.get<ConversationItem[]>(
      query ? `${API_ENDPOINTS.CONVERSATIONS}?${query}` : API_ENDPOINTS.CONVERSATIONS,
    );
  }

  async getConversation(id: number): Promise<ConversationDetail> {
    return apiClient.get<ConversationDetail>(API_ENDPOINTS.CONVERSATION(id));
  }

  async deleteConversation(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.CONVERSATION(id));
  }

  async getUsage(): Promise<UsageSummary> {
    return apiClient.get<UsageSummary>(API_ENDPOINTS.CHAT_USAGE);
  }

  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>(API_ENDPOINTS.CHAT_HEALTH);
  }
}

export const chatService = new ChatService();
