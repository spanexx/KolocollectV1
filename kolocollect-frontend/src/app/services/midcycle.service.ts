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
    return this.api.get<any>(`/midcycles/community/${communityId}/all`);
  }
  /**
   * Get mid-cycle by ID
   */
  getMidCycleById(communityId: string, midCycleId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/community/${communityId}/midcycle/${midCycleId}`);
  }

  /**
   * Get active mid-cycle for a community
   */
  getActiveMidCycle(communityId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/community/${communityId}/active`);
  }
  /**
   * Get mid-cycle contributions
   */
  getMidCycleContributions(midCycleId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/${midCycleId}/contributions`);
  }

  /**
   * Skip contribution and mark mid-cycle ready
   */
  skipContributionAndMarkReady(communityId: string, midCycleId: string, data: any): Observable<any> {
    return this.api.post<any>(`/midcycles/${midCycleId}/skipContribution`, data);
  }

  /**
   * Check mid-cycle readiness status
   */
  checkMidCycleReadiness(communityId: string, midCycleId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/${midCycleId}/readiness`);
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
    return this.api.get<any>(`/midcycles/${midCycleId}/joiners`);
  }
  
  /**
   * Get current mid-cycle details for a community
   */
  getCurrentMidCycleDetails(communityId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/community/${communityId}/current`);
  }
  
  /**
   * Start a new mid-cycle for a community
   */
  startMidCycle(communityId: string): Observable<any> {
    return this.api.post<any>(`/midcycles/community/${communityId}/start`, {});
  }
  
  /**
   * Handle back payment distribution for mid-cycle joiners
   */
  backPaymentDistribute(midCycleId: string, joinerId: string): Observable<any> {
    return this.api.post<any>(`/midcycles/${midCycleId}/joiners/${joinerId}/distribute`, {});
  }
  
  /**
   * Search mid-cycle joiners
   */
  searchMidcycleJoiners(midCycleId: string, joinerId: string): Observable<any> {
    return this.api.get<any>(`/midcycles/${midCycleId}/joiners/${joinerId}`);
  }
}