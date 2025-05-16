import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommunityService } from '../../../services/community.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowRight, faArrowLeft, faCheck, faSpinner, faSave, faPlus, faUsers, faInfoCircle, faDollarSign, faCog } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-community-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatSnackBarModule,
    FontAwesomeModule
  ],
  templateUrl: './community-create.component.html',
  styleUrls: ['./community-create.component.scss']
})
export class CommunityCreateComponent implements OnInit {
  basicInfoForm!: FormGroup;
  contributionSettingsForm!: FormGroup;
  advancedSettingsForm!: FormGroup;
  isLoading = false;
  userId = '';
    // Font Awesome Icons
  faArrowRight = faArrowRight;
  faArrowLeft = faArrowLeft;
  faCheck = faCheck;
  faSpinner = faSpinner;
  faSave = faSave;
  faPlus = faPlus;
  faUsers = faUsers;
  faInfoCircle = faInfoCircle;
  faDollarSign = faDollarSign;
  faCog = faCog;
  
  frequencyOptions = [
    { value: 'Daily', label: 'Daily' },
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Monthly', label: 'Monthly' }
  ];

  constructor(
    private fb: FormBuilder,
    private communityService: CommunityService,
    private router: Router,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {}  ngOnInit(): void {
    // Get current user ID from auth service
    this.userId = this.authService.getUserId() || '';
    
    if (!this.userId) {
      // Try to get user from localStorage directly as fallback
      const localUser = localStorage.getItem('user');
      if (localUser) {
        try {
          const userObj = JSON.parse(localUser);
          this.userId = userObj.id || userObj._id || '';
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
        }
      }
    }
    
    if (!this.userId) {
      this.snackBar.open('You must be logged in to create a community', 'Close', { duration: 5000 });
      this.router.navigate(['/login']);
      return;
    }
    
    console.log('Creating community with user ID:', this.userId);
    
    // Initialize form groups
    this.initializeForms();
  }

  initializeForms(): void {
    this.basicInfoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required]
    });

    this.contributionSettingsForm = this.fb.group({
      contributionFrequency: ['Weekly', Validators.required],
      minContribution: [30, [Validators.required, Validators.min(1)]],
      maxMembers: [10, [Validators.required, Validators.min(5), Validators.max(100)]]
    });

    this.advancedSettingsForm = this.fb.group({
      backupFundPercentage: [10, [Validators.required, Validators.min(5), Validators.max(20)]],
      firstCycleMin: [5, [Validators.required, Validators.min(5)]],
      allowMidCycleJoining: [true],
      penalty: [10, [Validators.required, Validators.min(0)]]
    });
  }

  onSubmit(): void {
    if (this.basicInfoForm.invalid || this.contributionSettingsForm.invalid || this.advancedSettingsForm.invalid) {
      this.snackBar.open('Please complete all required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isLoading = true;

    // Combine all form values into the community data object
    const communityData = {
      name: this.basicInfoForm.value.name,
      description: this.basicInfoForm.value.description,
      contributionFrequency: this.contributionSettingsForm.value.contributionFrequency,
      maxMembers: this.contributionSettingsForm.value.maxMembers,
      backupFundPercentage: this.advancedSettingsForm.value.backupFundPercentage,
      adminId: this.userId,
      settings: {
        contributionFrequency: this.contributionSettingsForm.value.contributionFrequency,
        minContribution: this.contributionSettingsForm.value.minContribution,
        maxMembers: this.contributionSettingsForm.value.maxMembers,
        backupFundPercentage: this.advancedSettingsForm.value.backupFundPercentage,
        firstCycleMin: this.advancedSettingsForm.value.firstCycleMin,
        allowMidCycleJoining: this.advancedSettingsForm.value.allowMidCycleJoining,
        penalty: this.advancedSettingsForm.value.penalty
      }
    };    this.communityService.createCommunity(communityData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.snackBar.open('Community created successfully!', 'Close', { duration: 3000 });
          // Navigate to the newly created community's detail page
        console.log('Community creation response:', response);
        
        if (response && response.data && response.data._id) {
          this.router.navigate(['/communities', response.data._id]);
        } else if (response && response.data && response.data.id) {
          this.router.navigate(['/communities', response.data.id]);
        } else if (response && response.community && response.community._id) {
          this.router.navigate(['/communities', response.community._id]);
        } else if (response && response.community && response.community.id) {
          this.router.navigate(['/communities', response.community.id]);
        } else if (response && response._id) {
          this.router.navigate(['/communities', response._id]);
        } else if (response && response.id) {
          this.router.navigate(['/communities', response.id]);
        } else {
          this.router.navigate(['/communities']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error creating community:', error);
        this.snackBar.open(
          error.error?.message || 'Failed to create community. Please try again.', 
          'Close', 
          { duration: 5000 }
        );
      }
    });
  }
  
  // Convenience getter methods for form controls
  get basicInfo() {
    return this.basicInfoForm.controls;
  }
  
  get contributionSettings() {
    return this.contributionSettingsForm.controls;
  }
  
  get advancedSettings() {
    return this.advancedSettingsForm.controls;
  }
}