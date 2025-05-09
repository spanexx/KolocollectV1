import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class MidcycleService {
  constructor(private api: ApiService) {}

  /**
   * Get all mid-cycles for a community
   */
  getAllMidCycles(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycles`);
  }

  /**
   * Get mid-cycle by ID
   */
  getMidCycleById(communityId: string, midCycleId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycles/${midCycleId}`);
  }

  /**
   * Get active mid-cycle for a community
   */
  getActiveMidCycle(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycles/active`);
  }

  /**
   * Get mid-cycle contributions
   */
  getMidCycleContributions(midCycleId: string): Observable<any> {
    return this.api.get<any>(`/contributions/midcycle/${midCycleId}`);
  }

  /**
   * Skip contribution and mark mid-cycle ready
   */
  skipContributionAndMarkReady(communityId: string, midCycleId: string, data: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/midCycles/${midCycleId}/skipContributionAndMarkReady`, data);
  }

  /**
   * Check mid-cycle readiness status
   */
  checkMidCycleReadiness(communityId: string, midCycleId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midCycles/${midCycleId}/readiness`);
  }

  /**
   * Get upcoming payouts
   */
  getUpcomingPayouts(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/upcoming-payouts`);
  }

  /**
   * Handle mid-cycle joiners
   */
  getMidCycleJoiners(communityId: string, midCycleId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycles/${midCycleId}/joiners`);
  }
}