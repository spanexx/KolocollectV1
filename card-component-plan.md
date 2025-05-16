# Card Component Design Plan

## Overview
This document outlines the implementation plan for card components in the KoloCollect project, focusing on creating African-inspired, classy card designs while maintaining code efficiency.

## Design Goals
- Create versatile, consistent card components
- Implement African-inspired visual elements
- Ensure responsive behavior across device sizes
- Keep implementation under 220 lines of code
- Support various card types and states

## Card Variables (to be added to _variables.scss)

```scss
// Card-specific variables
$card-border-radius: 8px;
$card-border-radius-sm: 4px;
$card-border-radius-lg: 12px;

// Card borders and shadows
$card-border-width: 1px;
$card-border-color: $neutral-300;
$card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
$card-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.15);

// Card spacing
$card-padding: 1.5rem;
$card-padding-sm: 1rem;
$card-padding-lg: 2rem;
$card-margin-bottom: 1.5rem;

// Card header/footer
$card-header-padding-y: 1rem;
$card-header-padding-x: 1.5rem;
$card-footer-padding-y: 1rem;
$card-footer-padding-x: 1.5rem;
$card-header-border-color: $neutral-300;
$card-footer-border-color: $neutral-300;
$card-footer-bg: $neutral-200;

// Card accent options
$card-accent-width: 4px;
```

## Card Mixins (to be added to _mixins.scss)

```scss
@mixin card {
  background-color: $background-primary;
  border-radius: $card-border-radius;
  box-shadow: $card-shadow;
  margin-bottom: $card-margin-bottom;
  overflow: hidden;
}

@mixin card-hover {
  transition: box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
  cursor: pointer;
  
  &:hover {
    box-shadow: $card-shadow-hover;
    transform: translateY(-2px);
  }
}

@mixin card-bordered {
  box-shadow: none;
  border: $card-border-width solid $card-border-color;
}

@mixin card-flat {
  box-shadow: none;
  background-color: $background-secondary;
}

@mixin card-accent($position: left, $color: $kente-gold) {
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    
    @if $position == left {
      left: 0;
      top: 0;
      bottom: 0;
      width: $card-accent-width;
    } @else if $position == top {
      left: 0;
      right: 0;
      top: 0;
      height: $card-accent-width;
    }
    
    background-color: $color;
  }
}
```

## Card Styles (_cards.scss)

```scss
// Import variables and mixins
@import 'abstracts/variables';
@import 'abstracts/mixins';

// Base card styles
.card {
  @include card;
  
  // Card variants
  &-bordered {
    @include card-bordered;
  }
  
  &-flat {
    @include card-flat;
  }
  
  &-hover {
    @include card-hover;
  }
  
  // Card with accent border
  &-accent {
    @include card-accent(left, $kente-gold);
    
    &-primary {
      @include card-accent(left, $kente-gold);
    }
    
    &-secondary {
      @include card-accent(left, $indigo-blue);
    }
    
    &-success {
      @include card-accent(left, $savanna-green);
    }
    
    &-warning {
      @include card-accent(left, $warning-color);
    }
    
    &-danger {
      @include card-accent(left, $spice-red);
    }
    
    &-top {
      @include card-accent(top, $kente-gold);
      
      &-primary {
        @include card-accent(top, $kente-gold);
      }
      
      &-secondary {
        @include card-accent(top, $indigo-blue);
      }
    }
  }
  
  // Card elements
  &-header {
    padding: $card-header-padding-y $card-header-padding-x;
    border-bottom: $card-border-width solid $card-header-border-color;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    h1, h2, h3, h4, h5, h6 {
      margin-bottom: 0;
      font-weight: $font-weight-semibold;
    }
  }
  
  &-body {
    padding: $card-padding;
  }
  
  &-footer {
    padding: $card-footer-padding-y $card-footer-padding-x;
    border-top: $card-border-width solid $card-footer-border-color;
    background-color: $card-footer-bg;
  }
  
  // Card sizes
  &-sm {
    .card-header {
      padding: calc($card-header-padding-y * 0.75) calc($card-header-padding-x * 0.75);
    }
    
    .card-body {
      padding: $card-padding-sm;
    }
    
    .card-footer {
      padding: calc($card-footer-padding-y * 0.75) calc($card-footer-padding-x * 0.75);
    }
  }
  
  &-lg {
    .card-header {
      padding: calc($card-header-padding-y * 1.25) calc($card-header-padding-x * 1.25);
    }
    
    .card-body {
      padding: $card-padding-lg;
    }
    
    .card-footer {
      padding: calc($card-footer-padding-y * 1.25) calc($card-footer-padding-x * 1.25);
    }
  }
  
  // Special card designs
  &-media {
    .card-img {
      width: 100%;
      object-fit: cover;
      
      &-top {
        border-top-left-radius: $card-border-radius;
        border-top-right-radius: $card-border-radius;
      }
      
      &-bottom {
        border-bottom-left-radius: $card-border-radius;
        border-bottom-right-radius: $card-border-radius;
      }
    }
  }
  
  // Card group - horizontal layout
  &-group {
    display: flex;
    flex-wrap: wrap;
    margin: -0.5rem;
    
    .card {
      flex: 1 0 calc(50% - 1rem);
      margin: 0.5rem;
      
      @media (max-width: 768px) {
        flex: 1 0 100%;
      }
    }
  }
  
  // Card with shadow on hover only
  &-shadow-hover {
    box-shadow: none;
    transition: box-shadow 0.2s ease-in-out;
    
    &:hover {
      box-shadow: $card-shadow;
    }
  }
  
  // Card with pattern background inspired by African patterns
  &-pattern {
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zm20.97 0l9.315 9.314-1.414 1.414L34.828 0h2.83zM22.344 0L13.03 9.314l1.414 1.414L25.172 0h-2.83zM32 0l12.142 12.142-1.414 1.414L30 2.828 17.272 15.556l-1.414-1.414L28 2v2.828l15.728 15.728 1.414-1.414L30 4v5.657l8.485 8.485 1.415-1.415L30 7.313V0h2zM0 0c6.872 8.286 15.143 8.286 22 0h-2c-5.714 7.143-13.143 7.143-18.857 0H0zm0 2.828l2.828-2.828h-2c-5.714 7.143-13.143 7.143-18.857 0H0l.143.143L0 2.828z' fill='%23D6A325' fill-opacity='0.08' fill-rule='evenodd'/%3E%3C/svg%3E");
      z-index: 0;
    }
    
    .card-body {
      position: relative;
      z-index: 1;
    }
  }
}

// Responsive utility for cards
@media (max-width: 576px) {
  .card {
    .card-header {
      padding: $card-header-padding-y calc($card-header-padding-x * 0.75);
    }
    
    .card-body {
      padding: calc($card-padding * 0.75);
    }
    
    .card-footer {
      padding: $card-footer-padding-y calc($card-footer-padding-x * 0.75);
    }
  }
}
```

## Usage Examples

```html
<!-- Basic card -->
<div class="card">
  <div class="card-body">
    This is a basic card with just a body
  </div>
</div>

<!-- Card with header and footer -->
<div class="card">
  <div class="card-header">
    <h4>Card Title</h4>
    <button class="btn btn-text">Action</button>
  </div>
  <div class="card-body">
    Card content goes here
  </div>
  <div class="card-footer">
    Card footer
  </div>
</div>

<!-- Bordered card -->
<div class="card card-bordered">
  <div class="card-body">
    This card uses a border instead of a shadow
  </div>
</div>

<!-- Card with accent -->
<div class="card card-accent">
  <div class="card-body">
    This card has a left border accent in the primary color
  </div>
</div>

<!-- Card with top accent -->
<div class="card card-accent-top-secondary">
  <div class="card-body">
    This card has a top border accent in the secondary color
  </div>
</div>

<!-- Clickable card -->
<div class="card card-hover">
  <div class="card-body">
    This card has hover effects
  </div>
</div>

<!-- Card with image -->
<div class="card card-media">
  <img src="..." class="card-img-top" alt="...">
  <div class="card-body">
    Card with a top image
  </div>
</div>

<!-- Card with African pattern background -->
<div class="card card-pattern">
  <div class="card-body">
    This card has a subtle African-inspired pattern background
  </div>
</div>
```

## Implementation Steps

1. **Update _variables.scss**
   - Add card-specific variables (colors, sizes, etc.)

2. **Update _mixins.scss**
   - Add card-related mixins for reuse

3. **Create components/_cards.scss**
   - Implement the card styles above
   - Ensure the file stays under 220 lines

4. **Update main.scss**
   - Import the card component

5. **Create Documentation**
   - Add examples and usage guidelines for the team

## Maintenance Considerations

- Keep card variants consistent with the design system
- Ensure responsive behavior across screen sizes
- Consider accessibility for interactive cards
- Test with various content lengths and types
