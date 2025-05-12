import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
// Import Angular compiler for JIT compilation support
import '@angular/compiler';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
