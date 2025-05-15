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
  }
  loadCommunityData(): void {
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
        if (this.community && this.community.payoutDetails) {
          this.calculatePayDate();
        }
        
        // After loading community, fetch the active midcycle details
        if (this.community && this.community.cycles && this.community.cycles.length > 0) {
          this.loadMidcycleDetails();
        }
      });
  }
  
  loadMidcycleDetails(): void {
    // Get current cycle
    const currentCycle = this.getCurrentCycle();
    if (!currentCycle || !currentCycle.midCycles || currentCycle.midCycles.length === 0) {
      console.log('No current cycle or midcycles found');
      return;
    }
      // Get all non-complete midcycles from the current cycle
    const activeMidcycles = currentCycle.midCycles.filter((mc: any) => !mc.isComplete);
    
    if (activeMidcycles.length === 0) {
      console.log('No active midcycles found');
      return;
    }
    
    // Sort by midCycleNumber to get the latest one
    const latestMidcycle = activeMidcycles.sort((a: any, b: any) => 
      (b.midCycleNumber || 0) - (a.midCycleNumber || 0)
    )[0];
    
    // Extract the ID string from the midcycle object
    const midcycleId = typeof latestMidcycle === 'string' ? latestMidcycle : latestMidcycle.id;
    
    if (!midcycleId) {
      console.error('Failed to get a valid midcycle ID');
      return;
    }
    
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
          console.log('Midcycle details response:', response.data);
          if (response && response.data) {
            // Update payDate from midcycle data
            this.payDate = response.data.payoutDate;
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

  calculatePayDate(): void {
    if (this.community && this.community.payoutDetails && this.community.payoutDetails.payoutDate) {
      this.payDate = new Date(this.community.payoutDetails.payoutDate);
    } else {
      this.payDate = null;
    }
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
