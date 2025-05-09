import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { ToastService, ToastMessage } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule],
  template: '',
  styles: []
})
export class ToastComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private toastService: ToastService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.toastService.toast$
      .pipe(takeUntil(this.destroy$))
      .subscribe((toast: ToastMessage) => {
        this.showToast(toast);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private showToast(toast: ToastMessage): void {
    // Map toast type to Material panelClass for styling
    const panelClass = this.getPanelClass(toast.type);
    
    this.snackBar.open(toast.message, 'Close', {
      duration: toast.duration || 3000,
      panelClass: panelClass,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  private getPanelClass(type: string): string {
    switch (type) {
      case 'success': return 'toast-success';
      case 'error': return 'toast-error';
      case 'warning': return 'toast-warning';
      case 'info': return 'toast-info';
      default: return '';
    }
  }
}