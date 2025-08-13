# RelayTracker

**Professional Relay Race Management Application**

RelayTracker is a comprehensive web application designed to help relay race teams manage, track, and coordinate their races in real-time. Originally designed for the Hood to Coast relay race, it supports any relay race format with customizable legs and team configurations.

![RelayTracker Screenshot](public/placeholder.svg)

## 🏃‍♀️ Features

### 📋 Race Setup & Configuration
- **3-Step Setup Wizard**: Intuitive guided setup for race start time, team configuration, and leg distances
- **Team Management**: Configure up to 12 runners across 2 vans with individual pace settings
- **Flexible Race Format**: Support for 36-leg races (default Hood to Coast) or custom configurations
- **Data Import**: Import runner information from Excel (.xlsx, .xls) or CSV files with smart column mapping
- **Pace Management**: Support for MM:SS pace format with automatic validation

### 🏁 Live Race Tracking
- **Real-Time Dashboard**: Live updates showing current runner, next runner, and race progress
- **Race Timer**: Continuous race timer from start to finish with elapsed time display
- **Progress Tracking**: Visual progress bar showing completion percentage and distance traveled
- **Van Coordination**: Separate views for Van 1 and Van 2 with van-specific runner schedules
- **Status Indicators**: Color-coded status for each leg (Ready, Running, Finished, Next Up)

### ⏱️ Time Management
- **Projected vs Actual Times**: Track both projected finish times and actual performance
- **Dynamic Recalculation**: Automatic adjustment of future leg projections based on actual performance
- **Countdown Timers**: Live countdown to next runner start times
- **Major Exchanges**: Special tracking for major van exchange points (legs 6, 12, 18, 24, 30, 36)
- **Manual Time Entry**: Record exact start and finish times with intuitive time picker

### 📊 Race Analytics
- **Distance Tracking**: Real-time calculation of total distance traveled
- **Pace Analysis**: Compare projected vs actual paces for each runner
- **Running Time**: Track individual leg running times and overall race duration
- **Progress Visualization**: Detailed leg schedule table with editing capabilities

### 📱 Mobile-First Design
- **Responsive Layout**: Optimized for all screen sizes from mobile phones to desktops
- **Touch-Friendly Interface**: Large touch targets and intuitive gesture support
- **Real-Time Updates**: Second-by-second updates for live race conditions
- **Professional UI**: Modern, clean interface built with shadcn/ui components

## 🚀 Getting Started

### Prerequisites
- Node.js (version 18 or higher)
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd RelayTracker

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:8080`

### Quick Start Guide

1. **Setup Your Race**
   - Launch the application and follow the 3-step setup wizard
   - Set your race start time and date
   - Configure your 12 runners with names, paces, and van assignments
   - Customize leg distances (defaults to Hood to Coast distances)

2. **Import Team Data** (Optional)
   - Use the "Import from Spreadsheet" feature in step 2
   - Upload Excel or CSV files with runner information
   - Map columns to runner name, pace, and van assignment
   - Preview and validate data before import

3. **Start Race Tracking**
   - Complete setup to access the live dashboard
   - Monitor current and next runners in real-time
   - Record actual start and finish times as they occur
   - Switch between Van 1 and Van 2 views as needed

4. **Track Progress**
   - View detailed leg schedule with editing capabilities
   - Monitor major exchange points and arrival times
   - Edit runner information and leg distances if needed
   - Export race data for post-race analysis

## 🏗️ Technical Architecture

### Built With
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Full type safety and enhanced developer experience
- **Vite** - Fast build tool and development server
- **Zustand** - Lightweight state management solution
- **Tailwind CSS** - Utility-first CSS framework for responsive design
- **shadcn/ui** - Beautiful, accessible UI components
- **date-fns** - Comprehensive date manipulation library
- **Lucide React** - Beautiful SVG icon library

### Key Libraries
- **XLSX** - Excel file parsing and processing
- **PapaParse** - CSV file parsing with robust error handling
- **React Hook Form** - Performant form handling with validation
- **Zod** - Schema validation for data integrity

### Project Structure
```
RelayTracker/
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui design system components
│   │   ├── Dashboard.tsx # Main race tracking interface
│   │   ├── SetupWizard.tsx # Race configuration wizard
│   │   ├── SpreadsheetImport.tsx # Data import functionality
│   │   └── ...
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions and race logic
│   ├── hooks/            # Custom React hooks
│   └── pages/            # Page components
├── public/               # Static assets
└── sample_runners.csv    # Sample data for testing
```

## 🎯 Use Cases

### Hood to Coast Relay
- Pre-configured with official 36-leg Hood to Coast distances
- Support for 12-runner teams with 2-van coordination
- Real-time tracking throughout the 200+ mile course

### Custom Relay Races
- Configurable number of legs and distances
- Flexible team sizes and van assignments
- Adaptable to various relay race formats

### Team Coordination
- Van-specific views for better coordination
- Major exchange point tracking
- Real-time updates for all team members

### Race Analysis
- Performance tracking and pace analysis
- Historical data preservation
- Post-race reporting and insights

## 📖 Documentation

For detailed development information, see:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines and setup
- [Warp-Project-Improvements.md](Warp-Project-Improvements.md) - Planned enhancements and roadmap

## 🧪 Sample Data

The repository includes `sample_runners.csv` with example runner data for testing:
- 12 sample runners with realistic names and paces
- Proper van assignments (6 runners per van)
- Various pace ranges from 6:30 to 7:30 per mile

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:
- Development setup and workflow
- Coding standards and best practices
- Testing requirements
- Pull request process

## 📄 License

This project is built with modern web technologies and is designed to be maintainable, scalable, and user-friendly for relay race teams of all sizes.

---

**Ready to track your next relay race?** Get started with RelayTracker today!

