import { Component, OnInit, OnChanges, Output, Input, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faFilter, 
  faSort, 
  faSearch,  
  faSliders,
  faSortAlphaDown,
  faSortAlphaUp,
  faCoins,
  faClock,
  faUsers,
  faBan,
  faArrowsRotate,
  faUserPlus,
  faHandHoldingDollar,
  faChevronLeft,
  faChevronRight,
  faTimes,
  faAngleLeft,
  faAngleRight
} from '@fortawesome/free-solid-svg-icons';
import { Community } from '../../../models/community.model';

@Component({
  selector: 'app-community-frontend-filter',  standalone: true,  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSliderModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    FontAwesomeModule
  ],
  templateUrl: './community-frontend-filter.component.html',
  styleUrls: ['./community-frontend-filter.component.scss']
})
export class CommunityFrontendFilterComponent implements OnInit, OnChanges {  @Input() communities: Community[] = []; // All communities to filter
  @Input() isLoading: boolean = false;
  @Output() filteredCommunitiesChange = new EventEmitter<Community[]>();
  @Output() totalCountChange = new EventEmitter<number>();
  
  searchQuery: string = '';
  filterForm!: FormGroup;
  isFilterOpen: boolean = false; // Controls the sidebar visibility
  
  // FontAwesome icons
  faFilter = faFilter;
  faSort = faSort;
  faSearch = faSearch;
  faSliders = faSliders;
  faSortAlphaDown = faSortAlphaDown;
  faSortAlphaUp = faSortAlphaUp;
  faCoins = faCoins;
  faClock = faClock;
  faUsers = faUsers;
  faBan = faBan;
  faArrowsRotate = faArrowsRotate;
  faUserPlus = faUserPlus;
  faHandHoldingDollar = faHandHoldingDollar;
  faChevronLeft = faChevronLeft;
  faChevronRight = faChevronRight;
  faTimes = faTimes;
  faAngleLeft = faAngleLeft;
  faAngleRight = faAngleRight;
  
  sortOptions = [
    { value: 'memberCount', label: 'Member Count' },
    { value: 'minContribution', label: 'Contribution Amount' },
    { value: 'backupFund', label: 'Backup Fund' },
    { value: 'createdAt', label: 'Creation Date' }
  ];

  constructor(private fb: FormBuilder) {}
  ngOnInit(): void {
    this.initializeForm();
    
    // Log sample community structure when available
    if (this.communities && this.communities.length > 0) {
      console.log('Sample community object structure:', this.communities[0]);
    }
  }
  
  ngOnChanges(): void {
    // When communities input changes, log the structure
    if (this.communities && this.communities.length > 0) {
      console.log('Communities loaded:', this.communities.length);
      console.log('Sample community object structure:', this.communities[0]);
      
      // Inspect sort fields in the sample community
      const sample = this.communities[0];
      console.log('Sort field values in sample community:');
      console.log('- memberCount:', sample.members?.length);
      console.log('- minContribution:', sample.settings?.minContribution);
      console.log('- backupFund:', sample.backupFund);
      console.log('- createdAt:', sample.createdAt);
    }
  }
  initializeForm(): void {
    this.filterForm = this.fb.group({
      sortBy: ['createdAt'],
      order: ['desc']
    });

    // Apply filters when form changes
    this.filterForm.valueChanges.subscribe((values) => {
      console.log('Form values changed:', values);
      this.applyFilters();
    });
  }
  applyFilters(): void {
    console.log('Applying filters with form values:', this.filterForm.value);
    
    if (!this.communities || this.communities.length === 0) {
      console.log('No communities to filter');
      this.filteredCommunitiesChange.emit([]);
      this.totalCountChange.emit(0);
      return;
    }

    let filteredCommunities = [...this.communities];
    console.log('Starting with', filteredCommunities.length, 'communities');
    
    // Apply search query if present
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      filteredCommunities = filteredCommunities.filter(community => {
        return (
          (community.name && community.name.toLowerCase().includes(query)) ||
          (community.description && community.description.toLowerCase().includes(query))
        );
      });
      console.log('After search query filtering:', filteredCommunities.length, 'communities');
    }
    
    const filterValues = this.filterForm.value;    // Sort communities
    if (filterValues.sortBy) {
      const sortField = filterValues.sortBy as string;
      const sortOrder = filterValues.order === 'desc' ? -1 : 1;
      
      console.log('Sorting by:', sortField, 'Order:', filterValues.order);
        // Sort communities
      filteredCommunities.sort((a, b) => {
        let valueA, valueB;
        
        switch (sortField) {
          case 'memberCount':
            valueA = a.members?.length || 0;
            valueB = b.members?.length || 0;
            break;
          case 'minContribution':
            valueA = a.settings?.minContribution || 0;
            valueB = b.settings?.minContribution || 0;
            break;
          case 'backupFund':
            valueA = a.backupFund || 0;
            valueB = b.backupFund || 0;
            break;
          case 'createdAt':
            valueA = new Date(a.createdAt || 0).getTime();
            valueB = new Date(b.createdAt || 0).getTime();
            break;
          default:
            valueA = (a as any)[sortField] || 0;
            valueB = (b as any)[sortField] || 0;
        }
        
        if (valueA < valueB) return -1 * sortOrder;
        if (valueA > valueB) return 1 * sortOrder;
        return 0;
      });
    } // Debug: check if sorting actually changed the order
    this.debugSortResult(filteredCommunities, filterValues.sortBy);
    
    // Emit the filtered and sorted communities
    this.filteredCommunitiesChange.emit(filteredCommunities);
    this.totalCountChange.emit(filteredCommunities.length);
  }
  
  /**
   * Debug method to check if sorting was effective
   */  private debugSortResult(communities: Community[], sortField: string): void {
    if (communities.length < 2) {
      console.log('Too few communities to verify sorting');
      return;
    }
    
    console.log(`Top 5 communities after sorting by ${sortField}:`);
    
    // Get the first 5 communities (or all if less than 5)
    const topFive = communities.slice(0, Math.min(5, communities.length));
    
    // Extract the relevant values for the sort field
    const sortValues = topFive.map(c => {
      let value;
      switch (sortField) {
        case 'memberCount':
          value = c.members?.length || 0;
          break;
        case 'minContribution':
          value = c.settings?.minContribution || 0;
          break;
        case 'backupFund':
          value = c.backupFund || 0;
          break;
        case 'createdAt':
          value = new Date(c.createdAt || 0).toISOString();
          break;
        default:
          value = (c as any)[sortField] || 0;
      }
      
      return {
        name: c.name,
        value: value
      };
    });
    
    console.table(sortValues);
  }

  search(): void {
    this.applyFilters();
  }
  resetFilters(): void {
    this.searchQuery = '';
    this.filterForm.reset({
      sortBy: 'createdAt',
      order: 'desc'
    });
    
    this.applyFilters();
  }
    setSortOrder(order: 'asc' | 'desc'): void {
    console.log('Setting sort order to:', order);
    this.filterForm.get('order')?.setValue(order);
    // Force apply filters to make sure sorting happens immediately
    this.applyFilters();
  }
    setSortField(field: string): void {
    console.log('Setting sort field to:', field);
    this.filterForm.get('sortBy')?.setValue(field);
    // Force apply filters to make sure sorting happens immediately
    this.applyFilters();
  }

  /**
   * Toggle the filter sidebar visibility
   */
  toggleFilterSidebar(): void {
    this.isFilterOpen = !this.isFilterOpen;
  }
}