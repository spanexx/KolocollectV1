# KoloCollect Implementation Memory

## Last Updated: May 10, 2025

This document serves as a reference for important information related to the KoloCollect project implementation.

INSTRUCTION!!

When you are done with any component check for all problems.
 if there is a problem that cannot be fixed immediately update this file with the probelm.  
 incase you used a nonexisting function or variables

 ALWAYS GIVE CMD FOR POWERSHELL

## Issues Fixed Today (May 10, 2025)

### 1. Fixed ContributionHistoryHierarchicalComponent duplicate summary section

- **Problem**: The component had duplicate summary sections showing the same statistics twice
- **Solution**: Removed the duplicate summary container from the HTML template
- **File**: `contribution-history-hierarchical.component.html`

### 2. Enhanced Refresh Buttons in Contribution History Components

- **Problem**: The refresh buttons in contribution history components weren't clearly identifiable as refresh buttons
- **Solution**: Added tooltips, improved visual styling, and added animation effects to make them more recognizable
  
- **Files**:
  
  - `contribution-history.component.html`
  - `contribution-history.component.scss`
  - `contribution-history-hierarchical.component.html`
  - `contribution-history-hierarchical.component.scss`

### 3. Implemented Community Filter Component

- **Problem**: The community list was using a basic dropdown filter that limited filtering capabilities
- **Solution**: Created a dedicated Community Filter component with comprehensive filter options
  - Implemented filters for community status, contribution amount, backup fund, frequency, and member count
  - Added range sliders for numeric values
  - Created a compact dropdown panel design that doesn't take up too much space
  - Connected to the Community List component for real-time filtering
- **Files**:
  - `community-filter.component.ts`
  - `community-filter.component.html`
  - `community-filter.component.scss`
  - `community-list.component.ts` (updated to use the filter component)
  - `community-list.component.html` (updated layout for filter dropdown)
  - `community-list.component.scss` (added responsive styles)

### 4. Enhanced Filter Button Styling and Animation

- **Problem**: The filter button was missing proper styling and didn't match the design system
- **Solution**: Improved the styling of the filter button to be more visually appealing and functional
  - Added active state styling that changes the button appearance when filters are visible
  - Implemented smooth animations for the filter panel expansion/collapse
  - Added dynamic text that changes between "Show Filters" and "Hide Filters"
  - Improved button color scheme to match the application design system
- **Files**:
  - `community-list.component.html` (updated filter button with dynamic text)
  - `community-list.component.scss` (enhanced button styling with active state)

### 4. Enhanced Community Filter UI for Better Layout

- **Problem**: The initial filter sidebar design was too large and didn't give the community cards enough room
- **Solution**: Redesigned the filter implementation to use a collapsible dropdown panel
  - Changed from a persistent sidebar to a toggle-able dropdown panel
  - Made the filter button accessible next to the search button
  - Implemented a more compact grid layout for filter options
  - Added smooth animations for expand/collapse actions
- **Files**:
  - `community-list.component.html` (replaced sidebar with dropdown panel)
  - `community-list.component.scss` (added dropdown animation and compact styling)
  - `community-filter.component.html` (updated for compact layout)
  - `community-filter.component.scss` (made filter controls more compact)

### 5. Improved Button Styling in Community List Component

- **Problem**: Buttons in the community list had inconsistent styling and anchor buttons showed underlines

- **Solution**:
  
  - Enhanced button styling with consistent gradients and hover effects
  - Added specific styles for each button type (Create Community, Search, Filter, View, Contribute)
  - Removed underlines from buttons that are links
  - Improved spacing and layout in card actions
  - Added smooth transitions and shadow effects for better interactivity
- **Files**:
  - `community-list.component.scss` (updated button styles)
  - `community-list.component.html` (adjusted button classes)

### 5. Enhanced Button Styling in Community List

- **Problem**: Button styling in the community list component was inconsistent and link buttons had underlines
- **Solution**: Improved button styling throughout the community list component:
  - Removed underlines from all link buttons
  - Made the Contribute button semi-transparent with backdrop filter for a modern look
  - Added consistent hover and active state animations
  - Applied gradient backgrounds for a more polished appearance
  - Fixed button spacing and alignment in card actions
  - Added proper transitions for interactive feedback
- **Files**:
  - `community-list.component.scss` (updated styles for all buttons)
  - `community-list.component.html` (left unchanged)

**Command to run the application**:

```powershell
cd c:\Users\shuga\OneDrive\Desktop\PRO\Kolocollect\kolocollect-frontend
npm start
```

## Backend API Structure

### Authentication Endpoints

- POST `/api/users/register` - Register a new user
- POST `/api/users/login` - Authenticate user
- POST `/api/users/request-reset-password` - Request password reset
- POST `/api/users/reset-password` - Reset password with token
- POST `/api/users/logout` - Log out user
- POST `/api/users/update-password` - Update password

### Community Endpoints

- GET `/api/communities/all` - Get all communities (paginated)
- GET `/api/communities/:id` - Get community by ID
- GET `/api/communities/search` - Search communities
- GET `/api/communities/filter` - Filter communities
- POST `/api/communities` - Create a new community
- POST `/api/communities/join/:communityId` - Join a community
- PUT `/api/communities/:communityId` - Update community settings
- DELETE `/api/communities/:communityId` - Delete a community
- POST `/api/communities/:communityId/startNewCycle` - Start a new cycle
- GET `/api/communities/:communityId/midcycle-contributions` - Get mid-cycle contributions
- GET `/api/communities/payout/:communityId` - Get payout information

### Contribution Endpoints

- GET `/api/contributions` - Get all contributions
- GET `/api/contributions/:id` - Get contribution by ID
- POST `/api/contributions/create` - Create a new contribution
- PUT `/api/contributions/:id` - Update a contribution
- DELETE `/api/contributions/:id` - Delete a contribution
- GET `/api/contributions/community/:communityId` - Get contributions by community
- GET `/api/contributions/user/:userId` - Get contributions by user

### User Endpoints

- GET `/api/users/:userId/profile` - Get user profile
- GET `/api/users/:userId/upcoming-payouts` - Get upcoming payouts
- POST `/api/users/:userId/clean-up-logs` - Clean up user logs
- GET `/api/users/:userId/communities` - Get user communities
- GET `/api/users/:userId/notifications` - Get user notifications

### Wallet Endpoints

- GET `/api/wallet/:userId/balance` - Get wallet balance
- GET `/api/wallet/:userId` - Get wallet details
- POST `/api/wallet/add-funds` - Add funds to wallet
- POST `/api/wallet/withdraw-funds` - Withdraw funds from wallet
- POST `/api/wallet/transfer-funds` - Transfer funds between wallets
- GET `/api/wallet/:userId/transactions` - Get transaction history
- POST `/api/wallet/:userId/fix-funds` - Fix funds for a duration
- GET `/api/wallet/:userId/fixed-funds` - Get fixed funds

## Key Models and Relationships

### User Model

- Connected to Wallet (one-to-one)
- Connected to Communities (many-to-many)
- Has contributions, notifications, activity logs

### Community Model

- Has members (Users)
- Has cycles and mid-cycles
- Manages contributions and payouts
- Tracks activity logs

### Contribution Model

- Links User, Community, and MidCycle
- Tracks payment status and history

### Wallet Model

- Manages user balance
- Tracks transactions
- Handles fixed funds

## Important Business Rules

### Community Management

- Community requires minimum members to start first cycle (firstCycleMin, default: 5)
- Communities can have different positioning modes (Random or Fixed)
- Communities collect a backup fund percentage from contributions

### Contribution System

- Contributions are validated against minimum amounts
- Users can miss contributions (with penalties)
- Installment payments supported for larger amounts

### Payout System

- Mid-cycles track "next in line" recipients
- Payouts calculated based on total contributions minus backup fund
- Payout distribution has specific status progression

### User Status Management

- Members can be active, inactive, or waiting
- Penalties tracked for missed contributions
- Wallet can be frozen for defaulters

## Implementation Notes

### Authentication Strategy

- JWT tokens for authentication
- Token stored in localStorage
- Auth interceptor for protected API requests

### State Management Approach

- Services with RxJS subjects for most state
- Local storage for persistence of auth state

### Error Handling

- Global error interceptor
- Toast notification service for user feedback
- Specific error codes from backend

## Design System Reference

### Color Palette

- Primary: Deep Purple (#6D28D9)
- Secondary: Emerald Green (#10B981)
- Accent: Amber (#F59E0B)
- Success: #10B981
- Error: #EF4444
- Warning: #F59E0B
- Info: #3B82F6

### Typography

- Primary Font: Inter
- Secondary Font: Poppins
- Size scale from 12px to 48px

### Layout

- Base unit: 4px (0.25rem)
- Responsive breakpoints at 640px, 768px, 1024px, 1280px, 1536px

## Development Standards

### Component Structure

- Feature-based organization
- Shared components in common module
- Lazy-loaded feature modules

### Coding Patterns

- Container/Presentational component pattern
- Observable data services
- Reactive forms for user input
- Async/await for asynchronous operations

### Testing Strategy

- Unit tests for services and component logic
- Component tests for rendering
- Integration tests for feature flows

_______________________________________________________

This Platform will ultimately be a loan shark that will turn out to be an investment platform.
imaagine if users can verify to loan people their backup fund.
They would each access a person applying for loan, and the system will loan the user the money from the backupfund.
For the investment part, the system will create assets that communities can decide to invest in or buy a share in.
More to this later.

lets create an API that allow user to download or share community pages. they can download the page as pdf or share it as an image.

lets create an Api that allow user to share contributions for cycle, or for a midcycle,
