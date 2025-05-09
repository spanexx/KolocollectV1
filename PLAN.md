# Frontend Integration Plan

## Overview

This document outlines the plan for integrating the frontend with the existing backend APIs for the KoloCollect application. Based on our analysis of the backend codebase, we'll create a systematic approach to developing frontend components that interact with these APIs.

## Architecture

- **Framework**: Angular (based on the project structure)
- **State Management**: Angular services with RxJS
- **API Communication**: HTTP Client with interceptors for auth
- **Component Structure**: Feature modules with shared components

## Core Services to Implement

### 1. Authentication Service

```typescript
// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private apiUrl = `${environment.apiUrl}/users`;
  
  constructor(private http: HttpClient) {
    const user = localStorage.getItem('currentUser');
    if (user) {
      this.currentUserSubject.next(JSON.parse(user));
    }
  }
  
  register(user: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }
  
  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        this.currentUserSubject.next(response.user);
      })
    );
  }
  
  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}).pipe(
      tap(() => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        this.currentUserSubject.next(null);
      })
    );
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request-reset-password`, { email });
  }
  
  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, { token, newPassword });
  }
  
  updatePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-password`, { currentPassword, newPassword });
  }
}
```

### 2. Community Service

```typescript
// community.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private apiUrl = `${environment.apiUrl}/communities`;
  
  constructor(private http: HttpClient) {}
  
  getAllCommunities(page: number = 1, limit: number = 10): Observable<any> {
    return this.http.get(`${this.apiUrl}/all?page=${page}&limit=${limit}`);
  }
  
  getCommunityById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }
  
  createCommunity(communityData: any): Observable<any> {
    return this.http.post(this.apiUrl, communityData);
  }
  
  joinCommunity(communityId: string, userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/join/${communityId}`, userData);
  }
  
  leaveCommunity(communityId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${communityId}/leave/${userId}`);
  }
  
  updateSettings(communityId: string, settings: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${communityId}`, { settings });
  }
  
  createVote(communityId: string, voteData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${communityId}/votes`, voteData);
  }
  
  castVote(communityId: string, voteId: string, voteData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${communityId}/votes/${voteId}`, voteData);
  }
  
  getMidCycleContributions(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${communityId}/midcycle-contributions`);
  }
  
  getPayoutInfo(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/payout/${communityId}`);
  }
  
  startNewCycle(communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${communityId}/startNewCycle`, {});
  }
}
```

### 3. Wallet Service

```typescript
// wallet.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private apiUrl = `${environment.apiUrl}/wallet`;
  
  constructor(private http: HttpClient) {}
  
  getWalletBalance(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/balance`);
  }
  
  getWalletDetails(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}`);
  }
  
  addFunds(userId: string, amount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/add-funds`, { userId, amount });
  }
  
  withdrawFunds(userId: string, amount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/withdraw-funds`, { userId, amount });
  }
  
  transferFunds(userId: string, recipientId: string, amount: number, description?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/transfer-funds`, { 
      userId, recipientId, amount, description 
    });
  }
  
  getTransactionHistory(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/transactions`);
  }
  
  fixFunds(userId: string, amount: number, duration: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/fix-funds`, { userId, amount, duration });
  }
  
  getFixedFunds(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/fixed-funds`);
  }
}
```

### 4. Contribution Service

```typescript
// contribution.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  private apiUrl = `${environment.apiUrl}/contributions`;
  
  constructor(private http: HttpClient) {}
  
  getContributions(): Observable<any> {
    return this.http.get(this.apiUrl);
  }
  
  getContributionById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }
  
  createContribution(contributionData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create`, contributionData);
  }
  
  updateContribution(id: string, amount: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { amount });
  }
  
  deleteContribution(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
  
  getContributionsByCommunity(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/community/${communityId}`);
  }
  
  getContributionsByUser(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/${userId}`);
  }
}
```

### 5. User Service

```typescript
// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;
  
  constructor(private http: HttpClient) {}
  
  getUserProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/profile`);
  }
  
  getUpcomingPayouts(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/upcoming-payouts`);
  }
  
  cleanUpLogs(userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/clean-up-logs`, {});
  }
  
  getUserCommunities(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/communities`);
  }
  
  getUserNotifications(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/notifications`);
  }
}
```

## TypeScript Interfaces

To better interact with the backend API, we need to define TypeScript interfaces that match the data structures returned by the backend. Based on our analysis of the backend models, here are the key interfaces needed:

```typescript
// models/user.model.ts
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  dateJoined: Date;
  communities: CommunityMembership[];
  contributions?: Contribution[];
  contributionsPaid?: ContributionPaid[];
  penalty?: number;
  votes?: Vote[];
  notifications?: Notification[];
  activityLog?: ActivityLog[];
  payouts?: Payout[];
}

export interface CommunityMembership {
  id: string;
  isAdmin: boolean;
}

export interface ActivityLog {
  action: string;
  details: string;
  date: Date;
}

export interface Notification {
  type: 'info' | 'warning' | 'alert' | 'penalty' | 'payout';
  message: string;
  date: Date;
  communityId?: string;
}

// models/community.model.ts
export interface Community {
  _id: string;
  name: string;
  admin: string;
  description?: string;
  totalContribution: number;
  backupFund: number;
  lockPayout: boolean;
  midCycle: string[] | MidCycle[];
  cycles: string[] | Cycle[];
  members: string[] | Member[];
  nextPayout?: Date;
  payoutDetails: PayoutDetails;
  settings: CommunitySettings;
  positioningMode: 'Random' | 'Fixed';
  cycleLockEnabled: boolean;
  firstCycleMin: number;
  cycleState: 'Active' | 'Locked' | 'Completed';
  votes: string[] | CommunityVote[];
  owingMembers?: OwingMember[];
  activityLog: string[] | CommunityActivityLog[];
}

export interface PayoutDetails {
  nextRecipient?: string;
  cycleNumber: number;
  payoutAmount: number;
  midCycleStatus: string;
}

export interface CommunitySettings {
  contributionFrequency: 'Daily' | 'Weekly' | 'Monthly' | 'Hourly';
  maxMembers: number;
  backupFundPercentage: number;
  isPrivate: boolean;
  minContribution: number;
  penalty: number;
  numMissContribution: number;
  firstCycleMin: number;
}

export interface OwingMember {
  userId: string;
  userName: string;
  remainingAmount: number;
  paidAmount?: number;
  installments: number;
}

// models/member.model.ts
export interface Member {
  _id: string;
  communityId?: string;
  userId: string;
  name: string;
  email: string;
  position?: number;
  status: 'active' | 'inactive' | 'waiting';
  penalty: number;
  missedContributions: MissedContribution[];
  paymentPlan?: PaymentPlan;
}

export interface MissedContribution {
  midCycleId: string;
  amount: number;
  midCycles?: string[];
}

export interface PaymentPlan {
  type: 'Full' | 'Incremental';
  totalPreviousContribution?: number;
  remainingAmount: number;
  previousContribution?: number;
  installments: number;
}

// models/cycle.model.ts
export interface Cycle {
  _id: string;
  communityId: string;
  cycleNumber: number;
  midCycles: string[] | MidCycle[];
  isComplete: boolean;
  startDate: Date;
  endDate?: Date;
  paidMembers: string[];
}

// models/mid-cycle.model.ts
export interface MidCycle {
  _id: string;
  cycleNumber: number;
  nextInLine: { userId: string };
  contributions: MidCycleContribution[];
  isComplete: boolean;
  isReady: boolean;
  payoutAmount: number;
  payoutDate?: Date;
  missedContributions?: string[];
  midCycleJoiners?: MidCycleJoiner[];
}

export interface MidCycleContribution {
  user: string;
  contributions: string[];
}

export interface MidCycleJoiner {
  joiners: string;
  paidMembers: string[];
  isComplete?: boolean;
}

// models/contribution.model.ts
export interface Contribution {
  _id: string;
  communityId: string;
  userId: string;
  amount: number;
  midCycleId: string;
  cycleNumber: number;
  status: 'pending' | 'completed' | 'failed';
  date: Date;
  penalty?: number;
  missedReason?: string;
  paymentPlan?: PaymentPlan;
}

export interface ContributionPaid {
  contributionId: string;
  amount: number;
  option?: string;
}

// models/wallet.model.ts
export interface Wallet {
  _id: string;
  userId: string;
  availableBalance: number;
  fixedBalance: number;
  totalBalance: number;
  transactions: Transaction[];
  fixedFunds?: FixedFund[];
  isFrozen?: boolean;
}

export interface Transaction {
  type: 'deposit' | 'withdrawal' | 'transfer' | 'contribution' | 'payout' | 'penalty' | 'fixed';
  amount: number;
  date: Date;
  description: string;
  recipient?: string;
  communityId?: string;
}

export interface FixedFund {
  amount: number;
  startDate: Date;
  endDate: Date;
  isMatured: boolean;
}

// models/vote.model.ts
export interface CommunityVote {
  _id: string;
  communityId: string;
  topic: string;
  options: string[];
  votes: Vote[];
  numVotes: number;
  resolved: boolean;
  resolution?: string;
  applied: boolean;
}

export interface Vote {
  userId: string;
  choice: string;
}

// models/payout.model.ts
export interface Payout {
  _id?: string;
  communityId: string;
  userId: string;
  amount: number;
  date: Date;
  cycle?: number;
  midCycle?: string;
}

// models/activity-log.model.ts
export interface CommunityActivityLog {
  _id: string;
  communityId: string;
  activityType: string;
  userId: string;
  timestamp: Date;
}
```

## Component Development Plan

### Phase 1: Authentication & Core Structure

1. **Auth Module**
   - LoginComponent - Handles user login
   - RegisterComponent - Manages user registration
   - ForgotPasswordComponent - Initiates password reset flow
   - ResetPasswordComponent - Completes password reset with token
   - AuthGuard - Protects routes from unauthorized access

2. **Core Layout**
   - HeaderComponent - Top navigation and user info
   - SidebarComponent - Main navigation menu
   - DashboardLayoutComponent - Layout wrapper for authenticated views
   - ErrorComponent - Standardized error display
   - LoadingComponent - Loading indicators for async operations

### Phase 2: User Profile & Wallet

1. **User Profile Module**
   - ProfileComponent - Display/edit user information
   - NotificationsComponent - List and manage user notifications
   - ActivityLogComponent - Display user activity history
   - UserSettingsComponent - Handle user preferences

2. **Wallet Module**
   - WalletDashboardComponent - Overview of wallet information
   - AddFundsComponent - Interface for adding funds
   - WithdrawFundsComponent - Interface for withdrawals
   - TransferFundsComponent - Interface for transfers to other users
   - TransactionHistoryComponent - List of wallet transactions
   - FixedFundsComponent - Management of time-locked funds

### Phase 3: Community Management

1. **Community List/Discovery**
   - CommunityListComponent - Display available communities
   - CommunitySearchComponent - Search for communities
   - CommunityFilterComponent - Filter communities by criteria
   - JoinCommunityComponent - Interface for joining communities

2. **Community Management**
   - CreateCommunityComponent - Interface for community creation
   - CommunityDashboardComponent - Overview of a community
   - MemberListComponent - Display and manage community members
   - CommunitySettingsComponent - Configure community settings
   - PenaltyManagementComponent - Handle member penalties
   - CommunityDetailsComponent - Display community information

### Phase 4: Contributions & Payouts

1. **Contribution Module**
   - MakeContributionComponent - Interface for making contributions
   - ContributionHistoryComponent - List of past contributions
   - ContributionDetailsComponent - Details of a specific contribution
   - MissedContributionsComponent - Manage missed contribution payments

2. **Payout Module**
   - PayoutScheduleComponent - Display upcoming payouts
   - PayoutHistoryComponent - List of past payouts received
   - PayoutDetailsComponent - Details of a specific payout
   - NextInLineComponent - Information for next-in-line members

### Phase 5: Advanced Features

1. **Voting System**
   - CreateVoteComponent - Interface for creating new votes
   - ActiveVotesComponent - Display ongoing votes
   - CastVoteComponent - Interface for casting votes
   - VoteResultsComponent - Display vote results and decisions

2. **Analytics & Reporting**
   - FinancialSummaryComponent - Overview of financial activity
   - CommunityActivityComponent - Timeline of community events
   - ContributionAnalyticsComponent - Analysis of contribution patterns
   - PayoutAnalyticsComponent - Analysis of payout distributions

## Detailed Implementation: Community Dashboard

The Community Dashboard will be a key component of the application. Here's how we'll implement it:

```typescript
// community-dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { Community, Member, MidCycle, Cycle } from '../../models';
import { Observable, forkJoin } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-community-dashboard',
  templateUrl: './community-dashboard.component.html',
  styleUrls: ['./community-dashboard.component.scss']
})
export class CommunityDashboardComponent implements OnInit {
  community: Community;
  activeMidCycle: MidCycle;
  members: Member[] = [];
  activeCycle: Cycle;
  isAdmin = false;
  isLoading = true;
  error: string = null;
  
  // Community analytics
  totalContributed = 0;
  completedCycles = 0;
  activeMembers = 0;
  nextPayoutDate: Date = null;
  nextPayoutAmount = 0;
  nextRecipient: Member = null;

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService
  ) {}

  ngOnInit() {
    this.route.params.pipe(
      switchMap(params => {
        this.isLoading = true;
        return this.communityService.getCommunityById(params.id);
      }),
      catchError(error => {
        this.error = error.message || 'Failed to load community';
        this.isLoading = false;
        throw error;
      })
    ).subscribe(response => {
      this.community = response.community;
      
      // Extract members
      this.members = this.community.members as Member[];
      this.activeMembers = this.members.filter(m => m.status === 'active').length;
      
      // Find active mid-cycle and cycle
      this.activeMidCycle = (this.community.midCycle as MidCycle[])
        .find(mc => !mc.isComplete);
        
      this.activeCycle = (this.community.cycles as Cycle[])
        .find(c => !c.isComplete);
      
      // Calculate completed cycles
      this.completedCycles = (this.community.cycles as Cycle[])
        .filter(c => c.isComplete).length;
      
      // Set next payout information
      if (this.community.payoutDetails && this.community.payoutDetails.nextRecipient) {
        this.nextPayoutAmount = this.community.payoutDetails.payoutAmount;
        this.nextPayoutDate = this.community.nextPayout;
        this.nextRecipient = this.members.find(
          m => m.userId === this.community.payoutDetails.nextRecipient
        );
      }
      
      this.isLoading = false;
    });
  }

  startNewCycle() {
    this.isLoading = true;
    this.communityService.startNewCycle(this.community._id)
      .pipe(
        catchError(error => {
          this.error = error.message || 'Failed to start new cycle';
          this.isLoading = false;
          throw error;
        })
      )
      .subscribe(response => {
        this.community = response.community;
        this.isLoading = false;
      });
  }

  distributePayouts() {
    this.isLoading = true;
    this.communityService.distributePayouts(this.community._id)
      .pipe(
        catchError(error => {
          this.error = error.message || 'Failed to distribute payouts';
          this.isLoading = false;
          throw error;
        })
      )
      .subscribe(response => {
        // Handle successful payout distribution
        this.isLoading = false;
      });
  }
}
```

## Error Handling Strategy

We'll implement a comprehensive error handling strategy:

1. **Global Error Handler**

```typescript
// services/error.service.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  constructor() {}

  handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error && error.error.error && error.error.error.message) {
        errorMessage = error.error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (error.status === 404) {
        errorMessage = 'The requested resource was not found.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
    }
    
    return throwError(errorMessage);
  }
}
```

1. **Error Interceptor**

```typescript
// interceptors/error.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorService } from '../services/error.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private errorService: ErrorService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return this.errorService.handleError(error);
        })
      );
  }
}
```

1. **Toast Notification Service**

```typescript
// services/notification.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastNotification {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<ToastNotification>();
  public notifications$ = this.notificationSubject.asObservable();

  constructor() {}

  success(message: string, duration: number = 3000): void {
    this.showNotification({
      type: 'success',
      message,
      duration
    });
  }

  error(message: string, duration: number = 5000): void {
    this.showNotification({
      type: 'error',
      message,
      duration
    });
  }

  info(message: string, duration: number = 3000): void {
    this.showNotification({
      type: 'info',
      message,
      duration
    });
  }

  warning(message: string, duration: number = 4000): void {
    this.showNotification({
      type: 'warning',
      message,
      duration
    });
  }

  private showNotification(notification: ToastNotification): void {
    this.notificationSubject.next(notification);
  }
}
```

## Global Error Handling Strategy

### Errow Overview

To implement a robust application-wide error handling system that centralizes error management, provides consistent user feedback, and enhances debugging capabilities.

### 1. Error Service Enhancement

Enhance the existing ErrorService to provide unified error handling across the application:

```typescript
// services/error.service.ts
import { Injectable, ErrorHandler, Inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';
import { ErrorPageService } from './error-page.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  constructor(
    private toastService: ToastService,
    private router: Router,
    private errorPageService: ErrorPageService
  ) {}

  // Global error handler for uncaught errors
  handleError(error: Error | HttpErrorResponse): void {
    let errorMessage: string;
    let errorCode: string;
    let shouldRedirect = false;

    // Handling HTTP errors
    if (error instanceof HttpErrorResponse) {
      // Extract error details from backend response
      const serverError = error.error || {};
      
      // Use standard error codes from backend when available
      errorCode = serverError.error?.code || `HTTP_${error.status}`;
      errorMessage = serverError.error?.message || this.getDefaultErrorMessage(error.status);
      
      // Determine if we should redirect based on error status
      shouldRedirect = this.shouldRedirectToErrorPage(error.status);
    } 
    // Handling client-side errors
    else {
      errorCode = 'CLIENT_ERROR';
      errorMessage = error.message || 'An unexpected error occurred';
      console.error('Client error:', error);
    }

    // Show toast notification for non-critical errors
    if (!shouldRedirect) {
      this.toastService.error(errorMessage);
    }
    // Redirect to error page for critical errors
    else {
      this.errorPageService.setError(errorCode, errorMessage);
      this.router.navigate(['/error']);
    }
  }
  
  // Helper method for HTTP error handling in services
  handleHttpError(error: HttpErrorResponse): Observable<never> {
    this.handleError(error);
    return throwError(() => error);
  }
  
  // Parse validation errors from the backend
  parseValidationErrors(validationErrors: any): { [key: string]: string } {
    const errors: { [key: string]: string } = {};
    
    if (!validationErrors) {
      return errors;
    }
    
    if (Array.isArray(validationErrors)) {
      validationErrors.forEach(error => {
        if (error.field && error.message) {
          errors[error.field] = error.message;
        }
      });
    } else if (typeof validationErrors === 'object') {
      Object.keys(validationErrors).forEach(key => {
        const value = validationErrors[key];
        errors[key] = Array.isArray(value) ? value[0] : value;
      });
    }
    
    return errors;
  }
  
  // Get default error message based on HTTP status
  private getDefaultErrorMessage(status: number): string {
    switch (status) {
      case 0:
        return 'Cannot connect to the server. Please check your internet connection.';
      case 400:
        return 'The request contains invalid data. Please check your input.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to access this resource.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred with your request.';
      case 422:
        return 'The provided data is invalid.';
      case 500:
      case 501:
      case 502:
      case 503:
        return 'A server error occurred. Please try again later.';
      default:
        return `An error occurred (Status code: ${status})`;
    }
  }
  
  // Determine if error should redirect to error page
  private shouldRedirectToErrorPage(status: number): boolean {
    // Only redirect for catastrophic errors
    return status === 0 || status >= 500;
  }
}
```

### 2. Error Page Service

Create a service to manage error information for the error page:

```typescript
// services/error-page.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErrorPageService {
  private errorCodeSubject = new BehaviorSubject<string>('generic');
  private errorMessageSubject = new BehaviorSubject<string>('');
  
  errorCode$ = this.errorCodeSubject.asObservable();
  errorMessage$ = this.errorMessageSubject.asObservable();
  
  setError(code: string, message: string): void {
    this.errorCodeSubject.next(this.mapErrorCode(code));
    this.errorMessageSubject.next(message);
  }
  
  resetError(): void {
    this.errorCodeSubject.next('generic');
    this.errorMessageSubject.next('');
  }
  
  private mapErrorCode(code: string): string {
    if (code.includes('404') || code === 'RESOURCE_NOT_FOUND') {
      return '404';
    } else if (code.includes('403') || code === 'FORBIDDEN') {
      return '403';
    } else if (code === 'HTTP_0') {
      return 'offline';
    } else if (code.includes('500') || code.startsWith('SERVER_')) {
      return '500';
    }
    return 'generic';
  }
}
```

### 3. Global Error Page Component

Create a standalone error page component that uses our shared error component:

```typescript
// app/pages/error-page/error-page.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ErrorComponent } from '../../shared/error/error.component';
import { ErrorPageService } from '../../services/error-page.service';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ErrorComponent],
  template: `
    <div class="error-page-container">
      <app-error 
        [errorCode]="errorCode" 
        [message]="errorMessage" 
        buttonText="Return to Dashboard" 
        buttonLink="/dashboard">
      </app-error>
    </div>
  `,
  styles: [`
    .error-page-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #F9FAFB;
    }
  `]
})
export class ErrorPageComponent implements OnInit {
  errorCode: '404' | '500' | '403' | 'offline' | 'generic' = 'generic';
  errorMessage: string = '';
  
  constructor(private errorPageService: ErrorPageService) {}
  
  ngOnInit(): void {
    this.errorPageService.errorCode$.subscribe(code => {
      this.errorCode = code as '404' | '500' | '403' | 'offline' | 'generic';
    });
    
    this.errorPageService.errorMessage$.subscribe(message => {
      this.errorMessage = message;
    });
  }
}
```

### 4. Update App Configuration

Register the global error handler in app.config.ts:

```typescript
// app.config.ts
import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth-interceptor';
import { ErrorInterceptor } from './core/interceptors/error-interceptor';
import { LoadingInterceptor } from './core/interceptors/loading-interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ErrorService } from './services/error.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: ErrorHandler, useClass: ErrorService }
  ]
};
```

### 5. Update Error Interceptor

Simplify the ErrorInterceptor to delegate to ErrorService:

```typescript
// core/interceptors/error-interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorService } from '../../services/error.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private errorService: ErrorService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        return this.errorService.handleHttpError(error);
      })
    );
  }
}
```

### 6. Add Error Page Route

Add the error page route in app.routes.ts:

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { ErrorPageComponent } from './pages/error-page/error-page.component';

export const routes: Routes = [
  // ... existing routes
  { 
    path: 'error', 
    component: ErrorPageComponent 
  },
  { 
    path: '**', 
    component: ErrorPageComponent 
  }
];
```

## Plan for Updating Components to Use Real Services

### Component Update Strategy

We will incrementally update key components to use our newly implemented services, following this approach:

1. **Navigation Component Updates**:
   - Update Header, Sidebar, and Navigation components to use AuthService for login status
   - Display user information from AuthService in the header/profile section

2. **Dashboard Component**
   - Integrate with UserService, WalletService, and CommunityService
   - Show real user communities, wallet balance, and upcoming payouts

3. **Profile Component**:
   - Use UserService to fetch and display user profile information
   - Implement profile update functionality

4. **Community Components**:
   - Update CommunityList to fetch real communities from CommunityService
   - Implement community details view using real data from CommunityService
   - Add join community functionality  

5. **Wallet Components**:
   - Update WalletDashboard to show real wallet balance and transactions
   - Implement Add Funds, Withdraw Funds and Transfer Funds functionality

6. **Contribution Components**:
   - Update ContributionHistory to show real contributions
   - Implement MakeContribution functionality

### Order of Implementation

1. Authentication Components (Login, Register, etc.)
2. Dashboard Component
3. Profile Component
4. Community Components
5. Wallet Components
6. Contribution Components

### Implementation Details for Key Components

#### 1. Dashboard Component

```typescript
// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { WalletService } from '../../services/wallet.service';
import { CommunityService } from '../../services/community.service';
import { Observable, forkJoin, map, switchMap, of, catchError } from 'rxjs';
import { User } from '../../models/user.model';
import { LoadingService } from '../../services/loading.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user: User | null = null;
  walletBalance: number = 0;
  upcomingPayouts: any[] = [];
  userCommunities: any[] = [];
  recentContributions: any[] = [];
  isLoading = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private walletService: WalletService,
    private communityService: CommunityService,
    private loadingService: LoadingService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
  }

  loadDashboardData(): void {
    const userId = this.authService.currentUserValue?._id;
    
    if (!userId) {
      this.toastService.error('User information not found');
      return;
    }

    // Use forkJoin to make parallel API calls
    forkJoin({
      profile: this.userService.getUserProfile(userId),
      wallet: this.walletService.getWalletBalance(userId),
      payouts: this.userService.getUpcomingPayouts(userId),
      communities: this.userService.getUserCommunities(userId)
    }).pipe(
      catchError(error => {
        this.toastService.error('Error loading dashboard data');
        return of({
          profile: null, 
          wallet: { availableBalance: 0 }, 
          payouts: [], 
          communities: []
        });
      })
    ).subscribe(results => {
      if (results.profile) {
        this.user = results.profile;
      }
      this.walletBalance = results.wallet.availableBalance || 0;
      this.upcomingPayouts = results.payouts || [];
      this.userCommunities = results.communities || [];
    });
  }
}
```

#### 2. Profile Component

```typescript
// profile.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  user: User | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      // Add more fields as needed
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.isLoading = true;
    const userId = this.authService.currentUserValue?._id;

    if (!userId) {
      this.toastService.error('User information not found');
      this.isLoading = false;
      return;
    }

    this.userService.getUserProfile(userId).subscribe({
      next: (user) => {
        this.user = user;
        this.profileForm.patchValue({
          name: user.name,
          email: user.email
          // Update additional fields as needed
        });
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error('Failed to load user profile');
        this.isLoading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      return;
    }

    this.isLoading = true;
    const userId = this.authService.currentUserValue?._id;
    const updatedData = this.profileForm.value;

    this.userService.updateProfile(userId, updatedData).subscribe({
      next: (response) => {
        this.toastService.success('Profile updated successfully');
        this.isLoading = false;
      },
      error: (error) => {
        this.toastService.error('Failed to update profile');
        this.isLoading = false;
      }
    });
  }
}
```

#### 3. Community List Component

```typescript
// community-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommunityService } from '../../services/community.service';
import { LoadingService } from '../../services/loading.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';
import { Community } from '../../models/community.model';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-community-list',
  templateUrl: './community-list.component.html',
  styleUrls: ['./community-list.component.scss']
})
export class CommunityListComponent implements OnInit {
  communities: Community[] = [];
  totalCount: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  searchQuery: string = '';
  filterOptions: any = {};
  isLoading: boolean = false;

  constructor(
    private communityService: CommunityService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCommunities();
    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
  }

  loadCommunities(): void {
    this.communityService.getAllCommunities({
      page: this.pageIndex + 1, // API uses 1-based indexing
      limit: this.pageSize
    }).subscribe({
      next: (response) => {
        this.communities = response.communities;
        this.totalCount = response.totalCount;
      },
      error: (error) => {
        this.toastService.error('Failed to load communities');
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCommunities();
  }

  onSearch(): void {
    if (this.searchQuery.trim()) {
      this.communityService.searchCommunities(this.searchQuery).subscribe({
        next: (response) => {
          this.communities = response.communities;
          this.totalCount = response.communities.length;
        },
        error: (error) => {
          this.toastService.error('Failed to search communities');
        }
      });
    } else {
      this.loadCommunities();
    }
  }

  viewCommunityDetails(communityId: string): void {
    this.router.navigate(['/communities', communityId]);
  }

  joinCommunity(communityId: string): void {
    // Implementation for joining a community
  }
}
```

## High Priority Tasks (Added May 9, 2025)

### Issue: Users Cannot See Their Communities in Make Contribution Component

**Problem:**
The current implementation of loading user communities in the make-contribution component cannot correctly identify which communities a user belongs to. This is because:

1. Communities store references to Member documents in their `members` array
2. Member documents contain the link between communities and users (with the `userId` field)
3. When filtering communities to find those where a user is a member, the application cannot access the userId inside the Member document

**Solution Options:**

1. **Use existing User Communities endpoint:**
   - The backend already has a `/api/users/:userId/communities` endpoint
   - Update the frontend to use this endpoint instead of filtering communities locally

2. **Use Member lookup in Community Service:**
   - Create a new endpoint in the backend: `GET /api/communities/user/:userId`
   - This endpoint will find all communities where the user is a member by:
     - Finding all Member documents with the given userId
     - Getting the communityId from each Member document
     - Finding all communities matching these communityIds

3. **Update Community Service to populate members:**
   - Modify the existing `getAllCommunities` endpoint to accept a `populateMembers=true` parameter
   - When this parameter is set, fully populate the members array with Member documents
   - This allows for frontend filtering based on userId

**Recommended Approach:**
Option 1 is recommended as it uses existing endpoints and requires the least changes.

### Implementation Plan

1. **Frontend Updates:**
   - Update the `loadUserCommunities()` method in the make-contribution component to use the UserService to get the user's communities
   - Remove the local filtering logic that doesn't work

2. **Testing:**
   - Verify that the user's communities are correctly displayed in the dropdown
   - Ensure community selection and installment settings work as expected
  