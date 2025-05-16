import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faWallet, 
  faPlus, 
  faMinus, 
  faMoneyBill, 
  faBell, 
  faCheck, 
  faInfoCircle, 
  faExclamationTriangle,
  faUsers,
  faMoneyBillWave,
  faEye,
  faReceipt,
  faUserPlus,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { WalletService } from '../../../services/wallet.service';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-financial-summary-card',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule,
    MatIconModule,MatDividerModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatChipsModule,
    MatBadgeModule, RouterModule, FontAwesomeModule,
  ],
  templateUrl: './financial-summary-card.component.html',
  styleUrl: './financial-summary-card.component.scss'
})
export class FinancialSummaryCardComponent implements OnInit {

  // FontAwesome icons
  faWallet = faWallet;
  faPlus = faPlus;
  faMinus = faMinus;
  faMoneyBill = faMoneyBill;
  faBell = faBell;
  faCheck = faCheck;  
  faInfoCircle = faInfoCircle;
  faExclamationTriangle = faExclamationTriangle;
  faUsers = faUsers;
  faMoneyBillWave = faMoneyBillWave;
  faEye = faEye;
  faReceipt = faReceipt;
  faUserPlus = faUserPlus;
  faSpinner = faSpinner;

  // Input properties
  @Input() isLoading: boolean = true;
  @Input() currentUser: User | null = null;
  @Input() walletBalance = {
    availableBalance: 0,
    fixedBalance: 0,
    totalBalance: 0
  };

  constructor(
    private authService: AuthService,
    private walletService: WalletService
  ) {}

  ngOnInit(): void {
    // If wallet balance is not provided, load it automatically
    if (this.walletBalance.availableBalance === 0 && 
        this.walletBalance.fixedBalance === 0 && 
        this.walletBalance.totalBalance === 0) {
      
      // First, get the current user if it's not provided
      if (!this.currentUser) {
        this.authService.currentUser$.subscribe(user => {
          this.currentUser = user;
          if (user) {
            this.loadWalletData();
          }
        });
      } else {
        this.loadWalletData();
      }
    } else {
      // If wallet balance is already provided, we're not loading
      this.isLoading = false;
    }
  }

  loadWalletData(): void {
    if (!this.currentUser?.id) {
      console.error('Cannot load wallet data: No current user ID');
      this.isLoading = false;
      return;
    }    

    this.isLoading = true;
    
    this.walletService.getWalletBalance(this.currentUser.id)
      .pipe(
        catchError(error => {
          console.error('Error fetching wallet balance:', error);
          return of({
            availableBalance: 0,
            fixedBalance: 0,
            totalBalance: 0
          });
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe(balance => {
        this.walletBalance = balance;
      });
  }
}
