import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap, finalize } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  constructor() {}
  
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Get the auth token from local storage
    const token = localStorage.getItem('accessToken');
    
    // Clone the request and add the authorization header if token exists
    if (token) {
      request = this.addToken(request, token);
    }
    
    return next.handle(request).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          // Try to refresh the token if the error is 401 Unauthorized or 403 Forbidden
          return this.handle401Error(request, next);
        }
        
        return throwError(() => error);
      })
    );
  }

  private addToken(request: HttpRequest<any>, token: string) {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);
      
      // Try to get a refreshToken from localStorage
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (refreshToken) {
        // Here you would call your auth service to refresh the token
        // For now we're just logging out the user since we need to implement proper refresh token logic
        this.logoutUser();
        return throwError(() => new Error('Session expired. Please login again.'));
      } else {
        // No refresh token available, logout the user
        this.logoutUser();
        return throwError(() => new Error('No refresh token available. Please login again.'));
      }
    } else {
      // If another request is already refreshing the token, wait for it to complete
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addToken(request, token));
        }),
        finalize(() => {
          // Ensure isRefreshing is reset if an error occurs
          if (this.isRefreshing) {
            this.isRefreshing = false;
          }
        })
      );
    }
  }

  private logoutUser() {
    // Clear all tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // In a real app, you'd navigate to login page
    // For now, just reload the page to force re-authentication
    window.location.href = '/login';
  }
}