'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChatInterface,
  ConversationList,
  ServerStatus,
  UsageMeter,
  UserBar,
  VideoList,
  VideoPlayer,
  VideoUpload,
} from '@/components';
import type { VideoPlayerHandle } from '@/components/VideoPlayer';
import type { Source, VideoInfo } from '@/types/api';

export default function AppPage() {
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

  const handleTurnComplete = useCallback(() => {
    setThreadsTrigger((n) => n + 1);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-deck/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="group flex items-baseline gap-3">
            <span className="font-display text-lg tracking-tight text-ink transition-colors group-hover:text-signal">
              Pumped Up Kicks
            </span>
            <span className="hidden font-mono text-[0.65rem] uppercase tracking-[0.18em] text-faint sm:inline">
              Workspace
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ServerStatus />
            <UserBar />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1500px] flex-1 gap-8 px-6 py-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <aside className="space-y-5">
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

        <section className="panel flex min-h-[70vh] flex-col p-6 lg:sticky lg:top-24 lg:h-[calc(100vh-9rem)]">
          <VideoPlayer
            ref={playerRef}
            video={videos.find((v) => v.id === playingId) ?? null}
            citations={citations
              .filter((c) => c.video_id === playingId)
              .map((c) => ({ start: c.start ?? 0, end: c.end ?? 0 }))}
            onClose={() => setPlayingId(null)}
          />
          <ChatInterface
            videos={videos}
            videoId={videoId}
            conversationId={conversationId}
            onConversationStarted={setConversationId}
            onTurnComplete={handleTurnComplete}
            onSeek={seekTo}
            onSourcesChange={setCitations}
          />
        </section>
      </main>
    </div>
  );
}
