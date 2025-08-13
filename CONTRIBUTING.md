# Contributing to RelayTracker

Thank you for your interest in contributing to RelayTracker! This document provides guidelines for development and contributions.

## Development Setup

1. **Prerequisites**
   - Node.js (version 18 or higher)
   - npm or yarn package manager

2. **Installation**
   ```bash
   git clone <repository-url>
   cd RelayTracker
   npm install
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8080`

## Project Structure

```
RelayTracker/
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── Dashboard.tsx  # Main race dashboard
│   │   ├── SetupWizard.tsx # Initial race setup
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── pages/             # Page components
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── integrations/      # External service integrations
├── public/                # Static assets
├── docs/                  # Documentation
└── ...
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Define proper interfaces and types in `src/types/`
- Use JSDoc comments for functions and complex types
- Enable strict type checking

### React Components
- Use functional components with hooks
- Follow the single responsibility principle
- Use descriptive component and prop names
- Extract complex logic into custom hooks

### State Management
- Use Zustand for global state
- Keep state as normalized as possible
- Use proper TypeScript types for store interfaces

### Styling
- Use Tailwind CSS for styling
- Follow the existing design system
- Use shadcn/ui components when available
- Ensure mobile responsiveness

### Code Organization
- Group related functionality together
- Use barrel exports for cleaner imports
- Keep components focused and small
- Extract reusable logic into utilities

## Key Features to Understand

### 1. Race Setup Wizard
- Three-step process: start time, team configuration, leg distances
- Supports CSV/Excel import for runner data
- Validates all input data

### 2. Race Dashboard
- Real-time race tracking with current/next runner display
- Live countdown timers and progress indicators
- Van-specific views (Van 1 vs Van 2)
- Major exchange point tracking

### 3. Time Management
- All times stored as Unix timestamps
- Supports both projected and actual times
- Automatic recalculation of projections when actual times are recorded

### 4. Data Import
- Supports Excel (.xlsx, .xls) and CSV files
- Smart column mapping with auto-detection
- Comprehensive error handling and validation

## Testing Guidelines

- Write tests for utility functions in `src/utils/`
- Test complex components with user interactions
- Ensure mobile responsiveness across screen sizes
- Test with sample data provided in `sample_runners.csv`

## Performance Considerations

- The application updates every second for live tracking
- State updates trigger recalculations efficiently
- Large datasets (36+ legs) are handled with proper virtualization
- Offline functionality maintains performance during poor connectivity

## Accessibility

- Use semantic HTML elements
- Ensure keyboard navigation works properly
- Provide appropriate ARIA labels
- Test with screen readers
- Maintain adequate color contrast

## Mobile Optimization

- Touch targets should be at least 44px × 44px
- Optimize for devices as small as iPhone SE (375px width)
- Test gesture interactions
- Ensure readable text without zooming

## Common Development Tasks

### Adding a New Component
1. Create the component in the appropriate directory
2. Add proper TypeScript types
3. Include JSDoc documentation
4. Export from appropriate barrel file
5. Add to the design system if it's reusable

### Modifying Race Logic
1. Update utility functions in `src/utils/raceUtils.ts`
2. Add comprehensive tests
3. Update type definitions if needed
4. Test with various race scenarios

### Styling Changes
1. Use existing Tailwind classes when possible
2. Follow the established color scheme
3. Test on multiple screen sizes
4. Ensure consistency with shadcn/ui components

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes following the coding standards
3. Add or update tests as necessary
4. Update documentation if needed
5. Ensure all tests pass and code builds successfully
6. Submit a pull request with a clear description

## Bug Reports

When reporting bugs, please include:
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and device information
- Screenshots if applicable
- Sample data that triggers the bug

## Questions?

If you have questions about the codebase or need clarification on any aspect of development, please open an issue for discussion.

Thank you for contributing to making RelayTracker better for relay race teams everywhere!
