import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import StockMaster from "@/pages/master-data";
import Production from "@/pages/production";
import Dispatch from "@/pages/dispatch";
import StockRegister from "@/pages/stock-register";
import StockLedger from "@/pages/opening-stock";
import Reports from "@/pages/reports";
import AuditLogs from "@/pages/audit-logs";
import Users from "@/pages/users";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route path="/master-data">
        <AuthGuard>
          <StockMaster />
        </AuthGuard>
      </Route>
      <Route path="/production">
        <AuthGuard>
          <Production />
        </AuthGuard>
      </Route>
      <Route path="/dispatch">
        <AuthGuard>
          <Dispatch />
        </AuthGuard>
      </Route>
      <Route path="/stock-register">
        <AuthGuard>
          <StockRegister />
        </AuthGuard>
      </Route>
      <Route path="/opening-stock">
        <AuthGuard>
          <StockLedger />
        </AuthGuard>
      </Route>
      <Route path="/reports">
        <AuthGuard>
          <Reports />
        </AuthGuard>
      </Route>
      <Route path="/audit-logs">
        <AuthGuard adminOnly>
          <AuditLogs />
        </AuthGuard>
      </Route>
      <Route path="/users">
        <AuthGuard adminOnly>
          <Users />
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard>
          <Settings />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="dsms-theme">
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppLayout>
                <Router />
              </AppLayout>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
