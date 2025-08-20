import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useIsMobile } from '@/hooks/use-mobile';
import AdminRecovery from './AdminRecovery';
import TimePicker from './TimePicker';
import { toast } from 'sonner';
import { 
  Settings, 
  Users, 
  RefreshCw, 
  Copy, 
  Trash2, 
  Shield, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Share2,
  Info,
  Eye,
  Undo,
  Plus,
  MoreVertical,
  X,
  ChevronLeft
} from 'lucide-react';
import { useRaceStore } from '@/store/raceStore';
import { useFeatureUsageTracking } from '@/hooks/useAnalytics';

import { triggerConfetti } from '@/utils/confetti';

interface Device {
  device_id: string;
  role: string;
  first_name: string;
  last_name: string;
  display_name: string;
  last_seen: string;
  created_at: string;
}

interface TeamSettingsProps {
  onClose?: () => void;
}

const formatLastSeen = (lastSeen: string) => {
  const now = new Date();
  const lastSeenDate = new Date(lastSeen);
  const diffMs = now.getTime() - lastSeenDate.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 5) return 'Active now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
};

const shortenInviteToken = (token: string, maxLength: number = 20) => {
  if (!token || token.length <= maxLength) return token;
  const start = Math.floor(maxLength / 2);
  const end = token.length - Math.floor(maxLength / 2);
  return `${token.substring(0, start)}...${token.substring(end)}`;
};

const TeamSettings: React.FC<TeamSettingsProps> = ({ onClose }) => {
  const { deviceInfo } = useTeam();
  const { team, refreshTeamData } = useTeamSync();
  const { 
    loading, 
    error, 
    updateTeam, 
    rotateInviteToken, 
    listDevices, 
    removeDevice 
  } = useTeamManagement();
  const { updateTeamInviteToken } = useTeamSync();
  const { undoLastStartRunner, canUndo, getUndoDescription } = useRaceStore();
  const isMobile = useIsMobile();
  const { trackConfettiTest, trackSettingsAccessed } = useFeatureUsageTracking();

  const [devices, setDevices] = useState<Device[]>([]);
  const [teamName, setTeamName] = useState(team?.name || '');
  const [startTime, setStartTime] = useState(team?.start_time || '');
  const [inviteToken, setInviteToken] = useState<string>('');
  const [showRemoveDialog, setShowRemoveDialog] = useState<Device | null>(null);
  const [showStoredAdminSecret, setShowStoredAdminSecret] = useState(false);
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);

  // Check if current device is admin
  const isAdmin = deviceInfo?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadDevices();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (team) {
      setTeamName(team.name);
      setStartTime(team.start_time);
    }
  }, [team?.name, team?.start_time]);

  const loadDevices = async () => {
    try {
      const deviceList = await listDevices();
      setDevices(deviceList);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleUpdateTeam = async () => {
    try {
      const updates: { name?: string } = {};
      if (teamName !== team?.name) updates.name = teamName;
      
      if (Object.keys(updates).length === 0) {
        return;
      }

      await updateTeam(updates);
      
      // Refresh team data to update local state
      await refreshTeamData();
      
      toast.success('Team updated successfully!');
    } catch (err) {
      console.error('Failed to update team:', err);
    }
  };

  const handleRotateInvite = async () => {
    try {
      const result = await rotateInviteToken();
      setInviteToken(result.invite_token);
      
      // Update the team context with the new invite token
      updateTeamInviteToken(result.invite_token);
      
      toast.success('Invite link rotated successfully!');
    } catch (err) {
      console.error('Failed to rotate invite:', err);
    }
  };

  const handleRemoveDevice = async (device: Device) => {
    try {
      await removeDevice(device.device_id);
      setShowRemoveDialog(null);
      toast.success(`Removed ${device.display_name} from team`);
      await loadDevices(); // Refresh device list
    } catch (err) {
      console.error('Failed to remove device:', err);
    }
  };

  const copyInviteLink = () => {
    if (team?.invite_token) {
      const teamName = team?.name || 'Team';
      const copyText = `Join ${teamName} using this token:\n ${team.invite_token}`;
      navigator.clipboard.writeText(copyText);
      toast.success('Team invite copied to clipboard!');
    }
  };

  const handleUndoStartRunner = () => {
    try {
      const undoDescription = getUndoDescription();
      undoLastStartRunner();
      toast.success(`${undoDescription || 'Action'} undone successfully!`);
    } catch (error) {
      console.error('Failed to undo action:', error);
      toast.error('Failed to undo action');
    }
  };

  const handleStartTimeSubmit = async (timestamp: number) => {
    try {
      const newStartTime = new Date(timestamp).toISOString();
      setStartTime(newStartTime);
      
      // Update the team with the new start time
      await updateTeam({ start_time: newStartTime });
      
      // Refresh team data to update local state
      await refreshTeamData();
      
      // Update the race store's start time to match the team's start time
      // Do this after refreshTeamData to ensure it's not overwritten
      const race = useRaceStore.getState();
      race.setStartTime(timestamp);
      
      toast.success('Race start time updated successfully!');
      setStartTimePickerOpen(false);
    } catch (err) {
      console.error('Failed to update start time:', err);
      toast.error('Failed to update start time');
    }
  };

  // Mobile-specific close handler
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Test confetti function for debugging
  const testConfetti = () => {
    console.log('Testing confetti');
    triggerConfetti({ particleCount: 50, spread: 50 });
    trackConfettiTest({ team_id: team?.id });
  };

  return (
    <>
      {/* Mobile-optimized content */}
      {isMobile ? (
        <div className="min-h-screen bg-gray-50">
          {/* Mobile Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 top-0 z-0">
            <div className="flex items-center justify-center">
              <h1 className="text-lg font-semibold text-gray-900">Team Settings</h1>
            </div>
          </div>

          {/* Mobile Content */}
          <div className="px-3 py-4 space-y-3">
            {/* Quick Actions - More compact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleUndoStartRunner}
                  disabled={!canUndo}
                  className="h-10 text-xs text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 disabled:text-gray-400 disabled:bg-gray-50 disabled:border-gray-200 rounded-lg font-medium"
                >
                  <Undo className="h-3 w-3 mr-1" />
                  {canUndo ? "Undo Last Start/Finish" : "No Actions"}
                </Button>
                
                <Button 
                  onClick={copyInviteLink}
                  className="h-10 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Share Token
                </Button>
              </div>
            </div>

            {/* Invite Link Section - Compact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Share2 className="h-3 w-3 text-orange-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Invite Token</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div 
                  className="group bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                  onClick={copyInviteLink}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-bold text-blue-700 tracking-wider truncate flex-1 mr-2">
                      {team?.invite_token ? shortenInviteToken(team.invite_token) : 'Loading...'}
                    </div>
                    <Copy className="h-4 w-4 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0" />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Tap to copy</p>
                </div>
                
                <Button 
                  onClick={handleRotateInvite}
                  disabled={loading}
                  variant="outline" 
                  className="w-full h-10 text-sm rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  {loading ? 'Generating...' : 'New Token'}
                </Button>
              </div>
            </div>

            {/* Team Configuration - Compact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Settings className="h-3 w-3 text-blue-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name" className="text-sm font-medium text-gray-700">Team Name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    disabled={!isAdmin}
                    className={`h-10 px-3 rounded-lg text-sm ${
                      isAdmin 
                        ? 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-gray-900' 
                        : 'border-gray-200 bg-gray-50 text-gray-900 cursor-not-allowed'
                    }`}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-gray-500">Only admins can edit</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-sm font-medium text-gray-700">Start Time</Label>
                  <Button
                    variant="outline"
                    onClick={() => setStartTimePickerOpen(true)}
                    disabled={!isAdmin}
                    className={`h-10 px-3 rounded-lg w-full justify-start text-left text-sm ${
                      isAdmin 
                        ? 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-gray-900' 
                        : 'border-gray-200 bg-gray-50 text-gray-900 cursor-not-allowed'
                    }`}
                  >
                    <Clock className="h-3 w-3 mr-2 text-gray-500" />
                    {startTime ? new Date(startTime).toLocaleDateString() + ' ' + new Date(startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Set start time'}
                  </Button>
                </div>

                <Button 
                  onClick={handleUpdateTeam}
                  disabled={loading || !isAdmin}
                  className={`w-full h-10 rounded-lg font-medium text-sm ${
                    isAdmin 
                      ? 'bg-gray-900 hover:bg-gray-800 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Updating...' : isAdmin ? 'Save Changes' : 'Admin Only'}
                </Button>
              </div>
            </div>

            {/* Team Members - Compact */}
            {isAdmin && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                        <Users className="h-3 w-3 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">Members</h2>
                        <p className="text-xs text-gray-600">{devices.length} active</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-lg p-2" onClick={loadDevices} disabled={loading}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="space-y-1">
                    {devices.map((device, index) => (
                      <div key={device.device_id} className="group">
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
                          {/* Avatar */}
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                            {device.first_name?.[0] || 'U'}{device.last_name?.[0] || ''}
                          </div>
                          
                          {/* Member Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-900 text-sm">{device.display_name}</h3>
                              {device.role === 'admin' && (
                                <Badge 
                                  variant="default" 
                                  className="px-1 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border-0"
                                >
                                  <Shield className="h-2 w-2 mr-1" />
                                  Admin
                                </Badge>
                              )}
                              {device.device_id === deviceInfo?.deviceId && (
                                <Badge className="bg-blue-100 text-blue-700 border-0 px-1 py-0.5 rounded-full text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <div className={`w-1.5 h-1.5 rounded-full ${formatLastSeen(device.last_seen) === 'Active now' ? 'bg-green-400' : 'bg-gray-300'}`} />
                              <span>{formatLastSeen(device.last_seen)}</span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {device.device_id !== deviceInfo?.deviceId && isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowRemoveDialog(device)}
                              className="opacity-70 group-hover:opacity-100 transition-opacity duration-200 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {index < devices.length - 1 && <div className="h-px bg-gray-100 mx-2" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Admin Recovery - Compact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-red-100 rounded-lg flex items-center justify-center">
                    <Shield className="h-3 w-3 text-red-600" />
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Admin Recovery</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Keep your admin secret safe as a backup way to regain access.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">Admin Secret</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStoredAdminSecret(!showStoredAdminSecret)}
                      className="text-xs rounded-lg h-7 px-2"
                    >
                      <Eye className="h-2.5 w-2.5 mr-1" />
                      {showStoredAdminSecret ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  
                  {showStoredAdminSecret && (
                    <div className="p-2 bg-gray-100 rounded-lg font-mono text-xs text-gray-700 break-all">
                      {(() => {
                        const storedSecret = localStorage.getItem('relay_admin_secret');
                        return storedSecret || 'No secret stored';
                      })()}
                    </div>
                  )}
                </div>
                
                <AdminRecovery 
                  teamId={team?.id || ''}
                  onSuccess={async (deviceId) => {
                    toast.success('Admin access recovered!');
                    await loadDevices();
                    if (team) {
                      setTeamName(team.name);
                      setStartTime(team.start_time);
                    }
                  }}
                />
              </div>
            </div>

            {/* Close Button and Test Confetti */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={testConfetti}
                className="flex-1 h-12 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              >
                🎉 Test Confetti
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 h-12 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Close Settings
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Desktop version */
        <div className="min-h-screen bg-gray-50 pb-8">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Settings</h1>
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleUndoStartRunner}
                  disabled={!canUndo}
                  className="h-12 text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 disabled:text-gray-400 disabled:bg-gray-50 disabled:border-gray-200 rounded-lg font-medium"
                >
                  <Undo className="h-4 w-4 mr-2" />
                  {canUndo ? "Undo Last Start/Finish" : "No Actions to Undo"}
                </Button>
                
                <Button 
                  onClick={copyInviteLink}
                  className="h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Invite Link
                </Button>
              </div>
            </div>

            {/* Invite Link Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Share2 className="h-4 w-4 text-orange-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Invite Token</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div 
                  className="group bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
                  onClick={copyInviteLink}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-lg font-bold text-blue-700 tracking-wider truncate flex-1 mr-3">
                      {team?.invite_token ? shortenInviteToken(team.invite_token) : 'Loading...'}
                    </div>
                    <Copy className="h-5 w-5 text-blue-600 group-hover:text-blue-700 transition-colors flex-shrink-0" />
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Tap to copy full token</p>
                </div>
                
                <Button 
                  onClick={handleRotateInvite}
                  disabled={loading}
                  variant="outline" 
                  className="w-full rounded-lg border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate New Token'}
                </Button>
              </div>
            </div>

            {/* Team Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Settings className="h-4 w-4 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Team Configuration</h2>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="team-name" className="text-sm font-medium text-gray-700">Team Name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    disabled={!isAdmin}
                    className={`h-12 px-4 rounded-lg ${
                      isAdmin 
                        ? 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-gray-900' 
                        : 'border-gray-200 bg-gray-50 text-gray-900 cursor-not-allowed'
                    }`}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-gray-500">Only admins can edit team name</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-sm font-medium text-gray-700">Race Start Time</Label>
                  <p className="text-xs text-gray-500">
                    {isAdmin ? 'Click to set start time (saves immediately)' : 'Only admins can edit start time'}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setStartTimePickerOpen(true)}
                    disabled={!isAdmin}
                    className={`h-12 px-4 rounded-lg w-full justify-start text-left ${
                      isAdmin 
                        ? 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-gray-900' 
                        : 'border-gray-200 bg-gray-50 text-gray-900 cursor-not-allowed'
                    }`}
                  >
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    {startTime ? new Date(startTime).toLocaleString() : 'Set race start time'}
                  </Button>
                </div>

                <Button 
                  onClick={handleUpdateTeam}
                  disabled={loading || !isAdmin}
                  className={`w-full h-12 rounded-lg font-medium ${
                    isAdmin 
                      ? 'bg-gray-900 hover:bg-gray-800 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Updating...' : isAdmin ? 'Save Changes' : 'Only admins can save changes'}
                </Button>
              </div>
            </div>

            {/* Team Members */}
            {isAdmin && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                        <p className="text-sm text-gray-600">{devices.length} active members</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-lg" onClick={loadDevices} disabled={loading}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-1">
                    {devices.map((device, index) => (
                      <div key={device.device_id} className="group">
                        <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-all duration-200">
                          {/* Avatar */}
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {device.first_name?.[0] || 'U'}{device.last_name?.[0] || ''}
                          </div>
                          
                          {/* Member Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{device.display_name}</h3>
                              <Badge 
                                variant={device.role === 'admin' ? 'default' : 'secondary'} 
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  device.role === 'admin' 
                                    ? 'bg-purple-100 text-purple-700 border-0' 
                                    : 'bg-gray-100 text-gray-600 border-0'
                                }`}
                              >
                                {device.role === 'admin' ? (
                                  <>
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </>
                                ) : (
                                  ''
                                )}
                              </Badge>
                              {device.device_id === deviceInfo?.deviceId && (
                                <Badge className="bg-blue-100 text-blue-700 border-0 px-2 py-1 rounded-full text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <div className={`w-2 h-2 rounded-full ${formatLastSeen(device.last_seen) === 'Active now' ? 'bg-green-400' : 'bg-gray-300'}`} />
                              <span>{formatLastSeen(device.last_seen)}</span>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          {device.device_id !== deviceInfo?.deviceId && isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowRemoveDialog(device)}
                              className="opacity-70 group-hover:opacity-100 transition-opacity duration-200 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {index < devices.length - 1 && <div className="h-px bg-gray-100 mx-3" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Admin Recovery */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <Shield className="h-4 w-4 text-red-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Admin Recovery</h2>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Keep your admin secret safe as a backup way to regain access if you lose your device.
                </p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Admin Secret</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStoredAdminSecret(!showStoredAdminSecret)}
                      className="text-xs rounded-lg"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {showStoredAdminSecret ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  
                  {showStoredAdminSecret && (
                    <div className="p-3 bg-gray-100 rounded-lg font-mono text-sm text-gray-700 break-all">
                      {(() => {
                        const storedSecret = localStorage.getItem('relay_admin_secret');
                        return storedSecret || 'No secret stored';
                      })()}
                    </div>
                  )}
                </div>
                
                <AdminRecovery 
                  teamId={team?.id || ''}
                  onSuccess={async (deviceId) => {
                    toast.success('Admin access recovered successfully!');
                    // Refresh device list and team data
                    await loadDevices();
                    // Force a re-render by updating team state
                    if (team) {
                      setTeamName(team.name);
                      setStartTime(team.start_time);
                    }
                  }}
                />
              </div>
            </div>

            {/* Close Button and Test Confetti - Desktop */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={testConfetti}
                className="flex-1 h-12 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              >
                🎉 Test Confetti
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 h-12 rounded-lg border-gray-200 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Close Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Dialog */}
      <Dialog open={!!showRemoveDialog} onOpenChange={(open) => !open && setShowRemoveDialog(null)}>
        <DialogContent className="max-w-sm mx-4 rounded-xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-semibold text-center">Remove Team Member</DialogTitle>
            <DialogDescription className="text-center text-gray-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-gray-900">{showRemoveDialog?.display_name}</strong> from the team? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowRemoveDialog(null)} 
              className="flex-1 rounded-lg border-gray-200"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (showRemoveDialog) {
                  handleRemoveDevice(showRemoveDialog);
                }
              }}
              disabled={loading}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Time Picker Modal */}
      <TimePicker
        isOpen={startTimePickerOpen}
        onClose={() => setStartTimePickerOpen(false)}
        onTimeSelect={handleStartTimeSubmit}
        title="Set Race Start Time"
        initialTime={startTime ? new Date(startTime).getTime() : undefined}
      />
    </>
  );
};

export default TeamSettings;