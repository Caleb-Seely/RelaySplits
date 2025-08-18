
import React, { Suspense, lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TeamProvider } from "@/contexts/TeamContext";
import { ConflictResolutionProvider } from "@/contexts/ConflictResolutionContext";
import ConflictResolutionModal from "@/components/ConflictResolutionModal";
import InstallPrompt from "@/components/InstallPrompt";
import { notificationManager } from "@/utils/notifications";

// Route-level code splitting
const Index = lazy(() => import("./pages/Index"));

const DemoLanding = lazy(() => import("./components/DemoLanding"));
const ViewOnlyDashboard = lazy(() => import("./components/ViewOnlyDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  // Initialize notification system on app start
  useEffect(() => {
    notificationManager.initialize().then((success) => {
      if (success) {
        console.log('[App] Notification system initialized successfully');
      } else {
        console.log('[App] Notification system initialization failed');
      }
    });
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TeamProvider>
        <ConflictResolutionProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="p-6">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/demo" element={<DemoLanding />} />

                <Route path="/view/:viewerCode" element={<ViewOnlyDashboard />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <ConflictResolutionModal />
          <InstallPrompt />
        </ConflictResolutionProvider>
      </TeamProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
