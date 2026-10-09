import { apiClient, API_ENDPOINTS } from './api';
import type { Deadline, PracticeKind, PracticeSet, SearchHit, StudyGuide } from '@/types/api';

class StudyService {
  /** Null until a guide has been made for this lecture. */
  async guide(videoId: number): Promise<StudyGuide | null> {
    const { guide } = await apiClient.get<{ guide: StudyGuide | null }>(API_ENDPOINTS.STUDY_GUIDE(videoId));
    return guide;
  }

  /** Makes the guide the first time; afterwards returns the stored one at no cost. */
  async makeGuide(videoId: number): Promise<StudyGuide> {
    const { guide } = await apiClient.post<{ guide: StudyGuide }>(API_ENDPOINTS.STUDY_GUIDE(videoId), {});
    return guide;
  }

  async practiceSets(workspaceId: number): Promise<PracticeSet[]> {
    return apiClient.get<PracticeSet[]>(API_ENDPOINTS.PRACTICE(workspaceId));
  }

  async makePractice(
    workspaceId: number,
    request: { kind: PracticeKind; count: number; focus?: string },
  ): Promise<PracticeSet> {
    return apiClient.post<PracticeSet>(API_ENDPOINTS.PRACTICE(workspaceId), request);
  }

  async deletePractice(id: number): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(API_ENDPOINTS.PRACTICE_SET(id));
  }

  /** Every subject's upcoming Canvas deadlines, soonest first. */
  async deadlines(): Promise<Deadline[]> {
    return apiClient.get<Deadline[]>(API_ENDPOINTS.DEADLINES);
  }

  async search(q: string, scope: { workspaceId?: number | null; unsorted?: boolean }): Promise<SearchHit[]> {
    const params = new URLSearchParams({ q });
    if (scope.workspaceId != null) params.set('workspace_id', String(scope.workspaceId));
    else if (scope.unsorted) params.set('unsorted', 'true');
    return apiClient.get<SearchHit[]>(`${API_ENDPOINTS.SEARCH}?${params.toString()}`);
  }
}

export const studyService = new StudyService();
