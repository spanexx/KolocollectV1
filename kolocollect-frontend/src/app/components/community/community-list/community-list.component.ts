import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunityService } from '../../../services/community.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { MatDialog } from '@angular/material/dialog';
import { catchError, finalize, throwError, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { Community, CommunityListResponse, MidCycle } from '../../../models/community.model';
import { JoinCommunityDialogComponent } from '../join-community-dialog/join-community-dialog.component';
import { MidcycleService } from '../../../services/midcycle.service';
import { CommunityEventService } from '../../../services/community-event.service';
// Removed unused import: CommunityFilterComponent
import { CommunityFrontendFilterComponent } from '../community-frontend-filter/community-frontend-filter.component';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';

// FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUsers, 
  faPlus, 
  faSearch, 
  faFilter, 
  faUserFriends, 
  faMoneyBillWave, 
  faCalendar,
  faShieldAlt,
  faEye,
  faUserPlus,
  faSpinner,
  faClock,
  faHandHoldingDollar,
  faChevronDown,
  faChevronUp,
  faTimes
} from '@fortawesome/free-solid-svg-icons';
import { MemberService } from '../../../services/member.service';
import { CommunityFilterComponent } from '../community-filter/community-filter.component';

@Component({
  selector: 'app-community-list',
  templateUrl: './community-list.component.html',
  styleUrls: ['./community-list.component.scss'],  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,    MatProgressSpinnerModule,
    FontAwesomeModule,
    MatDialogModule,
    MatDividerModule,
    // Removed unused CommunityFilterComponent
    CommunityFrontendFilterComponent
  ]
})
export class CommunityListComponent implements OnInit, OnDestroy {  // Font Awesome icons
  faUsers = faUsers;
  faPlus = faPlus;
  faSearch = faSearch;
  faFilter = faFilter;
  faUserFriends = faUserFriends;
  faMoneyBillWave = faMoneyBillWave;
  faCalendar = faCalendar;
  faShieldAlt = faShieldAlt;
  faEye = faEye;
  faUserPlus = faUserPlus;
  faTimes = faTimes;
  faSpinner = faSpinner;
  faClock = faClock;  faHandHoldingDollar = faHandHoldingDollar; // New icon for contribute button
  faChevronDown = faChevronDown;
  faChevronUp = faChevronUp;
  
  communities: Community[] = [];
  allCommunities: Community[] = []; // All communities fetched from API for frontend filtering
  filteredCommunities: Community[] = []; // Communities after frontend filtering
  totalCount: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  searchQuery: string = '';
  filterOptions: any = {};
  isLoading: boolean = false;
  error: string | null = null;
  userCommunities: string[] = []; // IDs of communities the user is a member of
  expandedCommunities: {[communityId: string]: boolean} = {}; // Track which communities are expanded
  
  // Frontend filter flag
  useFrontendFilter: boolean = true; // Set to true to enable frontend filtering
    constructor(
    private communityService: CommunityService,
    private userService: UserService,
    private memberService: MemberService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private midcycleService: MidcycleService
  ) {}
  ngOnInit(): void {
    // Set frontend filter flag to true to use the new frontend filtering
    this.useFrontendFilter = true;
    this.loadCommunities();
    this.loadUserCommunities();
  }loadCommunities(): void {
    this.isLoading = true;
    this.error = null;
    this.loadingService.start('load-communities');

    // Reset active member counts cache when loading new communities
    this.activeMemberCounts = {};

    // For frontend filtering, we need to load all communities at once
    // Comment out the original server-side pagination approach
    /*
    const params = {
      page: this.pageIndex + 1,
      limit: this.pageSize,
      ...this.filterOptions
    };
    */
    
    // For frontend filtering, we load all communities without pagination
    const params = this.useFrontendFilter ? 
      { limit: 1000 } : // Load a large number of communities for frontend filtering
      {
        page: this.pageIndex + 1,
        limit: this.pageSize,
        ...this.filterOptions
      };
      
    this.communityService.filterCommunities(params).pipe(
      catchError(error => {
        this.error = error.message || 'Failed to load communities';
        this.toastService.error('Error loading communities');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('load-communities');
      })
    ).subscribe((response: any) => {
      if (this.useFrontendFilter) {
        // Store all communities for frontend filtering
        this.allCommunities = response.data || [];
        this.filteredCommunities = [...this.allCommunities]; // Initially show all
        this.communities = this.filteredCommunities.slice(this.pageIndex * this.pageSize, (this.pageIndex + 1) * this.pageSize);
        this.totalCount = this.filteredCommunities.length;
        
        console.log('All Communities loaded for frontend filtering:', this.allCommunities.length);
      } else {
        // Original backend filtering logic
        this.communities = response.data || [];
        this.totalCount = response.pagination?.totalItems || 0;
        
        if (this.communities.length === 0 && this.totalCount > 0) {
          // If we have no communities but total count is greater than 0,
          // we might be on a page with no data, so go back to first page
          this.pageIndex = 0;
          this.loadCommunities();
          return;
        }
      }
        
      // Pre-fetch data for all loaded communities at once
      const communitiesToPrefetch = this.useFrontendFilter ? this.allCommunities : this.communities;
      this.prefetchActiveMemberCounts(communitiesToPrefetch);
      
      // Check midcycle readiness status for all communities
      communitiesToPrefetch.forEach(community => {
        this.checkMidcycleReadiness(community);
      });
    });
  }  loadUserCommunities(): void {
    // Check if user is logged in
    const currentUser = this.authService.currentUserValue;
    
    if (!currentUser) {
      return;
    }

    this.loadingService.start('user-communities');
    
    this.userService.getUserCommunities(currentUser.id).pipe(
      catchError(error => {
        return of({ communities: [] }); // Return empty array on error
      }),
      finalize(() => {
        this.loadingService.stop('user-communities');
      })
    ).subscribe(response => {

      
      // Reset user communities
      this.userCommunities = [];
      
      // Check if we have the expected data structure
      if (response && response.communities) {
        // Handle different response structures
        if (Array.isArray(response.communities)) {
          this.userCommunities = response.communities.map((comm: any) => {
            const id = comm.id || comm._id || comm.communityId || (comm.community && (comm.community._id || comm.community.id));
            return id;
          }).filter((id: string) => id); // Filter out any undefined IDs
        } 
        else if (response.communities.communities && Array.isArray(response.communities.communities)) {
          this.userCommunities = response.communities.communities.map((comm: any) => {
            const id = comm.id || comm._id || comm.communityId || (comm.community && (comm.community._id || comm.community.id));
            return id;
          }).filter((id: string) => id); // Filter out any undefined IDs
        }
        else {
          console.log('Unknown communities structure:', response.communities);
          this.userCommunities = [];
        }
      } else {
        this.userCommunities = [];      }

      // Add admin's communities
      if (this.authService.currentUserValue && this.communities.length > 0) {
        const userId = this.authService.currentUserValue.id;
        
        // Find communities where the user is admin
        const adminCommunities = this.communities
          .filter(community => community.admin?.id === userId)
          .map(community => community._id);
        
        if (adminCommunities.length > 0) {
          this.userCommunities.push(...adminCommunities);
        }
      }
      
    });
  }
  /**
   * Check if the current user is a member of the given community
   * Handles different ID formats (with ObjectId structure or plain string)
   */  
  isUserMemberOfCommunity(communityId: string): boolean {
    if (!communityId || !this.userCommunities || this.userCommunities.length === 0) {
      return false;
    }
 

    const isMember = this.userCommunities.some((userCommunity: any) => {
      // Handle when userCommunity is an object
      if (typeof userCommunity === 'object' && userCommunity !== null) {
        return (userCommunity.id === communityId || userCommunity._id === communityId);
      }
      // Handle when userCommunity is a string ID
      return userCommunity === communityId;
    });

    return isMember;
  }

  navigateToContributions(): void {
    this.router.navigate(['/contributions']);
  }
  // Frontend search (commented out backend search)
  searchCommunities(): void {
    // This method is now handled by the frontend filter component
    // Client-side filtering is applied through the onFilteredCommunitiesChange method
    
    /*
    if (this.searchQuery.trim()) {
      this.isLoading = true;
      this.error = null;
      this.loadingService.start('search-communities');

      this.communityService.searchCommunities(this.searchQuery).pipe(
        catchError(error => {
          this.error = error.message || 'Failed to search communities';
          this.toastService.error('Error searching communities');
          return throwError(() => error);
        }),
        finalize(() => {
          this.isLoading = false;
          this.loadingService.stop('search-communities');
        })
      ).subscribe((response: any) => {
        // Access the communities array from the data property of the response
        this.communities = response.data || [];
        
        // Set pagination info for searched results
        this.totalCount = this.communities.length;
        this.pageIndex = 0;
        
        if (this.communities.length === 0) {
          this.toastService.info('No communities found matching your search criteria');
        }
      });
    } else {
      this.loadCommunities();
    }
    */
  }

  applyFilters(filters: any): void {
    // Reset old filters
    this.filterOptions = {};
    
    // Apply new filters
    if (filters) {
      this.filterOptions = { ...filters };
      
      // Add default sort if none provided
      if (!this.filterOptions.sortBy) {
        this.filterOptions.sortBy = 'createdAt';
        this.filterOptions.order = 'desc';
      }
    }
    
    this.pageIndex = 0; // Reset to first page
    this.loadCommunities();
    
    // Show a message to indicate filtering is active
    if (Object.keys(this.filterOptions).length > 0) {
      const filterDescription = this.getFilterDescription(this.filterOptions);
      this.toastService.info(`Showing communities ${filterDescription}`);
    }
  }
  
  /**
   * Generate a human-readable description of the current filters
   */
  getFilterDescription(filters: any): string {
    const descriptions = [];
    
    if (filters.status === 'active') {
      descriptions.push('with active status');
    }
    
    if (filters.backupFundMin) {
      descriptions.push(`with backup fund ≥ €${filters.backupFundMin}`);
    }
    
    if (filters.minContribution) {
      descriptions.push(`with minimum contribution ≥ €${filters.minContribution}`);
    }
    
    if (filters.contributionFrequency) {
      descriptions.push(`with ${filters.contributionFrequency} contribution frequency`);
    }
    
    if (filters.sortBy) {
      const sortFields: Record<string, string> = {
        'memberCount': 'member count',
        'minContribution': 'minimum contribution',
        'backupFund': 'backup fund',
        'createdAt': 'creation date'
      };
      
      const sortField = sortFields[filters.sortBy] || filters.sortBy;
      const sortOrder = filters.order === 'desc' ? 'descending' : 'ascending';
      
      descriptions.push(`sorted by ${sortField} (${sortOrder})`);
    }
    
    return descriptions.length > 0 ? descriptions.join(', ') : 'with no filters';
  }
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    
    if (this.useFrontendFilter) {
      // For frontend filtering, we just update the visible slice of data
      this.communities = this.filteredCommunities.slice(
        this.pageIndex * this.pageSize, 
        (this.pageIndex + 1) * this.pageSize
      );
    } else {
      // For backend filtering, we need to load the new page from the server
      this.loadCommunities();
    }
  }
  
  /**
   * Handle filtered communities from the frontend filter component
   */
  onFilteredCommunitiesChange(filteredCommunities: Community[]): void {
    this.filteredCommunities = filteredCommunities;
    this.pageIndex = 0; // Reset to first page when filter changes
    this.communities = this.filteredCommunities.slice(0, this.pageSize);
  }
  
  /**
   * Handle total count updates from the frontend filter component
   */
  onTotalCountChange(count: number): void {
    this.totalCount = count;
  }/**
   * Cache for active member counts to avoid repeated API calls
   */
  private activeMemberCounts: { [communityId: string]: number } = {};  /**
   * Prefetch active member counts for all communities in a single API call
   * This significantly reduces the number of API requests when displaying many communities
   */
  prefetchActiveMemberCounts(communities: Community[]): void {
    if (!communities || communities.length === 0) {
      return;
    }

    // Extract community IDs for the batch request
    const communityIds = communities.map(community => community._id);

    console.log(`Prefetching active member counts for ${communityIds.length} communities`);

    // Make a single API call to get all active member counts at once
    this.memberService.getBatchActiveMemberCounts(communityIds).pipe(
      catchError(error => {
        console.error('Error fetching batch active member counts:', error);
        // If the batch endpoint fails, initialize all counts to 0
        communityIds.forEach(id => {
          this.activeMemberCounts[id] = 0;
        });
        return of({ status: 'error', data: [] });
      })
    ).subscribe({
      next: (response) => {
        console.log('Received batch active member counts:', response);
        if (response && response.data) {
          // Update the cache with all returned counts
          response.data.forEach(item => {
            this.activeMemberCounts[item.communityId] = item.activeMembers;
          });
          
          // Set any missing communities to 0
          communityIds.forEach(id => {
            if (this.activeMemberCounts[id] === undefined) {
              this.activeMemberCounts[id] = 0;
            }
          });
        }
      },
      error: (err) => {
        console.error('Error in batch active member counts subscription:', err);
      }
    });
  }
  /**
   * Get the count of active members for a community
   * Uses cached value from the batch request, or returns 0
   * No individual API calls are made from this method
   */
  getActiveMemberCount(community: Community): number {
    // If we have a cached value, return it
    if (this.activeMemberCounts[community._id] !== undefined) {
      return this.activeMemberCounts[community._id];
    }

    // Return 0 if we don't have a cached value yet
    // This will be updated when the batch request completes
    return 0;
  }
  
  isCommunityFull(community: Community): boolean {
    if (!community.settings || !community.settings.maxMembers) return false;
    const activeMemberCount = this.getActiveMemberCount(community);
    return activeMemberCount >= community.settings.maxMembers;
  }

  formatContributionFrequency(frequency: string | undefined): string {
    if (!frequency) return 'Not specified';
    
    // Convert first letter to uppercase and rest to lowercase
    return frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
  }

  getNextPayoutDate(community: Community): string {
    if (!community.nextPayout) {
      return 'Not scheduled';
    }

    try {
      return formatDate(new Date(community.nextPayout), 'MMM d, y', 'en-US');
    } catch (error) {
      return 'Invalid date';
    }
  }  /**
   * Cache for midcycle readiness status to avoid repeated API calls
   */
  private midcycleReadinessCache: { [midcycleId: string]: boolean } = {};

  /**
   * Check if a midcycle is ready using the API
   * This provides a more accurate readiness status beyond what's in the community data
   */
  checkMidcycleReadiness(community: Community): void {
    if (!community.midCycle || !Array.isArray(community.midCycle) || community.midCycle.length === 0) {
      return;
    }
    
    const activeMidCycle = community.midCycle.find((mc: MidCycle) => !mc.isComplete);
    if (!activeMidCycle || !activeMidCycle.id) {
      return;
    }

    // If we already checked this midcycle, don't check again
    if (this.midcycleReadinessCache[activeMidCycle.id] !== undefined) {
      return;
    }

    // Set default value until we get a response
    this.midcycleReadinessCache[activeMidCycle.id] = activeMidCycle.isReady;
    
    this.midcycleService.checkMidCycleReadiness(community._id, activeMidCycle.id).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.midcycleReadinessCache[activeMidCycle.id] = response.data.isReady;
        }
      },
      error: (error) => {
        console.error('Error checking midcycle readiness:', error);
      }
    });
  }

  /**
   * Get the readiness status of a midcycle
   * This uses cached values from the API if available
   */
  isMidcycleReady(community: Community): boolean {
    if (!community.midCycle || !Array.isArray(community.midCycle) || community.midCycle.length === 0) {
      return false;
    }
    
    const activeMidCycle = community.midCycle.find((mc: MidCycle) => !mc.isComplete);
    if (!activeMidCycle || !activeMidCycle.id) {
      return false;
    }

    // Try to get the cached readiness from our API check
    if (this.midcycleReadinessCache[activeMidCycle.id] !== undefined) {
      return this.midcycleReadinessCache[activeMidCycle.id];
    }
    console.log("Active midcycle ID:", activeMidCycle)

    // If no cache, use the value from the community data
    return activeMidCycle.isReady;
  }

  /**
   * Get the mid-cycle status for display 
   */
  getMidCycleStatus(community: Community): string {
    if (!community.midCycle || !Array.isArray(community.midCycle) || community.midCycle.length === 0) {
      return 'No active mid-cycle';
    }
    
    const activeMidCycle = community.midCycle.find((mc: MidCycle) => !mc.isComplete);
    if (!activeMidCycle) {
      return 'No active mid-cycle';
    }
    
    // Check if we have a cached readiness status from the API
    if (activeMidCycle.id && this.midcycleReadinessCache[activeMidCycle.id] !== undefined) {
      return this.midcycleReadinessCache[activeMidCycle.id] ? 'Ready' : 'Status: Collecting contributions';
    }
    
    // Otherwise, use the midcycle's isReady property
    return activeMidCycle.isReady ? 'Ready' : 'Status: Collecting contributions';
  }
  joinCommunity(communityId: string): void {
    if (!this.authService.currentUserValue) {
      this.toastService.error('You must be logged in to join a community');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/communities/${communityId}` } });
      return;
    }

    // Find the community by ID
    const community = this.communities.find(c => c._id === communityId);
    
    if (!community) {
      this.toastService.error('Community not found');
      return;
    }
    
    // Check if community is full
    if (this.isCommunityFull(community)) {
      this.toastService.error('This community is already full');
      return;
    }

    // Open the join community dialog
    const dialogRef = this.dialog.open(JoinCommunityDialogComponent, {
      width: '500px',
      data: {
        communityId: communityId,
        community: community
      }
    });

    // Handle the dialog result
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCommunities(); // Reload communities to reflect new membership
      }
    });
  }

  navigateToCommunityDetail(communityId: string): void {
    this.router.navigate(['/communities', communityId]);
  }

  /**
   * Navigate to make-contribution page with the communityId pre-selected
   * @param communityId The ID of the community to contribute to
   */
  navigateToMakeContribution(communityId: string): void {
    this.router.navigate(['/contributions/make'], {
      queryParams: { communityId: communityId }
    });
  }

  /**
   * Format backup fund amount with proper decimal places
   * @param backupFund The backup fund amount to format
   */  formatBackupFundAmount(backupFund: number | undefined): string {
    if (backupFund === undefined || backupFund === null) {
      return '0.00';
    }
    return backupFund.toFixed(2);
  }
  
  /**
   * Toggle the expanded state of a community card
   * @param communityId The ID of the community to toggle
   */
  toggleCommunityDetails(communityId: string, event: Event): void {
    event.preventDefault(); // Prevent event bubbling
    event.stopPropagation(); // Prevent event bubbling
    
    // Toggle the expansion state
    this.expandedCommunities[communityId] = !this.expandedCommunities[communityId];
  }
  
  /**
   * Check if a community card is expanded
   * @param communityId The ID of the community to check
   */
  isCommunityExpanded(communityId: string): boolean {
    return this.expandedCommunities[communityId] === true;
  }

  /**
   * Calculate the total amount distributed to community members
   * @param community The community object
   */
  calculateTotalDistributed(community: Community): number {
    // If no cycles or midCycles exist, return 0
    if (!community.cycles || !community.cycles.length) {
      return 0;
    }
    
    let totalDistributed = 0;
    
    // Sum up payouts from all completed midCycles across all cycles
    for (const cycle of community.cycles) {
      if (cycle.midCycles && cycle.midCycles.length) {
        // Only count completed midCycles
        const completedMidCycles = cycle.midCycles.filter(mc => mc.isComplete);
        
        for (const midCycle of completedMidCycles) {
          // Add the payout amount to our total
          if (midCycle.payoutAmount) {
            totalDistributed += midCycle.payoutAmount;
          }
        }
      }
    }
    
    return totalDistributed;
  }
  
  /**
   * Format currency value for display
   * @param value The value to format
   */
  formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) {
      return '€0.00';
    }
    return '€' + value.toFixed(2);
  }

  /**
   * Handle filter changes from the CommunityFilterComponent
   */
  onFilterChange(filters: any): void {
    console.log('Filters applied:', filters);
    this.filterOptions = filters;
    this.pageIndex = 0; // Reset to first page when filters change
    this.loadCommunities();
  }  // No need for filter panel toggle with the new sidebar implementation

  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    // Complete the destroy subject to clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}