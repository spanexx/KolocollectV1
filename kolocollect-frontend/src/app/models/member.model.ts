export interface Member {
  _id?: string;
  id?: string;
  userId: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'waiting';
  position?: number;
  communityId: string;
  joinedAt: Date;
  contributionPaid?: {
    amount: number;
    count: number;
  }[];
  penalty?: number;
  missedContributions?: {
    cycleNumber: number;
    midCycles: string[];
    amount: number;
    nextInLineMissed?: {
      userId: string;
    };
  }[];
  paymentPlan?: {
    type: 'Full' | 'Incremental' | 'Shortfall';
    totalPreviousContribution: number;
    remainingAmount: number;
    previousContribution: number;
    installments: number;
  };
}

export interface MemberListResponse {
  status: string;
  data: Member[];
  pagination: {
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
  };
}

export interface ActiveMemberCountResponse {
  status: string;
  data: {
    communityId: string;
    activeMembers: number;
  };
}

export interface MemberResponse {
  status: string;
  data: Member;
}
