'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { NewChatScope } from '@/hooks/useAskStream';
import { useConversations } from '@/hooks/useConversations';
import { useVideoLibrary } from '@/hooks/useVideoLibrary';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspaceShortcuts } from '@/hooks/useWorkspaceShortcuts';
import { cn } from '@/lib/cn';
import { usePersistedString } from '@/lib/persisted';
import {
  keyOfConversation,
  keyOfVideo,
  nameOf,
  parseKey,
  scopeOf,
  videosIn,
  type WorkspaceKey,
} from '@/lib/workspaces';
import type { ConversationFilter } from '@/services/chatService';
import type { ConversationItem, Source, VideoInfo, WorkspaceInfo } from '@/types/api';
import { ChatPanel } from './chat/ChatPanel';
import { ConversationList } from './chat/ConversationList';
import { SidebarDrawer } from './sidebar/SidebarDrawer';
import { WorkspaceGlyph } from './sidebar/WorkspaceGlyph';
import { WorkspaceSidebar, type WorkspaceSidebarProps } from './sidebar/WorkspaceSidebar';
import { UsageMeter } from './UsageMeter';
import { VideoUpload } from './upload/VideoUpload';
import { VideoList } from './video/VideoList';
import { VideoPlayer } from './video/VideoPlayer';

const ACTIVE_KEY = 'puk-active-subject-v1';
const COLLAPSED_KEY = 'puk-sidebar-collapsed-v1';

/**
 * The signed-in app: subjects on the left, then the open subject's library and
 * chats, then the player and chat. Everything in the middle column and every
 * new chat is scoped to the open subject.
 */
export function Workspace() {
  const [libraryTrigger, setLibraryTrigger] = useState(0);
  const [threadsTrigger, setThreadsTrigger] = useState(0);

  const library = useVideoLibrary(libraryTrigger);
  const subjects = useWorkspaces();
  const allChats = useConversations({}, threadsTrigger);
  const { videos } = library;
  const { workspaces } = subjects;

  // The open subject and the sidebar's state survive a reload.
  const [storedKey, setStoredKey] = usePersistedString(ACTIVE_KEY);
  const [storedCollapsed, setStoredCollapsed] = usePersistedString(COLLAPSED_KEY);
  const activeKey: WorkspaceKey =
    parseKey(storedKey, subjects.loading ? null : workspaces) ?? 'all';
  const collapsed = storedCollapsed === '1';
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Which lecture the chat is scoped to; null means the whole open subject.
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

  const refreshThreads = useCallback(() => setThreadsTrigger((n) => n + 1), []);
  const handleUploadSuccess = useCallback(() => setLibraryTrigger((n) => n + 1), []);

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

  // Opening an existing chat also opens the subject and lecture it was about,
  // so the composer, the library and the sidebar agree on what is searched.
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

  const moveVideo = useCallback(
    async (id: number, workspaceId: number | null) => {
      await library.moveVideo(id, workspaceId);
      // A lecture's own chats are filed with it, so the thread lists change too.
      refreshThreads();
    },
    [library, refreshThreads],
  );

  const deleteWorkspace = useCallback(
    async (workspace: WorkspaceInfo) => {
      const confirmed = window.confirm(
        `Delete “${workspace.name}”? Its lectures and chats move to Unsorted.`,
      );
      if (!confirmed || !(await subjects.remove(workspace.id))) return;
      if (activeKey === workspace.id) selectKey('unsorted');
      setLibraryTrigger((n) => n + 1);
      refreshThreads();
    },
    [activeKey, refreshThreads, selectKey, subjects],
  );

  const toggleCollapsed = useCallback(() => {
    // On narrow screens the same shortcut opens and closes the drawer instead.
    if (window.matchMedia('(min-width: 64rem)').matches) {
      setStoredCollapsed(collapsed ? null : '1');
    } else {
      setDrawerOpen((open) => !open);
    }
  }, [collapsed, setStoredCollapsed]);

  useWorkspaceShortcuts({
    subjectIds: workspaces.slice(0, 9).map((workspace) => workspace.id),
    onSelect: selectKey,
    onToggleSidebar: toggleCollapsed,
  });

  const closePlayer = useCallback(() => setPlayingId(null), []);

  const inView = useMemo(() => videosIn(videos, activeKey), [videos, activeKey]);
  const subjectName = nameOf(activeKey, workspaces);
  const selectedVideo = videoId != null ? videos.find((video) => video.id === videoId) : undefined;

  const chatScope = useMemo<NewChatScope>(
    () => (videoId != null ? { scope: 'video', video_id: videoId } : scopeOf(activeKey)),
    [videoId, activeKey],
  );

  const scopeLabel = selectedVideo
    ? selectedVideo.title || selectedVideo.filename
    : activeKey === 'all'
      ? 'all your lectures'
      : activeKey === 'unsorted'
        ? 'your unsorted lectures'
        : subjectName;

  const hasContent = selectedVideo
    ? selectedVideo.stage === 'ready'
    : inView.some((video) => video.stage === 'ready');

  const threadFilter: ConversationFilter =
    videoId != null
      ? { videoId }
      : activeKey === 'all'
        ? {}
        : activeKey === 'unsorted'
          ? { unsorted: true }
          : { workspaceId: activeKey };

  const threadsHeading =
    videoId != null ? 'Chats about this lecture' : activeKey === 'all' ? 'Recent chats' : `Chats in ${subjectName}`;

  const playerCitations = useMemo(
    () =>
      citations
        .filter((citation) => citation.video_id === playingId)
        .map((citation) => ({ start: citation.start ?? 0, end: citation.end ?? 0 })),
    [citations, playingId],
  );

  const activeSubject = typeof activeKey === 'number'
    ? workspaces.find((workspace) => workspace.id === activeKey)
    : undefined;

  const sidebarProps: WorkspaceSidebarProps = {
    workspaces,
    loading: subjects.loading,
    error: subjects.error,
    onClearError: subjects.clearError,
    videos,
    conversations: allChats.conversations,
    activeKey,
    selectedVideoId: videoId,
    activeConversationId: conversationId,
    onSelect: selectKey,
    onOpenLecture: openLecture,
    onOpenConversation: selectConversation,
    onMoveVideo: moveVideo,
    onCreate: subjects.create,
    onUpdate: subjects.update,
    onDelete: deleteWorkspace,
    onReorder: subjects.reorder,
  };

  return (
    <>
      <main
        id="main"
        className={cn(
          'page grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 pt-1 pb-3 lg:gap-4',
          collapsed
            ? 'lg:grid-cols-[3.5rem_minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[3.5rem_minmax(0,22.5rem)_minmax(0,1fr)]'
            : 'lg:grid-cols-[14rem_minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,22.5rem)_minmax(0,1fr)]',
        )}
      >
        <div className="hidden min-w-0 lg:sticky lg:top-[calc(var(--spacing-nav)+0.25rem)] lg:block lg:h-[calc(100dvh-var(--spacing-nav)-1rem)]">
          <WorkspaceSidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </div>

        <aside aria-label="Library and chats" className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <Button
            variant="secondary"
            block
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-haspopup="dialog"
          >
            <WorkspaceGlyph subject={activeSubject ?? (activeKey as 'all' | 'unsorted')} size="sm" />
            <span className="min-w-0 truncate">{subjectName}</span>
            <span className="ml-auto text-caption-sm text-mute-strong">Switch subject</span>
          </Button>

          <VideoUpload
            workspaceId={typeof activeKey === 'number' ? activeKey : null}
            destination={typeof activeKey === 'number' ? subjectName : 'Unsorted'}
            onUploadSuccess={handleUploadSuccess}
          />
          <VideoList
            videos={inView}
            heading={subjectName}
            workspaces={workspaces}
            loading={library.loading}
            error={library.error}
            onClearError={library.clearError}
            deletingId={library.deletingId}
            onDelete={library.deleteVideo}
            onMove={moveVideo}
            selectedId={videoId}
            onSelect={selectVideo}
          />
          <ConversationList
            filter={threadFilter}
            heading={threadsHeading}
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
            scope={chatScope}
            scopeLabel={scopeLabel}
            hasContent={hasContent}
            conversationId={conversationId}
            onConversationStarted={setConversationId}
            onTurnComplete={refreshThreads}
            onSeek={seekTo}
            onSourcesChange={setCitations}
          />
        </Card>
      </main>

      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <WorkspaceSidebar {...sidebarProps} onClose={() => setDrawerOpen(false)} />
      </SidebarDrawer>
    </>
  );
}
