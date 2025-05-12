import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Payout } from '../models/payout.model';

@Injectable({
  providedIn: 'root'
})
export class PayoutService {
  constructor(private api: ApiService) {}

  /**
   * Get all payouts for a specific community
   */
  getPayoutsByCommunity(communityId: string): Observable<any> {
    return this.api.get<any>(`/payouts/community/${communityId}`);
  }

  /**
   * Get all payouts for a specific user
   */
  getPayoutsByUser(userId: string): Observable<any> {
    return this.api.get<any>(`/payouts/user/${userId}`);
  }
  /**
   * Get upcoming payouts for a specific user
   */
  getUpcomingPayoutsByUser(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/upcoming-payouts`)
      .pipe(
        // Transform the response to handle different formats
        map(response => {
          // If the response already has upcomingPayouts property, return it directly
          if (response && response.upcomingPayouts) {
            return response;
          }
          
          // If the response is just an array, wrap it
          if (Array.isArray(response)) {
            return { upcomingPayouts: response };
          }
          
          // If it's something else unexpected, return an empty array
          return { upcomingPayouts: [] };
        })
      );
  }

  /**
   * Get a single payout by ID
   */
  getPayoutById(id: string): Observable<any> {
    return this.api.get<any>(`/payouts/${id}`);
  }

  /**
   * Delete a payout by ID
   */
  deletePayout(id: string): Observable<any> {
    return this.api.delete<any>(`/payouts/${id}`);
  }

  /**
   * Get all payouts
   */
  getAllPayouts(): Observable<any> {
    return this.api.get<any>('/payouts');
  }
  /**
   * Get community name by ID
   * This directly fetches the full community details and extracts the name
   */
  getCommunityName(communityId: string): Observable<any> {
    // Directly go to the main community endpoint instead of trying the non-existent /name endpoint
    return this.api.get<any>(`/communities/${communityId}`)
      .pipe(
        map(response => {
          // Extract name from different possible response formats
          if (response && response.name) {
            return { name: response.name };
          } else if (response && response.community && response.community.name) {
            return { name: response.community.name };
          } else {
            return { name: 'Unknown Community' };
          }
        }),
        catchError(error => {
          console.error('Failed to get community details:', error);
          return new Observable(observer => {
            observer.next({ name: 'Unknown Community' });
            observer.complete();
          });
        })
      );
  }
}