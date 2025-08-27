import React, { useState } from 'react';
import { toast } from 'sonner';
import { Shield, AlertTriangle, CheckCircle, Key } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useTeam } from '@/contexts/TeamContext';
import { useTeamSync } from '@/hooks/useTeamSync';

interface AdminRecoveryProps {
  teamId: string;
  onSuccess?: (deviceId: string) => void;
}

const AdminRecovery: React.FC<AdminRecoveryProps> = ({ teamId, onSuccess }) => {
  const { adminRecovery, loading, error } = useTeamManagement();
  const { setDeviceInfo } = useTeam();
  const { refreshTeamData } = useTeamSync();
  
  const [isOpen, setIsOpen] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminSecret.trim() || !firstName.trim() || !lastName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const result = await adminRecovery(adminSecret.trim(), {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: `${firstName.trim()} ${lastName.trim()}`
      });

      if (result.success) {
        // Update local device info
        const newDeviceInfo = {
          deviceId: result.deviceId,
          teamId,
          role: 'admin',
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`
        };

        localStorage.setItem('relay_device_info', JSON.stringify(newDeviceInfo));
        localStorage.setItem('relay_device_id', result.deviceId);
        // Store the admin secret for future recovery (use the validated user input)
        localStorage.setItem('relay_admin_secret', adminSecret.trim());
        setDeviceInfo(newDeviceInfo);

        // Wait a bit for the context to update, then refresh team data
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[AdminRecovery] About to refresh team data');
        await refreshTeamData();

        setSuccessMessage('Admin access recovered successfully!');
        toast.success('Admin access recovered successfully!');
        
        // Close dialog after a short delay
        setTimeout(() => {
          setIsOpen(false);
          setSuccessMessage('');
          setAdminSecret('');
          setFirstName('');
          setLastName('');
          onSuccess?.(result.deviceId);
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to recover admin access');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-orange-600 hover:text-orange-700">
          <Shield className="h-4 w-4 mr-2" />
          Admin Recovery
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Recovery
          </DialogTitle>
          <DialogDescription>
            If you've lost access to your admin device, you can recover access using your admin secret.
            This will create a new admin device for your team.
          </DialogDescription>
        </DialogHeader>

        {successMessage ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleRecovery} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-secret">Admin Secret</Label>
              <Input
                id="admin-secret"
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Enter your admin secret"
                required
              />
              <p className="text-xs text-muted-foreground">
                This is the secret code you received when creating the team.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Your first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Your last name"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Recovering...' : 'Recover Access'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminRecovery;
