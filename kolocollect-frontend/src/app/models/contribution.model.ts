export interface Contribution {
  id: string;
  user: string;
  userName?: string;
  communityId: string;
  communityName?: string;
  amount: number;
  cycleNumber: number;
  midCycleNumber: number;
  status: ContributionStatus;
  contributionDate: Date;
  paymentMethod?: string;
  paymentReference?: string;
  installments?: Installment[];
}

export type ContributionStatus = 'pending' | 'confirmed' | 'rejected' | 'partial';

export interface Installment {
  amount: number;
  date: Date;
  paymentReference?: string;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface ContributionRequest {
  communityId: string;
  amount: number;
  paymentMethod?: string;
  isInstallment?: boolean;
  installmentPlan?: {
    initialAmount: number;
    remainingAmount: number;
    completionDate: Date;
  };
}

export interface ContributionListRequest {
  page?: number;
  limit?: number;
  communityId?: string;
  userId?: string;
  cycleNumber?: number;
  midCycleNumber?: number;
  status?: ContributionStatus;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface ContributionListResponse {
  contributions: Contribution[];
  total: number;
  page: number;
  limit: number;
}

export interface ContributionSummary {
  totalAmount: number;
  count: number;
  pendingAmount: number;
  pendingCount: number;
  lastContribution?: Date;
  upcomingContributions?: UpcomingContribution[];
}

export interface UpcomingContribution {
  communityId: string;
  communityName: string;
  dueDate: Date;
  expectedAmount: number;
  cycleNumber: number;
  midCycleNumber: number;
}