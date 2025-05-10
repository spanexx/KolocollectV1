import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ErrorComponent } from '../../shared/error/error.component';
import { ErrorPageService } from '../../services/error-page.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ErrorComponent],
  template: `
    <div class="error-page-container">
      <app-error 
        [errorCode]="errorCode" 
        [message]="errorMessage" 
        buttonText="Return to Dashboard" 
        buttonLink="/dashboard">
      </app-error>
    </div>
  `,
  styles: [`
    .error-page-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #F9FAFB;
    }
  `]
})
export class ErrorPageComponent implements OnInit {
  errorCode: '404' | '500' | '403' | 'offline' | 'generic' = 'generic';
  errorMessage: string = '';
  private destroyRef = inject(DestroyRef);
  
  constructor(private errorPageService: ErrorPageService) {}
  
  ngOnInit(): void {
    // Subscribe to error code changes
    this.errorPageService.errorCode$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(code => {
      this.errorCode = code as '404' | '500' | '403' | 'offline' | 'generic';
    });
    
    // Subscribe to error message changes
    this.errorPageService.errorMessage$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(message => {
      this.errorMessage = message;
    });
  }
}