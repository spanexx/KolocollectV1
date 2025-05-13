import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './shared/dashboard-layout/dashboard-layout.component';
import { AuthGuard } from './core/guards/auth.guard';
import { ErrorPageComponent } from './pages/error-page/error-page.component';

export const routes: Routes = [
  // Default redirect to home
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Authentication routes (no layout)
  { path: 'login', loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },

  // Error page route
  { path: 'error', component: ErrorPageComponent },

  // Main application routes with Dashboard Layout
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      // Dashboard route
      { 
        path: 'dashboard', 
        loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },

      // User routes
      { 
        path: 'profile', 
        loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent)
      },

      // Community routes
      { 
        path: 'communities', 
        loadComponent: () => import('./components/community/community-list/community-list.component').then(m => m.CommunityListComponent)
      },
      { 
        path: 'communities/create', 
        loadComponent: () => import('./components/community/community-create/community-create.component').then(m => m.CommunityCreateComponent)
      },
      { 
        path: 'communities/:id', 
        loadComponent: () => import('./components/community/community-detail/community-detail.component').then(m => m.CommunityDetailComponent)
      },      // Wallet routes
      { 
        path: 'wallet', 
        loadComponent: () => import('./components/wallet/wallet-dashboard/wallet-dashboard.component').then(m => m.WalletDashboardComponent)
      },
      {
        path: 'wallet/add-funds',
        loadComponent: () => import('./components/wallet/add-funds/add-funds.component').then(m => m.AddFundsComponent)
      },      {
        path: 'wallet/withdraw-funds',
        loadComponent: () => import('./components/wallet/withdraw-funds/withdraw-funds.component').then(m => m.WithdrawFundsComponent)
      },
      {
        path: 'wallet/transfer-funds',
        loadComponent: () => import('./components/wallet/transfer-funds/transfer-funds.component').then(m => m.TransferFundsComponent)
      },
      {
        path: 'wallet/transaction-history',
        loadComponent: () => import('./components/wallet/transaction-history/transaction-history.component').then(m => m.TransactionHistoryComponent)
      },
      {
        path: 'wallet/fix-funds',
        loadComponent: () => import('./components/wallet/fix-funds/fix-funds.component').then(m => m.FixFundsComponent)
      },

      // Contribution routes
      { 
        path: 'contributions', 
        loadComponent: () => import('./components/contribution/contribution-history/contribution-history.component').then(m => m.ContributionHistoryComponent)
      },
      { 
        path: 'contributions/make', 
        loadComponent: () => import('./components/contribution/make-contribution/make-contribution.component').then(m => m.MakeContributionComponent) 
      },      // Payout routes
      { 
        path: 'payouts', 
        loadComponent: () => import('./components/payout/payout-history/payout-history.component').then(m => m.PayoutHistoryComponent)
      },

      // Notifications route
      {
        path: 'notifications',
        loadComponent: () => import('./components/notifications/notifications.component').then(m => m.NotificationsComponent)
      }
    ]
  },

  // Use ErrorPageComponent for not found (404) errors
  { path: '**', component: ErrorPageComponent }
];
