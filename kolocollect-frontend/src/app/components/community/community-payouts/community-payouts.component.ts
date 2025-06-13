import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faUser, faCalendarDays, faMoneyBillTransfer, faCircleInfo, 
  faSpinner, faDollarSign
} from '@fortawesome/free-solid-svg-icons';
import { Subject, catchError, finalize, takeUntil, throwError } from 'rxjs';
import { CommunityService } from '../../../services/community.service';
import { MidcycleService } from '../../../services/midcycle.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { CustomButtonComponent } from '../../../shared/components/custom-button/custom-button.component';

@Component({
  selector: 'app-community-payouts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    FontAwesomeModule,
  ],
  templateUrl: './community-payouts.component.html',
  styleUrl: './community-payouts.component.scss'
})
export class CommunityPayoutsComponent implements OnInit, OnDestroy {
  @Input() communityId: string = '';
  @Input() isAdmin: boolean = false;
  @Input() isMember: boolean = false;

  // Icons
  faUser = faUser;
  faCalendarDays = faCalendarDays;
  faMoneyBillTransfer = faMoneyBillTransfer;
  faCircleInfo = faCircleInfo;
  faSpinner = faSpinner;
  faDollarSign = faDollarSign;

  // Payout data
  community: any = {};
  payouts: any[] = [];
  loadingPayouts: boolean = false;
  payDate: Date | null = null;
  nextRecipientName: string = 'Not assigned yet';

  private destroy$ = new Subject<void>();
  constructor(
    private communityService: CommunityService,
    private midcycleService: MidcycleService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.loadCommunityData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }  loadCommunityData(): void {
    if (!this.communityId) return;
    
    this.loadingPayouts = true;
    this.communityService.getCommunityById(this.communityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.toastService.error('Failed to load community data');
          return throwError(() => error);
        }),
        finalize(() => {
          this.loadingPayouts = false;
        })
      )
      .subscribe(data => {
        this.community = data.community;
        console.log('Community data:', this.community);
        
        // Set payout date from community's nextPayout field
        if (this.community && this.community.nextPayout) {
          this.payDate = new Date(this.community.nextPayout);
          console.log('Set payout date from community.nextPayout:', this.payDate);
        }
        
        // Resolve next recipient name
        this.resolveNextRecipientName();
        
        // Also try to get more detailed payout info from midcycle if available
        if (this.community && this.community.midCycle && this.community.midCycle.length > 0) {
          this.loadMidcycleDetails();
        }
      });
  }
    loadMidcycleDetails(): void {
    // Try to get the most recent midcycle ID from the community data
    let midcycleId: string | null = null;
    
    if (this.community.midCycle && this.community.midCycle.length > 0) {
      // Get the most recent midcycle (last in array)
      const latestMidcycle = this.community.midCycle[this.community.midCycle.length - 1];
      midcycleId = typeof latestMidcycle === 'string' ? latestMidcycle : latestMidcycle._id || latestMidcycle;
    }
    
    if (!midcycleId) {
      console.log('No midcycle ID found');
      return;
    }
    
    console.log('Loading midcycle details for ID:', midcycleId);
    
    this.midcycleService.getMidCycleById(this.communityId, midcycleId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Failed to load midcycle details:', error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Midcycle details response:', response);
          if (response && response.data) {
            
            // Update payDate from midcycle data if it has a more accurate date
            if (response.data.payoutDate) {
              this.payDate = new Date(response.data.payoutDate);
            }
            
            // Update payout amount if available
            if (response.data.payoutAmount && this.community.payoutDetails) {
              this.community.payoutDetails.payoutAmount = response.data.payoutAmount;
              
            }
          } else {
            console.warn('Midcycle details response has no data');
          }
        }
      });
  }
    getCurrentCycle(): any {
    if (!this.community || !this.community.cycles || this.community.cycles.length === 0) {
      return null;
    }
    
    // Find the current (active) cycle
    return this.community.cycles.find((cycle: any) => !cycle.isComplete) || 
           this.community.cycles[this.community.cycles.length - 1];
  }
  
  resolveNextRecipientName(): void {
    if (!this.community || !this.community.payoutDetails || !this.community.payoutDetails.nextRecipient) {
      this.nextRecipientName = 'Not assigned yet';
      return;
    }
    
    const nextRecipientId = this.community.payoutDetails.nextRecipient;
    
    // Try to find the recipient in the community members
    if (this.community.members && this.community.members.length > 0) {
      const recipient = this.community.members.find((member: any) => 
        member.userId === nextRecipientId || member.userId._id === nextRecipientId || 
        member._id === nextRecipientId
      );
      
      if (recipient) {
        this.nextRecipientName = recipient.name || 'Unknown Member';
        console.log('Resolved recipient name:', this.nextRecipientName);
        return;
      }
    }
    
    // If not found in members, try to find in admin
    if (this.community.admin && 
        (this.community.admin._id === nextRecipientId || this.community.admin.userId === nextRecipientId)) {
      this.nextRecipientName = this.community.admin.name || 'Community Admin';
      console.log('Resolved recipient as admin:', this.nextRecipientName);
      return;
    }
    
    // If still not found, show the ID
    this.nextRecipientName = nextRecipientId || 'Not assigned yet';
    console.log('Could not resolve recipient name, using ID:', this.nextRecipientName);
  }

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'Not scheduled yet';
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  }
}
