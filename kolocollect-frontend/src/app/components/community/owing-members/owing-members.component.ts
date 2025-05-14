import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { finalize, switchMap, catchError, map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { 
  faUsers, faMoneyBillWave, faSpinner, faSync, faUser,
  faInfoCircle, faCheckCircle, faExclamationTriangle, faCalendarAlt,
  faCreditCard, faMoneyBillTransfer
} from '@fortawesome/free-solid-svg-icons';

import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../services/toast.service';
import { UserService } from '../../../services/user.service';
import { MidcycleService } from '../../../services/midcycle.service';

@Component({
  selector: 'app-owing-members',
  standalone: true,  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatDialogModule,
    FontAwesomeModule
  ],
  templateUrl: './owing-members.component.html',
  styleUrls: ['./owing-members.component.scss']
})
export class OwingMembersComponent implements OnInit {
  @Input() communityId!: string;  @Input() isAdmin: boolean = false; // Admin status to control back payment distribution
  owingMembers: any[] = [];
  isLoading = false;
  isPaymentProcessing = false;
  isDistributing = false; // Flag for distribution in progress
  currentUserId: string = '';
  displayedColumns: string[] = ['userName', 'remainingAmount', 'paidAmount', 'installments', 'status', 'distribution', 'actions'];
  
  // Font Awesome icons
  faUsers = faUsers;
  faMoneyBillWave = faMoneyBillWave;
  faSpinner = faSpinner;
  faSync = faSync;
  faUser = faUser;
  faInfoCircle = faInfoCircle;  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faCalendarAlt = faCalendarAlt;
  faCreditCard = faCreditCard;
  faMoneyBillTransfer = faMoneyBillTransfer;
  constructor(
    private communityService: CommunityService,
    private toastService: ToastService,
    private userService: UserService,
    private dialog: MatDialog,
    private midcycleService: MidcycleService
  ) {}
    ngOnInit(): void {
    this.getCurrentUserId();
    this.loadOwingMembers();
  }
    getCurrentUserId(): void {
    // Get the current logged in user ID from localStorage or your auth service
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        this.currentUserId = user._id || user.id || user.userId;
        console.log('Current user ID retrieved:', this.currentUserId);
      } catch (e) {
        console.error('Error parsing current user:', e);
      }
    } else {
      console.warn('No current user found in localStorage');
      
      // Try alternative storage methods
      const authUser = localStorage.getItem('auth_user');
      if (authUser) {
        try {
          const user = JSON.parse(authUser);
          this.currentUserId = user._id || user.id || user.userId;
          console.log('Current user ID retrieved from auth_user:', this.currentUserId);
        } catch (e) {
          console.error('Error parsing auth_user:', e);
        }
      }
    }
  }
  
  loadOwingMembers(): void {
    if (!this.communityId) {
      console.error('Community ID is required to load owing members');
      return;
    }
    
    this.isLoading = true;
    this.communityService.getOwingMembers(this.communityId)
      .pipe(finalize(() => this.isLoading = false))      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.owingMembers = response.data;
            console.log('Loaded owing members:', this.owingMembers);
            
            // Add detailed debugging of the member data structure
            if (this.owingMembers.length > 0) {
              const sampleMember = this.owingMembers[0];
              console.log('Sample member data structure:', {
                userId: sampleMember.userId,
                type: typeof sampleMember.userId,
                currentUser: this.currentUserId,
                isMatch: this.isCurrentUser(sampleMember)
              });
            }
          }
        },
        error: (error) => {
          console.error('Error loading owing members:', error);
          this.toastService.error('Failed to load owing members. Please try again later.');
        }
      });
  }
  
  getTotalRemainingAmount(): number {
    return this.owingMembers.reduce((total, member) => total + member.remainingAmount, 0);
  }
    getTotalPaidAmount(): number {
    return this.owingMembers.reduce((total, member) => total + (member.paidAmount || 0), 0);
  }
  
  getCompletedPaymentsCount(): number {
    return this.owingMembers.filter(member => member.remainingAmount === 0).length;
  }
  
  getPaymentStatus(member: any): string {
    if (member.remainingAmount === 0) {
      return 'completed';
    } else if (member.installments > 0) {
      return 'in-progress';
    } else {
      return 'pending';
    }
  }
  
  getStatusLabel(member: any): string {
    const status = this.getPaymentStatus(member);
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in-progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';      default:
        return 'Unknown';
    }
  }
    /**
   * Checks if the current user is the member
   */
  isCurrentUser(member: any): boolean {
    console.log('Checking if current user:', this.currentUserId, 'matches member:', member);
    // Check for both string equality and nested object's _id or id properties
    return (
      member.userId === this.currentUserId || 
      member.userId?._id === this.currentUserId ||
      member.userId?.id === this.currentUserId
    );
  }
  
  /**
   * Handles paying the second installment
   */
  paySecondInstallment(member: any): void {
    if (!this.communityId || !member.userId) {
      this.toastService.error('Missing required information to process payment.');
      return;
    }
    
    if (this.isPaymentProcessing) {
      return;
    }
      // Show confirmation dialog
    if (!confirm(`Are you sure you want to pay your second installment of €${member.remainingAmount.toFixed(2)}?`)) {
      return;
    }
    
    this.isPaymentProcessing = true;
      // Call the community service to process the payment
    this.communityService.paySecondInstallment(this.communityId, member.userId)
      .pipe(finalize(() => this.isPaymentProcessing = false))
      .subscribe({
        next: (response) => {
          this.toastService.success('Second installment payment processed successfully!');
          this.loadOwingMembers(); // Reload the list to reflect changes
        },
        error: (error) => {
          console.error('Error processing second installment payment:', error);
          this.toastService.error('Failed to process payment. Please try again later.');
        }
      });
  }
    /**
   * Handles distributing back payments for a mid-cycle joiner
   * Only available for admins when payment is complete (remainingAmount = 0)
   */  /**
   * Helper method to find the correct midcycle joiner ID
   */
  findMidcycleJoinerId(member: any): Observable<string> {
    // First, try using the ID we already have
    if (member.midCycleJoinerId) {
      return of(member.midCycleJoinerId);
    }
    
    // If we don't have the midCycleJoinerId, look it up from all joiners
    return this.communityService.getAllMidCycleJoiners(this.communityId).pipe(
      map(response => {
        const joiners = response.joiners || [];
        // Find a joiner that matches this member's userId
        const matchingJoiner = joiners.find((j: any) => j.joiners && j.joiners.toString() === member.userId);
        
        if (matchingJoiner && matchingJoiner._id) {
          console.log(`Found matching joiner ID: ${matchingJoiner._id}`);
          return matchingJoiner._id;
        } else {
          // If no match found, fall back to member._id
          console.warn('No matching mid-cycle joiner found, using member._id as fallback');
          return member._id;
        }
      }),
      catchError(err => {
        console.error('Error finding mid-cycle joiner ID:', err);
        // Fallback to member._id
        return of(member._id);
      })
    );
  }

  distributeBackPayment(member: any): void {
    if (!this.communityId || !member.userId) {
      this.toastService.error('Missing required information to process back payment distribution.');
      return;
    }
      if (this.isDistributing || member.remainingAmount > 0 || !this.isAdmin || member.isDistributed === true) {
      return;
    }
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to distribute back payments for ${member.userName}?`)) {
      return;
    }
    
    this.isDistributing = true;
    
    // First find the correct midCycleJoinerId
    this.findMidcycleJoinerId(member).pipe(
      // Then make the API call with the found ID
      switchMap(midCycleJoinerId => {
        console.log(`Using mid-cycle joiner ID for distribution: ${midCycleJoinerId}`);
        return this.communityService.backPaymentDistribute(this.communityId, midCycleJoinerId, {});
      }),
      finalize(() => this.isDistributing = false)
    ).subscribe({
      next: (response) => {
        if (response.success === false) {
          this.toastService.error(response.message || 'Failed to distribute back payments.');
          return;
        }
        this.toastService.success('Back payment distribution processed successfully!');
        this.loadOwingMembers(); // Reload the list to reflect changes
      },
      error: (error) => {
        console.error('Error processing back payment distribution:', error);
        let errorMessage = 'Failed to distribute back payments. Please try again later.';
        
        if (error.error) {
          if (error.error.error && error.error.error.message) {
            errorMessage = error.error.error.message;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          }
        }
        
        this.toastService.error(errorMessage);
      }
    });
  }
}
