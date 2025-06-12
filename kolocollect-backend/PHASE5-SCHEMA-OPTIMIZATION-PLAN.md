# Phase 5: Schema Design Optimization Plan

## Overview

Address the remaining schema design issues identified in the performance optimization report:

1. Reduce excessive arrays and nested documents in Community schema
2. Split the monolithic Community schema into focused sub-schemas
3. Optimize array field queries with proper referencing strategies

## Issues to Address

### 1. Excessive Arrays in Community Schema

**Current Problems:**

- `midCycle: [ObjectId]` - Can grow very large over time
- `cycles: [ObjectId]` - Unbounded growth
- `members: [ObjectId]` - Can be large for popular communities
- `owingMembers: [nested objects]` - Embedded documents causing performance issues
- `votes: [ObjectId]` - Voting history grows indefinitely
- `activityLog: [ObjectId]` - Activity history is unbounded

**Solutions:**

- Move historical data to separate collections with reverse references
- Keep only active/current data in main Community document
- Implement pagination for large arrays
- Use TTL indexes for temporary data

### 2. Community Schema Complexity (2463 lines)

**Current Problems:**

- Mixed responsibilities: community settings, member management, payout logic
- Large schema makes queries slower
- Difficult to maintain and optimize

**Solutions:**

- Split into focused schemas: CommunityCore, CommunitySettings, CommunityMembers
- Extract payout logic to separate service/schema
- Maintain backward compatibility during migration

### 3. Query Performance Issues

**Current Problems:**

- Deep population of large arrays
- Lack of proper indexing on array elements
- No pagination for array queries

**Solutions:**

- Implement reverse references where appropriate
- Add compound indexes for common query patterns
- Implement pagination helpers for array data

## Implementation Plan

### Step 1: Create Optimized Schema Structure

1. **CommunityCore**: Basic community info + active data only
2. **CommunitySettings**: Configuration and settings
3. **CommunityMembership**: Member relationships with pagination
4. **CommunityHistory**: Historical data (cycles, activity logs)
5. **CommunityOwing**: Owing member data with proper structure

### Step 2: Implement Reverse References

- Move `midCycle` array to MidCycle collection with `communityId` reference
- Move `cycles` array to Cycle collection with proper indexing
- Implement pagination for member queries
- Create dedicated collections for votes and activity logs

### Step 3: Migration Strategy

- Create migration scripts to move data
- Implement dual-write during transition
- Update all queries to use new structure
- Gradual rollout with feature flags

### Step 4: Performance Optimization

- Add strategic indexes on new collections
- Implement caching for frequently accessed data
- Add query optimization helpers

## Expected Benefits

- 60-80% reduction in Community document size
- Improved query performance for member operations
- Better scalability for large communities
- Easier maintenance and feature development
- Reduced memory usage for document operations

## Timeline

- Schema design and creation: 2-3 days
- Migration script development: 2-3 days
- Query updates and testing: 3-4 days
- Rollout and monitoring: 1-2 days

Total: ~2 weeks
