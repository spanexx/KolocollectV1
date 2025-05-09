import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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
    return this.api.get<{ notifications: Notification[] }>(`/users/${userId}/notifications`)
      .pipe(
        tap(response => {
          this.notificationsSubject.next(response.notifications);
          this.updateUnreadCount(response.notifications);
        })
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
    return this.api.get<{ notification: Notification }>(`/users/${userId}/notifications/${notificationId}`)
      .pipe(
        tap(response => {
          // Update the notification in the local list if it exists
          const notifications = this.notificationsSubject.value;
          const index = notifications.findIndex(n => n.id === notificationId);
          if (index !== -1) {
            notifications[index] = response.notification;
            this.notificationsSubject.next([...notifications]);
          }
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