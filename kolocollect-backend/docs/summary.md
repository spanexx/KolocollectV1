# KoloCollect System Documentation (Updated)

## System Workflow: Schema Integration

### 1. User Onboarding & Community Creation
```pseudo
User Schema → Wallet Schema → Community Schema
1. User registers → Wallet auto-created
2. User creates community → Community.admin linked to User._id
3. Community settings initialized with default financial rules
```

### 2. Contribution Lifecycle
```pseudo
User → Contribution → Community → Wallet
1. User initiates contribution:
   - Validate against Community.settings.minContribution
   - Check Wallet.availableBalance
2. Create Contribution record:
   - Link to Community.midCycle
   - Update User.contributionsPaid
3. Community processes:
   - Update midCycle.contributions
   - Calculate backupFund allocation
4. Wallet updates:
   - Deduct amount + penalties
   - Create transaction record
```

### 3. Payout Distribution
```pseudo
Community → Wallet → User
1. Mid-cycle completion triggers payout:
   - Calculate payoutAmount (totalContributions - backupFund)
   - Select nextRecipient via positioning logic
2. Wallet operations:
   - Community backupFund adjusted
   - Recipient Wallet.availableBalance += payoutAmount
3. User updates:
   - Add payout record
   - Update activityLog
```

### 4. Penalty Enforcement Loop
```pseudo
Community → User → Wallet
1. Detect missed contribution:
   - Community tracks defaulters
   - Update User.penalty
2. Automatic deduction:
   - Wallet.deductPenalty()
   - Community.backupFund += penaltyAmount
3. Notifications:
   - User.notifications updated
   - activityLog entry created

### 5. Cross-Schema Validation
- User.communities ↔ Community.members
- Contribution.communityId → Community._id
- Wallet.transactions.communityId → Community._id
- User.payouts ↔ Community.payoutDetails

## Key Integration Points
1. **Financial Tracking**:
   - Wallet.balance ↔ Contribution.amount
   - Community.backupFund ← Wallet.penalty transactions

2. **Cycle Synchronization**:
   - Community.cycleNumber → Contribution.cycleNumber
   - MidCycle.payoutDate → Wallet.transaction.date

3. **Security Enforcement**:
   - User.role → Community admin privileges
   - Wallet.isFrozen blocks all transactions

4. **Audit Trails**:
   - User.activityLog ← Contribution/Wallet events
   - Community.activityLog ← system changes
