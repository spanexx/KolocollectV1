import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { User } from '../../../models/user.model';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
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
  faUserPlus,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-notifications-card',
  standalone: true,
  imports: [CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatBadgeModule,
    RouterModule,
    FontAwesomeModule],
  templateUrl: './notifications-card.component.html',
  styleUrl: './notifications-card.component.scss'
})
export class NotificationsCardComponent implements OnInit {

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
  @Input() currentUser: User | null = null;
  @Input() notifications: Array<{
    id: string;
    message: string;
    date: Date;
    type: string;
    read: boolean;
  }> = [];
  @Input() notificationCount: number = 0;

  // Output events
  @Output() markAllRead = new EventEmitter<void>();

  constructor(
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    // Component initialization logic if needed
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

    getNotificationClass(type: string): string {
    return `notification-${type}`;
  }    markAllNotificationsAsRead(): void {
    if (!this.currentUser?.id || this.notifications.length === 0) {
      return;
    }
    
    // Emit the event to the parent component
    this.markAllRead.emit();
  }
}
        
