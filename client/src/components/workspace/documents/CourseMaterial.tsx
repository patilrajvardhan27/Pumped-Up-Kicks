'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  AnnouncementIcon,
  AssignmentIcon,
  CanvasIcon,
  ExternalIcon,
  PageIcon,
  PdfIcon,
  SlidesIcon,
  WordIcon,
} from '@/components/ui/icons';
import { pluralise } from '@/lib/format';
import { safeUrl } from '@/lib/timestamps';
import type { DocumentInfo } from '@/types/api';

const PDF = 'application/pdf';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function kindOf(doc: DocumentInfo): { label: string; Icon: typeof PageIcon } {
  if (doc.source === 'canvas_file') {
    if (doc.mime_type === PDF) return { label: 'PDF', Icon: PdfIcon };
    if (doc.mime_type === PPTX) return { label: 'Slides', Icon: SlidesIcon };
    if (doc.mime_type === DOCX) return { label: 'Word', Icon: WordIcon };
  }
  if (doc.source === 'canvas_announcement') return { label: 'Announcement', Icon: AnnouncementIcon };
  if (doc.source === 'canvas_assignment') return { label: 'Assignment', Icon: AssignmentIcon };
  if (doc.source === 'canvas_syllabus') return { label: 'Syllabus', Icon: PageIcon };
  return { label: 'Page', Icon: PageIcon };
}

const SHOWN = 8;

interface CourseMaterialProps {
  documents: DocumentInfo[];
}

/** What Canvas imported into the open subject, grouped by module, each one opening in Canvas. */
export function CourseMaterial({ documents }: CourseMaterialProps) {
  const [showAll, setShowAll] = useState(false);
  if (documents.length === 0) return null;

  const visible = showAll ? documents : documents.slice(0, SHOWN);
  const groups: { heading: string; items: DocumentInfo[] }[] = [];
  for (const doc of visible) {
    const heading = doc.module_name || 'Other course material';
    const group = groups.find((each) => each.heading === heading);
    if (group) group.items.push(doc);
    else groups.push({ heading, items: [doc] });
  }

  return (
    <Card as="section" padding="tile" aria-labelledby="material-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="material-heading" className="flex items-center gap-2 text-heading-sm text-ink">
          <CanvasIcon className="size-5" />
          Course material
        </h2>
        <span className="font-mono text-code-xs tabular-nums text-mute-strong">{documents.length}</span>
      </div>

      {groups.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <h3 className="text-caption-sm text-mute-strong">{group.heading}</h3>
          <ul className="flex flex-col">
            {group.items.map((doc) => {
              const { label, Icon } = kindOf(doc);
              const href = safeUrl(doc.url);
              const detail = doc.num_pages ? `${label}, ${pluralise(doc.num_pages, label === 'Slides' ? 'slide' : 'page')}` : label;
              return (
                <li key={doc.id} className="flex min-h-9 items-center gap-2 border-b border-hairline-soft last:border-b-0">
                  <Icon className="size-4 text-mute-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-xs text-ink">{doc.title}</span>
                    <span className="block text-caption-sm text-mute-strong">{detail}</span>
                  </span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${doc.title} in Canvas (new tab)`}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-mute-strong hover:bg-surface-soft hover:text-ink"
                    >
                      <ExternalIcon />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {documents.length > SHOWN && (
        <Button variant="tertiary" size="sm" onClick={() => setShowAll((all) => !all)} className="self-start">
          {showAll ? 'Show fewer' : `Show all ${documents.length}`}
        </Button>
      )}
    </Card>
  );
}
