import { Component, OnInit, inject, Injector } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/toast/toast.component';
import { LoadingComponent } from './shared/loading/loading.component';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';
import { setDecoratorInjector } from './decorators/performance.decorator';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent, LoadingComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'kolocollect-frontend';
  
  private performanceMonitoring = inject(PerformanceMonitoringService);
  private injector = inject(Injector);

  ngOnInit(): void {
    // Set up the injector for decorators
    setDecoratorInjector(this.injector);
    
    // Initialize performance monitoring
    this.performanceMonitoring.initialize();
    console.log('🚀 Performance monitoring initialized');
  }
}
