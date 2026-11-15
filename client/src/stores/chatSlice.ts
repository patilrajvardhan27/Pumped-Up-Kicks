import type { StateCreator } from 'zustand';
import { track } from '@/lib/analytics';
import { ApiError } from '@/services/api';
import { chatService } from '@/services/chatService';
import type { ConversationDetail, StreamEvent } from '@/types/api';
import type { NewChatScope, Turn } from '@/types/chat';
import type { AppStore } from './appStore';

const TOP_K = 5;
const DIDNT_FINISH = 'The answer did not finish. Send the question again.';

export interface ChatSlice {
  /** The turns on screen and the conversation they belong to; null is an unsaved chat. */
  thread: { id: number | null; turns: Turn[] };
  busy: boolean;
  quotaError: string | null;

  loadThread: (id: number) => Promise<void>;
  patchTurn: (key: string, change: Partial<Turn> | ((turn: Turn) => Partial<Turn>)) => void;
  ask: (question: string, scope: NewChatScope) => Promise<void>;
  stop: () => void;
  clearQuotaError: () => void;
}

export const initialChat = {
  thread: { id: null, turns: [] },
  busy: false,
  quotaError: null,
} satisfies Partial<ChatSlice>;

// The one stream in flight. We kept it out of state since nothing renders it.
let inFlight: AbortController | null = null;

/** Rebuilt the question and answer pairs, citations included, from a saved thread. */
function restoreTurns(detail: ConversationDetail): Turn[] {
  return detail.messages.flatMap((message, i) => {
    if (message.role !== 'user') return [];
    const reply = detail.messages[i + 1];
    const answered = reply?.role === 'assistant';
    return [{
      key: `m${message.id}`,
      question: message.content,
      answer: answered ? reply.content : '',
      sources: answered ? reply.sources : [],
      costUsd: answered ? (reply.cost_usd ?? null) : null,
      streaming: false,
    }];
  });
}

const scopeLabel = (conversationId: number | null, scope: NewChatScope) =>
  conversationId != null ? 'thread' : scope.scope === 'video' ? 'lecture' : scope.scope === 'workspace' ? 'subject' : 'library';

export const createChatSlice: StateCreator<AppStore, [], [], ChatSlice> = (set, get) => ({
  ...initialChat,

  // Only kept the result if the student was still looking at that chat.
  loadThread: async (id) => {
    let turns: Turn[] = [];
    try {
      turns = restoreTurns(await chatService.getConversation(id));
    } catch {
      // An unreadable thread opened empty rather than breaking the pane.
    }
    if (get().conversationId !== id || get().thread.id === id) return;
    set({ thread: { id, turns }, citations: turns.at(-1)?.sources ?? [] });
  },

  patchTurn: (key, change) =>
    set((state) => ({
      thread: {
        ...state.thread,
        turns: state.thread.turns.map((turn) =>
          turn.key === key ? { ...turn, ...(typeof change === 'function' ? change(turn) : change) } : turn,
        ),
      },
    })),

  ask: async (question, scope) => {
    const text = question.trim();
    const { busy, conversationId, patchTurn } = get();
    if (!text || busy) return;
    track('question_asked', { scope: scopeLabel(conversationId, scope) });

    const key = `t${Date.now()}`;
    set((state) => ({
      busy: true,
      quotaError: null,
      thread: {
        id: conversationId,
        turns: [...(state.thread.id === conversationId ? state.thread.turns : []), { key, question: text, answer: '', sources: [], streaming: true }],
      },
    }));
    const controller = new AbortController();
    inFlight = controller;

    const onEvent = (event: StreamEvent) => {
      if (event.type === 'conversation' && get().conversationId == null) {
        // Adopted the new id before the answer finished, so the pane never refetched mid-stream.
        set((state) => ({ conversationId: event.conversation_id, thread: { ...state.thread, id: event.conversation_id } }));
      } else if (event.type === 'sources') {
        patchTurn(key, { sources: event.sources });
        set({ citations: event.sources });
      }
      else if (event.type === 'delta') patchTurn(key, (turn) => ({ answer: turn.answer + event.text }));
      else if (event.type === 'done') {
        patchTurn(key, { answer: event.answer, sources: event.sources, usage: event.usage, responseTime: event.response_time, streaming: false });
        set({ citations: event.sources });
      } else if (event.type === 'error') patchTurn(key, { error: event.message, streaming: false });
    };

    const target = conversationId != null ? { conversation_id: conversationId } : scope;
    try {
      await chatService.streamQuery({ question: text, top_k: TOP_K, ...target }, onEvent, controller.signal);
      get().bumpThreads();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        patchTurn(key, { stopped: true });
      } else if (err instanceof ApiError && err.status === 402) {
        set((state) => ({ quotaError: err.message, thread: { ...state.thread, turns: state.thread.turns.filter((t) => t.key !== key) } }));
      } else {
        patchTurn(key, { error: err instanceof Error ? err.message : DIDNT_FINISH });
      }
    } finally {
      patchTurn(key, { streaming: false });
      if (inFlight === controller) inFlight = null;
      set({ busy: false });
    }
  },

  stop: () => inFlight?.abort(),
  clearQuotaError: () => set({ quotaError: null }),
});
