import { apiClient, API_ENDPOINTS } from './api';
import type { WorkspaceDraft, WorkspaceInfo } from '@/types/api';

class WorkspaceService {
  async list(): Promise<WorkspaceInfo[]> {
    return apiClient.get<WorkspaceInfo[]>(API_ENDPOINTS.WORKSPACES);
  }

  async create(draft: WorkspaceDraft): Promise<WorkspaceInfo> {
    return apiClient.post<WorkspaceInfo>(API_ENDPOINTS.WORKSPACES, draft);
  }

  /** Rename, recolour or change the icon. Fields left out stay as they are. */
  async update(id: number, change: Partial<WorkspaceDraft>): Promise<WorkspaceInfo> {
    return apiClient.patch<WorkspaceInfo>(API_ENDPOINTS.WORKSPACE(id), change);
  }

  /** Deletes the subject only; its lectures and chats move to Unsorted. */
  async remove(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.WORKSPACE(id));
  }

  /** Every subject id, in the order to show them. */
  async reorder(ids: number[]): Promise<WorkspaceInfo[]> {
    return apiClient.put<WorkspaceInfo[]>(API_ENDPOINTS.WORKSPACES_ORDER, { workspace_ids: ids });
  }
}

export const workspaceService = new WorkspaceService();
