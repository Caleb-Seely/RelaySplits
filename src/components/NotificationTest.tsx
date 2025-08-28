import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { eventBus, EVENT_TYPES } from '@/utils/eventBus';

const NotificationTest: React.FC = () => {
  const simulateFirstLegStart = () => {
    console.log('[NotificationTest] Simulating first leg start...');
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: 1,
        field: 'start',
        value: Date.now(),
        previousValue: null,
        runnerId: 1,
        timestamp: Date.now(),
        source: 'test'
      },
      priority: 'high',
      source: 'test'
    });
  };

  const simulateLegFinish = (legId: number) => {
    console.log(`[NotificationTest] Simulating leg ${legId} finish...`);
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: legId,
        field: 'finish',
        value: Date.now(),
        previousValue: null,
        runnerId: legId,
        timestamp: Date.now(),
        source: 'test'
      },
      priority: 'high',
      source: 'test'
    });
  };

  const simulateFinalLegFinish = () => {
    console.log('[NotificationTest] Simulating final leg finish...');
    eventBus.publish({
      type: EVENT_TYPES.LEG_UPDATE,
      payload: {
        legId: 36,
        field: 'finish',
        value: Date.now(),
        previousValue: null,
        runnerId: 36,
        timestamp: Date.now(),
        source: 'test'
      },
      priority: 'high',
      source: 'test'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Test</CardTitle>
        <CardDescription>
          Simulate leg updates to test notification system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={simulateFirstLegStart} variant="default">
            Simulate First Leg Start
          </Button>
          <Button onClick={() => simulateLegFinish(5)} variant="outline">
            Simulate Leg 5 Finish
          </Button>
          <Button onClick={() => simulateLegFinish(10)} variant="outline">
            Simulate Leg 10 Finish
          </Button>
          <Button onClick={simulateFinalLegFinish} variant="outline">
            Simulate Final Leg Finish
          </Button>
        </div>
        <div className="text-sm text-gray-600">
          <p>Check the browser console for detailed logs about notification processing.</p>
          <p>Make sure notifications are enabled in your browser settings.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationTest;
