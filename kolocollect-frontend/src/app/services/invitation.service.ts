import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Invitation {
  id: string;
  communityId: string;
  inviterId: string;
  inviteCode: string;
  inviteType: 'email' | 'phone' | 'link';
  inviteeEmail?: string;
  inviteePhone?: string;
  status: 'pending' | 'accepted' | 'expired' | 'rejected' | 'cancelled';
  customMessage?: string;
  acceptedBy?: string;
  acceptedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  community?: {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    maxMembers?: number;
  };
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  cancelled: number;
  rejected: number;
}

export interface CreateInvitationRequest {
  inviteType: 'email' | 'phone' | 'link';
  inviteeEmail?: string;
  inviteePhone?: string;
  customMessage?: string;
  expiresIn?: number;
}

export interface CreateInvitationResponse {
  success: boolean;
  message: string;
  data: {
    invitationId: string;
    inviteCode: string;
    inviteLink: string;
    expiresAt: string;
    status: string;
  };
}

export interface InvitationListResponse {
  success: boolean;
  data: {
    invitations: Invitation[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      limit: number;
    };
    statistics: InvitationStats;
  };
}

export interface InvitationDetailResponse {
  success: boolean;
  data: {
    invitation: Invitation;
  };
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private readonly baseUrl = environment.apiUrl;
  private invitationStatsSubject = new BehaviorSubject<InvitationStats | null>(null);
  public invitationStats$ = this.invitationStatsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Create a new invitation for a community
   */
  createInvitation(communityId: string, invitationData: CreateInvitationRequest): Observable<CreateInvitationResponse> {
    return this.http.post<CreateInvitationResponse>(`${this.baseUrl}/communities/${communityId}/invitations`, invitationData)
      .pipe(
        map(response => {
          if (response.success) {
            // Refresh stats after creating invitation
            this.refreshInvitationStats(communityId);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get all invitations for a community
   */
  getCommunityInvitations(
    communityId: string, 
    filters: { status?: string; inviterId?: string } = {},
    pagination: { page?: number; limit?: number } = {}
  ): Observable<InvitationListResponse> {
    let params = new HttpParams();
    
    if (filters.status) params = params.set('status', filters.status);
    if (filters.inviterId) params = params.set('inviterId', filters.inviterId);
    if (pagination.page) params = params.set('page', pagination.page.toString());
    if (pagination.limit) params = params.set('limit', pagination.limit.toString());

    return this.http.get<InvitationListResponse>(`${this.baseUrl}/communities/${communityId}/invitations`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data.statistics) {
            this.invitationStatsSubject.next(response.data.statistics);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Get invitation by code (public endpoint)
   */
  getInvitationByCode(inviteCode: string): Observable<InvitationDetailResponse> {
    return this.http.get<InvitationDetailResponse>(`${this.baseUrl}/invitations/${inviteCode}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Accept an invitation
   */
  acceptInvitation(inviteCode: string, userId?: string): Observable<any> {
    const body = userId ? { userId } : {};
    return this.http.post(`${this.baseUrl}/invitations/${inviteCode}/accept`, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * Cancel an invitation
   */
  cancelInvitation(inviteCode: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/invitations/${inviteCode}`, { status: 'cancelled' })
      .pipe(catchError(this.handleError));
  }

  /**
   * Resend an invitation
   */
  resendInvitation(invitationId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/invitations/${invitationId}/resend`, {})
      .pipe(catchError(this.handleError));
  }

  /**
   * Get invitation statistics for a community
   */
  getInvitationStats(communityId: string): Observable<{ success: boolean; data: { statistics: InvitationStats } }> {
    return this.http.get<{ success: boolean; data: { statistics: InvitationStats } }>(`${this.baseUrl}/communities/${communityId}/invitations/stats`)
      .pipe(
        map(response => {
          if (response.success) {
            this.invitationStatsSubject.next(response.data.statistics);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  /**
   * Generate invitation link
   */
  generateInvitationLink(inviteCode: string): string {
    return `${window.location.origin}/invite/${inviteCode}`;
  }

  /**
   * Copy invitation link to clipboard
   */
  async copyInvitationLink(inviteCode: string): Promise<boolean> {
    try {
      const link = this.generateInvitationLink(inviteCode);
      await navigator.clipboard.writeText(link);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Share invitation via social media
   */
  shareInvitation(inviteCode: string, platform: 'twitter' | 'facebook' | 'whatsapp' | 'email', communityName: string): void {
    const link = this.generateInvitationLink(inviteCode);
    const text = `Join me in the ${communityName} community on Kolocollect!`;
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent('Invitation to join ' + communityName)}&body=${encodeURIComponent(text + '\n\n' + link)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  }

  /**
   * Refresh invitation statistics
   */
  private refreshInvitationStats(communityId: string): void {
    this.getInvitationStats(communityId).subscribe();
  }

  /**
   * Handle HTTP errors
   */
  private handleError = (error: any): Observable<never> => {
    console.error('Invitation service error:', error);
    throw error;
  };

  /**
   * Get current invitation statistics
   */
  getCurrentStats(): InvitationStats | null {
    return this.invitationStatsSubject.value;
  }

  /**
   * Format invitation expiry date
   */
  formatExpiryDate(expiresAt: string | Date): string {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Expired';
    } else if (diffDays === 0) {
      return 'Expires today';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else {
      return `Expires in ${diffDays} days`;
    }
  }

  /**
   * Check if invitation is expired
   */
  isInvitationExpired(expiresAt: string | Date): boolean {
    return new Date(expiresAt) < new Date();
  }

  /**
   * Get status color for UI
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'orange';
      case 'accepted': return 'green';
      case 'expired': return 'red';
      case 'cancelled': return 'gray';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  }

  /**
   * Get status icon for UI
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'clock';
      case 'accepted': return 'check-circle';
      case 'expired': return 'x-circle';
      case 'cancelled': return 'minus-circle';
      case 'rejected': return 'x-circle';
      default: return 'help-circle';
    }
  }
}
