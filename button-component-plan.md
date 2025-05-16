# Button Component Design Plan

## Overview
This document outlines the implementation plan for button components in the KoloCollect project, focusing on creating an African-inspired, classy aesthetic while maintaining code efficiency.

## Design Goals
- Create consistent, reusable button styles
- Implement an African-inspired color scheme
- Ensure accessibility (color contrast, focus states)
- Keep implementation under 220 lines of code
- Support various button states and variants

## Button Variables (to be added to _variables.scss)

```scss
// Button-specific variables
$btn-border-radius: 4px;
$btn-border-radius-sm: 3px;
$btn-border-radius-lg: 6px;

// Button padding
$btn-padding-x: 1rem;
$btn-padding-y: 0.5rem;
$btn-padding-x-sm: 0.75rem;
$btn-padding-y-sm: 0.375rem;
$btn-padding-x-lg: 1.5rem; 
$btn-padding-y-lg: 0.75rem;

// Button colors (using our African color palette)
$btn-primary-bg: $kente-gold;
$btn-primary-text: $ebony;
$btn-primary-hover: darken($kente-gold, 7%);
$btn-primary-active: darken($kente-gold, 12%);

$btn-secondary-bg: $indigo-blue;
$btn-secondary-text: $neutral-100;
$btn-secondary-hover: darken($indigo-blue, 7%);
$btn-secondary-active: darken($indigo-blue, 12%);

$btn-outline-border-width: 1px;
$btn-outline-hover-opacity: 0.1;

$btn-disabled-opacity: 0.65;

// Transition
$btn-transition: all 0.2s ease-in-out;
```

## Button Mixins (to be added to _mixins.scss)

```scss
@mixin button-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: $font-family-base;
  font-weight: $font-weight-medium;
  font-size: $font-size-sm;
  text-align: center;
  text-decoration: none;
  vertical-align: middle;
  cursor: pointer;
  user-select: none;
  padding: $btn-padding-y $btn-padding-x;
  border-radius: $btn-border-radius;
  border: none;
  transition: $btn-transition;
  line-height: 1.5;
  
  &:focus {
    outline: 0;
    box-shadow: 0 0 0 3px rgba($kente-gold, 0.25);
  }
  
  &:disabled {
    opacity: $btn-disabled-opacity;
    pointer-events: none;
  }
}

@mixin button-primary {
  background-color: $btn-primary-bg;
  color: $btn-primary-text;
  
  &:hover {
    background-color: $btn-primary-hover;
  }
  
  &:active {
    background-color: $btn-primary-active;
  }
}

@mixin button-secondary {
  background-color: $btn-secondary-bg;
  color: $btn-secondary-text;
  
  &:hover {
    background-color: $btn-secondary-hover;
  }
  
  &:active {
    background-color: $btn-secondary-active;
  }
}

@mixin button-outline($color: $btn-secondary-bg) {
  background-color: transparent;
  color: $color;
  border: $btn-outline-border-width solid $color;
  
  &:hover {
    background-color: rgba($color, $btn-outline-hover-opacity);
  }
}

@mixin button-text-only($color: $btn-primary-bg) {
  background-color: transparent;
  color: $color;
  padding: $btn-padding-y ($btn-padding-x * 0.5);
  
  &:hover {
    text-decoration: underline;
    background-color: rgba($color, 0.05);
  }
}

@mixin button-destructive {
  background-color: $spice-red;
  color: $neutral-100;
  
  &:hover {
    background-color: darken($spice-red, 7%);
  }
  
  &:active {
    background-color: darken($spice-red, 12%);
  }
}
```

## Button Styles (_buttons.scss)

```scss
// Import variables and mixins
@import 'abstracts/variables';
@import 'abstracts/mixins';

// Base button styles
.btn {
  @include button-base;
  
  // Button variants
  &-primary {
    @include button-primary;
  }
  
  &-secondary {
    @include button-secondary;
  }
  
  &-outline {
    @include button-outline;
    
    &-primary {
      @include button-outline($kente-gold);
    }
    
    &-destructive {
      @include button-outline($spice-red);
    }
  }
  
  &-text {
    @include button-text-only;
    
    &-secondary {
      @include button-text-only($indigo-blue);
    }
    
    &-destructive {
      @include button-text-only($spice-red);
    }
  }
  
  &-destructive {
    @include button-destructive;
  }
  
  // Size variants
  &-sm {
    padding: $btn-padding-y-sm $btn-padding-x-sm;
    font-size: $font-size-xs;
    border-radius: $btn-border-radius-sm;
  }
  
  &-lg {
    padding: $btn-padding-y-lg $btn-padding-x-lg;
    font-size: $font-size-base;
    border-radius: $btn-border-radius-lg;
  }
  
  // Button with icon
  &-icon {
    display: inline-flex;
    align-items: center;
    
    svg, i, .icon {
      width: 1rem;
      height: 1rem;
      margin-right: 0.5rem;
    }
    
    &-right {
      svg, i, .icon {
        margin-right: 0;
        margin-left: 0.5rem;
      }
    }
    
    &-only {
      padding: $btn-padding-y;
      width: 2.5rem;
      height: 2.5rem;
      
      svg, i, .icon {
        margin: 0;
      }
      
      &.btn-sm {
        padding: $btn-padding-y-sm;
        width: 2rem;
        height: 2rem;
      }
      
      &.btn-lg {
        padding: $btn-padding-y-lg;
        width: 3rem;
        height: 3rem;
      }
    }
  }
  
  // Button group (horizontal)
  &-group {
    display: inline-flex;
    
    .btn {
      border-radius: 0;
      
      &:first-child {
        border-top-left-radius: $btn-border-radius;
        border-bottom-left-radius: $btn-border-radius;
      }
      
      &:last-child {
        border-top-right-radius: $btn-border-radius;
        border-bottom-right-radius: $btn-border-radius;
      }
      
      &:not(:last-child) {
        border-right: 1px solid rgba(0, 0, 0, 0.1);
      }
      
      &-outline:not(:last-child) {
        border-right: none;
        margin-right: -$btn-outline-border-width;
      }
    }
  }
  
  // Loading state
  &-loading {
    position: relative;
    color: transparent;
    pointer-events: none;
    
    &::after {
      content: '';
      position: absolute;
      width: 1rem;
      height: 1rem;
      border: 2px solid currentColor;
      border-radius: 50%;
      border-right-color: transparent;
      animation: btn-spin 0.75s linear infinite;
    }
  }
}

// Animation for loading state
@keyframes btn-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Usage Examples

```html
<!-- Primary button -->
<button class="btn btn-primary">Primary Action</button>

<!-- Secondary button -->
<button class="btn btn-secondary">Secondary Action</button>

<!-- Outline button -->
<button class="btn btn-outline">Outline Action</button>

<!-- Text-only button -->
<button class="btn btn-text">Text Action</button>

<!-- Button with icon -->
<button class="btn btn-primary btn-icon">
  <i class="icon-plus"></i>
  Add New
</button>

<!-- Button with icon on right -->
<button class="btn btn-primary btn-icon-right">
  Next
  <i class="icon-arrow-right"></i>
</button>

<!-- Small button -->
<button class="btn btn-primary btn-sm">Small Button</button>

<!-- Large button -->
<button class="btn btn-primary btn-lg">Large Button</button>

<!-- Icon-only button -->
<button class="btn btn-primary btn-icon-only">
  <i class="icon-settings"></i>
</button>

<!-- Button group -->
<div class="btn-group">
  <button class="btn btn-primary">Left</button>
  <button class="btn btn-primary">Middle</button>
  <button class="btn btn-primary">Right</button>
</div>
```

## Implementation Steps

1. **Update _variables.scss**
   - Add button-specific variables (colors, sizes, etc.)

2. **Update _mixins.scss**
   - Add button-related mixins for reuse

3. **Create components/_buttons.scss**
   - Implement the button styles above
   - Ensure the file stays under 220 lines

4. **Update main.scss**
   - Import the button component

5. **Create Documentation**
   - Add examples and usage guidelines for the team

## Maintenance Considerations

- Keep button variants consistent with the design system
- Ensure new buttons follow the established patterns
- Review for accessibility compliance
- Test in various browsers and screen sizes
