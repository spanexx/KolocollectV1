import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {  registerForm: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private http: HttpClient  ) {
    this.registerForm = this.formBuilder.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [
        Validators.required, 
        Validators.minLength(6),
        this.passwordComplexityValidator
      ]],
      confirmPassword: ['', Validators.required],
      acceptTerms: [false, Validators.requiredTrue]
    }, {
      validator: this.passwordMatchValidator
    });
    
    // Redirect if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
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
  
  // Custom validator to check password complexity
  passwordComplexityValidator(control: FormGroup['controls'][string]) {
    const password = control.value;
    
    if (!password) {
      return null;
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    const isValid = hasUpperCase && hasLowerCase && hasNumber && hasSpecial;
    
    return isValid ? null : { complexityRequired: true };
  }

  // Convenience getter for easy access to form fields
  get f() { return this.registerForm.controls; }  onSubmit() {
    this.submitted = true;

    // Stop here if form is invalid
    if (this.registerForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = '';

    // Split the full name into firstName and lastName
    const fullName = this.f['name'].value.trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Create a username from the email address (before the @ symbol)
    const email = this.f['email'].value;
    const username = email.split('@')[0];

    this.authService.register({
      username: username,
      email: email,
      password: this.f['password'].value,
      firstName: firstName,
      lastName: lastName
    })
    .pipe(
      catchError(error => {
        this.error = error?.error?.message || 'Registration failed';
        this.toastService.error(this.error);
        return throwError(() => error);
      }),
      finalize(() => {
        this.loading = false;
      })
    )    .subscribe({
      next: (response: any) => {
        console.log('Auth API response:', response);
        // Extract user data from response (adapt this based on actual response structure)
        const userData = {
          id: response.id || '',
          email: email,
          username: username,
          firstName: firstName,
          lastName: lastName
        };

        // Now sync with our own application database
        this.sendUserToBackend(userData).subscribe({
          next: (backendRes) => {
            console.log('Successfully saved user in app DB:', backendRes);
            this.toastService.success('Registration successful! Please log in.');
            this.router.navigate(['/login'], { queryParams: { registered: true } });
          },
          error: (err) => {
            console.error('Error saving user to backend:', err);
            this.error = 'Error syncing user with backend';
            this.toastService.error(this.error);
          }
        });
      }
    });
  }

  /**
   * Helper to send the newly-registered user into our own backend.
   * Replace the URL with your real endpoint, and adjust payload as needed.
   * @param user - user object returned by auth-service
   * @returns Observable of the backend save response
   */
  private sendUserToBackend(user: any) {
    const backendUrl = `${environment.apiUrl}/users/from-auth`; // Replace with your real backend URL
    // Optionally transform or pick only needed fields:
    const payload = {
      _id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      // add any other app-specific defaults/meta
    };
    return this.http.post(backendUrl, payload);
  }
}