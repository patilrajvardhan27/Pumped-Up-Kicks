import { apiClient, API_ENDPOINTS } from './api';
import type {
  PlaybackResponse,
  PresignResponse,
  UploadResponse,
  VideoInfo,
  VideoListResponse,
} from '@/types/api';

class VideoService {
  /** Every subject's lectures come back together; the sidebar groups them. */
  async listVideos(limit: number = 500): Promise<VideoListResponse> {
    return apiClient.get<VideoListResponse>(`${API_ENDPOINTS.VIDEOS_LIST}?limit=${limit}`);
  }

  /** File a lecture under another subject, or under none (null is Unsorted). */
  async moveVideo(id: number, workspaceId: number | null): Promise<VideoInfo> {
    return apiClient.put<VideoInfo>(API_ENDPOINTS.VIDEOS_MOVE(id), { workspace_id: workspaceId });
  }

  /** A short-lived URL a <video> element can load and seek within. */
  async getPlaybackUrl(id: number): Promise<PlaybackResponse> {
    return apiClient.get<PlaybackResponse>(API_ENDPOINTS.VIDEOS_PLAYBACK(id));
  }

  async deleteVideo(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.VIDEOS_DELETE(id));
  }

  /**
   * Upload a lecture.
   *
   * Asks the API where to put it first. In production that is a presigned R2
   * URL and the bytes go straight to storage, never through the app server;
   * locally the API has no presigned URL to give, so we post to it directly.
   */
  async uploadVideo(
    file: File,
    title?: string,
    workspaceId: number | null = null,
    onProgress?: (percent: number, loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<UploadResponse> {
    const slot = await apiClient.post<PresignResponse>(API_ENDPOINTS.VIDEOS_PRESIGN, {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      title,
      file_size: file.size,
      workspace_id: workspaceId,
    });

    if (!slot.upload_url) {
      // Local backend: the reserved row is unused, so clean it up and post
      // the file through the API instead.
      await apiClient.delete(API_ENDPOINTS.VIDEOS_DELETE(slot.video_id)).catch(() => undefined);
      const fields: Record<string, string> = {};
      if (title) fields.title = title;
      if (workspaceId != null) fields.workspace_id = String(workspaceId);
      return apiClient.upload<UploadResponse>(API_ENDPOINTS.VIDEOS_UPLOAD, file, fields, onProgress);
    }

    await apiClient.putFile(
      slot.upload_url,
      file,
      file.type || 'application/octet-stream',
      onProgress,
      signal,
    );

    return apiClient.post<UploadResponse>(API_ENDPOINTS.VIDEOS_COMPLETE(slot.video_id), {});
  }
}

export const videoService = new VideoService();
