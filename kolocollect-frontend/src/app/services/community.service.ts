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
   * Get the required contribution amount for joining a community mid-cycle
   * Returns the minimum contribution for first cycle or calculated amount for mid-cycle
   */
  getRequiredContribution(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/required-contribution`);
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
   * Get votes for a community
   */
  getVotes(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/votes`);
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
   * Pay second installment for a member that joined during mid-cycle
   * @param communityId The ID of the community
   * @param userId The ID of the user making the payment
   * @returns Observable with payment result
   */
  paySecondInstallment(communityId: string, userId: string): Observable<any> {
    return this.api.post<any>(`/communities/${communityId}/members/${userId}/paySecondInstallment`, {});
  }
  /**
   * Back payment distribute (using midcycle service instead)
   * @deprecated Use MidcycleService.backPaymentDistribute instead
   */
  backPaymentDistribute(communityId: string, midCycleJoinersId: string, data: any): Observable<any> {
    console.warn('This method is deprecated. Please use MidcycleService.backPaymentDistribute instead.');
    return this.api.post<any>(`/communities/${communityId}/midcycle_joiners/${midCycleJoinersId}/back_payments`, data);
  }

  /**
   * Get detailed information about the current mid-cycle
   * @deprecated Use MidcycleService.getCurrentMidCycleDetails instead
   */
  getCurrentMidCycleDetails(communityId: string): Observable<any> {
    console.warn('This method is deprecated. Please use MidcycleService.getCurrentMidCycleDetails instead.');
    return this.api.get<any>(`/communities/${communityId}/current-midcycle`);
  }

  /**
   * Get all mid-cycle joiners for a community
   * @param communityId The ID of the community
   * @returns Observable with all mid-cycle joiners
   */
  getAllMidCycleJoiners(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/midcycle_joiners`);
  }

  /**
   * Search mid-cycle joiners
   * @deprecated Use MidcycleService.searchMidcycleJoiners instead
   */
  searchMidcycleJoiners(communityId: string, midCycleJoinersId: string): Observable<any> {
    console.warn('This method is deprecated. Please use MidcycleService.searchMidcycleJoiners instead.');
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

  /**
   * Get community contribution history in hierarchical format
   * Groups midcycles by their parent cycles and provides detailed contribution information
   */
  getCommunityContributionHistory(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/contribution-history`);
  }

  /**
   * Get owing members for a community
   * These are members who joined mid-cycle and have remaining payments
   */
  getOwingMembers(communityId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/owing-members`);
  }

  /**
   * Get communities a user is a member of
   */  getUserCommunities(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/communities`);
  }

  /**
   * Calculate payment for next in line
   * @param communityId The ID of the community
   * @param contributorId The ID of the contributor making the payment
   * @param midCycleId The ID of the mid-cycle
   * @param contributionAmount The contribution amount
   * @returns Observable with payment calculation result
   */  payNextInLine(communityId: string, contributorId: string, midCycleId: string, contributionAmount: number): Observable<any> {
    console.log('Calling payNextInLine API with:', {
      url: `/communities/${communityId}/pay-next-in-line`,
      body: { contributorId, midCycleId, contributionAmount }
    });
    
    // Ensure we're using the correct API endpoint structure
    return this.api.post<any>(`/communities/${communityId}/pay-next-in-line`, {
      contributorId,
      midCycleId,
      contributionAmount
    });
  }

  /**
   * Check if a member has already contributed in the current cycle
   * @param communityId The ID of the community
   * @param userId The ID of the user to check
   * @returns Observable with contribution status
   */
  checkMemberContributionStatus(communityId: string, userId: string): Observable<any> {
    return this.api.get<any>(`/communities/${communityId}/member-contribution-status`, { userId });
  }

  /**
   * Get payout records for a community
   */
  getPayoutRecords(communityId: string): Observable<any> {
    return this.api.get<any>(`/payouts/community/${communityId}`);
  }

  
  /**
   * Check if a member is currently owing in a community.
   * @param communityId The ID of the community.
   * @param memberId The ID of the member (User ID).
   * @returns An Observable<{ isOwing: boolean }>.
   */
  isMemberOwing(communityId: string, memberId: string): Observable<{ isOwing: boolean }> {
    return this.api.get<{ isOwing: boolean }>(`/communities/${communityId}/members/${memberId}/is-owing`);
  }
}