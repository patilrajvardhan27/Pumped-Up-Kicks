'use client';

import { useCallback, useRef, useState } from 'react';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import { STORAGE_KEYS, usePersistedString } from '@/lib/persisted';
import { keyOfConversation, keyOfVideo, parseKey, type WorkspaceKey } from '@/lib/workspaces';
import type { ConversationItem, Source, VideoInfo, WorkspaceInfo } from '@/types/api';

/**
 * What the workspace is looking at: the open subject, lecture, chat and
 * player position, plus the sidebar's state. The open subject and the
 * sidebar's collapsed state survive a reload.
 */
export function useWorkspaceView(workspaces: WorkspaceInfo[], subjectsLoading: boolean) {
  const [storedKey, setStoredKey] = usePersistedString(STORAGE_KEYS.activeSubject);
  const [storedCollapsed, setStoredCollapsed] = usePersistedString(STORAGE_KEYS.sidebarCollapsed);
  const activeKey: WorkspaceKey = parseKey(storedKey, subjectsLoading ? null : workspaces) ?? 'all';
  const collapsed = storedCollapsed === '1';
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Which lecture the chat is scoped to; null means the whole open subject.
  const [videoId, setVideoId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

  // The lecture loaded in the player, and the passages to mark on it.
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [citations, setCitations] = useState<Source[]>([]);
  const playerRef = useRef<VideoPlayerHandle>(null);

  /** Every timestamp click lands here: show its lecture, then seek. */
  const seekTo = useCallback((targetVideoId: number, seconds: number) => {
    setPlayingId(targetVideoId);
    playerRef.current?.seek(targetVideoId, seconds);
  }, []);

  /** Open a subject (or All, or Unsorted) with a fresh chat over all of it. */
  const selectKey = useCallback(
    (key: WorkspaceKey) => {
      setStoredKey(String(key));
      setVideoId(null);
      setConversationId(null);
      setCitations([]);
      setDrawerOpen(false);
    },
    [setStoredKey],
  );

  const selectVideo = useCallback((id: number | null) => {
    setVideoId(id);
    setConversationId(null); // a different lecture means a different thread
    setPlayingId(id);
    setCitations([]);
  }, []);

  /** From the sidebar: a lecture in any subject. Its subject opens with it. */
  const openLecture = useCallback(
    (video: VideoInfo) => {
      const key = keyOfVideo(video);
      if (activeKey !== 'all' && key !== activeKey) setStoredKey(String(key));
      selectVideo(video.id);
      setDrawerOpen(false);
    },
    [activeKey, selectVideo, setStoredKey],
  );

  // Opening a chat also opens the subject and lecture it was about, so the
  // composer, the library and the sidebar agree on what is searched.
  const selectConversation = useCallback(
    (conversation: ConversationItem | null) => {
      if (conversation === null) {
        setConversationId(null);
        return;
      }
      setStoredKey(String(keyOfConversation(conversation)));
      setVideoId(conversation.video_id ?? null);
      setConversationId(conversation.id);
      setDrawerOpen(false);
    },
    [setStoredKey],
  );

  const toggleCollapsed = useCallback(() => {
    // On narrow screens the same shortcut opens and closes the drawer instead.
    if (window.matchMedia('(min-width: 64rem)').matches) setStoredCollapsed(collapsed ? null : '1');
    else setDrawerOpen((open) => !open);
  }, [collapsed, setStoredCollapsed]);

  return {
    activeKey,
    collapsed,
    drawerOpen,
    setDrawerOpen,
    videoId,
    conversationId,
    setConversationId,
    playingId,
    closePlayer: useCallback(() => setPlayingId(null), []),
    citations,
    setCitations,
    playerRef,
    seekTo,
    selectKey,
    selectVideo,
    openLecture,
    selectConversation,
    toggleCollapsed,
  };
}

/** Everything but the player ref, which travels on its own so render code never touches a ref. */
export type WorkspaceView = Omit<ReturnType<typeof useWorkspaceView>, 'playerRef'>;
