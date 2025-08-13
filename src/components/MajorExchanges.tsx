
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRaceStore } from '@/store/raceStore';
import { getMajorExchangeTimes, formatTime } from '@/utils/raceUtils';
import { MapPin } from 'lucide-react';

const MajorExchanges = () => {
  const { legs } = useRaceStore();
  
  const majorExchanges = getMajorExchangeTimes(legs);
  
  const exchangeNames = {
    6: 'Van Switch 1',
    12: 'Van Switch 2', 
    18: 'Van Switch 3',
    24: 'Van Switch 4',
    30: 'Van Switch 5',
    36: 'FINISH'
  };

  return (
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
            <div key={legId} className="text-center p-2 bg-blue-50 rounded border">
              <div className="text-xs font-medium text-blue-900 mb-1">
                {exchangeNames[legId as keyof typeof exchangeNames]}
              </div>
              <div className="text-sm font-bold text-orange-600">
                {formatTime(actualFinish || projectedFinish)}
              </div>
              {actualFinish && (
                <Badge className="status-finished text-xs mt-1">✓</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MajorExchanges;
