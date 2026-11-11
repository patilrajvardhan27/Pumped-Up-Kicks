'use client';

import { Button } from '@/components/ui/Button';
import type { useVideoLibrary } from '@/hooks/useVideoLibrary';
import type { WorkspaceView } from '@/hooks/useWorkspaceView';
import { filterOf } from '@/lib/workspaces';
import type { DocumentInfo, VideoInfo, WorkspaceInfo } from '@/types/api';
import { ConversationList } from './chat/ConversationList';
import { CourseMaterial } from './documents/CourseMaterial';
import { SearchCard } from './search/SearchCard';
import { WorkspaceGlyph } from './sidebar/WorkspaceGlyph';
import { UsageMeter } from './UsageMeter';
import { VideoUpload } from './upload/VideoUpload';
import { VideoList } from './video/VideoList';

interface LibraryColumnProps {
  view: WorkspaceView;
  library: ReturnType<typeof useVideoLibrary>;
  /** The lectures in the open subject. */
  videos: VideoInfo[];
  documents: DocumentInfo[];
  workspaces: WorkspaceInfo[];
  activeSubject?: WorkspaceInfo;
  subjectName: string;
  threadsTrigger: number;
  onUploaded: () => void;
  onMoveVideo: (id: number, workspaceId: number | null) => Promise<void>;
}

/** The middle column: search, upload, the open subject's lectures, material and chats. */
export function LibraryColumn({
  view,
  library,
  videos,
  documents,
  workspaces,
  activeSubject,
  subjectName,
  threadsTrigger,
  onUploaded,
  onMoveVideo,
}: LibraryColumnProps) {
  const { activeKey, videoId } = view;
  const subjectId = typeof activeKey === 'number' ? activeKey : null;

  const filter = filterOf(activeKey);
  const threadsHeading =
    videoId != null ? 'Chats about this lecture' : activeKey === 'all' ? 'Recent chats' : `Chats in ${subjectName}`;

  return (
    <aside aria-label="Library and chats" className="flex min-w-0 flex-col gap-4">
      <Button variant="secondary" block className="lg:hidden" onClick={() => view.setDrawerOpen(true)} aria-haspopup="dialog">
        <WorkspaceGlyph subject={activeSubject ?? (activeKey as 'all' | 'unsorted')} size="sm" />
        <span className="min-w-0 truncate">{subjectName}</span>
        <span className="ml-auto text-caption text-slate-gray">Switch subject</span>
      </Button>

      <SearchCard
        key={String(activeKey)}
        scope={filter}
        label={subjectName}
        onSeek={view.seekTo}
      />
      <VideoUpload workspaceId={subjectId} destination={subjectId != null ? subjectName : 'Unsorted'} onUploadSuccess={onUploaded} />
      <VideoList
        videos={videos}
        heading={subjectName}
        workspaces={workspaces}
        loading={library.loading}
        error={library.error}
        onClearError={library.clearError}
        deletingId={library.deletingId}
        onDelete={library.deleteVideo}
        onMove={onMoveVideo}
        selectedId={videoId}
        onSelect={view.selectVideo}
      />
      <CourseMaterial documents={documents} />
      <ConversationList
        filter={videoId != null ? { videoId } : filter}
        heading={threadsHeading}
        activeId={view.conversationId}
        refreshTrigger={threadsTrigger}
        onSelect={view.selectConversation}
      />
      <UsageMeter refreshTrigger={threadsTrigger} />
    </aside>
  );
}
