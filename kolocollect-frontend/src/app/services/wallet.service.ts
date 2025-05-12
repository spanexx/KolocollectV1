import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Wallet } from '../models/wallet.model';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  constructor(private api: ApiService) {}

  /**
   * Get wallet balance for a user
   */
  getWalletBalance(userId: string): Observable<any> {
    return this.api.get<any>(`/wallet/${userId}/balance`);
  }

  /**
   * Get full wallet details for a user
   */
  getWallet(userId: string): Observable<any> {
    return this.api.get<any>(`/wallet/${userId}`);
  }

  /**
   * Create a new wallet
   */
  createWallet(walletData: any): Observable<any> {
    return this.api.post<any>('/wallet/create', walletData);
  }

  /**
   * Add funds to a wallet
   */
  addFunds(data: { userId: string; amount: number; source?: string }): Observable<any> {
    return this.api.post<any>('/wallet/add-funds', data);
  }
  /**
   * Withdraw funds from a wallet
   */
  withdrawFunds(data: { userId: string; amount: number; destination?: any }): Observable<any> {
    return this.api.post<any>('/wallet/withdraw-funds', data);
  }
  /**
   * Transfer funds between wallets
   */
  transferFunds(data: { userId: string; recipientId?: string; recipientEmail?: string; amount: number; description?: string }): Observable<any> {
    return this.api.post<any>('/wallet/transfer-funds', data);
  }
  /**
   * Get transaction history for a wallet
   * @param userId User ID
   * @param params Optional params for filtering transactions
   * @param params.page Page number for pagination
   * @param params.limit Number of transactions per page
   * @param params.type Filter by transaction type ('deposit', 'withdrawal', 'contribution', etc.)
   * @param params.status Filter by transaction status ('pending', 'completed', 'failed')
   * @param params.dateFrom Start date for filtering (ISO date string)
   * @param params.dateTo End date for filtering (ISO date string)
   * @param params.minAmount Minimum transaction amount
   * @param params.maxAmount Maximum transaction amount
   * @param params.search Search term for transaction description
   */
  getTransactionHistory(userId: string, params: { 
    page?: number; 
    limit?: number; 
    type?: string | string[]; 
    status?: string | string[];
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  } = {}): Observable<any> {
    return this.api.get<any>(`/wallet/${userId}/transactions`, params);
  }

  /**
   * Fix funds (lock funds for a period)
   */
  fixFunds(userId: string, data: { amount: number; duration: number }): Observable<any> {
    return this.api.post<any>(`/wallet/${userId}/fix-funds`, data);
  }

  /**
   * Get fixed funds information
   */
  getFixedFunds(userId: string): Observable<any> {
    return this.api.get<any>(`/wallet/${userId}/fixed-funds`);
  }

  /**
   * Release a fixed fund that has matured
   */  releaseFixedFund(userId: string, fundId: string): Observable<any> {
    return this.api.post<any>(`/wallet/${userId}/release-fixed-fund`, { fundId });
  }
  /**
   * Download transactions in CSV or PDF format
   * @param userId User ID
   * @param params Download parameters including filters and format
   */
  downloadTransactions(userId: string, params: { 
    format: 'csv' | 'pdf';
    type?: string | string[]; 
    status?: string | string[];
    dateFrom?: string;
    dateTo?: string;
    minAmount?: number;
    maxAmount?: number;
    search?: string;
  }): Observable<any> {
    const format = params.format || 'csv';
    const requestParams = { ...params } as Partial<typeof params>;
    requestParams.format = undefined;
    
    return this.api.get<any>(
      `/wallet/${userId}/transactions/download/${format}`, 
      requestParams, 
      { responseType: format === 'csv' ? 'text' : 'arraybuffer' }
    );
  }
}