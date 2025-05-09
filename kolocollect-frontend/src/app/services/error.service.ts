import { Injectable, ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';
import { ErrorPageService } from './error-page.service';

@Injectable({
  providedIn: 'root'
})
export class ErrorService implements ErrorHandler {
  constructor(
    private toastService: ToastService,
    private router: Router,
    private errorPageService: ErrorPageService
  ) {}

  /**
   * Global error handler for all uncaught errors in the application
   * Implements Angular's ErrorHandler interface
   */
  handleError(error: Error | HttpErrorResponse): void {
    let errorMessage: string;
    let errorCode: string;
    let shouldRedirect = false;

    // Handling HTTP errors
    if (error instanceof HttpErrorResponse) {
      // Extract error details from backend response
      const serverError = error.error || {};
      
      // Use standard error codes from backend when available
      errorCode = serverError.error?.code || `HTTP_${error.status}`;
      errorMessage = serverError.error?.message || this.getDefaultErrorMessage(error.status);
      
      // Determine if we should redirect based on error status
      shouldRedirect = this.shouldRedirectToErrorPage(error.status);
    } 
    // Handling client-side errors
    else {
      errorCode = 'CLIENT_ERROR';
      errorMessage = error.message || 'An unexpected error occurred';
      console.error('Client error:', error);
    }

    // Show toast notification for non-critical errors
    if (!shouldRedirect) {
      this.toastService.error(errorMessage);
    }
    // Redirect to error page for critical errors
    else {
      this.errorPageService.setError(errorCode, errorMessage);
      this.router.navigate(['/error']);
    }
  }
  
  /**
   * Helper method for HTTP error handling in services
   * Returns an observable with the error for chaining
   */
  handleHttpError(error: HttpErrorResponse): Observable<never> {
    this.handleError(error);
    return throwError(() => error);
  }

  /**
   * Parse validation errors from the backend
   */
  parseValidationErrors(validationErrors: any): { [key: string]: string } {
    const errors: { [key: string]: string } = {};
    
    if (!validationErrors) {
      return errors;
    }
    
    if (Array.isArray(validationErrors)) {
      // Handle array of validation errors
      validationErrors.forEach(error => {
        if (error.field && error.message) {
          errors[error.field] = error.message;
        }
      });
    } else if (typeof validationErrors === 'object') {
      // Handle object of validation errors
      Object.keys(validationErrors).forEach(key => {
        const value = validationErrors[key];
        errors[key] = Array.isArray(value) ? value[0] : value;
      });
    }
    
    return errors;
  }
  
  /**
   * Get default error message based on HTTP status code
   */
  private getDefaultErrorMessage(status: number): string {
    switch (status) {
      case 0:
        return 'Cannot connect to the server. Please check your internet connection.';
      case 400:
        return 'The request contains invalid data. Please check your input.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You do not have permission to access this resource.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred with your request.';
      case 422:
        return 'The provided data is invalid.';
      case 500:
      case 501:
      case 502:
      case 503:
        return 'A server error occurred. Please try again later.';
      default:
        return `An error occurred (Status code: ${status})`;
    }
  }
  
  /**
   * Determine if error should redirect to error page
   */
  private shouldRedirectToErrorPage(status: number): boolean {
    // Only redirect for catastrophic errors
    return status === 0 || status >= 500;
  }
}