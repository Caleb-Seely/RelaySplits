import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRaceStore } from '@/store/raceStore';
import { validateAndRepairLegStates } from '@/utils/dataConsistency';
import { AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';

interface DataIntegrityCheckerProps {
  className?: string;
}

export const DataIntegrityChecker: React.FC<DataIntegrityCheckerProps> = ({ className }) => {
  const { legs, runners, teamId } = useRaceStore();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<{
    repaired: boolean;
    changes: string[];
    issues: string[];
    warnings: string[];
    timestamp: number;
  } | null>(null);

  const handleCheckAndRepair = async () => {
    setIsChecking(true);
    try {
      const result = await validateAndRepairLegStates(legs, runners, teamId);
      setLastCheck({
        ...result,
        timestamp: Date.now()
      });
      
      if (result.repaired) {
        // Trigger a sync to ensure the repaired data is saved
        setTimeout(() => {
          window.location.reload(); // Simple approach - reload to ensure consistency
        }, 2000);
      }
    } catch (error) {
      console.error('Error during data integrity check:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const hasIssues = lastCheck && (lastCheck.issues.length > 0 || lastCheck.warnings.length > 0);
  const wasRepaired = lastCheck?.repaired;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Data Integrity Checker
        </CardTitle>
        <CardDescription>
          Check for and automatically repair impossible leg states and data inconsistencies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCheckAndRepair} 
          disabled={isChecking}
          className="w-full"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Check & Repair Data
            </>
          )}
        </Button>

        {lastCheck && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {wasRepaired ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : hasIssues ? (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <span className="font-medium">
                {wasRepaired ? 'Data Repaired' : hasIssues ? 'Issues Found' : 'Data Valid'}
              </span>
              <Badge variant="outline" className="ml-auto">
                {new Date(lastCheck.timestamp).toLocaleTimeString()}
              </Badge>
            </div>

            {wasRepaired && lastCheck.changes.length > 0 && (
              <Alert>
                <AlertDescription>
                  <div className="font-medium mb-2">Auto-repairs applied:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {lastCheck.changes.map((change, index) => (
                      <li key={index}>{change}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {lastCheck.issues.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Critical Issues:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {lastCheck.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {lastCheck.warnings.length > 0 && (
              <Alert>
                <AlertDescription>
                  <div className="font-medium mb-2">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {lastCheck.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasIssues && !wasRepaired && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All data integrity checks passed! No issues found.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
