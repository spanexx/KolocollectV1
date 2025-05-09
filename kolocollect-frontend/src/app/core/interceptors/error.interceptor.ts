import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Auto logout if 401 response returned from API
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          this.router.navigate(['/login']);
        }
        
        // Format the error for consistent handling
        const errorMessage = this.getErrorMessage(error);
        
        // Pass the error along to be handled by components
        return throwError(() => ({
          message: errorMessage,
          status: error.status,
          error: error.error
        }));
      })
    );
  }
  
  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      return `Error: ${error.error.message}`;
    } else {
      // Server-side error
      const serverError = error.error || {};
      
      switch (error.status) {
        case 400:
          return serverError.error?.message || 'Bad request';
        case 401:
          return 'Unauthorized access';
        case 403:
          return 'Forbidden access';
        case 404:
          return 'Resource not found';
        case 500:
          return 'Internal server error';
        default:
          return serverError.error?.message || 'Unknown error occurred';
      }
    }
  }
}