# KoloCollect Styling Plan

## Overview

This document outlines the styling approach for the KoloCollect project, focusing on creating a cohesive, maintainable design system with African-inspired colors and a classy aesthetic.

## Design Philosophy

- **African & Classy**: Color palette inspired by African textiles, art, and landscapes
- **Modular Structure**: Each style file limited to 220 lines maximum
- **Component-First**: Styles organized by components for better maintainability
- **Performance-Focused**: Optimized styles to reduce bundle size

## File Structure

```src/styles/
├── abstracts/
│   ├── _variables.scss     // Color palette, spacing, typography variables
│   ├── _functions.scss     // Reusable SCSS functions
│   ├── _mixins.scss        // Mixins for common patterns and responsive design
│   └── _measurements.scss  // Size-related variables and scaling functions
├── base/
│   ├── _reset.scss         // Normalize and reset styles
│   ├── _typography.scss    // Font definitions and text styles
│   ├── _utilities.scss     // Utility classes
│   └── _animations.scss    // Animation definitions
├── components/
│   ├── _buttons.scss       // Button styles and variants
│   ├── _cards.scss         // Card components and variations
│   ├── _forms.scss         // Form elements and states
│   ├── _tables.scss        // Table styling
│   ├── _modals.scss        // Modal and dialog styling
│   └── _navigation.scss    // Navigation components
├── layout/
│   ├── _grid.scss          // Grid system
│   ├── _header.scss        // Header styling
│   └── _footer.scss        // Footer styling
├── pages/                  // Page-specific styles
└── main.scss               // Main entry file importing all partials
```

## Color Palette

The color palette is inspired by African textiles, landscapes, and cultural elements:

### Primary Colors
- **Kente Gold** (`#E8B22A`): Inspired by traditional Kente cloth, representing wealth and royalty
- **Savanna Green** (`#4C7D3B`): Rich greens from African landscapes
- **Terracotta** (`#CD5C1B`): Earth tones from African pottery and soil
- **Indigo Blue** (`#30427A`): Rich blue inspired by traditional dyeing techniques

### Secondary Colors
- **Calabash Cream** (`#F9EFD6`): Neutral background color
- **Ebony** (`#231F20`): Deep, rich black for text and accents
- **Spice Red** (`#C92D2D`): Accent color for attention-grabbing elements
- **Desert Sand** (`#E6D1B1`): Subtle neutral for backgrounds and cards

### Neutral Colors
- **Neutral 100** (`#FFFFFF`)
- **Neutral 200** (`#F4F4F4`)
- **Neutral 300** (`#E0E0E0`)
- **Neutral 400** (`#BDBDBD`)
- **Neutral 500** (`#9E9E9E`)
- **Neutral 600** (`#757575`)
- **Neutral 700** (`#616161`)
- **Neutral 800** (`#424242`)
- **Neutral 900** (`#212121`)

### State Colors
- **Success** (`#4CAF50`): Successful operations
- **Warning** (`#FFC107`): Warning states
- **Error** (`#F44336`): Error states
- **Info** (`#2196F3`): Informational elements

## Typography

### Font Families
- **Primary Font**: 'Montserrat' - Clean, modern sans-serif font for most UI elements
- **Secondary Font**: 'Playfair Display' - Elegant serif font for headings and impactful text
- **Alternative**: 'Ubuntu' - For UI elements requiring more personality

### Font Sizes
- **Extra Small**: 0.75rem (12px)
- **Small**: 0.875rem (14px)
- **Base**: 1rem (16px)
- **Medium**: 1.125rem (18px)
- **Large**: 1.25rem (20px)
- **Extra Large**: 1.5rem (24px)
- **Heading 1**: 2.5rem (40px)
- **Heading 2**: 2rem (32px)
- **Heading 3**: 1.75rem (28px)
- **Heading 4**: 1.5rem (24px)

### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semibold**: 600
- **Bold**: 700

## Spacing System

Using a base unit of 0.25rem (4px) for consistency:
- **spacing-1**: 0.25rem (4px)
- **spacing-2**: 0.5rem (8px)
- **spacing-3**: 0.75rem (12px)
- **spacing-4**: 1rem (16px)
- **spacing-5**: 1.5rem (24px)
- **spacing-6**: 2rem (32px)
- **spacing-7**: 2.5rem (40px)
- **spacing-8**: 3rem (48px)

## Component Style Guide

### Buttons

#### Base Button
- Height: 40px (2.5rem)
- Padding: 0.5rem 1rem (8px 16px)
- Border radius: 4px
- Font size: 0.875rem (14px)
- Font weight: 500 (Medium)
- Transition: 0.2s ease-in-out for all hover/active states

#### Button Variants
1. **Primary Button**
   - Background: Kente Gold (#E8B22A)
   - Text color: Ebony (#231F20)
   - Hover state: Slightly darker gold (#D6A325)
   - Active state: Even darker (#C49320)

2. **Secondary Button**
   - Background: Indigo Blue (#30427A)
   - Text color: White (#FFFFFF)
   - Hover state: Slightly darker blue (#293A6D)
   - Active state: Even darker (#232F58)

3. **Outline Button**
   - Border: 1px solid current color
   - Text color: Inherit/current color
   - Background: Transparent
   - Hover state: Light background (10% opacity of text color)

4. **Text Button**
   - No background or border
   - Text color: Indigo Blue (#30427A) or Kente Gold (#E8B22A)
   - Hover state: Text decoration or slight opacity change

5. **Destructive Button**
   - Background: Spice Red (#C92D2D)
   - Text color: White (#FFFFFF)
   - Hover state: Darker red (#B22828)

#### Button Sizes
- **Small**: Height 32px, Font size 12px, Padding 4px 12px
- **Default**: Height 40px, Font size 14px, Padding 8px 16px
- **Large**: Height 48px, Font size 16px, Padding 12px 24px

#### Button with Icon
- Icon size: 16px for default, 14px for small, 20px for large
- Spacing between icon and text: 8px

### Cards

#### Base Card
- Background: White (#FFFFFF)
- Border radius: 8px
- Box shadow: 0 2px 8px rgba(0, 0, 0, 0.1)
- Padding: 1.5rem (24px)
- Border: None or 1px solid Neutral 300 (#E0E0E0)

#### Card Variations
1. **Standard Card**
   - Basic container with default styling

2. **Bordered Card**
   - No shadow
   - Border: 1px solid Neutral 300 (#E0E0E0)

3. **Elevated Card**
   - Larger shadow (0 4px 12px rgba(0, 0, 0, 0.12))
   - For cards that need to stand out

4. **Accent Card**
   - Left border: 4px solid Kente Gold (#E8B22A) or other accent color
   - For highlighting important information

#### Card Elements
- **Card Header**
  - Bottom border: 1px solid Neutral 300 (#E0E0E0)
  - Padding: 1rem 1.5rem (16px 24px)
  - Font weight: 600 (Semibold)

- **Card Body**
  - Padding: 1.5rem (24px)

- **Card Footer**
  - Top border: 1px solid Neutral 300 (#E0E0E0)
  - Padding: 1rem 1.5rem (16px 24px)
  - Background: Neutral 200 (#F4F4F4)

#### Interactive Cards
- Hover state: Slight elevation increase (shadow: 0 4px 12px rgba(0, 0, 0, 0.15))
- Cursor: pointer
- Transition: box-shadow 0.2s ease-in-out

## Implementation Plan

1. **Phase 1: Foundation**
   - Set up directory structure
   - Create variables and mixins
   - Implement reset and typography styles
   - Create utility classes

2. **Phase 2: Core Components**
   - Implement button styles
   - Implement card styles
   - Create form element styles
   - Build table styles

3. **Phase 3: Complex Components**
   - Modal and dialog styles
   - Navigation components
   - Custom UI elements

4. **Phase 4: Refinement**
   - Ensure consistency across all components
   - Optimize file sizes
   - Implement responsive design adjustments
   - Create documentation with examples

## Best Practices

1. **File Size Management**
   - Keep each SCSS file under 220 lines
   - Use mixins to avoid code duplication
   - Split complex components into multiple files if needed

2. **Selector Nesting**
   - Limit nesting to 3 levels deep maximum
   - Use BEM methodology for naming (Block__Element--Modifier)

3. **Performance**
   - Avoid expensive selectors (deep nesting)
   - Use shorthand properties where appropriate
   - Minimize the use of @extend

4. **Maintainability**
   - Document all variables, mixins, and functions
   - Group related properties together
   - Use consistent formatting and ordering of properties

## Next Steps

After approval of this plan:
1. Create the directory structure
2. Implement the variables and basic mixins
3. Start with button and card components
4. Schedule regular reviews to ensure consistent implementation
