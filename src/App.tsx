
import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TeamProvider } from "@/contexts/TeamContext";
import { ConflictResolutionProvider } from "@/contexts/ConflictResolutionContext";
import ConflictResolutionModal from "@/components/ConflictResolutionModal";
import { notificationManager } from "@/utils/notifications";
import { useSessionDurationTracking } from "@/hooks/useAnalytics";
import UpdateNotification from '@/components/UpdateNotification';
import MissingTimeConflictModal from '@/components/MissingTimeConflictModal';

// Route-level code splitting
const Index = lazy(() => import("./pages/Index"));
const LeaderboardPage = lazy(() => import("./pages/Leaderboard"));

const DemoLanding = lazy(() => import("./components/DemoLanding"));
const ViewOnlyDashboard = lazy(() => import("./components/ViewOnlyDashboard"));
const NotificationDiagnostics = lazy(() => import("./components/NotificationDiagnostics"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  const { trackSessionDuration } = useSessionDurationTracking();
  
  // Initialize notification system on app start (but don't request permission automatically)
  useEffect(() => {
    notificationManager.initialize().then((success) => {
      if (success) {
        console.log('[App] Notification system initialized successfully');
      } else {
        console.log('[App] Notification system initialization failed');
      }
    });
  }, []);
  
  // Track session duration on app unload
  useEffect(() => {
    const startTime = Date.now();
    
    const handleBeforeUnload = () => {
      const duration = Date.now() - startTime;
      trackSessionDuration(duration);
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [trackSessionDuration]);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TeamProvider>
        <ConflictResolutionProvider>
          <Toaster />
          <Sonner />
          <UpdateNotification />
          <BrowserRouter>
            <Suspense fallback={<div className="p-6">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/demo" element={<DemoLanding />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />

                <Route path="/view/:viewerCode" element={<ViewOnlyDashboard />} />
                <Route path="/notifications-test" element={<NotificationDiagnostics />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <ConflictResolutionModal />
          <MissingTimeConflictModal />
        </ConflictResolutionProvider>
      </TeamProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
