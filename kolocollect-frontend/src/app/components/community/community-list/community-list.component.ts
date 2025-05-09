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
  }

  loadUserCommunities(): void {
    // Check if user is logged in
    const currentUser = this.authService.currentUserValue;
    if (!currentUser) {
      // User not logged in, no communities to load
      return;
    }

    this.loadingService.start('user-communities');
    this.userService.getUserCommunities(currentUser.id).pipe(
      catchError(error => {
        console.error('Error loading user communities:', error);
        return of({ communities: [] }); // Return empty array on error
      }),
      finalize(() => {
        this.loadingService.stop('user-communities');
      })
    ).subscribe(response => {
      // Store the IDs of communities the user is a member of
      this.userCommunities = (response.communities || []).map((comm: any) => comm.id || comm._id);
    });
  }

  /**
   * Check if the current user is a member of the given community
   */
  isUserMemberOfCommunity(communityId: string): boolean {
    return this.userCommunities.includes(communityId);
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
}