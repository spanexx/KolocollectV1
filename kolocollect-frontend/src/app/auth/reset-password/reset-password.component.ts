import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  token = '';  resetComplete = false;
  isCodeValid = false;

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.resetForm = this.formBuilder.group({
      verificationCode: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, {
      validator: this.passwordMatchValidator
    });

    // Watch for verification code changes
    this.resetForm.get('verificationCode')?.valueChanges.subscribe(value => {
      this.isCodeValid = value && value.length === 4 && /^\d{4}$/.test(value);
    });
  }

  ngOnInit() {
    // Get token from URL parameters
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.error = 'Invalid password reset token. Please request a new password reset link.';
        this.toastService.error(this.error);
      }
    });
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      formGroup.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    } else {
      formGroup.get('confirmPassword')?.setErrors(null);
    }
  }

  // Convenience getter for easy access to form fields
  get f() { return this.resetForm.controls; }
  onSubmit() {
    this.submitted = true;

    // Stop here if form is invalid or missing required fields
    if (this.resetForm.invalid || !this.token || !this.isCodeValid) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.resetPassword({
      token: this.token,
      password: this.f['password'].value,
      verificationCode: this.f['verificationCode'].value
    })
    .pipe(
      catchError(error => {
        this.error = error?.error?.message || 'Failed to reset password. Please try again.';
        this.toastService.error(this.error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.loading = false;
      })
    )
    .subscribe({
      next: () => {
        this.resetComplete = true;
        this.toastService.success('Password reset successful! You can now log in with your new password.');
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      }
    });
  }
}