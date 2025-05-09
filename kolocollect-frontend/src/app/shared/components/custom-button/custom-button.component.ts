import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-custom-button',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, RouterModule],
  templateUrl: './custom-button.component.html',
  styleUrl: './custom-button.component.scss'
})
export class CustomButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'tertiary' | 'destructive' = 'primary';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() icon: IconDefinition | null = null;
  @Input() iconPosition: 'left' | 'right' = 'left';
  @Input() fullWidth: boolean = false;
  @Input() disabled: boolean = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() ariaLabel: string = '';
  @Input() loading: boolean = false;
  @Input() url: string | null = null;
  @Input() queryParams: {[key: string]: any} | null = null;
  @Input() target: '_blank' | '_self' | '_parent' | '_top' = '_self';
  
  @Output() buttonClick = new EventEmitter<MouseEvent>();
  
  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.buttonClick.emit(event);
    }
  }
  
  get buttonClasses(): string {
    const classes = [
      'custom-btn',
      `btn-${this.variant}`,
      `btn-${this.size}`
    ];
    
    if (this.fullWidth) classes.push('btn-full-width');
    if (this.disabled) classes.push('btn-disabled');
    if (this.loading) classes.push('btn-loading');
    
    return classes.join(' ');
  }
}
