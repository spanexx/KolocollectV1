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
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, faUsers, faCalendarDays, faDollarSign, faPiggyBank, 
  faRightToBracket, faRightFromBracket, faPlay, faCircleExclamation,
  faArrowRight, faMoneyBillTransfer, faCircleInfo, faCheckCircle,
  faTimesCircle, faHourglassHalf, faFireAlt, faSpinner, faChartPie,
  faArrowsRotate, faHistory, faVoteYea as faBallotCheck, faPlus, faMinus
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
import { ContributionHistoryHierarchicalComponent } from '../../contribution/contribution-history-hierarchical/contribution-history-hierarchical.component';
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
    CustomButtonComponent,
    ContributionHistoryHierarchicalComponent,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule
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
  faChartPie = faChartPie;  faArrowsRotate = faArrowsRotate;  faCheckCircle = faCheckCircle;  faTimesCircle = faTimesCircle;
  faHistory = faHistory;
  faBallotCheck = faBallotCheck;
  faPlus = faPlus;
  faMinus = faMinus;
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
  
  // Predefined vote topics
  voteTopics = [
    { value: 'positioningMode', label: 'Positioning Mode', 
      description: 'Choose how member positions are determined in the community',
      options: ['Random', 'Fixed'] },
    { value: 'lockPayout', label: 'Lock Payout', 
      description: 'Decide if payouts should be locked or unlocked', 
      options: ['true', 'false'] },
    { value: 'paymentPlan', label: 'Payment Plan', 
      description: 'Set the default payment plan type for members', 
      options: ['Incremental', 'Full'] },
    { value: 'backupFundPercentage', label: 'Backup Fund Percentage', 
      description: 'Change the percentage of contributions that go to backup fund', 
      options: ['5', '10', '15', '20', '25'] },
    { value: 'minContribution', label: 'Minimum Contribution', 
      description: 'Set the minimum contribution amount', 
      options: ['20', '30', '50', '100'] },
  ];
  
  newVote = {
    topic: '',
    options: ['', ''] // Start with two blank options
  };
  
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
  ) { }  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.currentUserId = this.currentUser?.id;
    
    // Always start with the overview tab
    this.activeTab = 'overview';
    
    this.route.params.subscribe(params => {
      this.communityId = params['id'];
      if (this.communityId) {
        this.loadCommunityDetails();
        this.loadVotes();
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
          this.isAdmin = this.community.admin === this.currentUserId;
        }

        // Load active midcycle details
        this.loadActiveMidcycleDetails();
        
        // Load votes for the community
        this.loadVotes();
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
          // Don't show an error toast as this might confuse users
          // Just log the error and continue
          return throwError(() => error);
        })
      )      .subscribe({
        next: (response) => {
          console.log('Midcycle details response:', response.data);
          if (response && response.data) {
            this.payDate = response.data.payoutDate;
          } else {
            console.warn('Midcycle details response has no data');
            return;
          }
        
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
        },
        error: (error) => {
          console.error('Error processing midcycle data:', error);
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
    // If not a member and trying to access a restricted tab, redirect to overview
    if (!this.isMember && tab !== 'overview') {
      this.toastService.info('You must be a community member to view this section');
      this.activeTab = 'overview';
      return;
    }
    
    this.activeTab = tab;
    
    // If switching to contribution history tab, load the debug data
    if (tab === 'contributionHistory' && !this.contributionHistoryDebug) {
      this.communityService.getCommunityContributionHistory(this.communityId)
        .pipe(
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (response) => {
            this.contributionHistoryDebug = response.data;
            console.log('Debug contribution history data:', this.contributionHistoryDebug);
          },
          error: (error) => {
            console.error('Error loading contribution history data for debug:', error);
          }
        });
    }
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
  /**
   * Creates a new vote in the community
   */
  createNewVote(): void {
    if (!this.isAdmin) {
      this.toastService.error('Only administrators can create votes');
      return;
    }

    if (!this.newVote.topic) {
      this.toastService.error('Please select a vote topic');
      return;
    }

    // Get the selected topic's predefined options if using a predefined topic
    const selectedTopic = this.voteTopics.find(topic => topic.value === this.newVote.topic);
    
    let cleanedOptions: string[];
    
    // If using a predefined topic, use its options
    if (selectedTopic) {
      cleanedOptions = selectedTopic.options;
    } else {
      // If custom topic, validate user-entered options
      if (this.newVote.options.some(option => !option.trim())) {
        this.toastService.error('Please provide all options without empty values');
        return;
      }
      
      // Filter out empty options
      cleanedOptions = this.newVote.options.filter(option => option.trim());
      
      if (cleanedOptions.length < 2) {
        this.toastService.error('Please provide at least 2 voting options');
        return;
      }
    }    // Get the display name for the toast message
    const topicDisplayName = selectedTopic?.label || this.newVote.topic;
    
    const voteData = {
      topic: this.newVote.topic, // Use the backend-compatible topic value
      options: cleanedOptions
    };

    this.communityService.createVote(this.communityId, voteData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.toastService.error(error?.error?.message || 'Failed to create vote');
          return throwError(() => error);
        })
      )      .subscribe(response => {
        this.toastService.success(`Vote '${topicDisplayName}' created successfully`);
        this.newVote = { topic: '', options: ['', ''] }; // Reset the form
        this.loadVotes(); // Reload votes
      });
  }
  /**
   * Adds a new option field to the vote form
   * Only used for custom topics as predefined topics have fixed options
   */
  addVoteOption(): void {
    // Check if a predefined topic is selected
    const isPredefinedTopic = this.voteTopics.some(topic => topic.value === this.newVote.topic);
    
    if (isPredefinedTopic) {
      this.toastService.info('Predefined topics have fixed options');
      return;
    }
    
    this.newVote.options.push('');
  }

  /**
   * Removes an option field from the vote form
   * Only used for custom topics as predefined topics have fixed options
   */
  removeVoteOption(index: number): void {
    // Check if a predefined topic is selected
    const isPredefinedTopic = this.voteTopics.some(topic => topic.value === this.newVote.topic);
    
    if (isPredefinedTopic) {
      this.toastService.info('Predefined topics have fixed options');
      return;
    }
    
    if (this.newVote.options.length > 2) {
      this.newVote.options.splice(index, 1);
    } else {
      this.toastService.error('A minimum of 2 options is required');
    }
  }
  
  /**
   * Gets the options for the currently selected vote topic
   */
  getOptionsForSelectedTopic(): string[] {
    const selectedTopic = this.voteTopics.find(topic => topic.value === this.newVote.topic);
    return selectedTopic ? selectedTopic.options : this.newVote.options;
  }
  
  /**
   * Handles changes when the vote topic is selected
   * Updates options based on the selected topic
   */
  onVoteTopicChange(): void {
    const selectedTopic = this.voteTopics.find(topic => topic.value === this.newVote.topic);
    if (selectedTopic) {
      // For predefined topics, we don't need custom options
      this.newVote.options = ['', ''];  // Keep the structure but don't use these values
    }
  }

  /**
   * Get the number of votes for a specific option
   */  getVoteCount(vote: any, option: string): number {
    if (!vote.votes || !Array.isArray(vote.votes)) return 0;
    return vote.votes.filter((v: { choice: string }) => v.choice === option).length;
  }

  /**
   * Get the percentage of votes for a specific option
   */
  getVotePercentage(vote: any, option: string): number {
    if (!vote.votes || !Array.isArray(vote.votes) || vote.votes.length === 0) return 0;
    const count = this.getVoteCount(vote, option);
    return Math.round((count / vote.votes.length) * 100);
  }

  /**
   * Check if the current user has already voted
   */
  hasUserVoted(vote: any): boolean {
    if (!this.currentUserId || !vote.votes || !Array.isArray(vote.votes)) return false;
    return vote.votes.some((v: { userId: string }) => v.userId === this.currentUserId);
  }

  /**
   * Get the current user's vote choice
   */
  getUserVoteChoice(vote: any): string | null {
    if (!this.currentUserId || !vote.votes || !Array.isArray(vote.votes)) return null;
    const userVote = vote.votes.find((v: { userId: string; choice: string }) => v.userId === this.currentUserId);
    return userVote ? userVote.choice : null;
  }

  /**
   * Cast a vote for an option
   */
  castVote(voteId: string, choice: string): void {
    if (!this.currentUserId) {
      this.toastService.error('Please log in to cast a vote');
      return;
    }

    if (!this.isMember) {
      this.toastService.error('Only community members can vote');
      return;
    }

    const voteData = {
      userId: this.currentUserId,
      choice
    };

    this.communityService.castVote(this.communityId, voteId, voteData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.toastService.error(error?.error?.message || 'Failed to cast vote');
          return throwError(() => error);
        })
      )
      .subscribe(response => {
        this.toastService.success('Vote cast successfully');
        this.loadVotes(); // Reload votes to reflect changes
      });
  }

  /**
   * Get the display label for a vote topic
   */
  getTopicDisplayLabel(topicValue: string): string {
    const topic = this.voteTopics.find(t => t.value === topicValue);
    return topic ? topic.label : topicValue;
  }

  /**
   * Get the description of a vote topic by value
   */
  getVoteTopicDescription(topicValue: string): string {
    const topic = this.voteTopics.find(t => t.value === topicValue);
    return topic ? topic.description : '';
  }

  /**
   * Check if the selected topic is predefined
   */
  isPredefinedTopic(topicValue: string): boolean {
    return this.voteTopics.some(t => t.value === topicValue);
  }
}