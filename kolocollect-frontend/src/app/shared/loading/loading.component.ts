import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule],
  template: `
    <div class="loading-container" *ngIf="loading">
      <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
    </div>
  `,
  styleUrl: './loading.component.scss'
})
export class LoadingComponent implements OnInit {
  loading = false;

  constructor(
    private loadingService: LoadingService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadingService.loading$.subscribe(isLoading => {
      // Use setTimeout to push the state change to the next change detection cycle
      setTimeout(() => {
        this.loading = isLoading;
        this.cdr.detectChanges();
      });
    });
  }
}