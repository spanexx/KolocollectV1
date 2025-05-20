import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { Community } from '../../../models/community.model';

@Component({
  selector: 'app-join-community-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './join-community-dialog.component.html',
  styleUrls: ['./join-community-dialog.component.scss']
})
export class JoinCommunityDialogComponent implements OnInit {
  joinForm: FormGroup;
  loading = false;
  loadingContribution = false;
  currentUser: User | null = null;
  minContribution = 0; 
  requiredContribution = 0;
  communityName = '';
  isFirstCycle = false; // Added to track if it's the first cycle
  contributionExplanation: string = '';
  midCycleInfo: any = null;
  
  constructor(
    private fb: FormBuilder,
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private dialogRef: MatDialogRef<JoinCommunityDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { communityId: string, community: Community }
  ) {
    this.joinForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contributionAmount: [''] // Remove validators initially
    });
  }
  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    
    // Set minimum contribution and check if it's first cycle
    if (this.data.community) {
      this.minContribution = this.data.community.settings?.minContribution || 0;
      this.communityName = this.data.community.name || '';
      
      // Check if this is the first cycle from community data
      this.isFirstCycle = !this.data.community.cycles || this.data.community.cycles.length <= 1;
      
      // Fetch the required contribution amount from the API
      this.fetchRequiredContribution();
    }
      // Pre-fill form with user data if available
    if (this.currentUser) {
      this.joinForm.patchValue({
        name: this.authService.getUserFullName(),
        email: this.currentUser.email
      });
    }
  }
  
  /**
   * Fetch the required contribution amount from the backend
   * This uses the calculation from Community.addNewMemberMidCycle
   */
  fetchRequiredContribution(): void {
    this.loadingContribution = true;
    
    this.communityService.getRequiredContribution(this.data.communityId)
      .subscribe({
        next: (response) => {
          this.isFirstCycle = response.isFirstCycle;
          this.requiredContribution = response.requiredContribution || this.minContribution;
          this.contributionExplanation = response.explanation || '';
          this.midCycleInfo = response;
          
          // Update validators based on cycle status
          const contributionControl = this.joinForm.get('contributionAmount');
          if (contributionControl) {
            if (this.isFirstCycle) {
              // First cycle - only min validation if a value is provided
              contributionControl.setValidators(Validators.min(this.minContribution));
              contributionControl.setValue(this.minContribution);
            } else {
              // Not first cycle - required with min validation using required contribution
              contributionControl.setValidators([
                Validators.required,
                Validators.min(this.requiredContribution)
              ]);
              contributionControl.setValue(this.requiredContribution);
            }
            contributionControl.updateValueAndValidity();
          }
        },
        error: (error) => {
          console.error('Error fetching required contribution:', error);
          this.toastService.error('Failed to get contribution requirements');
          
          // Fallback to basic validation using minContribution
          const contributionControl = this.joinForm.get('contributionAmount');
          if (contributionControl) {
            contributionControl.setValidators([
              Validators.required,
              Validators.min(this.minContribution)
            ]);
            contributionControl.updateValueAndValidity();
          }
        },
        complete: () => {
          this.loadingContribution = false;
        }
      });
  }

  onSubmit(): void {
    if (this.joinForm.invalid || !this.currentUser) {
      return;
    }
    
    this.loading = true;
    
    // Create the join data, with conditional contribution amount for first cycle
    const joinData = {
      userId: this.currentUser.id,
      name: this.joinForm.value.name,
      email: this.joinForm.value.email,
      contributionAmount: this.isFirstCycle && !this.joinForm.value.contributionAmount 
        ? null 
        : this.joinForm.value.contributionAmount
    };
    
    this.communityService.joinCommunity(this.data.communityId, joinData)
      .subscribe({
        next: (response) => {
          this.toastService.success('Successfully joined the community');
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.toastService.error(error.error?.message || 'Failed to join the community');
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
  }
  
  cancel(): void {
    this.dialogRef.close(false);
  }
}
