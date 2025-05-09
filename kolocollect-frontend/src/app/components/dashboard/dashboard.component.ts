import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

// Import FontAwesome
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
  faUserPlus
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatBadgeModule,
    RouterModule,
    FontAwesomeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
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

  // User data
  currentUser: User | null = null;
  
  // Financial overview
  walletBalance = {
    available: 0,
    fixed: 0,
    total: 0
  };

  // Communities
  communities = [
    {
      id: '1',
      name: 'Monthly Savings Group',
      members: 8,
      contribution: 100,
      frequency: 'Monthly',
      nextPayout: new Date(2025, 4, 15)
    },
    {
      id: '2',
      name: 'Emergency Fund',
      members: 12,
      contribution: 50,
      frequency: 'Weekly',
      nextPayout: new Date(2025, 4, 10)
    },
    {
      id: '3',
      name: 'School Fees',
      members: 5,
      contribution: 200,
      frequency: 'Monthly',
      nextPayout: new Date(2025, 5, 1)
    }
  ];

  // Recent activity
  recentContributions = [
    {
      id: '101',
      communityName: 'Monthly Savings Group',
      amount: 100,
      date: new Date(2025, 4, 1),
      status: 'completed'
    },
    {
      id: '102',
      communityName: 'Emergency Fund',
      amount: 50,
      date: new Date(2025, 4, 3),
      status: 'completed'
    }
  ];

  // Upcoming payouts
  upcomingPayouts = [
    {
      id: '201',
      communityName: 'Emergency Fund',
      amount: 600,
      date: new Date(2025, 4, 10)
    },
    {
      id: '202',
      communityName: 'Monthly Savings Group',
      amount: 800,
      date: new Date(2025, 4, 15)
    }
  ];

  // Notifications
  notifications = [
    {
      id: '301',
      message: 'Your contribution to Emergency Fund is due tomorrow',
      type: 'warning',
      date: new Date(2025, 4, 6)
    },
    {
      id: '302',
      message: 'You received a payout of $600 from School Fees',
      type: 'success',
      date: new Date(2025, 4, 5)
    },
    {
      id: '303',
      message: 'Monthly Savings Group cycle will complete in 10 days',
      type: 'info',
      date: new Date(2025, 4, 4)
    }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Get current user data
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadDashboardData();
      }
    });
  }

  loadDashboardData(): void {
    // In a real implementation, we would fetch data from services
    // For now, we're using the mock data defined above
    
    // Example of how to fetch data from services once implemented:
    /*
    this.walletService.getWalletBalance(this.currentUser.id).subscribe(balance => {
      this.walletBalance = balance;
    });
    
    this.communityService.getUserCommunities(this.currentUser.id).subscribe(communities => {
      this.communities = communities;
    });
    
    this.contributionService.getRecentContributions(this.currentUser.id).subscribe(contributions => {
      this.recentContributions = contributions;
    });
    
    this.payoutService.getUpcomingPayouts(this.currentUser.id).subscribe(payouts => {
      this.upcomingPayouts = payouts;
    });
    
    this.userService.getUserNotifications(this.currentUser.id).subscribe(notifications => {
      this.notifications = notifications;
    });
    */
  }

  // Helper methods for the template
  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }
  
  getNotificationIcon(type: string): string {
    switch (type) {
      case 'warning': return 'warning';
      case 'success': return 'check_circle';
      case 'info': return 'info';
      case 'error': return 'error';
      default: return 'notifications';
    }
  }

  getFaNotificationIcon(type: string): any {
    switch (type) {
      case 'warning': return this.faExclamationTriangle;
      case 'success': return this.faCheck;
      case 'info': return this.faInfoCircle;
      case 'error': return this.faExclamationTriangle;
      default: return this.faBell;
    }
  }
  
  getNotificationClass(type: string): string {
    return `notification-${type}`;
  }
  
  getDaysRemaining(date: Date): number {
    const today = new Date();
    const timeDiff = date.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
}