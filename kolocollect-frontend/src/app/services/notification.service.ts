import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Notification } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private api: ApiService) {}
  /**
   * Load notifications for the user
   */
  loadNotifications(userId: string): Observable<Notification[]> {
    return this.api.get<{ message: string, notifications: Notification[] }>(`/users/${userId}/notifications`)
      .pipe(
        tap(response => {
          this.notificationsSubject.next(response.notifications);
          this.updateUnreadCount(response.notifications);
        }),
        // Transform the response to match the expected return type
        map(response => response.notifications)
      );
  }

  /**
   * Mark notification as read
   */
  markAsRead(userId: string, notificationId: string): Observable<any> {
    return this.api.post<any>(`/users/${userId}/notifications/${notificationId}/read`, {})
      .pipe(
        tap(() => {
          // Update local state
          const notifications = this.notificationsSubject.value.map(notification => {
            if (notification.id === notificationId) {
              return { ...notification, read: true };
            }
            return notification;
          });
          
          this.notificationsSubject.next(notifications);
          this.updateUnreadCount(notifications);
        })
      );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(userId: string): Observable<any> {
    return this.api.post<any>(`/users/${userId}/notifications/read-all`, {})
      .pipe(
        tap(() => {
          // Update local state
          const notifications = this.notificationsSubject.value.map(notification => {
            return { ...notification, read: true };
          });
          
          this.notificationsSubject.next(notifications);
          this.unreadCountSubject.next(0);
        })
      );
  }
  /**
   * Get a single notification
   */
  getNotification(userId: string, notificationId: string): Observable<Notification> {
    // First try to get the notification from our local cache
    const cachedNotification = this.notificationsSubject.value.find(n => n.id === notificationId);
    if (cachedNotification) {
      return of(cachedNotification);
    }
    
    // If not found in cache, load all notifications and then find the one we need
    return this.loadNotifications(userId).pipe(
      map(notifications => {
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) {
          throw new Error(`Notification with ID ${notificationId} not found`);
        }
        return notification;
      }),
      catchError(error => {
        console.error('Error fetching notification:', error);
        throw error;
      })
    );
  }

  /**
   * Add a notification to the local list (for realtime updates)
   */
  addNotification(notification: Notification): void {
    const notifications = [notification, ...this.notificationsSubject.value];
    this.notificationsSubject.next(notifications);
    this.updateUnreadCount(notifications);
  }

  /**
   * Update unread count based on notifications
   */
  private updateUnreadCount(notifications: Notification[]): void {
    const unreadCount = notifications.filter(notification => !notification.read).length;
    this.unreadCountSubject.next(unreadCount);
  }
}