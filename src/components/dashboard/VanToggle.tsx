import React from 'react';
import { Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface VanToggleProps {
  currentVan: number;
  onVanChange: (van: number) => void;
}

const VanToggle: React.FC<VanToggleProps> = ({ currentVan, onVanChange }) => {
  return (
    <div className="flex justify-center">
      <Card className="bg-card shadow-lg border-border p-2">
        <div className="relative overflow-hidden bg-muted/70 rounded-lg p-1 border border-border">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-purple-500/15" />
          <div className="relative flex">
            <Button
              variant={currentVan === 1 ? "default" : "ghost"}
              size="lg"
              onClick={() => onVanChange(1)}
              className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                currentVan === 1
                  ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Van 1
            </Button>
            <Button
              variant={currentVan === 2 ? "default" : "ghost"}
              size="lg"
              onClick={() => onVanChange(2)}
              className={`relative px-6 py-2 font-semibold transition-all duration-200 ${
                currentVan === 2
                  ? 'bg-primary text-primary-foreground shadow-lg transform scale-105'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              <Users className="h-4 w-4 mr-2" />
              Van 2
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VanToggle;
