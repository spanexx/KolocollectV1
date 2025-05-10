import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// Import Services
import { WalletService } from '../../../services/wallet.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';

// Import Models
import { 
  Wallet, 
  Transaction, 
  TransactionType, 
  FixedFund 
} from '../../../models/wallet.model';

// Import FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faWallet,
  faMoneyBillWave,
  faCreditCard,
  faExchangeAlt,
  faHistory,
  faPlus,
  faMinus,
  faChevronRight,
  faPiggyBank,
  faLock,
  faEye,
  faFileInvoiceDollar,
  faArrowsRotate
} from '@fortawesome/free-solid-svg-icons';

// RxJS
import { Subject } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-wallet-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatTabsModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressBarModule,
    FontAwesomeModule
  ],
  templateUrl: './wallet-dashboard.component.html',
  styleUrls: ['./wallet-dashboard.component.scss']
})
export class WalletDashboardComponent implements OnInit, OnDestroy {
  // FontAwesome icons
  faWallet = faWallet;
  faMoneyBillWave = faMoneyBillWave;
  faCreditCard = faCreditCard;
  faExchangeAlt = faExchangeAlt;
  faHistory = faHistory;
  faPlus = faPlus;
  faMinus = faMinus;
  faChevronRight = faChevronRight;
  faPiggyBank = faPiggyBank;
  faLock = faLock;  faEye = faEye;
  faFileInvoiceDollar = faFileInvoiceDollar;
  faArrowsRotate = faArrowsRotate;

  // Data properties
  wallet: any = null;
  availableBalance: number = 0;
  fixedBalance: number = 0;
  totalBalance: number = 0;
  transactions: Transaction[] = [];
  fixedFunds: FixedFund[] = [];
  userId: string | undefined;
  isLoading: boolean = false;
  error: string | null = null;
  monthlyChange: number = 0;
  incomingAmount: number = 0;
  outgoingAmount: number = 0;
  pendingAmount: number = 0;
  
  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private walletService: WalletService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.userId = this.authService.currentUserValue?.id;
    if (this.userId) {
      this.loadWalletData();
    } else {
      this.toastService.error('User information not found');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWalletData(): void {
    if (!this.userId) return;
    
    this.isLoading = true;
    this.loadingService.start('load-wallet');
    this.error = null; // Reset error state when reloading

    // Get wallet balance
    this.walletService.getWalletBalance(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.error = error?.error?.message || 'Failed to load wallet balance';
          this.toastService.error(this.error || 'Unknown error occurred');
          this.isLoading = false;
          this.loadingService.stop('load-wallet');
          throw error;
        }),
        finalize(() => {
          // This finalize is just for the balance call
          // We'll set isLoading to false after all data is loaded
        })
      )
      .subscribe(data => {
        this.availableBalance = data.availableBalance || 0;
        this.fixedBalance = data.fixedBalance || 0;
        this.totalBalance = data.totalBalance || 0;
        
        // After getting balance, load transactions
        this.loadTransactionHistory();
      });
  }

  loadTransactionHistory(): void {
    if (!this.userId) return;
    
    this.walletService.getTransactionHistory(this.userId, { limit: 10 })
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.error = error?.error?.message || 'Failed to load transaction history';
          this.toastService.error(this.error || 'Unknown error occurred');
          this.isLoading = false;
          this.loadingService.stop('load-wallet');
          throw error;
        }),
        finalize(() => {
          // This finalize is just for the transactions call
          // Load fixed funds next
          this.loadFixedFunds();
        })
      )
      .subscribe(data => {
        this.transactions = data || [];
        
        // Calculate monthly metrics from transactions
        this.calculateTransactionMetrics();
      });
  }

  loadFixedFunds(): void {
    if (!this.userId) return;
    
    this.walletService.getFixedFunds(this.userId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.error = error?.error?.message || 'Failed to load fixed funds';
          this.toastService.error(this.error || 'Unknown error occurred');
          this.isLoading = false;
          this.loadingService.stop('load-wallet');
          throw error;
        }),
        finalize(() => {
          this.isLoading = false;
          this.loadingService.stop('load-wallet');
        })
      )
      .subscribe(data => {
        this.fixedFunds = data || [];
      });
  }
  
  calculateTransactionMetrics(): void {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);
    
    // Calculate monthly change
    let monthlyCreditTotal = 0;
    let monthlyDebitTotal = 0;
    
    // Calculate incoming and outgoing amounts
    let totalIncoming = 0;
    let totalOutgoing = 0;
    let totalPending = 0;
    
    this.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      
      // Check if transaction is from the last month
      if (txDate >= oneMonthAgo) {
        if (['deposit', 'payout'].includes(tx.type)) {
          monthlyCreditTotal += tx.amount;
        } else if (['withdrawal', 'contribution', 'penalty', 'transfer'].includes(tx.type)) {
          monthlyDebitTotal += tx.amount;
        }
      }
      
      // Calculate incoming (expected money to receive)
      if (['deposit', 'payout'].includes(tx.type) && tx.status === 'pending') {
        totalIncoming += tx.amount;
      }
      
      // Calculate outgoing (money to be paid)
      if (['withdrawal', 'contribution', 'penalty', 'transfer'].includes(tx.type) && 
          tx.status === 'pending') {
        totalOutgoing += tx.amount;
      }
      
      // Calculate pending (all pending transactions)
      if (tx.status === 'pending') {
        totalPending += tx.amount;
      }
    });
    
    this.monthlyChange = monthlyCreditTotal - monthlyDebitTotal;
    this.incomingAmount = totalIncoming;
    this.outgoingAmount = totalOutgoing;
    this.pendingAmount = totalPending;
  }
  
  getTransactionIcon(type: TransactionType): any {
    switch(type) {
      case 'deposit': return this.faPlus;
      case 'withdrawal': return this.faMinus;
      case 'contribution': return this.faPiggyBank;
      case 'payout': return this.faMoneyBillWave;
      case 'penalty': return this.faFileInvoiceDollar;
      case 'transfer': return this.faExchangeAlt;
      case 'fix-funds': return this.faLock;
      case 'release-fixed-funds': return this.faWallet;
      default: return this.faWallet;
    }
  }
  
  getTransactionClass(type: TransactionType): string {
    switch(type) {
      case 'deposit': 
      case 'payout': 
      case 'release-fixed-funds':
        return 'deposit';
      case 'withdrawal': 
      case 'penalty': 
        return 'withdrawal';
      case 'contribution':
        return 'contribution';
      case 'transfer':
        return 'transfer';
      case 'fix-funds':
        return 'fixed';
      default:
        return '';
    }
  }
  
  isPositiveTransaction(type: TransactionType): boolean {
    return ['deposit', 'payout', 'release-fixed-funds'].includes(type);
  }
  
  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
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
  
  getRemainingDays(endDate: Date | string): number {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Calculate the progress percentage for a fixed fund
   * @param startDate When the fund was fixed
   * @param endDate When the fund will be available
   * @returns Progress percentage (0-100)
   */
  getFundProgress(startDate: Date | string, endDate: Date | string): number {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    // Calculate total duration and elapsed time
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    // Calculate progress percentage
    let progress = (elapsed / totalDuration) * 100;
    
    // Ensure the progress is between 0 and 100
    progress = Math.max(0, Math.min(100, progress));
    
    return progress;
  }
  
  /**
   * Release a fixed fund that has matured
   * @param fundId ID of the fixed fund to release
   */
  releaseFund(fundId: string): void {
    if (!this.userId || !fundId) {
      this.toastService.error('Unable to process request');
      return;
    }
    
    this.loadingService.start('release-fund');
    
    this.walletService.releaseFixedFund(this.userId, fundId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          const errorMsg = error?.error?.message || 'Failed to release fixed fund';
          this.toastService.error(errorMsg);
          this.loadingService.stop('release-fund');
          throw error;
        }),
        finalize(() => {
          this.loadingService.stop('release-fund');
        })
      )
      .subscribe(() => {
        this.toastService.success('Funds released successfully');
        // Reload wallet data to reflect the changes
        this.loadWalletData();
      });
  }
}