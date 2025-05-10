export interface Community {
  _id: string;
  name: string;
  description: string;
  admin: string;
  members: Member[];
  totalContribution: number;
  backupFund: number;
  settings: CommunitySettings;
  cycles: Cycle[];
  cycleState: 'Active' | 'Locked' | 'Completed';
  lockPayout: boolean;
  cycleLockEnabled: boolean;
  createdAt: Date;
  positioningMode: 'random' | 'fixed';
  active: boolean;
  nextPayout?: Date;
  midCycle?: MidCycle[]; // Fixed: renamed from midCycle to midCycles for consistency
  payoutDetails?: {
    nextRecipient?: string;
    payoutAmount?: number;
    payoutDate?: Date;
  };
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  status: 'active' | 'inactive' | 'waiting';
  position?: number;
  joinedAt: Date;
  lastContribution?: Date;
  contributionTotal?: number;
  payoutReceived?: boolean;
  nextPayoutDate?: Date;
}

export interface CommunitySettings {
  contributionFrequency: 'weekly' | 'biweekly' | 'monthly';
  minContribution: number;
  maxMembers: number;
  backupFundPercentage: number;
  payoutDay?: number;
  firstCycleMin: number;
  allowMidCycleJoining: boolean;
  penalty?: number;
}

export interface Cycle {
  id: string;
  cycleNumber: number;
  startDate: Date;
  endDate: Date | null;
  midCycles: MidCycle[];
  isComplete: boolean;
  isReady: boolean;
  defaulters: string[];
}

export interface MidCycle {
  id: string;
  midCycleNumber: number;
  startDate: Date;
  endDate: Date | null;
  contributors: {[userId: string]: string[]};
  nextInLine: NextInLine;
  isComplete: boolean;
  isReady: boolean;
  payoutAmount: number;
  payoutDate?: Date;
  midCycleJoiners?: MidCycleJoiner[];
}

export interface NextInLine {
  userId: string;
  userName: string;
}

export interface MidCycleJoiner {
  joiners: string[];
  paidMembers: string[];
  isComplete: boolean;
}

export interface CommunityListRequest {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  status?: 'active' | 'all' | 'joined';
}

export interface CommunityListResponse {
  communities: Community[];
  total: number;
  page: number;
  limit: number;
}

export interface MidCycleDetails {
  midCycleId: string;
  cycleNumber: number;
  isReady: boolean;
  isComplete: boolean;
  payoutDate: string;
  payoutAmount: number;
  nextInLine: {
    userId: string;
    name: string;
    email: string;
    position: number;
  } | null;  contributions: Array<{
    user: {
      _id: string;
      name: string;
      email: string;
    };
    contributions: string[];
    _id: string;
    totalAmount: number;
  }>;
  defaulters: string[];
  midCycleJoiners: any[];
  contributionsToNextInLine: Record<string, number>;
  contributionProgress?: {
    percentage: number;
    made: number;
    expected: number;
  };
  summary: {
    totalMidCycles: number;
    completedMidCycles: number;
    totalDistributed: number;
  };
  currentCycle: {
    cycleNumber: number;
    startDate: string;
    expectedEndDate: string;
    paidMembers: number;
    totalMembers: number;
  } | null;
}