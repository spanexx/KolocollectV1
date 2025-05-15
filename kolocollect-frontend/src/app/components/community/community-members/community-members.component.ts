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

  constructor(
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private dialog: MatDialog
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
      )
      .subscribe(data => {
        this.community = data.community;
        if (this.community && this.community.members) {
          this.members = this.community.members;
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
}
