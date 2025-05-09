import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { ApiService } from './api.service';
import { User, AuthResponse } from '../models/user.model';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;
  private tokenExpirationTimer: any;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {
    this.currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromLocalStorage());
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.checkTokenExpiration();
  }

  /**
   * Get the current user value
   */
  public get currentUserValue(): User | null {
  
    return this.currentUserSubject.value;
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<User> {
    return this.apiService.post<AuthResponse>('/users/login', { email, password })
      .pipe(
        tap(response => this.setUserSession(response)),
        map(response => response.user)
      );
  }

  /**
   * Register a new user
   */
  register(userData: { name: string; email: string; password: string }): Observable<User> {
    return this.apiService.post<AuthResponse>('/users/register', userData)
      .pipe(
        map(response => response.user)
      );
  }

  /**
   * Request password reset
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.apiService.post('/users/request-reset-password', { email });
  }

  /**
   * Reset password with token
   */
  resetPassword(resetData: { token: string; password: string }): Observable<any> {
    return this.apiService.post('/users/reset-password', resetData);
  }

  /**
   * Logout the current user
   */
  logout(): void {
    this.clearUserSession();
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const user = this.currentUserValue;
    const token = localStorage.getItem('token');

    if (!user || !token) {
      return false;
    }

    try {
      const payload = jwtDecode<JwtPayload>(token);
      const isExpired = Date.now() >= payload.exp * 1000;
      
      if (isExpired) {
        this.clearUserSession();
        return false;
      }
      
      return true;
    } catch (error) {
      this.clearUserSession();
      return false;
    }
  }

  /**
   * Update user password
   */
  updatePassword(currentPassword: string, newPassword: string): Observable<any> {
    return this.apiService.post('/users/update-password', {
      currentPassword,
      newPassword
    });
  }

  /**
   * Get the authentication token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Set user session data
   */
  private setUserSession(response: AuthResponse): void {
    if (response && response.token) {
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      this.currentUserSubject.next(response.user);
      this.startTokenExpirationTimer();
    }
  }

  /**
   * Clear user session data
   */
  private clearUserSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  /**
   * Get user from local storage
   */
  private getUserFromLocalStorage(): User | null {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Start token expiration timer
   */
  private startTokenExpirationTimer(): void {
    const token = this.getToken();
    if (!token) return;

    try {
      const payload = jwtDecode<JwtPayload>(token);
      const expirationTime = payload.exp * 1000 - Date.now() - 60000; // Expire 1 minute early to be safe
      
      this.tokenExpirationTimer = setTimeout(() => {
        this.logout();
      }, expirationTime);
    } catch (error) {
      console.error('Error decoding token:', error);
    }
  }

  /**
   * Check token expiration on startup
   */
  private checkTokenExpiration(): void {
    if (this.isAuthenticated()) {
      this.startTokenExpirationTimer();
    } else {
      this.clearUserSession();
    }
  }
}