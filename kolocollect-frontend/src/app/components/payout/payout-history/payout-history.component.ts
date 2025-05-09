import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-payout-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './payout-history.component.html',
  styleUrls: ['./payout-history.component.scss']
})
export class PayoutHistoryComponent implements OnInit {
  displayedColumns: string[] = ['date', 'community', 'cycle', 'amount', 'status'];

  constructor() { }

  ngOnInit(): void {
    // Payout history initialization logic will be implemented here
  }
}