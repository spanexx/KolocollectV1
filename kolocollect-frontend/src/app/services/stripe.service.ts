import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  constructor(private api: ApiService) {}

  /**
   * Create a payment intent for wallet funding
   */
  createPaymentIntent(amount: number, currency: string = 'usd'): Observable<any> {
    return this.api.post<any>('/stripe/create-payment-intent', { amount, currency });
  }

  /**
   * Get Stripe configuration details
   */
  getConfig(): Observable<any> {
    return this.api.get<any>('/stripe/config');
  }

  /**
   * Handle successful payment
   */
  handlePaymentSuccess(paymentId: string, userId: string, amount: number): Observable<any> {
    return this.api.post<any>('/stripe/payment-success', { paymentId, userId, amount });
  }

  /**
   * Create payment method for user
   */
  createPaymentMethod(userId: string, paymentMethodId: string): Observable<any> {
    return this.api.post<any>('/stripe/create-payment-method', { userId, paymentMethodId });
  }

  /**
   * Get saved payment methods for a user
   */
  getPaymentMethods(userId: string): Observable<any> {
    return this.api.get<any>(`/stripe/payment-methods/${userId}`);
  }

  /**
   * Delete a payment method
   */
  deletePaymentMethod(paymentMethodId: string): Observable<any> {
    return this.api.delete<any>(`/stripe/payment-methods/${paymentMethodId}`);
  }
}