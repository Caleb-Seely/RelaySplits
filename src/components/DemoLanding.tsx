import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  getCurrentRunner, 
  getNextRunner, 
  formatTime, 
  formatDuration, 
  formatPace,
  calculateCurrentDistance,
  getLegStatus,
  getCountdownTime,
  formatCountdown,
  calculateTotalDistanceTraveled,
  getMajorExchangeTimes,
  getEffectiveStartTime,
  getRunTime,
  calculateActualPace
} from '@/utils/raceUtils';
import { 
  Play, 
  Clock, 
  Users, 
  MapPin, 
  Target, 
  Timer, 
  Activity,
  Eye,
  Plus,
  Zap,
  CheckCircle,
  Grid3X3,
  List,
  Trophy,
  ArrowRight,
  Download,
  Smartphone,
  Info,
  X
} from 'lucide-react';
import { getDemoRunners, getDemoStartTime, initializeDemoLegs, demoTeam, updateDemoLeg } from '@/utils/demoData';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useTeam } from '@/contexts/TeamContext';
import { usePWA } from '@/hooks/usePWA';
import { toast } from 'sonner';
import { useRaceStore } from '@/store/raceStore';
import AdminSecretDisplay from './AdminSecretDisplay';




const DemoLanding = () => {
  const navigate = useNavigate();
  const { createTeam, joinTeam, loading, refetch } = useTeamSync();
  const { setDeviceInfo } = useTeam();
  const { canInstall, isInstalling, install } = usePWA();
  
  // Demo state
  const [demoLegs, setDemoLegs] = useState(initializeDemoLegs(getDemoStartTime()));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('view');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [currentVan, setCurrentVan] = useState<1 | 2>(1);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // Auth form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [viewerCode, setViewerCode] = useState('');
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [createdTeamName, setCreatedTeamName] = useState('');
  const [showLearnMore, setShowLearnMore] = useState(false);


  // Update current time every second for live demo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect browser and device for better installation guidance
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    if (userAgent.includes('Chrome')) return { browser: 'Chrome', isMobile, isIOS, isAndroid };
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return { browser: 'Safari', isMobile, isIOS, isAndroid };
    if (userAgent.includes('Firefox')) return { browser: 'Firefox', isMobile, isIOS, isAndroid };
    if (userAgent.includes('Edge')) return { browser: 'Edge', isMobile, isIOS, isAndroid };
    return { browser: 'Unknown', isMobile, isIOS, isAndroid };
  };

  // Handle PWA installation
  const handleInstallApp = async () => {
    if (!canInstall) {
      const { browser, isMobile, isIOS, isAndroid } = getBrowserInfo();
      
      if (isMobile) {
        if (isIOS) {
          toast.info('On iOS Safari: Tap the Share button (square with arrow) and select "Add to Home Screen"');
        } else if (isAndroid) {
          if (browser === 'Chrome') {
            toast.info('On Android Chrome: Tap the menu (⋮) and select "Add to Home Screen" or look for the install icon in the address bar');
          } else {
            toast.info('On Android: Tap the menu and look for "Add to Home Screen" or "Install App"');
          }
        } else {
          toast.info('Tap your browser menu and look for "Add to Home Screen" or "Install App"');
        }
      } else {
        if (browser === 'Chrome') {
          toast.info('In Chrome: Look for the install icon (📱) in the address bar on the right side');
        } else if (browser === 'Edge') {
          toast.info('In Edge: Look for the install icon (📱) in the address bar on the right side');
        } else if (browser === 'Firefox') {
          toast.info('In Firefox: Look for the install icon in the address bar or menu');
        } else {
          toast.info('Look for an install icon in your browser address bar or menu');
        }
      }
      return;
    }

    try {
      const success = await install();
      if (success) {
        toast.success('App installed successfully! You can now access it from your home screen.');
      } else {
        toast.error('Installation was cancelled or failed.');
      }
    } catch (error) {
      console.error('Installation error:', error);
      toast.error('Failed to install app. Please try again.');
    }
  };


  // Handle click outside to close form
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFormVisible && !showAdminSecret) {
        const target = event.target as Element;
        
        // Check if click is inside the form card content
        const cardContent = target.closest('.form-card');
        
        // Check if click is inside the tab buttons (to prevent closing when clicking tabs)
        const tabButtons = target.closest('button[data-tab]');
        
        // Check if click is inside the admin secret dialog
        const adminDialog = target.closest('[data-admin-dialog]');
        
        // If click is outside the card content and not on tab buttons or admin dialog, close the form
        if (!cardContent && !tabButtons && !adminDialog) {
          setIsFormVisible(false);
        }
      }
    };

    // Use both mousedown and click events for better coverage
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isFormVisible, showAdminSecret]);

  // Demo functions
  const handleDemoStartRunner = () => {
    const currentRunner = getCurrentRunner(demoLegs, currentTime);
    const nextRunner = getNextRunner(demoLegs, currentTime);
    
    let updatedLegs = [...demoLegs];
    
    if (currentRunner && currentRunner.actualStart && !currentRunner.actualFinish) {
      // Finish current runner
      updatedLegs = updateDemoLeg(updatedLegs, currentRunner.id, 'actualFinish', currentTime.getTime());
    }
    
    if (nextRunner) {
      // Start next runner
      updatedLegs = updateDemoLeg(updatedLegs, nextRunner.id, 'actualStart', currentTime.getTime());
    }
    
    setDemoLegs(updatedLegs);
  };

  // Auth handlers
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !teamName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    // Team creation logging reduced for cleaner console
    
    const result = await createTeam(
      teamName.trim(),
      firstName.trim(),
      lastName.trim()
    );

    if (result.success) {
      // Team creation successful - showing admin secret dialog
      // Show admin secret dialog
      setAdminSecret(result.adminSecret);
      setCreatedTeamName(teamName.trim());
      setShowAdminSecret(true);
      // Close the form so the dialog can show properly
      setIsFormVisible(false);
    } else {
      console.error('[DemoLanding] Team creation failed:', result.error);
      toast.error(result.error || 'Failed to create team');
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !inviteToken.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const result = await joinTeam(
      inviteToken.trim(),
      firstName.trim(),
      lastName.trim()
    );

    if (result.success) {
      toast.success('Joined team successfully!');
      // After joining, go straight to Dashboard (no setup needed for existing teams)
      navigate('/');
    } else {
      toast.error(result.error || 'Failed to join team');
    }
  };

  const handleViewTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!viewerCode.trim()) {
      toast.error('Please enter a viewer code');
      return;
    }

    // Navigate to view-only dashboard
    navigate(`/view/${viewerCode.trim()}`);
  };



  // Demo calculations - memoized to prevent unnecessary recalculations
  const { currentRunner, nextRunner, currentRunnerInfo, nextRunnerInfo } = useMemo(() => {
    const currentRunner = getCurrentRunner(demoLegs, currentTime);
    const nextRunner = getNextRunner(demoLegs, currentTime);
    const currentRunnerInfo = currentRunner ? getDemoRunners().find(r => r.id === currentRunner.runnerId) : null;
    const nextRunnerInfo = nextRunner ? getDemoRunners().find(r => r.id === nextRunner.runnerId) : null;
    
    return { currentRunner, nextRunner, currentRunnerInfo, nextRunnerInfo };
  }, [demoLegs, currentTime]);
  
  // Memoize other expensive calculations
  const { progress, demoStartTime, majorExchanges, filteredLegs } = useMemo(() => {
    const totalLegs = demoLegs.length;
    const completedLegs = demoLegs.filter(leg => leg.actualFinish).length;
    const currentLegId = currentRunner ? currentRunner.id : completedLegs;
    
    const progress = {
      completed: completedLegs,
      total: totalLegs,
      current: currentLegId,
      percentage: totalLegs > 0 ? (completedLegs / totalLegs) * 100 : 0
    };
    
    const demoStartTime = getDemoStartTime();
    const majorExchanges = getMajorExchangeTimes(demoLegs);
    
    // Filter legs by current van
    const vanRunners = getDemoRunners().filter(r => r.van === currentVan);
    const vanRunnerIds = new Set(vanRunners.map(r => r.id));
    const filteredLegs = demoLegs.filter(leg => vanRunnerIds.has(leg.runnerId));
    
    return { progress, demoStartTime, majorExchanges, filteredLegs };
  }, [demoLegs, currentVan, currentRunner]);

  // Helper functions
  function getCountdownToNext() {
    if (!nextRunner) return null;
    const countdownMs = getCountdownTime(nextRunner, currentTime, demoLegs, demoStartTime);
    return formatCountdown(countdownMs);
  }

  function getNextRunnerPrefix() {
    if (!nextRunner || !demoLegs.length) return "Starts in:";
    
    const nextLegIndex = demoLegs.findIndex(leg => leg.id === nextRunner.id);
    if (nextLegIndex <= 0) return "Starts in:";
    
    const prevLeg = demoLegs[nextLegIndex - 1];
    
    if (prevLeg.actualFinish) {
      return "Starts in:";
    } else {
      return "Expected:";
    }
  }

  const getRemainingDistance = () => {
    if (!currentRunner || !currentRunnerInfo) return 0;
    return calculateCurrentDistance(currentRunner, currentRunnerInfo, currentTime.getTime());
  };

  const getStatusBadge = (leg: any) => {
    const status = getLegStatus(leg, currentTime);
    const statusConfig = {
      ready: { 
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Clock,
        label: '',
        dot: 'bg-blue-500'
      },
      running: { 
        className: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: Play,
        label: 'Running',
        dot: 'bg-orange-500 animate-pulse'
      },
      finished: { 
        className: 'bg-green-50 text-green-700 border-green-200',
        icon: CheckCircle,
        label: 'Finished',
        dot: 'bg-green-500'
      },
      'next-up': { 
        className: 'bg-slate-50 text-slate-700 border-slate-200',
        icon: Timer,
        label: 'Next Up',
        dot: 'bg-slate-400'
      }
    };
  
    const config = statusConfig[status];
    const Icon = config.icon;
    
    let label = config.label;
    if (status === 'ready') {
      const countdownMs = getCountdownTime(leg, currentTime, demoLegs, demoStartTime);
      label = countdownMs > 0 ? formatCountdown(countdownMs) : 'Ready';
    }
  
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
        <Badge className={`${config.className} border text-xs font-medium px-2 py-1`}>
          <Icon className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      </div>
    );
  };

  const exchangeNames = {
    6: 'Van Switch 1',
    12: 'Van Switch 2', 
    18: 'Van Switch 3',
    24: 'Van Switch 4',
    30: 'Van Switch 5',
    36: 'FINISH'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Secret Display Dialog */}
      {showAdminSecret && (
        <div data-admin-dialog>
          <AdminSecretDisplay
            adminSecret={adminSecret}
            teamName={createdTeamName}
            onClose={() => {
              setShowAdminSecret(false);
              
              // Clear the form state
              setFirstName('');
              setLastName('');
              setTeamName('');
              setAdminSecret('');
              setCreatedTeamName('');
              
              // Now set the team context since the admin secret dialog is closed
              const teamId = localStorage.getItem('relay_team_id');
              const teamName = localStorage.getItem('relay_team_name');
              const teamStartTime = localStorage.getItem('relay_team_start_time');
              const joinCode = localStorage.getItem('relay_team_join_code');
              const deviceInfoStr = localStorage.getItem('relay_device_info');
              
              if (teamId && teamName && teamStartTime && joinCode && deviceInfoStr) {
                const deviceInfo = JSON.parse(deviceInfoStr);
                
                // Update the device info in the team context
                setDeviceInfo(deviceInfo);
              } else {
                console.warn('[DemoLanding] Missing required localStorage data for team setup');
              }
              
              // The relay_is_new_team flag is already set by createTeam()
              // Navigate to the main app - let Index.tsx handle the team setup
              navigate('/');
            }}
          />
        </div>
      )}

      {/* Learn More Popup */}
      {showLearnMore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">What is TeamSplits?</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLearnMore(false)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-6">
              <p className="text-gray-700 leading-relaxed">
                TeamSplits is a team tracking app built for relay races like Hood to Coast. It helps your whole team stay in sync—whether you're running, driving, or just following along.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                    <MapPin className="h-3 w-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Get directions to each exchange without stress</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <Timer className="h-3 w-3 text-green-600" />
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Stay on pace with automatic updates and offline accuracy</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mt-0.5">
                    <Trophy className="h-3 w-3 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">See how your team stacks up with live leaderboards</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                    <Users className="h-3 w-3 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Invite your teammates to join with a quick code, or share a view-only link with family and friends</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-gray-700 text-sm leading-relaxed">
                  Everything stays saved on your device so you don't have to keep logging in. Just join once and you're ready for race day.
                </p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-gray-100">
              <Button
                onClick={() => setShowLearnMore(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl"
              >
                Got it!
              </Button>
            </div>
          </div>
        </div>
      )}
      
              {/* Header with Auth Tabs */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black border-b border-gray-700/50 relative header-area">
          <div className="container mx-auto px-4 py-6">
            <div className="text-center mb-6">
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">TeamSplits</h1>
              <p className="text-lg text-gray-300 mb-1">Hood 2 Coast Team Tracking</p>
              <p className="text-lg text-gray-300">Stay in sync, every leg of the race.</p>
          </div>
          
                      {/* Tab Headers - Primary Navigation */}
            <div className="flex justify-center">
              <div className="flex bg-gray-800/50 backdrop-blur-sm p-1 rounded-xl border border-gray-700/50">
                <Button
                  variant="ghost"
                  data-tab="view"
                  onClick={() => {
                    setActiveTab('view');
                    setIsFormVisible(true);
                  }}
                                 className={`flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all duration-200 px-6 py-3 relative ${
                   activeTab === 'view' && isFormVisible
                     ? 'text-blue-400 bg-blue-900/30' 
                     : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700/50'
                 }`}
                               >
                   <Eye className="h-4 w-4" />
                   View

                 </Button>
              <Button
                variant="ghost"
                data-tab="join"
                onClick={() => {
                  setActiveTab('join');
                  setIsFormVisible(true);
                }}
                                 className={`flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all duration-200 px-6 py-3 relative ${
                   activeTab === 'join' && isFormVisible
                     ? 'text-blue-400 bg-blue-900/30' 
                     : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700/50'
                 }`}
                               >
                   <Users className="h-4 w-4" />
                   Join 

                 </Button>
              <Button
                variant="ghost"
                data-tab="create"
                onClick={() => {
                  setActiveTab('create');
                  setIsFormVisible(true);
                }}
                                 className={`flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-all duration-200 px-6 py-3 relative ${
                   activeTab === 'create' && isFormVisible
                     ? 'text-blue-400 bg-blue-900/30' 
                     : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700/50'
                 }`}
                               >
                   <Plus className="h-4 w-4" />
                   Create

                 </Button>
            </div>
          </div>
        </div>

        {/* Auth Form Card - Overlay on top of content */}
        {isFormVisible && (
          <div className="absolute top-full left-0 right-0 z-50 form-card">
            <div className="container mx-auto px-2">
              <div className="flex justify-center">
                <div className="flex bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50">
                                 <Card className="bg-gray-900/90 backdrop-blur-sm rounded-b-2xl border border-gray-700/50 overflow-hidden -mt-1 transition-all duration-500 ease-in-out w-80">
                  <CardContent className="p-4">
                    {activeTab === 'view' && (
                                             <form onSubmit={handleViewTeam} className="space-y-2">
                        <div className="space-y-2">
                          <Input
                            id="viewerCode"
                            value={viewerCode}
                            onChange={(e) => setViewerCode(e.target.value)}
                            placeholder="0 0 0 0 0 0"
                            maxLength={6}
                            className="text-center font-mono text-xl tracking-widest h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                            autoFocus
                          />
                        </div>
                                                                           <Button 
                            type="submit" 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 h-10 rounded-xl text-base border-2 border-blue-600 hover:border-blue-700"
                          >
                            View Team
                          </Button>
                      </form>
                    )}
                    
                    {activeTab === 'join' && (
                      <form onSubmit={handleJoinTeam} className="space-y-2">
                        <div className="space-y-2">
                          <Input
                            id="join-firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Input
                            id="join-lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                          />
                        </div>
                        <div className="space-y-3">
                          <Input
                            id="inviteToken"
                            value={inviteToken}
                            onChange={(e) => setInviteToken(e.target.value)}
                            placeholder="Invite token"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                          />
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 h-10 rounded-xl text-base border-2 border-blue-600 hover:border-blue-700" 
                          disabled={loading}
                        >
                          {loading ? 'Joining...' : 'Join Team'}
                        </Button>
                      </form>
                    )}
                    
                    {activeTab === 'create' && (
                      <form onSubmit={handleCreateTeam} className="space-y-2">
                        <div className="space-y-2">
                          <Input
                            id="create-firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <Input
                            id="create-lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Last name"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Input
                            id="teamName"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder="Team name"
                            className="h-10 rounded-xl transition-all duration-200 placeholder:text-gray-400 text-base bg-gray-800 border border-gray-600 text-gray-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                            required
                          />
                        </div>
                                                                           <Button 
                            type="submit" 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg hover:shadow-xl h-10 rounded-xl text-base border-2 border-blue-600 hover:border-blue-700" 
                            disabled={loading}
                          >
                            {loading ? 'Creating...' : 'Create Team'}
                          </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Learn More and Download Buttons */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => setShowLearnMore(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
            >
              <Info className="h-5 w-5" />
              Learn More
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            {/* Download App Button */}
            <Button
              onClick={canInstall ? handleInstallApp : () => {
                const { browser, isMobile, isIOS, isAndroid } = getBrowserInfo();
                
                if (isMobile) {
                  if (isIOS) {
                    toast.info('On iOS Safari: Tap the Share button (square with arrow) and select "Add to Home Screen"');
                  } else if (isAndroid) {
                    if (browser === 'Chrome') {
                      toast.info('On Android Chrome: Tap the menu (⋮) and select "Add to Home Screen" or look for the install icon in the address bar');
                    } else {
                      toast.info('On Android: Tap the menu and look for "Add to Home Screen" or "Install App"');
                    }
                  } else {
                    toast.info('Tap your browser menu and look for "Add to Home Screen" or "Install App"');
                  }
                } else {
                  if (browser === 'Chrome') {
                    toast.info('In Chrome: Look for the install icon (📱) in the address bar on the right side');
                  } else if (browser === 'Edge') {
                    toast.info('In Edge: Look for the install icon (📱) in the address bar on the right side');
                  } else if (browser === 'Firefox') {
                    toast.info('In Firefox: Look for the install icon in the address bar or menu');
                  } else {
                    toast.info('Look for an install icon in your browser address bar or menu');
                  }
                }
              }}
              disabled={isInstalling}
              className={`font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 ${
                canInstall 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white' 
                  : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
              }`}
            >
              {isInstalling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Installing...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Download App
                </>
              )}
            </Button>
          </div>
          
          {/* Installation Instructions */}
          {!canInstall && !isInstalling && (
            <div className="text-center max-w-md">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Installation Instructions</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  {(() => {
                    const { browser, isMobile, isIOS, isAndroid } = getBrowserInfo();
                    
                    if (isMobile) {
                      if (isIOS) {
                        return 'Tap the Share button (square with arrow) and select "Add to Home Screen"';
                      } else if (isAndroid) {
                        if (browser === 'Chrome') {
                          return 'Tap the menu (⋮) and select "Add to Home Screen" or look for the install icon in the address bar';
                        } else {
                          return 'Tap the menu and look for "Add to Home Screen" or "Install App"';
                        }
                      } else {
                        return 'Tap your browser menu and look for "Add to Home Screen" or "Install App"';
                      }
                    } else {
                      if (browser === 'Chrome') {
                        return 'Look for the install icon (📱) in the address bar on the right side';
                      } else if (browser === 'Edge') {
                        return 'Look for the install icon (📱) in the address bar on the right side';
                      } else if (browser === 'Firefox') {
                        return 'Look for the install icon in the address bar or menu';
                      } else {
                        return 'Look for an install icon in your browser address bar or menu';
                      }
                    }
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Endorsement */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm p-3 text-center">
            <p className="text-gray-700 text-sm font-medium leading-relaxed">
              "RelayTracker keeps your relay team in sync. Track progress, get exchange directions, and see where you stand on the leaderboard—no login hassle."  -Claude
            </p>
          </div>
        </div>
      </div>



      {/* Demo Content */}
      <div className={`container mx-auto px-4 py-8 ${isFormVisible ? 'blur-sm' : ''}`}>

        {/* Progress Bar - Updated to match real dashboard */}
        <div className="max-w-xl mx-auto bg-white rounded-lg p-3 shadow-md border border-gray-200 mb-8">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-700">Progress</span>
            <span className="text-xs font-bold text-blue-600">
              Leg {progress.current}/{progress.total}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {formatDuration(Math.max(0, currentTime.getTime() - demoStartTime))}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500 relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-blue-500"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 items-center mt-2">
            <div className="justify-self-start text-left">
              <div className="text-sm font-bold text-gray-900">
                {formatTime(demoStartTime)}
              </div>
              <div className="flex items-center justify-start gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Start</span>
              </div>
            </div>
            <div className="justify-self-center text-center">

            </div>
            <div className="justify-self-end text-right">
              <div className="text-sm font-bold text-blue-600">
                {calculateTotalDistanceTraveled(demoLegs).toFixed(1)} mi
              </div>
              <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                <MapPin className="h-4 w-4" />
                <span>Distance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Current and Next Runner Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-8">
          {/* Current Runner Card - Updated to match real dashboard */}
          <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
            <div className="absolute inset-0 bg-green-500 h-1"></div>
            <div className="p-2 sm:p-3 md:p-4 bg-green-500/10 rounded-b-none rounded-lg">
              {currentRunner && currentRunnerInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {currentRunnerInfo.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Users className="h-4 w-4" />
                        <span>Van {currentRunnerInfo.van}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge className="bg-green-500 animate-pulse text-white text-sm px-3 py-1 font-semibold mb-2">
                        Leg {currentRunner.id}
                      </Badge>
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Target className="h-4 w-4" />
                        <span>{formatPace(currentRunnerInfo.pace)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">No runner currently active</p>
                  <p className="text-sm text-muted-foreground mt-1">Waiting for next leg to begin</p>
                </div>
              )}
            </div>
            <CardContent className="pt-4">
              {currentRunner && currentRunnerInfo && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {currentRunner.distance} mi
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Distance
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-500 mb-2">
                        {(() => {
                          if (!currentRunner || !currentRunnerInfo) return '--';
                          const startTime = currentRunner.actualStart || currentRunner.projectedStart;
                          return formatDuration(currentTime.getTime() - startTime);
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Timer className="h-4 w-4" />
                        Running Time
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(0, ((currentRunner.distance - getRemainingDistance()) / currentRunner.distance) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                      <span>
                        {formatTime(currentRunner.actualStart || currentRunner.projectedStart)}
                      </span>
                      <span className="text-green-500">
                        ~{getRemainingDistance().toFixed(1)} miles left
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Runner Card - Updated to match real dashboard */}
          <Card className="group relative overflow-hidden border-border shadow-2xl bg-card">
            <div className="absolute inset-0 bg-blue-500 h-1"></div>
            <div className="p-2 sm:p-3 md:p-4 bg-blue-500/10 rounded-b-none rounded-lg">
              {nextRunner && nextRunnerInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">
                        {nextRunnerInfo.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Users className="h-4 w-4" />
                        <span>Van {nextRunnerInfo.van}</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <Badge className="bg-blue-500 text-white text-sm px-3 py-1 font-semibold mb-2">
                        Leg {nextRunner.id}
                      </Badge>
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <Target className="h-4 w-4" />
                        <span>{formatPace(nextRunnerInfo.pace)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-xl font-bold text-green-500 mb-2">Race Completed!</p>
                  <p className="text-sm text-muted-foreground">Congratulations on finishing</p>
                </div>
              )}
            </div>
            <CardContent className="pt-4">
              {nextRunner && nextRunnerInfo && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {nextRunner.distance} mi
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Distance
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">
                        {formatTime(getEffectiveStartTime(nextRunner, demoLegs, demoStartTime))}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                        <Target className="h-4 w-4" />
                        Projected Start
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full h-3 flex items-center">
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
                    </div>
                    <div className="flex justify-between items-baseline text-base font-bold text-foreground">
                      <span className="text-blue-500">
                        {getNextRunnerPrefix()} {getCountdownToNext()}
                      </span>
                      <Button
                        onClick={handleDemoStartRunner}
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Runner
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Major Exchanges */}
        <div className="max-w-6xl mx-auto mb-8">
          <Card className="border-l-4 border-l-orange-400">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-orange-500" />
                Major Exchanges
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {majorExchanges.map(({ legId, projectedFinish, actualFinish }) => (
                  <div 
                    key={legId} 
                    className="text-center p-2 bg-blue-50 rounded border cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <div className="text-xs font-medium text-blue-900 mb-1">
                      {exchangeNames[legId as keyof typeof exchangeNames]}
                    </div>
                    <div className={`relative inline-flex items-center justify-center text-sm font-bold ${actualFinish ? 'text-green-600' : 'text-orange-600'}`}>
                      <span>{formatTime(actualFinish || projectedFinish)}</span>
                      {actualFinish && (
                        <Badge className="absolute left-full ml-2 bg-green-100 text-green-800 border border-green-200 text-[10px] px-1 py-0.5 leading-none">✓</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Van Toggle */}
        <div className="flex justify-center mb-6">
          <Card className="bg-card shadow-lg border-border p-2">
            <div className="relative overflow-hidden bg-muted/70 rounded-lg p-1 border border-border">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-purple-500/15" />
              <div className="relative flex">
                <Button
                  variant={currentVan === 1 ? "default" : "ghost"}
                  size="lg"
                  onClick={() => setCurrentVan(1)}
                  className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                    currentVan === 1
                      ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Van 1
                </Button>
                <Button
                  variant={currentVan === 2 ? "default" : "ghost"}
                  size="lg"
                  onClick={() => setCurrentVan(2)}
                  className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                    currentVan === 2
                      ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Van 2
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Leg Schedule Table */}
        <Card className="shadow-lg border-0 overflow-hidden bg-card max-w-6xl mx-auto mb-8">
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
                    {filteredLegs.filter(leg => leg.actualFinish).length} done
                  </div>
                  {filteredLegs.filter(leg => leg.actualStart && !leg.actualFinish).length > 0 && (
                    <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      {filteredLegs.filter(leg => leg.actualStart && !leg.actualFinish).length} running
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    {filteredLegs.length} total
                  </div>
                </div>
              </div>
              
              {/* View Toggle */}
              <div className="flex bg-muted/60 backdrop-blur-sm rounded-lg p-1">
                <Button
                  variant={viewMode === 'cards' ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('cards')}
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
                  onClick={() => setViewMode('table')}
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
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4">
                {filteredLegs.map((leg) => {
                  const runner = getDemoRunners().find(r => r.id === leg.runnerId);
                  if (!runner) return null;

                  const status = getLegStatus(leg, currentTime);
                  const runTime = status === 'finished' && leg.actualStart && leg.actualFinish ? getRunTime(leg) : null;
                  const actualPace = status === 'finished' && runTime ? calculateActualPace(leg) : null;
                  
                  return (
                    <Card
                      key={leg.id}
                      className={`group hover:shadow-md transition-all duration-200 border ${
                        status === 'running'
                          ? 'border-orange-200 bg-gradient-to-r from-orange-50/70 to-white'
                          : status === 'finished'
                          ? 'border-green-200 bg-gradient-to-r from-green-50/70 to-white'
                          : status === 'ready'
                          ? 'border-blue-200 bg-gradient-to-r from-blue-50/70 to-white'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <CardContent className="p-2 sm:p-3 md:p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0 ${
                                status === 'running'
                                  ? 'bg-orange-500'
                                  : status === 'finished'
                                  ? 'bg-green-500'
                                  : status === 'ready'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-500'
                              }`}
                            >
                              {leg.id}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-900 truncate">{runner.name}</h3>
                                  </div>
                                  <div className="text-xs text-slate-600">{leg.distance} miles</div>
                                </div>
                                {runTime && (
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-sm font-bold text-green-700">{formatDuration(runTime)}</div>
                                    {actualPace && (
                                      <div className="text-xs font-medium text-green-600">{formatPace(actualPace * 60)}/mi</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">{getStatusBadge(leg)}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-100 pt-3">
                          <div className="space-y-1">
                            <div className="text-slate-500 font-medium">Projected</div>
                            <div className="text-slate-700 font-medium">{formatTime(leg.projectedStart)}</div>
                            <div className="text-slate-500 text-xs">to {formatTime(leg.projectedFinish)}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-slate-500 font-medium">Actual</div>
                            <div className={`text-xs font-medium ${
                              leg.actualStart ? 'text-green-600' : 'text-blue-600'
                            }`}>
                              {leg.actualStart ? formatTime(leg.actualStart) : `${formatTime(leg.projectedStart)} (proj.)`}
                            </div>
                            <div className={`text-xs font-medium ${
                              leg.actualFinish ? 'text-green-600' : leg.actualStart ? 'text-blue-600' : 'text-slate-400'
                            }`}>
                              {leg.actualFinish ? formatTime(leg.actualFinish) : leg.projectedFinish ? `${formatTime(leg.projectedFinish)} (proj.)` : 'Pending'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="sm:p-3 md:p-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Leg</th>
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Runner</th>
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide hidden sm:table-cell">Distance</th>
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide hidden lg:table-cell">Projected</th>
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Actual</th>
                          <th className="text-left px-2 py-2 sm:px-3 sm:py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLegs.map((leg) => {
                          const runner = getDemoRunners().find(r => r.id === leg.runnerId);
                          if (!runner) return null;

                          const status = getLegStatus(leg, currentTime);

                          return (
                            <tr
                              key={leg.id}
                              className="hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="px-2 py-2 sm:px-3 sm:py-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                                      status === 'running'
                                        ? 'bg-orange-500'
                                        : status === 'finished'
                                        ? 'bg-green-500'
                                        : status === 'ready'
                                        ? 'bg-blue-500'
                                        : 'bg-slate-500'
                                    }`}
                                  >
                                    {leg.id}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2 sm:px-3 sm:py-3">
                                <div className="min-w-0 text-left">
                                  <div className="font-medium text-sm text-gray-900 truncate">{runner.name}</div>
                                  <div className="text-xs text-slate-600">{formatTime(leg.projectedStart)}</div>
                                </div>
                              </td>
                              <td className="px-2 py-2 sm:px-3 sm:py-3 text-sm text-slate-700 hidden sm:table-cell">{leg.distance}mi</td>
                              <td className="px-2 py-2 sm:px-3 sm:py-3 text-xs text-slate-600 hidden lg:table-cell">
                                <div>{formatTime(leg.projectedStart)}</div>
                                <div className="text-slate-500">to {formatTime(leg.projectedFinish)}</div>
                              </td>
                              <td className="px-2 py-2 sm:px-3 sm:py-3">
                                <div className="space-y-1">
                                  <div className={`text-xs font-medium ${
                                    leg.actualStart ? 'text-green-600' : 'text-blue-600'
                                  }`}>
                                    {leg.actualStart ? formatTime(leg.actualStart) : `${formatTime(leg.projectedStart)} (proj.)`}
                                  </div>
                                  <div className={`text-xs font-medium ${
                                    leg.actualFinish ? 'text-green-600' : leg.actualStart ? 'text-blue-600' : 'text-slate-400'
                                  }`}>
                                    {leg.actualFinish ? formatTime(leg.actualFinish) : leg.projectedFinish ? `${formatTime(leg.projectedFinish)} (proj.)` : 'Pending'}
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 py-2 sm:px-3 sm:py-3">
                                {getStatusBadge(leg)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Ready to track your own relay race?
          </h2>
          <p className="text-muted-foreground mb-6">
            Create a team or join an existing one to start tracking in real-time with your teammates!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => {
                setActiveTab('create');
                setIsFormVisible(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your Team
            </Button>
            <Button 
              onClick={() => {
                setActiveTab('join');
                setIsFormVisible(true);
              }}
              variant="outline"
              className="px-8 py-3 text-lg font-semibold"
            >
              <Users className="h-5 w-5 mr-2" />
              Join Existing Team
            </Button>
          </div>
                </div>
      </div>


    </div>
  );
};

export default DemoLanding;