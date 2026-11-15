'use client';

import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import { STORAGE_KEYS, usePersistedString } from '@/lib/persisted';
import { parseKey, type WorkspaceKey } from '@/lib/workspaces';
import { useAppStore } from '@/stores/appStore';
import type { VideoInfo, WorkspaceInfo } from '@/types/api';

/**
 * What the workspace is looking at. The open subject and the collapsed
 * sidebar came from local storage so they survived a reload; the rest came
 * from the app store. The player ref stayed here, since a ref isn't state.
 */
export function useWorkspaceView(workspaces: WorkspaceInfo[], subjectsLoading: boolean) {
  const [storedKey] = usePersistedString(STORAGE_KEYS.activeSubject);
  const [storedCollapsed, setStoredCollapsed] = usePersistedString(STORAGE_KEYS.sidebarCollapsed);
  const activeKey: WorkspaceKey = parseKey(storedKey, subjectsLoading ? null : workspaces) ?? 'all';
  const collapsed = storedCollapsed === '1';
  const playerRef = useRef<VideoPlayerHandle>(null);

  const view = useAppStore(
    useShallow((s) => ({
      drawerOpen: s.drawerOpen,
      setDrawerOpen: s.setDrawerOpen,
      videoId: s.videoId,
      conversationId: s.conversationId,
      setConversationId: s.setConversationId,
      playingId: s.playingId,
      closePlayer: s.closePlayer,
      citations: s.citations,
      setCitations: s.setCitations,
      selectKey: s.selectKey,
      selectVideo: s.selectVideo,
      selectConversation: s.selectConversation,
    })),
  );
  const play = useAppStore((s) => s.play);
  const openInStore = useAppStore((s) => s.openLecture);
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);

  /** Every timestamp click landed here: show its lecture, then seek. */
  const seekTo = useCallback(
    (videoId: number, seconds: number) => {
      play(videoId);
      playerRef.current?.seek(videoId, seconds);
    },
    [play],
  );

  const openLecture = useCallback((video: VideoInfo) => openInStore(video, activeKey), [openInStore, activeKey]);

  // On narrow screens the same shortcut opened and closed the drawer instead.
  const toggleCollapsed = useCallback(() => {
    if (window.matchMedia('(min-width: 64rem)').matches) setStoredCollapsed(collapsed ? null : '1');
    else toggleDrawer();
  }, [collapsed, setStoredCollapsed, toggleDrawer]);

  return { ...view, activeKey, collapsed, playerRef, seekTo, openLecture, toggleCollapsed };
}

/** Everything but the player ref, which travels on its own so render code never touches a ref. */
export type WorkspaceView = Omit<ReturnType<typeof useWorkspaceView>, 'playerRef'>;
