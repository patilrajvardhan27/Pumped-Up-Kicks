import type { ChatScope, VideoInfo, WorkspaceColor, WorkspaceIcon, WorkspaceInfo } from '@/types/api';

/**
 * Which part of the library is open: one subject by id, the lectures in no
 * subject, or everything.
 */
export type WorkspaceKey = number | 'unsorted' | 'all';

/** Subject colours, each an existing token. Contrast with white icons is 3:1 or better. */
export const WORKSPACE_COLORS: { key: WorkspaceColor; label: string; tile: string }[] = [
  { key: 'blue', label: 'Blue', tile: 'bg-accent-blue' },
  { key: 'green', label: 'Green', tile: 'bg-accent-green' },
  { key: 'red', label: 'Red', tile: 'bg-accent-red' },
  { key: 'purple', label: 'Purple', tile: 'bg-accent-purple' },
  { key: 'teal', label: 'Teal', tile: 'bg-link-teal' },
  { key: 'olive', label: 'Olive', tile: 'bg-body' },
];

export const WORKSPACE_ICONS: { key: WorkspaceIcon; label: string }[] = [
  { key: 'book', label: 'Book' },
  { key: 'flask', label: 'Flask' },
  { key: 'function', label: 'Function' },
  { key: 'code', label: 'Code' },
  { key: 'globe', label: 'Globe' },
  { key: 'atom', label: 'Atom' },
  { key: 'dna', label: 'DNA' },
  { key: 'chart', label: 'Chart' },
  { key: 'palette', label: 'Palette' },
  { key: 'music', label: 'Music' },
  { key: 'scales', label: 'Scales' },
  { key: 'brain', label: 'Brain' },
];

export const tileClass = (color: WorkspaceColor) =>
  WORKSPACE_COLORS.find((option) => option.key === color)?.tile ?? 'bg-body';

/** New subjects take the next colour in turn, so neighbours rarely match. */
export const nextColor = (existing: WorkspaceInfo[]): WorkspaceColor =>
  WORKSPACE_COLORS[existing.length % WORKSPACE_COLORS.length].key;

/** Which subject a lecture belongs in, as a key. */
export const keyOfVideo = (video: VideoInfo): WorkspaceKey => video.workspace_id ?? 'unsorted';

export function videosIn(videos: VideoInfo[], key: WorkspaceKey): VideoInfo[] {
  if (key === 'all') return videos;
  return videos.filter((video) => keyOfVideo(video) === key);
}

export function nameOf(key: WorkspaceKey, workspaces: WorkspaceInfo[]): string {
  if (key === 'all') return 'All lectures';
  if (key === 'unsorted') return 'Unsorted';
  return workspaces.find((workspace) => workspace.id === key)?.name ?? 'This subject';
}

/** The request fields for a new chat over everything in `key`. */
export function scopeOf(key: WorkspaceKey): { scope: ChatScope; workspace_id?: number | null } {
  if (key === 'all') return { scope: 'all' };
  return { scope: 'workspace', workspace_id: key === 'unsorted' ? null : key };
}

/** Where a conversation lives in the sidebar. Threads across everything live under All. */
export function keyOfConversation(conversation: { scope: ChatScope; workspace_id?: number | null }): WorkspaceKey {
  if (conversation.scope === 'all') return 'all';
  return conversation.workspace_id ?? 'unsorted';
}

/**
 * Parse a stored key. Pass the loaded subjects to reject one that no longer
 * exists, or null while they are still loading to take the id on trust.
 */
export function parseKey(raw: string | null, workspaces: WorkspaceInfo[] | null): WorkspaceKey | null {
  if (raw === 'all' || raw === 'unsorted') return raw;
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) return null;
  if (workspaces === null) return id;
  return workspaces.some((workspace) => workspace.id === id) ? id : null;
}

/** Move `id` to sit before `beforeId` (or to the end when null). */
export function reordered(ids: number[], id: number, beforeId: number | null): number[] {
  const rest = ids.filter((each) => each !== id);
  const at = beforeId == null ? rest.length : rest.indexOf(beforeId);
  return [...rest.slice(0, at < 0 ? rest.length : at), id, ...rest.slice(at < 0 ? rest.length : at)];
}
