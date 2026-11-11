'use client';

import { useCallback, useMemo, useState } from 'react';
import type { NewChatScope } from '@/hooks/useAskStream';
import { useCanvas } from '@/hooks/useCanvas';
import { useConversations } from '@/hooks/useConversations';
import { useDocuments } from '@/hooks/useDocuments';
import { useDeadlines } from '@/hooks/useStudy';
import { useVideoLibrary } from '@/hooks/useVideoLibrary';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspaceShortcuts } from '@/hooks/useWorkspaceShortcuts';
import { useWorkspaceView } from '@/hooks/useWorkspaceView';
import { cn } from '@/lib/cn';
import { filterOf, matchKey, nameOf, scopeOf, videosIn } from '@/lib/workspaces';
import type { WorkspaceInfo } from '@/types/api';
import { CanvasDialog } from './canvas/CanvasDialog';
import { LibraryColumn } from './LibraryColumn';
import { SidebarDrawer } from './sidebar/SidebarDrawer';
import { WorkspaceSidebar, type WorkspaceSidebarProps } from './sidebar/WorkspaceSidebar';
import { StudyColumn } from './StudyColumn';

const bump = (n: number) => n + 1;

/**
 * The signed-in app: subjects on the left, the open subject's library and
 * chats in the middle, the player and study tools on the right. Every new
 * chat is scoped to the open subject.
 */
export function Workspace() {
  const [libraryTrigger, setLibraryTrigger] = useState(0);
  const [threadsTrigger, setThreadsTrigger] = useState(0);
  const [materialTrigger, setMaterialTrigger] = useState(0);

  const library = useVideoLibrary(libraryTrigger);
  const subjects = useWorkspaces(materialTrigger);
  const allChats = useConversations({}, threadsTrigger);
  const deadlines = useDeadlines(materialTrigger);
  const { videos } = library;
  const { workspaces } = subjects;
  const { playerRef, ...view } = useWorkspaceView(workspaces, subjects.loading);
  const { activeKey, videoId, selectKey } = view;
  const documents = useDocuments({ all: activeKey === 'all', ...filterOf(activeKey) }, materialTrigger);

  // A finished sync, or a disconnect, can add subjects and material.
  const materialChanged = useCallback(() => setMaterialTrigger(bump), []);
  const canvas = useCanvas(materialChanged);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [returnSeen, setReturnSeen] = useState(false);

  const refreshThreads = useCallback(() => setThreadsTrigger(bump), []);

  const moveVideo = useCallback(
    async (id: number, workspaceId: number | null) => {
      await library.moveVideo(id, workspaceId);
      refreshThreads(); // a lecture's own chats move with it
    },
    [library, refreshThreads],
  );

  const deleteWorkspace = useCallback(
    async (workspace: WorkspaceInfo) => {
      if (!window.confirm(`Delete “${workspace.name}”? Its lectures and chats move to Unsorted.`)) return;
      if (!(await subjects.remove(workspace.id))) return;
      if (activeKey === workspace.id) selectKey('unsorted');
      setLibraryTrigger(bump);
      refreshThreads();
    },
    [activeKey, refreshThreads, selectKey, subjects],
  );

  useWorkspaceShortcuts({
    subjectIds: workspaces.slice(0, 9).map((workspace) => workspace.id),
    onSelect: selectKey,
    onToggleSidebar: view.toggleCollapsed,
  });

  const inView = useMemo(() => videosIn(videos, activeKey), [videos, activeKey]);
  const subjectName = nameOf(activeKey, workspaces);
  const selectedVideo = videoId != null ? videos.find((video) => video.id === videoId) : undefined;
  const activeSubject = typeof activeKey === 'number' ? workspaces.find((w) => w.id === activeKey) : undefined;
  const chatScope = useMemo<NewChatScope>(
    () => (videoId != null ? { scope: 'video', video_id: videoId } : scopeOf(activeKey)),
    [videoId, activeKey],
  );
  const scopeLabel = selectedVideo
    ? selectedVideo.title || selectedVideo.filename
    : matchKey(activeKey, { all: 'all your lectures', unsorted: 'your unsorted lectures', subject: () => subjectName });
  const hasContent = selectedVideo
    ? selectedVideo.stage === 'ready'
    : inView.some((video) => video.stage === 'ready') || documents.some((doc) => doc.num_chunks > 0);

  const sidebarProps: WorkspaceSidebarProps = {
    workspaces,
    loading: subjects.loading,
    error: subjects.error,
    onClearError: subjects.clearError,
    videos,
    conversations: allChats.conversations,
    activeKey,
    selectedVideoId: videoId,
    activeConversationId: view.conversationId,
    onSelect: selectKey,
    onOpenLecture: view.openLecture,
    onOpenConversation: view.selectConversation,
    onMoveVideo: moveVideo,
    onCreate: subjects.create,
    onUpdate: subjects.update,
    onDelete: deleteWorkspace,
    onReorder: subjects.reorder,
    canvasStatus: canvas.status,
    onOpenCanvas: () => {
      setCanvasOpen(true);
      view.setDrawerOpen(false);
    },
    deadlines,
  };

  return (
    <>
      <main
        id="main"
        className={cn(
          'page grid flex-1 grid-cols-[minmax(0,1fr)] gap-4 py-4 lg:gap-6',
          view.collapsed
            ? 'lg:grid-cols-[3.5rem_minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[3.5rem_minmax(0,22.5rem)_minmax(0,1fr)]'
            : 'lg:grid-cols-[14rem_minmax(0,18rem)_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,22.5rem)_minmax(0,1fr)]',
        )}
      >
        <div className="hidden min-w-0 workspace-pane lg:block">
          <WorkspaceSidebar {...sidebarProps} collapsed={view.collapsed} onToggleCollapsed={view.toggleCollapsed} />
        </div>
        <LibraryColumn
          view={view}
          library={library}
          videos={inView}
          documents={documents}
          workspaces={workspaces}
          activeSubject={activeSubject}
          subjectName={subjectName}
          threadsTrigger={threadsTrigger}
          onUploaded={() => setLibraryTrigger(bump)}
          onMoveVideo={moveVideo}
        />
        <StudyColumn
          view={view}
          playerRef={playerRef}
          videos={videos}
          selectedVideo={selectedVideo}
          activeSubject={activeSubject}
          chatScope={chatScope}
          scopeLabel={scopeLabel}
          hasContent={hasContent}
          onTurnComplete={refreshThreads}
        />
      </main>

      <SidebarDrawer open={view.drawerOpen} onClose={() => view.setDrawerOpen(false)}>
        <WorkspaceSidebar {...sidebarProps} onClose={() => view.setDrawerOpen(false)} />
      </SidebarDrawer>

      <CanvasDialog
        open={canvasOpen || (canvas.outcome !== null && !returnSeen)}
        onClose={() => {
          setCanvasOpen(false);
          setReturnSeen(true);
        }}
        canvas={canvas}
        workspaces={workspaces}
        hideOutcome={returnSeen}
      />
    </>
  );
}
