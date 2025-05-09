import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ToastMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  title?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new Subject<ToastMessage>();
  public toast$ = this.toastSubject.asObservable();
  
  constructor() {}

  /**
   * Show a success toast message
   */
  success(message: string, title: string = 'Success', duration: number = 3000): void {
    this.showToast({
      type: 'success',
      message,
      title,
      duration
    });
  }

  /**
   * Show an error toast message
   */
  error(message: string, title: string = 'Error', duration: number = 5000): void {
    this.showToast({
      type: 'error',
      message,
      title,
      duration
    });
  }

  /**
   * Show an info toast message
   */
  info(message: string, title: string = 'Information', duration: number = 3000): void {
    this.showToast({
      type: 'info',
      message,
      title,
      duration
    });
  }

  /**
   * Show a warning toast message
   */
  warning(message: string, title: string = 'Warning', duration: number = 4000): void {
    this.showToast({
      type: 'warning',
      message,
      title,
      duration
    });
  }

  /**
   * Show a toast message
   */
  private showToast(toast: ToastMessage): void {
    this.toastSubject.next(toast);
  }
}