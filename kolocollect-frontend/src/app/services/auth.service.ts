// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer, of, throwError } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User, AuthResponse } from '../models/user.model';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
interface JwtPayload {
  sub: string;
  exp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Base URL for Render.com auth-service
  private readonly AUTH_API = 'https://auth-service-5971.onrender.com/api/auth';
  // Holds the current user state
  private currentUserSubject = new BehaviorSubject<User | null>(this.loadUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  // Getter to expose the current user value
  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  // Timer handle for automatic logout/refresh
  private tokenTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // On service init, schedule token check
    this.scheduleRefreshCheck();
  }

  /**
   * Perform login against Render.com auth API.
   * Stores tokens + user on success.
   */
  login(emailOrUsername: string, password: string): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.AUTH_API}/login`, { emailOrUsername, password })
      .pipe(
        tap((res) => {
          console.log('Login response:', res);
          this.storeSession(res)}),
        switchMap(res => of(res.user))
      );
  }

  /**
   * Register a new user through the auth service.
   * Automatically logs in (stores tokens) on success.
   */
  register(data: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Observable<User> {
    return this.http
      .post<AuthResponse>(`${this.AUTH_API}/register`, data)
      .pipe(
        tap(res => this.storeSession(res)),
        switchMap(res => of(res.user))
      );
  }

  /**
   * Fetch the current user's profile from auth service.
   */
  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.AUTH_API}/me`, {
      headers: this.authHeaders()
    });
  }

  /**
   * Log out: notify auth service, then clear session locally.
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${this.AUTH_API}/logout`, { refreshToken })
        .subscribe({ error: () => {/* ignore errors */} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Manually trigger a token refresh.
   */
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));

    return this.http
      .post<AuthResponse>(`${this.AUTH_API}/refresh`, { refreshToken })
      .pipe(
        tap(res => this.storeSession(res)),
        catchError(err => {
          this.clearSession();
          return throwError(() => err);
        })
      );
  }

  /**
   * Verify a token’s validity.
   */
  verifyToken(token: string): Observable<any> {
    return this.http.post(`${this.AUTH_API}/verify`, { token });
  }

  /**
   * Alias to verifyToken (some APIs use different naming).
   */
  validateToken(token: string): Observable<any> {
    return this.http.post(`${this.AUTH_API}/validate-token`, { token });
  }
  /**
   * True if user + valid access token are present.
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    try {
      const { exp } = jwtDecode(token) as JwtPayload;
      return Date.now() < exp * 1000;
    } catch {
      return false;
    }
  }
  /**
   * Get the current user's ID
   * @returns string The user ID or empty string if no user is logged in
   */
  getUserId(): string {
    const user = this.currentUserValue;
    if (user) {
      return user.id || '';
    }
    
    // Fallback to localStorage for legacy data format
    const localUser = localStorage.getItem('user');
    if (localUser) {
      try {
        const userObj = JSON.parse(localUser);
        return userObj.id || userObj._id || '';
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
    
    return '';
  }

  /**
   * Request a password reset email
   * @param email The user's email address
   */
  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.AUTH_API}/request-reset-password`, { email });
  }

  /**
   * Reset a user's password using a reset token
   * @param data Object containing token, newPassword, and confirmPassword
   */
  resetPassword(data: { token: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.http.post(`${this.AUTH_API}/reset-password`, data);
  }

  /**
   * Helper method to get user's full name by combining firstName and lastName
   * Used for backward compatibility with components expecting a 'name' property
   */
  getUserFullName(): string {
    const user = this.currentUserValue;
    if (user) {
      // Return the name if it exists
      // if (user.name) return user.name;
      
      // Otherwise combine firstName and lastName
      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      
      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim();
      }
      
      // Fallback to username if neither name nor firstName/lastName exists
      return user.username || '';
    }
    return '';
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // ──────────────── Session + Token Helpers ────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────────

  private storeSession(res: AuthResponse) {
    // Persist tokens
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    // Persist user object
    localStorage.setItem('user', JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
    // Reset any existing timer
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
    this.scheduleRefreshCheck();
  }

  private clearSession() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    if (this.tokenTimer) clearTimeout(this.tokenTimer);
  }

  private loadUser(): User | null {
    const json = localStorage.getItem('user');
    return json ? JSON.parse(json) : null;
  }

  private getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  private authHeaders(): HttpHeaders {
    const token = this.getAccessToken();
    return new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' });
  }

  /**
   * Schedule an automatic token refresh a minute before expiry.
   */
  private scheduleRefreshCheck() {
    const token = this.getAccessToken();
    if (!token) return;

    try {
      const { exp } = jwtDecode(token) as JwtPayload;
      const expiresInMs = exp * 1000 - Date.now();
      // Schedule one minute before actual expiry
      const refreshIn = expiresInMs - 60_000;
      if (refreshIn > 0) {
        this.tokenTimer = setTimeout(() => {
          this.refreshToken().subscribe({
            error: () => this.logout()
          });
        }, refreshIn);
      } else {
        // Token already expired
        this.logout();
      }
    } catch {
      this.logout();
    }
  }
}
