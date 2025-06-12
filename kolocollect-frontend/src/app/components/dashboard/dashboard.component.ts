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
import { ApiService } from '../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TrackComponentLifecycle, TrackPerformance } from '../../decorators/performance.decorator';

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
  faUserPlus,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

@TrackComponentLifecycle('DashboardComponent')
@Component({
  selector: 'app-dashboard',
  standalone: true,  
  imports: [
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
  faSpinner = faSpinner;

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
    communityId: string;
    communityName: string;
    amount: number;
    date: Date;
    position?: number | null;
    isNextInLine?: boolean;
  }> = [];
  // Notifications
  notifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
  }> = [];
  notificationCount = 0;
  
  constructor(
    private authService: AuthService,
    private walletService: WalletService,
    private communityService: CommunityService,
    private contributionService: ContributionService,
    private payoutService: PayoutService,
    private userService: UserService,
    private notificationService: NotificationService,
    private api: ApiService
  ) {}
  ngOnInit(): void {
    // Get current user data
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadDashboardData();
      }
    });
    
    // Subscribe to notification unread count
    this.notificationService.unreadCount$.subscribe(count => {
      // This will keep the notification count in sync with header
      this.notificationCount = count;
    });
  }  
  @TrackPerformance('DashboardComponent.loadDashboardData')
  loadDashboardData(): void {
    if (!this.currentUser?.id) {
      console.error('Cannot load dashboard data: No current user ID');
      this.isLoading = false;
      return;
    }    
    
    this.isLoading = true;
    
    // Create an array to track all active API requests
    const requests: any[] = [];

    // Get wallet balance
    const walletRequest = this.walletService.getWalletBalance(this.currentUser.id);
    requests.push(walletRequest);
    
    walletRequest.subscribe({
      next: (balance) => {
        this.walletBalance = balance
      },
      error: (error: any) => {
        console.error('Error fetching wallet balance:', error);
      }
    });      
    
    // Get user communities
    const communitiesRequest = this.userService.getUserCommunities(this.currentUser.id);
    requests.push(communitiesRequest);
    
    communitiesRequest.subscribe({
      next: (communitiesData: any) => {
        // Check if the data is in the format {communities: Array}
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
      error: (error: any) => {
      }
    });
    
    // Get recent contributions
    const contributionsRequest = this.contributionService.getContributionsWithCommunityDetails(this.currentUser.id);
    requests.push(contributionsRequest);
    
    contributionsRequest.subscribe({
      next: (contributions: any) => {
        if (contributions && Array.isArray(contributions)) {    
          console.log("Contributions: ", contributions);
          // Sort by date (newest first) and limit to last few
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
      error: (error: any) => {
        console.error('Error fetching recent contributions:', error);
      }
    });
      
    // Get upcoming payouts
    const payoutsRequest = this.userService.getUpcomingPayouts(this.currentUser.id);
    requests.push(payoutsRequest);
    
    payoutsRequest.subscribe({
      next: (response: any) => {
        console.log('Upcoming payouts raw response:', response);
        // Handle different response formats
        let payoutsArray: any[] = [];
        
        if (response && Array.isArray(response)) {
          payoutsArray = response;
        } else if (response && response.upcomingPayouts && Array.isArray(response.upcomingPayouts)) {
          payoutsArray = response.upcomingPayouts;
        } else {
          console.warn('Unexpected format for upcoming payouts:', response);
          payoutsArray = [];
        }
        
        // Filter out any null or undefined payouts
        payoutsArray = payoutsArray.filter((payout: any) => !!payout);
            // Process payouts as-is initially - we'll enrich them properly later
        // This simplifies the flow and ensures we don't delay rendering the dashboard
        const enhancePromises: Promise<any>[] = [];
        
        // Wait for all community fetches to complete before processing payouts
        Promise.all(enhancePromises || [])
          .then(() => {
            this.upcomingPayouts = payoutsArray.map((payout: any) => {
              // Parse date safely
              let date: Date;
              try {
                // Try parsing with various date field names
                const rawDate = payout.payoutDate || payout.scheduledDate || payout.expectedDate;
                date = rawDate ? new Date(rawDate) : new Date();
                
                // Verify the date is valid
                if (isNaN(date.getTime())) {
                  console.warn(`Invalid date for payout: ${payout.id || payout._id || 'unknown'}`);
                  date = new Date(); // Fallback to current date
                }
              } catch (error) {
                console.error('Error parsing payout date:', error);
                date = new Date(); // Fallback to current date
              }
                
              // Parse amount safely
              let amount = 0;
              try {
                // First check for expectedAmount as it's preferred for upcoming payouts
                if (payout.expectedAmount !== undefined && payout.expectedAmount !== null) {
                  if (typeof payout.expectedAmount === 'number') {
                    amount = payout.expectedAmount;
                  } else if (typeof payout.expectedAmount === 'string') {
                    amount = parseFloat(payout.expectedAmount);
                  } else if (typeof payout.expectedAmount === 'object') {
                    // Handle MongoDB Decimal128 object that has a toString method
                    const objWithToString = payout.expectedAmount as { toString(): string };
                    amount = parseFloat(objWithToString.toString());
                  }
                } else if (payout.amount !== undefined && payout.amount !== null) {
                  if (typeof payout.amount === 'number') {
                    amount = payout.amount;
                  } else if (typeof payout.amount === 'string') {
                    amount = parseFloat(payout.amount);
                  } else if (typeof payout.amount === 'object') {
                    // Handle MongoDB Decimal128 object that has a toString method
                    const objWithToString = payout.amount as { toString(): string };
                    amount = parseFloat(objWithToString.toString());
                  }
                }
                  // We'll do a more thorough community-based calculation in enrichUpcomingPayoutData
                // Just use the parsed amount here or default to 0
                
                // Fallback if amount is NaN
                if (isNaN(amount)) {
                  amount = 0;
                }
              } catch (error) {
                console.error('Error parsing payout amount:', error);
                amount = 0;
              }
              
              return {
                id: payout.id || payout._id || 'unknown-id',
                communityId: payout.communityId || '',
                communityName: payout.communityName || 'Loading...',
                amount: amount,
                date: date,
                position: payout.position || null,
                isNextInLine: payout.isNextInLine || false
              };
            });
            
            // Sort by date (soonest first)
            this.upcomingPayouts.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            // Limit to 5 most recent payouts for the dashboard
            this.upcomingPayouts = this.upcomingPayouts.slice(0, 5);
            
            console.log('Processed upcoming payouts:', this.upcomingPayouts);
            
            // Fetch any missing community names
            this.enrichUpcomingPayoutData();
          })
          .catch((err: any) => {
            console.error('Error processing upcoming payouts:', err);
          });
      },
      error: (error: any) => {
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
            (notificationsResponse.notifications || []);          // Get all unread notifications
          const unreadNotifications = notificationsArray.filter((n: any) => !n.read);
          
          // Only show the first 5 for display in the dashboard
          this.notifications = unreadNotifications.slice(0, 5)
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
      },
      error: (error: any) => {
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
          error: (error: any) => {
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

  /**
   * Get days remaining until a date
   * @param date The target date to calculate days until
   * @returns Number of days remaining (always >= 0)
   */
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
      
      const now = new Date();
      // Strip time information from both dates for accurate day calculation
      const payoutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Calculate difference in days
      const diffTime = payoutDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Return max of 0 days (don't show negative days)
      return Math.max(0, diffDays);
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

    const markRequests = this.notifications.map((notification) => 
      this.notificationService.markAsRead(this.currentUser!.id, notification.id)
    );
    
    if (markRequests.length === 0) {
      return;
    }
    
    forkJoin(markRequests).subscribe({
      next: () => {
        // After marking all as read, update our local state
        this.notifications = this.notifications.map((notification) => ({
          ...notification,
          read: true
        }));
      },
      error: (error: any) => {
        console.error('Error marking notifications as read:', error);
      }
    });
  }
  /**
   * Enrich upcoming payout data with community names and amounts
   */
  private enrichUpcomingPayoutData(): void {
    if (!this.upcomingPayouts || this.upcomingPayouts.length === 0) {
      return;
    }
    
    // Create a cache to avoid duplicate API calls
    const communityCache: {[key: string]: {name: string, data?: any}} = {};
    
    // Get all payouts that need enrichment (missing community name or zero amount)
    const payoutsNeedingEnrichment = this.upcomingPayouts.filter(payout => 
      payout.communityId && (
        payout.communityName === 'Loading...' || 
        !payout.communityName || 
        payout.amount === 0 || 
        isNaN(payout.amount)
      )
    );
    
    if (payoutsNeedingEnrichment.length === 0) {
      return;
    }
    
    // Get unique community IDs
    const uniqueCommunityIds = [...new Set(payoutsNeedingEnrichment.map(payout => payout.communityId))];
    
    console.log(`Dashboard: Enriching data for ${uniqueCommunityIds.length} communities...`);
    
    // For each community ID, fetch its details
    uniqueCommunityIds.forEach(communityId => {
      if (!communityId) {
        return; // Skip null or undefined community IDs
      }
      
      // Skip if we've already fetched this community's data in this session
      if (communityCache[communityId] && communityCache[communityId].name !== 'Unknown Community') {
        this.updatePayoutCommunityInfo(communityId, communityCache[communityId].name, communityCache[communityId].data);
        return;
      }
      
      // Fetch complete community details including members and settings
      this.api.get<any>(`/communities/${communityId}`)
        .subscribe({
          next: (communityData: any) => {
            const community = communityData?.community || communityData;
            
            // Extract community name
            const name = community?.name || 'Unknown Community';
            
            // Cache the data
            communityCache[communityId] = {
              name: name,
              data: community
            };
            
            // Update all payouts with this community ID
            this.updatePayoutCommunityInfo(communityId, name, community);
          },
          error: (error: any) => {
            console.error(`Failed to fetch details for community ${communityId}:`, error);
            communityCache[communityId] = { name: 'Unknown Community' };
            this.updatePayoutCommunityInfo(communityId, 'Unknown Community', null);
          }
        });
    });
  }
    /**
   * Update community info (name and amount) for all payouts with a given community ID
   */
  private updatePayoutCommunityInfo(communityId: string, name: string, communityData: any): void {
    if (!this.upcomingPayouts || !communityId) {
      return;
    }
    
    this.upcomingPayouts.forEach((payout) => {
      if (payout.communityId === communityId) {
        // Update the community name
        payout.communityName = name;
        
        // Update the amount if it's zero or undefined and we have community data
        if ((payout.amount === 0 || isNaN(payout.amount)) && communityData) {
          try {
            const settings = communityData.settings || {};
            const memberCount = communityData.members?.length || 0;
            
            if (settings.minContribution && memberCount > 0) {
              const minContribution = Number(settings.minContribution);
              const backupFundPercentage = Number(settings.backupFundPercentage) || 10;
              
              // Calculate the expected payout amount
              const amount = minContribution * memberCount * (1 - (backupFundPercentage / 100));
              if (!isNaN(amount) && amount > 0) {
                payout.amount = amount;
                console.log(`Updated amount for payout in ${name}: $${amount}`);
              }
            }
          } catch (error) {
            console.error(`Failed to calculate amount for payout in ${name}:`, error);
          }
        }
      }
    });
  }

  /**
   * Format a date for display
   */
  formatDate(date: Date | null | string): string {
    if (!date) return 'N/A';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      return d.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Error';
    }
  }
}
