import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
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
  }
}``