import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faExchangeAlt, 
  faArrowLeft, 
  faSearch, 
  faUser, 
  faCheckCircle, 
  faExclamationTriangle,
  faUserCircle
} from '@fortawesome/free-solid-svg-icons';

import { WalletService } from '../../../services/wallet.service';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

import { Observable, Subject, of } from 'rxjs';
import { takeUntil, finalize, debounceTime, switchMap, catchError, tap, map } from 'rxjs/operators';

/**
 * Interface representing a user search result
 * Used for recipient search in the transfer-funds component
 */
interface UserSearchResult {
  id: string;          // User's unique identifier
  name: string;        // User's display name
  email: string;       // User's email address (used for transfer if no ID provided)
  avatarUrl?: string;  // Optional user avatar URL
}

@Component({
  selector: 'app-transfer-funds',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatAutocompleteModule,
    FontAwesomeModule,
    RouterModule
  ],
  templateUrl: './transfer-funds.component.html',
  styleUrls: ['./transfer-funds.component.scss']
})
export class TransferFundsComponent implements OnInit, OnDestroy {
  // Icons
  faExchangeAlt = faExchangeAlt;
  faArrowLeft = faArrowLeft;
  faSearch = faSearch;
  faUser = faUser;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faUserCircle = faUserCircle;
  transferForm: FormGroup;
  userId: string | undefined;
  isLoading = false;
  isSearchLoading = false;
  error: string | null = null;
  isSuccess = false;
  availableBalance = 0;
    filteredUsers: UserSearchResult[] = [];
  selectedUser: UserSearchResult | null = null;
  
  private destroy$ = new Subject<void>();
  private lastSearchQuery: string = '';
  private skipNextSearch: boolean = false;
  
  constructor(
    private fb: FormBuilder,
    private walletService: WalletService,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private router: Router
  ) {
    this.transferForm = this.fb.group({
      recipientEmail: ['', [Validators.required, Validators.email]],
      amount: ['', [Validators.required, Validators.min(1)]],
      description: ['', [Validators.maxLength(100)]]
    });
  }
  ngOnInit(): void {
    this.userId = this.authService.currentUserValue?.id;
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadWalletBalance();    // Setup user search with debounce
    this.transferForm.get('recipientEmail')?.valueChanges.pipe(
      debounceTime(500), // Increased debounce time
      tap((value) => {
        // Skip search if we just auto-selected a user to prevent loop
        if (this.skipNextSearch) {
          this.skipNextSearch = false;
          this.isSearchLoading = false;
          return;
        }
        
        // Reset selection when input changes
        if (this.selectedUser && this.selectedUser.email !== value) {
          this.selectedUser = null;
        }
        
        this.error = null;
      }),
      switchMap(value => {
        // Don't search if value is empty or too short
        if (!value || value.length < 3) {
          this.isSearchLoading = false;
          return of([]);
        }
        
        // Skip if this is the same query we just searched for
        if (value === this.lastSearchQuery) {
          this.isSearchLoading = false;
          return of(this.filteredUsers); // Return cached results
        }
        
        // Update last search query
        this.lastSearchQuery = value;
        this.isSearchLoading = true;
        
        return this.userService.searchUsers(value).pipe(
          catchError((err) => {
            console.error('Error searching users:', err);
            this.error = 'Failed to search users. Please try typing a full email address';
            return of([]);
          }),
          finalize(() => this.isSearchLoading = false)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(users => {
      if (!users) {
        this.filteredUsers = [];
        return;
      }
      
      this.filteredUsers = users;
      
      // Only auto-select if we have exactly one result that matches the current input exactly
      const currentInput = this.transferForm.get('recipientEmail')?.value;
      if (this.filteredUsers.length === 1 && !this.selectedUser) {
        if (this.filteredUsers[0].email.toLowerCase() === currentInput.toLowerCase()) {
          // Set flag to skip next search (which would be triggered by setValue)
          this.skipNextSearch = true;
          this.selectUser(this.filteredUsers[0]);
        }
      } else if (this.filteredUsers.length === 0 && currentInput && currentInput.includes('@')) {
        // If no users found but input looks like an email, show a message
        this.error = `No user found with email ${currentInput}`;
      }
    });
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
  selectUser(user: UserSearchResult): void {
    this.selectedUser = user;
    
    // Update the form value without triggering another search
    const emailControl = this.transferForm.get('recipientEmail');
    if (emailControl) {
      emailControl.setValue(user.email, { emitEvent: false });
      // Store this as the last search query to prevent redundant searches
      this.lastSearchQuery = user.email;
    }
  }
  onSubmit(): void {
    if (this.transferForm.invalid) {
      this.toastService.error('Please fix the errors in the form');
      return;
    }
    
    const { recipientEmail, amount, description } = this.transferForm.value;
    
    // Check if sufficient balance
    if (amount > this.availableBalance) {
      this.error = 'Insufficient balance for this transfer';
      this.toastService.error(this.error);
      return;
    }
    
    this.isLoading = true;
    this.loadingService.start('transfer-funds');
    this.error = null;
    
    if (!this.userId) {
      this.toastService.error('User information not found');
      this.isLoading = false;
      this.loadingService.stop('transfer-funds');
      return;
    }

    // Prepare transfer data
    const transferData: any = {
      userId: this.userId as string,
      amount: amount,
      description: description || `Transfer to ${recipientEmail}`
    };
    
    // Add recipient information - prioritize selectedUser.id if available
    if (this.selectedUser && this.selectedUser.id) {
      transferData.recipientId = this.selectedUser.id;
    } else {
      transferData.recipientEmail = recipientEmail;
    }
      
    this.walletService.transferFunds(transferData).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.loadingService.stop('transfer-funds');
      })
    ).subscribe({
      next: (response) => {
        this.toastService.success(`Successfully transferred ${this.formatCurrency(amount)} to ${recipientEmail}`);
        this.isSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/wallet']);
        }, 2000);
      },
      error: (error) => {
        this.error = error?.error?.message || 'Failed to transfer funds';
        this.toastService.error(this.error || 'Failed to transfer funds');
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
