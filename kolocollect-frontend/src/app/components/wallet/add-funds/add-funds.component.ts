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

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faMoneyBillWave, 
  faArrowLeft, 
  faCreditCard, 
  faWallet, 
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

@Component({
  selector: 'app-add-funds',
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
    FontAwesomeModule,
    RouterModule
  ],
  templateUrl: './add-funds.component.html',
  styleUrls: ['./add-funds.component.scss']
})
export class AddFundsComponent implements OnInit, OnDestroy {
  // Icons
  faMoneyBillWave = faMoneyBillWave;
  faArrowLeft = faArrowLeft;
  faCreditCard = faCreditCard;
  faWallet = faWallet;
  faMobileAlt = faMobileAlt;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;

  addFundsForm: FormGroup;
  userId: string | undefined;
  isLoading = false;
  error: string | null = null;
  isSuccess = false;
  
  paymentMethods = [
    { id: 'credit_card', name: 'Credit Card', icon: this.faCreditCard },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: this.faWallet },
    { id: 'mobile_money', name: 'Mobile Money', icon: this.faMobileAlt }
  ];
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router
  ) {
    this.addFundsForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      paymentMethod: ['credit_card', Validators.required],
      savePaymentMethod: [false]
    });
  }

  ngOnInit(): void {
    this.userId = this.authService.currentUserValue?.id;
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (this.addFundsForm.invalid) {
      this.toastService.error('Please fix the errors in the form');
      return;
    }
    
    this.isLoading = true;
    this.loadingService.start('add-funds');
    this.error = null;
    
    const { amount, paymentMethod } = this.addFundsForm.value;
    
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.isLoading = false;
      this.loadingService.stop('add-funds');
      return;
    }
      this.walletService.addFunds({
      userId: this.userId as string,
      amount: amount,
      source: paymentMethod
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('add-funds');
      })
    ).subscribe({
      next: (response) => {
        this.toastService.success(`Successfully added ${amount} to your wallet`);
        this.isSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/wallet']);
        }, 2000);
      },
      error: (error) => {        this.error = error?.error?.message || 'Failed to add funds to wallet';
        this.toastService.error(this.error || 'Failed to add funds to wallet');
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
}
