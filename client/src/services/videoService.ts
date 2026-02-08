/**
 * Video Service
 * Handles all video-related API calls
 */

import { apiClient, API_ENDPOINTS } from './api';
import type { VideoListResponse, VideoInfo, UploadResponse } from '@/types/api';

export class VideoService {
  /**
   * List all uploaded videos
   */
  async listVideos(status?: string, limit: number = 50): Promise<VideoListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(status && { status }),
    });

    return apiClient.get<VideoListResponse>(
      `${API_ENDPOINTS.VIDEOS_LIST}?${params.toString()}`
    );
  }

  /**
   * Get specific video details
   */
  async getVideo(id: number): Promise<VideoInfo> {
    return apiClient.get<VideoInfo>(API_ENDPOINTS.VIDEOS_DETAIL(id));
  }

  /**
   * Upload a new video file
   */
  async uploadVideo(file: File, title?: string): Promise<UploadResponse> {
    return apiClient.upload<UploadResponse>(
      API_ENDPOINTS.VIDEOS_UPLOAD,
      file,
      title ? { title } : undefined
    );
  }
}

export const videoService = new VideoService();
