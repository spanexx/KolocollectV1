import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, faUsers, faCalendarDays, faCheckCircle, 
  faTimesCircle, faHourglassHalf, faRightFromBracket
} from '@fortawesome/free-solid-svg-icons';
import { Subject, catchError, finalize, takeUntil, throwError } from 'rxjs';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { MediaService } from '../../../services/media.service';
import { UserService } from '../../../services/user.service';
import { environment } from '../../../../environments/environment';
import { CustomButtonComponent } from '../../../shared/components/custom-button/custom-button.component';
import { UserProfileDialogComponent } from '../../profile/user-profile-dialog/user-profile-dialog.component';
import { formatDate } from '@angular/common';

@Component({
  selector: 'app-community-members',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    FontAwesomeModule,
    CustomButtonComponent
  ],  templateUrl: './community-members.component.html',
  styleUrls: [
    './members-base.scss',
    './members-list.scss',
    './members-feedback.scss'
  ]
})
export class CommunityMembersComponent implements OnInit, OnDestroy {
  @Input() communityId: string = '';
  @Input() isAdmin: boolean = false;
  @Input() isMember: boolean = false;

  // Icons
  faUser = faUser;
  faUsers = faUsers;
  faCalendarDays = faCalendarDays;
  faCheckCircle = faCheckCircle;
  faTimesCircle = faTimesCircle;
  faHourglassHalf = faHourglassHalf;
  faRightFromBracket = faRightFromBracket;

  // Data
  community: any = {};
  members: any[] = [];
  loading: boolean = false;
  currentUserId: string | undefined;
  private destroy$ = new Subject<void>();
  
  // Profile picture data
  memberProfilePictures: Map<string, string> = new Map<string, string>();
  profilePictureLoading: Map<string, boolean> = new Map<string, boolean>();

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private dialog: MatDialog,
    private mediaService: MediaService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.id;
    this.loadCommunityData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCommunityData(): void {
    if (!this.communityId) return;
    
    this.loading = true;
    this.communityService.getCommunityById(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.toastService.error('Failed to load community data');
          return throwError(() => error);
        }),
        finalize(() => {
          this.loading = false;
        })
      )      .subscribe(data => {
        console.log('Community data loaded:', data);
        this.community = data.community;
        if (this.community && this.community.members) {
          this.members = this.community.members;
          
          // Load profile pictures for all members
          this.members.forEach(member => {
            this.loadMemberProfilePicture(member);
          });
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
          window.location.reload(); // Reload to update UI
        });
    }
  }  navigateToMemberDetail(userId: string): void {
    this.dialog.open(UserProfileDialogComponent, {
      width: window.innerWidth <= 480 ? '100vw' : '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'responsive-dialog',
      data: { userId }
    });
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
      case 'active': return this.faCheckCircle;
      case 'inactive': return this.faTimesCircle;
      case 'waiting': return this.faHourglassHalf;
      default: return this.faUser;
    }  }

  formatDate(date: Date | string | undefined): string {
    if (!date) {
      return 'N/A';
    }
    
    try {
      // Use a safer approach that handles both Date objects and strings
      const dateValue = typeof date === 'string' ? new Date(date) : date;
      return formatDate(dateValue, 'MMM d, yyyy', 'en-US');
    } catch (error) {
      return 'Invalid date';
    }
  }
  /**
   * Load profile picture for a member
   * @param member The member object
   */
  loadMemberProfilePicture(member: any): void {
    if (!member || !member.userId) {
      return;
    }
    
    // Get the actual userId (could be an object or string)
    const userId = typeof member.userId === 'object' ? member.userId._id : member.userId;
    
    // Skip if already loading or loaded
    if (this.profilePictureLoading.get(userId) || this.memberProfilePictures.has(userId)) {
      return;
    }
    
    this.profilePictureLoading.set(userId, true);
    
    // Fetch the user profile to get profile picture details
    this.userService.getUserProfile(userId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error(`Failed to load user profile for ${userId}:`, error);
        this.profilePictureLoading.set(userId, false);
        return throwError(() => error);
      })
    ).subscribe(response => {
      if (response && response.user && response.user.profilePicture && response.user.profilePicture.fileId) {
        this.loadProfilePictureFromFileId(userId, response.user.profilePicture.fileId);
      } else {
        this.profilePictureLoading.set(userId, false);
      }
    });
  }
  
  /**
   * Load profile picture from file ID
   * @param userId The user ID
   * @param fileId The profile picture file ID
   */
  loadProfilePictureFromFileId(userId: string, fileId: string): void {
    this.mediaService.getFileUrl(fileId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error(`Failed to load profile picture URL for user ${userId}:`, error);
        this.profilePictureLoading.set(userId, false);
        return throwError(() => error);
      }),
      finalize(() => {
        this.profilePictureLoading.set(userId, false);
      })
    ).subscribe(response => {
      if (response && response.url) {
        let profilePictureUrl;
        
        // First try to use absoluteUrl if provided
        if (response.absoluteUrl) {
          profilePictureUrl = response.absoluteUrl;
        }
        // Check if it's a relative URL and convert to absolute if needed
        else if (response.url.startsWith('/')) {
          // It's a relative URL, prepend the base API URL from environment
          const baseUrl = environment.apiUrl.replace('/api', ''); 
          profilePictureUrl = `${baseUrl}${response.url}`;
        } else {
          // It's already an absolute URL
          profilePictureUrl = response.url;
        }
        
        this.memberProfilePictures.set(userId, profilePictureUrl);
      }
    });
  }
  
  /**
   * Get the profile picture URL for a member
   * @param member The member object
   * @returns The profile picture URL or null if not found
   */
  getMemberProfilePicture(member: any): string | null {
    if (!member || !member.userId) {
      return null;
    }
    
    return this.memberProfilePictures.get(member.userId) || null;
  }
  
  /**
   * Handle image loading error
   * @param event The error event
   * @param userId The user ID
   */
  handleImageError(event: any, userId: string): void {
    console.error('Member profile image failed to load:', event);
    // Remove from map to avoid showing broken images
    this.memberProfilePictures.delete(userId);
  }
  
  /**
   * Get user initials from name for avatar placeholder
   * @param name The user's full name
   * @returns The user's initials (2 characters)
   */
  getUserInitials(name: string): string {
    if (!name) return '';
    
    const nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    
    return nameParts[0].substring(0, 2).toUpperCase();
  }
}
