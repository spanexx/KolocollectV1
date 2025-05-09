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
  faMoneyBillTransfer
} from '@fortawesome/free-solid-svg-icons';

import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';
import { catchError, finalize, throwError } from 'rxjs';

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
  faEye = faEye;
  faUserPlus = faUserPlus;
  faUsersViewfinder = faUsersViewfinder;
  faMoneyBillTransfer = faMoneyBillTransfer;

  userProfile: any = null;
  wallet: any = null;
  nextInLineDetails: any = null;
  isLoading: boolean = false;
  error: string | null = null;

  constructor(
    private userService: UserService,
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
      this.userProfile = response.user;
      this.wallet = response.wallet;
      this.nextInLineDetails = response.nextInLineDetails;
    });
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
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }
}