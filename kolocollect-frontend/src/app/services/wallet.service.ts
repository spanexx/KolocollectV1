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
  withdrawFunds(data: { userId: string; amount: number; destination?: string }): Observable<any> {
    return this.api.post<any>('/wallet/withdraw-funds', data);
  }

  /**
   * Transfer funds between wallets
   */
  transferFunds(data: { userId: string; recipientId: string; amount: number; description?: string }): Observable<any> {
    return this.api.post<any>('/wallet/transfer-funds', data);
  }

  /**
   * Get transaction history for a wallet
   */
  getTransactionHistory(userId: string, params: { page?: number; limit?: number; type?: string } = {}): Observable<any> {
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
   */
  releaseFixedFund(userId: string, fundId: string): Observable<any> {
    return this.api.post<any>(`/wallet/${userId}/release-fixed-fund`, { fundId });
  }
}