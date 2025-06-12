import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatMenuModule } from '@angular/material/menu';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, faUsers, faCalendarDays, faDollarSign, faPiggyBank, 
  faRightToBracket, faRightFromBracket, faPlay, faCircleExclamation,
  faArrowRight, faMoneyBillTransfer, faCircleInfo, faCheckCircle,
  faTimesCircle, faHourglassHalf, faFireAlt, faSpinner, faChartPie,
  faArrowsRotate, faHistory, faVoteYea as faBallotCheck, faPlus, faMinus,
  faShare, faDownload, faFilePdf, faEnvelope, faLink
} from '@fortawesome/free-solid-svg-icons';
import { 
  faTwitter, faFacebook, faWhatsapp 
} from '@fortawesome/free-brands-svg-icons';
import { CommunityService } from '../../../services/community.service';
import { MidcycleService } from '../../../services/midcycle.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { SharingService, ShareMethod } from '../../../services/sharing.service';
import { Community, Member, MidCycle, Cycle, CommunitySettings, MidCycleDetails } from '../../../models/community.model';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { Subject, throwError } from 'rxjs';
import { formatDate } from '@angular/common';
import { JoinCommunityDialogComponent } from '../join-community-dialog/join-community-dialog.component';
import { ContributionHistoryHierarchicalComponent } from '../../contribution/contribution-history-hierarchical/contribution-history-hierarchical.component';
import { UserProfileDialogComponent } from '../../profile/user-profile-dialog/user-profile-dialog.component';
import { User } from '../../../models/user.model';
import { CustomButtonComponent } from '../../../shared/components/custom-button/custom-button.component';

@Component({
  selector: 'app-community-sharing',
  standalone: true,
  imports: [
   CommonModule,
       RouterModule,
       MatCardModule,
       MatButtonModule,
       MatTabsModule,
       MatListModule,
       MatIconModule,
       MatProgressSpinnerModule,
       MatDividerModule,
       MatChipsModule,
       MatBadgeModule,
       MatDialogModule,
       MatMenuModule,
       FontAwesomeModule,
      //  CustomButtonComponent,
      //  ContributionHistoryHierarchicalComponent,
       FormsModule,
       ReactiveFormsModule,
       MatFormFieldModule,
       MatInputModule,
       MatSelectModule,
       MatRadioModule
  ],
  templateUrl: './community-sharing.component.html',
  styleUrl: './community-sharing.component.scss'
})
export class CommunitySharingComponent {
  faUser = faUser;
  faUsers = faUsers;
  faCalendarDays = faCalendarDays;
  faDollarSign = faDollarSign;
  faPiggyBank = faPiggyBank;
  faRightToBracket = faRightToBracket;
  faRightFromBracket = faRightFromBracket;
  faPlay = faPlay;
  faCircleExclamation = faCircleExclamation;
  faArrowRight = faArrowRight;
  faMoneyBillTransfer = faMoneyBillTransfer;
  faCircleInfo = faCircleInfo;
  faSpinner = faSpinner;
  faChartPie = faChartPie;
  faArrowsRotate = faArrowsRotate;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faHistory = faHistory;
  faBallotCheck = faBallotCheck;
  faPlus = faPlus;
  faMinus = faMinus;
  // Sharing icons
  faShare = faShare;
  faDownload = faDownload;
  faFilePdf = faFilePdf;
  faEnvelope = faEnvelope;
  faLink = faLink;
  faTwitter = faTwitter;
  faFacebook = faFacebook;
  faWhatsapp = faWhatsapp;

  communityId: string = '';
  community: Community | null = null;
  communitySettings: CommunitySettings | null = null;
  error: string = '';
  loading: boolean = false;
  currentUser: User | null = null;
  currentUserId: string | undefined;
  isMember: boolean = false;
  isAdmin: boolean = false;
  currentDate: Date = new Date();
  activeTab: string = 'overview';
  payDate!: Date;
  midCycleDetails: MidCycleDetails | null = null;
  loadingMidCycleDetails: boolean = false;
  contributionHistoryDebug: any = null;
  votes: any[] = [];
  loadingVotes: boolean = false;
  
  // Social media sharing links
  socialLinks: { twitter: string; facebook: string; whatsapp: string; } | null = null;
  cycleSocialLinks: { twitter: string; facebook: string; whatsapp: string; } | null = null;
  midCycleSocialLinks: { twitter: string; facebook: string; whatsapp: string; } | null = null;


    // Sharing links storage
  private destroy$ = new Subject<void>();
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private midcycleService: MidcycleService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private sharingService: SharingService,
    private dialog: MatDialog
  ) { }

    /**
   * Export the community as PDF
   */
  exportCommunityAsPdf(): void {
    if (!this.community || !this.communityId) {
      this.toastService.error('Community information not available');
      return;
    }

    this.loadingService.start('exportPdf');
    this.sharingService.exportCommunityAsPdf(this.communityId)
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate PDF. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('exportPdf'))
      )
      .subscribe(blob => {
        const communityName = this.community?.name || 'community';
        const safeFileName = communityName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        this.sharingService.downloadPdf(blob, `${safeFileName}.pdf`);
        this.toastService.success('PDF exported successfully!');
      });
  }




  /**
   * Share the community via link
   * @returns The share link
   */
  shareCommunityViaLink(): void {
    if (!this.communityId) {
      this.toastService.error('Community information not available');
      return;
    }

    this.loadingService.start('shareCommunityLink');
    this.sharingService.shareCommunity(this.communityId, {
      shareMethod: 'link'
    })
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate share link. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('shareCommunityLink'))
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
   * Open a social media share URL
   * @param platform The platform (twitter, facebook, whatsapp)
   */
  openSocialShareUrl(platform: 'twitter' | 'facebook' | 'whatsapp'): void {
    if (!this.socialLinks) {
      this.shareCommunityViaSocial();
      return;
    }

    const url = this.socialLinks[platform];
    if (url) {
      window.open(url, '_blank');
    }
  }

    /**
   * Open a social media share URL for cycle
   * @param platform The platform (twitter, facebook, whatsapp)
   */
  openCycleSocialShareUrl(platform: 'twitter' | 'facebook' | 'whatsapp'): void {
    if (!this.cycleSocialLinks) {
      // If we don't have links yet, need to generate them first
      // For simplicity, this would require additional UI to select which cycle
      this.toastService.info('Please use the share button on the specific cycle first');
      return;
    }

    const url = this.cycleSocialLinks[platform];
    if (url) {
      window.open(url, '_blank');
    }
  }


    
  loadCommunityDetails(): void {
    this.loading = true;
    this.loadingService.start('load-community-details');

    this.communityService.getCommunityById(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.error = error?.error?.message || 'Failed to load community details';
          this.toastService.error(this.error);
          return throwError(() => error);
        }),
        finalize(() => {
          this.loading = false;
          this.loadingService.stop('load-community-details');
        })
      )
      .subscribe(response => {
        this.community = response.community;
        this.communitySettings = response.community.settings;
        
        // After loading community, fetch mid-cycle details
        this.loadMidCycleDetails();
        // Check if current user is a member
        if (this.currentUserId && this.community?.members) {          const member = this.community.members.find(m => 
            m.userId === this.currentUserId || m.userId === this.currentUser?.id
          );
          this.isMember = !!member;
          console.log('Current user is a member:', this.isMember);
          
          // Ensure non-members are redirected to overview tab
          if (!this.isMember && this.activeTab !== 'overview') {
            this.activeTab = 'overview';
          }
        }
          // Check if current user is the admin
        if (this.currentUserId && this.community?.admin) {
          this.isAdmin = this.community.admin.id === this.currentUserId;
        }

        // Load active midcycle details
        this.loadActiveMidcycleDetails();
        
        // Load votes for the community
        this.loadVotes();
      });
  }


   /**
   * Loads detailed information about the current mid-cycle
   */
  loadMidCycleDetails(): void {
    if (!this.communityId) return;
    
    this.loadingMidCycleDetails = true;
    this.communityService.getCurrentMidCycleDetails(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Failed to load mid-cycle details:', error);
          // Don't show error toast as this is supplementary data
          return throwError(() => error);
        }),
        finalize(() => {
          this.loadingMidCycleDetails = false;
        })
      )
      .subscribe(response => {
        this.midCycleDetails = response;
      });
  }

    // Load active midcycle details
  loadActiveMidcycleDetails(): void {
    const currentCycle = this.getCurrentCycle();
    if (!currentCycle || !currentCycle.midCycles || currentCycle.midCycles.length === 0) {
      console.log('No current cycle or midcycles found');
      return;
    }
    }

      /**
   * Load votes for the current community
   */
  loadVotes(): void {
    this.loadingVotes = true;
    this.communityService.getVotes(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.toastService.error(error?.error?.message || 'Failed to load community votes');
          return throwError(() => error);
        }),
        finalize(() => {
          this.loadingVotes = false;
        })
      )
      .subscribe(response => {
        this.votes = response.votes || [];
      });
  }

    getCurrentCycle(): Cycle | null {
    if (!this.community?.cycles || this.community.cycles.length === 0) {
      return null;
    }
    
    // Find the most recent active cycle
    return this.community.cycles
      .filter(cycle => !cycle.isComplete)
      .sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      )[0] || this.community.cycles[this.community.cycles.length - 1];
  }


    /**
   * Share the community on social media
   * @param platform The social media platform to share on
   */
  shareCommunityViaSocial(): void {
    if (!this.communityId) {
      this.toastService.error('Community information not available');
      return;
    }

    this.loadingService.start('shareCommunitySocial');
    this.sharingService.shareCommunity(this.communityId, {
      shareMethod: 'social'
    })
      .pipe(
        catchError((error) => {
          this.toastService.error('Failed to generate social share links. Please try again.');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('shareCommunitySocial'))
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

  

}
