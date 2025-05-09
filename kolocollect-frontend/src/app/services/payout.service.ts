import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Payout } from '../models/payout.model';

@Injectable({
  providedIn: 'root'
})
export class PayoutService {
  constructor(private api: ApiService) {}

  /**
   * Get all payouts for a specific community
   */
  getPayoutsByCommunity(communityId: string): Observable<any> {
    return this.api.get<any>(`/payouts/community/${communityId}`);
  }

  /**
   * Get all payouts for a specific user
   */
  getPayoutsByUser(userId: string): Observable<any> {
    return this.api.get<any>(`/payouts/user/${userId}`);
  }

  /**
   * Get a single payout by ID
   */
  getPayoutById(id: string): Observable<any> {
    return this.api.get<any>(`/payouts/${id}`);
  }

  /**
   * Delete a payout by ID
   */
  deletePayout(id: string): Observable<any> {
    return this.api.delete<any>(`/payouts/${id}`);
  }

  /**
   * Get all payouts
   */
  getAllPayouts(): Observable<any> {
    return this.api.get<any>('/payouts');
  }
}