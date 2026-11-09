import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  AllLecturesIcon,
  SubjectAtomIcon,
  SubjectBookIcon,
  SubjectBrainIcon,
  SubjectChartIcon,
  SubjectCodeIcon,
  SubjectDnaIcon,
  SubjectFlaskIcon,
  SubjectFunctionIcon,
  SubjectGlobeIcon,
  SubjectMusicIcon,
  SubjectPaletteIcon,
  SubjectScalesIcon,
  UnsortedIcon,
} from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { tileClass, type WorkspaceKey } from '@/lib/workspaces';
import type { WorkspaceColor, WorkspaceIcon } from '@/types/api';

export const SUBJECT_ICONS: Record<WorkspaceIcon, ComponentType<IconProps>> = {
  book: SubjectBookIcon,
  flask: SubjectFlaskIcon,
  function: SubjectFunctionIcon,
  code: SubjectCodeIcon,
  globe: SubjectGlobeIcon,
  atom: SubjectAtomIcon,
  dna: SubjectDnaIcon,
  chart: SubjectChartIcon,
  palette: SubjectPaletteIcon,
  music: SubjectMusicIcon,
  scales: SubjectScalesIcon,
  brain: SubjectBrainIcon,
};

interface WorkspaceGlyphProps {
  /** A subject's colour and icon, or one of the two built-in groups. */
  subject: { color: WorkspaceColor; icon: WorkspaceIcon } | Exclude<WorkspaceKey, number>;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE = { sm: 'size-6 [&>svg]:size-3.5', md: 'size-7 [&>svg]:size-4' };

/** The square tile that stands for a subject everywhere it appears. Decorative. */
export function WorkspaceGlyph({ subject, size = 'md', className }: WorkspaceGlyphProps) {
  const base = cn('inline-flex shrink-0 items-center justify-center rounded-sm', SIZE[size], className);

  if (subject === 'all') {
    return (
      <span aria-hidden="true" className={cn(base, 'bg-surface-dark text-on-dark')}>
        <AllLecturesIcon />
      </span>
    );
  }
  if (subject === 'unsorted') {
    return (
      <span aria-hidden="true" className={cn(base, 'border border-hairline-strong bg-surface-card text-ink')}>
        <UnsortedIcon />
      </span>
    );
  }

  const Glyph = SUBJECT_ICONS[subject.icon] ?? SubjectBookIcon;
  return (
    <span aria-hidden="true" className={cn(base, tileClass(subject.color), 'text-on-dark')}>
      <Glyph />
    </span>
  );
}
