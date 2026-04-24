import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLockGate } from "@/components/AppLockGate";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Associations from "./pages/Associations.tsx";
import NewAssociation from "./pages/NewAssociation.tsx";
import AssociationDetail from "./pages/AssociationDetail.tsx";
import AssociationSettings from "./pages/AssociationSettings.tsx";
import PayInstallment from "./pages/PayInstallment.tsx";
import ScanRouter from "./pages/ScanRouter.tsx";
import History from "./pages/History.tsx";
import Identity from "./pages/Identity.tsx";
import Settings from "./pages/Settings.tsx";
import ConfirmCode from "./pages/ConfirmCode.tsx";
import EnterCode from "./pages/EnterCode.tsx";
import NotificationsPending from "./pages/NotificationsPending.tsx";
import { runLocalMaintenance } from "./lib/maintenance";

const queryClient = new QueryClient();

function AppContent() {
  useEffect(() => {
    runLocalMaintenance();
    const timer = window.setInterval(() => {
      runLocalMaintenance();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/associations" element={<Associations />} />
        <Route path="/associations/new" element={<NewAssociation />} />
        <Route path="/associations/:id" element={<AssociationDetail />} />
        <Route path="/associations/:id/settings" element={<AssociationSettings />} />
        <Route path="/pay/:id" element={<PayInstallment />} />
        <Route path="/scan" element={<ScanRouter />} />
        <Route path="/confirm-code" element={<ConfirmCode />} />
        <Route path="/enter-code" element={<EnterCode />} />
        <Route path="/notifications" element={<NotificationsPending />} />
        <Route path="/history" element={<History />} />
        <Route path="/identity" element={<Identity />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppLockGate>
        <AppContent />
      </AppLockGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
