import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faHistory, 
  faArrowLeft, 
  faFilter, 
  faPlus, 
  faMinus, 
  faExchangeAlt, 
  faPiggyBank, 
  faMoneyBillWave, 
  faFileInvoiceDollar,
  faLock,
  faWallet,
  faFileDownload,
  faFilePdf,
  faCalendarAlt,
  faSearch,
  faUndo,
  faSort,
  faSortUp,
  faSortDown,
  faTimes,
  faCheck,
  faExclamationTriangle,
  faHourglass
} from '@fortawesome/free-solid-svg-icons';

import { WalletService } from '../../../services/wallet.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

import { Transaction, TransactionType } from '../../../models/wallet.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-transaction-history',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSliderModule,
    MatExpansionModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    FontAwesomeModule,
    RouterModule
  ],
  templateUrl: './transaction-history.component.html',
  styleUrls: ['./transaction-history.component.scss']
})
export class TransactionHistoryComponent implements OnInit, OnDestroy {
  // Icons
  faHistory = faHistory;
  faArrowLeft = faArrowLeft;
  faFilter = faFilter;
  faPlus = faPlus;
  faMinus = faMinus;
  faExchangeAlt = faExchangeAlt;
  faPiggyBank = faPiggyBank;
  faMoneyBillWave = faMoneyBillWave;
  faFileInvoiceDollar = faFileInvoiceDollar;
  faLock = faLock;
  faWallet = faWallet;
  faFileDownload = faFileDownload;
  faFilePdf = faFilePdf;
  faCalendarAlt = faCalendarAlt;
  faSearch = faSearch;
  faUndo = faUndo;
  faSort = faSort;
  faSortUp = faSortUp;
  faSortDown = faSortDown;
  faTimes = faTimes;
  faCheck = faCheck;
  faExclamationTriangle = faExclamationTriangle;
  faHourglass = faHourglass;

  // Data properties
  transactions: Transaction[] = [];
  userId: string | undefined;
  isLoading = false;
  error: string | null = null;
  
  // Pagination
  totalTransactions = 0;
  pageSize = 10;
  pageIndex = 0;
  
  // Sorting
  sortField = 'date';
  sortDirection = 'desc';

  // Filter form
  filterForm: FormGroup;
  filterExpanded = false;
  isFilterApplied = false;

  // Table columns
  displayedColumns: string[] = ['type', 'description', 'amount', 'date', 'status'];

  // Filter options
  transactionTypes = [
    { value: 'deposit', label: 'Deposits', icon: this.faPlus },
    { value: 'withdrawal', label: 'Withdrawals', icon: this.faMinus },
    { value: 'contribution', label: 'Contributions', icon: this.faPiggyBank },
    { value: 'payout', label: 'Payouts', icon: this.faMoneyBillWave },
    { value: 'penalty', label: 'Penalties', icon: this.faFileInvoiceDollar },
    { value: 'transfer', label: 'Transfers', icon: this.faExchangeAlt },
    { value: 'fix-funds', label: 'Fixed Funds', icon: this.faLock },
    { value: 'release-fixed-funds', label: 'Released Funds', icon: this.faWallet }
  ];

  transactionStatuses = [
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' }
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
    this.filterForm = this.fb.group({
      type: [[]],
      status: [[]],
      dateFrom: [null],
      dateTo: [null],
      minAmount: [null],
      maxAmount: [null],
      search: ['']
    });
  }

  ngOnInit(): void {
    this.userId = this.authService.currentUserValue?.id;
    if (this.userId) {
      this.loadTransactions();
    } else {
      this.toastService.error('User information not found');
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTransactions(): void {
    if (!this.userId) return;
    
    this.isLoading = true;
    this.loadingService.start('load-transactions');
    this.error = null;
    
    // Prepare filter params
    const params: any = {
      page: this.pageIndex + 1, // API is 1-based, Material is 0-based
      limit: this.pageSize,
      sort: this.sortField,
      order: this.sortDirection
    };
    
    // Add filter params if they exist
    const filterValues = this.filterForm.value;
    
    if (filterValues.type && filterValues.type.length) {
      params.type = filterValues.type;
    }
    
    if (filterValues.status && filterValues.status.length) {
      params.status = filterValues.status;
    }
    
    if (filterValues.dateFrom) {
      params.dateFrom = filterValues.dateFrom.toISOString();
    }
    
    if (filterValues.dateTo) {
      params.dateTo = filterValues.dateTo.toISOString();
    }
    
    if (filterValues.minAmount !== null && filterValues.minAmount !== undefined) {
      params.minAmount = filterValues.minAmount;
    }
    
    if (filterValues.maxAmount !== null && filterValues.maxAmount !== undefined) {
      params.maxAmount = filterValues.maxAmount;
    }
    
    if (filterValues.search && filterValues.search.trim()) {
      params.search = filterValues.search.trim();
    }

    this.walletService.getTransactionHistory(this.userId as string, params)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.loadingService.stop('load-transactions');
        })
      )
      .subscribe({
        next: (data) => {
          console.log('Transaction data:', data);
          this.transactions = data.transactions || [];
          this.totalTransactions = data.total || 0;
        },
        error: (error) => {          this.error = error?.error?.message || 'Failed to load transaction history';
          this.toastService.error(this.error || 'Failed to load transaction history');
        }
      });
  }

  applyFilter(): void {
    this.pageIndex = 0; // Reset to first page when filtering
    this.isFilterApplied = true;
    this.loadTransactions();
  }

  resetFilter(): void {
    this.filterForm.reset({
      type: [],
      status: [],
      dateFrom: null,
      dateTo: null,
      minAmount: null,
      maxAmount: null,
      search: ''
    });
    this.isFilterApplied = false;
    this.pageIndex = 0;
    this.loadTransactions();
  }

  toggleFilterPanel(): void {
    this.filterExpanded = !this.filterExpanded;
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.loadTransactions();
  }

  onSortChange(sort: Sort): void {
    this.sortField = sort.active;
    this.sortDirection = sort.direction || 'desc';
    this.loadTransactions();
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
    downloadTransactions(format: 'csv' | 'pdf'): void {
    if (!this.userId) return;
    
    this.loadingService.start(`download-transactions-${format}`);
    
    // Get the current filter parameters to apply to the download
    const params: any = { format };
    
    // Add filter params if they exist
    const filterValues = this.filterForm.value;
    
    if (filterValues.type && filterValues.type.length) {
      params.type = filterValues.type;
    }
    
    if (filterValues.status && filterValues.status.length) {
      params.status = filterValues.status;
    }
    
    if (filterValues.dateFrom) {
      params.dateFrom = filterValues.dateFrom.toISOString();
    }
    
    if (filterValues.dateTo) {
      params.dateTo = filterValues.dateTo.toISOString();
    }
    
    if (filterValues.minAmount !== null && filterValues.minAmount !== undefined) {
      params.minAmount = filterValues.minAmount;
    }
    
    if (filterValues.maxAmount !== null && filterValues.maxAmount !== undefined) {
      params.maxAmount = filterValues.maxAmount;
    }
    
    if (filterValues.search && filterValues.search.trim()) {
      params.search = filterValues.search.trim();
    }
    
    this.walletService.downloadTransactions(this.userId as string, params)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingService.stop(`download-transactions-${format}`);
        })
      )      .subscribe({
        next: (response: any) => {
          try {
            // Check if response is valid
            if (!response) {
              throw new Error('Empty response received');
            }
            
            // Create a blob from the response
            const blob = new Blob([response], { 
              type: format === 'csv' ? 'text/csv' : 'application/pdf' 
            });
            
            // Verify the blob has content
            if (blob.size === 0) {
              throw new Error('Downloaded file is empty');
            }
            
            // Create a link element and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style.display = 'none';
            a.href = url;
            a.download = `wallet-transactions.${format}`;
            a.click();
            
            window.URL.revokeObjectURL(url);
            this.toastService.success(`Transactions downloaded as ${format.toUpperCase()}`);
          } catch (err) {
            console.error('Error processing download:', err);
            this.toastService.error(`Failed to process download: ${(err as any)?.message || 'Unknown error'}`);
          }
        },
        error: (error) => {
          console.error('Download error:', error);
          this.toastService.error(`Failed to download transactions: ${error?.error?.message || error?.message || 'Unknown error'}`);
        }
      });
  }
}
