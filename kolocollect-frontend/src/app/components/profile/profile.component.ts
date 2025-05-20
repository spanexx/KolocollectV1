import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { environment } from '../../../environments/environment';
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
  faEdit,
  faCamera,
  faUpload,
  faFileAlt,
  faIdCard,
  faFileUpload,
  faTrash
} from '@fortawesome/free-solid-svg-icons';

import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { MediaService, UploadResponse } from '../../services/media.service';
import { ToastService } from '../../services/toast.service';
import { LoadingService } from '../../services/loading.service';
import { catchError, finalize, throwError, of, switchMap, tap } from 'rxjs';
import { ImageCroppedEvent } from 'ngx-image-cropper';
import { ImageCropperDialogComponent } from './image-cropper-dialog/image-cropper-dialog.component';
import { UserProfile, VerificationDocument } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,  imports: [
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
    MatSlideToggleModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    FontAwesomeModule
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
  faHistory = faHistory;  faEdit = faEdit;
  faCamera = faCamera;
  faUpload = faUpload;
  faFileAlt = faFileAlt;
  faIdCard = faIdCard;
  faFileUpload = faFileUpload;
  faTrash = faTrash;

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  notificationForm!: FormGroup;
  documentForm!: FormGroup;
    user: any = null;
  notifications: any[] = [];
  activityLog: any[] = [];
  isLoading: boolean = false;
  isEditing: boolean = false;
  error: string | null = null;
  profilePictureUrl: string | null = null;
  
  @ViewChild('profilePictureInput') profilePictureInput!: ElementRef;
  @ViewChild('documentFileInput') documentFileInput!: ElementRef;
  
  imageChangedEvent: any = '';
  croppedImage: any = '';
  showCropper: boolean = false;
  
  documentTypes = [
    { value: 'id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
    { value: 'driverLicense', label: 'Driver\'s License' },
    { value: 'utilityBill', label: 'Utility Bill' },
    { value: 'other', label: 'Other' }
  ];
  constructor(
    private formBuilder: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private mediaService: MediaService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.createForms();
    this.loadUserProfile();
    this.loadUserNotifications();
    this.loadUserActivityLog();
  }  createForms(): void {
    this.profileForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      username: ['', Validators.required],
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
    
    this.documentForm = this.formBuilder.group({
      documentType: ['', Validators.required],
      documentDescription: ['']
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
      })    ).subscribe(response => {
      // Extract user data, handling both {user: {...}} and direct user object formats
      this.user = response.user || response;
        // Populate form with user data
      this.profileForm.patchValue({
        firstName: this.user.firstName || '',
        lastName: this.user.lastName || '',
        username: this.user.username || '',
        email: this.user.email || '',
        phone: this.user.phone || '',
        address: this.user.address || '',
        bio: this.user.bio || ''
      });
      
      // Populate notification preferences if available
      if (this.user.preferences) {
        this.notificationForm.patchValue({
          emailNotifications: this.user.preferences.emailNotifications ?? true,
          appNotifications: this.user.preferences.appNotifications ?? true,
          communityUpdates: this.user.preferences.communityUpdates ?? true,
          payoutAlerts: this.user.preferences.payoutAlerts ?? true
        });
      }

      // Load profile picture if exists
      this.loadProfilePictureUrl();
    });
  }

  loadUserNotifications(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }    this.userService.getUserNotifications(userId).pipe(
      catchError(error => {
        console.error('Failed to load notifications:', error);
        return of([]);
      })
    ).subscribe(notifications => {
      // Ensure notifications is always an array
      this.notifications = Array.isArray(notifications) ? notifications : [];
    });
  }

  loadUserActivityLog(): void {
    const userId = this.authService.currentUserValue?.id;
    
    if (!userId) {
      return;
    }    this.userService.getUserActivityLog(userId).pipe(
      catchError(error => {
        console.error('Failed to load activity log:', error);
        return of([]);
      })
    ).subscribe(log => {
      // Ensure activity log is always an array
      this.activityLog = Array.isArray(log) ? log : [];
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
    ).subscribe((res) => {
      console.log(res)
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

    this.userService.cleanUpLogs(userId, true).pipe(
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
  
  // Profile Picture Methods
  triggerProfilePictureUpload(): void {
    this.profilePictureInput.nativeElement.click();
  }
  
  onProfilePictureSelected(event: any): void {
    this.imageChangedEvent = event;
    this.openImageCropperDialog();
  }
  openImageCropperDialog(): void {
    console.log('Opening image cropper dialog');
    const dialogRef = this.dialog.open(ImageCropperDialogComponent, {
      width: '500px',
      data: { imageChangedEvent: this.imageChangedEvent },
      disableClose: true // Prevent closing by clicking outside
    });
    
    dialogRef.afterClosed().subscribe(result => {
      console.log('Dialog closed with result:', result ? 
        `Image data received (length: ${result.length})` : 
        'No image data');
      
      if (result && result.length > 0) {
        console.log('Proceeding to upload profile picture');
        this.uploadProfilePicture(result);
      } else {
        console.log('No image data received from dialog, upload cancelled');
        this.toastService.info('Profile picture update was cancelled');
      }
    });
  }  
  uploadProfilePicture(croppedImage: string): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }
    
    // Verify we have valid image data
    if (!croppedImage || !croppedImage.startsWith('data:image/')) {
      this.toastService.error('Invalid image data received');
      console.error('Invalid image data format:', croppedImage ? 
        `${croppedImage.substring(0, 20)}... (length: ${croppedImage.length})` : 
        'undefined');
      return;
    }
    
    console.log('******* PROFILE PICTURE UPLOAD FLOW *******');
    console.log('1. Starting profile picture upload process for user:', userId);
    console.log('2. Cropped image data received:', croppedImage.substring(0, 50) + '...');
    console.log('3. Image data length:', croppedImage?.length || 0);
    this.loadingService.start('upload-profile-picture');
    
    // Convert base64 to blob
    console.log('4. Converting base64 to blob');
    try {
      fetch(croppedImage)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch blob: ${res.statusText}`);
          }
          return res.blob();
        })
        .then(blob => {
          // Create a File object
          console.log('5. Blob created successfully, size:', blob.size);
          const file = new File([blob], 'profile-picture.png', { type: 'image/png' });
          console.log('6. Created File object for upload:', {
            name: file.name,
            size: file.size,
            type: file.type
          });
          
          // Use MediaService to upload the profile picture
          console.log('7. About to call mediaService.uploadFile');
          this.mediaService.uploadFile(file, userId, 'profilePicture')
            .pipe(
              tap((response: UploadResponse) => {
                console.log('8. Media upload response:', response);
              }),
              switchMap((response: UploadResponse) => {
                // Use UserService's updateProfilePicture which properly sends both fileId and URL
                console.log('9. Updating user profile picture with:', { fileId: response.fileId, url: response.url });
                return this.userService.updateProfilePicture(userId, {
                  fileId: response.fileId,
                  url: response.url
                });
              }),
              catchError(error => {
                this.toastService.error('Failed to upload profile picture');
                console.error('Profile picture upload error:', error);
                return throwError(() => error);
              }),
              finalize(() => {
                console.log('10. Profile picture upload process finished');
                this.loadingService.stop('upload-profile-picture');
              })
            )
            .subscribe({
              next: (response) => {
                console.log('11. Profile picture update successful with response:', response);
                this.toastService.success('Profile picture updated successfully');
                console.log('12. About to reload user profile');
                this.loadUserProfile();
              },
              error: (err) => {
                console.error('ERROR: Final error in profile picture update:', err);
              }
            });
        })
        .catch(error => {
          console.error('Error in profile picture processing:', error);
          this.toastService.error('Failed to process profile picture');
          this.loadingService.stop('upload-profile-picture');
        });
    } catch (error) {
      console.error('Error initiating fetch:', error);
      this.toastService.error('Failed to process profile picture');
      this.loadingService.stop('upload-profile-picture');
    }
  }
  
  // Document Upload Methods
  triggerDocumentUpload(): void {
    this.documentFileInput.nativeElement.click();
  }
  
  onDocumentSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    
    this.uploadDocument(file);
  }    uploadDocument(file: File): void {
    if (this.documentForm.invalid) {
      this.toastService.error('Please select a document type');
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }
    
    const documentType = this.documentForm.get('documentType')?.value;
    const documentDescription = this.documentForm.get('documentDescription')?.value;
    
    console.log('Starting document upload process for user:', userId, {
      documentType,
      documentDescription
    });
    this.loadingService.start('upload-document');
    
    this.mediaService.uploadFile(file, userId, 'verificationDocument', documentType)
      .pipe(
        tap((response: UploadResponse) => {
          console.log('Document upload response:', response);
        }),
        switchMap((response: UploadResponse) => {
          console.log('Adding verification document with:', {
            fileId: response.fileId,
            url: response.url,
            documentType,
            documentDescription
          });
          return this.userService.addVerificationDocument(userId, {
            fileId: response.fileId,
            url: response.url,
            documentType,
            documentDescription
          });
        }),
        catchError(error => {
          this.toastService.error('Failed to upload document');
          console.error('Document upload error:', error);
          return throwError(() => error);
        }),
        finalize(() => {
          console.log('Document upload process finished');
          this.loadingService.stop('upload-document');
          this.documentForm.reset();
          this.documentFileInput.nativeElement.value = '';
        })
      )
      .subscribe({
        next: () => {
          console.log('Document upload successful');
          this.toastService.success('Document uploaded successfully');
          this.loadUserProfile();
        },
        error: (err) => {
          console.error('Final error in document upload:', err);
        }
      });
  }
  
  deleteVerificationDocument(documentId: string): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('User not authenticated');
      return;
    }
    
    this.loadingService.start('delete-document');
    
    this.userService.deleteVerificationDocument(userId, documentId)
      .pipe(
        catchError(error => {
          this.toastService.error('Failed to delete document');
          return throwError(() => error);
        }),
        finalize(() => this.loadingService.stop('delete-document'))
      )
      .subscribe(() => {
        this.toastService.success('Document deleted successfully');
        this.loadUserProfile();
      });
  }
  
  getDocumentTypeName(type: string): string {
    const docType = this.documentTypes.find(dt => dt.value === type);
    return docType ? docType.label : 'Unknown';
  }
  
  getVerificationStatusClass(status: string): string {
    switch (status) {
      case 'verified': return 'status-verified';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }
  
  getVerificationStatusIcon(status: string): any {
    switch (status) {
      case 'verified': return 'check_circle';
      case 'rejected': return 'cancel';
      default: return 'hourglass_empty';
    }
  }
  
  /**
   * Handle image loading error
   */
  handleImageError(event: any): void {
    console.error('Profile image failed to load:', event);
    
    if (this.user?.profilePicture?.fileId && this.profilePictureUrl) {
      // Get the current URL that failed
      const currentUrl = this.profilePictureUrl;
      
      console.log('Image failed to load with URL:', currentUrl);
      
      // If we're using a relative URL, try with the full API URL
      if (currentUrl.startsWith('/')) {
        console.log('Attempting to fix relative URL');
        const fullUrl = `${environment.apiUrl.replace('/api', '')}${currentUrl}`;
        console.log('New URL:', fullUrl);
        
        // Update the image source to the full URL
        event.target.src = fullUrl;
      } else if (!currentUrl.includes('://')) {
        // If it's not a fully qualified URL (no http:// or https://)
        console.log('URL might not be fully qualified, trying with API base URL');
        const fullUrl = `${environment.apiUrl.replace('/api', '')}/${currentUrl.replace(/^\//, '')}`;
        console.log('New URL with base:', fullUrl);
        event.target.src = fullUrl;
      } else {
        // If we already tried with a full URL and it still failed, show the placeholder
        console.log('Image failed with a full URL, showing placeholder');
        this.profilePictureUrl = null;
        this.toastService.error('Failed to load profile picture');
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

  /**
   * Load profile picture URL using MediaService's getFileUrl method
   */  
  loadProfilePictureUrl(): void {
    // Reset profile picture URL
    this.profilePictureUrl = null;
    
    // Check if user has a profile picture
    if (this.user?.profilePicture?.fileId) {
      console.log('Loading profile picture URL for fileId:', this.user.profilePicture.fileId);
      
      // Use the MediaService to get the signed URL
      this.mediaService.getFileUrl(this.user.profilePicture.fileId)
        .pipe(
          catchError(error => {
            console.error('Failed to load profile picture URL:', error);
            this.toastService.error('Failed to load profile picture URL');
            // Return an empty URL with the correct type structure
            return of({ url: '' });
          })
        )
        .subscribe(response => {
          // The response type is now { url: string, absoluteUrl?: string }
          if (response && response.url) {
            // First check if the URL is relative and convert to absolute if needed
            if (response.url.startsWith('/')) {
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
        });
    } else {
      console.log('User has no profile picture fileId');
    }
  }
}