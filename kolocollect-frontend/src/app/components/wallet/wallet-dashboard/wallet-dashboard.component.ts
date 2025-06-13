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
  faArrowsRotate,
  faExclamationTriangle,
  faCheckCircle,
  faRedo,
  faFileDownload,
  faFilePdf,
  faSort,
  faSortUp,
  faSortDown,
  faFilter,
  faCalendar,
  faCheck,
  faHourglass
} from '@fortawesome/free-solid-svg-icons';

// Performance tracking
import { TrackComponentLifecycle, TrackPerformance } from '../../../decorators/performance.decorator';

// RxJS
import { Subject } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

@TrackComponentLifecycle('WalletDashboardComponent')
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
  faLock = faLock;  
  faEye = faEye;
  faFileInvoiceDollar = faFileInvoiceDollar;
  faArrowsRotate = faArrowsRotate;
  faExclamationTriangle = faExclamationTriangle;
  faCheckCircle = faCheckCircle;
  faRedo = faRedo;
  faFileDownload = faFileDownload;
  faFilePdf = faFilePdf;
  faSort = faSort;
  faSortUp = faSortUp;
  faSortDown = faSortDown;
  faFilter = faFilter;
  faCalendar = faCalendar;
  faCheck = faCheck;
  faHourglass = faHourglass;

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

  @TrackPerformance('WalletDashboardComponent.loadWalletData')
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
      )      .subscribe(data => {
        console.log('Raw transaction data received:', data);
        
        // Ensure all transaction data is properly formatted
        this.transactions = (data.transactions || []).map((tx: any, index: number) => {
          console.log(`Processing transaction ${index}:`, tx);
          
          // Make sure amount is a valid number
          let validAmount = 0;
          
          // First check if the amount property exists
          if (tx.amount === undefined || tx.amount === null) {
            console.warn(`Transaction ${index} missing amount property`);
          } else if (typeof tx.amount === 'object' && tx.amount.$numberDecimal) {
            // Handle MongoDB Decimal128 format
            validAmount = Number(tx.amount.$numberDecimal);
            console.log(`Transaction ${index} has Decimal128 amount: ${validAmount}`);
          } else {
            // Handle regular number format
            const parsedAmount = Number(tx.amount);
            if (isNaN(parsedAmount)) {
              console.warn(`Transaction ${index} has invalid amount: "${tx.amount}" (${typeof tx.amount})`);
            } else {
              validAmount = parsedAmount;
            }
          }
          
          // Always assign a valid amount
          tx.amount = validAmount;
          
          // Make sure date is properly formatted
          if (tx.date && !(tx.date instanceof Date)) {
            // Try to parse the date if it's a string
            if (typeof tx.date === 'string') {
              // Store the original date string
              const originalDate = tx.date;
              try {
                const parsedDate = new Date(tx.date);
                // Verify that the date is valid
                if (!isNaN(parsedDate.getTime())) {
                  tx.date = parsedDate;
                } else {
                  console.warn(`Invalid date format detected: ${originalDate}, using current date instead`);
                  tx.date = new Date(); // Fallback to current date if invalid
                }
              } catch (error) {
                console.error(`Error parsing date: ${originalDate}`, error);
                tx.date = new Date(); // Fallback to current date
              }
            } else {
              // If it's neither a Date nor a string, set to current date
              console.warn(`Unexpected date format: ${typeof tx.date}`);
              tx.date = new Date();
            }
          }
          return tx;
        });
        
        console.log('Processed Transactions:', this.transactions);
        
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
    @TrackPerformance('WalletDashboardComponent.calculateTransactionMetrics')
  calculateTransactionMetrics(): void {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);
    
    console.log('Date range for monthly calculations:', 
      { from: oneMonthAgo.toISOString(), to: currentDate.toISOString() });
    
    // Calculate monthly change
    let monthlyCreditTotal = 0;
    let monthlyDebitTotal = 0;
    
    // Calculate incoming and outgoing amounts
    let totalIncoming = 0;
    let totalOutgoing = 0;
    let totalPending = 0;
    
    if (!this.transactions || this.transactions.length === 0) {
      console.log('No transactions to calculate metrics from');
      this.monthlyChange = 0;
      this.incomingAmount = 0;
      this.outgoingAmount = 0;
      this.pendingAmount = 0;
      return;
    }
    
    console.log(`Processing ${this.transactions.length} transactions`);
    
    this.transactions.forEach((tx, index) => {
      // Skip transactions with invalid amounts
      if (tx.amount === undefined || tx.amount === null || isNaN(Number(tx.amount))) {
        console.warn(`Transaction at index ${index} has invalid amount:`, tx.amount);
        return;
      }
      
      // Ensure amount is a number
      const amount = Number(tx.amount);
      
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) {
        console.warn(`Transaction at index ${index} has invalid date:`, tx.date);
        return;
      }
      
      // Debug transaction date
      console.log(`Transaction ${index}: ${tx.type}, ${amount}, date: ${tx.date}, 
        in date range: ${txDate >= oneMonthAgo ? 'Yes' : 'No'}`);
      
      // Check if transaction is from the last month
      if (txDate >= oneMonthAgo) {
        if (['deposit', 'payout'].includes(tx.type)) {
          monthlyCreditTotal += amount;
          console.log(`Added ${amount} to credits. New total: ${monthlyCreditTotal}`);
        } else if (['withdrawal', 'contribution', 'penalty', 'transfer'].includes(tx.type)) {
          monthlyDebitTotal += amount;
          console.log(`Added ${amount} to debits. New total: ${monthlyDebitTotal}`);
        }
      }
      
      // Calculate incoming (expected money to receive)
      if (['deposit', 'payout'].includes(tx.type) && tx.status === 'pending') {
        totalIncoming += amount;
      }
      
      // Calculate outgoing (money to be paid)
      if (['withdrawal', 'contribution', 'penalty', 'transfer'].includes(tx.type) && 
          tx.status === 'pending') {
        totalOutgoing += amount;
      }
      
      // Calculate pending (all pending transactions)
      if (tx.status === 'pending') {
        totalPending += amount;
      }
    });
    
    console.log('Monthly calculation totals:', { 
      credits: monthlyCreditTotal, 
      debits: monthlyDebitTotal
    });
      this.monthlyChange = monthlyCreditTotal - monthlyDebitTotal;
    console.log('Monthly Change:', this.monthlyChange);
    
    // Ensure all final values are valid numbers
    this.monthlyChange = isNaN(this.monthlyChange) ? 0 : this.monthlyChange;
    this.incomingAmount = isNaN(totalIncoming) ? 0 : totalIncoming;
    this.outgoingAmount = isNaN(totalOutgoing) ? 0 : totalOutgoing;
    this.pendingAmount = isNaN(totalPending) ? 0 : totalPending;
    
    console.log('Final calculated metrics:', {
      monthlyChange: this.monthlyChange,
      incomingAmount: this.incomingAmount,
      outgoingAmount: this.outgoingAmount,
      pendingAmount: this.pendingAmount
    });
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
  formatCurrency(amount: number | any): string {
    let numericAmount = 0;
    
    // Handle MongoDB Decimal128 format
    if (typeof amount === 'object' && amount !== null && amount.$numberDecimal) {
      numericAmount = Number(amount.$numberDecimal);
    } 
    // Handle regular number or string
    else {
      numericAmount = Number(amount);
    }
    
    // Check if the conversion resulted in a valid number
    if (isNaN(numericAmount)) {
      console.warn('Invalid amount passed to formatCurrency:', amount);
      numericAmount = 0; // Default to 0 for invalid values
    }
    
    return new Intl.NumberFormat('en-US', { 
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numericAmount);
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