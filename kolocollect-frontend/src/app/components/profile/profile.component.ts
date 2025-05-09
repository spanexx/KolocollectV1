import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, 
  faEnvelope, 
  faPhone, 
  faMapMarkerAlt, 
  faPencilAlt, 
  faKey, 
  faShieldAlt,
  faClock,
  faBell,
  faBellSlash,
  faHistory,
  faEdit
} from '@fortawesome/free-solid-svg-icons';

import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { catchError, finalize, throwError, of } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    FontAwesomeModule,
    MatSlideToggleModule
  ]
})
export class ProfileComponent implements OnInit {
  // FontAwesome icons
  faUser = faUser;
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faMapMarkerAlt = faMapMarkerAlt;
  faPencilAlt = faPencilAlt;
  faKey = faKey;
  faShieldAlt = faShieldAlt;
  faClock = faClock;
  faBell = faBell;
  faBellSlash = faBellSlash;
  faHistory = faHistory;
  faEdit = faEdit;

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  notificationForm!: FormGroup;
  
  user: any = null;
  notifications: any[] = [];
  activityLog: any[] = [];
  isLoading: boolean = false;
  isEditing: boolean = false;
  error: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.createForms();
    this.loadUserProfile();
    this.loadUserNotifications();
    this.loadUserActivityLog();
  }

  createForms(): void {
    this.profileForm = this.formBuilder.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(/^\+?[0-9\s\-\(\)]+$/)],
      address: [''],
      bio: ['']
    });

    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.checkPasswordMatch });

    this.notificationForm = this.formBuilder.group({
      emailNotifications: [true],
      appNotifications: [true],
      communityUpdates: [true],
      payoutAlerts: [true]
    });
  }

  checkPasswordMatch(group: FormGroup): any {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { notMatching: true };
  }

  loadUserProfile(): void {
    this.isLoading = true;
    this.error = null;
    this.loadingService.start('profile');

    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      this.error = 'User not authenticated';
      this.isLoading = false;
      this.loadingService.stop('profile');
      return;
    }

    this.userService.getUserProfile(userId).pipe(
      catchError(error => {
        this.error = error.message || 'Failed to load user profile';
        this.toastService.error('Error loading user profile');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('profile');
      })
    ).subscribe(profile => {
      this.user = profile;
      
      // Populate form with user data
      this.profileForm.patchValue({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        bio: profile.bio || ''
      });

      // Populate notification preferences if available
      if (profile.preferences) {
        this.notificationForm.patchValue({
          emailNotifications: profile.preferences.emailNotifications ?? true,
          appNotifications: profile.preferences.appNotifications ?? true,
          communityUpdates: profile.preferences.communityUpdates ?? true,
          payoutAlerts: profile.preferences.payoutAlerts ?? true
        });
      }
    });
  }

  loadUserNotifications(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }

    this.userService.getUserNotifications(userId).pipe(
      catchError(error => {
        console.error('Failed to load notifications:', error);
        return of([]);
      })
    ).subscribe(notifications => {
      this.notifications = notifications;
    });
  }

  loadUserActivityLog(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }

    this.userService.getUserActivityLog(userId).pipe(
      catchError(error => {
        console.error('Failed to load activity log:', error);
        return of([]);
      })
    ).subscribe(log => {
      this.activityLog = log;
    });
  }

  toggleEditProfile(): void {
    this.isEditing = !this.isEditing;
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.toastService.error('Please correct the errors in the form');
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }

    this.isLoading = true;
    this.loadingService.start('update-profile');

    this.userService.updateUserProfile(userId, this.profileForm.value).pipe(
      catchError(error => {
        this.toastService.error(error.message || 'Failed to update profile');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('update-profile');
      })
    ).subscribe(() => {
      this.toastService.success('Profile updated successfully');
      this.isEditing = false;
      this.loadUserProfile();
    });
  }

  updatePassword(): void {
    if (this.passwordForm.invalid) {
      this.toastService.error('Please correct the errors in the form');
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }

    this.isLoading = true;
    this.loadingService.start('update-password');

    this.userService.updatePassword(userId, {
      currentPassword: this.passwordForm.value.currentPassword,
      newPassword: this.passwordForm.value.newPassword
    }).pipe(
      catchError(error => {
        this.toastService.error(error.message || 'Failed to update password');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('update-password');
      })
    ).subscribe(() => {
      this.toastService.success('Password updated successfully');
      this.passwordForm.reset();
    });
  }

  updateNotificationSettings(): void {
    if (this.notificationForm.invalid) {
      this.toastService.error('Please correct the errors in the form');
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }

    this.isLoading = true;
    this.loadingService.start('update-notifications');

    this.userService.updateUserPreferences(userId, this.notificationForm.value).pipe(
      catchError(error => {
        this.toastService.error(error.message || 'Failed to update notification settings');
        return throwError(() => error);
      }),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('update-notifications');
      })
    ).subscribe(() => {
      this.toastService.success('Notification settings updated successfully');
    });
  }

  markNotificationRead(notificationId: string): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }

    this.userService.markNotificationRead(userId, notificationId).pipe(
      catchError(error => {
        console.error('Failed to mark notification as read:', error);
        return throwError(() => error);
      })
    ).subscribe(() => {
      this.loadUserNotifications();
    });
  }

  clearActivityLog(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }

    this.userService.cleanUpLogs(userId).pipe(
      catchError(error => {
        this.toastService.error('Failed to clear activity log');
        return throwError(() => error);
      })
    ).subscribe(() => {
      this.toastService.success('Activity log cleared successfully');
      this.activityLog = [];
    });
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid date';
    }
  }
}