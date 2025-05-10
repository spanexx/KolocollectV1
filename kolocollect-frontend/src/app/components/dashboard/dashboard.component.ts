import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { WalletService } from '../../services/wallet.service';
import { CommunityService } from '../../services/community.service';
import { ContributionService } from '../../services/contribution.service';
import { PayoutService } from '../../services/payout.service';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { forkJoin } from 'rxjs';

// Import FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faWallet, 
  faPlus, 
  faMinus, 
  faMoneyBill, 
  faBell, 
  faCheck, 
  faInfoCircle, 
  faExclamationTriangle,
  faUsers,
  faMoneyBillWave,
  faEye,
  faReceipt,
  faUserPlus
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard',
  standalone: true,  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    RouterModule,
    FontAwesomeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // FontAwesome icons
  faWallet = faWallet;
  faPlus = faPlus;
  faMinus = faMinus;
  faMoneyBill = faMoneyBill;
  faBell = faBell;
  faCheck = faCheck;
  faInfoCircle = faInfoCircle;
  faExclamationTriangle = faExclamationTriangle;
  faUsers = faUsers;
  faMoneyBillWave = faMoneyBillWave;
  faEye = faEye;
  faReceipt = faReceipt;
  faUserPlus = faUserPlus;

  // Loading state
  isLoading = true;

  // User data
  currentUser: User | null = null;
  
  // Financial overview
  walletBalance = {
    availableBalance: 0,
    fixedBalance: 0,
    totalBalance: 0
  };
  // Communities
  communities: Array<{
    id: {
      _id: string;
    name: string;
    description: string;
    }
    isAdmin: boolean;
    _id?: string;
  }> = [];

  // Recent activity
  recentContributions: Array<{
    id: string;
    communityName: string;
    amount: number;
    date: Date;
    status: string;
  }> = [];

  // Upcoming payouts
  upcomingPayouts: Array<{
    id: string;
    communityName: string;
    amount: number;
    date: Date;
  }> = [];

  // Notifications
  notifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
  }> = [];

  constructor(
    private authService: AuthService,
    private walletService: WalletService,
    private communityService: CommunityService,
    private contributionService: ContributionService,
    private payoutService: PayoutService,
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Get current user data
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadDashboardData();
      }
    });
  }
  loadDashboardData(): void {
    if (!this.currentUser?.id) {
      console.error('Cannot load dashboard data: No current user ID');
      this.isLoading = false;
      return;
    }    this.isLoading = true;
    
    // Create an array to track all active API requests
    const requests: any[] = [];

    // Get wallet balance
    const walletRequest = this.walletService.getWalletBalance(this.currentUser.id);
    requests.push(walletRequest);
    
    walletRequest.subscribe({
      next: (balance) => {
        console.log('Wallet balance:', balance);
        this.walletBalance = balance
      },
      error: (error) => {
        console.error('Error fetching wallet balance:', error);
      }
    });      
      // Get user communities
    const communitiesRequest = this.userService.getUserCommunities(this.currentUser.id);
    requests.push(communitiesRequest);
    
    communitiesRequest.subscribe({
      next: (communitiesData) => {
        console.log('User communities:', communitiesData);        // Check if the data is in the format {communities: Array}
        if (communitiesData && communitiesData.communities && Array.isArray(communitiesData.communities)) {
          this.communities = communitiesData.communities.map((community: any) => {
            console.log('Community:', community);
            return {
              id: community.id || community._id,
              name: community.name || 'Unknown Community',
              description: community.description || 'No description available',
              isAdmin: community.isAdmin === true,
              _id: community._id
            };
          });
        } else if (communitiesData && Array.isArray(communitiesData)) {
          // If the data is a direct array
          this.communities = communitiesData.map((community: any) => {
            console.log('Community:', community);
            return {
              id: community.id || community._id,
              name: community.name || 'Unknown Community',
              description: community.description || 'No description available',
              isAdmin: community.isAdmin === true,
              _id: community._id
            };
          });
        }
        console.log('Processed communities:', this.communities);
      },
      error: (error) => {
        console.error('Error fetching user communities:', error);
      }
    });
    
    // Get recent contributions
    const contributionsRequest = this.contributionService.getContributionsWithCommunityDetails(this.currentUser.id);
    requests.push(contributionsRequest);
    
    contributionsRequest.subscribe({
      next: (contributions) => {
        if (contributions && Array.isArray(contributions)) {    
          console.log("Contributions: ", contributions)      // Sort by date (newest first) and limit to last few
          this.recentContributions = contributions
            .sort((a: any, b: any) => {
              // Safe parsing of dates for sorting
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA;
            })
            .slice(0, 5)
            .map((contribution: any) => {
              let date: Date;
              try {
                date = contribution.date ? new Date(contribution.date) : new Date();
                if (isNaN(date.getTime())) {
                  date = new Date(); // Fallback to current date
                }
              } catch (error) {
                console.error('Error parsing contribution date:', error);
                date = new Date();
              }
              
              return {
                id: contribution.id || 'unknown-id',
                communityName: contribution.communityName || 'Unknown Community',
                amount: Number(contribution.amount) || 0,
                date: date,
                status: contribution.status || 'unknown'
              };
            });
        }
      },
      error: (error) => {
        console.error('Error fetching recent contributions:', error);
      }
    });
    
    // Get upcoming payouts
    const payoutsRequest = this.userService.getUpcomingPayouts(this.currentUser.id);
    requests.push(payoutsRequest);
    
    payoutsRequest.subscribe({
      next: (payouts) => {
        if (payouts && Array.isArray(payouts)) {this.upcomingPayouts = payouts.map((payout: any) => {
            let date: Date;
            try {
              // Try to parse the date
              const rawDate = payout.scheduledDate || payout.expectedDate;
              date = rawDate ? new Date(rawDate) : new Date();
              
              // Verify the date is valid
              if (isNaN(date.getTime())) {
                console.warn(`Invalid date for payout: ${payout.id || payout._id}`);
                date = new Date(); // Fallback to current date
              }
            } catch (error) {
              console.error('Error parsing payout date:', error);
              date = new Date(); // Fallback to current date
            }
            
            return {
              id: payout.id || payout._id || 'unknown-id',
              communityName: payout.communityName || 'Unknown Community',
              amount: Number(payout.amount || payout.expectedAmount) || 0,
              date: date
            };
          });
        }
      },
      error: (error) => {
        console.error('Error fetching upcoming payouts:', error);
      }
    });
      // Get user notifications
    const notificationsRequest = this.notificationService.loadNotifications(this.currentUser.id);
    requests.push(notificationsRequest);
    
    notificationsRequest.subscribe({
      next: (notificationsResponse: any) => {
        if (notificationsResponse) {
          // If notificationsResponse is an array, use it directly
          // Otherwise, assume it's an object with a notifications property
          const notificationsArray = Array.isArray(notificationsResponse) ? 
            notificationsResponse : 
            (notificationsResponse.notifications || []);
              this.notifications = notificationsArray
            .filter((n: any) => !n.read)
            .slice(0, 5)
            .map((notification: any) => {
              let date: Date;
              try {
                // Try to parse the timestamp into a valid Date
                date = notification.timestamp ? new Date(notification.timestamp) : new Date();
                // Check if date is valid
                if (isNaN(date.getTime())) {
                  console.warn(`Invalid timestamp for notification: ${notification.id}`);
                  date = new Date(); // Fallback to current date
                }
              } catch (error) {
                console.error('Error converting notification timestamp:', error);
                date = new Date(); // Fallback to current date
              }
              
              return {
                id: notification.id || 'unknown-id',
                message: notification.message || 'No message',
                date: date,
                type: this.mapNotificationType(notification.type),
                read: !!notification.read
              };
            });
        }
      },      error: (error) => {
        console.error('Error fetching user notifications:', error);
      }
    });

    // Use forkJoin to handle completion of all requests
    // Using a setTimeout to give a minimum loading experience even if data loads very quickly
    if (requests.length > 0) {
      setTimeout(() => {
        forkJoin(requests).subscribe({
          complete: () => {
            this.isLoading = false;
            console.log('All dashboard data loaded successfully');
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error loading some dashboard data:', error);
          }
        });
      }, 500); // minimum loading time of 500ms for better UX
    } else {
      this.isLoading = false;
    }
  }
  
  /**
   * Maps notification type from backend to frontend display type
   */
  private mapNotificationType(type: string): string {
    switch (type) {
      case 'payment': return 'success';
      case 'contribution': return 'info';
      case 'system': return 'info';
      case 'community': return 'info';
      default: return 'info';
    }
  }
  // Helper methods for the template
  formatDate(date: Date | null | string): string {
    if (!date) {
      return 'N/A';
    }
    
    try {
      // Handle string dates by converting to Date object
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Validate the date is valid before formatting
      if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }
  
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'warning': return 'warning';
      case 'success': return 'check_circle';
      case 'info': return 'info';
      case 'error': return 'error';
      default: return 'notifications';
    }
  }

  getFaNotificationIcon(type: string): any {
    switch (type) {
      case 'warning': return this.faExclamationTriangle;
      case 'success': return this.faCheck;
      case 'info': return this.faInfoCircle;
      case 'error': return this.faExclamationTriangle;
      default: return this.faBell;
    }
  }
  
  getNotificationClass(type: string): string {
    return `notification-${type}`;
  }
    getDaysRemaining(date: Date | null): number {
    if (!date) {
      return 0;
    }
    
    try {
      // Validate the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date passed to getDaysRemaining');
        return 0;
      }
      
      const today = new Date();
      const timeDiff = date.getTime() - today.getTime();
      return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24))); // Ensure we don't return negative days
    } catch (error) {
      console.error('Error calculating days remaining:', error);
      return 0;
    }
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsAsRead(): void {
    if (!this.currentUser?.id || this.notifications.length === 0) {
      return;
    }

    const markRequests = this.notifications.map(notification => 
      this.notificationService.markAsRead(this.currentUser!.id, notification.id)
    );
    
    if (markRequests.length === 0) {
      return;
    }
    
    forkJoin(markRequests).subscribe({
      next: () => {
        // After marking all as read, update our local state
        this.notifications = this.notifications.map(notification => ({
          ...notification,
          read: true
        }));
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      }
    });
  }
}