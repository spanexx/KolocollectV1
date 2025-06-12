import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { User, ProfilePicture } from '../../models/user.model';
import { Observable, tap, of, Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { MediaService } from '../../services/media.service';
import { trigger, state, style, transition, animate, stagger, query, keyframes } from '@angular/animations';
import { environment } from '../../../environments/environment';

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
  faCalendarCheck,
  faCompress,
  faExpand
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-header',
  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
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
export class HeaderComponent implements OnInit, OnDestroy {  // FontAwesome icons
  faBell = faBell;
  faChevronDown = faChevronDown;
  faSignOutAlt = faSignOutAlt;
  faUser = faUser;
  faWallet = faWallet;
  faMoneyBill = faMoneyBill;
  faUsers = faUsers;
  faCalendarCheck = faCalendarCheck;
  faCompress = faCompress;
  faExpand = faExpand;
  
  // Compact mode state
  isCompactMode = false;
  currentUser$: Observable<User | null>;
  notificationCount = 0;
  private subscriptions: Subscription[] = [];
  notifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
    animationState: 'visible' | 'hidden';
  }> = [];
  isClosingNotifications = false;
  userProfilePicture: string | null = null;
  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private mediaService: MediaService
  ) {
    this.currentUser$ = this.authService.currentUser$.pipe(
      tap(user => {
        if (user && user.id) {
          this.loadNotifications(user.id);
          this.loadProfilePicture(user);
        }
      })
    );
    
    // Subscribe to the currentUser$ observable to make sure it's active
    const userSubscription = this.currentUser$.subscribe();
    this.subscriptions.push(userSubscription);
  }
  ngOnInit(): void {
    // Initialize compact mode from localStorage
    this.initializeCompactMode();
    
    // Subscribe to the notification service's unread count
    const subscription = this.notificationService.unreadCount$.subscribe(count => {
      this.notificationCount = count;
    });
    this.subscriptions.push(subscription);
  }
  loadNotifications(userId: string): void {
    const subscription = this.notificationService.loadNotifications(userId).subscribe({
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
    this.subscriptions.push(subscription);
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
    
    const subscription = this.authService.currentUser$.subscribe(user => {
      if (!user?.id || this.notifications.length === 0) {
        return;
      }
      
      this.isClosingNotifications = true;
      
      // First, animate all notifications by setting them to 'hidden' state
      this.notifications = this.notifications.map(n => ({...n, animationState: 'hidden'}));
      
      // Wait for animation to complete before making API call
      setTimeout(() => {
        const markAllSub = this.notificationService.markAllAsRead(user.id).subscribe({
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
        this.subscriptions.push(markAllSub);
      }, 300); // Match the animation duration
    });
    this.subscriptions.push(subscription);
  }
    markNotificationAsRead(notification: any): void {
    if (notification.read) return;
    
    const subscription = this.authService.currentUser$.subscribe(user => {
      if (!user?.id) return;
      
      // Set the animation state to hidden
      notification.animationState = 'hidden';
      
      // Wait for animation to complete before marking as read
      setTimeout(() => {
        const markReadSub = this.notificationService.markAsRead(user.id, notification.id).subscribe({
          next: () => {
            notification.read = true;
          },
          error: (error) => {
            console.error('Error marking notification as read:', error);
            notification.animationState = 'visible';
          }
        });
        this.subscriptions.push(markReadSub);
      }, 300);
    });
    this.subscriptions.push(subscription);
  }  /**
   * Loads the user's profile picture using the MediaService to get a signed URL
   * Based on the working implementation from profile component
   */
  loadProfilePicture(user: User): void {
    // Reset profile picture URL
    this.userProfilePicture = null;
    console.log('[Header] Loading profile picture for user:', user);
    
    // Check if user has a profile picture
    if (user.profilePicture?.fileId) {
      console.log('[Header] Loading profile picture URL for fileId:', user.profilePicture.fileId);
      
      const subscription = this.mediaService.getFileUrl(user.profilePicture.fileId).subscribe({
        next: (response) => {
          // Check if the URL is available
          if (response && response.url) {
            // First check if the URL is relative and convert to absolute if needed
            if (response.url.startsWith('/')) {
              // It's a relative URL, prepend the base API URL from environment
              const baseUrl = environment.apiUrl.replace('/api', ''); // Remove '/api' from the end
              this.userProfilePicture = `${baseUrl}${response.url}`;
              console.log('[Header] Profile picture URL created from relative path:', this.userProfilePicture);
            } else {
              // It's already an absolute URL
              this.userProfilePicture = response.url;
              console.log('[Header] Profile picture URL (already absolute):', this.userProfilePicture);
            }          } else {
            console.warn('[Header] No URL returned for profile picture');
          }
        },
        error: (err) => {
          console.error('[Header] Error fetching profile image URL:', err);
          this.userProfilePicture = null;
        }
      });
      this.subscriptions.push(subscription);
    } else {
      console.log('[Header] User has no profile picture fileId');
    }
  }

  /**
   * Get user initials for avatar placeholder
   */
  getUserInitials(name: string): string {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * Handle profile image loading error
   */
  handleProfileImageError(event: any): void {
    console.error('Profile image failed to load:', event);
    this.userProfilePicture = null;
  }
  logout(): void {
    this.authService.logout();
  }

  /**
   * Initialize compact mode from localStorage
   */
  private initializeCompactMode(): void {
    const saved = localStorage.getItem('compactMode');
    this.isCompactMode = saved === 'true';
    this.applyCompactMode();
  }

  /**
   * Toggle compact mode
   */
  toggleCompactMode(): void {
    this.isCompactMode = !this.isCompactMode;
    localStorage.setItem('compactMode', this.isCompactMode.toString());
    this.applyCompactMode();
  }

  /**
   * Apply or remove compact mode class to body
   */
  private applyCompactMode(): void {
    const body = document.body;
    if (this.isCompactMode) {
      body.classList.add('compact-mode');
    } else {
      body.classList.remove('compact-mode');
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
