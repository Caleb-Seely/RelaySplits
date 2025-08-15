import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamSync } from '@/hooks/useTeamSync';
import { useTeam } from '@/contexts/TeamContext';
import { toast } from 'sonner';
import { useRaceStore } from '@/store/raceStore';
import AdminSecretDisplay from './AdminSecretDisplay';

const TeamOnboarding = () => {
  const { createTeam, joinTeam, loading } = useTeamSync();
  const { setDeviceInfo } = useTeam();
  const [activeTab, setActiveTab] = useState('join');
  const navigate = useNavigate();

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [createdTeamName, setCreatedTeamName] = useState('');

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim() || !teamName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const result = await createTeam(
      teamName.trim(),
      firstName.trim(),
      lastName.trim()
    );

    if (result.success) {
      // Show admin secret dialog
      setAdminSecret(result.adminSecret);
      setCreatedTeamName(teamName.trim());
      setShowAdminSecret(true);
    } else {
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
      // After joining, go straight to Dashboard
      try {
        useRaceStore.getState().completeSetup();
      } catch (_) {
        // no-op if store shape changes
      }
      navigate('/');
    } else {
      toast.error(result.error || 'Failed to join team');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">TeamSplits</CardTitle>
          <CardDescription>
            Track your relay real-time with your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="join">Join Team</TabsTrigger>
              <TabsTrigger value="create">Create Team</TabsTrigger>
            </TabsList>
            
            <TabsContent value="join" className="space-y-4">
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="join-firstName">First Name</Label>
                  <Input
                    id="join-firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="join-lastName">Last Name</Label>
                  <Input
                    id="join-lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inviteToken">Invite Link or Code</Label>
                  <Input
                    id="inviteToken"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Paste invite link or enter code"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Joining...' : 'Join Team'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="create" className="space-y-4">
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-firstName">First Name</Label>
                  <Input
                    id="create-firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-lastName">Last Name</Label>
                  <Input
                    id="create-lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Team'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Admin Secret Display Dialog */}
      {showAdminSecret && (
        <AdminSecretDisplay
          adminSecret={adminSecret}
          teamName={createdTeamName}
          onClose={() => {
            setShowAdminSecret(false);
            // Mark this as a new team so Index will show Setup Wizard with isNewTeam
            localStorage.setItem('relay_is_new_team', '1');
            navigate('/');
          }}
        />
      )}
    </div>
  );
};

export default TeamOnboarding;
