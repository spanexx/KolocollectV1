export interface Wallet {
  id: string;
  user: string;
  balance: number;
  currency: string;
  isFrozen: boolean;
  fixedFunds: FixedFund[];
  transactions: Transaction[];
}

export interface FixedFund {
  id: string;
  amount: number;
  startDate: Date;
  endDate: Date;
  purpose: string;
  communityId?: string;
  isActive: boolean;
  isMatured: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: Date;
  status: TransactionStatus;
  reference: string;
  communityId?: string;
  communityName?: string;
  paymentMethod?: string;
}

export type TransactionType = 
  'deposit' | 
  'withdrawal' | 
  'contribution' | 
  'payout' | 
  'penalty' | 
  'refund' | 
  'transfer' |
  'fix-funds' |
  'release-fixed-funds';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface WalletSummaryResponse {
  balance: number;
  fixedAmount: number;
  pendingTransactions: Transaction[];
  recentTransactions: Transaction[];
}

export interface DepositRequest {
  amount: number;
  paymentMethod: string;
  currency?: string;
}

export interface WithdrawalRequest {
  amount: number;
  destination: {
    type: 'bank_account' | 'mobile_money' | 'card';
    details: any;
  };
}

export interface FixFundsRequest {
  amount: number;
  endDate: Date;
  purpose: string;
  communityId?: string;
}

export interface TransferRequest {
  recipientEmail: string;
  amount: number;
  description?: string;
}