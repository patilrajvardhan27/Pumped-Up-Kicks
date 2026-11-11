'use client';

import { useMemo, useState, type RefObject } from 'react';
import { Card } from '@/components/ui/Card';
import type { NewChatScope } from '@/hooks/useAskStream';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import type { WorkspaceView } from '@/hooks/useWorkspaceView';
import type { VideoInfo, WorkspaceInfo } from '@/types/api';
import { ChatPanel } from './chat/ChatPanel';
import { PanelTabs, type PanelTab } from './study/PanelTabs';
import { PracticePanel } from './study/PracticePanel';
import { StudyGuidePanel } from './study/StudyGuidePanel';
import { TranscriptPanel } from './transcript/TranscriptPanel';
import { VideoPlayer } from './video/VideoPlayer';

type Panel = 'chat' | 'guide' | 'transcript' | 'practice';

interface StudyColumnProps {
  view: WorkspaceView;
  playerRef: RefObject<VideoPlayerHandle | null>;
  videos: VideoInfo[];
  selectedVideo?: VideoInfo;
  activeSubject?: WorkspaceInfo;
  chatScope: NewChatScope;
  scopeLabel: string;
  hasContent: boolean;
  onTurnComplete: () => void;
}

const SCROLL = 'min-h-0 flex-1 overflow-y-auto pr-1';

/** The right-hand card: the player above, then chat, study guide, transcript or practice. */
export function StudyColumn({
  view,
  playerRef,
  videos,
  selectedVideo,
  activeSubject,
  chatScope,
  scopeLabel,
  hasContent,
  onTurnComplete,
}: StudyColumnProps) {
  const [panel, setPanel] = useState<Panel>('chat');
  const { citations, playingId, seekTo } = view;

  const playerCitations = useMemo(
    () =>
      citations
        .filter((citation) => citation.video_id === playingId)
        .map((citation) => ({ start: citation.start ?? 0, end: citation.end ?? 0 })),
    [citations, playingId],
  );

  // A study guide belongs to one lecture and practice to one subject, so each
  // tab only exists while there is one to show.
  const tabs: PanelTab<Panel>[] = [{ key: 'chat', label: 'Chat' }];
  if (selectedVideo?.stage === 'ready') {
    tabs.push({ key: 'guide', label: 'Study guide' }, { key: 'transcript', label: 'Transcript' });
  }
  if (activeSubject && !selectedVideo) tabs.push({ key: 'practice', label: 'Practice' });
  const shown = tabs.some((tab) => tab.key === panel) ? panel : 'chat';

  return (
    <Card as="section" aria-label="Chat and study" className="flex min-h-[70dvh] min-w-0 flex-col gap-4 p-4 sm:p-6 lg:min-h-0 workspace-pane">
      <VideoPlayer
        ref={playerRef}
        video={videos.find((video) => video.id === playingId) ?? null}
        citations={playerCitations}
        onClose={view.closePlayer}
      />
      <PanelTabs tabs={tabs} active={shown} onChange={setPanel} label="Chat and study tools">
        {/* The chat stays mounted behind the other tabs, so an answer still
            being written isn't lost by looking at the study guide. */}
        <div hidden={shown !== 'chat'} className="flex min-h-0 flex-1 flex-col">
          <ChatPanel
            videos={videos}
            scope={chatScope}
            scopeLabel={scopeLabel}
            hasContent={hasContent}
            conversationId={view.conversationId}
            onConversationStarted={view.setConversationId}
            onTurnComplete={onTurnComplete}
            onSeek={seekTo}
            onSourcesChange={view.setCitations}
          />
        </div>
        {shown === 'guide' && selectedVideo && (
          <div className={SCROLL}>
            <StudyGuidePanel
              key={selectedVideo.id}
              videoId={selectedVideo.id}
              title={selectedVideo.title || selectedVideo.filename}
              onSeek={seekTo}
            />
          </div>
        )}
        {shown === 'transcript' && selectedVideo && (
          <TranscriptPanel key={selectedVideo.id} videoId={selectedVideo.id} onSeek={seekTo} />
        )}
        {shown === 'practice' && activeSubject && (
          <div className={SCROLL}>
            <PracticePanel key={activeSubject.id} workspaceId={activeSubject.id} subject={activeSubject.name} onSeek={seekTo} />
          </div>
        )}
      </PanelTabs>
    </Card>
  );
}
