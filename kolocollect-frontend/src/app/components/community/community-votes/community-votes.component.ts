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
export class CommunityVotesComponent implements OnInit, OnDestroy {
  @Input() communityId: string = '';
  @Input() isAdmin: boolean = false;
  @Input() isMember: boolean = false;

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
      description: 'Set the minimum contribution amount', 
      options: ['20', '30', '50', '100'] },
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
