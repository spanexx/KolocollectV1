import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, tap, shareReplay } from 'rxjs/operators';
import { ApiService } from './api.service';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private searchCache: { [query: string]: any[] } = {};
  private cacheTimeout: number = 60000; // 1 minute cache timeout
  
  constructor(private api: ApiService) {}

  /**
   * Get user profile by ID
   */
  getUserProfile(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/profile`);
  }

  /**
   * Get upcoming payouts for a user
   */
  getUpcomingPayouts(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/upcoming-payouts`);
  }

  /**
   * Clean up user logs
   */
  cleanUpLogs(userId: string): Observable<any> {
    return this.api.post<any>(`/users/${userId}/clean-up-logs`, {});
  }

  /**
   * Get communities that a user is part of
   */
  getUserCommunities(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/communities`);
  }

  /**
   * Get notifications for a user
   */
  getUserNotifications(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/notifications`);
  }
  
  /**
   * Get user activity logs
   */
  getUserActivityLog(userId: string): Observable<any> {
    return this.api.get<any>(`/users/${userId}/activity-log`);
  }
  
  /**
   * Update user profile
   */
  updateUserProfile(userId: string, profileData: any): Observable<any> {
    return this.api.put<any>(`/users/${userId}/profile`, profileData);
  }
  
  /**
   * Update user password
   */
  updatePassword(userId: string, passwordData: {currentPassword: string, newPassword: string}): Observable<any> {
    return this.api.put<any>(`/users/${userId}/password`, passwordData);
  }
  
  /**
   * Update user notification preferences
   */
  updateUserPreferences(userId: string, preferences: any): Observable<any> {
    return this.api.put<any>(`/users/${userId}/preferences`, preferences);
  }
  
  /**
   * Mark a notification as read
   */
  markNotificationRead(userId: string, notificationId: string): Observable<any> {
    return this.api.put<any>(`/users/${userId}/notifications/${notificationId}/read`, {});
  }  /**
   * Search users by name or email with caching
   * @param query The search query string
   * @param forceRefresh Whether to bypass cache and force a fresh request
   */
  searchUsers(query: string, forceRefresh: boolean = false): Observable<any> {
    // Normalize query to ensure consistent cache hits
    const normalizedQuery = query.trim().toLowerCase();
    
    // Return from cache if available and not forcing refresh
    if (!forceRefresh && this.searchCache[normalizedQuery]) {
      console.log('Returning cached results for query:', normalizedQuery);
      return of(this.searchCache[normalizedQuery]);
    }
    
    return this.api.get<any>('/users/search', { query: normalizedQuery }).pipe(
      tap(results => {
        // Cache the results
        this.searchCache[normalizedQuery] = results;
        
        // Set expiry timeout to clear this cache entry
        setTimeout(() => {
          delete this.searchCache[normalizedQuery];
        }, this.cacheTimeout);
      }),
      catchError(error => {
        console.error('Error in user search service:', error);
        throw error;
      }),
      // Use shareReplay to share the result with multiple subscribers
      shareReplay(1)
    );
  }
}