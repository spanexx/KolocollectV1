import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { Observable, tap } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { trigger, state, style, transition, animate, stagger, query, keyframes } from '@angular/animations';

// Import FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBell,
  faChevronDown,
  faSignOutAlt,
  faUser,
  faWallet,
  faMoneyBill,
  faUsers,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    FontAwesomeModule
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  animations: [
    trigger('notificationAnimation', [
      state('visible', style({
        opacity: 1,
        transform: 'translateX(0)'
      })),
      state('hidden', style({
        opacity: 0,
        transform: 'translateX(100%)',
        height: 0,
        padding: 0,
        margin: 0,
        overflow: 'hidden'
      })),
      transition('visible => hidden', [
        animate('0.3s cubic-bezier(0.55, 0, 0.55, 0.2)')
      ])
    ])
  ]
})
export class HeaderComponent implements OnInit {
  // FontAwesome icons
  faBell = faBell;
  faChevronDown = faChevronDown;
  faSignOutAlt = faSignOutAlt;
  faUser = faUser;
  faWallet = faWallet;
  faMoneyBill = faMoneyBill;
  faUsers = faUsers;
  faCalendarCheck = faCalendarCheck;
  currentUser$: Observable<User | null>;
  notificationCount = 0;
  notifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
    animationState: 'visible' | 'hidden';
  }> = [];
  isClosingNotifications = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.currentUser$ = this.authService.currentUser$.pipe(
      tap(user => {
        if (user && user.id) {
          this.loadNotifications(user.id);
        }
      })
    );
  }

  ngOnInit(): void {
    // Subscribe to the notification service's unread count
    this.notificationService.unreadCount$.subscribe(count => {
      this.notificationCount = count;
    });
  }

  loadNotifications(userId: string): void {
    this.notificationService.loadNotifications(userId).subscribe({
      next: (notificationsResponse: any) => {
        if (notificationsResponse) {
          const notificationsArray = Array.isArray(notificationsResponse) ? 
            notificationsResponse : 
            (notificationsResponse.notifications || []);
          
          this.notifications = notificationsArray
            .filter((n: any) => !n.read)
            .slice(0, 5)
            .map((notification: any) => {
              let date: Date;
              try {
                date = notification.timestamp ? new Date(notification.timestamp) : new Date();
                if (isNaN(date.getTime())) {
                  date = new Date();
                }
              } catch (error) {
                console.error('Error converting notification timestamp:', error);
                date = new Date();
              }
                return {
                id: notification.id || 'unknown-id',
                message: notification.message || 'No message',
                date: date,
                type: this.mapNotificationType(notification.type),
                read: !!notification.read,
                animationState: 'visible'
              };
            });
        }
      },
      error: (error: any) => {
        console.error('Error fetching user notifications:', error);
      }
    });
  }
  
  private mapNotificationType(type: string): string {
    switch (type) {
      case 'payment': return 'success';
      case 'contribution': return 'info';
      case 'system': return 'info';
      case 'community': return 'info';
      default: return 'info';
    }
  }

  getFaNotificationIcon(type: string): any {
    switch (type) {
      case 'warning': return this.faBell;
      case 'success': return this.faCalendarCheck;
      case 'info': return this.faUsers;
      case 'error': return this.faBell;
      default: return this.faBell;
    }
  }
  
  formatDate(date: Date): string {
    if (!date) return 'Unknown date';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }  markAllNotificationsAsRead(): void {
    if (this.isClosingNotifications) return;
    
    this.authService.currentUser$.subscribe(user => {
      if (!user?.id || this.notifications.length === 0) {
        return;
      }
      
      this.isClosingNotifications = true;
      
      // First, animate all notifications by setting them to 'hidden' state
      this.notifications = this.notifications.map(n => ({...n, animationState: 'hidden'}));
      
      // Wait for animation to complete before making API call
      setTimeout(() => {
        this.notificationService.markAllAsRead(user.id).subscribe({
          next: () => {
            // The notification service will update the unread count
            this.notifications = this.notifications.map(n => ({...n, read: true}));
            this.isClosingNotifications = false;
          },
          error: (error) => {
            console.error('Error marking notifications as read:', error);
            // Reset animation state if there's an error
            this.notifications = this.notifications.map(n => ({...n, animationState: 'visible'}));
            this.isClosingNotifications = false;
          }
        });
      }, 300); // Match the animation duration
    });
  }
  
  markNotificationAsRead(notification: any): void {
    if (notification.read) return;
    
    this.authService.currentUser$.subscribe(user => {
      if (!user?.id) return;
      
      // Set the animation state to hidden
      notification.animationState = 'hidden';
      
      // Wait for animation to complete before marking as read
      setTimeout(() => {
        this.notificationService.markAsRead(user.id, notification.id).subscribe({
          next: () => {
            notification.read = true;
          },
          error: (error) => {
            console.error('Error marking notification as read:', error);
            notification.animationState = 'visible';
          }
        });
      }, 300);
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
