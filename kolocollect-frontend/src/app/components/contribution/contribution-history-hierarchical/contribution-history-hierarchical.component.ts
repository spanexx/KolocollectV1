import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { finalize } from 'rxjs/operators';
import { 
  faChevronDown, faChevronRight, faCirclePlus, faCircleMinus, 
  faHistory, faInfoCircle, faUser, faSpinner, faChevronUp, faTimesCircle,
  faSync, faChartPie, faLayerGroup, faMoneyBillWave, faCheckCircle
} from '@fortawesome/free-solid-svg-icons';

import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-contribution-history-hierarchical',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatExpansionModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    FontAwesomeModule
  ],
  templateUrl: './contribution-history-hierarchical.component.html',
  styleUrls: ['./contribution-history-hierarchical.component.scss']
})
export class ContributionHistoryHierarchicalComponent implements OnInit {
  @Input() communityId!: string;
  contributionHistory: any[] = [];
  expandedCycles: Set<string> = new Set();
  selectedMidcycle: any = null;
  selectedContribution: any = null;
  isLoading = false;
  displayedColumns: string[] = ['contributor', 'amount', 'count', 'actions'];
    // Font Awesome icons
  faChevronDown = faChevronDown;
  faChevronRight = faChevronRight;  faChevronUp = faChevronUp;
  faCirclePlus = faCirclePlus;
  faCircleMinus = faCircleMinus;
  faHistory = faHistory;
  faInfoCircle = faInfoCircle;  faUser = faUser;
  faSpinner = faSpinner;
  faTimesCircle = faTimesCircle;
  faSync = faSync;
  faChartPie = faChartPie;
  faLayerGroup = faLayerGroup;
  faMoneyBillWave = faMoneyBillWave;
  faCheckCircle = faCheckCircle;
  
  constructor(
    private communityService: CommunityService,
    private toastService: ToastService
  ) {}
  
  ngOnInit(): void {
    this.loadContributionHistory();
  }
  
  loadContributionHistory(): void {
    if (!this.communityId) {
      console.error('Community ID is required to load contribution history');
      return;
    }
    
    this.isLoading = true;
    this.communityService.getCommunityContributionHistory(this.communityId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.contributionHistory = response.data;
            // Debug logging
            console.log('Loaded contribution history:', this.contributionHistory);
            
            if (this.contributionHistory.length > 0) {
              console.log('First cycle:', this.contributionHistory[0]);
              
              if (this.contributionHistory[0].midcycles && this.contributionHistory[0].midcycles.length > 0) {
                console.log('First midcycle:', this.contributionHistory[0].midcycles[0]);
                
                if (this.contributionHistory[0].midcycles[0].contributions && 
                    this.contributionHistory[0].midcycles[0].contributions.length > 0) {
                  console.log('First contribution:', this.contributionHistory[0].midcycles[0].contributions[0]);
                }
              }
            }
            
            // Auto-expand current cycle
            const currentCycle = this.contributionHistory.find(c => !c.cycle.isComplete);
            if (currentCycle) {
              this.expandedCycles.add(currentCycle.cycle._id);
            }
          }
        },
        error: (error) => {
          this.toastService.error('Failed to load contribution history');
          console.error('Error loading contribution history:', error);
        }
      });
  }
  
  toggleCycle(cycleId: string): void {
    if (this.expandedCycles.has(cycleId)) {
      this.expandedCycles.delete(cycleId);
    } else {
      this.expandedCycles.add(cycleId);
    }
  }
  
  isCycleExpanded(cycleId: string): boolean {
    return this.expandedCycles.has(cycleId);
  }
  
  selectMidcycle(midcycle: any): void {
    this.selectedMidcycle = midcycle === this.selectedMidcycle ? null : midcycle;
  }
  
  viewContributionDetails(contribution: any): void {
    this.selectedContribution = contribution === this.selectedContribution ? null : contribution;
  }
  
  getContributionTotal(midcycle: any): number {
    if (!midcycle.contributions || !midcycle.contributions.length) {
      return 0;
    }
    
    return midcycle.contributions.reduce((total: number, contribution: any) => {
      return total + (contribution.totalAmount || 0);
    }, 0);
  }
    getCycleTotal(cycleData: any): number {
    if (!cycleData.midcycles || !cycleData.midcycles.length) {
      return 0;
    }
    
    return cycleData.midcycles.reduce((total: number, midcycle: any) => {
      return total + this.getContributionTotal(midcycle);
    }, 0);
  }
    getMidcyclesStatus(cycleData: any): string {
    if (!cycleData.midcycles || !cycleData.midcycles.length) {
      return '0 midcycles';
    }
    
    const completed = cycleData.midcycles.filter((m: any) => m.isComplete).length;
    return `${completed}/${cycleData.midcycles.length} complete`;
  }

  // Get status text for contribution
  getContributionStatusText(status: string): string {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status || 'Unknown';
    }
  }
  
  // Get total number of midcycles across all cycles
  getTotalMidcycles(): number {
    if (!this.contributionHistory || !this.contributionHistory.length) {
      return 0;
    }
    
    return this.contributionHistory.reduce((total: number, cycleData: any) => {
      return total + (cycleData.midcycles?.length || 0);
    }, 0);
  }
  
  // Get total contribution amount across all cycles and midcycles
  getTotalContributions(): number {
    if (!this.contributionHistory || !this.contributionHistory.length) {
      return 0;
    }
    
    return this.contributionHistory.reduce((total: number, cycleData: any) => {
      return total + this.getCycleTotal(cycleData);
    }, 0);
  }
  
  // Get count of completed midcycles
  getCompletedMidcyclesCount(): number {
    if (!this.contributionHistory || !this.contributionHistory.length) {
      return 0;
    }
    
    return this.contributionHistory.reduce((total: number, cycleData: any) => {
      if (!cycleData.midcycles) return total;
      
      const completedInCycle = cycleData.midcycles.filter((m: any) => m.isComplete).length;
      return total + completedInCycle;
    }, 0);
  }
}
