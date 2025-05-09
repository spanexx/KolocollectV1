import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../../services/loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Create a loading key based on the request URL and method
    const loadingKey = `${request.method}-${request.url}`;
    
    // Start loading for this request
    this.loadingService.start(loadingKey);
    
    return next.handle(request).pipe(
      finalize(() => {
        // Stop loading for this request when it completes (success or error)
        this.loadingService.stop(loadingKey);
      })
    );
  }
}