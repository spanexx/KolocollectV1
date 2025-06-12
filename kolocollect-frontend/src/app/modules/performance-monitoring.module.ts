import { NgModule, ModuleWithProviders, Injector, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';
import { setDecoratorInjector } from '../decorators/performance.decorator';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { environment } from '../../environments/environment';

export function initializePerformanceMonitoring(
  performanceService: PerformanceMonitoringService,
  injector: Injector
): () => void {
  return () => {
    // Set the injector for decorators
    setDecoratorInjector(injector);
    
    // Initialize performance monitoring
    performanceService.initialize();
  };
}

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    LoggerModule.forRoot({
      serverLoggingUrl: `${environment.apiUrl}/logs`,
      level: environment.production ? NgxLoggerLevel.WARN : NgxLoggerLevel.DEBUG,
      serverLogLevel: NgxLoggerLevel.ERROR
    })
  ],
  providers: [
    PerformanceMonitoringService
  ]
})
export class PerformanceMonitoringModule {
  static forRoot(): ModuleWithProviders<PerformanceMonitoringModule> {
    return {
      ngModule: PerformanceMonitoringModule,
      providers: [
        PerformanceMonitoringService,
        {
          provide: APP_INITIALIZER,
          useFactory: initializePerformanceMonitoring,
          deps: [PerformanceMonitoringService, Injector],
          multi: true
        }
      ]
    };
  }
}
