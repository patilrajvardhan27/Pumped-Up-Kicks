import { readFileSync } from 'node:fs';
import path from 'node:path';

/*
 * Social images and app icons are rendered to PNG outside the CSS pipeline, so
 * they cannot use var(--color-*). They read the same tokens.css instead, which
 * keeps a single source of truth for every colour. Build-time only.
 */
const CSS = readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

export function tokenColor(name: string): string {
  const match = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Colour token --color-${name} not found in tokens.css`);
  return match[1];
}
