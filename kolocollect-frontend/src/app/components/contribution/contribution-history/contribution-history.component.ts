import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { ContributionService } from '../../../services/contribution.service';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { Contribution, ContributionSummary } from '../../../models/contribution.model';

// Import FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faReceipt,
  faHistory,
  faCalendarAlt,
  faBuilding,
  faMoneyBillWave,
  faCheckCircle,
  faHourglassHalf,
  faTimesCircle,
  faSpinner,
  faFilter,
  faDownload,
  faPlus,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-contribution-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatChipsModule,
    FontAwesomeModule
  ],
  templateUrl: './contribution-history.component.html',
  styleUrls: ['./contribution-history.component.scss']
})
export class ContributionHistoryComponent implements OnInit {
  // FontAwesome icons
  faReceipt = faReceipt;
  faHistory = faHistory;
  faCalendarAlt = faCalendarAlt;
  faBuilding = faBuilding;
  faMoneyBillWave = faMoneyBillWave;
  faCheckCircle = faCheckCircle;
  faHourglassHalf = faHourglassHalf;
  faTimesCircle = faTimesCircle;
  faSpinner = faSpinner;
  faFilter = faFilter;
  faDownload = faDownload;
  faPlus = faPlus;
  faExclamationCircle = faExclamationCircle;

  // Table related properties
  displayedColumns: string[] = ['date', 'community', 'cycle', 'amount', 'status'];
  contributions: Contribution[] = [];
  totalContributions = 0;
  pageSize = 10;
  currentPage = 0;
  isLoading = false;
  error = '';
  
  // Stats
  contributionSummary: ContributionSummary | null = null;
  activeCommunities = 0;
  upcomingContributionsCount = 0;
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private contributionService: ContributionService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router,
    private communityService: CommunityService // Inject CommunityService
  ) {}

  ngOnInit(): void {
    this.loadContributionsHistory();
    this.loadContributionSummary();
  }
    loadContributionsHistory(): void {
    this.isLoading = true;
    this.loadingService.start('contributions');
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('User not authenticated');
      this.isLoading = false;
      this.loadingService.stop('contributions');
      return;
    }
    
    this.contributionService.getContributionsWithCommunityDetails(userId)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('contributions');
      }))
      .subscribe({
        next: (response) => {
          if (Array.isArray(response)) {
            // Process and normalize contributions
            this.contributions = response.map(c => {
              // Fetch missing community details if needed
              if (c.communityName === 'Loading...' && c.communityId) {
                this.fetchCommunityDetails(c);
              }
              
              return {
                ...c,
                id: c._id || c.id,
                contributionDate: new Date(c.date || c.contributionDate),
                communityName: c.communityName || 'Unknown Community',
                cycleNumber: c.cycleNumber || 1
              };
            });
            
            this.totalContributions = this.contributions.length;
            console.log('Processed contributions:', this.contributions);
          } else {
            this.toastService.error('Invalid response format received');
          }
        },
        error: (error) => {
          this.error = 'Failed to load contributions';
          this.toastService.error('Failed to load contribution history');
          console.error('Error loading contributions:', error);
        }
      });
  }
  
  loadContributionSummary(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      return;
    }
    
    // Load summary statistics like total contributed, active communities, etc.
    // This would typically come from a backend endpoint that aggregates this data
    // For now, we'll calculate based on the contributions we have
    
    // Calculate total amount contributed
    let totalAmount = 0;
    let communities = new Set<string>();
    let upcoming = 0;
    
    this.contributionService.getContributionsByUser(userId).subscribe({
      next: (contributions) => {
        if (Array.isArray(contributions)) {
          contributions.forEach(c => {
            totalAmount += c.amount;
            communities.add(c.communityId);
            
            // Count upcoming contributions (future dates)
            if (new Date(c.date) > new Date()) {
              upcoming++;
            }
          });
          
          this.contributionSummary = {
            totalAmount,
            count: contributions.length,
            pendingAmount: 0, // Would come from backend
            pendingCount: 0,  // Would come from backend
            lastContribution: contributions.length > 0 ? 
              new Date(Math.max(...contributions.map(c => new Date(c.date).getTime()))) : undefined,
            upcomingContributions: [] // Would come from backend
          };
          
          this.activeCommunities = communities.size;
          this.upcomingContributionsCount = upcoming;
        }
      },
      error: (error) => {
        console.error('Error loading contribution summary:', error);
      }
    });
  }
  
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadContributionsHistory();
  }
  
  getStatusIcon(status: string): any {
    switch(status) {
      case 'completed':
        return this.faCheckCircle;
      case 'pending':
        return this.faHourglassHalf;
      case 'failed':
        return this.faTimesCircle;
      default:
        return this.faSpinner;
    }
  }
  
  getStatusClass(status: string): string {
    switch(status) {
      case 'completed':
        return 'completed';
      case 'pending':
        return 'pending';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
  
  makeContribution(): void {
    this.router.navigate(['/contributions/make']);
  }
  
  exploreCommunities(): void {
    this.router.navigate(['/communities']);
  }
  
  formatAmount(amount: number): string {
    return `$${amount.toFixed(2)}`;
  }
  
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Fetch community details for a contribution that's missing community name
   */
  fetchCommunityDetails(contribution: any): void {
    if (!contribution.communityId) return;

    this.communityService.getCommunityById(contribution.communityId).subscribe({
      next: (response) => {
        if (response && response.community) {
          // Find this contribution in the array and update its name
          const index = this.contributions.findIndex(c => c.id === contribution.id);
          if (index !== -1) {
            this.contributions[index].communityName = response.community.name || response.community.displayName || 'Unknown Community';
          }
        }
      },
      error: (error) => {
        console.error('Failed to fetch community details:', error);
      }
    });
  }
  
  /**
   * View detailed information for a specific contribution
   * @param contribution The contribution to view
   */
  viewContributionDetails(contribution: Contribution): void {
    console.log('View details for contribution:', contribution);
    // In a real implementation, this would navigate to a details page or open a modal
    // For now, just show a toast with basic information
    this.toastService.info(`Contribution of ${this.formatAmount(contribution.amount)} to ${contribution.communityName || 'Community'} on ${this.formatDate(contribution.contributionDate)}`);
    
    // Future implementation can navigate to a details page:
    // this.router.navigate(['/contributions', contribution.id]);
  }
}