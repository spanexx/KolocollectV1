import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './error.component.html',
  styleUrl: './error.component.scss'
})
export class ErrorComponent {
  @Input() errorCode: '404' | '500' | '403' | 'offline' | 'generic' = 'generic';
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() buttonText: string = 'Go Back';
  @Input() buttonLink: string = '';
  @Input() showRefresh: boolean = true;

  errorMessages: { [key: string]: { title: string; message: string; } } = {
    '404': {
      title: 'Page Not Found',
      message: 'The page you are looking for doesn\'t exist or has been moved.'
    },
    '500': {
      title: 'Server Error',
      message: 'Something went wrong on our servers. Please try again later.'
    },
    '403': {
      title: 'Access Denied',
      message: 'You don\'t have permission to access this resource.'
    },
    'offline': {
      title: 'No Internet Connection',
      message: 'Please check your internet connection and try again.'
    },
    'generic': {
      title: 'Something Went Wrong',
      message: 'An error occurred. Please try again or contact support if the problem persists.'
    }
  };

  get errorTitle(): string {
    return this.title || this.errorMessages[this.errorCode].title;
  }

  get errorMessage(): string {
    return this.message || this.errorMessages[this.errorCode].message;
  }

  refresh(): void {
    window.location.reload();
  }
}