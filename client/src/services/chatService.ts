import { apiClient, API_ENDPOINTS } from './api';
import type {
  ChatRequest,
  ConversationDetail,
  ConversationItem,
  StreamEvent,
  UsageSummary,
} from '@/types/api';

export interface ConversationFilter {
  videoId?: number | null;
  workspaceId?: number | null;
  unsorted?: boolean;
}

class ChatService {
  /** Streams the answer as it is written. Resolves when the stream closes. */
  async streamQuery(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return apiClient.postStream<StreamEvent>(API_ENDPOINTS.CHAT_STREAM, request, onEvent, signal);
  }

  /**
   * Threads, optionally only those about one lecture, those filed under one
   * subject, or those filed under no subject (Unsorted).
   */
  async listConversations(filter: ConversationFilter = {}): Promise<ConversationItem[]> {
    const params = new URLSearchParams();
    if (filter.videoId != null) params.set('video_id', String(filter.videoId));
    if (filter.workspaceId != null) params.set('workspace_id', String(filter.workspaceId));
    else if (filter.unsorted) params.set('unsorted', 'true');
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
}

export const chatService = new ChatService();
