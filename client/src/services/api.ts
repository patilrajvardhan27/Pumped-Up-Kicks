import { currentToken } from '@/lib/authToken';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  CHAT_QUERY: `${API_BASE_URL}/api/chat/query`,
  CHAT_STREAM: `${API_BASE_URL}/api/chat/stream`,
  CHAT_USAGE: `${API_BASE_URL}/api/chat/usage`,
  CHAT_HEALTH: `${API_BASE_URL}/api/chat/health`,
  CONVERSATIONS: `${API_BASE_URL}/api/chat/conversations`,
  CONVERSATION: (id: number) => `${API_BASE_URL}/api/chat/conversations/${id}`,
  VIDEOS_LIST: `${API_BASE_URL}/api/videos`,
  VIDEOS_DETAIL: (id: number) => `${API_BASE_URL}/api/videos/${id}`,
  VIDEOS_STATUS: (id: number) => `${API_BASE_URL}/api/videos/${id}/status`,
  VIDEOS_PLAYBACK: (id: number) => `${API_BASE_URL}/api/videos/${id}/playback`,
  VIDEOS_DELETE: (id: number) => `${API_BASE_URL}/api/videos/${id}`,
  VIDEOS_PRESIGN: `${API_BASE_URL}/api/videos/presign`,
  VIDEOS_COMPLETE: (id: number) => `${API_BASE_URL}/api/videos/${id}/complete`,
  VIDEOS_UPLOAD: `${API_BASE_URL}/api/videos/upload`,
  HEALTH: `${API_BASE_URL}/health`,
} as const;

/** Thrown for a non-2xx response, carrying the status so callers can branch. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toError(response: Response, fallback: string): Promise<ApiError> {
  try {
    const body = await response.json();
    return new ApiError(body.detail || fallback, response.status);
  } catch {
    return new ApiError(`${fallback} (${response.status})`, response.status);
  }
}

/** Attaches the Clerk session token when there is one. */
async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await currentToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

export class ApiClient {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
    });

    if (!response.ok) throw await toError(response, 'Request failed');
    return response.json();
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await toError(response, 'Request failed');
    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) throw await toError(response, 'Delete failed');
    return response.json();
  }

  /** POST a JSON body and read back a server-sent event stream. */
  async postStream<E>(
    endpoint: string,
    data: unknown,
    onEvent: (event: E) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
      signal,
    });

    if (!response.ok) throw await toError(response, 'Request failed');
    if (!response.body) throw new ApiError('This browser cannot read streamed responses.', 0);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;
        try {
          onEvent(JSON.parse(line.slice(5).trim()) as E);
        } catch {
          // Partial frame — keep reading.
        }
      }
    }
  }

  /**
   * PUT a file straight to storage with progress. fetch() cannot report upload
   * progress, which is the one thing XMLHttpRequest still does better.
   */
  putFile(
    url: string,
    file: File,
    contentType: string,
    onProgress?: (percent: number, loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
        }
      };

      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new ApiError(`Storage rejected the upload (${xhr.status})`, xhr.status));
      xhr.onerror = () => reject(new ApiError('Lost connection during upload.', 0));
      xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0));

      signal?.addEventListener('abort', () => xhr.abort());
      xhr.send(file);
    });
  }

  /** Multipart upload through the API — used by the local storage backend. */
  async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>,
    onProgress?: (percent: number, loaded: number, total: number) => void,
  ): Promise<T> {
    const headers = await authHeaders();

    return new Promise<T>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(additionalData ?? {}).forEach(([k, v]) => formData.append(k, v));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100), event.loaded, event.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as T);
          } catch {
            reject(new ApiError('The server sent a response we could not read.', xhr.status));
          }
          return;
        }
        try {
          reject(new ApiError(JSON.parse(xhr.responseText).detail || 'Upload failed', xhr.status));
        } catch {
          reject(new ApiError(`Upload failed (${xhr.status})`, xhr.status));
        }
      };

      xhr.onerror = () => reject(new ApiError('Lost connection during upload.', 0));
      xhr.send(formData);
    });
  }
}

export const apiClient = new ApiClient();
