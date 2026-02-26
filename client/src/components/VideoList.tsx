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

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (video: VideoInfo) => {
    if (!confirm(`Delete "${video.title}"? This will remove the video, transcriptions, and embeddings.`)) {
      return;
    }

    setDeletingId(video.id);
    try {
      await videoService.deleteVideo(video.id);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    } finally {
      setDeletingId(null);
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
              <div className="flex gap-2 items-center">
                <Badge variant={getStatusVariant(video.transcription_status)} size="sm">
                  {video.transcription_status}
                </Badge>
                <button
                  onClick={() => handleDelete(video)}
                  disabled={deletingId === video.id}
                  className="p-1.5 text-storm-cloud hover:text-strawberry-shock hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete video"
                >
                  {deletingId === video.id ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
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
