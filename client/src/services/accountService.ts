import { apiClient, API_ENDPOINTS } from './api';

class AccountService {
  /** Downloads everything stored about this account as one JSON file. */
  exportData(): Promise<void> {
    return apiClient.download(API_ENDPOINTS.ACCOUNT_EXPORT, 'pumped-up-kicks-export.json');
  }

  /** Deletes every lecture, transcript, chat and the account record. Cannot be undone. */
  deleteAccount(): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.ACCOUNT);
  }
}

export const accountService = new AccountService();
