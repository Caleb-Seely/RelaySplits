import React, { useState, useEffect } from 'react';
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
import AdminRecovery from './AdminRecovery';
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
  Eye
} from 'lucide-react';

interface Device {
  device_id: string;
  role: string;
  first_name: string;
  last_name: string;
  display_name: string;
  last_seen: string;
  created_at: string;
}

const TeamSettings: React.FC = () => {
  const { deviceInfo } = useTeam();
  const { team } = useTeamSync();
  const { 
    loading, 
    error, 
    updateTeam, 
    rotateInviteToken, 
    listDevices, 
    removeDevice 
  } = useTeamManagement();
  const { updateTeamInviteToken } = useTeamSync();

  const [devices, setDevices] = useState<Device[]>([]);
  const [teamName, setTeamName] = useState(team?.name || '');
  const [startTime, setStartTime] = useState(team?.start_time || '');
  const [inviteToken, setInviteToken] = useState<string>('');
  const [showRemoveDialog, setShowRemoveDialog] = useState<Device | null>(null);
  const [showStoredAdminSecret, setShowStoredAdminSecret] = useState(false);

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
  }, [team]);

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
      const updates: any = {};
      if (teamName !== team?.name) updates.name = teamName;
      if (startTime !== team?.start_time) updates.start_time = startTime;
      
      if (Object.keys(updates).length === 0) {
        return;
      }

      await updateTeam(updates);
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
    if (inviteToken) {
      const inviteUrl = `${window.location.origin}/join?token=${inviteToken}`;
      navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard!');
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">

        {/* Admin Recovery for Non-Admin Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Recovery
            </CardTitle>
            <CardDescription>
              If you've lost access to your admin device, you can recover admin access using your admin secret.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminRecovery 
              teamId={team?.id || ''}
              onSuccess={async (deviceId) => {
                // Refresh the page to update the UI since we're switching from non-admin to admin
                window.location.reload();
              }}
            />
          </CardContent>
        </Card>

        {/* Team Information (Read-only for non-admins) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Team Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <div className="p-3 bg-muted rounded-md">
                {team?.name || 'Loading...'}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Race Start Time</Label>
              <div className="p-3 bg-muted rounded-md">
                {team?.start_time ? new Date(team.start_time).toLocaleString() : 'Loading...'}
              </div>
            </div>
          </CardContent>
        </Card>


      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Team Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Team Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="start-time">Race Start Time</Label>
            <Input
              id="start-time"
              type="datetime-local"
              value={startTime ? new Date(startTime).toISOString().slice(0, 16) : ''}
              onChange={(e) => setStartTime(new Date(e.target.value).toISOString())}
            />
          </div>

          <Button 
            onClick={handleUpdateTeam} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Updating...' : 'Update Team'}
          </Button>
        </CardContent>
      </Card>

      {/* Invite Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Invite Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this invite link with people who want to join your team. Only admins can generate new invite links.
          </p>
          
          {/* Current Invite Token - Show for everyone */}
          {team?.invite_token && (
            <div className="space-y-3">
              <div 
                className="bg-primary/10 border border-primary/20 rounded-lg px-3 sm:px-4 py-3 font-mono font-bold text-primary text-sm sm:text-lg tracking-wider cursor-pointer hover:bg-primary/20 transition-colors relative"
                onClick={() => {
                  const inviteUrl = `${window.location.origin}/join?token=${team.invite_token}`;
                  navigator.clipboard.writeText(inviteUrl);
                  toast.success('Invite link copied to clipboard!');
                }}
                title="Click to copy invite link"
              >
                <div className="flex items-center justify-between">
                  <span className="break-all">{team.invite_token}</span>
                  <Copy className="h-4 w-4 text-primary/70 hover:text-primary transition-colors ml-2 sm:ml-3 flex-shrink-0" />
                </div>
              </div>
              
            </div>
          )}
          
          {/* Rotate button - Only for admins */}
          {isAdmin && (
            <div className="pt-2 border-t">
              <Button 
                onClick={handleRotateInvite} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New Invite Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>



      {/* Admin Recovery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Recovery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you lose access to your admin device, you can recover access using your admin secret.
              Keep this secret safe - it's your backup way to regain admin access.
            </p>
            
            {/* Show stored admin secret if available */}
            {(() => {
              const storedSecret = localStorage.getItem('relay_admin_secret');
              return storedSecret ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Your Admin Secret</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStoredAdminSecret(!showStoredAdminSecret)}
                    >
                      {showStoredAdminSecret ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                  {showStoredAdminSecret && (
                    <div className="p-3 bg-gray-100 rounded-md font-mono text-sm">
                      {storedSecret}
                    </div>
                  )}
                </div>
              ) : null;
            })()}
            
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
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({devices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.device_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{device.display_name}</span>
                    <Badge variant={device.role === 'admin' ? 'default' : 'secondary'} className="flex-shrink-0">
                      {device.role === 'admin' ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        'Member'
                      )}
                    </Badge>
                    {device.device_id === deviceInfo?.deviceId && (
                      <Badge variant="outline" className="flex-shrink-0">You</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1 truncate">
                    {device.first_name} {device.last_name}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Last seen: {formatLastSeen(device.last_seen)}</span>
                  </div>
                </div>
                
                {device.device_id !== deviceInfo?.deviceId && (
                  <Dialog open={showRemoveDialog?.device_id === device.device_id} onOpenChange={(open) => !open && setShowRemoveDialog(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRemoveDialog(device)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Remove Team Member</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to remove <strong>{device.display_name}</strong> from the team? 
                          This action cannot be undone and they will lose access to all team data.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={() => setShowRemoveDialog(null)} className="w-full sm:w-auto">
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => handleRemoveDevice(device)}
                          disabled={loading}
                          className="w-full sm:w-auto"
                        >
                          {loading ? 'Removing...' : 'Remove Member'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ))}
            
            {devices.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members found</p>
                <Button 
                  onClick={loadDevices} 
                  variant="outline" 
                  className="mt-2"
                  disabled={loading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamSettings;
