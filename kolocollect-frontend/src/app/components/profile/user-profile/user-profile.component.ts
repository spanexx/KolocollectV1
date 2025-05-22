import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, 
  faEnvelope, 
  faCalendarAlt, 
  faUserShield, 
  faUsers,
  faMoneyBillWave,
  faHistory,
  faWallet,
  faArrowTrendUp,
  faEye,
  faUserPlus,
  faUsersViewfinder,
  faMoneyBillTransfer,
  faCheckCircle,
  faStar,
  faInfoCircle,
  faCalendarDay
} from '@fortawesome/free-solid-svg-icons';

import { UserService } from '../../../services/user.service';
import { MemberService } from '../../../services/member.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';
import { MediaService } from '../../../services/media.service';
import { environment } from '../../../../environments/environment';
import { forkJoin, catchError, finalize, throwError } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
    MatChipsModule,
    RouterModule,
    FontAwesomeModule
  ]
})
export class UserProfileComponent implements OnInit {
  @Input() userId: string = '';
  @Output() buttonClick = new EventEmitter<void>();
  
  // FontAwesome icons
  faUser = faUser;
  faEnvelope = faEnvelope;
  faCalendarAlt = faCalendarAlt;
  faUserShield = faUserShield;
  faUsers = faUsers;
  faMoneyBillWave = faMoneyBillWave;
  faHistory = faHistory;
  faWallet = faWallet;
  faArrowTrendUp = faArrowTrendUp;
  faEye = faEye;  faUserPlus = faUserPlus;
  faUsersViewfinder = faUsersViewfinder;
  faMoneyBillTransfer = faMoneyBillTransfer;
  faBadgeCheck = faCheckCircle; // Using faCheckCircle instead of faBadgeCheck
  faStar = faStar;
  faInfoCircle = faInfoCircle;
  faCalendarDay = faCalendarDay;

  userProfile: any = null;
  wallet: any = null;
  nextInLineDetails: any = null;
  memberDetails: any[] = [];
  communityMemberships: any[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  profilePictureUrl: string | null = null;
  
  constructor(
    private userService: UserService,
    private memberService: MemberService,
    private mediaService: MediaService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    public router: Router
  ) {}

  ngOnInit(): void {
    // Use the input userId if provided, otherwise get from current user
    const userId = this.userId || this.authService.currentUserValue?.id;
    
    if (userId) {
      this.loadUserProfile(userId);
    } else {
      this.error = 'No user ID available. Please login to view profile.';
    }
  }

  loadUserProfile(userId: string): void {
    this.isLoading = true;
    this.error = null;
    this.loadingService.start('user-profile');

    this.userService.getUserProfile(userId).pipe(
      catchError(error => {
        this.error = error.message || 'Failed to load user profile';
        this.toastService.error('Error loading user profile');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('user-profile');
      })
    ).subscribe(response => {
      console.log('User Profile Response:', response);
      console.log('User Profile:', response.user);
      this.userProfile = response.user;
      this.wallet = response.wallet;
      this.nextInLineDetails = response.nextInLineDetails;
      
      // Load profile picture if available
      if (this.userProfile.profilePicture?.fileId) {
        this.loadProfilePicture(this.userProfile.profilePicture.fileId);
      }
      
      // If the user is a member of communities, load member details for each community
      if (this.userProfile.communities && this.userProfile.communities.length > 0) {
        this.loadCommunityMemberships();
      }
    });
  }

  /**
   * Load profile picture using MediaService
   * @param fileId The profile picture file ID
   */  loadProfilePicture(fileId: string): void {
    this.profilePictureUrl = null;
    
    console.log('Loading profile picture with fileId:', fileId);
    this.loadingService.start('profile-picture');
    
    this.mediaService.getFileUrl(fileId).subscribe({
      next: (response) => {
        if (response && response.url) {
          // First try to use absoluteUrl if provided
          if (response.absoluteUrl) {
            this.profilePictureUrl = response.absoluteUrl;
            console.log('Using absolute URL from response:', this.profilePictureUrl);
          }
          // Check if it's a relative URL and convert to absolute if needed
          else if (response.url.startsWith('/')) {
            // It's a relative URL, prepend the base API URL from environment
            const baseUrl = environment.apiUrl.replace('/api', ''); // Remove '/api' from the end
            this.profilePictureUrl = `${baseUrl}${response.url}`;
            console.log('Profile picture URL created from relative path:', this.profilePictureUrl);
          } else {
            // It's already an absolute URL
            this.profilePictureUrl = response.url;
            console.log('Profile picture URL (already absolute):', this.profilePictureUrl);
          }
        } else {
          console.warn('No URL returned for profile picture');
        }
      },
      error: (error: any) => {
        console.error('Failed to load profile picture URL:', error);
        this.toastService.error('Failed to load profile picture');
      },
      complete: () => {
        this.loadingService.stop('profile-picture');
      }
    });
  }
  /**
   * Handle image loading error by trying to fix relative URLs or displaying a placeholder
   */
  handleImageError(event: any): void {
    console.error('Profile image failed to load:', event);
    
    if (this.userProfile?.profilePicture?.fileId && this.profilePictureUrl) {
      // Get the current URL that failed
      const currentUrl = this.profilePictureUrl;
      
      console.log('Image failed to load with URL:', currentUrl);
      
      // If we already tried to recover once, don't try again to avoid infinite loop
      if (this.profilePictureUrl.includes('__retried')) {
        console.log('Already attempted recovery once, showing placeholder');
        this.profilePictureUrl = null;
        return;
      }
      
      // If we're using a relative URL, try with the full API URL
      if (currentUrl.startsWith('/')) {
        console.log('Attempting to fix relative URL');
        const fullUrl = `${environment.apiUrl.replace('/api', '')}${currentUrl}__retried`;
        console.log('New URL:', fullUrl);
        
        // Update the image source to the full URL
        event.target.src = fullUrl;
      } else if (!currentUrl.includes('://')) {
        // If it's not a fully qualified URL (no http:// or https://)
        console.log('URL might not be fully qualified, trying with API base URL');
        const fullUrl = `${environment.apiUrl.replace('/api', '')}/${currentUrl.replace(/^\//, '')}__retried`;
        console.log('New URL with base:', fullUrl);
        event.target.src = fullUrl;
      } else {
        // If we already tried with a full URL and it still failed, show the placeholder
        console.log('Image failed with a full URL, showing placeholder');
        this.profilePictureUrl = null;
      }
    } else {
      // If there's no URL or file ID, just show the placeholder
      this.profilePictureUrl = null;
    }
  }

  /**
   * Handle successful image loading
   */
  handleImageLoaded(): void {
    console.log('Profile image loaded successfully');
  }

  loadCommunityMemberships(): void {
    this.loadingService.start('member-details');
    
    // Extract community IDs from user profile
    const communityIds = this.userProfile.communities.map((community: any) => 
      community.id?._id || community.id);
    
    // Create an array of requests for each community
    const memberRequests = communityIds.map((communityId: string) => 
      this.memberService.getMembersByCommunityId(communityId).pipe(
        catchError(error => {
          console.error(`Error fetching members for community ${communityId}:`, error);
          return throwError(() => error);
        })
      )
    );
      // Execute all requests in parallel
    if (memberRequests.length > 0) {
      forkJoin<any[]>(memberRequests).pipe(
        finalize(() => {
          this.loadingService.stop('member-details');
        })
      ).subscribe({
        next: (results: any[]) => {
          console.log('Community member details loaded:', results);
          // Process each community's member results
          results.forEach((result: any, index: number) => {
            const communityId = communityIds[index];
            const communityInfo = this.userProfile.communities.find((c: any) => 
              (c.id?._id || c.id) === communityId);
            
            if (result && result.data) {              // Log the community members and user IDs for debugging
              console.log(`Community ${communityId} members:`, result.data);
              console.log('Current user ID:', this.userProfile._id);
              console.log('Current user ID from auth:', this.userId || this.authService.currentUserValue?.id);
              
              // Find the current user's member details in this community with enhanced user detection
              let userMember = result.data.find((member: any) => {
                // Check if userId is an object with _id or a string
                const memberId = member.userId?._id || member.userId;
                const currentUserId = this.userProfile._id || this.userProfile.id;
                
                // Log each comparison for debugging
                console.log(`Comparing member ID: ${memberId} with user ID: ${currentUserId}`);
                
                return memberId === currentUserId;
              });
              
              // If still not found, try email comparison as fallback
              if (!userMember && this.userProfile.email) {
                userMember = result.data.find((member: any) => 
                  member.email === this.userProfile.email);
              }
              
              console.log('User member details:', userMember);              if (userMember) {
                this.communityMemberships.push({
                  communityId,
                  communityName: communityInfo?.id?.name || 'Unknown Community',
                  position: userMember.position,
                  joinedAt: userMember.joinedAt,
                  status: userMember.status,
                  isAdmin: communityInfo?.isAdmin || false,
                  memberDetails: userMember,
                  // Add more member details
                  missedContributions: userMember.missedContributions || [],
                  penalty: userMember.penalty || 0,
                  contributionPaid: userMember.contributionPaid || [],
                  paymentPlan: userMember.paymentPlan || {}
                });
              } else {
                // If user member not found but we still have community info, add basic info
                console.log('No member details found for user in community', communityId);
                if (communityInfo) {
                  this.communityMemberships.push({
                    communityId,
                    communityName: communityInfo?.id?.name || 'Unknown Community',
                    position: 'N/A',
                    joinedAt: null,
                    status: 'unknown',
                    isAdmin: communityInfo?.isAdmin || false,
                    memberDetails: null,
                    missedContributions: [],
                    penalty: 0,
                    contributionPaid: [],
                    paymentPlan: {}
                  });
                }
              }
            }
          });
          
          console.log('Community memberships loaded:', this.communityMemberships);
        },
        error: (error: any) => {
          console.error('Error loading member details:', error);
          this.toastService.error('Error loading community membership details');
        }
      });
    }
  }
  getMemberStatusClass(status: string): string {
    switch(status) {
      case 'active': return 'member-status-active';
      case 'inactive': return 'member-status-inactive';
      case 'waiting': return 'member-status-waiting';
      case 'unknown': return 'member-status-unknown';
      default: return '';
    }
  }

  navigateToCommunity(communityId: string): void {
    this.buttonClick.emit();
    this.router.navigate(['/communities', communityId]);
  }

  navigateToContributions(): void {
    this.buttonClick.emit();
    this.router.navigate(['/contributions']);
  }

  navigateToWallet(): void {
    this.buttonClick.emit();
    this.router.navigate(['/wallet']);
  }
  formatDate(dateString: string | Date): string {
    try {
      if (!dateString) return 'Not available';
      
      const date = new Date(dateString);
      
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        return 'Not available';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return 'Not available';
    }
  }

  /**
   * Get user initials for avatar placeholder
   * @param name User full name
   * @returns First letter of first and last name
   */
  getUserInitials(name: string): string {
    if (!name) return '';
    const names = name.split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  }
}