import { Injector } from '@angular/core';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

// Global injector for accessing services in decorator
let decoratorInjector: Injector;

export function setDecoratorInjector(injector: Injector): void {
  decoratorInjector = injector;
}

/**
 * Performance tracking decorator for component methods
 * @param componentName Optional component name override
 */
export function TrackPerformance(componentName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const start = performance.now();
      const result = originalMethod.apply(this, args);
      
      // For async methods (returning a Promise or Observable)
      if (result && typeof result.then === 'function') {
        return result.then((value: any) => {
          const end = performance.now();
          const name = componentName || target.constructor.name;
          const service = decoratorInjector?.get(PerformanceMonitoringService);
          
          if (service) {
            service.trackComponentRender(name, end - start);
          }
          
          return value;
        });
      } 
      // For rxjs Observable
      else if (result && typeof result.subscribe === 'function') {
        const end = performance.now();
        const name = componentName || target.constructor.name;
        const service = decoratorInjector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(name, end - start);
        }
        
        return result;
      } 
      // For synchronous methods
      else {
        const end = performance.now();
        const name = componentName || target.constructor.name;
        const service = decoratorInjector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(name, end - start);
        }
        
        return result;
      }
    };
    
    return descriptor;
  };
}

/**
 * Class decorator for automatically tracking all lifecycle methods
 */
export function TrackComponentLifecycle(componentName?: string) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    const originalNgOnInit = constructor.prototype.ngOnInit;
    const originalNgAfterViewInit = constructor.prototype.ngAfterViewInit;
    const originalNgOnDestroy = constructor.prototype.ngOnDestroy;
    
    // Track ngOnInit
    if (originalNgOnInit) {
      constructor.prototype.ngOnInit = function () {
        const start = performance.now();
        const result = originalNgOnInit.apply(this);
        const end = performance.now();
        
        const name = componentName || constructor.name;
        const service = decoratorInjector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(`${name}.ngOnInit`, end - start);
        }
        
        return result;
      };
    }
    
    // Track ngAfterViewInit
    if (originalNgAfterViewInit) {
      constructor.prototype.ngAfterViewInit = function () {
        const start = performance.now();
        const result = originalNgAfterViewInit.apply(this);
        const end = performance.now();
        
        const name = componentName || constructor.name;
        const service = decoratorInjector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(`${name}.ngAfterViewInit`, end - start);
        }
        
        return result;
      };
    }
    
    // Track ngOnDestroy (for cleanup timing)
    if (originalNgOnDestroy) {
      constructor.prototype.ngOnDestroy = function () {
        const start = performance.now();
        const result = originalNgOnDestroy.apply(this);
        const end = performance.now();
        
        const name = componentName || constructor.name;
        const service = decoratorInjector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(`${name}.ngOnDestroy`, end - start);
        }
        
        return result;
      };
    }
    
    return constructor;
  };
}
