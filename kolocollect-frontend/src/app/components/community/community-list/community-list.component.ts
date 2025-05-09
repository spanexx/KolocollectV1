import { Component, OnInit } from '@angular/core';
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
import { catchError, finalize, throwError, forkJoin, of } from 'rxjs';
import { Community, CommunityListResponse, MidCycle } from '../../../models/community.model';
import { JoinCommunityDialogComponent } from '../join-community-dialog/join-community-dialog.component';

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
  faHandHoldingDollar
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-community-list',
  templateUrl: './community-list.component.html',
  styleUrls: ['./community-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    FontAwesomeModule,
    MatDialogModule,
    MatDividerModule
  ]
})
export class CommunityListComponent implements OnInit {
  // Font Awesome icons
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
  faSpinner = faSpinner;
  faClock = faClock;
  faHandHoldingDollar = faHandHoldingDollar; // New icon for contribute button
  
  communities: Community[] = [];
  totalCount: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  searchQuery: string = '';
  filterOptions: any = {};
  isLoading: boolean = false;
  error: string | null = null;
  userCommunities: string[] = []; // IDs of communities the user is a member of
  
  constructor(
    private communityService: CommunityService,
    private userService: UserService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadCommunities();
    this.loadUserCommunities();
  }

  loadCommunities(): void {
    this.isLoading = true;
    this.error = null;
    this.loadingService.start('load-communities');

    // Build filter parameters
    const params = {
      page: this.pageIndex + 1,  // API uses 1-based pagination
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
      console.log('Community List Response:', response);
      this.communities = response.data || [];
      this.totalCount = response.pagination?.totalItems || 0;
      
      if (this.communities.length === 0 && this.totalCount > 0) {
        // If we have no communities but total count is greater than 0,
        // we might be on a page with no data, so go back to first page
        this.pageIndex = 0;
        this.loadCommunities();
      }
    });
  }  loadUserCommunities(): void {
    // Check if user is logged in
    const currentUser = this.authService.currentUserValue;
    console.log('Current user:', currentUser);
    
    if (!currentUser) {
      console.log('No user logged in, skipping community load');
      return;
    }

    this.loadingService.start('user-communities');
    console.log('Fetching communities for user ID:', currentUser.id);
    
    this.userService.getUserCommunities(currentUser.id).pipe(
      catchError(error => {
        console.error('Error loading user communities:', error);
        return of({ communities: [] }); // Return empty array on error
      }),
      finalize(() => {
        this.loadingService.stop('user-communities');
      })
    ).subscribe(response => {
      console.log('User communities API response:', response);
      console.log('API response structure:', JSON.stringify(response, null, 2));
      
      // Reset user communities
      this.userCommunities = [];
      
      // Check if we have the expected data structure
      if (response && response.communities) {
        // Handle different response structures
        if (Array.isArray(response.communities)) {
          console.log('Communities is an array, using directly');
          this.userCommunities = response.communities.map((comm: any) => {
            const id = comm.id || comm._id || comm.communityId || (comm.community && (comm.community._id || comm.community.id));
            console.log('Extracted community ID:', id, 'from:', comm);
            return id;
          }).filter((id: string) => id); // Filter out any undefined IDs
        } 
        else if (response.communities.communities && Array.isArray(response.communities.communities)) {
          console.log('Communities is nested in communities.communities');
          this.userCommunities = response.communities.communities.map((comm: any) => {
            const id = comm.id || comm._id || comm.communityId || (comm.community && (comm.community._id || comm.community.id));
            console.log('Extracted community ID:', id, 'from:', comm);
            return id;
          }).filter((id: string) => id); // Filter out any undefined IDs
        }
        else {
          console.log('Unknown communities structure:', response.communities);
          this.userCommunities = [];
        }
      } else {
        console.log('No communities found in response');
        this.userCommunities = [];      }

      // Add admin's communities
      if (this.authService.currentUserValue && this.communities.length > 0) {
        const userId = this.authService.currentUserValue.id;
        console.log('Looking for communities where user is admin:', userId);
        
        // Find communities where the user is admin
        const adminCommunities = this.communities
          .filter(community => community.admin === userId)
          .map(community => community._id);
        
        if (adminCommunities.length > 0) {
          console.log('Found admin communities:', adminCommunities);
          this.userCommunities.push(...adminCommunities);
        }
      }
      
      console.log('Final userCommunities array after adding admin communities:', this.userCommunities);
    });
  }
  /**
   * Check if the current user is a member of the given community
   * Handles different ID formats (with ObjectId structure or plain string)
   */  isUserMemberOfCommunity(communityId: string): boolean {
    if (!communityId || !this.userCommunities || this.userCommunities.length === 0) {
      console.log(`Cannot check membership for community ${communityId}: no user communities loaded`);
      return false;
    }
    
    // Debugging the problem with communities not matching
    console.log(`Checking if user is member of community: ${communityId}`);
    console.log(`Available user communities:`, this.userCommunities);
    
    // Check if userCommunities contains objects rather than just IDs
    if (this.userCommunities.length > 0 && typeof this.userCommunities[0] === 'object') {
      // If userCommunities contains objects with _id or id properties
      const isMember = this.userCommunities.some((community: any) => {
        if (typeof community === 'object') {
          return (community._id === communityId || community.id === communityId);
        }
        return false;
      });
      
      if (isMember) {
        console.log(`User is a member of community ${communityId} (matched object)`);
        return true;
      }
    } else {
      // If userCommunities contains direct ID strings
      if (this.userCommunities.includes(communityId)) {
        console.log(`Direct match found for community ${communityId}`);
        return true;
      }
    }
    
    // Use admin field as fallback if the user is admin
    const communityInList = this.communities.find(c => c._id === communityId);
    if (communityInList && this.authService.currentUserValue) {
      const isAdmin = communityInList.admin === this.authService.currentUserValue.id;
      if (isAdmin) {
        console.log(`User is admin of community ${communityId}, treating as member`);
        return true;
      }
    }
    
    console.log(`User is NOT a member of community ${communityId}`);
    return false;
  }

  navigateToContributions(): void {
    this.router.navigate(['/contributions']);
  }

  searchCommunities(): void {
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
    this.loadCommunities();
  }

  getActiveMemberCount(community: Community): number {
    if (!community.members) return 0;
    return community.members.filter(member => member).length;
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
  }

  getMidCycleStatus(community: Community): string {
    if (!community.midCycle || !Array.isArray(community.midCycle) || community.midCycle.length === 0) {
      return 'No active mid-cycle';
    }
    
    const activeMidCycle = community.midCycle.find((mc: MidCycle) => !mc.isComplete);
    if (!activeMidCycle) {
      return 'No active mid-cycle';
    }
    
    return activeMidCycle.isReady ? 'Ready for payout' : 'Collecting contributions';
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
}