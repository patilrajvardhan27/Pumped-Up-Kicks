import { apiClient, API_ENDPOINTS } from './api';
import type { VideoListResponse, VideoInfo, UploadResponse } from '@/types/api';

export class VideoService {
  async listVideos(status?: string, limit: number = 50): Promise<VideoListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(status && { status }),
    });

    return apiClient.get<VideoListResponse>(
      `${API_ENDPOINTS.VIDEOS_LIST}?${params.toString()}`
    );
  }

  async getVideo(id: number): Promise<VideoInfo> {
    return apiClient.get<VideoInfo>(API_ENDPOINTS.VIDEOS_DETAIL(id));
  }

  async deleteVideo(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.VIDEOS_DELETE(id));
  }

  async uploadVideo(file: File, title?: string): Promise<UploadResponse> {
    return apiClient.upload<UploadResponse>(
      API_ENDPOINTS.VIDEOS_UPLOAD,
      file,
      title ? { title } : undefined
    );
  }
}

export const videoService = new VideoService();
