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
import { MatStepperModule } from '@angular/material/stepper';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faMoneyBillWave, 
  faArrowLeft, 
  faCreditCard, 
  faUniversity, 
  faMobileAlt, 
  faCheckCircle, 
  faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';

import { WalletService } from '../../../services/wallet.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { WalletDashboardComponent } from '../wallet-dashboard/wallet-dashboard.component';

interface WithdrawalMethod {
  id: string;
  name: string;
  icon: any;
}

@Component({
  selector: 'app-withdraw-funds',
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
    MatStepperModule,
    FontAwesomeModule,
    RouterModule
  ],
  templateUrl: './withdraw-funds.component.html',
  styleUrls: ['./withdraw-funds.component.scss']
})
export class WithdrawFundsComponent implements OnInit, OnDestroy {
  // Icons
  faMoneyBillWave = faMoneyBillWave;
  faArrowLeft = faArrowLeft;
  faCreditCard = faCreditCard;
  faUniversity = faUniversity;
  faMobileAlt = faMobileAlt;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;

  withdrawalForm: FormGroup;
  bankDetailsForm: FormGroup;
  mobileMoneyForm: FormGroup;
  cardDetailsForm: FormGroup;
  
  userId: string | undefined;
  isLoading = false;
  error: string | null = null;
  isSuccess = false;
  availableBalance = 0;
  
  withdrawalMethods: WithdrawalMethod[] = [
    { id: 'bank_account', name: 'Bank Account', icon: this.faUniversity },
    { id: 'mobile_money', name: 'Mobile Money', icon: this.faMobileAlt },
    { id: 'card', name: 'Debit Card', icon: this.faCreditCard }
  ];
  
  selectedWithdrawalMethod = 'bank_account';
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router
  ) {
    this.withdrawalForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(10)]],
      withdrawalMethod: ['bank_account', Validators.required]
    });
    
    this.bankDetailsForm = this.fb.group({
      accountName: ['', Validators.required],
      accountNumber: ['', [Validators.required, Validators.pattern('^[0-9]{8,17}$')]],
      bankName: ['', Validators.required],
      routingNumber: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]]
    });
    
    this.mobileMoneyForm = this.fb.group({
      phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9]{10,12}$')]],
      provider: ['', Validators.required]
    });
    
    this.cardDetailsForm = this.fb.group({
      cardholderName: ['', Validators.required],
      cardNumber: ['', [Validators.required, Validators.pattern('^[0-9]{16}$')]],
      expiryDate: ['', [Validators.required, Validators.pattern('^(0[1-9]|1[0-2])/[0-9]{2}$')]],
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
    
    // Subscribe to withdrawal method changes
    this.withdrawalForm.get('withdrawalMethod')?.valueChanges.subscribe((method) => {
      this.selectedWithdrawalMethod = method;
    });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  getWithdrawalMethodName(methodId: string): string {
    const method = this.withdrawalMethods.find(m => m.id === methodId);
    return method ? method.name : '';
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

  onSubmit(): void {
    if (this.withdrawalForm.invalid) {
      this.toastService.error('Please fill in the amount and select a withdrawal method');
      return;
    }
    
    // Get the applicable details form based on the selected method
    let detailsForm: FormGroup;
    switch (this.selectedWithdrawalMethod) {
      case 'bank_account':
        detailsForm = this.bankDetailsForm;
        break;
      case 'mobile_money':
        detailsForm = this.mobileMoneyForm;
        break;
      case 'card':
        detailsForm = this.cardDetailsForm;
        break;
      default:
        this.toastService.error('Invalid withdrawal method selected');
        return;
    }
    
    if (detailsForm.invalid) {
      this.toastService.error('Please fill in all required fields correctly');
      return;
    }
    
    const { amount, withdrawalMethod } = this.withdrawalForm.value;
    
    // Check if sufficient balance
    if (amount > this.availableBalance) {
      this.error = 'Insufficient balance for this withdrawal';
      this.toastService.error(this.error);
      return;
    }
    
    this.isLoading = true;
    this.loadingService.start('withdraw-funds');
    this.error = null;
    
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.isLoading = false;
      this.loadingService.stop('withdraw-funds');
      return;
    }
    
    // Prepare destination details based on the withdrawal method
    const destinationDetails = this.getDestinationDetails();
      this.walletService.withdrawFunds({
      userId: this.userId as string,
      amount: amount,
      destination: JSON.stringify({
        type: withdrawalMethod,
        details: destinationDetails
      })
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('withdraw-funds');
      })
    ).subscribe({
      next: (response) => {
        this.toastService.success(`Withdrawal request of ${this.formatCurrency(amount)} submitted`);
        this.isSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/wallet']);
        }, 2000);
      },
      error: (error) => {        this.error = error?.error?.message || 'Failed to process withdrawal';
        this.toastService.error(this.error || 'Failed to process withdrawal');
      }
    });
  }
  
  getDestinationDetails(): any {
    switch (this.selectedWithdrawalMethod) {
      case 'bank_account':
        return this.bankDetailsForm.value;
      case 'mobile_money':
        return this.mobileMoneyForm.value;
      case 'card':
        return this.cardDetailsForm.value;
      default:
        return {};
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
}
