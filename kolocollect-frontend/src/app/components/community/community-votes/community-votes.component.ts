import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faVoteYea as faBallotCheck, faCheckCircle, faPlus, faMinus, faSpinner, 
} from '@fortawesome/free-solid-svg-icons';
import { Subject, catchError, finalize, takeUntil, throwError } from 'rxjs';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { CustomButtonComponent } from '../../../shared/components/custom-button/custom-button.component';

@Component({
  selector: 'app-community-votes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    FontAwesomeModule,
    CustomButtonComponent
  ],
  templateUrl: './community-votes.component.html',
  styleUrl: './community-votes.component.scss'
})
export class CommunityVotesComponent implements OnInit, OnDestroy {  @Input() communityId: string = '';
  @Input() isAdmin: boolean = false;
  @Input() isMember: boolean = false;
  @Input() communityData: any = null; // Add community data input

  // Icons
  faBallotCheck = faBallotCheck;
  faCheckCircle = faCheckCircle;
  faPlus = faPlus;
  faMinus = faMinus;
  faSpinner = faSpinner;

  // Vote data
  votes: any[] = [];
  loadingVotes: boolean = false;
  currentUserId: string | undefined;
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
      description: 'Set the minimum contribution amount (smart options based on current value)', 
      options: [] }, // Will be populated dynamically
    { value: 'maxMembers', label: 'Max Members',
      description: 'Set the maximum number of members allowed in the community (smart options based on current value)', 
      options: [] }, // Will be populated dynamically
  ];
  
  newVote = {
    topic: '',
    options: ['', ''] // Start with two blank options
  };
  
  private destroy$ = new Subject<void>();

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}
  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.id;
    
    if (this.communityId) {
      this.loadVotes();
      // Load community data if not provided
      if (!this.communityData) {
        this.loadCommunityData();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
   * Load community data to get current settings for smart options
   */
  loadCommunityData(): void {
    this.communityService.getCommunityById(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading community data:', error);
          // Don't show error to user as it's not critical for voting functionality
          return throwError(() => error);
        })
      )
      .subscribe(response => {
        this.communityData = response.community || response;
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
    }    // Get the selected topic's predefined options if using a predefined topic
    const selectedTopic = this.voteTopics.find(topic => topic.value === this.newVote.topic);
    
    let cleanedOptions: string[];
    
    // If using a predefined topic, use its options (or smart options for special topics)
    if (selectedTopic) {
      if (this.newVote.topic === 'maxMembers' || this.newVote.topic === 'minContribution') {
        cleanedOptions = this.getSmartOptionsForTopic(this.newVote.topic);
      } else {
        cleanedOptions = selectedTopic.options;
      }
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
    }
    
    // Get the display name for the toast message
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
      )
      .subscribe(response => {
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
   * Get smart options for maxMembers based on current value
   */
  getSmartMaxMembersOptions(): string[] {
    if (!this.communityData?.settings?.maxMembers) {
      return ['10', '15', '20', '25', '30', '35', '50', '100']; // Default options
    }
    
    const currentMax = this.communityData.settings.maxMembers;
    return [
      (currentMax + 5).toString(),
      (currentMax + 10).toString(), 
      (currentMax + 15).toString()
    ];
  }

  /**
   * Get smart options for minContribution based on current value
   */
  getSmartMinContributionOptions(): string[] {
    if (!this.communityData?.settings?.minContribution) {
      return ['20', '30', '50', '100']; // Default options
    }
    
    const currentMin = this.communityData.settings.minContribution;
    
    // Generate smart options: current + 10, current + 20, current - 10 (if > 10), current + 30
    const options = [];
    
    if (currentMin > 10) {
      options.push((currentMin - 10).toString());
    }
    options.push((currentMin + 10).toString());
    options.push((currentMin + 20).toString());
    options.push((currentMin + 30).toString());
    
    return options;
  }

  /**
   * Get smart options for the specified topic
   */
  getSmartOptionsForTopic(topicValue: string): string[] {
    switch (topicValue) {
      case 'maxMembers':
        return this.getSmartMaxMembersOptions();
      case 'minContribution':
        return this.getSmartMinContributionOptions();
      default:
        // For other topics, use the predefined options
        const topic = this.voteTopics.find(t => t.value === topicValue);
        return topic ? topic.options : [];
    }
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
   * Gets the options for the currently selected vote topic
   */
  getOptionsForSelectedTopic(): string[] {
    if (this.newVote.topic === 'maxMembers' || this.newVote.topic === 'minContribution') {
      return this.getSmartOptionsForTopic(this.newVote.topic);
    }
    
    const selectedTopic = this.voteTopics.find(topic => topic.value === this.newVote.topic);
    return selectedTopic ? selectedTopic.options : this.newVote.options;
  }

  /**
   * Get sorted votes (active votes first, then completed votes)
   */
  getSortedVotes(): any[] {
    if (!this.votes || this.votes.length === 0) return [];
    
    return [...this.votes].sort((a, b) => {
      // Active votes come first
      if (!a.resolved && b.resolved) return -1;
      if (a.resolved && !b.resolved) return 1;
      
      // Within the same status, sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  /**
   * Get the number of votes for a specific option
   */  
  getVoteCount(vote: any, option: string): number {
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
   * Check if the selected topic is a predefined one
   */
  isPredefinedTopic(topicValue: string): boolean {
    return this.voteTopics.some(topic => topic.value === topicValue);
  }

  /**
   * Format a date for display
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }
}
