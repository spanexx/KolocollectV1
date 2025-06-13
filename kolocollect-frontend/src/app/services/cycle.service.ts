import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class CycleService {
  constructor(private api: ApiService) {}

  /**
   * Get cycle details by ID for a specific community
   * @param communityId The community ID
   * @param cycleId The cycle ID
   * @returns Observable with cycle details
   */
  getCycleById(communityId: string, cycleId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/cycles/${cycleId}`);
  }

  /**
   * Get all cycles for a community
   * @param communityId The community ID
   * @returns Observable with cycles list
   */
  getCommunityActiveCycles(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/cycles`);
  }
}
