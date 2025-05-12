import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSliderModule } from '@angular/material/slider';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faLock, 
  faArrowLeft, 
  faCalendarAlt, 
  faInfoCircle, 
  faCheckCircle, 
  faExclamationTriangle,
  faRedo 
} from '@fortawesome/free-solid-svg-icons';

import { WalletService } from '../../../services/wallet.service';
import { CommunityService } from '../../../services/community.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-fix-funds',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatSelectModule,
    MatIconModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSliderModule,
    FontAwesomeModule,
    RouterModule
  ],
  templateUrl: './fix-funds.component.html',
  styleUrls: ['./fix-funds.component.scss']
})
export class FixFundsComponent implements OnInit, OnDestroy {
  // Icons
  faLock = faLock;
  faArrowLeft = faArrowLeft;
  faCalendarAlt = faCalendarAlt;
  faInfoCircle = faInfoCircle;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faRedo = faRedo;

  fixFundsForm: FormGroup;
  userId: string | undefined;
  isLoading = false;
  error: string | null = null;
  isSuccess = false;
  availableBalance = 0;
  
  communities: any[] = [];
  userCommunities: any[] = [];
  isLoadingCommunities = false;
  
  // Purpose options
  purposes = [
    { id: 'savings', name: 'Personal Savings' },
    { id: 'emergency', name: 'Emergency Fund' },
    { id: 'community', name: 'Community Backup' },
    { id: 'goal', name: 'Goal-based Savings' },
    { id: 'other', name: 'Other Purpose' }
  ];
  
  // Lock period options
  lockPeriods = [
    { value: 30, label: '1 month' },
    { value: 60, label: '2 months' },
    { value: 90, label: '3 months' },
    { value: 180, label: '6 months' },
    { value: 365, label: '1 year' }
  ];
  
  // Interest rates based on lock period
  interestRates = {
    30: 2,     // 2% for 1 month
    60: 4.5,   // 4.5% for 2 months
    90: 7.5,   // 7.5% for 3 months
    180: 16,   // 16% for 6 months
    365: 35    // 35% for 1 year
  };
    selectedPeriod = 30; // Default to 1 month
  currentDate = new Date();
  calculatedEndDate = new Date();
  estimatedInterest = 0;
  estimatedTotal = 0;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router
  ) {
    this.fixFundsForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(10)]],
      purpose: ['savings', Validators.required],
      lockPeriod: [30, Validators.required],
      communityId: ['']
    });
    
    // Calculate end date when form values change
    this.fixFundsForm.valueChanges.subscribe(() => {
      this.updateCalculations();
    });
  }

  ngOnInit(): void {
    this.userId = this.authService.currentUserValue?.id;
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadWalletBalance();
    this.loadUserCommunities();
    
    // Calculate initial values
    this.updateCalculations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  loadWalletBalance(): void {
    if (!this.userId) return;
    
    this.loadingService.start('load-balance');
    this.walletService.getWalletBalance(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingService.stop('load-balance');
        })
      )
      .subscribe({
        next: (data) => {
          this.availableBalance = data.availableBalance || 0;
        },
        error: (error) => {
          this.toastService.error('Failed to load wallet balance');
        }
      });
  }
  
  loadUserCommunities(): void {
    if (!this.userId) return;
    
    this.loadingService.start('load-communities');
    this.communityService.getUserCommunities(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingService.stop('load-communities');
        })
      )
      .subscribe({        next: (data: any) => {
          this.userCommunities = data || [];
        },
        error: (error: any) => {
          console.error('Failed to load user communities', error);
        }
      });
  }
  
  updateCalculations(): void {
    // Get form values
    const amount = this.fixFundsForm.get('amount')?.value || 0;
    const lockPeriod = this.fixFundsForm.get('lockPeriod')?.value || 30;
    
    // Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + lockPeriod);
    this.calculatedEndDate = endDate;
      // Calculate interest and total
    const validPeriod = [30, 60, 90, 180, 365].includes(lockPeriod) ? lockPeriod as 30 | 60 | 90 | 180 | 365 : 30;
    const interestRate = this.interestRates[validPeriod] || 0;
    this.estimatedInterest = (amount * interestRate) / 100;
    this.estimatedTotal = amount + this.estimatedInterest;
    
    this.selectedPeriod = lockPeriod;
  }
  onSubmit(): void {
    if (this.fixFundsForm.invalid) {
      this.toastService.error('Please fix the errors in the form');
      return;
    }
    
    const { amount, purpose, lockPeriod, communityId } = this.fixFundsForm.value;
    
    // Check if sufficient balance
    if (amount > this.availableBalance) {
      this.error = 'Insufficient balance to fix these funds';
      this.toastService.error(this.error);
      return;
    }
    
    this.isLoading = true;
    this.loadingService.start('fix-funds');
    this.error = null;
    
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.isLoading = false;
      this.loadingService.stop('fix-funds');
      return;
    }
      
    // Create a data object with the exact fields expected by the API
    const data = {
      amount: parseFloat(amount), // Ensure amount is a number
      duration: parseInt(lockPeriod) // Ensure duration is an integer
    };
    
    // Log the data being sent to help debug
    console.log('Fixing funds with data:', data, 'for user:', this.userId);
    
    this.walletService.fixFunds(this.userId as string, data)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.loadingService.stop('fix-funds');
        })
      )
      .subscribe({
        next: (response) => {
          this.toastService.success(`Successfully fixed ${this.formatCurrency(amount)} for ${lockPeriod} days`);
          this.isSuccess = true;
          setTimeout(() => {
            this.router.navigate(['/wallet']);
          }, 2000);
        },
        error: (error) => {
          console.error('Error fixing funds:', error);
          this.error = error?.error?.message || 'Failed to fix funds';
          this.toastService.error(this.error || 'Failed to fix funds');
        }
      });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
    formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
