import { saveBlob, slugify } from '@/lib/download';
import type { Turn } from '@/types/chat';

/**
 * A chat as Markdown, ready for Notion, Obsidian or a revision doc. Each answer
 * keeps its [12:04] citations and lists the passages it drew on.
 */
export function turnsToMarkdown(title: string, turns: Turn[]): string {
  const sections = turns
    .filter((turn) => turn.answer && !turn.error)
    .map((turn) => {
      const sources = turn.sources.length
        ? '\n\nSources:\n' +
          turn.sources.map((source) => `- ${source.video}, ${source.timestamp}`).join('\n')
        : '';
      return `## ${turn.question}\n\n${turn.answer.trim()}${sources}`;
    });

  const date = new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
  return `# ${title}\n\n_Exported ${date}_\n\n${sections.join('\n\n---\n\n')}\n`;
}

export function downloadNotes(title: string, turns: Turn[]): void {
  const markdown = turnsToMarkdown(title, turns);
  saveBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${slugify(title)}.md`);
}
