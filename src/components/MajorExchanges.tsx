
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRaceStore } from '@/store/raceStore';
import { getMajorExchangeTimes, formatRaceTime } from '@/utils/raceUtils';
import { getLegDirectionsUrl } from '@/utils/legData';
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
            <div 
              key={legId} 
              className="text-center p-2 bg-blue-50 rounded border cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => {
                const directionsUrl = getLegDirectionsUrl(legId);
                window.open(directionsUrl, '_blank');
              }}
            >
              <div className="text-xs font-medium text-blue-900 mb-1">
                {exchangeNames[legId as keyof typeof exchangeNames]}
              </div>
              <div className={`relative inline-flex items-center justify-center text-sm font-bold ${actualFinish ? 'text-green-600' : 'text-orange-600'}`}>
                <span>{formatRaceTime(actualFinish || projectedFinish)}</span>
                {actualFinish && (
                  <Badge className="absolute left-full ml-2 bg-green-100 text-green-800 border border-green-200 text-[10px] px-1 py-0.5 leading-none">✓</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MajorExchanges;
