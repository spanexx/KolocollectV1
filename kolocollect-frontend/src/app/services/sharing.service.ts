import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Response interface for sharing operations
 */
export interface SharingResponse {
  status: string;
  message: string;
  data?: {
    shareId: string;
    shareMethod: 'email' | 'link' | 'social';
    recipients?: string[];
    shareUrl: string;
    socialLinks?: {
      twitter: string;
      facebook: string;
      whatsapp: string;
    };
  };
}

/**
 * Share method type
 */
export type ShareMethod = 'email' | 'link' | 'social';

/**
 * Payload for sharing requests
 */
export interface SharingPayload {
  shareMethod: ShareMethod;
  recipients?: string[];
}

/**
 * Service for handling sharing and exporting functionality
 */
@Injectable({
  providedIn: 'root'
})
export class SharingService {
  private apiUrl = environment.apiUrl + '/sharing';

  constructor(private http: HttpClient) { }

  /**
   * Export a community as PDF
   * @param communityId The ID of the community
   * @returns Observable with PDF blob
   */
  exportCommunityAsPdf(communityId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/communities/${communityId}/export/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Export a contribution as PDF
   * @param contributionId The ID of the contribution
   * @returns Observable with PDF blob
   */
  exportContributionAsPdf(contributionId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/contributions/${contributionId}/export/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Export a cycle as PDF
   * @param communityId The community ID
   * @param cycleId The cycle ID
   * @returns Observable with PDF blob
   */
  exportCycleAsPdf(communityId: string, cycleId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/communities/${communityId}/cycles/${cycleId}/export/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Export a midcycle as PDF
   * @param communityId The community ID
   * @param midcycleId The midcycle ID
   * @returns Observable with PDF blob
   */
  exportMidcycleAsPdf(communityId: string, midcycleId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/communities/${communityId}/midcycles/${midcycleId}/export/pdf`, {
      responseType: 'blob'
    });
  }

  /**
   * Share a community
   * @param communityId The ID of the community
   * @param payload The sharing payload
   * @returns Observable with sharing response
   */
  shareCommunity(communityId: string, payload: SharingPayload): Observable<SharingResponse> {
    return this.http.post<SharingResponse>(`${this.apiUrl}/communities/share/${communityId}`, payload);
  }

  /**
   * Share a contribution
   * @param contributionId The ID of the contribution
   * @param payload The sharing payload
   * @returns Observable with sharing response
   */
  shareContribution(contributionId: string, payload: SharingPayload): Observable<SharingResponse> {
    return this.http.post<SharingResponse>(`${this.apiUrl}/contributions/share/${contributionId}`, payload);
  }

  /**
   * Share a cycle
   * @param communityId The community ID
   * @param cycleId The cycle ID
   * @param payload The sharing payload
   * @returns Observable with sharing response
   */
  shareCycle(communityId: string, cycleId: string, payload: SharingPayload): Observable<SharingResponse> {
    return this.http.post<SharingResponse>(
      `${this.apiUrl}/communities/${communityId}/cycles/share/${cycleId}`,
      payload
    );
  }

  /**
   * Share a midcycle
   * @param communityId The community ID
   * @param midcycleId The midcycle ID
   * @param payload The sharing payload
   * @returns Observable with sharing response
   */
  shareMidcycle(communityId: string, midcycleId: string, payload: SharingPayload): Observable<SharingResponse> {
    return this.http.post<SharingResponse>(
      `${this.apiUrl}/communities/${communityId}/midcycles/share/${midcycleId}`,
      payload
    );
  }

  /**
   * Download a PDF file
   * @param blob The PDF blob
   * @param fileName The name of the file to save
   */
  downloadPdf(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
}