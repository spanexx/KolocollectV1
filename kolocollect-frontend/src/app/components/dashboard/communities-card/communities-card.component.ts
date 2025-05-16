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

@Component({
  selector: 'app-communities-card',
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
  templateUrl: './communities-card.component.html',
  styleUrl: './communities-card.component.scss'
})
export class CommunitiesCardComponent implements OnInit {
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
  @Input() communities: Array<{
    id: {
      _id: string;
      name: string;
      description: string;
    }
    isAdmin: boolean;
    _id?: string;
  }> = [];

  constructor() {}

  ngOnInit(): void {
    // Component initialization logic if needed
  }
}
