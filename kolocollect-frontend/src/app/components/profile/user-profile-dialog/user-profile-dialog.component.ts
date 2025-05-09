import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { UserProfileComponent } from '../user-profile/user-profile.component';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    FontAwesomeModule,
    UserProfileComponent
  ],
  template: `
    <div class="user-profile-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>User Profile</h2>
        <button mat-icon-button class="close-button" (click)="close()">
          <fa-icon [icon]="faXmark"></fa-icon>
        </button>
      </div>
      
      <mat-dialog-content>
        <app-user-profile [userId]="data.userId" (buttonClick)="close()"></app-user-profile>
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .user-profile-dialog {
      padding: 0;
      max-width: 100%;
      overflow: hidden;
    }
    
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }
    
    mat-dialog-title {
      margin: 0;
      font-weight: 500;
    }
    
    .close-button {
      color: #6B7280;
    }
    
    mat-dialog-content {
      padding: 0;
      max-height: 80vh;
      overflow-y: auto;
    }
  `]
})
export class UserProfileDialogComponent {
  faXmark = faXmark;
  
  constructor(
    public dialogRef: MatDialogRef<UserProfileDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { userId: string }
  ) {}

  close(): void {
    this.dialogRef.close();
  }
}