import React from 'react';
import { usePerformanceTracking } from '@/utils/performance';
import { usePWA } from '@/hooks/usePWA';
import { useDecoupledNotifications } from '@/hooks/useDecoupledNotifications';
import { useQuickHelp } from '@/hooks/useQuickHelp';
import { getDeviceId } from '@/integrations/supabase/edge';

// Import modular components
import DashboardHeader from './DashboardHeader';
import CurrentRunnerCard from './CurrentRunnerCard';
import NextRunnerCard from './NextRunnerCard';
import VanToggle from './VanToggle';
import LegScheduleSection from './LegScheduleSection';
import DashboardFooter from './DashboardFooter';

// Import existing components
import MajorExchanges from '@/components/MajorExchanges';
import TimePicker from '@/components/TimePicker';
import RunnerAssignmentModal from '@/components/RunnerAssignmentModal';
import QuickHelpPopup from '@/components/QuickHelpPopup';
import DashboardPrompts from '@/components/DashboardPrompts';
import AboutMeModal from '@/components/AboutMeModal';
import TeamSettings from '@/components/TeamSettings';

// Import UI components
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Import custom hook
import { useDashboard } from '@/hooks/useDashboard';

interface DashboardProps {
  isViewOnly?: boolean;
  viewOnlyTeamName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ isViewOnly = false, viewOnlyTeamName }) => {
  usePerformanceTracking('Dashboard');
  
  // Custom hooks
  const dashboard = useDashboard(isViewOnly, viewOnlyTeamName);
  const { canInstall, install } = usePWA();
  const { 
    isSupported: notificationsSupported, 
    getPermission: notificationPermission, 
    notificationManager,
    isNotificationPreferenceEnabled,
    clearNotificationPreference,
    setNotificationPreference,
    getPendingNotificationsCount,
    getNotificationState
  } = useDecoupledNotifications();
  const { showQuickHelp, hideQuickHelp, isQuickHelpVisible } = useQuickHelp();

  // Extract values from dashboard hook
  const {
    // State
    currentTime,
    timePickerOpen,
    runnerEditModalOpen,
    selectedRunner,
    initialLegId,
    timePickerConfig,
    viewMode,
    settingsModalOpen,
    aboutMeModalOpen,
    isStartingRunner,
    
    // Data
    runners,
    legs,
    currentVan,
    team,
    teamId,
    actualRaceStartTime,
    currentRunner,
    nextRunner,
    currentRunnerInfo,
    nextRunnerInfo,
    
    // Loading states
    isDataLoading,
    isCurrentRunnerLoading,
    isNextRunnerLoading,
    
    // Permissions
    canEdit,
    isViewOnly: dashboardIsViewOnly,
    viewOnlyTeamName: dashboardViewOnlyTeamName,
    
    // Utility functions
    getCountdownToNext,
    getNextRunnerPrefix,
    getRemainingDistance,
    isRaceComplete,
    getFinalRaceTime,
    getEffectiveStartTime,
    
    // Event handlers
    handleStartRunner,
    handleFinishRace,
    handleCelebrate,
    handleVanChange,
    handleRunnerClick,
    handleRunnerAssignSave,
    handleTimeSubmit,
    checkForMissingTimes,
    checkSingleRunnerRule,
    
    // Setters
    setTimePickerOpen,
    setRunnerEditModalOpen,
    setSelectedRunner,
    setInitialLegId,
    setTimePickerConfig,
    setViewMode,
    setSettingsModalOpen,
    setAboutMeModalOpen,
    
    // External functions
    manualRetry,
    refreshTeamData
  } = dashboard;

  return (
    <>
      <div className="relative min-h-screen bg-background pb-4 overflow-hidden">
        {/* Site-wide pulsing gradient background */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-blue-600/5 to-purple-700/10 animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute -top-24 -left-24 h-72 w-72 bg-indigo-600/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 container mx-auto px-2 sm:px-3 lg:px-4 lg:pb-4 space-y-4 lg:space-y-5">
          {/* Header */}
          <DashboardHeader
            isViewOnly={isViewOnly}
            viewOnlyTeamName={viewOnlyTeamName}
            team={team}
            actualRaceStartTime={actualRaceStartTime}
            currentTime={currentTime}
            isRaceComplete={isRaceComplete}
            getFinalRaceTime={getFinalRaceTime}
            onCheckMissingTimes={checkForMissingTimes}
            onCheckSingleRunnerRule={checkSingleRunnerRule}
            canEdit={canEdit}
          />

          {/* Current Status Cards */}
          <div className={`grid gap-3 md:gap-6 ${
            isRaceComplete() 
              ? 'grid-cols-1 lg:grid-cols-1 lg:max-w-2xl lg:mx-auto' 
              : 'grid-cols-1 lg:grid-cols-2'
          }`}>
            {/* Current Runner Card - Hide when race is complete */}
            {!isRaceComplete() && (
              <CurrentRunnerCard
                currentRunner={currentRunner}
                currentRunnerInfo={currentRunnerInfo}
                currentTime={currentTime}
                isCurrentRunnerLoading={isCurrentRunnerLoading}
                getRemainingDistance={getRemainingDistance}
              />
            )}

            {/* Next Runner Card */}
            <NextRunnerCard
              nextRunner={nextRunner}
              nextRunnerInfo={nextRunnerInfo}
              currentTime={currentTime}
              actualRaceStartTime={actualRaceStartTime}
              legs={legs}
              isNextRunnerLoading={isNextRunnerLoading}
              isDataLoading={isDataLoading}
              isRaceComplete={isRaceComplete}
              canEdit={canEdit}
              isStartingRunner={isStartingRunner}
              onStartRunner={handleStartRunner}
              onFinishRace={handleFinishRace}
              onCelebrate={handleCelebrate}
              getCountdownToNext={getCountdownToNext}
              getNextRunnerPrefix={getNextRunnerPrefix}
              getEffectiveStartTime={getEffectiveStartTime}
              teamId={teamId}
            />
          </div>

          {/* Major Exchanges */}
          <div className="w-full">
            <MajorExchanges />
          </div>

          {/* Van Toggle */}
          <VanToggle
            currentVan={currentVan}
            onVanChange={handleVanChange}
          />

          {/* Leg Schedule Section */}
          <LegScheduleSection
            currentVan={currentVan}
            legs={legs}
            runners={runners}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isViewOnly={isViewOnly}
            canEdit={canEdit}
            onRunnerClick={handleRunnerClick}
          />
        </div>

        {/* Footer */}
        <DashboardFooter
          canEdit={canEdit}
          isViewOnly={isViewOnly}
          team={team}
          teamId={teamId}
          canInstall={canInstall}
          install={install}
          notificationsSupported={notificationsSupported}
          notificationPermission={notificationPermission}
          isNotificationPreferenceEnabled={isNotificationPreferenceEnabled}
          clearNotificationPreference={clearNotificationPreference}
          setNotificationPreference={setNotificationPreference}
          notificationManager={notificationManager}
          getPendingNotificationsCount={getPendingNotificationsCount}
          getNotificationState={getNotificationState}
          onSettingsClick={() => setSettingsModalOpen(true)}
          onAboutMeClick={() => setAboutMeModalOpen(true)}
          manualRetry={manualRetry}
          isDevelopment={process.env.NODE_ENV === 'development'}
        />
      </div>

      {/* Modals */}
      
      {/* Time Picker Modal */}
      {timePickerConfig && (
        <TimePicker
          isOpen={timePickerOpen}
          onClose={() => {
            setTimePickerOpen(false);
            setTimePickerConfig(null);
          }}
          onTimeSelect={handleTimeSubmit}
          title={timePickerConfig.title}
          runnerName={timePickerConfig.runnerName}
          initialTime={Date.now()}
        />
      )}

      {/* Runner Assignment Modal */}
      <RunnerAssignmentModal
        isOpen={runnerEditModalOpen}
        onClose={() => {
          setRunnerEditModalOpen(false);
          setSelectedRunner(null);
          setInitialLegId(null);
        }}
        runner={selectedRunner ? runners.find(r => r.id === selectedRunner) || null : null}
        initialLegId={initialLegId ?? undefined}
        onSave={handleRunnerAssignSave}
      />

      {/* Team Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <div className="space-y-6">
            <TeamSettings onClose={() => setSettingsModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Help Popup */}
      <QuickHelpPopup 
        isOpen={showQuickHelp && !isViewOnly} 
        onClose={hideQuickHelp} 
      />

      {/* Dashboard Prompts */}
      <DashboardPrompts />

      {/* About Me Modal */}
      <AboutMeModal 
        isOpen={aboutMeModalOpen} 
        onClose={() => setAboutMeModalOpen(false)}
        teamId={team?.id}
        deviceId={getDeviceId()}
        teamName={team?.name}
        displayName={team?.deviceInfo?.displayName}
      />
    </>
  );
};

export default Dashboard;
