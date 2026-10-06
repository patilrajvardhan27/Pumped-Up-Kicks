import { apiClient, API_ENDPOINTS } from './api';
import type {
  PlaybackResponse,
  PresignResponse,
  UploadResponse,
  VideoInfo,
  VideoListResponse,
} from '@/types/api';

export class VideoService {
  async listVideos(limit: number = 50): Promise<VideoListResponse> {
    return apiClient.get<VideoListResponse>(`${API_ENDPOINTS.VIDEOS_LIST}?limit=${limit}`);
  }

  async getStatus(id: number): Promise<VideoInfo> {
    return apiClient.get<VideoInfo>(API_ENDPOINTS.VIDEOS_STATUS(id));
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
    onProgress?: (percent: number, loaded: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<UploadResponse> {
    const slot = await apiClient.post<PresignResponse>(API_ENDPOINTS.VIDEOS_PRESIGN, {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      title,
      file_size: file.size,
    });

    if (!slot.upload_url) {
      // Local backend: the reserved row is unused, so clean it up and post
      // the file through the API instead.
      await apiClient.delete(API_ENDPOINTS.VIDEOS_DELETE(slot.video_id)).catch(() => undefined);
      return apiClient.upload<UploadResponse>(
        API_ENDPOINTS.VIDEOS_UPLOAD,
        file,
        title ? { title } : undefined,
        onProgress,
      );
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
