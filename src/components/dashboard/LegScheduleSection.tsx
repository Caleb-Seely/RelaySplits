import React from 'react';
import { Users, CheckCircle, Activity, Grid3X3, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import LegScheduleTable from '@/components/LegScheduleTable';

interface LegScheduleSectionProps {
  currentVan: number;
  legs: any[];
  runners: any[];
  viewMode: 'cards' | 'table';
  onViewModeChange: (mode: 'cards' | 'table') => void;
  isViewOnly: boolean;
  canEdit: boolean;
  onRunnerClick?: (runnerId: number, legId: number) => void;
}

const LegScheduleSection: React.FC<LegScheduleSectionProps> = ({
  currentVan,
  legs,
  runners,
  viewMode,
  onViewModeChange,
  isViewOnly,
  canEdit,
  onRunnerClick
}) => {
  const vanLegs = legs.filter(leg => {
    const runner = runners.find(r => r.id === leg.runnerId);
    return runner && runner.van === currentVan;
  });

  const completedLegs = vanLegs.filter(leg => leg.actualFinish).length;
  const runningLegs = vanLegs.filter(leg => leg.actualStart && !leg.actualFinish).length;
  const totalLegs = vanLegs.length;

  return (
    <Card className="shadow-lg border-0 overflow-hidden bg-card">
      <CardHeader className="relative overflow-hidden bg-muted/70 text-foreground border-b border-border py-2 sm:py-3 md:py-4">
        <div className="absolute inset-0 bg-blue-500/20" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-3">
            <CardTitle className="text-lg font-bold flex items-center gap-3">
              <div className="p-2 bg-muted-foreground/10 backdrop-blur-sm rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Van {currentVan} Schedule & Progress</h2>
                <p className="text-sm text-muted-foreground font-normal">Race Schedule</p>
              </div>
            </CardTitle>
            
            {/* Stats */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                {completedLegs} done
              </div>
              {runningLegs > 0 && (
                <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  {runningLegs} running
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
                {totalLegs} total
              </div>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-muted/60 backdrop-blur-sm rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('cards')}
              className={`px-3 text-xs h-8 transition-all duration-200 ${
                viewMode === 'cards'
                  ? 'bg-primary text-primary-foreground shadow-md font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <Grid3X3 className="h-3 w-3 mr-1.5" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'table' ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className={`px-3 text-xs h-8 transition-all duration-200 ${
                viewMode === 'table'
                  ? 'bg-primary text-primary-foreground shadow-md font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              <List className="h-3 w-3 mr-1.5" />
              Table
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <LegScheduleTable 
          viewMode={viewMode}
          isViewOnly={isViewOnly}
          onRunnerClick={onRunnerClick}
        />
      </CardContent>
    </Card>
  );
};

export default LegScheduleSection;
