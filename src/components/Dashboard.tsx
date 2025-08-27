import React from 'react';
import ModularDashboard from './dashboard/Dashboard';
import { usePerformanceTracking } from '@/utils/performance';

interface DashboardProps {
  isViewOnly?: boolean;
  viewOnlyTeamName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ isViewOnly = false, viewOnlyTeamName }) => {
  usePerformanceTracking('Dashboard');
  
  return <ModularDashboard isViewOnly={isViewOnly} viewOnlyTeamName={viewOnlyTeamName} />;
};

export default Dashboard;
