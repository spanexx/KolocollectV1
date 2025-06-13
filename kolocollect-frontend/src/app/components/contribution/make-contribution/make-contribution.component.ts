import { Component, OnInit, OnDestroy } from '@angular/core';
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
  faTimes,
  faLock
} from '@fortawesome/free-solid-svg-icons';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

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
export class MakeContributionComponent implements OnInit, OnDestroy {
  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();
  
  // Flag to prevent duplicate API calls
  private nextInLineCheckInProgress = false;
  
  // FontAwesome icons
  faMoneyBillWave = faMoneyBillWave;
  faHandHoldingDollar = faHandHoldingDollar;
  faPiggyBank = faPiggyBank;
  faCalendarAlt = faCalendarAlt;
  faUsers = faUsers;
  faInfoCircle = faInfoCircle;
  faCheck = faCheck;
  faTimes = faTimes;
  faLock = faLock;

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
  
  // Next in line payment information
  nextInLineInfo: any = null;
  nextInLineLoading = false;
  hasNextInLineDue = false;
  amountInputDisabled = false; // New property to control disabling the amount input

  // Route params
  communityId: string | null = null;
  cycleId: string | null = null;
  midcycleId: string | null = null;

  // User communities list
  userCommunities: any[] = [];
  // Is installment mode
  isInstallment = false;
  
  // Contribution status tracking
  hasAlreadyContributed = false;
  contributionStatusLoading = false;
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
    // Create the form with options to preserve disabled state
    const formOptions = { updateOn: 'blur' }; // Only update on blur to avoid potential race conditions
    
    this.contributionForm = this.fb.group({
      communityId: ['', Validators.required],
      amount: ['', [Validators.required, Validators.min(0)]],
      paymentMethod: [{value: 'wallet', disabled: true}, Validators.required]
    }, formOptions);

    this.installmentForm = this.fb.group({
      initialAmount: ['', [Validators.required, Validators.min(0)]],
      remainingAmount: ['', [Validators.required, Validators.min(0)]],
      completionDate: ['', Validators.required]
    }, formOptions);
  }  ngOnInit(): void {
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
        
        // Check contribution status when loading from URL params
        this.checkContributionStatus();
      }
    });
    
    // Setup listener for amount changes to check next-in-line payment info
    // Add debounce and distinctUntilChanged to prevent excessive API calls
    this.contributionForm.get('amount')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(amount => {
        // Skip next-in-line check if the amount was changed programmatically while disabled
        if (!this.amountInputDisabled && !this.nextInLineCheckInProgress) {
          this.checkNextInLinePayment();
        }
      });
    
    // Check contribution status on init
    this.checkContributionStatus();
  }
  
  /**
   * Clean up subscriptions when component is destroyed
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
        console.log('Wallet balance response:', response);
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
            }, 0);          } else {
            console.warn('Could not find matching community in userCommunities array to update');
          }
          
          // Extract minimum contribution amount handling MongoDB Decimal128 format
          let minContribution = this.selectedCommunity.settings?.minContribution;
          if (minContribution && typeof minContribution === 'object' && minContribution.$numberDecimal) {
            this.minContributionAmount = parseFloat(minContribution.$numberDecimal);
          } else {
            this.minContributionAmount = parseFloat(minContribution) || 0;
          }
          
          console.log('Extracted minimum contribution amount:', this.minContributionAmount);
          
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
          this.contributionForm.get('amount')?.updateValueAndValidity();
          
          // Set initial contribution amount if empty or less than minimum
          const currentAmount = this.contributionForm.get('amount')?.value;
          if (!currentAmount || currentAmount < this.minContributionAmount) {
            this.contributionForm.patchValue({ 
              amount: this.minContributionAmount 
            });          }
          
          // Find the active mid-cycle
          if (this.selectedCommunity.midCycle) {
            const midcycles = Array.isArray(this.selectedCommunity.midCycle) ? 
              this.selectedCommunity.midCycle : 
              [this.selectedCommunity.midCycle];
            
            // Log all midcycles for debugging
            console.log('Available midcycles:', JSON.stringify(midcycles, null, 2));
            console.log('Type of first midcycle:', typeof midcycles[0]);
              
            // Handle both string IDs and object midcycles
            const validMidcycles = midcycles.map((mc: any) => {
              // If it's a string ID, convert it to an object
              if (typeof mc === 'string') {
                return {
                  _id: mc,
                  id: mc, // For compatibility
                  isComplete: false, // Assume not complete for string IDs
                  cycleNumber: 1 // Default cycle number
                };
              }
              // If it's already an object, ensure it has the required properties
              return {
                ...mc,
                _id: mc._id || mc.id || mc,
                isComplete: mc.isComplete || false,
                cycleNumber: mc.cycleNumber || 1
              };
            }).filter((mc: any) => mc._id); // Filter out any that don't have an _id
            
            console.log('Processed valid midcycles:', validMidcycles);
              // Find active midcycle using _id (not id)
            // If midcycleId is specified in route params, use that specific one
            if (this.midcycleId) {
              this.activeMidCycle = validMidcycles.find((mc: any) => mc._id === this.midcycleId);
            }
            
            // If no specific midcycle was requested or found, find the most recent active one
            if (!this.activeMidCycle) {
              // Sort by creation date or cycle number to get the most recent
              const activeMidcycles = validMidcycles.filter((mc: any) => !mc.isComplete);
              if (activeMidcycles.length > 0) {
                // Take the last (most recent) active midcycle
                this.activeMidCycle = activeMidcycles[activeMidcycles.length - 1];
                console.log('Using most recent active midcycle:', this.activeMidCycle);
              }
            }
            
            // If all are complete, just take the latest one
            if (!this.activeMidCycle && validMidcycles.length > 0) {
              this.activeMidCycle = validMidcycles[validMidcycles.length - 1];
              console.log('No active midcycles, using latest one:', this.activeMidCycle);
            }

            if (this.activeMidCycle) {
              console.log('Selected active midcycle:', this.activeMidCycle);
              console.log('MidCycle ID to be used:', this.activeMidCycle._id);
            } else {
              console.error('No valid midcycle found for contribution!');
              this.toastService.warning('No active contribution cycle found for this community');
            }
          } else {
            console.error('No midcycles found in community:', this.selectedCommunity);
            this.toastService.warning('No contribution cycles found for this community');          }
          
          this.loadingService.stop('community-details');
          
          // Check for next-in-line payment info after loading community details
          this.checkNextInLinePayment();
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
   * Check if the user has already contributed in the current cycle
   */
  checkContributionStatus(): void {
    const communityId = this.contributionForm.get('communityId')?.value;
    const userId = this.authService.currentUserValue?.id;
    
    if (!communityId || !userId) {
      this.hasAlreadyContributed = false;
      return;
    }
    
    this.contributionStatusLoading = true;
    
    this.communityService.checkMemberContributionStatus(communityId, userId).subscribe({
      next: (response) => {
        this.contributionStatusLoading = false;
        
        if (response && response.data) {
          this.hasAlreadyContributed = response.data.hasContributed;
          
          if (this.hasAlreadyContributed) {
            this.toastService.warning('You have already contributed to this cycle');
            // Disable the form if user has already contributed
            this.contributionForm.disable();
            this.installmentForm.disable();
          } else {
            // Enable the form if user hasn't contributed yet
            this.contributionForm.enable();
            this.installmentForm.enable();
            // Keep payment method disabled as it's always wallet
            this.contributionForm.get('paymentMethod')?.disable();
          }
        }
      },
      error: (error) => {
        this.contributionStatusLoading = false;
        console.error('Error checking contribution status:', error);
        // Don't show error to user as it's not critical
        // Allow them to proceed with contribution
        this.hasAlreadyContributed = false;
      }
    });
  }

  /**
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
          // Even if reusing details, still check for next-in-line payment info
          this.checkNextInLinePayment();
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
        
        // Check if user has already contributed
        this.checkContributionStatus();
      } else {
        // If we can't find the community, try using the ID directly
        console.log('Community not found in list, using ID directly:', communityId);
        this.loadCommunityDetails(communityId);
        
        // Check if user has already contributed
        this.checkContributionStatus();
      }    } else {
      this.selectedCommunity = null;
      this.minContributionAmount = 0;
      this.activeMidCycle = null;
      this.nextInLineInfo = null;
      this.hasNextInLineDue = false;
      this.hasAlreadyContributed = false;
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
  }  /**
   * Check if the user has sufficient funds for the contribution
   */
  hasSufficientFunds(): boolean {
    // Get value even if the control is disabled
    let amount = this.isInstallment ? 
      this.installmentForm.get('initialAmount')?.value : 
      (this.contributionForm.get('amount')?.disabled ? 
        this.contributionForm.getRawValue().amount : 
        this.contributionForm.get('amount')?.value);
    
    // Handle MongoDB Decimal128 format
    if (amount && typeof amount === 'object' && amount.$numberDecimal) {
      amount = parseFloat(amount.$numberDecimal);
    } else {
      amount = parseFloat(amount) || 0;
    }
      
    return this.walletBalance >= amount;
  }

  /**
   * Submit the contribution
   */  submitContribution(): void {
    // Check if user has already contributed
    if (this.hasAlreadyContributed) {
      this.toastService.error('You have already contributed to this cycle');
      return;
    }
    
    if (this.isInstallment && !this.installmentForm.valid) {
      this.toastService.error('Please complete all installment fields correctly.');
      this.installmentForm.markAllAsTouched();
      return;
    }
      // Check validity but skip disabled controls which shouldn't be validated
    // They're intentionally disabled with preset values
    const amountControlDisabled = this.contributionForm.get('amount')?.disabled;
    if (!amountControlDisabled && !this.contributionForm.valid) {
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
      
      const communityId = this.contributionForm.getRawValue().communityId;
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
    }    // Prepare the request data
    // Use getRawValue() which retrieves values from both enabled and disabled controls
    const formValues = this.contributionForm.getRawValue();
    
    const contributionData: any = {
      userId,
      communityId: formValues.communityId,
      amount: formValues.amount,
      midCycleId: this.activeMidCycle._id  // Use without optional chaining to ensure it's not undefined
    };
    
    // Include next-in-line payment information if applicable
    if (this.hasNextInLineDue && this.nextInLineInfo) {
      contributionData.nextInLinePayment = {
        amountToDeduct: this.nextInLineInfo.amountToDeduct,
        effectiveContribution: this.getEffectiveContributionAmount()
      };
    }
    
    // Log the contribution data for debugging
    console.log('Preparing contribution data:', {
      ...contributionData,
      activeMidCycleDetails: this.activeMidCycle ? {
        _id: this.activeMidCycle._id,
        isComplete: this.activeMidCycle.isComplete,
        cycleNumber: this.activeMidCycle.cycleNumber
      } : null,
      nextInLineInfo: this.nextInLineInfo
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
   * Check if the user owes payment to the next in line member
   * This validates if a user previously received a payout from the current next-in-line member
   * and provides information about any amount that may be deducted from their contribution
   */  
  checkNextInLinePayment(): void {
    // Get current contribution amount (may be 0 if not yet set by user)
    const currentAmount = this.contributionForm.get('amount')?.value || 0;
    const communityId = this.contributionForm.get('communityId')?.value;
    const userId = this.authService.currentUserValue?.id;
    
    if (!communityId || !this.activeMidCycle || !userId) {
      this.nextInLineInfo = null;
      this.hasNextInLineDue = false;
      return;
    }
    
    // Ensure we have a valid midCycleId
    const midCycleId = this.activeMidCycle._id;
    if (!midCycleId) {
      console.error('Invalid midCycleId:', this.activeMidCycle);
      this.nextInLineInfo = null;
      this.hasNextInLineDue = false;
      return;
    }
    
    // Prevent duplicate API calls by checking if a request is already in progress
    if (this.nextInLineCheckInProgress) {
      console.log('Next-in-line check already in progress. Skipping duplicate request.');
      return;
    }
    
    this.nextInLineLoading = true;
    this.nextInLineCheckInProgress = true;
    
    // Use a minimum amount for the API call if the user hasn't entered one yet
    const amountForCheck = Math.max(currentAmount, this.minContributionAmount);
    
    console.log('Checking next-in-line payment with params:', {
      communityId,
      contributorId: userId,
      midCycleId,
      contributionAmount: amountForCheck
    });
    
    // Call the payNextInLine method to check if the user owes payment
    this.communityService.payNextInLine(
      communityId,
      userId,
      midCycleId,
      amountForCheck
    ).subscribe({
      next: (response) => {
        console.log('Next-in-line payment response:', response);
        this.nextInLineLoading = false;
        this.nextInLineCheckInProgress = false;
        
        // If there's an amount to deduct, show the info
        if (response && response.amountToDeduct && response.amountToDeduct > 0) {this.nextInLineInfo = {
            message: response.message,
            amountToDeduct: response.amountToDeduct,
            effectiveContribution: Math.max(0, amountForCheck - response.amountToDeduct)
          };
          this.hasNextInLineDue = true;
            // Set the flag to disable the amount input when the user owes money
          this.amountInputDisabled = true;          // Disable the amount form control - this is the proper way to disable reactive form controls
          const amountControl = this.contributionForm.get('amount');
          if (amountControl) {
            amountControl.disable({emitEvent: false});
            console.log('Form control disabled:', amountControl.disabled);
            console.log('Amount control status:', {
              disabled: amountControl.disabled,
              value: amountControl.value,
              rawValue: this.contributionForm.getRawValue().amount,
              valid: amountControl.valid,
              errors: amountControl.errors
            });
            
            // Using setTimeout to check if the disabled state persists
            setTimeout(() => {
              console.log('After timeout - Amount control disabled:', amountControl.disabled);
            }, 100);
          }
          
          // Show a toast notification to alert the user
          this.toastService.info(`Note: ${response.amountToDeduct} will be deducted from your contribution based on previous cycle payments.`);
          
          // Calculate required contribution to meet both minimum and owed amount
          const requiredAmount = Math.max(
            this.minContributionAmount + response.amountToDeduct,
            currentAmount
          );
          
          // Update the contribution amount if the user hasn't manually set it yet
          // or if their amount is less than what's required
          if (currentAmount < requiredAmount) {
            console.log(`Setting contribution amount to ${requiredAmount} to cover minimum (${this.minContributionAmount}) plus owed amount (${response.amountToDeduct})`);
            
            // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
            setTimeout(() => {
              this.contributionForm.patchValue({ amount: requiredAmount });
            });
          }        } else {
          this.nextInLineInfo = null;
          this.hasNextInLineDue = false;
          this.amountInputDisabled = false; // Enable the amount input when there's no owed amount
          
          // Enable the amount form control
          this.contributionForm.get('amount')?.enable();
          
          // If there's no amount owed, just ensure minimum contribution
          if (currentAmount < this.minContributionAmount) {
            setTimeout(() => {
              this.contributionForm.patchValue({ amount: this.minContributionAmount });
            });
          }
        }
      },      error: (error) => {        console.error('Error checking next-in-line payment:', error);
        this.nextInLineLoading = false;
        this.nextInLineInfo = null;
        this.hasNextInLineDue = false;
        this.amountInputDisabled = false; // Ensure input is enabled on error
        
        // Make sure to re-enable the amount form control on error
        this.contributionForm.get('amount')?.enable();
        
        // Check if the server is running (this often results in a different error type)
        if (!error.status || error.status === 0) {
          console.error('Server connection issue - backend may not be running');
        }
        // Log more detailed error information for debugging
        else if (error.status === 404) {
          console.error('API endpoint not found. Check the route configuration in the backend.');
          console.error(`URL attempted: /communities/${communityId}/pay-next-in-line`);
          
          // Instead of stopping with an error, just continue without the next-in-line data
          // This allows users to make contributions even if this validation feature is broken
        } else {
          console.error('Error details:', {
            status: error.status,
            message: error.message,
            url: `/communities/${communityId}/pay-next-in-line`
          });
        }
        
        // Even if the API fails, ensure minimum contribution amount is set
        const currentAmount = this.contributionForm.get('amount')?.value || 0;
        if (currentAmount < this.minContributionAmount) {
          setTimeout(() => {
            this.contributionForm.patchValue({ amount: this.minContributionAmount });
            console.log(`API call failed but setting minimum contribution amount: ${this.minContributionAmount}`);
          });
        }
      }
    });
  }  /**
   * Helper method to get the effective contribution amount after any deductions
   */
  getEffectiveContributionAmount(): number {
    // Get value even from disabled controls
    let contributionAmount = this.isInstallment ? 
      this.installmentForm.get('initialAmount')?.value : 
      (this.contributionForm.get('amount')?.disabled ? 
        this.contributionForm.getRawValue().amount : 
        this.contributionForm.get('amount')?.value);
    
    // Handle MongoDB Decimal128 format
    if (contributionAmount && typeof contributionAmount === 'object' && contributionAmount.$numberDecimal) {
      contributionAmount = parseFloat(contributionAmount.$numberDecimal);
    } else {
      contributionAmount = parseFloat(contributionAmount) || 0;
    }
      
    if (this.hasNextInLineDue && this.nextInLineInfo?.amountToDeduct) {
      return Math.max(0, contributionAmount - this.nextInLineInfo.amountToDeduct);
    }
    
    return contributionAmount;
  }

  /**
   * Calculates the minimum required contribution amount based on:
   * 1. The community's minimum contribution setting
   * 2. Any amount owed to the next-in-line member
   * @returns The minimum required contribution amount
   */
  getMinimumRequiredContribution(): number {
    let minimumRequired = this.minContributionAmount;
    
    // Add any amount owed to the next-in-line
    if (this.hasNextInLineDue && this.nextInLineInfo?.amountToDeduct) {
      // The user needs to contribute at least the minimum plus whatever they owe
      minimumRequired += this.nextInLineInfo.amountToDeduct;
    }

    
    return minimumRequired;
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
  
  /**
   * Debug method to output form state to console
   * This helps troubleshoot issues with disabled state
   */
  logFormState(): void {
    const amountControl = this.contributionForm.get('amount');
    console.log('Form State Debug:');
    console.log('- Amount control disabled:', amountControl?.disabled);
    console.log('- amountInputDisabled flag:', this.amountInputDisabled);
    console.log('- Amount value:', amountControl?.value);
    console.log('- Raw amount value:', this.contributionForm.getRawValue().amount);
    console.log('- Form valid:', this.contributionForm.valid);
  }
}