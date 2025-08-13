
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';

interface TeamSetupProps {
  onTeamReady: (action: 'create' | 'join') => void;
  createTeam: (name: string, startTime: Date) => Promise<{ success?: boolean; error?: string }>;
  joinTeam: (teamId: string) => Promise<{ success?: boolean; error?: string }>;
  loading: boolean;
}

const TeamSetup: React.FC<TeamSetupProps> = ({ onTeamReady, createTeam, joinTeam, loading }) => {
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [startTime, setStartTime] = useState<Dayjs | null>(null);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamName || !startTime) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const result = await createTeam(teamName, startTime.toDate());
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Team created successfully!');
      onTeamReady('create');
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamId) {
      toast.error('Please enter a team ID');
      return;
    }
    
    const result = await joinTeam(teamId);
    
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Joined team successfully!');
      onTeamReady('join');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Team Setup</CardTitle>
          <CardDescription className="text-center">
            Create a new team or join an existing one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="join" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="join">Join Team</TabsTrigger>
              <TabsTrigger value="create">Create Team</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Team Name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />
                  <div className="space-y-1">
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                      <DateTimePicker
                        label="Race Start Time"
                        value={startTime}
                        onChange={(newValue) => setStartTime(newValue)}
                        slotProps={{ textField: { fullWidth: true, size: 'small', required: true } }}
                      />
                    </LocalizationProvider>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating Team...' : 'Create Team'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="join">
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Team ID"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Joining Team...' : 'Join Team'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamSetup;
