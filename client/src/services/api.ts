/**
 * API Client Configuration
 * Central configuration for all API calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Chat
  CHAT_QUERY: `${API_BASE_URL}/api/chat/query`,
  CHAT_HISTORY: `${API_BASE_URL}/api/chat/history`,
  CHAT_HEALTH: `${API_BASE_URL}/api/chat/health`,

  // Videos
  VIDEOS_LIST: `${API_BASE_URL}/api/videos`,
  VIDEOS_DETAIL: (id: number) => `${API_BASE_URL}/api/videos/${id}`,
  VIDEOS_UPLOAD: `${API_BASE_URL}/api/videos/upload`,

  // Health
  HEALTH: `${API_BASE_URL}/health`,
  ROOT: `${API_BASE_URL}/`,
} as const;

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API request failed');
    }

    return response.json();
  }

  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, string>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }
}

export const apiClient = new ApiClient();
