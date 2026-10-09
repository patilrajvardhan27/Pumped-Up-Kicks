import { apiClient, API_ENDPOINTS } from './api';
import type { CanvasCourse, CanvasStatus, CanvasSyncRequest, DocumentInfo } from '@/types/api';

class CanvasService {
  async status(): Promise<CanvasStatus> {
    return apiClient.get<CanvasStatus>(API_ENDPOINTS.CANVAS_CONNECTION);
  }

  /** The school's Canvas sign-in page. The browser goes there next. */
  async startSignIn(baseUrl: string): Promise<string> {
    const { authorize_url } = await apiClient.post<{ authorize_url: string }>(
      API_ENDPOINTS.CANVAS_OAUTH_START,
      { base_url: baseUrl },
    );
    return authorize_url;
  }

  /** Local development only; the server refuses it unless enabled. */
  async connectWithToken(baseUrl: string, token: string): Promise<CanvasStatus> {
    return apiClient.post<CanvasStatus>(API_ENDPOINTS.CANVAS_TOKEN, { base_url: baseUrl, token });
  }

  async courses(): Promise<CanvasCourse[]> {
    return apiClient.get<CanvasCourse[]>(API_ENDPOINTS.CANVAS_COURSES);
  }

  async sync(request: CanvasSyncRequest = {}): Promise<CanvasStatus> {
    return apiClient.post<CanvasStatus>(API_ENDPOINTS.CANVAS_SYNC, request);
  }

  async disconnect(deleteMaterial: boolean): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(
      `${API_ENDPOINTS.CANVAS_CONNECTION}?delete_material=${deleteMaterial ? 'true' : 'false'}`,
    );
  }

  async documents(filter: { workspaceId?: number | null; unsorted?: boolean } = {}): Promise<DocumentInfo[]> {
    const params = new URLSearchParams();
    if (filter.workspaceId != null) params.set('workspace_id', String(filter.workspaceId));
    else if (filter.unsorted) params.set('unsorted', 'true');
    const query = params.toString();
    return apiClient.get<DocumentInfo[]>(query ? `${API_ENDPOINTS.DOCUMENTS}?${query}` : API_ENDPOINTS.DOCUMENTS);
  }
}

export const canvasService = new CanvasService();
