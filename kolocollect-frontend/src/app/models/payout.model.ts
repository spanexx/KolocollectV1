export interface Payout {
  id: string;
  communityId: string;
  communityName?: string;
  recipient: string;
  recipientName?: string;
  amount: number;
  cycleNumber: number;
  midCycleNumber: number;
  status: PayoutStatus;
  scheduledDate: Date;
  processedDate?: Date;
  transferReference?: string;
}

export type PayoutStatus = 'scheduled' | 'processing' | 'completed' | 'failed';

export interface PayoutListRequest {
  page?: number;
  limit?: number;
  communityId?: string;
  recipientId?: string;
  status?: PayoutStatus;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PayoutListResponse {
  payouts: Payout[];
  total: number;
  page: number;
  limit: number;
}

export interface PayoutSchedule {
  communityId: string;
  communityName: string;
  currentCycle: number;
  currentMidCycle: number;
  payoutQueue: PayoutQueueItem[];
  nextPayoutDate?: Date;
  nextRecipient?: {
    id: string;
    name: string;
  };
}

export interface PayoutQueueItem {
  position: number;
  userId: string;
  userName: string;
  estimatedDate?: Date;
  estimatedAmount?: number;
  isPaid?: boolean;
}

export interface PayoutSummary {
  totalReceived: number;
  count: number;
  pendingCount: number;
  nextPayout?: {
    communityId: string;
    communityName: string;
    estimatedAmount: number;
    estimatedDate: Date;
  };
}