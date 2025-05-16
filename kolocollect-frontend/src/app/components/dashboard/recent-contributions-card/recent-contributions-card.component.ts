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
  selector: 'app-recent-contributions-card',
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
  templateUrl: './recent-contributions-card.component.html',
  styleUrl: './recent-contributions-card.component.scss'
})
export class RecentContributionsCardComponent implements OnInit {
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
  @Input() recentContributions: Array<{
    id: string;
    communityName: string;
    amount: number;
    date: Date;
    status: string;
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
}
