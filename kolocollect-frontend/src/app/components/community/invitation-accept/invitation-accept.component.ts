import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InvitationService, Invitation } from '../../../services/invitation.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-invitation-accept',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invitation-accept.component.html',
  styleUrls: ['./invitation-accept.component.scss']
})
export class InvitationAcceptComponent implements OnInit {
  inviteCode!: string;
  invitationDetails: Invitation | null = null;
  isLoading = true;
  isSubmitting = false;
  error: string | null = null;
  isLoggedIn = false;
  
  acceptForm!: FormGroup;
  currentStep: 'loading' | 'invalid' | 'expired' | 'login-required' | 'accept' | 'success' = 'loading';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private invitationService: InvitationService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.initializeForm();
    this.checkAuthStatus();
    this.loadInvitationFromRoute();
  }

  private initializeForm() {
    this.acceptForm = this.fb.group({
      acceptTerms: [false, Validators.requiredTrue],
      joinReason: ['', [Validators.maxLength(500)]]
    });
  }

  private checkAuthStatus() {
    this.isLoggedIn = this.authService.isAuthenticated();
  }

  private async loadInvitationFromRoute() {
    this.route.params.subscribe(async params => {
      this.inviteCode = params['inviteCode'];
      
      if (!this.inviteCode) {
        this.currentStep = 'invalid';
        this.isLoading = false;
        return;
      }

      await this.loadInvitationDetails();
    });
  }

  private async loadInvitationDetails() {
    try {
      this.loadingService.start('loading-invitation');
      
      const response = await this.invitationService.getInvitationByCode(this.inviteCode).toPromise();
        if (response?.success) {
        this.invitationDetails = response.data.invitation;
        
        // Check invitation status
        if (this.invitationDetails.status === 'expired') {
          this.currentStep = 'expired';
        } else if (this.invitationDetails.status === 'cancelled') {
          this.currentStep = 'invalid';
          this.error = 'This invitation has been cancelled';
        } else if (this.invitationDetails.status === 'accepted') {
          this.currentStep = 'invalid';
          this.error = 'This invitation has already been used';
        } else if (!this.isLoggedIn) {
          this.currentStep = 'login-required';
        } else {
          this.currentStep = 'accept';
        }
      } else {
        this.currentStep = 'invalid';
        this.error = 'Invalid invitation link';
      }
    } catch (error: any) {
      console.error('Error loading invitation details:', error);
      this.currentStep = 'invalid';
      this.error = error.error?.message || 'Failed to load invitation details';
    } finally {
      this.isLoading = false;
      this.loadingService.stop('loading-invitation');
    }
  }

  async acceptInvitation() {
    if (this.acceptForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSubmitting = true;
    this.loadingService.start('accepting-invitation');

    try {
      const formValue = this.acceptForm.value;      const response = await this.invitationService.acceptInvitation(this.inviteCode).toPromise();

      if (response?.success) {
        this.currentStep = 'success';
        this.toastService.success('Successfully joined the community!');
          // Redirect to community page after a delay
        setTimeout(() => {
          if (this.invitationDetails?.community?.id) {
            this.router.navigate(['/communities', this.invitationDetails.community.id]);
          } else {
            this.router.navigate(['/communities']);
          }
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      this.toastService.error(error.error?.message || 'Failed to accept invitation');
    } finally {
      this.isSubmitting = false;
      this.loadingService.stop('accepting-invitation');
    }
  }

  navigateToLogin() {
    // Store the current URL to redirect back after login
    const returnUrl = this.router.url;
    this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  navigateToRegister() {
    // Store the current URL to redirect back after registration
    const returnUrl = this.router.url;
    this.router.navigate(['/register'], { queryParams: { returnUrl } });
  }
  goToCommunity() {
    if (this.invitationDetails?.community?.id) {
      this.router.navigate(['/communities', this.invitationDetails.community.id]);
    } else {
      this.router.navigate(['/communities']);
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }

  private markFormGroupTouched() {
    Object.keys(this.acceptForm.controls).forEach(key => {
      const control = this.acceptForm.get(key);
      control?.markAsTouched();
    });
  }

  // Getters for template
  get acceptTerms() { return this.acceptForm.get('acceptTerms'); }
  get joinReason() { return this.acceptForm.get('joinReason'); }

  // Validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.acceptForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.acceptForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required'] || field.errors['requiredTrue']) {
        return 'This field is required';
      }
      if (field.errors['maxlength']) {
        return 'Message is too long';
      }
    }
    return '';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
