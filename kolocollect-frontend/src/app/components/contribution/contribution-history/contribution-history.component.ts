import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu'; // Add MenuModule
import { MatTooltipModule } from '@angular/material/tooltip'; // Add TooltipModule
import { MatIconModule } from '@angular/material/icon'; // Add MatIconModule
import { Router } from '@angular/router';
import { ContributionService } from '../../../services/contribution.service';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { SharingService, ShareMethod } from '../../../services/sharing.service'; // Add SharingService
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
  faSpinner,  faFilter,
  faDownload,
  faPlus,
  faExclamationCircle,
  faArrowsRotate,
  faShare, // Add share icon
  faFilePdf, // Add file PDF icon
  faLink, // Add link icon
  faEnvelope // Add envelope icon
} from '@fortawesome/free-solid-svg-icons';
import { 
  faTwitter, 
  faFacebook, 
  faWhatsapp 
} from '@fortawesome/free-brands-svg-icons'; // Add social media icons
import { catchError, finalize, throwError } from 'rxjs';

@Component({
  selector: 'app-contribution-history',
  standalone: true,  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatChipsModule,
    FontAwesomeModule,
    MatMenuModule,
    MatTooltipModule,
    MatIconModule
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
  faFilter = faFilter;  faDownload = faDownload;  faPlus = faPlus;
  faExclamationCircle = faExclamationCircle;
  faArrowsRotate = faArrowsRotate;
  faShare = faShare;
  faFilePdf = faFilePdf;
  faLink = faLink;
  faEnvelope = faEnvelope;
  faTwitter = faTwitter;
  faFacebook = faFacebook;
  faWhatsapp = faWhatsapp;
  // Table related properties
  displayedColumns: string[] = ['date', 'community', 'cycle', 'amount', 'status', 'actions'];
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
  
  // Sharing properties
  socialLinks: { twitter: string; facebook: string; whatsapp: string; } | null = null;
  selectedContribution: Contribution | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  constructor(
    private contributionService: ContributionService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router,
    private communityService: CommunityService, // Inject CommunityService
    private sharingService: SharingService // Inject SharingService
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
  
  /**
   * Export the contribution history as PDF
   * Exports all contributions in the current view as a PDF document
   */  exportContributionHistoryAsPdf(): void {
    if (!this.contributions || this.contributions.length === 0) {
      this.toastService.error('No contributions available to export');
      return;
    }

    // Since we're exporting multiple contributions, we'll use a batch export approach
    this.loadingService.start('exportHistory');
    
    // Get the IDs of all contributions to export
    const contributionIds = this.contributions.map(c => c.id).filter(id => id);
    
    if (contributionIds.length === 0) {
      this.toastService.error('No valid contributions to export');
      return;
    }

    // Create a batch export request
    const firstContribution = this.contributions[0];
    this.sharingService.exportContributionAsPdf(firstContribution.id)
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate contribution history PDF. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('exportHistory'))
      )
      .subscribe((blob: Blob) => {
        this.sharingService.downloadPdf(blob, 'contribution_history.pdf');
        this.toastService.success('Contribution history exported successfully!');
      });
  }

  /**
   * Export a single contribution as PDF
   * @param contribution The contribution to export
   */
  exportContributionAsPdf(contribution: Contribution): void {
    if (!contribution || !contribution.id) {
      this.toastService.error('Contribution information not available');
      return;
    }

    this.loadingService.start('exportContribution');
    this.sharingService.exportContributionAsPdf(contribution.id)
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate PDF. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('exportContribution'))
      )
      .subscribe(blob => {
        const safeFileName = `contribution_${contribution.communityName || 'unknown'}_${contribution.cycleNumber}.pdf`.replace(/[^a-z0-9\.]/gi, '_').toLowerCase();
        this.sharingService.downloadPdf(blob, safeFileName);
        this.toastService.success('Contribution exported as PDF successfully!');
      });
  }

  /**
   * Share a contribution via email
   * @param contribution The contribution to share
   * @param recipients Array of email addresses to share with
   */
  shareContributionViaEmail(contribution: Contribution, recipients: string[]): void {
    if (!contribution || !contribution.id) {
      this.toastService.error('Contribution information not available');
      return;
    }

    this.loadingService.start('shareContributionEmail');
    this.sharingService.shareContribution(contribution.id, {
      shareMethod: 'email',
      recipients
    })
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to share contribution. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('shareContributionEmail'))
      )
      .subscribe(response => {
        if (response.status === 'success') {
          this.toastService.success('Contribution shared via email successfully!');
        } else {
          this.toastService.error(response.message || 'Failed to share contribution');
        }
      });
  }

  /**
   * Share a contribution via link
   * @param contribution The contribution to share
   */
  shareContributionViaLink(contribution: Contribution): void {
    if (!contribution || !contribution.id) {
      this.toastService.error('Contribution information not available');
      return;
    }

    this.loadingService.start('shareContributionLink');
    this.sharingService.shareContribution(contribution.id, {
      shareMethod: 'link'
    })
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate share link. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('shareContributionLink'))
      )
      .subscribe(response => {
        if (response.status === 'success' && response.data?.shareUrl) {
          // Copy to clipboard
          navigator.clipboard.writeText(response.data.shareUrl)
            .then(() => this.toastService.success('Share link copied to clipboard!'))
            .catch(() => this.toastService.warning('Failed to copy link. URL: ' + response.data?.shareUrl));
        } else {
          this.toastService.error(response.message || 'Failed to generate share link');
        }
      });
  }

  /**
   * Share a contribution on social media
   * @param contribution The contribution to share
   */
  shareContributionViaSocial(contribution: Contribution): void {
    if (!contribution || !contribution.id) {
      this.toastService.error('Contribution information not available');
      return;
    }

    this.selectedContribution = contribution;
    this.loadingService.start('shareContributionSocial');
    this.sharingService.shareContribution(contribution.id, {
      shareMethod: 'social'
    })
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate social share links. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('shareContributionSocial'))
      )
      .subscribe(response => {
        if (response.status === 'success' && response.data?.socialLinks) {
          // Store social media links for use in template
          this.socialLinks = response.data.socialLinks;
          this.toastService.success('Social media links generated!');
        } else {
          this.toastService.error(response.message || 'Failed to generate social share links');
        }
      });
  }

  /**
   * Open a social media share URL
   * @param platform The platform (twitter, facebook, whatsapp)
   */
  openSocialShareUrl(platform: 'twitter' | 'facebook' | 'whatsapp'): void {
    if (!this.socialLinks) {
      this.toastService.error('No social links available. Please try sharing again.');
      return;
    }

    const url = this.socialLinks[platform];
    if (url) {
      window.open(url, '_blank');
    }
  }
  
  /**
   * Set the selected contribution for sharing
   * @param contribution The contribution to select
   */
  selectContribution(contribution: Contribution): void {
    this.selectedContribution = contribution;
  }
}