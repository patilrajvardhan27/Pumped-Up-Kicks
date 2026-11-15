import { delay, http, HttpResponse } from 'msw';
import { API_BASE_URL } from '@/services/api';
import type { StreamEvent } from '@/types/api';
import { TRANSCRIPT, USAGE_NEAR_LIMIT, VIDEOS } from './fixtures';
import { recordedAnswer, sseStream } from './sse';

const api = (path: string) => `${API_BASE_URL}${path}`;

/** The chat stream, replaying `events` with a pause between each. */
export const streamHandler = (events: StreamEvent[] = recordedAnswer(), delayMs = 40) =>
  http.post(api('/api/chat/stream'), () =>
    new HttpResponse(sseStream(events, delayMs), { headers: { 'Content-Type': 'text/event-stream' } }),
  );

/** A health check that said the API was up, or down. */
export const healthHandler = (status: 'ok' | 'degraded' | 'offline' = 'ok') =>
  http.get(api('/health'), () => (status === 'offline' ? HttpResponse.error() : HttpResponse.json({ status })));

/** An endpoint that failed with the API's usual { detail } body. */
export const failingHandler = (method: 'get' | 'post', path: string, status: number, detail: string) =>
  http[method](api(path), async () => {
    await delay(150);
    return HttpResponse.json({ detail }, { status });
  });

/** What every story started with: a healthy API, two ready lectures and an empty chat history. */
export const defaultHandlers = [
  healthHandler(),
  streamHandler(),
  http.get(api('/api/chat/usage'), () => HttpResponse.json(USAGE_NEAR_LIMIT)),
  http.get(api('/api/chat/conversations'), () => HttpResponse.json([])),
  http.get(api('/api/videos'), () => HttpResponse.json({ total: VIDEOS.length, videos: VIDEOS })),
  http.get(api('/api/videos/:id/transcript'), ({ params }) =>
    HttpResponse.json({ video_id: Number(params.id), title: VIDEOS[0].title, lines: TRANSCRIPT }),
  ),
  http.get(api('/api/workspaces'), () => HttpResponse.json([])),
  http.get(api('/api/documents'), () => HttpResponse.json([])),
  http.get(api('/api/deadlines'), () => HttpResponse.json([])),
  // Anything else aimed at the API got a 501, so a story never reached a real server.
  http.all(api('/*'), ({ request }) => HttpResponse.json({ detail: `No mock for ${request.method} ${new URL(request.url).pathname}` }, { status: 501 })),
];
