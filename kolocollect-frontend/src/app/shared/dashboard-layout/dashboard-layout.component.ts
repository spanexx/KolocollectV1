import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SidebarComponent,
    MatProgressBarModule
  ],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss'
})
export class DashboardLayoutComponent implements OnInit {
  sidebarCollapsed = false;
  currentUser$: Observable<User | null>;
  loading = false; // This will be used to show/hide the loading bar
  currentYear: number = new Date().getFullYear();

  constructor(private authService: AuthService) {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    // Check local storage for user preference on sidebar state
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState) {
      this.sidebarCollapsed = savedState === 'true';
    }
    
    // On mobile devices, default to collapsed
    if (window.innerWidth <= 768) {
      this.sidebarCollapsed = true;
    }
  }

  toggleSidebar(collapsed: boolean): void {
    this.sidebarCollapsed = collapsed;
    // Save preference to local storage
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }
}
