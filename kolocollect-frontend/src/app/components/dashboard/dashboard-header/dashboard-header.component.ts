import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { User } from '../../../models/user.model';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './dashboard-header.component.html',
  styleUrl: './dashboard-header.component.scss'
})
export class DashboardHeaderComponent implements OnInit {
  // Input properties
  @Input() isLoading = true;
  @Input() currentUser: User | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Only fetch user if not provided by parent component
    if (!this.currentUser) {
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.isLoading = false;
        }
      });
    } else {
      this.isLoading = false;
    }
  }
}
