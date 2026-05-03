import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAdminPhoneGetter } from "@workspace/api-client-react";
import Login from "@/pages/login";
import CandidateRegister from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import StaffManagement from "@/pages/staff";
import Candidates from "@/pages/candidates";
import Reports from "@/pages/reports";
import Notices from "@/pages/notices";
import SuperAdminCompanies from "@/pages/super-admin-companies";
import SuperAdminCompanyDetail from "@/pages/super-admin-company-detail";
import SuperAdminStaff from "@/pages/super-admin-staff";
import SuperAdminCreateAdmin from "@/pages/super-admin-create-admin";
import CompanySettings from "@/pages/company-settings";
import LiveMap from "@/pages/live-map";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/hooks/use-auth";

setAdminPhoneGetter(() => {
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    return (JSON.parse(raw) as { phone?: string }).phone ?? null;
  } catch {
    return null;
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params) => (
        <AdminLayout>
          <Component params={params} />
        </AdminLayout>
      )}
    </Route>
  );
}

function SuperAdminRoute({ component: Component, ...rest }: any) {
  const { user } = useAuth();
  return (
    <Route {...rest}>
      {(params) => {
        if (!user || user.role !== "super_admin") {
          return (
            <AdminLayout>
              <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                <p className="text-lg font-semibold">Access Denied</p>
                <p className="text-sm text-muted-foreground">This section is only available to Super Admins.</p>
              </div>
            </AdminLayout>
          );
        }
        return (
          <AdminLayout>
            <Component params={params} />
          </AdminLayout>
        );
      }}
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={CandidateRegister} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/staff" component={StaffManagement} />
      <ProtectedRoute path="/candidates" component={Candidates} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/notices" component={Notices} />
      <ProtectedRoute path="/live-map" component={LiveMap} />
      <SuperAdminRoute path="/super-admin/companies/:id" component={({ params }: any) => (
        <SuperAdminCompanyDetail companyId={params.id} />
      )} />
      <SuperAdminRoute path="/super-admin/companies" component={SuperAdminCompanies} />
      <SuperAdminRoute path="/super-admin/staff" component={SuperAdminStaff} />
      <SuperAdminRoute path="/super-admin/create-admin" component={SuperAdminCreateAdmin} />
      <ProtectedRoute path="/settings" component={CompanySettings} />
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
