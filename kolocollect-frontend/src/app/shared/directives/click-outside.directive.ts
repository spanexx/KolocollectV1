import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) { }
  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent): void {
    try {
      // Check if we have a valid event and target
      if (!event || !event.target) {
        return;
      }
      
      // Check if the click was outside the element
      const clickedInside = this.elementRef.nativeElement.contains(event.target);
      
      if (!clickedInside) {
        this.clickOutside.emit();
      }
    } catch (error) {
      console.error('Error in click outside handling:', error);
    }
  }
}