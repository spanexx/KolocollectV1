import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) { }

  /**
   * Perform a GET request to the API
   */
  get<T>(url: string, params: any = {}, customHeaders: HttpHeaders = new HttpHeaders()): Observable<T> {
    const options = {
      params: this.buildParams(params),
      headers: customHeaders
    };

    return this.http.get<T>(`${environment.apiUrl}${url}`, options)
      .pipe(
        timeout(environment.apiTimeoutMs),
        catchError(this.handleError)
      );
  }

  /**
   * Perform a POST request to the API
   */
  post<T>(url: string, body: any = {}, customHeaders: HttpHeaders = new HttpHeaders()): Observable<T> {
    return this.http.post<T>(`${environment.apiUrl}${url}`, body, { headers: customHeaders })
      .pipe(
        timeout(environment.apiTimeoutMs),
        catchError(this.handleError)
      );
  }

  /**
   * Perform a PUT request to the API
   */
  put<T>(url: string, body: any = {}, customHeaders: HttpHeaders = new HttpHeaders()): Observable<T> {
    return this.http.put<T>(`${environment.apiUrl}${url}`, body, { headers: customHeaders })
      .pipe(
        timeout(environment.apiTimeoutMs),
        catchError(this.handleError)
      );
  }

  /**
   * Perform a DELETE request to the API
   */
  delete<T>(url: string, customHeaders: HttpHeaders = new HttpHeaders()): Observable<T> {
    return this.http.delete<T>(`${environment.apiUrl}${url}`, { headers: customHeaders })
      .pipe(
        timeout(environment.apiTimeoutMs),
        catchError(this.handleError)
      );
  }

  /**
   * Build HttpParams object from a regular object
   */
  private buildParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    
    return httpParams;
  }

  /**
   * Handle API errors
   */
  private handleError(error: any) {
    let errorMessage = '';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      const serverError = error.error || {};
      errorMessage = serverError.error?.message || 'Unknown server error occurred';
    }
    
    return throwError(() => ({ 
      message: errorMessage, 
      status: error.status,
      error: error.error
    }));
  }
}