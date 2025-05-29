import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faChartLine, 
  faRefresh, 
  faSpinner, 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle,
  faClock,
  faServer,
  faMemory,
  faTachometerAlt
} from '@fortawesome/free-solid-svg-icons';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface PerformanceSection {
  title: string;
  metrics: PerformanceMetric[];
}

interface DashboardData {
  title: string;
  timestamp: string;
  sections: PerformanceSection[];
}

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="performance-dashboard">
      <div class="dashboard-header">
        <div class="header-title">
          <fa-icon [icon]="faChartLine" class="header-icon"></fa-icon>
          <h2>{{ dashboardData?.title || 'Performance Dashboard' }}</h2>
        </div>
        <div class="last-updated">
          <fa-icon [icon]="faClock" class="time-icon"></fa-icon>
          Last updated: {{ dashboardData?.timestamp | date:'medium' }}
          <button 
            class="refresh-btn" 
            (click)="refreshData()"
            [disabled]="isLoading">
            <fa-icon [icon]="isLoading ? faSpinner : faRefresh" 
                     [spin]="isLoading" 
                     class="btn-icon"></fa-icon>
            {{ isLoading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <div class="dashboard-content" *ngIf="dashboardData">
        <div class="metrics-grid">
          <div 
            class="metric-section" 
            *ngFor="let section of dashboardData.sections"
            [attr.data-section]="section.title">
            <h3>{{ section.title }}</h3>
            <div class="metrics-list">
              <div 
                class="metric-card" 
                *ngFor="let metric of section.metrics"
                [class]="'status-' + metric.status">
                <div class="metric-header">
                  <span class="metric-name">{{ metric.name }}</span>
                  <span class="metric-status" [class]="'status-' + metric.status">
                    <fa-icon [icon]="getStatusIcon(metric.status)" class="status-icon"></fa-icon>
                    {{ metric.status }}
                  </span>
                </div>
                <div class="metric-value">
                  <span class="value">{{ metric.value }}</span>
                  <span class="unit">{{ metric.unit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="loading-state" *ngIf="isLoading && !dashboardData">
        <fa-icon [icon]="faSpinner" [spin]="true" class="loading-spinner"></fa-icon>
        <p>Loading performance data...</p>
      </div>

      <div class="error-state" *ngIf="error">
        <div class="error-message">
          <fa-icon [icon]="faTimesCircle" class="error-icon"></fa-icon>
          <h3>Error Loading Performance Data</h3>
          <p>{{ error }}</p>
          <button class="retry-btn" (click)="refreshData()">
            <fa-icon [icon]="faRefresh" class="btn-icon"></fa-icon>
            Retry
          </button>
        </div>
      </div>

      <!-- Quick Stats Summary -->
      <div class="quick-stats" *ngIf="dashboardData">
        <div class="stat-item">
          <fa-icon [icon]="getStatusIcon(overallHealth)" class="stat-icon"></fa-icon>
          <span class="stat-label">Overall Health</span>
          <span class="stat-value" [class]="'status-' + overallHealth">
            {{ overallHealth | titlecase }}
          </span>
        </div>
        <div class="stat-item">
          <fa-icon [icon]="faTachometerAlt" class="stat-icon"></fa-icon>
          <span class="stat-label">Total Metrics</span>
          <span class="stat-value">{{ totalMetrics }}</span>
        </div>
        <div class="stat-item">
          <fa-icon [icon]="faCheckCircle" class="stat-icon status-healthy"></fa-icon>
          <span class="stat-label">Healthy</span>
          <span class="stat-value status-healthy">{{ healthyMetrics }}</span>
        </div>
        <div class="stat-item">
          <fa-icon [icon]="faExclamationTriangle" class="stat-icon status-warning"></fa-icon>
          <span class="stat-label">Warnings</span>
          <span class="stat-value status-warning">{{ warningMetrics }}</span>
        </div>
        <div class="stat-item">
          <fa-icon [icon]="faTimesCircle" class="stat-icon status-critical"></fa-icon>
          <span class="stat-label">Critical</span>
          <span class="stat-value status-critical">{{ criticalMetrics }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .performance-dashboard {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e0e0e0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      font-size: 24px;
      color: #007bff;
    }

    .dashboard-header h2 {
      margin: 0;
      color: #333;
      font-weight: 600;
    }

    .last-updated {
      display: flex;
      align-items: center;
      gap: 15px;
      color: #666;
      font-size: 14px;
    }

    .time-icon {
      color: #007bff;
    }

    .refresh-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .btn-icon {
      font-size: 14px;
    }

    .refresh-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .refresh-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .metric-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border: 1px solid #e0e0e0;
    }

    .metric-section h3 {
      margin: 0 0 15px 0;
      color: #333;
      font-size: 18px;
      font-weight: 600;
    }

    .metrics-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .metric-card {
      padding: 12px;
      border-radius: 6px;
      border-left: 4px solid #ddd;
      background: #f8f9fa;
      transition: all 0.2s;
    }

    .metric-card.status-healthy {
      border-left-color: #28a745;
      background: #f8fff9;
    }

    .metric-card.status-warning {
      border-left-color: #ffc107;
      background: #fffdf5;
    }

    .metric-card.status-critical {
      border-left-color: #dc3545;
      background: #fff5f5;
    }

    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }

    .metric-name {
      font-weight: 500;
      color: #333;
    }

    .metric-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .status-icon {
      font-size: 10px;
    }

    .metric-status.status-healthy {
      background: #d4edda;
      color: #155724;
    }

    .metric-status.status-warning {
      background: #fff3cd;
      color: #856404;
    }

    .metric-status.status-critical {
      background: #f8d7da;
      color: #721c24;
    }

    .metric-value {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }

    .metric-value .value {
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .metric-value .unit {
      font-size: 14px;
      color: #666;
    }

    .quick-stats {
      display: flex;
      justify-content: space-around;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border: 1px solid #e0e0e0;
    }

    .stat-item {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .stat-icon {
      font-size: 20px;
      margin-bottom: 5px;
    }

    .stat-icon.status-healthy {
      color: #28a745;
    }

    .stat-icon.status-warning {
      color: #ffc107;
    }

    .stat-icon.status-critical {
      color: #dc3545;
    }

    .stat-label {
      display: block;
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }

    .stat-value {
      display: block;
      font-size: 20px;
      font-weight: 700;
    }

    .stat-value.status-healthy {
      color: #28a745;
    }

    .stat-value.status-warning {
      color: #ffc107;
    }

    .stat-value.status-critical {
      color: #dc3545;
    }

    .loading-state {
      text-align: center;
      padding: 50px;
    }

    .loading-spinner {
      font-size: 40px;
      color: #007bff;
      margin-bottom: 20px;
    }

    .error-state {
      text-align: center;
      padding: 50px;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 20px;
      border-radius: 6px;
      border: 1px solid #f5c6cb;
    }

    .error-icon {
      font-size: 24px;
      margin-bottom: 10px;
      color: #dc3545;
    }

    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 15px;
      padding: 10px 20px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .retry-btn:hover {
      background: #c82333;
    }

    @media (max-width: 768px) {
      .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }

      .metrics-grid {
        grid-template-columns: 1fr;
      }

      .quick-stats {
        flex-wrap: wrap;
        gap: 15px;
      }
    }
  `]
})
export class PerformanceDashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  
  // Font Awesome icons
  faChartLine = faChartLine;
  faRefresh = faRefresh;
  faSpinner = faSpinner;
  faCheckCircle = faCheckCircle;
  faExclamationTriangle = faExclamationTriangle;
  faTimesCircle = faTimesCircle;
  faClock = faClock;
  faServer = faServer;
  faMemory = faMemory;
  faTachometerAlt = faTachometerAlt;
  
  dashboardData: DashboardData | null = null;
  isLoading = false;
  error: string | null = null;
  
  private refreshSubscription?: Subscription;
  private readonly apiUrl = `${environment.apiUrl}/api/metrics/dashboard`;

  // Computed properties
  get totalMetrics(): number {
    if (!this.dashboardData) return 0;
    return this.dashboardData.sections.reduce((total, section) => 
      total + section.metrics.length, 0);
  }

  get healthyMetrics(): number {
    if (!this.dashboardData) return 0;
    return this.dashboardData.sections.reduce((total, section) => 
      total + section.metrics.filter(m => m.status === 'healthy').length, 0);
  }

  get warningMetrics(): number {
    if (!this.dashboardData) return 0;
    return this.dashboardData.sections.reduce((total, section) => 
      total + section.metrics.filter(m => m.status === 'warning').length, 0);
  }

  get criticalMetrics(): number {
    if (!this.dashboardData) return 0;
    return this.dashboardData.sections.reduce((total, section) => 
      total + section.metrics.filter(m => m.status === 'critical').length, 0);
  }

  get overallHealth(): 'healthy' | 'warning' | 'critical' {
    if (this.criticalMetrics > 0) return 'critical';
    if (this.warningMetrics > 0) return 'warning';
    return 'healthy';
  }

  ngOnInit(): void {
    this.loadDashboardData();
    
    // Auto-refresh every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadDashboardData();
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  async loadDashboardData(): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const data = await this.http.get<DashboardData>(this.apiUrl).toPromise();
      this.dashboardData = data || null;
    } catch (error: any) {
      this.error = error.message || 'Failed to load performance data';
      console.error('Error loading dashboard data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  getStatusIcon(status: 'healthy' | 'warning' | 'critical') {
    switch (status) {
      case 'healthy':
        return this.faCheckCircle;
      case 'warning':
        return this.faExclamationTriangle;
      case 'critical':
        return this.faTimesCircle;
      default:
        return this.faCheckCircle;
    }
  }
}
