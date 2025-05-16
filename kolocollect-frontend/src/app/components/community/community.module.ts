import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';

// Since we're using standalone components, we import them directly in the routes
const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('../community/community-list/community-list.component').then(m => m.CommunityListComponent)
  },
  { 
    path: 'create', 
    loadComponent: () => import('../community/community-create/community-create.component').then(m => m.CommunityCreateComponent)
  },
  { 
    path: ':id', 
    loadComponent: () => import('../community/community-detail/community-detail.component').then(m => m.CommunityDetailComponent)
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
export class CommunityModule { }
