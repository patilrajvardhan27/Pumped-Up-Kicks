import { saveBlob } from '@/lib/download';
import { API_BASE_URL, apiClient, authHeaders, toError } from './api';

const ACCOUNT = `${API_BASE_URL}/api/account`;

class AccountService {
  /** Downloads everything stored about this account as one JSON file. */
  async exportData(): Promise<void> {
    const response = await fetch(`${ACCOUNT}/export`, { headers: await authHeaders() });
    if (!response.ok) throw await toError(response, 'Download failed');
    saveBlob(await response.blob(), 'pumped-up-kicks-export.json');
  }

  /** Deletes every lecture, transcript, chat, subject and the account record. Cannot be undone. */
  deleteAccount(): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(ACCOUNT);
  }
}

export const accountService = new AccountService();
