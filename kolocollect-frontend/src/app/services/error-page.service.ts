import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Service to manage error information for the error page
 * Centralizes error codes and messages to be displayed on the error page
 */
@Injectable({
  providedIn: 'root'
})
export class ErrorPageService {
  private errorCodeSubject = new BehaviorSubject<string>('generic');
  private errorMessageSubject = new BehaviorSubject<string>('');
  
  // Expose observables for components to subscribe to
  errorCode$ = this.errorCodeSubject.asObservable();
  errorMessage$ = this.errorMessageSubject.asObservable();
  
  /**
   * Set error information to be displayed on the error page
   * @param code Error code from backend or custom error code
   * @param message Error message to display
   */
  setError(code: string, message: string): void {
    this.errorCodeSubject.next(this.mapErrorCode(code));
    this.errorMessageSubject.next(message);
  }
  
  /**
   * Reset error information to default values
   */
  resetError(): void {
    this.errorCodeSubject.next('generic');
    this.errorMessageSubject.next('');
  }
  
  /**
   * Map error codes from backend or HTTP status codes to our UI error codes
   * @param code Error code from backend or HTTP status
   * @returns Mapped error code for UI display
   */
  private mapErrorCode(code: string): string {
    // Map 404-related errors
    if (code.includes('404') || code === 'RESOURCE_NOT_FOUND' || 
        code === 'USER_NOT_FOUND' || code === 'COMMUNITY_NOT_FOUND') {
      return '404';
    } 
    // Map 403-related errors
    else if (code.includes('403') || code === 'FORBIDDEN' || 
             code === 'UNAUTHORIZED_ACCESS' || code === 'PERMISSION_DENIED') {
      return '403';
    } 
    // Map network connectivity errors
    else if (code === 'HTTP_0') {
      return 'offline';
    } 
    // Map server errors
    else if (code.includes('500') || code.startsWith('SERVER_') || 
             code.includes('INTERNAL')) {
      return '500';
    }
    
    // Default to generic error if no specific mapping
    return 'generic';
  }
}