import { Component, OnInit, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { Observable } from 'rxjs';

// Import FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faTachometerAlt, 
  faUsers, 
  faWallet, 
  faReceipt, 
  faMoneyBillWave,
  faUser,
  faSignInAlt,
  faUserPlus,
  faChevronLeft,
  faChevronRight,
  faBars,
  faBell
} from '@fortawesome/free-solid-svg-icons';

// Import the ClickOutsideDirective
import { ClickOutsideDirective } from '../directives/click-outside.directive';

interface NavItem {
  label: string;
  icon: string;        // Material icon name
  faIcon: any;         // FontAwesome icon
  route: string;
  requiresAuth: boolean;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDividerModule,
    FontAwesomeModule,
    ClickOutsideDirective
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  @Output() toggleCollapse = new EventEmitter<boolean>();
  
  currentUser$: Observable<User | null>;
  isMobile = false;
  isSmallScreen = false;
  
  // Screen breakpoints
  readonly SCREEN_SM = 576;
  readonly SCREEN_MD = 768;
  
  // FontAwesome Icons
  faTachometerAlt = faTachometerAlt;
  faUsers = faUsers;
  faWallet = faWallet;
  faReceipt = faReceipt;
  faMoneyBillWave = faMoneyBillWave;
  faUser = faUser;
  faSignInAlt = faSignInAlt;
  faUserPlus = faUserPlus;  faChevronLeft = faChevronLeft;
  faChevronRight = faChevronRight;
  faBars = faBars;
  faBell = faBell;
  
  navItems: NavItem[] = [
    { 
      label: 'Dashboard', 
      icon: 'dashboard', 
      faIcon: this.faTachometerAlt,
      route: '/dashboard', 
      requiresAuth: true 
    },
    { 
      label: 'Communities', 
      icon: 'groups', 
      faIcon: this.faUsers,
      route: '/communities', 
      requiresAuth: true 
    },
    { 
      label: 'Wallet', 
      icon: 'account_balance_wallet', 
      faIcon: this.faWallet,
      route: '/wallet', 
      requiresAuth: true 
    },
    { 
      label: 'Contributions', 
      icon: 'receipt_long', 
      faIcon: this.faReceipt,
      route: '/contributions', 
      requiresAuth: true 
    },    { 
      label: 'Payouts', 
      icon: 'payments', 
      faIcon: this.faMoneyBillWave,
      route: '/payouts', 
      requiresAuth: true 
    },
    {
      label: 'Notifications',
      icon: 'notifications',
      faIcon: this.faBell,
      route: '/notifications',
      requiresAuth: true
    },
    { 
      label: 'Profile', 
      icon: 'person',
      faIcon: this.faUser,
      route: '/profile', 
      requiresAuth: true 
    }
  ];

  constructor(private authService: AuthService) {
    this.currentUser$ = this.authService.currentUser$;
  }

  ngOnInit(): void {
    // Check device screen size
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  checkScreenSize(): void {
    const width = window.innerWidth;
    this.isSmallScreen = width <= this.SCREEN_SM;
    this.isMobile = width <= this.SCREEN_MD;
    
    // Auto-collapse for mobile screens
    if (this.isMobile && !this.isCollapsed) {
      this.isCollapsed = true;
      this.toggleCollapse.emit(true);
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggleCollapse.emit(this.isCollapsed);
  }

  onMenuItemClick(): void {
    // Close sidebar on menu click if on mobile
    if (this.isMobile && !this.isCollapsed) {
      this.isCollapsed = true;
      this.toggleCollapse.emit(true);
    }
  }

  onClickOutside(): void {
    // Only respond to outside clicks if we're on mobile and the sidebar is open
    if (this.isMobile && !this.isCollapsed) {
      this.isCollapsed = true;
      this.toggleCollapse.emit(true);
    }
  }
    onSidebarTabClick(event: MouseEvent): void {
    try {
      // If we're on mobile and the sidebar is collapsed
      if (this.isMobile && this.isCollapsed) {
        const sidebarElement = event.currentTarget as HTMLElement;
        
        if (sidebarElement) {
          const sidebarRect = sidebarElement.getBoundingClientRect();
          const clickX = event.clientX;
          const rightEdge = sidebarRect.right;
          
          // Check if click is on the pull tab (near the right edge of the collapsed sidebar)
          if (clickX >= rightEdge - 30 && clickX <= rightEdge + 20) {
            this.isCollapsed = false;
            this.toggleCollapse.emit(false);
            event.stopPropagation();
          }
        }
      }
    } catch (error) {
      console.error('Error in sidebar click handling:', error);
      // Prevent the error from bubbling up
    }
  }

  isAdmin(user: User | null): boolean {
    return user?.role === 'admin';
  }
}
