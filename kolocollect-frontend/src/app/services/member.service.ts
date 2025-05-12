import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Member, MemberListResponse, MemberResponse, ActiveMemberCountResponse, BatchActiveMemberCountResponse } from '../models/member.model';

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  private apiUrl = `${environment.apiUrl}/members`;
  
  constructor(private http: HttpClient) {}
  
  /**
   * Get all members with pagination
   */
  getAllMembers(page: number = 1, limit: number = 10): Observable<MemberListResponse> {
    return this.http.get<MemberListResponse>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }
  
  /**
   * Get members by community ID with pagination
   */
  getMembersByCommunityId(communityId: string, page: number = 1, limit: number = 10): Observable<MemberListResponse> {
    return this.http.get<MemberListResponse>(
      `${this.apiUrl}/community/${communityId}?page=${page}&limit=${limit}`
    );
  }
  
  /**
   * Get member by ID
   */
  getMemberById(memberId: string): Observable<MemberResponse> {
    return this.http.get<MemberResponse>(`${this.apiUrl}/${memberId}`);
  }
  
  /**
   * Update member status
   */
  updateMemberStatus(memberId: string, status: 'active' | 'inactive' | 'waiting'): Observable<MemberResponse> {
    return this.http.patch<MemberResponse>(`${this.apiUrl}/${memberId}/status`, { status });
  }
  
  /**
   * Get active member count by community ID
   */
  getActiveMemberCount(communityId: string): Observable<ActiveMemberCountResponse> {
    return this.http.get<ActiveMemberCountResponse>(`${this.apiUrl}/community/${communityId}/active-count`);
  }
  /**
   * Get active member counts for multiple communities in one batch request
   * This reduces the number of API calls needed when displaying a list of communities
   */
  getBatchActiveMemberCounts(communityIds: string[]): Observable<BatchActiveMemberCountResponse> {
    return this.http.post<BatchActiveMemberCountResponse>(
      `${this.apiUrl}/communities/active-counts`, 
      { communityIds }
    );
  }
}
