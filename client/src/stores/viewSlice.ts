import type { StateCreator } from 'zustand';
import { STORAGE_KEYS, write } from '@/lib/persisted';
import { keyOfConversation, keyOfVideo, type WorkspaceKey } from '@/lib/workspaces';
import type { ConversationItem, Source, VideoInfo } from '@/types/api';
import type { AppStore } from './appStore';

/*
 * What the workspace is looking at. We kept the open subject and the collapsed
 * sidebar in lib/persisted, since sign-out already clears them there; this
 * slice writes the subject through it and holds the rest.
 */
export interface ViewSlice {
  drawerOpen: boolean;
  /** The lecture the chat is scoped to; null means the whole open subject. */
  videoId: number | null;
  conversationId: number | null;
  /** The lecture in the player, and the passages marked on its scrubber. */
  playingId: number | null;
  citations: Source[];
  /** Bumped when a chat is saved, moved or deleted, so the thread lists refetch. */
  threadsVersion: number;

  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  setConversationId: (id: number | null) => void;
  setCitations: (sources: Source[]) => void;
  play: (videoId: number) => void;
  closePlayer: () => void;
  bumpThreads: () => void;
  selectKey: (key: WorkspaceKey) => void;
  selectVideo: (id: number | null) => void;
  openLecture: (video: VideoInfo, activeKey: WorkspaceKey) => void;
  selectConversation: (conversation: ConversationItem | null) => void;
}

export const initialView = {
  drawerOpen: false,
  videoId: null,
  conversationId: null,
  playingId: null,
  citations: [],
  threadsVersion: 0,
} satisfies Partial<ViewSlice>;

const openSubject = (key: WorkspaceKey) => write(STORAGE_KEYS.activeSubject, String(key));

export const createViewSlice: StateCreator<AppStore, [], [], ViewSlice> = (set) => ({
  ...initialView,

  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  toggleDrawer: () => set((state) => ({ drawerOpen: !state.drawerOpen })),
  setConversationId: (conversationId) => set({ conversationId }),
  setCitations: (citations) => set({ citations }),
  play: (playingId) => set({ playingId }),
  closePlayer: () => set({ playingId: null }),
  bumpThreads: () => set((state) => ({ threadsVersion: state.threadsVersion + 1 })),

  // Opening a subject started a fresh chat over all of it.
  selectKey: (key) => {
    openSubject(key);
    set({ videoId: null, conversationId: null, citations: [], drawerOpen: false });
  },

  // A different lecture meant a different thread.
  selectVideo: (id) => set({ videoId: id, conversationId: null, playingId: id, citations: [] }),

  // From the sidebar, a lecture in another subject opened that subject too.
  openLecture: (video, activeKey) => {
    const key = keyOfVideo(video);
    if (activeKey !== 'all' && key !== activeKey) openSubject(key);
    set({ videoId: video.id, conversationId: null, playingId: video.id, citations: [], drawerOpen: false });
  },

  // Opening a chat also opened the subject and lecture it was about.
  selectConversation: (conversation) => {
    if (conversation === null) return set({ conversationId: null });
    openSubject(keyOfConversation(conversation));
    set({ videoId: conversation.video_id ?? null, conversationId: conversation.id, drawerOpen: false });
  },
});
