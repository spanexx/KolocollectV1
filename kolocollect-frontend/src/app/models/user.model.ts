export interface User {
 id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin';
  dateJoined: Date;
  profilePicture?: ProfilePicture;
  communities: CommunityMembership[];
  contributions?: ContributionSummary[];
}

export interface ProfilePicture {
  fileId: string;
  url: string;
  lastUpdated: Date;
}

export interface VerificationDocument {
  fileId: string;
  documentType: 'id' | 'passport' | 'driverLicense' | 'utilityBill' | 'other';
  status: 'pending' | 'verified' | 'rejected';
  uploadDate: Date;
  verifiedDate?: Date;
  rejectionReason?: string;
}

export interface UserProfile extends User {
  wallet?: WalletSummary;
  upcomingPayouts?: PayoutPreview[];
  notifications?: Notification[];
  verificationDocuments?: VerificationDocument[];
  phone?: string;
  address?: string;
  bio?: string;
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
 user: User;
  accessToken: string;   
  refreshToken: string;
}