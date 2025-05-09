import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Community } from '../models/community.model';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  constructor(private api: ApiService) {}

  /**
   * Get all communities
   */
  getAllCommunities(params: { page?: number; limit?: number } = {}): Observable<any> {
    return this.api.get<any>('/communities/all', params);
  }

  /**
   * Get community by ID
   */
  getCommunityById(id: string): Observable<any> {
    return this.api.get<any>(`/communities/${id}`);
  }

  /**
   * Search communities
   */
  searchCommunities(query: string): Observable<any> {
    return this.api.get<any>('/communities/search', { keyword: query });
  }

  /**
   * Filter communities
   * @param filters Object containing filter parameters:
   * - status: 'active' to show only active communities
   * - backupFundMin: minimum backup fund amount
   * - minContribution: minimum contribution amount
   * - contributionFrequency: frequency of contributions
   * - sortBy: field to sort by (memberCount, minContribution, backupFund, createdAt)
   * - order: 'asc' or 'desc'
   * - page: page number (1-based)
   * - limit: number of results per page
   */
  filterCommunities(filters: any = {}): Observable<any> {
    return this.api.get<any>('/communities/filter', filters);
  }

  /**
   * Create a new community
   */
  createCommunity(communityData: any): Observable<any> {
    return this.api.post<any>('/communities', communityData);
  }

  /**
   * Join an existing community
   */
  joinCommunity(communityId: string, userData: any): Observable<any> {
    return this.api.post<any>(`/communities/join/${communityId}`, userData);
  }

  /**
   * Update community settings
   */
  updateSettings(communityId: string, settings: any): Observable<any> {
    return this.api.put<any>(`/communities/${communityId}`, settings);
  }

  /**
   * Delete a community
   */
  deleteCommunity(communityId: string): Observable<any> {
    return this.api.delete<any>(`/communities/${communityId}`);
  }

  /**
   * Distribute payouts for a community
   */
  distributePayouts(communityId: string): Observable<any> {
    return this.api.post<any>(`/communities/payouts/distribute/${communityId}`, {});
  }

  /**
   * Reactivate a member in a community
   */
  reactivateMember(communityId: string, userId: string): Observable<any> {
    return this.api.post<any>(`/communities/member/reactivate/${communityId}/${userId}`, {});
  }

  /**
   * Create a new vote
   */
  createVote(communityId: string, voteData: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/votes`, voteData);
  }

  /**
   * Cast a vote
   */
  castVote(communityId: string, voteId: string, voteData: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/votes/${voteId}`, voteData);
  }

  /**
   * Get mid-cycle contributions
   */
  getMidCycleContributions(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycle-contributions`);
  }

  /**
   * Get payout information
   */
  getPayoutInfo(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/payout/${communityId}`);
  }

  /**
   * Pay penalty and missed contributions
   */
  payPenaltyAndMissedContribution(communityId: string, userId: string, paymentData: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/members/${userId}/payPenaltyAndMissedContribution`, paymentData);
  }

  /**
   * Skip contribution and mark mid-cycle as ready
   */
  skipContributionAndMarkReady(communityId: string, midCycleId: string, data: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/midCycles/${midCycleId}/skipContributionAndMarkReady`, data);
  }

  /**
   * Update member details
   */
  memberUpdate(communityId: string, userId: string, memberData: any): Observable<any> {
    return this.api.put<any>(`/communities/${communityId}/members/${userId}`, memberData);
  }

  /**
   * Pay second installment
   */
  paySecondInstallment(communityId: string, userId: string, paymentData: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/members/${userId}/paySecondInstallment`, paymentData);
  }

  /**
   * Back payment distribute
   */
  backPaymentDistribute(communityId: string, midCycleJoinersId: string, data: any): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/midcycle_joiners/${midCycleJoinersId}/back_payments`, data);
  }

  /**
   * Search mid-cycle joiners
   */
  searchMidcycleJoiners(communityId: string, midCycleJoinersId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycle_joiners/${midCycleJoinersId}`);
  }

  /**
   * Handle wallet operations for defaulters
   */
  handleWalletForDefaulters(communityId: string, userId: string, action: 'freeze' | 'unfreeze'): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/defaulters/${userId}/wallet`, { action });
  }

  /**
   * Leave a community
   */
  leaveCommunity(communityId: string, userId: string): Observable<any> {
    return this.api.delete<any>(`/communities/${communityId}/leave/${userId}`);
  }

  /**
   * Start a new cycle
   */
  startNewCycle(communityId: string): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/startNewCycle`, {});
  }
}