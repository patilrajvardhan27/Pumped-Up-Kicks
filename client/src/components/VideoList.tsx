'use client';

import { useState, useEffect } from 'react';
import { videoService } from '@/services';
import type { VideoInfo } from '@/types/api';
import Badge from './Badge';

export default function VideoList({ refreshTrigger }: { refreshTrigger?: number }) {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, [refreshTrigger]);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await videoService.listVideos();
      setVideos(result.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'processing':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="card">
        <p className="text-center text-storm-cloud">Loading videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-center text-strawberry-shock">{error}</p>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="card">
        <p className="text-center text-slate-skate">No videos uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-2xl font-bold text-charcoal-champion mb-6">
        Uploaded Videos ({videos.length})
      </h3>

      <div className="space-y-3">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-foggy-morning border border-silver-lining rounded-lg p-4 hover:border-electric-blueberry transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-midnight-mystery">{video.title}</h4>
                <p className="text-sm text-slate-skate">{video.filename}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={getStatusVariant(video.transcription_status)} size="sm">
                  {video.transcription_status}
                </Badge>
              </div>
            </div>

            <div className="flex gap-4 text-sm text-storm-cloud">
              <span>📅 {new Date(video.uploaded_at).toLocaleDateString()}</span>
              <span>⏱️ {formatDuration(video.duration)}</span>
              <span>💾 {formatFileSize(video.file_size)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
