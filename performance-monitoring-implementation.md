# Performance Monitoring Implementation Plan

This document outlines the implementation plan for monitoring both the backend and frontend performance of the KoloCollect application. We'll use industry-standard tools to establish baselines before implementing any optimizations, allowing us to measure the impact of our changes.

## Implementation Approach

Our implementation will follow a phased approach:

1. Install and configure monitoring tools
2. Establish performance baselines
3. Implement key metrics tracking
4. Create dashboards for visualization
5. Set up alerting for critical thresholds

## Backend Monitoring Implementation

We'll implement backend monitoring using a combination of:

- **Express Prometheus Middleware** - For API metrics
- **Pino Logger** - For structured logging with performance context
- **MongoDB monitoring** - For database performance tracking
- **Node.js diagnostics** - For runtime metrics

### Step 1: Install Required Packages

```bash
cd kolocollect-backend
npm install prom-client express-prom-bundle pino pino-http mongodb-metrics node-clinic
```

### Step 2: Configure Express Prometheus Middleware

We'll create a monitoring middleware that will track HTTP request metrics.

1. Create a new file at `middlewares/prometheusMiddleware.js`:

```javascript
const promBundle = require('express-prom-bundle');

// Create metrics middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: 'kolocollect' },
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000,
    },
  },
});

module.exports = metricsMiddleware;
```

2. Add the middleware to `server.js` before all route definitions:

```javascript
const metricsMiddleware = require('./middlewares/prometheusMiddleware');

// Add metrics middleware before routes
app.use(metricsMiddleware);
```

### Step 3: Implement Structured Logging with Pino

1. Create a logger instance in `utils/logger.js`:

```javascript
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: { pid: process.pid, hostname: process.env.HOSTNAME || 'unknown' },
});

module.exports = logger;
```

2. Create an HTTP logger middleware in `middlewares/loggingMiddleware.js`:

```javascript
const pinoHttp = require('pino-http');
const logger = require('../utils/logger');

const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: function (res) {
    if (res.statusCode === 404) {
      return 'Resource not found';
    }
    return `Request completed in ${res.responseTime}ms`;
  },
  customErrorMessage: function (error, res) {
    return `Request failed with error: ${error.message}`;
  },
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'responseTimeMs',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-length': req.headers['content-length'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = httpLogger;
```

3. Add the HTTP logger middleware to `server.js`:

```javascript
const httpLogger = require('./middlewares/loggingMiddleware');

// Add HTTP logger middleware before routes
app.use(httpLogger);
```

### Step 4: Implement Database Query Monitoring

1. Create a MongoDB monitoring utility in `utils/dbMonitor.js`:

```javascript
const mongoose = require('mongoose');
const logger = require('./logger');

// Track slow queries
mongoose.set('debug', function (collectionName, method, query, doc, options) {
  const startTime = Date.now();
  const queryInfo = {
    collection: collectionName,
    method: method,
    query: JSON.stringify(query),
    options: JSON.stringify(options),
  };
  
  return function (err, result) {
    const duration = Date.now() - startTime;
    
    // Log queries that take longer than 100ms
    if (duration > 100) {
      logger.warn({
        msg: 'Slow MongoDB Query',
        duration,
        ...queryInfo,
      });
    }
    
    // For very slow queries, log as error
    if (duration > 1000) {
      logger.error({
        msg: 'Very Slow MongoDB Query',
        duration,
        ...queryInfo,
      });
    }
  };
});

// Add MongoDB connection monitoring
function monitorMongoConnection() {
  mongoose.connection.on('error', (err) => {
    logger.error({ msg: 'MongoDB connection error', error: err.message });
  });
  
  mongoose.connection.on('disconnected', () => {
    logger.warn({ msg: 'MongoDB disconnected' });
  });
  
  mongoose.connection.on('reconnected', () => {
    logger.info({ msg: 'MongoDB reconnected' });
  });
}

module.exports = { monitorMongoConnection };
```

2. Add the MongoDB monitoring to `config/db.js`:

```javascript
const { monitorMongoConnection } = require('../utils/dbMonitor');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected');
    
    // Add monitoring
    monitorMongoConnection();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error}`);
    process.exit(1);
  }
};
```

### Step 5: Implement API Response Time Tracking

1. Create a response time tracking middleware in `middlewares/responseTimeMiddleware.js`:

```javascript
const { Histogram } = require('prom-client');
const logger = require('../utils/logger');

// Create histogram metric for response times
const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000], // buckets in ms
});

// Middleware function
const responseTimeMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  // The following function will be called on response finish
  res.on('finish', () => {
    const durationInMs = getDurationInMilliseconds(start);
    
    // Get route path if matched by router
    const route = req.route ? req.route.path : req.path;
    
    // Update Prometheus metric
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(durationInMs);
    
    // Log slow responses
    if (durationInMs > 1000) {
      logger.warn({
        msg: 'Slow Response',
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: durationInMs,
      });
    }
  });
  
  next();
};

// Helper function to calculate duration in milliseconds
const getDurationInMilliseconds = (start) => {
  const NS_PER_SEC = 1e9; // convert to nanoseconds
  const NS_TO_MS = 1e6; // convert to milliseconds
  const diff = process.hrtime(start);
  
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

module.exports = responseTimeMiddleware;
```

2. Add the response time middleware to `server.js`:

```javascript
const responseTimeMiddleware = require('./middlewares/responseTimeMiddleware');

// Add response time middleware before routes
app.use(responseTimeMiddleware);
```

### Step 6: Add Memory Usage Monitoring

1. Create a memory monitoring utility in `utils/memoryMonitor.js`:

```javascript
const { Gauge } = require('prom-client');
const logger = require('./logger');

// Create memory gauges
const memoryUsage = new Gauge({
  name: 'node_process_memory_usage_bytes',
  help: 'Memory usage of the Node.js process',
  labelNames: ['type'],
});

// Initialize memory monitoring
function initMemoryMonitoring(interval = 60000) {
  // Update memory metrics initially
  updateMemoryMetrics();
  
  // Update metrics at regular intervals
  setInterval(updateMemoryMetrics, interval);
  
  // Log memory usage on significant changes
  let lastRssValue = process.memoryUsage().rss;
  
  setInterval(() => {
    const currentRss = process.memoryUsage().rss;
    const percentChange = Math.abs((currentRss - lastRssValue) / lastRssValue * 100);
    
    // Log if memory usage changes by more than 10%
    if (percentChange > 10) {
      logger.info({
        msg: 'Significant memory usage change',
        previousMB: Math.round(lastRssValue / 1024 / 1024 * 100) / 100,
        currentMB: Math.round(currentRss / 1024 / 1024 * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
      });
      
      lastRssValue = currentRss;
    }
  }, interval);
}

// Update memory metrics
function updateMemoryMetrics() {
  const memUsage = process.memoryUsage();
  
  // Set metrics for different memory types
  memoryUsage.labels('rss').set(memUsage.rss);
  memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
  memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
  memoryUsage.labels('external').set(memUsage.external);
  
  // Log memory usage periodically
  logger.debug({
    msg: 'Memory usage',
    rss: `${Math.round(memUsage.rss / 1024 / 1024 * 100) / 100} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
  });
}

module.exports = { initMemoryMonitoring };
```

2. Initialize memory monitoring in `server.js`:

```javascript
const { initMemoryMonitoring } = require('./utils/memoryMonitor');

// Initialize memory monitoring after server starts
server.on('listening', () => {
  console.log(`Server running on port ${PORT}`);
  initMemoryMonitoring();
});
```

### Step 7: Add Performance Testing Scripts

1. Create a performance testing script using Clinic.js in `scripts/performance-profile.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

// Define the profiling command
const command = process.argv[2] || 'doctor';
const validCommands = ['doctor', 'flame', 'bubbleprof', 'heapprofiler'];

if (!validCommands.includes(command)) {
  console.error(`Invalid command: ${command}`);
  console.error(`Valid commands are: ${validCommands.join(', ')}`);
  process.exit(1);
}

// Run the profiling
console.log(`Running performance profiling with clinic ${command}`);
try {
  execSync(`npx clinic ${command} -- node server.js`, {
    stdio: 'inherit',
    env: { ...process.env, PORT: 6001 } // Use different port for testing
  });
} catch (error) {
  console.error('Error running performance profiling:', error);
  process.exit(1);
}
```

2. Add a script to `package.json`:

```json
"scripts": {
  "profile": "node scripts/performance-profile.js",
  "profile:doctor": "node scripts/performance-profile.js doctor",
  "profile:flame": "node scripts/performance-profile.js flame",
  "profile:bubbleprof": "node scripts/performance-profile.js bubbleprof",
  "profile:heap": "node scripts/performance-profile.js heapprofiler"
}
```

## Frontend Monitoring Implementation

For the frontend, we'll implement monitoring using:

- **Angular Performance Module** - For component metrics
- **Navigation Timing API** - For page load metrics
- **Web Vitals Library** - For Core Web Vitals tracking
- **Custom performance tracking** - For application-specific metrics

### Step 1: Install Required Packages

```bash
cd kolocollect-frontend
npm install web-vitals @angular/service-worker ngx-logger
```

### Step 2: Implement Performance Monitoring Service

1. Create a performance monitoring service at `src/app/services/performance-monitoring.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NGXLogger } from 'ngx-logger';
import { onCLS, onFID, onLCP, onFCP } from 'web-vitals';

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
    ).subscribe((event: NavigationEnd) => {
      // Calculate navigation time if we have a start time
      if (this.navigationStartTime > 0) {
        const navigationTime = performance.now() - this.navigationStartTime;
        const url = event.urlAfterRedirects;
        
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
    onLCP(metric => {
      this.logger.debug(`LCP: ${metric.value}ms`);
      this.sendWebVitalMetric('LCP', metric.value);
    });
    
    // First Input Delay
    onFID(metric => {
      this.logger.debug(`FID: ${metric.value}ms`);
      this.sendWebVitalMetric('FID', metric.value);
    });
    
    // Cumulative Layout Shift
    onCLS(metric => {
      this.logger.debug(`CLS: ${metric.value}`);
      this.sendWebVitalMetric('CLS', metric.value);
    });
    
    // First Contentful Paint
    onFCP(metric => {
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
}
```

### Step 3: Create Performance Monitoring Module

1. Create a dedicated module for performance monitoring at `src/app/modules/performance-monitoring.module.ts`:

```typescript
import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { environment } from '../../environments/environment';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule,
    LoggerModule.forRoot({
      serverLoggingUrl: environment.apiUrl + '/logs',
      level: environment.production ? NgxLoggerLevel.ERROR : NgxLoggerLevel.DEBUG,
      serverLogLevel: NgxLoggerLevel.ERROR,
      disableConsoleLogging: environment.production
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
      providers: [PerformanceMonitoringService]
    };
  }
}
```

### Step 4: Create Component Performance Decorator

1. Create a utility for tracking component performance at `src/app/utils/performance.decorator.ts`:

```typescript
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';

/**
 * Decorator to track the render time of a component
 * @param componentName Optional name, defaults to class name
 */
export function TrackRender(componentName?: string) {
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
          const service = this.injector?.get(PerformanceMonitoringService);
          
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
        const service = this.injector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(name, end - start);
        }
      } 
      // For synchronous methods
      else {
        const end = performance.now();
        const name = componentName || target.constructor.name;
        const service = this.injector?.get(PerformanceMonitoringService);
        
        if (service) {
          service.trackComponentRender(name, end - start);
        }
        
        return result;
      }
    };
    
    return descriptor;
  };
}
```

### Step 5: Implement Performance Metrics API Endpoint

1. Create a metrics endpoint in the backend at `routes/metricsRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

router.post('/', (req, res) => {
  const metric = req.body;
  
  // Log the metric
  logger.info({
    msg: 'Frontend performance metric received',
    metric
  });
  
  // Here you could also store metrics in a database
  // or forward them to a dedicated metrics system
  
  res.status(200).json({ success: true });
});

module.exports = router;
```

2. Add the metrics routes to `server.js`:

```javascript
const metricsRoutes = require('./routes/metricsRoutes');

// Add metrics routes
app.use('/api/metrics', metricsRoutes);
```

### Step 6: Initialize Performance Monitoring in App

1. Update `app.module.ts` to include the performance monitoring module:

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { PerformanceMonitoringModule } from './modules/performance-monitoring.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    PerformanceMonitoringModule.forRoot(),
    // other modules...
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

2. Initialize the monitoring service in `app.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(private performanceMonitoring: PerformanceMonitoringService) {}
  
  ngOnInit() {
    // Initialize performance monitoring
    this.performanceMonitoring.initialize();
  }
}
```

### Step 7: Example Usage in Components

1. Example component with performance tracking:

```typescript
import { Component, OnInit, Injector } from '@angular/core';
import { TrackRender } from '../../utils/performance.decorator';

@Component({
  selector: 'app-community-list',
  templateUrl: './community-list.component.html',
  styleUrls: ['./community-list.component.scss']
})
export class CommunityListComponent implements OnInit {
  // Injector needed for the decorator to access services
  constructor(public injector: Injector) {}
  
  @TrackRender('CommunityList')
  ngOnInit() {
    // Component initialization logic
  }
  
  @TrackRender('CommunityListLoad')
  loadCommunities() {
    // Loading logic
  }
}
```

## Visualization and Analysis

### Backend Visualization

1. For Prometheus metrics, you can use Grafana:
   - Install Grafana
   - Add Prometheus as a data source
   - Create dashboards for API performance, memory usage, and database metrics

2. For log analysis, you can use:
   - Elasticsearch + Kibana
   - Loki + Grafana
   - Papertrail or similar hosted service

### Frontend Visualization

1. Create a simple performance dashboard component:

```typescript
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-performance-dashboard',
  templateUrl: './performance-dashboard.component.html',
  styleUrls: ['./performance-dashboard.component.scss']
})
export class PerformanceDashboardComponent implements OnInit {
  webVitals: any = {};
  navigationTimes: any[] = [];
  componentRenderTimes: any = {};
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    // Only load in development or if explicitly enabled
    if (!environment.production || environment.enablePerfDashboard) {
      this.loadMetrics();
    }
  }
  
  loadMetrics() {
    this.http.get(`${environment.apiUrl}/metrics/summary`).subscribe(
      (data: any) => {
        this.webVitals = data.webVitals || {};
        this.navigationTimes = data.navigationTimes || [];
        this.componentRenderTimes = data.componentRenderTimes || {};
      },
      error => console.error('Failed to load performance metrics', error)
    );
  }
}
```

## Running the Monitoring Tools

### Backend Monitoring

1. Start the backend with monitoring enabled:

```bash
cd kolocollect-backend
npm run start
```

2. View metrics:
   - Prometheus metrics: <http://localhost:6000/metrics>
   - Run profiling: `npm run profile:doctor`

### Frontend Monitoring

1. Enable monitoring in development:

```bash
cd kolocollect-frontend
ng serve
```

2. View performance in browser:
   - Open Chrome DevTools > Performance tab
   - Use Lighthouse for audit
   - Check the performance dashboard at /performance if implemented

## Next Steps

After implementing monitoring, we should:

1. **Establish Baselines**
   - Collect at least one week of metrics
   - Document average and p95 response times
   - Document baseline Core Web Vitals

2. **Set Performance Budgets**
   - API response time limits
   - Component render time limits
   - Bundle size limits

3. **Implement Automated Testing**
   - Add load testing with k6 or JMeter
   - Create performance regression tests

4. **Begin Optimization Work**
   - Start with highest impact items from the optimization reports
   - Measure before and after each change
   - Document improvements
