import { ApplicationConfig, importProvidersFrom, ErrorHandler, APP_INITIALIZER, Injector } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './core/interceptors/auth-interceptor';
import { ErrorInterceptor } from './core/interceptors/error-interceptor';
import { LoadingInterceptor } from './core/interceptors/loading-interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ErrorService } from './services/error.service';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { setDecoratorInjector } from './decorators/performance.decorator';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { environment } from '../environments/environment';
// Import for JIT compilation support
import '@angular/compiler';

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

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: ErrorHandler, useClass: ErrorService },
    // Performance monitoring providers
    PerformanceMonitoringService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializePerformanceMonitoring,
      deps: [PerformanceMonitoringService, Injector],
      multi: true
    },
    // NGX Logger providers
    importProvidersFrom(
      LoggerModule.forRoot({
        serverLoggingUrl: `${environment.apiUrl}/logs`,
        level: environment.production ? NgxLoggerLevel.WARN : NgxLoggerLevel.DEBUG,
        serverLogLevel: NgxLoggerLevel.ERROR
      })
    )
  ]
};
