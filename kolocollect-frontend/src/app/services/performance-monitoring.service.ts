import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NGXLogger } from 'ngx-logger';
import { onCLS, onINP, onLCP, onFCP, Metric } from 'web-vitals';

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitoringService {
  private navigationStartTime: number = 0;
  private readonly METRICS_ENDPOINT = environment.apiUrl + '/metrics';
  private readonly SEND_METRICS_TO_SERVER = environment.production;
  
  constructor(
    private http: HttpClient,
    private router: Router,
    private logger: NGXLogger
  ) {}
  
  /**
   * Initialize performance monitoring
   */
  public initialize(): void {
    this.initNavigationTracking();
    this.initWebVitals();
    this.initErrorTracking();
    
    // Log that monitoring has been initialized
    this.logger.info('Performance monitoring initialized');
  }
  
  /**
   * Track component render time
   * @param componentName The name of the component
   * @param renderTime Time taken to render in ms
   */
  public trackComponentRender(componentName: string, renderTime: number): void {
    this.logger.debug(`Component render: ${componentName} took ${renderTime}ms`);
    
    if (this.SEND_METRICS_TO_SERVER) {
      this.http.post(this.METRICS_ENDPOINT, {
        metricType: 'component_render',
        componentName,
        renderTime,
        timestamp: new Date().toISOString()
      }).subscribe({
        error: err => this.logger.error('Failed to send component render metric', err)
      });
    }
  }
    /**
   * Track navigation timing between routes
   */
  private initNavigationTracking(): void {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const navigationEvent = event as NavigationEnd;
      // Calculate navigation time if we have a start time
      if (this.navigationStartTime > 0) {
        const navigationTime = performance.now() - this.navigationStartTime;
        const url = navigationEvent.urlAfterRedirects;
        
        this.logger.debug(`Navigation to ${url} took ${navigationTime.toFixed(2)}ms`);
        
        if (this.SEND_METRICS_TO_SERVER) {
          this.http.post(this.METRICS_ENDPOINT, {
            metricType: 'navigation',
            url,
            navigationTime,
            timestamp: new Date().toISOString()
          }).subscribe({
            error: err => this.logger.error('Failed to send navigation metric', err)
          });
        }
      }
      
      // Reset start time for next navigation
      this.navigationStartTime = performance.now();
    });
  }
    /**
   * Initialize Web Vitals tracking
   */
  private initWebVitals(): void {
    // Largest Contentful Paint
    onLCP((metric: Metric) => {
      this.logger.debug(`LCP: ${metric.value}ms`);
      this.sendWebVitalMetric('LCP', metric.value);
    });
    
    // Interaction to Next Paint (replaces FID in newer versions)
    onINP((metric: Metric) => {
      this.logger.debug(`INP: ${metric.value}ms`);
      this.sendWebVitalMetric('INP', metric.value);
    });
    
    // Cumulative Layout Shift
    onCLS((metric: Metric) => {
      this.logger.debug(`CLS: ${metric.value}`);
      this.sendWebVitalMetric('CLS', metric.value);
    });
    
    // First Contentful Paint
    onFCP((metric: Metric) => {
      this.logger.debug(`FCP: ${metric.value}ms`);
      this.sendWebVitalMetric('FCP', metric.value);
    });
  }
  
  /**
   * Initialize error tracking
   */
  private initErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.logger.error('Unhandled error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
      
      if (this.SEND_METRICS_TO_SERVER) {
        this.http.post(this.METRICS_ENDPOINT, {
          metricType: 'error',
          message: event.message,
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          timestamp: new Date().toISOString()
        }).subscribe();
      }
    });
  }
  
  /**
   * Send Web Vital metric to server
   */
  private sendWebVitalMetric(name: string, value: number): void {
    if (this.SEND_METRICS_TO_SERVER) {
      this.http.post(this.METRICS_ENDPOINT, {
        metricType: 'web_vital',
        name,
        value,
        timestamp: new Date().toISOString()
      }).subscribe({
        error: err => this.logger.error(`Failed to send ${name} metric`, err)
      });
    }
  }

  /**
   * Reset all performance metrics
   * This method clears any stored metrics and resets tracking
   */
  public resetMetrics(): void {
    this.logger.info('Resetting performance metrics');
    
    // Reset navigation tracking
    this.navigationStartTime = 0;
    
    // Send reset event to server if enabled
    if (this.SEND_METRICS_TO_SERVER) {
      this.http.post(this.METRICS_ENDPOINT, {
        metricType: 'reset',
        timestamp: new Date().toISOString()
      }).subscribe({
        next: () => this.logger.debug('Metrics reset event sent to server'),
        error: err => this.logger.error('Failed to send metrics reset event', err)
      });
    }
  }
}
