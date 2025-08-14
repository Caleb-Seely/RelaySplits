import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRaceStore } from '@/store/raceStore';
import { Runner, Leg } from '@/types/race';

export const useRealtimeUpdates = () => {
  const { upsertRunner, deleteRunner, upsertLeg, deleteLeg } = useRaceStore();

  useEffect(() => {
    const runnersChannel = supabase
      .channel('public:runners')
      .on<Runner>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'runners' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            upsertRunner(payload.new as Runner);
          } else if (payload.eventType === 'DELETE') {
            deleteRunner((payload.old as Runner).id);
          }
        }
      )
      .subscribe();

    const legsChannel = supabase
      .channel('public:legs')
      .on<Leg>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'legs' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            upsertLeg(payload.new as Leg);
          } else if (payload.eventType === 'DELETE') {
            deleteLeg((payload.old as Leg).id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(runnersChannel);
      supabase.removeChannel(legsChannel);
    };
  }, [upsertRunner, deleteRunner, upsertLeg, deleteLeg]);
};
