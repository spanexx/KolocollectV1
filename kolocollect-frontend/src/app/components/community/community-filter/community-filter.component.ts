import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
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
  faArrowsRotate
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-community-filter',
  standalone: true,
  imports: [
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
    FontAwesomeModule
  ],
  templateUrl: './community-filter.component.html',
  styleUrls: ['./community-filter.component.scss']
})
export class CommunityFilterComponent implements OnInit {
  @Input() isLoading: boolean = false;
  @Output() filterChange = new EventEmitter<any>();
  
  filterForm!: FormGroup;
  
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

  // Filter options
  contributionFrequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];
  
  sortOptions = [
    { value: 'memberCount', label: 'Member Count' },
    { value: 'minContribution', label: 'Contribution Amount' },
    { value: 'backupFund', label: 'Backup Fund' },
    { value: 'createdAt', label: 'Creation Date' }
  ];
  
  // Initial values for range sliders
  maxBackupFund: number = 10000;
  maxMinContribution: number = 5000;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  initializeForm(): void {
    this.filterForm = this.fb.group({
      status: ['active'],
      backupFundMin: [0],
      backupFundMax: [this.maxBackupFund],
      minContributionMin: [0],
      minContributionMax: [this.maxMinContribution],
      contributionFrequency: [''],
      memberCountMin: [0],
      memberCountMax: [100],
      sortBy: ['createdAt'],
      order: ['desc'],
      onlyJoinable: [false]
    });

    // Listen for form changes with a slight delay to prevent too many API calls
    this.filterForm.valueChanges.subscribe(values => {
      this.onFilterChange();
    });
  }

  onFilterChange(): void {
    const filters = { ...this.filterForm.value };
    
    // Clean up empty values
    Object.keys(filters).forEach(key => {
      if (filters[key] === '' || filters[key] === null) {
        delete filters[key];
      }
    });
    
    this.filterChange.emit(filters);
  }

  resetFilters(): void {
    this.filterForm.reset({
      status: 'active',
      backupFundMin: 0,
      backupFundMax: this.maxBackupFund,
      minContributionMin: 0,
      minContributionMax: this.maxMinContribution,
      contributionFrequency: '',
      memberCountMin: 0,
      memberCountMax: 100,
      sortBy: 'createdAt',
      order: 'desc',
      onlyJoinable: false
    });
    
    this.onFilterChange();
  }
}
