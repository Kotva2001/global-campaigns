import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./components/AppLayout";
import { LoginGate } from "./components/LoginGate";
import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";
import Creators from "./pages/Creators";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Products from "./pages/Products";
import NotFound from "./pages/NotFound.tsx";
import RedirectPage from "./pages/RedirectPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/go" element={<RedirectPage />} />
          <Route
            path="*"
            element={
              <LoginGate>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/creators" element={<Creators />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/scanner" element={<Scanner />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </LoginGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
