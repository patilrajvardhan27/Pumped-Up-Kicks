import { create } from 'zustand';
import { type ChatSlice, createChatSlice, initialChat } from './chatSlice';
import { createViewSlice, initialView, type ViewSlice } from './viewSlice';

export type AppStore = ChatSlice & ViewSlice;

/*
 * One store for the client state the workspace used to pass around by props:
 * the chat thread, the stream status and what is open. Server data stayed in
 * the fetch hooks. Components read it through small selectors so a streamed
 * token only re-renders what shows that token.
 */
export const useAppStore = create<AppStore>()((...args) => ({
  ...createChatSlice(...args),
  ...createViewSlice(...args),
}));

/** Put the store back to how a fresh page starts. Stories and sign-out used this. */
export function resetAppStore(): void {
  useAppStore.getState().stop();
  useAppStore.setState({ ...initialChat, ...initialView });
}

const NO_TURNS: never[] = [];

/** The turns for the open chat. A thread still loading showed nothing yet. */
export const selectTurns = (s: AppStore) => (s.thread.id === s.conversationId ? s.thread.turns : NO_TURNS);

/** True while a saved chat was being fetched. */
export const selectThreadLoading = (s: AppStore) => s.conversationId != null && s.thread.id !== s.conversationId;
