import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('../contribution/contribution-history/contribution-history.component').then(m => m.ContributionHistoryComponent)
  },
  { 
    path: 'make', 
    loadComponent: () => import('../contribution/make-contribution/make-contribution.component').then(m => m.MakeContributionComponent) 
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
export class ContributionModule { }
