'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import type { Source, VideoInfo } from '@/types/api';
import { ChatPanel } from './chat/ChatPanel';
import { ConversationList } from './chat/ConversationList';
import { UsageMeter } from './UsageMeter';
import { VideoUpload } from './upload/VideoUpload';
import { VideoList } from './video/VideoList';
import { VideoPlayer } from './video/VideoPlayer';

/** The signed-in app: library on the left, player and chat on the right. */
export function Workspace() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [libraryTrigger, setLibraryTrigger] = useState(0);
  const [threadsTrigger, setThreadsTrigger] = useState(0);

  // Which lecture the chat is scoped to; null means all of them.
  const [videoId, setVideoId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

  // The lecture currently loaded in the player, and the passages to mark on it.
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [citations, setCitations] = useState<Source[]>([]);
  const playerRef = useRef<VideoPlayerHandle>(null);

  /**
   * Clicking any timestamp lands here: show the lecture it belongs to, then
   * seek. The player loads the source itself if it isn't the current one.
   */
  const seekTo = useCallback((targetVideoId: number, seconds: number) => {
    setPlayingId(targetVideoId);
    playerRef.current?.seek(targetVideoId, seconds);
  }, []);

  const handleUploadSuccess = useCallback(() => setLibraryTrigger((n) => n + 1), []);

  const selectVideo = useCallback((id: number | null) => {
    setVideoId(id);
    setConversationId(null); // a different lecture means a different thread
    setPlayingId(id);
    setCitations([]);
  }, []);

  // Opening an existing chat also restores the lecture it was about, so the
  // composer and the library agree on what is being searched.
  const selectConversation = useCallback((id: number | null, forVideoId?: number | null) => {
    setConversationId(id);
    if (id !== null && forVideoId !== undefined) setVideoId(forVideoId ?? null);
  }, []);

  const handleTurnComplete = useCallback(() => setThreadsTrigger((n) => n + 1), []);
  const closePlayer = useCallback(() => setPlayingId(null), []);

  const playerCitations = useMemo(
    () =>
      citations
        .filter((citation) => citation.video_id === playingId)
        .map((citation) => ({ start: citation.start ?? 0, end: citation.end ?? 0 })),
    [citations, playingId],
  );

  return (
    <main
      id="main"
      className="page grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 pt-1 pb-3 lg:grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] lg:gap-4"
    >
      <aside aria-label="Library and chats" className="flex min-w-0 flex-col gap-3 lg:gap-4">
        <VideoUpload onUploadSuccess={handleUploadSuccess} />
        <VideoList
          refreshTrigger={libraryTrigger}
          selectedId={videoId}
          onVideosChange={setVideos}
          onSelect={selectVideo}
        />
        <ConversationList
          videoId={videoId}
          activeId={conversationId}
          refreshTrigger={threadsTrigger}
          onSelect={selectConversation}
        />
        <UsageMeter refreshTrigger={threadsTrigger} />
      </aside>

      <Card
        as="section"
        aria-label="Chat"
        className="flex min-h-[70dvh] min-w-0 flex-col gap-4 p-4 sm:p-6 lg:sticky lg:top-[calc(var(--spacing-nav)+0.25rem)] lg:h-[calc(100dvh-var(--spacing-nav)-1rem)] lg:min-h-0"
      >
        <VideoPlayer
          ref={playerRef}
          video={videos.find((video) => video.id === playingId) ?? null}
          citations={playerCitations}
          onClose={closePlayer}
        />
        <ChatPanel
          videos={videos}
          videoId={videoId}
          conversationId={conversationId}
          onConversationStarted={setConversationId}
          onTurnComplete={handleTurnComplete}
          onSeek={seekTo}
          onSourcesChange={setCitations}
        />
      </Card>
    </main>
  );
}
