import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faBell, 
  faCheck, 
  faInfoCircle, 
  faExclamationTriangle,
  faExclamationCircle,
  faTrash,
  faFilter,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { Notification } from '../../models/user.model';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatBadgeModule,
    MatMenuModule,
    RouterModule,
    FontAwesomeModule
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
  animations: [
    trigger('notificationAnimation', [
      state('visible', style({
        opacity: 1,
        height: '*',
        padding: '*',
        margin: '*'
      })),
      state('hidden', style({
        opacity: 0,
        height: 0,
        padding: 0,
        margin: 0,
        overflow: 'hidden'
      })),
      transition('visible => hidden', [
        animate('300ms cubic-bezier(0.55, 0, 0.55, 0.2)')
      ]),
      transition('hidden => visible', [
        animate('200ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ])
  ]
})
export class NotificationsComponent implements OnInit {
  // FontAwesome icons
  faBell = faBell;
  faCheck = faCheck;  
  faInfoCircle = faInfoCircle;
  faExclamationTriangle = faExclamationTriangle;
  faExclamationCircle = faExclamationCircle;
  faTrash = faTrash;
  faFilter = faFilter;
  faCalendarCheck = faCalendarCheck;

  // Loading state
  isLoading = true;
  
  // User ID
  userId: string | null = null;
  
  // Notifications
  allNotifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
    animationState: 'visible' | 'hidden';
  }> = [];
  
  // Filter states
  activeTab = 0; // 0 = All, 1 = Unread, 2 = Read
  
  // Current filter
  currentFilter: 'all' | 'unread' | 'read' = 'all';

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user && user.id) {
        this.userId = user.id;
        this.loadNotifications();
      }
    });
  }

  /**
   * Load notifications from the service
   */  loadNotifications(): void {
    this.isLoading = true;
    
    if (!this.userId) {
      this.isLoading = false;
      return;
    }
      this.notificationService.loadNotifications(this.userId).subscribe({
      next: (notifications) => {
        console.log("Notifications: ", notifications);
        
        // Process notifications with proper date conversion and create varied timestamps for testing
        this.allNotifications = notifications.map((notification, index) => {
          // Make sure we have a valid timestamp or use current date as fallback
          let timestamp = notification.timestamp ? notification.timestamp : new Date().toISOString();
            // For testing: create hardcoded timestamps to see different date formats
          // In production, remove this test code block
          const today = new Date();
          // Initialize with current date as default
          let testDate: Date = new Date(today);
          
          // Using hardcoded dates for testing
          switch (index % 5) {
            case 0: // Just now
              testDate = new Date(today); // Today's date
              break;
            case 1: // Minutes ago
              testDate = new Date(today);
              testDate.setMinutes(testDate.getMinutes() - 15); // 15 minutes ago
              break;
            case 2: // Hours ago
              testDate = new Date(today);
              testDate.setHours(testDate.getHours() - 3); // 3 hours ago
              break;
            case 3: // Yesterday
              testDate = new Date(today);
              testDate.setDate(testDate.getDate() - 1); // Yesterday
              break;
            case 4: // Days ago
              testDate = new Date(today);
              testDate.setDate(testDate.getDate() - 5); // 5 days ago
              break;
          }
          
          timestamp = testDate.toISOString();
          
          // Log timestamp for debugging
          console.debug('Processing notification with timestamp:', timestamp, 'Type:', index % 5);
          
          return {
            ...notification,
            date: new Date(timestamp),
            animationState: 'visible'
          };
        });
        
        // Sort notifications by date (newest first)
        this.allNotifications.sort((a, b) => b.date.getTime() - a.date.getTime());
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.isLoading = false;
      }
    });
  }

  /**
   * Mark a specific notification as read
   */
  markAsRead(notification: any): void {
    if (notification.read || !this.userId) return;

    // Set the animation state to hidden
    notification.animationState = 'hidden';
    
    // Wait for animation to complete before marking as read
    setTimeout(() => {
      this.notificationService.markAsRead(this.userId!, notification.id).subscribe({
        next: () => {
          notification.read = true;
          notification.animationState = 'visible';
        },
        error: (error) => {
          console.error('Error marking notification as read:', error);
          notification.animationState = 'visible';
        }
      });
    }, 300);
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    if (!this.userId) return;
    
    const unreadNotifications = this.getFilteredNotifications('unread');
    if (unreadNotifications.length === 0) return;
    
    // Animate all unread notifications
    unreadNotifications.forEach(notification => {
      notification.animationState = 'hidden';
    });
    
    // Wait for animation to complete before making API call
    setTimeout(() => {
      this.notificationService.markAllAsRead(this.userId!).subscribe({
        next: () => {
          // Update all notifications to be marked as read
          this.allNotifications = this.allNotifications.map(notification => ({
            ...notification,
            read: true,
            animationState: 'visible'
          }));
        },
        error: (error) => {
          console.error('Error marking all notifications as read:', error);
          // Reset animation states
          this.allNotifications.forEach(notification => {
            notification.animationState = 'visible';
          });
        }
      });
    }, 300);
  }

  /**
   * Get notification icon based on type
   */
  getNotificationIcon(type: string): any {
    switch (type.toLowerCase()) {
      case 'success':
        return this.faCheck;
      case 'info':
        return this.faInfoCircle;
      case 'warning':
        return this.faExclamationTriangle;
      case 'error':
        return this.faExclamationCircle;
      default:
        return this.faBell;
    }
  }

  /**
   * Get notification CSS class based on type
   */
  getNotificationClass(type: string): string {
    return `notification-${type.toLowerCase()}`;
  }  /**
   * Format notification date to a readable format
   */
  formatDate(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      return 'Unknown date';
    }
    
    // Make sure we're working with date objects
    const notificationDate = new Date(date);
    const now = new Date();
    
    // Calculate time difference in milliseconds
    // Handle both past and future dates (in case system clock is wrong)
    const diff = Math.abs(now.getTime() - notificationDate.getTime());
    const isPast = now.getTime() > notificationDate.getTime();
    
    // Debug log to help diagnose date issues
    // console.debug('Notification date:', notificationDate, 'Now:', now, 'Diff (ms):', diff, 'Is Past:', isPast);
    
    // Handle dates according to difference
    // Less than a minute
    if (diff < 60 * 1000) {
      return 'Just now';
    }
    
    // Less than an hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return isPast 
        ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago` 
        : `In ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    
    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return isPast 
        ? `${hours} ${hours === 1 ? 'hour' : 'hours'} ago` 
        : `In ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    
    // Calculate days difference
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return isPast ? 'Yesterday' : 'Tomorrow';
    } else if (diffDays < 7) {
      return isPast 
        ? `${diffDays} days ago` 
        : `In ${diffDays} days`;
    } else {
      // For dates older than a week, show the full date with day, month, and year
      return notificationDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }
  
  /**
   * Change the current tab/filter
   */
  changeFilter(filter: 'all' | 'unread' | 'read'): void {
    this.currentFilter = filter;
  }
  
  /**
   * Get notifications filtered by the current filter
   */
  getFilteredNotifications(filter?: 'all' | 'unread' | 'read'): Array<any> {
    const filterToUse = filter || this.currentFilter;
    
    switch (filterToUse) {
      case 'unread':
        return this.allNotifications.filter(notification => !notification.read);
      case 'read':
        return this.allNotifications.filter(notification => notification.read);
      default:
        return this.allNotifications;
    }
  }
  
  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    return this.allNotifications.filter(notification => !notification.read).length;
  }
}
