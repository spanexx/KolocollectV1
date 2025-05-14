# Frontend Integration Plan

## Latest Plan Update (May 14, 2025)

### Mid-Cycle Joining Contribution Enhancement

#### Overview
When users try to join a community mid-cycle, they're not informed about the higher required contribution amount until after submitting the form, which results in a 500 error. This plan addresses how to properly inform users of the required contribution amount before they submit the join form.

#### Key Improvements
1. **Backend API Enhancement**
   - Create a new endpoint to calculate required mid-cycle contribution
   - Reuse the same calculation logic from `addNewMemberMidCycle` method
   
2. **Frontend Dialog Enhancement**
   - Fetch and display required contribution amount
   - Update validation to match the required amount
   - Add explanatory text about mid-cycle contribution requirements

#### Implementation Steps
1. **Backend**
   - Add a new endpoint in communityController
   - Create a method to calculate required contribution without creating the member
   
2. **Frontend**
   - Update join dialog component to fetch required amount
   - Display prominent notice about mid-cycle contribution
   - Update form validation based on this amount

## Latest Plan Update (May 13, 2025)

### Profile Enhancement Plan

#### Overview
This plan outlines the implementation of enhanced profile features including profile picture upload, document verification upload, and file storage integration.

#### Key Features to Implement
1. **Profile Picture Management**
   - Upload/update profile picture
   - Image cropping and resizing
   - Default avatar fallback
   - Profile picture display in header and profile

2. **Document Verification System**
   - ID verification document upload
   - Document status tracking (pending, verified, rejected)
   - Admin verification interface
   - Document type categorization

3. **Media Storage Integration**
   - S3-compatible bucket storage for media files
   - Secure URL generation for access
   - File type validation and security measures
   - File metadata management

#### Backend Implementation

##### 1. Media Controller & Routes
- Create new `mediaController.js` with the following endpoints:
  - `POST /api/media/upload`: Upload files to storage bucket
  - `GET /api/media/url/:fileId`: Generate signed URL for accessing files
  - `DELETE /api/media/files/:fileId`: Delete files from storage
  - `GET /api/media/files/:userId`: List all files for a user

##### 2. User Model Updates
- Add fields to the User model:
  ```javascript
  profilePicture: {
    fileId: String,
    url: String,
    lastUpdated: Date
  },
  verificationDocuments: [{
    fileId: String,
    documentType: {
      type: String,
      enum: ['id', 'passport', 'driverLicense', 'utilityBill', 'other']
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    verifiedDate: Date,
    rejectionReason: String
  }]
  ```

##### 3. Media Service
- Create S3 bucket integration using AWS SDK or compatible library
- Implement file upload, download, and delete operations
- Configure CORS and security settings for the bucket
- Implement file type validation and size limits

##### 4. User Controller Updates
- Add new methods to `userController.js`:
  - `updateProfilePicture`: Update user's profile picture
  - `uploadVerificationDocument`: Upload new verification document
  - `getVerificationDocuments`: Get all verification documents for a user
  - `deleteVerificationDocument`: Delete a verification document

#### Frontend Implementation

##### 1. Media Service
- Create new Angular service `media.service.ts`:
  - `uploadFile(file: File, userId: string, type: string)`: Upload file to backend
  - `getFileUrl(fileId: string)`: Get signed URL for file access
  - `deleteFile(fileId: string)`: Delete file
  - `listUserFiles(userId: string, type: string)`: List files by type

##### 2. Profile Component Updates
- Add profile picture upload functionality:
  - Implement drag-and-drop file upload
  - Add image cropping using ngx-image-cropper
  - Display profile picture in header
- Implement document verification section:
  - Create document upload interface
  - Show upload status and verification state
  - Implement document deletion

##### 3. Document Verification Component
- Create new component for document verification:
  - Document type selection (ID, passport, etc.)
  - Upload interface with preview
  - Status tracking UI
  - Verification status indicators

##### 4. Admin Verification Interface
- Create admin interface for verifying uploaded documents:
  - List all pending documents
  - View document details and image
  - Approve or reject with reason
  - Send notification on status change

#### Integration Plan
1. Implement Backend API endpoints first (2 days)
2. Create Media Service for the frontend (1 day)
3. Update User model and implement profile picture feature (1 day)
4. Implement document verification frontend (1 day)
5. Create admin verification interface (1 day)
6. Testing and refinement (1 day)

#### Technical Considerations
1. **Security**: 
   - Implement proper access control for media files
   - Use signed URLs with expiration for file access
   - Validate file types and scan for malware

2. **Performance**:
   - Implement image resizing and compression
   - Use client-side cropping to reduce upload size
   - Implement progressive loading for images

3. **Storage**:
   - Configure proper bucket lifecycle policies
   - Implement file cleanup for rejected documents
   - Set up monitoring and quotas

#### Estimated Timeline
- Total implementation time: 7 days
- Target completion date: May 20, 2025

## Previous Plan Update (May 12, 2025)

### Transaction History Component Implementation Plan

#### Overview
This plan outlines the implementation of a comprehensive Transaction History component for the wallet section. The component will allow users to view their transaction history with filtering, sorting, pagination, and export capabilities.

#### Key Features
1. **Transaction Listing**: Display all transactions with type, amount, date, description, and status
2. **Advanced Filtering**: Filter by transaction type, date range, amount, status, and search
3. **Sorting and Pagination**: Sort by any column with server-side pagination
4. **Export Options**: Export transaction history as CSV or PDF
5. **Responsive Design**: Work seamlessly on desktop and mobile devices

#### Implementation Steps
1. **Backend Enhancements**:
   - Update `getTransactionHistory` in walletController.js for advanced filtering
   - Add pagination, sorting, and export capabilities
   - Create export endpoints for CSV and PDF formats

2. **Frontend Implementation**:
   - Enhance wallet service with new API methods
   - Create transaction history component with filter panel
   - Implement material table with sorting and pagination
   - Add export functionality
   - Connect with existing wallet dashboard

3. **Testing and Finalization**:
   - Test all filtering, sorting, and pagination functions
   - Verify export functionality
     - Implement proper PDF generation with PDFKit
     - Fix CSV export response handling
   - Ensure responsive design works on all devices
   - Replace Angular Material icons with Font Awesome for consistency

### Community Detail Component Refactoring Plan

#### Overview

The community detail component has grown too large and complex, handling multiple responsibilities. This leads to maintenance challenges, performance issues, and makes future feature development more difficult. This plan outlines how to break down the monolithic community detail component into smaller, more manageable components with clear responsibilities.

#### Component Decomposition Strategy

1. **Parent Components**
   - `CommunityDetailComponent` - Main container, handles routing and basic community data fetching
   - `CommunityHeaderComponent` - Header with community info and join/leave functionality
   - `CommunityTabsComponent` - Tab navigation container

2. **Tab Components**
   - `CommunityOverviewComponent` - Overview tab content
   - `CommunityMembersComponent` - Members tab content
   - `CommunityMidcycleComponent` - Midcycle tab content
   - `CommunityContributionHistoryComponent` - Contribution history tab content
   - `CommunityVotesComponent` - Votes tab content
   - `CommunityPayoutsComponent` - Payouts tab content

3. **Reusable Feature Components**
   - `CommunitySharingComponent` - Sharing and export functionality
   - `MidcycleProgressComponent` - Midcycle progress visualization
   - `VoteCreationComponent` - Vote creation form (admin only)
   - `VoteListComponent` - List of community votes
   - `PayoutScheduleComponent` - Payout scheduling information
   - `CommunityStatusComponent` - Community status indicator

#### State Management Improvements

- Create a `CommunityStateService` to manage shared state between components
- Implement a `MidcycleStateService` to handle midcycle-specific state
- Develop a `VotingStateService` to manage vote creation and casting

#### Implementation Steps

1. Create the folder structure for the new components
2. Implement the parent container components first
3. Extract the tab components one by one, starting with the simplest ones
4. Create reusable feature components that can be shared across tabs
5. Update routing and navigation to work with the new component structure
6. Implement state management services to handle shared state
7. Test and verify each component as it's extracted

### Previous Plan Update (May 10, 2025)

### Member Service Implementation Plan

#### Overview

Currently, the Kolocollect application is treating community members as simple objects within the community data structure, but they are actually references to Member documents. This leads to improper handling in the frontend components, specifically in the `getActiveMemberCount` function of the community-list component.

This plan outlines how to properly create APIs for the Member schema, establish a Member service, and integrate these properly with the community list component.

#### Backend Changes

1. **Create Member Controller**
   - Implement RESTful APIs to handle member operations
   - Include endpoints for:
     - Get all members
     - Get members by community ID
     - Get member by ID
     - Update member status
     - Get active member count by community ID

2. **Create Member Routes**
   - Define routes for the member controller endpoints
   - Implement proper middleware for authentication and validation

#### Frontend Changes

1. **Create Member Model**
   - Ensure the frontend Member model aligns with the backend model
   - Define proper interfaces for API responses

2. **Implement Member Service**
   - Create a service to interact with the Member APIs
   - Include methods for:
     - Getting all members
     - Getting members by community ID
     - Getting member by ID
     - Updating member status
     - Getting active member count

3. **Update Community List Component**
   - Refactor `getActiveMemberCount` to use the Member service
   - Update `isCommunityFull` to use the new service
   - Remove console.log statements and improve error handling

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
  
  // New method for getting community contribution history
  getCommunityContributionHistory(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${communityId}/contribution-history`);
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
  
  // New method to get contributions by cycle for a community
  getContributionsByCycle(communityId: string, cycleId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/community/${communityId}/cycle/${cycleId}`);
  }
  
  // New method to get contributions by midcycle for a community
  getContributionsByMidcycle(communityId: string, midcycleId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/community/${communityId}/midcycle/${midcycleId}`);
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

## New Feature: Enhanced Community Contribution History

### Backend API Endpoint

To implement the enhanced community contribution history display, we'll create a new endpoint that will provide a structured view of contributions organized by cycles and midcycles.

```javascript
// In controllers/contributionController.js

// Get detailed community contribution history
exports.getCommunityContributionHistory = async (req, res) => {
  try {
    const { communityId } = req.params;
    
    // First, find the community and populate cycles and mid-cycles
    const community = await Community.findById(communityId)
      .populate('cycles')
      .populate({
        path: 'midCycle',
        populate: {
          path: 'contributions',
          populate: [
            { path: 'user', select: 'name email' },
            { path: 'contributions' }
          ]
        }
      });
    
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    }
    
    // Group midcycles by their cycle number
    const cyclesWithMidcycles = {};
    
    // Process cycles
    if (community.cycles && community.cycles.length > 0) {
      community.cycles.forEach(cycle => {
        cyclesWithMidcycles[cycle.cycleNumber] = {
          cycle: {
            _id: cycle._id,
            cycleNumber: cycle.cycleNumber,
            startDate: cycle.startDate,
            expectedEndDate: cycle.expectedEndDate,
            isComplete: cycle.isComplete
          },
          midcycles: []
        };
      });
    }
    
    // Process midcycles and add them to their parent cycle
    if (community.midCycle && community.midCycle.length > 0) {
      community.midCycle.forEach(midcycle => {
        const cycleNumber = midcycle.cycleNumber;
        
        // If we don't have this cycle yet, add it to our structure
        if (!cyclesWithMidcycles[cycleNumber]) {
          cyclesWithMidcycles[cycleNumber] = {
            cycle: {
              cycleNumber,
              startDate: midcycle.startDate, // Approximation
              isComplete: midcycle.isComplete
            },
            midcycles: []
          };
        }
        
        // Format contributions data
        let enhancedContributions = [];
        if (midcycle.contributions && midcycle.contributions.length > 0) {
          enhancedContributions = midcycle.contributions.map(contribution => {
            // Calculate total contribution amount
            let totalAmount = 0;
            if (contribution.contributions && contribution.contributions.length > 0) {
              totalAmount = contribution.contributions.reduce((sum, contrib) => {
                const amount = contrib.amount ? 
                  (typeof contrib.amount === 'object' && contrib.amount.toString ? 
                    parseFloat(contrib.amount.toString()) : contrib.amount) : 0;
                return sum + amount;
              }, 0);
            }
            
            return {
              _id: contribution._id,
              user: contribution.user,
              contributions: contribution.contributions.map(c => ({
                _id: c._id,
                amount: typeof c.amount === 'object' ? parseFloat(c.amount.toString()) : c.amount,
                date: c.date,
                status: c.status
              })),
              totalAmount: totalAmount
            };
          });
        }
        
        // Get next in line member details
        let nextInLineDetails = null;
        if (midcycle.nextInLine && midcycle.nextInLine.userId) {
          const nextInLineMember = community.members.find(m => 
            m.userId && m.userId.equals(midcycle.nextInLine.userId)
          );
          
          if (nextInLineMember) {
            nextInLineDetails = {
              userId: nextInLineMember.userId,
              name: nextInLineMember.name,
              email: nextInLineMember.email,
              position: nextInLineMember.position
            };
          }
        }
        
        // Add mid-cycle to its parent cycle group
        cyclesWithMidcycles[cycleNumber].midcycles.push({
          _id: midcycle._id,
          cycleNumber: midcycle.cycleNumber,
          isReady: midcycle.isReady,
          isComplete: midcycle.isComplete,
          payoutDate: midcycle.payoutDate,
          payoutAmount: midcycle.payoutAmount,
          nextInLine: nextInLineDetails,
          contributions: enhancedContributions
        });
      });
    }
    
    // Convert to array for easier frontend processing
    const contributionHistory = Object.values(cyclesWithMidcycles);
    
    res.status(200).json({
      status: 'success',
      message: 'Community contribution history retrieved successfully',
      data: contributionHistory
    });
  } catch (err) {
    console.error('Error fetching contribution history:', err);
    return createErrorResponse(
      res, 
      500, 
      'GET_CONTRIBUTION_HISTORY_ERROR', 
      'Error retrieving contribution history: ' + err.message
    );
  }
};
```

### Route Configuration

```javascript
// In routes/communityRoutes.js

// Get community contribution history
router.get('/:communityId/contribution-history', communityController.getCommunityContributionHistory);
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

## Enhanced Community Contribution History Implementation (✅ COMPLETED)

### Problem Statement

Currently, the contribution history in the community detail page shows a flat list of mid-cycles without organizing them by their parent cycles. This makes it difficult for users to understand the contribution structure and track the history properly.

### Solution (Implemented)

Implemented a hierarchical view for the contribution history that:

1. Groups mid-cycles by their parent cycles
2. Shows detailed contribution information when a mid-cycle is clicked
3. Displays next-in-line recipient and individual member contributions for each mid-cycle

### Backend Implementation

#### 1. New API Endpoint

Create a dedicated endpoint to retrieve the community contribution history:

```javascript
// In controllers/community-history.js

// Get community contribution history
exports.getCommunityContributionHistory = async (req, res) => {
  try {
    const { communityId } = req.params;
    
    // First, find the community and populate cycles and mid-cycles
    const community = await Community.findById(communityId)
      .populate('cycles')
      .populate({
        path: 'midCycle',
        populate: {
          path: 'contributions',
          populate: [
            { path: 'user', select: 'name email' },
            { path: 'contributions', 
              model: 'Contribution', 
              select: 'amount date status' }
          ]
        }
      });
    
    if (!community) {
      return createErrorResponse(res, 404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    }
    
    // Group midcycles by their cycle number
    const cyclesWithMidcycles = {};
    
    // Process cycles
    if (community.cycles && community.cycles.length > 0) {
      community.cycles.forEach(cycle => {
        cyclesWithMidcycles[cycle.cycleNumber] = {
          cycle: {
            _id: cycle._id,
            cycleNumber: cycle.cycleNumber,
            startDate: cycle.startDate,
            expectedEndDate: cycle.expectedEndDate,
            isComplete: cycle.isComplete
          },
          midcycles: []
        };
      });
    }
    
    // Process midcycles and add them to their parent cycle
    if (community.midCycle && community.midCycle.length > 0) {
      community.midCycle.forEach(midcycle => {
        const cycleNumber = midcycle.cycleNumber;
        
        // If we don't have this cycle yet, add it to our structure
        if (!cyclesWithMidcycles[cycleNumber]) {
          cyclesWithMidcycles[cycleNumber] = {
            cycle: {
              cycleNumber,
              startDate: midcycle.startDate, // Approximation
              isComplete: midcycle.isComplete
            },
            midcycles: []
          };
        }
        
        // Format contributions data
        let enhancedContributions = [];
        if (midcycle.contributions && midcycle.contributions.length > 0) {
          enhancedContributions = midcycle.contributions.map(contribution => {
            // Calculate total contribution amount
            let totalAmount = 0;
            if (contribution.contributions && contribution.contributions.length > 0) {
              totalAmount = contribution.contributions.reduce((sum, contrib) => {
                const amount = contrib.amount ? 
                  (typeof contrib.amount === 'object' && contrib.amount.toString ? 
                    parseFloat(contrib.amount.toString()) : contrib.amount) : 0;
                return sum + amount;
              }, 0);
            }
            
            return {
              _id: contribution._id,
              user: contribution.user,
              contributions: contribution.contributions.map(c => ({
                _id: c._id,
                amount: typeof c.amount === 'object' ? parseFloat(c.amount.toString()) : c.amount,
                date: c.date,
                status: c.status
              })),
              totalAmount: totalAmount
            };
          });
        }
        
        // Get next in line member details
        let nextInLineDetails = null;
        if (midcycle.nextInLine && midcycle.nextInLine.userId) {
          const nextInLineMember = community.members.find(m => 
            m.userId && m.userId.equals(midcycle.nextInLine.userId)
          );
          
          if (nextInLineMember) {
            nextInLineDetails = {
              userId: nextInLineMember.userId,
              name: nextInLineMember.name,
              email: nextInLineMember.email,
              position: nextInLineMember.position
            };
          }
        }
        
        // Add mid-cycle to its parent cycle group
        cyclesWithMidcycles[cycleNumber].midcycles.push({
          _id: midcycle._id,
          cycleNumber: midcycle.cycleNumber,
          isReady: midcycle.isReady,
          isComplete: midcycle.isComplete,
          payoutDate: midcycle.payoutDate,
          payoutAmount: midcycle.payoutAmount,
          nextInLine: nextInLineDetails,
          contributions: enhancedContributions
        });
      });
    }
    
    // Convert to array for easier frontend processing
    const contributionHistory = Object.values(cyclesWithMidcycles);
    
    res.status(200).json({
      status: 'success',
      message: 'Community contribution history retrieved successfully',
      data: contributionHistory
    });
  } catch (err) {
    console.error('Error fetching contribution history:', err);
    return createErrorResponse(
      res, 
      500, 
      'GET_CONTRIBUTION_HISTORY_ERROR', 
      'Error retrieving contribution history: ' + err.message
    );
  }
};
```

#### 2. Register the route in communityRoutes.js

```javascript
// In routes/communityRoutes.js

// Get community contribution history
router.get('/:communityId/contribution-history', communityHistoryController.getCommunityContributionHistory);
```

### Frontend Implementation

#### 1. Update Community Service

Add a new method to the CommunityService to call the new API endpoint:

```typescript
// In services/community.service.ts

// Get community contribution history
getCommunityContributionHistory(communityId: string): Observable<any> {
  return this.http.get(`${this.apiUrl}/${communityId}/contribution-history`);
}
```

#### 2. Create a Component for Hierarchical Contribution History

Implement a component to display the hierarchical contribution history:

```typescript
// In components/contribution/contribution-history-hierarchical/contribution-history-hierarchical.component.ts

@Component({
  selector: 'app-contribution-history-hierarchical',
  templateUrl: './contribution-history-hierarchical.component.html',
  styleUrls: ['./contribution-history-hierarchical.component.scss']
})
export class ContributionHistoryHierarchicalComponent implements OnInit {
  @Input() communityId: string;
  contributionHistory: any[] = [];
  expandedCycles: Set<string> = new Set();
  selectedMidcycle: any = null;
  isLoading = false;
  
  constructor(
    private communityService: CommunityService,
    private toastService: ToastService
  ) {}
  
  ngOnInit(): void {
    this.loadContributionHistory();
  }
  
  loadContributionHistory(): void {
    if (!this.communityId) return;
    
    this.isLoading = true;
    this.communityService.getCommunityContributionHistory(this.communityId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.contributionHistory = response.data;
            // Auto-expand current cycle
            const currentCycle = this.contributionHistory.find(c => !c.cycle.isComplete);
            if (currentCycle) {
              this.expandedCycles.add(currentCycle.cycle._id);
            }
          }
        },
        error: (error) => {
          this.toastService.error('Failed to load contribution history');
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
    this.selectedMidcycle = midcycle;
  }
  
  getContributionTotal(midcycle: any): number {
    return midcycle.contributions.reduce((total, contribution) => {
      return total + (contribution.totalAmount || 0);
    }, 0);
  }
}
```

#### 3. HTML Template for the Component

```html
<!-- In components/contribution/contribution-history-hierarchical/contribution-history-hierarchical.component.html -->

<div class="contribution-history-container">
  <mat-progress-spinner *ngIf="isLoading" [diameter]="30" mode="indeterminate"></mat-progress-spinner>
  
  <div *ngIf="!isLoading && contributionHistory.length === 0" class="empty-state">
    No contribution history available
  </div>
  
  <div *ngIf="!isLoading && contributionHistory.length > 0" class="cycles-container">
    <!-- Cycle accordion -->
    <mat-accordion>
      <mat-expansion-panel *ngFor="let cycleData of contributionHistory" 
                           [expanded]="isCycleExpanded(cycleData.cycle._id)"
                           (opened)="toggleCycle(cycleData.cycle._id)">
        <mat-expansion-panel-header>
          <mat-panel-title>
            <div class="cycle-header">
              <span class="cycle-number">Cycle #{{ cycleData.cycle.cycleNumber }}</span>
              <span class="cycle-status" 
                    [ngClass]="cycleData.cycle.isComplete ? 'complete' : 'active'">
                {{ cycleData.cycle.isComplete ? 'Completed' : 'Active' }}
              </span>
            </div>
          </mat-panel-title>
          <mat-panel-description>
            {{ cycleData.midcycles.length }} midcycles
          </mat-panel-description>
        </mat-expansion-panel-header>
        
        <!-- Midcycles list -->
        <div class="midcycles-list">
          <mat-card *ngFor="let midcycle of cycleData.midcycles" 
                    class="midcycle-card"
                    [ngClass]="{'selected': selectedMidcycle?._id === midcycle._id}"
                    (click)="selectMidcycle(midcycle)">
            <mat-card-content>
              <div class="midcycle-header">
                <span class="midcycle-number">Midcycle #{{ midcycle.cycleNumber }}</span>
                <span class="midcycle-status"
                      [ngClass]="{
                        'complete': midcycle.isComplete, 
                        'ready': !midcycle.isComplete && midcycle.isReady,
                        'pending': !midcycle.isComplete && !midcycle.isReady
                      }">
                  {{ midcycle.isComplete ? 'Completed' : midcycle.isReady ? 'Ready' : 'In Progress' }}
                </span>
              </div>
              <div class="midcycle-info">
                <div>
                  <strong>Payout Amount:</strong> €{{ midcycle.payoutAmount | number:'1.2-2' }}
                </div>
                <div *ngIf="midcycle.payoutDate">
                  <strong>Payout Date:</strong> {{ midcycle.payoutDate | date }}
                </div>
                <div *ngIf="midcycle.nextInLine">
                  <strong>Next In Line:</strong> {{ midcycle.nextInLine.name }}
                </div>
                <div>
                  <strong>Contributions:</strong> {{ midcycle.contributions.length }}
                  (€{{ getContributionTotal(midcycle) | number:'1.2-2' }})
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-expansion-panel>
    </mat-accordion>
  </div>
  
  <!-- Selected midcycle details -->
  <div *ngIf="selectedMidcycle" class="midcycle-details">
    <h3>Midcycle {{ selectedMidcycle.cycleNumber }} Details</h3>
    
    <div class="next-in-line-section" *ngIf="selectedMidcycle.nextInLine">
      <h4>Next In Line</h4>
      <div class="next-in-line-card">
        <div class="recipient-name">{{ selectedMidcycle.nextInLine.name }}</div>
        <div class="recipient-email">{{ selectedMidcycle.nextInLine.email }}</div>
        <div class="recipient-position">Position: {{ selectedMidcycle.nextInLine.position }}</div>
      </div>
    </div>
    
    <div class="contributions-section">
      <h4>Contributions</h4>
      <table mat-table [dataSource]="selectedMidcycle.contributions" class="contributions-table">
        <!-- Contributor Column -->
        <ng-container matColumnDef="contributor">
          <th mat-header-cell *matHeaderCellDef>Contributor</th>
          <td mat-cell *matCellDef="let contribution">{{ contribution.user.name }}</td>
        </ng-container>
        
        <!-- Amount Column -->
        <ng-container matColumnDef="amount">
          <th mat-header-cell *matHeaderCellDef>Total Amount</th>
          <td mat-cell *matCellDef="let contribution">€{{ contribution.totalAmount | number:'1.2-2' }}</td>
        </ng-container>
        
        <!-- Contributions Count Column -->
        <ng-container matColumnDef="count">
          <th mat-header-cell *matHeaderCellDef># Contributions</th>
          <td mat-cell *matCellDef="let contribution">{{ contribution.contributions.length }}</td>
        </ng-container>
        
        <tr mat-header-row *matHeaderRowDef="['contributor', 'amount', 'count']"></tr>
        <tr mat-row *matRowDef="let row; columns: ['contributor', 'amount', 'count'];"></tr>
      </table>
      
      <div *ngIf="selectedMidcycle.contributions.length === 0" class="no-contributions">
        No contributions in this midcycle
      </div>
    </div>
  </div>
</div>
```

#### 4. Integration in Community Detail Component

Update the community detail component to use the new hierarchical contribution history component:

```typescript
// In community-detail.component.html

<mat-tab label="Contribution History">
  <div class="tab-content">
    <app-contribution-history-hierarchical [communityId]="community._id">
    </app-contribution-history-hierarchical>
  </div>
</mat-tab>
```

### Benefits of this Implementation

1. **Improved Organization**: Users can easily see the relationship between cycles and mid-cycles.
2. **Better Context**: When viewing contribution history, users have clear context of which cycle a mid-cycle belongs to.
3. **Detailed Information**: Users can view detailed contribution information for each mid-cycle.
4. **Recipient Transparency**: Next-in-line recipient information is clearly displayed for each mid-cycle.
5. **Contribution Tracking**: Individual member contributions are clearly displayed with amounts and counts.

### Implementation Timeline

1. Backend implementation: 1 day
2. Frontend implementation: 2 days
3. Testing and bug fixes: 1 day
4. UI/UX refinement: 1 day

Total: 5 days
