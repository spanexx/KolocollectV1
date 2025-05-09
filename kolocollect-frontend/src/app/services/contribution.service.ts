import { Injectable } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { ApiService } from './api.service';
import { Contribution } from '../models/contribution.model';
import { CommunityService } from './community.service';

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  constructor(
    private api: ApiService,
    private communityService: CommunityService
  ) {}

  /**
   * Get all contributions
   */
  getContributions(): Observable<any> {
    return this.api.get<any>('/contributions');
  }

  /**
   * Get a specific contribution by ID
   */
  getContributionById(id: string): Observable<any> {
    return this.api.get<any>(`/contributions/${id}`);
  }

  /**
   * Create a new contribution
   */
  createContribution(contributionData: any): Observable<any> {
    return this.api.post<any>('/contributions/create', contributionData);
  }

  /**
   * Update an existing contribution
   */
  updateContribution(id: string, contributionData: any): Observable<any> {
    return this.api.put<any>(`/contributions/${id}`, contributionData);
  }

  /**
   * Delete a contribution
   */
  deleteContribution(id: string): Observable<any> {
    return this.api.delete<any>(`/contributions/${id}`);
  }

  /**
   * Get all contributions for a specific community
   */
  getContributionsByCommunity(communityId: string): Observable<any> {
    return this.api.get<any>(`/contributions/community/${communityId}`);
  }

  /**
   * Get all contributions by a specific user
   */
  getContributionsByUser(userId: string): Observable<any> {
    return this.api.get<any>(`/contributions/user/${userId}`);
  }
  
  /**
   * Get all contributions by a specific user with community details
   */
  getContributionsWithCommunityDetails(userId: string): Observable<any> {
    return this.getContributionsByUser(userId).pipe(
      map((contributions: any[]) => {
        if (!Array.isArray(contributions)) return [];
        
        // Process each contribution to ensure it has proper community data
        return contributions.map(contribution => {
          return {
            ...contribution,
            id: contribution._id || contribution.id,
            communityId: typeof contribution.communityId === 'object' ? 
              (contribution.communityId?._id || contribution.communityId?.id) : 
              contribution.communityId,
            communityName: contribution.communityName || 
              (contribution.community?.name || contribution.community?.displayName) ||
              'Loading...'
          };
        });
      })
    );
  }
}