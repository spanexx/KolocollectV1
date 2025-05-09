export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  dateJoined: Date;
  communities: CommunityMembership[];
  contributions?: ContributionSummary[];
}

export interface UserProfile extends User {
  wallet?: WalletSummary;
  upcomingPayouts?: PayoutPreview[];
  notifications?: Notification[];
}

export interface CommunityMembership {
  id: string;
  isAdmin: boolean;
}

export interface ContributionSummary {
  communityId: string;
  payoutDate?: Date;
  expectedAmount?: number;
}

export interface WalletSummary {
  balance: number;
  pendingAmount?: number;
  fixedFunds?: number;
}

export interface PayoutPreview {
  communityId: string;
  communityName: string;
  expectedDate: Date;
  expectedAmount: number;
  status: 'upcoming' | 'pending' | 'processing';
}

export interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  type: 'payment' | 'contribution' | 'system' | 'community';
  read: boolean;
  relatedItemId?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}