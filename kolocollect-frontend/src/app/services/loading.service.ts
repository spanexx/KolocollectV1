import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingMap = new Map<string, boolean>();
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {}

  /**
   * Start loading for a specific key
   */
  start(key: string): void {
    this.loadingMap.set(key, true);
    this.updateLoadingState();
  }

  /**
   * Stop loading for a specific key
   */
  stop(key: string): void {
    this.loadingMap.set(key, false);
    this.updateLoadingState();
  }

  /**
   * Check if a specific key is loading
   */
  isLoading(key: string): boolean {
    return this.loadingMap.get(key) || false;
  }

  /**
   * Update the global loading state based on all tracked loading states
   */
  private updateLoadingState(): void {
    const isLoading = Array.from(this.loadingMap.values()).some(value => value);
    this.loadingSubject.next(isLoading);
  }
}