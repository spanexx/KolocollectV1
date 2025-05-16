import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('../wallet/wallet-dashboard/wallet-dashboard.component').then(m => m.WalletDashboardComponent)
  },
  {
    path: 'add-funds',
    loadComponent: () => import('../wallet/add-funds/add-funds.component').then(m => m.AddFundsComponent)
  },
  {
    path: 'withdraw-funds',
    loadComponent: () => import('../wallet/withdraw-funds/withdraw-funds.component').then(m => m.WithdrawFundsComponent)
  },
  {
    path: 'transfer-funds',
    loadComponent: () => import('../wallet/transfer-funds/transfer-funds.component').then(m => m.TransferFundsComponent)
  },
  {
    path: 'transaction-history',
    loadComponent: () => import('../wallet/transaction-history/transaction-history.component').then(m => m.TransactionHistoryComponent)
  },
  {
    path: 'fix-funds',
    loadComponent: () => import('../wallet/fix-funds/fix-funds.component').then(m => m.FixFundsComponent)
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule,
    SharedModule
  ]
})
export class WalletModule { }
