import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faMoneyBillWave, faCalendarAlt, faBuilding, 
  faSpinner, faCheckCircle, faTimesCircle, faClock 
} from '@fortawesome/free-solid-svg-icons';
import { PayoutService } from '../../../services/payout.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';
import { ApiService } from '../../../services/api.service';
import { Payout, PayoutStatus } from '../../../models/payout.model';
import { catchError, finalize } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';

// Define interface for upcoming payout data
interface UpcomingPayout {
  communityId?: string;
  communityName?: string;
  payoutDate?: Date | string;
  expectedDate?: Date | string;
  expectedAmount?: number;
  amount?: number;
  cycleNumber?: number;
  position?: number;
  isNextInLine?: boolean;
  settings?: {
    minContribution: number;
    backupFundPercentage: number;
  };
  memberCount?: number;
}

@Component({
  selector: 'app-payout-history',
  standalone: true,  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    RouterModule,
    FontAwesomeModule
  ],
  templateUrl: './payout-history.component.html',
  styleUrls: ['./payout-history.component.scss']
})
export class PayoutHistoryComponent implements OnInit {
  displayedColumns: string[] = ['date', 'community', 'cycle', 'amount', 'status'];
  
  // Payouts data
  payouts: Payout[] = [];
  upcomingPayouts: any[] = [];
  
  // Pagination
  totalPayouts: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  
  // Stats
  totalReceived: number = 0;
  upcomingTotal: number = 0;
  communitiesPaid: number = 0;
  
  // Status and loading
  isLoading: boolean = false;
  error: string | null = null;
  
  // Icons
  faMoneyBillWave = faMoneyBillWave;
  faCalendarAlt = faCalendarAlt;
  faBuilding = faBuilding;
  faSpinner = faSpinner;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faClock = faClock;
  constructor(
    private payoutService: PayoutService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private api: ApiService
  ) { }
  ngOnInit(): void {
    // Load upcoming payouts first, as we'll use them to enrich the payout history
    this.loadUpcomingPayouts();
    this.loadPayoutHistory();
  }
    /**
   * Load payout history for the current user
   */
  loadPayoutHistory(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      this.toastService.error('Please login to view your payout history');
      return;
    }
    
    this.isLoading = true;
    this.loadingService.start('load-payouts');
    
    this.payoutService.getPayoutsByUser(userId)
      .pipe(
        catchError(error => {
          this.error = error?.error?.message || 'Failed to load payout history';
          this.toastService.error(this.error || 'An unknown error occurred');
          this.isLoading = false;
          this.loadingService.stop('load-payouts');
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoading = false;
          this.loadingService.stop('load-payouts');
        })
      )      .subscribe(data => {
        // Handle different response formats
        if (data && Array.isArray(data)) {
          this.payouts = data;
        } else if (data && data.payouts && Array.isArray(data.payouts)) {
          this.payouts = data.payouts;
          this.totalPayouts = data.total || data.payouts.length;
        } else {
          this.payouts = [];
        }
        
        // Enrich payouts with community names from upcoming payouts
        this.enrichPayoutData();
        
        console.log('Payouts:', this.payouts);
        this.calculatePayoutStats();
      });
  }  /**
   * Load upcoming payouts
   */  
  loadUpcomingPayouts(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }
    
    this.isLoading = true;
    this.payoutService.getUpcomingPayoutsByUser(userId)
      .pipe(
        catchError(error => {
          console.error('Failed to load upcoming payouts:', error);
          this.upcomingPayouts = [];
          this.calculateUpcomingTotal();
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(data => {
        console.log('Upcoming payouts raw data:', data);
        
        // Make sure we're dealing with an array
        let upcomingPayoutsArray: UpcomingPayout[] = [];
        if (data && Array.isArray(data)) {
          upcomingPayoutsArray = data;
        } else if (data && data.upcomingPayouts && Array.isArray(data.upcomingPayouts)) {
          // Handle case where the API returns an object with an upcomingPayouts property
          upcomingPayoutsArray = data.upcomingPayouts;
        } else {
          // Default to empty array if data isn't in expected format
          upcomingPayoutsArray = [];
        }
        
        // Filter out any null or undefined entries
        upcomingPayoutsArray = upcomingPayoutsArray.filter((payout): payout is UpcomingPayout => !!payout);
        
        // Fetch additional community information for each payout to better calculate expected amounts
        const enhancedPayouts: UpcomingPayout[] = [];
        const fetchPromises = upcomingPayoutsArray.map((payout: UpcomingPayout) => {
          if (!payout.communityId) return Promise.resolve(payout);
          
          return new Promise<UpcomingPayout>(resolve => {
            this.api.get<any>(`/communities/${payout.communityId}`)
              .pipe(
                catchError(error => {
                  console.error(`Failed to fetch details for community ${payout.communityId}:`, error);
                  return new Observable(observer => {
                    observer.next({});
                    observer.complete();
                  });
                })
              )              .subscribe((communityData: any) => {
                // Enhance the payout with additional community data
                const enhanced: UpcomingPayout = { ...payout };
                
                if (communityData) {
                  console.log('Community data:', communityData);
                  
                  // Handle nested data structure - API might return either direct or nested community data
                  const community = communityData.community || communityData;
                  
                  // Set community name
                  enhanced.communityName = community.name || payout.communityName;
                  
                  // Get settings from proper location in response
                  const settings = community.settings;
                  enhanced.settings = settings;
                  
                  // Get member count - might be in different locations depending on API response
                  enhanced.memberCount = community.members?.length || 0;
                    // Calculate a more accurate expectedAmount if possible
                  if (settings && settings.minContribution) {
                    const activeMembers = enhanced.memberCount || 0;
                    const minContribution = Number(settings.minContribution);
                    const backupFundPercentage = Number(settings.backupFundPercentage) || 10;
                    
                    // Only override if we don't already have an expected amount
                    if (!enhanced.expectedAmount || enhanced.expectedAmount === 0) {
                      const calculatedAmount = minContribution * activeMembers * (1 - (backupFundPercentage / 100));
                      console.log(`Calculated amount for ${enhanced.communityName}: $${calculatedAmount.toFixed(2)} = ${minContribution} * ${activeMembers} * (1 - (${backupFundPercentage} / 100))`);
                      enhanced.expectedAmount = calculatedAmount;
                    }
                  }
                }
                
                enhancedPayouts.push(enhanced);
                resolve(enhanced);
              });
          });
        });
          Promise.all(fetchPromises).then(() => {
          // Sort upcoming payouts by date
          this.upcomingPayouts = enhancedPayouts.sort((a: UpcomingPayout, b: UpcomingPayout) => {
            const dateA = a.payoutDate || a.expectedDate;
            const dateB = b.payoutDate || b.expectedDate;
            return new Date(dateA as string).getTime() - new Date(dateB as string).getTime();
          });
          
          console.log('Enhanced upcoming payouts:', this.upcomingPayouts);
          this.calculateUpcomingTotal();
        });
      });
  }  /**
   * Calculate payout statistics
   */
  calculatePayoutStats(): void {
    // Check if payouts is an array before proceeding
    if (!this.payouts || !Array.isArray(this.payouts)) {
      this.totalReceived = 0;
      this.communitiesPaid = 0;
      return;
    }

    // Filter to ensure we only include valid payout objects
    const validPayouts = this.payouts.filter(payout => payout && typeof payout === 'object');
    
    // Calculate total received - include ALL payouts since they seem to all be completed
    // even if they don't have an explicit status field
    this.totalReceived = validPayouts.reduce((sum, payout) => {      // Try to convert to number, checking for weird formats like Decimal128
      let amount = 0;
      if (payout.amount !== undefined && payout.amount !== null) {
        if (typeof payout.amount === 'number') {
          amount = payout.amount;
        } else if (typeof payout.amount === 'string') {
          amount = parseFloat(payout.amount);
        } else if (typeof payout.amount === 'object') {
          // Handle MongoDB Decimal128 object that has a toString method
          try {
            // Use a type assertion to tell TypeScript that the object has a toString method
            const objWithToString = payout.amount as { toString(): string };
            amount = parseFloat(objWithToString.toString());
          } catch (err) {
            console.error("Could not convert object to string:", err);
          }
        }
      }
      
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
      
    // Count unique communities
    const uniqueCommunities = new Set(
      validPayouts
        .filter(payout => payout.communityId)
        .map(payout => payout.communityId)
    );
    
    this.communitiesPaid = uniqueCommunities.size;
    
    // Log the calculated stats for debugging
    console.log('Calculated stats:', {
      totalReceived: this.totalReceived,
      communitiesPaid: this.communitiesPaid,
      validPayouts: validPayouts.length
    });
  }  /**
   * Calculate upcoming payout total
   */  calculateUpcomingTotal(): void {
    if (!this.upcomingPayouts || !Array.isArray(this.upcomingPayouts)) {
      this.upcomingTotal = 0;
      return;
    }
    
    // For debugging - log all payouts and their expected amounts
    console.log('Calculating total from payouts:', this.upcomingPayouts.map(p => ({
      community: p.communityName,
      expectedAmount: p.expectedAmount,
      settings: p.settings,
      memberCount: p.memberCount
    })));
    
    this.upcomingTotal = this.upcomingPayouts
      .reduce((sum: number, payout: UpcomingPayout) => {
        if (!payout) return sum;
        
        // Get the amount, checking all possible fields where it might be stored
        let amount = 0;
        
        // If we have an expectedAmount or amount, use it
        if (Number(payout.expectedAmount) > 0) {
          amount = Number(payout.expectedAmount);
          console.log(`Using provided expectedAmount for ${payout.communityName}: ${amount}`);
        } else if (Number(payout.amount) > 0) {
          amount = Number(payout.amount);
          console.log(`Using provided amount for ${payout.communityName}: ${amount}`);
        } else {
          // If we don't have an amount, we need to calculate a projected amount
          // If we have communityContributionAmount and memberCount, calculate projected payout
          if (payout.settings && payout.settings.minContribution && payout.memberCount) {
            const minContribution = Number(payout.settings.minContribution);
            const memberCount = Number(payout.memberCount);
            const backupFundPercentage = Number(payout.settings.backupFundPercentage) || 10;
            
            // Calculate projected amount: contribution * memberCount * (1 - backupFund%)
            amount = minContribution * memberCount * (1 - (backupFundPercentage / 100));
            console.log(`Calculated amount for ${payout.communityName}: ${amount} = ${minContribution} * ${memberCount} * (1 - (${backupFundPercentage} / 100))`);
              // Update the payout object with the calculated amount
            payout.expectedAmount = amount;
          }
        }
        
        // Make sure it's a valid number
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
    
    // Log the calculated upcoming total
    console.log('Calculated upcoming total:', this.upcomingTotal);
  }
  
  /**
   * Handle page change event
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPayoutHistory();
  }
  
  /**
   * Format date string
   */
  formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
    /**
   * Format currency amount
   */
  formatCurrency(amount: number | undefined | null): string {
    // Ensure we have a valid number
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(validAmount);
  }
  
  /**
   * Get icon for payout status
   */
  getStatusIcon(status: PayoutStatus): any {
    switch(status) {
      case 'completed': return this.faCheckCircle;
      case 'processing': return this.faSpinner;
      case 'failed': return this.faTimesCircle;
      case 'scheduled': return this.faClock;
      default: return this.faClock;
    }
  }  /**
   * Enrich payout data with community names from upcoming payouts
   */
  enrichPayoutData(): void {
    if (!this.payouts || this.payouts.length === 0) {
      return;
    }
    
    // First try to get names from upcoming payouts
    if (this.upcomingPayouts && this.upcomingPayouts.length > 0) {
      this.payouts.forEach(payout => {
        if (!payout.communityName && payout.communityId) {
          // Find a matching upcoming payout with the same community ID
          const match = this.upcomingPayouts.find(upcoming => 
            upcoming.communityId === payout.communityId
          );
          
          if (match && match.communityName) {
            payout.communityName = match.communityName;
          }
        }
      });
    }
    
    // Create a cache to avoid duplicate API calls
    const communityNameCache: {[key: string]: string} = {};
    
    // For any remaining payouts without communityName, fetch from backend
    const missingCommunityIds = this.payouts
      .filter(payout => !payout.communityName && payout.communityId)
      .map(payout => payout.communityId);
      
    if (missingCommunityIds.length > 0) {
      // Get unique community IDs
      const uniqueCommunityIds = [...new Set(missingCommunityIds)];
      
      console.log(`Fetching names for ${uniqueCommunityIds.length} communities...`);
      
      // For each community ID, fetch its name
      uniqueCommunityIds.forEach(communityId => {
        if (!communityId) {
          return; // Skip null or undefined community IDs
        }
        
        // Skip if we've already fetched this community's name in this session
        if (communityNameCache[communityId]) {
          this.updatePayoutCommunityNames(communityId, communityNameCache[communityId]);
          return;
        }
        
        // Set a temporary name while we fetch
        this.updatePayoutCommunityNames(communityId, 'Loading...');
        
        this.payoutService.getCommunityName(communityId)
          .pipe(
            catchError(error => {
              console.error(`Failed to fetch name for community ${communityId}:`, error);
              this.updatePayoutCommunityNames(communityId, 'Unknown Community');
              return throwError(() => error);
            })
          )
          .subscribe(data => {
            if (data && data.name) {
              // Cache the name
              communityNameCache[communityId] = data.name;
              // Update all payouts with this community ID
              this.updatePayoutCommunityNames(communityId, data.name);
            } else {
              this.updatePayoutCommunityNames(communityId, 'Unknown Community');
            }
          });
      });
    }
  }
  
  /**
   * Update community names for all payouts with a given community ID
   */
  private updatePayoutCommunityNames(communityId: string, name: string): void {
    if (!this.payouts || !communityId) {
      return;
    }
    
    this.payouts.forEach(payout => {
      if (payout.communityId === communityId) {
        payout.communityName = name;
      }
    });
  }
}