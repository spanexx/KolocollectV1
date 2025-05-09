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
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, faUsers, faCalendarDays, faDollarSign, faPiggyBank, 
  faRightToBracket, faRightFromBracket, faPlay, faCircleExclamation,
  faArrowRight, faMoneyBillTransfer, faCircleInfo, faCheckCircle,
  faTimesCircle, faHourglassHalf, faFireAlt, faSpinner, faChartPie
} from '@fortawesome/free-solid-svg-icons';
import { CommunityService } from '../../../services/community.service';
import { MidcycleService } from '../../../services/midcycle.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { Community, Member, MidCycle, Cycle, CommunitySettings, MidCycleDetails } from '../../../models/community.model';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { Subject, throwError } from 'rxjs';
import { formatDate } from '@angular/common';
import { JoinCommunityDialogComponent } from '../join-community-dialog/join-community-dialog.component';
import { UserProfileDialogComponent } from '../../profile/user-profile-dialog/user-profile-dialog.component';
import { User } from '../../../models/user.model';
import { CustomButtonComponent } from '../../../shared/components/custom-button/custom-button.component';

@Component({
  selector: 'app-community-detail',
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
    FontAwesomeModule,
    CustomButtonComponent
  ],
  templateUrl: './community-detail.component.html',
  styleUrls: ['./community-detail.component.scss']
})
export class CommunityDetailComponent implements OnInit, OnDestroy {  // Font Awesome icons
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
  faMoneyBillTransfer = faMoneyBillTransfer;  faCircleInfo = faCircleInfo;
  faSpinner = faSpinner;
  faChartPie = faChartPie;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
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
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private communityService: CommunityService,
    private midcycleService: MidcycleService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.currentUserId = this.currentUser?.id;
    
    this.route.params.subscribe(params => {
      this.communityId = params['id'];
      if (this.communityId) {
        this.loadCommunityDetails();
      }
    });

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
        if (this.currentUserId && this.community?.members) {
          const member = this.community.members.find(m => 
            m.userId === this.currentUserId || m.userId === this.currentUser?.id
          );
          this.isMember = !!member;
        }
        
        // Check if current user is the admin
        if (this.currentUserId && this.community?.admin) {
          this.isAdmin = this.community.admin === this.currentUserId;
        }

        // Load active midcycle details
        this.loadActiveMidcycleDetails();
      });
  }



  // Load active midcycle details
  loadActiveMidcycleDetails(): void {
    const currentCycle = this.getCurrentCycle();
    if (!currentCycle || !currentCycle.midCycles || currentCycle.midCycles.length === 0) {
      console.log('No current cycle or midcycles found');
      return;
    }
    

    // Get all non-complete midcycles from the current cycle
    const activeMidcycles = currentCycle.midCycles.filter(mc => !mc.isComplete);
    
    if (activeMidcycles.length === 0) {
      console.log('No active midcycles found');
      return;
    }
    
    // Sort by midCycleNumber to get the latest one
    const latestMidcycle = activeMidcycles.sort((a, b) => 
      (b.midCycleNumber || 0) - (a.midCycleNumber || 0)
    )[0];
    
    // Extract the ID string from the midcycle object
    const midcycleId = typeof latestMidcycle === 'string' ? latestMidcycle : latestMidcycle.id;
    
    if (!midcycleId) {
      console.error('Failed to get a valid midcycle ID');
      return;
    }
    
    
    this.midcycleService.getMidCycleById(this.communityId, midcycleId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Failed to load midcycle details:', error);
          return throwError(() => error);
        })
      )
      .subscribe(response => {
        console.log('Midcycle details response:', response.data);

        this.payDate = response.data.payoutDate;
        
        if (response && response.data) {
          if (!this.community) {
            return;
          }
          
          // If midCycle array doesn't exist, initialize it
          if (!this.community.midCycle) {
            this.community.midCycle = [];
          }
          
          // Look for existing midcycle with the same id
          const index = this.community.midCycle.findIndex(m => m.id === midcycleId);
          
          if (index >= 0) {
            // Update existing midcycle
            this.community.midCycle[index] = response.data;
          } else {
            // Add new midcycle
            this.community.midCycle.push(response.data);
          }
          
        }
      });
  }

  joinCommunity(): void {
    if (!this.currentUserId || !this.currentUser) {
      this.toastService.info('Please log in to join this community');
      this.router.navigate(['/login'], { queryParams: { returnUrl: `/communities/${this.communityId}` } });
      return;
    }

    if (!this.community) {
      this.toastService.error('Community details not available.');
      return;
    }

    const dialogRef = this.dialog.open(JoinCommunityDialogComponent, {
      width: '500px',
      data: {
        communityId: this.communityId,
        community: this.community
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadCommunityDetails(); // Refresh community details
      }
    });
  }

  leaveCommunity(): void {
    if (!this.currentUserId) return;

    if (confirm('Are you sure you want to leave this community? This action cannot be undone.')) {
      this.loading = true;
      this.loadingService.start('leave-community');

      this.communityService.leaveCommunity(this.communityId, this.currentUserId)
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            const errorMsg = error?.error?.message || 'Failed to leave community';
            this.toastService.error(errorMsg);
            return throwError(() => error);
          }),
          finalize(() => {
            this.loading = false;
            this.loadingService.stop('leave-community');
          })
        )
        .subscribe(response => {
          this.toastService.success('Successfully left the community');
          this.isMember = false;
          this.loadCommunityDetails(); // Refresh community details
        });
    }
  }

  startNewCycle(): void {
    if (!this.isAdmin) {
      this.toastService.error('Only community admins can start a new cycle');
      return;
    }

    if (confirm('Are you sure you want to start a new cycle?')) {
      this.loading = true;
      this.loadingService.start('start-new-cycle');

      this.communityService.startNewCycle(this.communityId)
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            const errorMsg = error?.error?.message || 'Failed to start new cycle';
            this.toastService.error(errorMsg);
            return throwError(() => error);
          }),
          finalize(() => {
            this.loading = false;
            this.loadingService.stop('start-new-cycle');
          })
        )
        .subscribe(response => {
          this.toastService.success('New cycle started successfully');
          this.loadCommunityDetails(); // Refresh community details
        });
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return formatDate(date, 'MMM d, y, h:mm a', 'en-US');
  }

  getMemberStatusClass(status: string): string {
    switch(status) {
      case 'active': return 'member-status-active';
      case 'inactive': return 'member-status-inactive';
      case 'waiting': return 'member-status-waiting';
      default: return '';
    }
  }
  
  getMemberStatusIcon(status: string): any {
    switch(status) {
      case 'active': return faCheckCircle;
      case 'inactive': return faTimesCircle;
      case 'waiting': return faHourglassHalf;
      default: return faUser;
    }
  }

  navigateToMemberDetail(userId: string): void {
    this.dialog.open(UserProfileDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      data: { userId }
    });
  }

  getContributionFrequencyText(frequency: string | undefined): string {
    if (!frequency) return '';
    
    switch(frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Every 2 weeks';
      case 'monthly': return 'Monthly';
      default: return frequency;
    }
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

  getActiveMembersCount(): number {
    return this.community?.members?.filter(m => m.status === 'active').length || 0;
  }
  
  getMidcycleStatusClass(midcycle: MidCycle | null): string {
    if (!midcycle) return '';
    
    if (midcycle.isComplete) {
      return 'midcycle-complete';
    } else if (midcycle.isReady) {
      return 'midcycle-ready';
    } else {
      return 'midcycle-in-progress';
    }
  }
  
  getMidcycleProgress(midcycle: MidCycle | null): number {
    // Calculate progress based on contributors vs total members
    if (!midcycle || !midcycle.contributors || !this.community?.members) return 0;
    
    const contributorsCount = Object.keys(midcycle.contributors).length;
    const totalMembers = this.community.members.filter(m => m.status === 'active').length;
    
    if (totalMembers === 0) return 0;
    
    return Math.min(Math.round((contributorsCount / totalMembers) * 100), 100);
  }

  /**
   * Returns the current active midcycle for the community
   * (The most recent midcycle that is not complete)
   */
  getCurrentMidcycle(): MidCycle | null {
    const currentCycle = this.getCurrentCycle();

    
    if (!currentCycle || !currentCycle.midCycles || currentCycle.midCycles.length === 0) {
      return null;
    }
    
    // Find the most recent active midcycle
    return currentCycle.midCycles
      .filter(mc => !mc.isComplete)
      .sort((a, b) => 
        (b.midCycleNumber || 0) - (a.midCycleNumber || 0)
      )[0] || null;
  }

  /**
   * Returns the count of completed midcycles in the current cycle
   */
  getCompletedMidcyclesCount(): number {
    const currentCycle = this.getCurrentCycle();
    
    if (!currentCycle || !currentCycle.midCycles) {
      return 0;
    }
    
    return currentCycle.midCycles.filter(mc => mc.isComplete).length;
  }

  /**
   * Calculates the total amount distributed through midcycles in the current cycle
   */
  getTotalMidcycleDistributions(): number {
    const currentCycle = this.getCurrentCycle();
    
    if (!currentCycle || !currentCycle.midCycles) {
      return 0;
    }
    
    return currentCycle.midCycles
      .filter(mc => mc.isComplete)
      .reduce((total, mc) => total + (mc.payoutAmount || 0), 0);
  }

  /**
   * Checks if the current user has contributed to the current midcycle
   */
  isUserContributedToCurrentMidcycle(): boolean {
    if (!this.currentUserId) return false;
    
    const currentMidcycle = this.getCurrentMidcycle();
    if (!currentMidcycle || !currentMidcycle.contributors) return false;
    
    // Check if the user is in the contributors list and has at least one contribution
    const userContributions = currentMidcycle.contributors[this.currentUserId];
    return Array.isArray(userContributions) && userContributions.length > 0;
  }

  /**
   * Handles user contribution to a midcycle
   */
  contributeToMidcycle(midcycle: MidCycle | null): void {
    if (!midcycle) {
      this.toastService.error('Mid-cycle information not available');
      return;
    }

    if (!this.currentUserId || !this.isMember) {
      this.toastService.error('You must be a member to contribute');
      return;
    }

    if (midcycle.isComplete) {
      this.toastService.info('This mid-cycle is already complete');
      return;
    }

    if (!midcycle.isReady) {
      this.toastService.info('This mid-cycle is not ready for contributions yet');
      return;
    }

    if (this.isUserContributedToCurrentMidcycle()) {
      this.toastService.info('You have already contributed to this mid-cycle');
      return;
    }

    // Redirect to the contribution page for this midcycle
    this.router.navigate(['/contributions/new'], { 
      queryParams: { 
        communityId: this.communityId,
        cycleId: this.getCurrentCycle()?.id,
        midcycleId: midcycle.id 
      }
    });
  }

  /**
   * Navigate to the contribution creation page for this community
   * Used by the main CTA button in the contribution tab
   */
  navigateToContributionPage(): void {
    if (!this.currentUserId || !this.isMember) {
      this.toastService.error('You must be a member to make contributions');
      return;
    }

    const currentCycle = this.getCurrentCycle();
    const currentMidcycle = this.getCurrentMidcycle();

    if (!currentCycle) {
      this.toastService.error('No active cycle found');
      return;
    }

    // Navigate to contribution page with appropriate parameters
    this.router.navigate(['/contributions/make'], { 
      queryParams: { 
        communityId: this.communityId,
        cycleId: currentCycle.id,
        midcycleId: currentMidcycle?.id
      }
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
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
  
  /**
   * Gets formatted contribution progress percentage
   */
  getContributionProgressPercentage(): number {
    return this.midCycleDetails?.contributionProgress?.percentage || 0;
  }
  
  /**
   * Updates the mid-cycle summary numbers with the actual data from the API
   */
  getMidCycleSummary(): { total: number, completed: number, distributed: number } {
    return {
      total: this.midCycleDetails?.summary?.totalMidCycles || 0,
      completed: this.midCycleDetails?.summary?.completedMidCycles || 0,
      distributed: this.midCycleDetails?.summary?.totalDistributed || 0
    };
  }

  /**
   * Distribute payouts for the current mid-cycle
   * Only available for community admins when the mid-cycle is ready
   */  distributePayouts(): void {
    if (!this.isAdmin) {
      this.toastService.error('Only community administrators can distribute payouts');
      return;
    }

    if (!this.midCycleDetails || !this.midCycleDetails.isReady) {
      this.toastService.error('This mid-cycle is not ready for payout distribution');
      return;
    }

    if (confirm('Are you sure you want to distribute payouts for this mid-cycle?')) {
      this.loading = true;
      this.loadingService.start('distribute-payouts');
      
      this.communityService.distributePayouts(this.communityId)
        .pipe(
          takeUntil(this.destroy$),
          catchError(error => {
            const errorMsg = error?.error?.message || 'Failed to distribute payouts';
            this.toastService.error(errorMsg);
            return throwError(() => error);
          }),
          finalize(() => {
            this.loading = false;
            this.loadingService.stop('distribute-payouts');
          })
        )
        .subscribe(response => {
          this.toastService.success('Payouts distributed successfully');
          this.loadCommunityDetails(); // Refresh community details
        });
    }
  }
}