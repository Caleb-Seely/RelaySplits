import { useState } from 'react';
import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';
import { useTeam } from '@/contexts/TeamContext';

interface Device {
  device_id: string;
  role: string;
  first_name: string;
  last_name: string;
  display_name: string;
  last_seen: string;
  created_at: string;
}

interface UpdateTeamData {
  name?: string;
  start_time?: string;
}

export const useTeamManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { deviceInfo } = useTeam();

  const updateTeam = async (updates: UpdateTeamData) => {
    if (!deviceInfo?.teamId) {
      throw new Error('No team found');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invokeEdge('teams-update', {
        teamId: deviceInfo.teamId,
        deviceId: getDeviceId(),
        ...updates
      });

      if ('error' in result) {
        throw new Error(result.error.message || 'Failed to update team');
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const rotateInviteToken = async () => {
    if (!deviceInfo?.teamId) {
      throw new Error('No team found');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invokeEdge('teams-rotate-invite', {
        teamId: deviceInfo.teamId,
        deviceId: getDeviceId()
      });

      if ('error' in result) {
        throw new Error(result.error.message || 'Failed to rotate invite token');
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listDevices = async (): Promise<Device[]> => {
    if (!deviceInfo?.teamId) {
      throw new Error('No team found');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invokeEdge('devices-list', {
        teamId: deviceInfo.teamId,
        deviceId: getDeviceId()
      });

      if ('error' in result) {
        throw new Error(result.error.message || 'Failed to list devices');
      }

      return result.data.devices || [];
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeDevice = async (targetDeviceId: string) => {
    if (!deviceInfo?.teamId) {
      throw new Error('No team found');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invokeEdge('devices-remove', {
        teamId: deviceInfo.teamId,
        deviceId: getDeviceId(),
        target_device_id: targetDeviceId
      });

      if ('error' in result) {
        throw new Error(result.error.message || 'Failed to remove device');
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const adminRecovery = async (adminSecret: string, deviceProfile: {
    first_name?: string;
    last_name?: string;
    display_name?: string;
  }): Promise<{
    success: boolean;
    deviceId: string;
  }> => {
    if (!deviceInfo?.teamId) {
      throw new Error('No team found');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await invokeEdge('admin-recovery', {
        teamId: deviceInfo.teamId,
        admin_secret: adminSecret,
        device_profile: deviceProfile
      });

      if ('error' in result) {
        throw new Error(result.error.message || 'Failed to perform admin recovery');
      }

      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    updateTeam,
    rotateInviteToken,
    listDevices,
    removeDevice,
    adminRecovery
  };
};
