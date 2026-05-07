import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import CompaniesPage from "@/pages/companies";
import CompaniesNewPage from "@/pages/companies-new";
import CompanyDetailPage from "@/pages/company-detail";
import PendingPage from "@/pages/pending";
import StaffPage from "@/pages/staff";
import ProfilePage from "@/pages/profile";
import SubscriptionsPage from "@/pages/subscriptions";
import AnalyticsPage from "@/pages/analytics";
import NoticesPage from "@/pages/notices";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const phone = localStorage.getItem("sa_phone");
  if (!phone) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        {() => <AuthGuard><Layout><DashboardPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/companies/new">
        {() => <AuthGuard><Layout><CompaniesNewPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/companies/:id">
        {(params) => <AuthGuard><Layout><CompanyDetailPage id={params.id} /></Layout></AuthGuard>}
      </Route>
      <Route path="/companies">
        {() => <AuthGuard><Layout><CompaniesPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/pending">
        {() => <AuthGuard><Layout><PendingPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/subscriptions">
        {() => <AuthGuard><Layout><SubscriptionsPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/analytics">
        {() => <AuthGuard><Layout><AnalyticsPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/notices">
        {() => <AuthGuard><Layout><NoticesPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/audit-logs">
        {() => <AuthGuard><Layout><AuditLogsPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/settings">
        {() => <AuthGuard><Layout><SettingsPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/staff">
        {() => <AuthGuard><Layout><StaffPage /></Layout></AuthGuard>}
      </Route>
      <Route path="/profile">
        {() => <AuthGuard><Layout><ProfilePage /></Layout></AuthGuard>}
      </Route>
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
