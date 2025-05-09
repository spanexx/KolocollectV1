import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip'; // Added MatTooltipModule
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faMoneyBillWave, 
  faHandHoldingDollar, 
  faPiggyBank, 
  faCalendarAlt, 
  faUsers, 
  faInfoCircle,
  faCheck,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

import { ContributionService } from '../../../services/contribution.service';
import { WalletService } from '../../../services/wallet.service';
import { CommunityService } from '../../../services/community.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { AuthService } from '../../../services/auth.service';
import { ContributionRequest } from '../../../models/contribution.model';
import { UserService } from '../../../services/user.service'; // Import UserService

@Component({
  selector: 'app-make-contribution',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatTooltipModule, // Added MatTooltipModule to the imports array
    FontAwesomeModule
  ],
  templateUrl: './make-contribution.component.html',
  styleUrls: ['./make-contribution.component.scss']
})
export class MakeContributionComponent implements OnInit {
  // FontAwesome icons
  faMoneyBillWave = faMoneyBillWave;
  faHandHoldingDollar = faHandHoldingDollar;
  faPiggyBank = faPiggyBank;
  faCalendarAlt = faCalendarAlt;
  faUsers = faUsers;
  faInfoCircle = faInfoCircle;
  faCheck = faCheck;
  faTimes = faTimes;

  // Form groups
  contributionForm: FormGroup;
  installmentForm: FormGroup;

  // Component state
  isLoading = false;
  error = '';
  success = false;
  walletBalance = 0;
  selectedCommunity: any = null;
  activeMidCycle: any = null;
  minContributionAmount = 0;
  installmentsAllowed = false; // Add this property to track if installments are allowed

  // Route params
  communityId: string | null = null;
  cycleId: string | null = null;
  midcycleId: string | null = null;

  // User communities list
  userCommunities: any[] = [];

  // Is installment mode
  isInstallment = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private contributionService: ContributionService,
    private walletService: WalletService,
    private communityService: CommunityService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private userService: UserService // Inject UserService
  ) {
    this.contributionForm = this.fb.group({
      communityId: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0)]],
      paymentMethod: [{value: 'wallet', disabled: true}, Validators.required]
    });

    this.installmentForm = this.fb.group({
      initialAmount: ['', [Validators.required, Validators.min(0)]],
      remainingAmount: ['', [Validators.required, Validators.min(0)]],
      completionDate: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadWalletBalance();
    this.loadUserCommunities();
      // Get URL parameters if provided
    this.route.queryParams.subscribe(params => {
      this.communityId = params['communityId'] || null;
      this.cycleId = params['cycleId'] || null;
      this.midcycleId = params['midcycleId'] || null;
      
      if (this.communityId) {
        console.log('Received communityId from query params:', this.communityId);
        // We'll set the community ID in the form after loading user communities
        // This ensures the communities are loaded first
        this.loadCommunityDetails(this.communityId);
      }
    });
  }

  /**
   * Load the user's wallet balance
   */
  loadWalletBalance(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('Please log in to make contributions');
      return;
    }
    
    this.walletService.getWalletBalance(userId).subscribe({
      next: (response) => {
        this.walletBalance = response.availableBalance || 0;
      },
      error: (error) => {
        this.toastService.error('Failed to load wallet balance');
        console.error('Error loading wallet balance:', error);
      }
    });
  }

  /**
   * Load communities the user is a member of
   */  loadUserCommunities(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('Please log in to view your communities');
      return;
    }
    
    this.loadingService.start('communities');
    this.userCommunities = [];
    
    // Use the UserService to get the user's communities directly instead of filtering
    this.userService.getUserCommunities(userId).subscribe({
      next: (response) => {
        console.log('Raw community response:', response);
        if (response && response.communities) {          this.userCommunities = response.communities.map((community: any) => {
            // Log the entire community object in detail for debugging
            console.log('Community before normalization (detailed):', JSON.stringify(community, null, 2));
            
            // Create a normalized copy with consistent properties
            const normalizedCommunity = {
              ...community,
              // Ensure these properties exist and have fallback values
              // Handle nested id structure that might be present in some community objects
              _id: community.id?.id || community._id || community.id || community.communityId,
              name: community.name || community.displayName || 'Unknown Community',
              // Use any available name field for the display name
              displayName: community.displayName || community.name || 'Unknown Community',
              // Store the original ID regardless of structure for API calls
              originalId: community.id?.id || community._id || community.id || community.communityId
            };
            
            return normalizedCommunity;
          });
          
          console.log('Normalized user communities:', this.userCommunities);
          
          // If we have a communityId from the route params, select it
          if (this.communityId && this.userCommunities.length > 0) {
            setTimeout(() => {
              this.contributionForm.patchValue({
                communityId: this.communityId
              });
              this.onCommunityChange();
            }, 0);
          }
        }
        this.loadingService.stop('communities');
      },
      error: (error) => {
        this.toastService.error('Failed to load communities');
        this.loadingService.stop('communities');
        console.error('Error loading user communities:', error);
      }
    });
  }
  /**
   * Load details for the selected community
   */
  loadCommunityDetails(communityId: string): void {
    if (!communityId) return;
    
    // Log the community ID that we're trying to load
    console.log('Loading community details for ID:', communityId);
    
    this.loadingService.start('community-details');
    
    this.communityService.getCommunityById(communityId).subscribe({
      next: (response) => {
        console.log('Community details response:', response);
        if (response && response.community) {
          this.selectedCommunity = response.community;
          console.log('Selected community details:', this.selectedCommunity);
          console.log('Community name from API:', this.selectedCommunity.name);
          
          // Update the community in our userCommunities array with the full details
          const communityIndex = this.userCommunities.findIndex(c => 
            c._id === this.selectedCommunity._id || 
            c.originalId === this.selectedCommunity._id
          );
          
          if (communityIndex !== -1) {
            // Update the display name in our local array to match what came from the API
            this.userCommunities[communityIndex].displayName = this.selectedCommunity.name;
            this.userCommunities[communityIndex].name = this.selectedCommunity.name;
            console.log('Updated community in userCommunities array:', this.userCommunities[communityIndex]);
            
            // Force refresh the form to display the updated name
            setTimeout(() => {
              const currentId = this.contributionForm.get('communityId')?.value;
              if (currentId) {
                this.contributionForm.patchValue({
                  communityId: null
                });
                setTimeout(() => {
                  this.contributionForm.patchValue({
                    communityId: currentId
                  });
                }, 10);
              }
            }, 0);
          } else {
            console.warn('Could not find matching community in userCommunities array to update');
          }
          
          this.minContributionAmount = this.selectedCommunity.settings?.minContribution || 0;
          
          // Check if community allows installments
          this.installmentsAllowed = this.selectedCommunity.settings?.allowsInstallments || false;
          
          // If installments are not allowed, disable installment mode
          if (!this.installmentsAllowed && this.isInstallment) {
            this.isInstallment = false;
          }
          
          // Update form validators
          this.contributionForm.get('amount')?.setValidators([
            Validators.required,
            Validators.min(this.minContributionAmount)
          ]);
          this.contributionForm.get('amount')?.updateValueAndValidity();            // Find the active mid-cycle
          if (this.selectedCommunity.midCycle) {
            const midcycles = Array.isArray(this.selectedCommunity.midCycle) ? 
              this.selectedCommunity.midCycle : 
              [this.selectedCommunity.midCycle];
            
            // Log all midcycles for debugging
            console.log('Available midcycles:', JSON.stringify(midcycles, null, 2));
              
            // Check each midcycle to ensure it has a valid _id property
            const validMidcycles = midcycles.filter((mc: any) => mc && mc._id);
            
            if (validMidcycles.length !== midcycles.length) {
              console.warn('Some midcycles are missing _id property:', 
                midcycles.filter((mc: any) => !mc || !mc._id));
            }
            
            // Find active midcycle using _id (not id)
            this.activeMidCycle = validMidcycles.find((mc: any) => 
              !mc.isComplete && (this.midcycleId ? mc._id === this.midcycleId : true)
            );

            // If no matching midcycle was found, take the most recent one that's not complete
            if (!this.activeMidCycle) {
              this.activeMidCycle = validMidcycles.find((mc: any) => !mc.isComplete);
              console.log('No exact midcycle match, using first active one:', this.activeMidCycle);
            }
            
            // If all are complete, just take the latest one
            if (!this.activeMidCycle && validMidcycles.length > 0) {
              this.activeMidCycle = validMidcycles[validMidcycles.length - 1];
              console.log('No active midcycles, using latest one:', this.activeMidCycle);
            }

            if (this.activeMidCycle) {
              console.log('Selected active midcycle:', this.activeMidCycle);
              console.log('MidCycle ID to be used:', this.activeMidCycle._id);
              
              // Normalize the midCycle object to ensure it has the necessary structure
              // This helps with cases where the object structure might be inconsistent
              this.activeMidCycle = {
                ...this.activeMidCycle,
                _id: this.activeMidCycle._id || this.activeMidCycle.id,
                cycleNumber: this.activeMidCycle.cycleNumber || 1
              };
            } else {
              console.error('No valid midcycle found for contribution!');
              this.toastService.warning('No active contribution cycle found for this community');
            }
          } else {
            console.error('No midcycles found in community:', this.selectedCommunity);
            this.toastService.warning('No contribution cycles found for this community');
          }
          
          this.loadingService.stop('community-details');
        }
      },
      error: (error) => {
        this.toastService.error('Failed to load community details');
        this.loadingService.stop('community-details');
        console.error('Error loading community details:', error);
        console.error('Failed community ID used:', communityId);
        console.error('Available community IDs:', 
          this.userCommunities.map(c => ({ 
            displayName: c.displayName,
            _id: c._id, 
            originalId: c.originalId,
            hasNested: !!c.id?.id,
            nestedId: c.id?.id
          }))
        );
      }
    });
  }  /**
   * Handle community selection change
   */  onCommunityChange(): void {
    const communityId = this.contributionForm.get('communityId')?.value;
    if (communityId) {
      // Find the selected community in the userCommunities array using the normalized _id property
      const selectedCommunity = this.userCommunities.find(c => c._id === communityId);
      
      if (selectedCommunity) {
        console.log('Selected community found:', selectedCommunity);
        
        // Check if we already have full community details and can reuse them
        if (this.selectedCommunity && 
            (this.selectedCommunity._id === selectedCommunity._id || 
             this.selectedCommunity._id === selectedCommunity.originalId)) {
          console.log('Reusing existing community details');
          return; // We already have this community selected, no need to reload
        }
        
        // Use originalId (which should match the actual ID on the backend) for API calls
        const apiCommunityId = selectedCommunity.originalId || selectedCommunity._id;
        console.log('Using community ID for API call:', apiCommunityId);
        
        // Show the display name immediately while loading
        this.selectedCommunity = { 
          ...selectedCommunity, 
          name: selectedCommunity.displayName || selectedCommunity.name 
        };
        
        this.loadCommunityDetails(apiCommunityId);
      } else {
        // If we can't find the community, try using the ID directly
        console.log('Community not found in list, using ID directly:', communityId);
        this.loadCommunityDetails(communityId);
      }
    } else {
      this.selectedCommunity = null;
      this.minContributionAmount = 0;
      this.activeMidCycle = null;
    }
  }

  /**
   * Toggle installment mode
   */
  toggleInstallment(): void {
    // Don't allow toggling if installments aren't allowed
    if (!this.installmentsAllowed) {
      return;
    }
    
    this.isInstallment = !this.isInstallment;
    
    if (this.isInstallment) {
      const amount = this.contributionForm.get('amount')?.value || this.minContributionAmount;
      // Initialize installment form with default values
      this.installmentForm.patchValue({
        initialAmount: Math.round(amount * 0.5), // Default to 50% initially
        remainingAmount: Math.round(amount * 0.5),
        completionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default to 1 week from now
      });
    }
  }

  /**
   * Check if the user has sufficient funds for the contribution
   */
  hasSufficientFunds(): boolean {
    const amount = this.isInstallment ? 
      this.installmentForm.get('initialAmount')?.value : 
      this.contributionForm.get('amount')?.value;
      
    return this.walletBalance >= amount;
  }

  /**
   * Submit the contribution
   */
  submitContribution(): void {
    if (this.isInstallment && !this.installmentForm.valid) {
      this.toastService.error('Please complete all installment fields correctly.');
      this.installmentForm.markAllAsTouched();
      return;
    }
    
    if (!this.contributionForm.valid) {
      this.toastService.error('Please complete all required fields.');
      this.contributionForm.markAllAsTouched();
      return;
    }
    
    if (!this.hasSufficientFunds()) {
      this.toastService.error('Insufficient funds in wallet. Please add funds.');
      return;
    }
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.toastService.error('Please log in to make contributions');
      return;
    }
      this.isLoading = true;
    this.loadingService.start('submit-contribution');
    this.error = '';
    this.success = false;
    
    // Check if we have a valid midCycle
    if (!this.activeMidCycle || !this.activeMidCycle._id) {
      // If not, try to fetch the community details again to get an active midCycle
      this.toastService.info('Finding active cycle...');
      
      const communityId = this.contributionForm.value.communityId;
      this.communityService.getCommunityById(communityId).subscribe({
        next: (response) => {
          if (response && response.community && response.community.midCycle) {
            const midcycles = Array.isArray(response.community.midCycle) ? 
              response.community.midCycle : [response.community.midCycle];
            
            // Find any active midcycle
            this.activeMidCycle = midcycles.find((mc: any) => !mc.isComplete);
            
            // If all are complete, just take the latest one
            if (!this.activeMidCycle && midcycles.length > 0) {
              this.activeMidCycle = midcycles[midcycles.length - 1];
            }
            
            if (this.activeMidCycle && this.activeMidCycle._id) {
              // Now we have a valid midCycle, proceed with contribution
              this.processContribution(userId);
            } else {
              this.toastService.error('Could not find an active cycle for contribution');
              this.isLoading = false;
              this.loadingService.stop('submit-contribution');
            }
          } else {
            this.toastService.error('Could not fetch community details');
            this.isLoading = false;
            this.loadingService.stop('submit-contribution');
          }
        },
        error: (error) => {
          this.toastService.error('Failed to load community details');
          this.isLoading = false;
          this.loadingService.stop('submit-contribution');
        }
      });
    } else {      // We already have a valid midCycle, proceed with contribution
      this.processContribution(userId);
    }
  }/**
   * Process the contribution with valid data
   */
  private processContribution(userId: string): void {
    // Final validation before submitting
    if (!this.activeMidCycle || !this.activeMidCycle._id) {
      this.toastService.error('No active cycle found for this community. Please try again later or contact support.');
      this.isLoading = false;
      this.loadingService.stop('submit-contribution');
      return;
    }

    // Prepare the request data
    const contributionData: any = {
      userId,
      communityId: this.contributionForm.value.communityId,
      amount: this.contributionForm.value.amount,
      midCycleId: this.activeMidCycle._id  // Use without optional chaining to ensure it's not undefined
    };
    
    // Log the contribution data for debugging
    console.log('Preparing contribution data:', {
      ...contributionData,
      activeMidCycleDetails: this.activeMidCycle ? {
        _id: this.activeMidCycle._id,
        isComplete: this.activeMidCycle.isComplete,
        cycleNumber: this.activeMidCycle.cycleNumber
      } : null
    });
    
    // Add installment data if applicable
    if (this.isInstallment) {
      contributionData.paymentPlan = {
        type: 'Incremental',
        totalPreviousContribution: 0,
        remainingAmount: this.installmentForm.value.remainingAmount,
        previousContribution: this.installmentForm.value.initialAmount,
        installments: 1
      };
      
      // Adjust the initial amount
      contributionData.amount = this.installmentForm.value.initialAmount;
    }
    
    // Send the request
    this.contributionService.createContribution(contributionData).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.loadingService.stop('submit-contribution');
        this.success = true;
        this.toastService.success('Contribution created successfully!');
        
        // Refresh wallet balance
        this.loadWalletBalance();
      },
      error: (error) => {
        this.isLoading = false;
        this.loadingService.stop('submit-contribution');
        
        // Check for specific error types
        if (error.status === 400) {
          if (error.error && error.error.message && error.error.message.includes('midCycleId')) {
            this.error = 'Missing or invalid cycle information. Please try selecting the community again.';
          } else {
            this.error = error.error?.message || 'Invalid contribution data. Please check all fields.';
          }
        } else {
          this.error = error.message || 'Failed to create contribution. Please try again.';
        }
        
        this.toastService.error(this.error);
        console.error('Error creating contribution:', error);
      }
    });
  }

  /**
   * Helper for dynamic form field validation
   */
  isFormControlInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  /**
   * Helper for dynamic form validation messages
   */
  getErrorMessage(form: FormGroup, controlName: string): string {
    const control = form.get(controlName);
    if (!control) return '';
    
    if (control.hasError('required')) {
      return 'This field is required';
    }
    
    if (control.hasError('min')) {
      if (controlName === 'amount') {
        return `Minimum contribution is $${this.minContributionAmount}`;
      }
      return 'Value must be greater than zero';
    }
    
    return 'Invalid input';
  }
}