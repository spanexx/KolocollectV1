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

@Component({
  selector: 'app-upcoming-payouts-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    RouterModule,
    FontAwesomeModule
  ],
  templateUrl: './upcoming-payouts-card.component.html',
  styleUrl: './upcoming-payouts-card.component.scss'
})
export class UpcomingPayoutsCardComponent implements OnInit {
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
  @Input() isLoading: boolean = false;
  @Input() upcomingPayouts: Array<{
    id: string;
    communityId: string;
    communityName: string;
    amount: number;
    date: Date;
    position?: number | null;
    isNextInLine?: boolean;
  }> = [];

  constructor() {}

  ngOnInit(): void {
    // Component initialization logic if needed
  }

  /**
   * Format a date for display
   */
  formatDate(date: Date | null | string): string {
    if (!date) return 'N/A';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      return d.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short', 
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Error';
    }
  }

  /**
   * Get days remaining until a date
   * @param date The target date to calculate days until
   * @returns Number of days remaining (always >= 0)
   */
  getDaysRemaining(date: Date | null): number {
    if (!date) {
      return 0;
    }
    
    try {
      // Validate the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date passed to getDaysRemaining');
        return 0;
      }
      
      const now = new Date();
      // Strip time information from both dates for accurate day calculation
      const payoutDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Calculate difference in days
      const diffTime = payoutDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Return max of 0 days (don't show negative days)
      return Math.max(0, diffDays);
    } catch (error) {
      console.error('Error calculating days remaining:', error);
      return 0;
    }
  }
}
