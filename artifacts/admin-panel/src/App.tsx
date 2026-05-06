import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAdminPhoneGetter, ApiError } from "@workspace/api-client-react";
import { logoutUser } from "@/hooks/use-auth";
import Login from "@/pages/login";
import CandidateRegister from "@/pages/register";
import CompanyRegister from "@/pages/company-register";
import Dashboard from "@/pages/dashboard";
import StaffManagement from "@/pages/staff";
import Candidates from "@/pages/candidates";
import Reports from "@/pages/reports";
import Notices from "@/pages/notices";
import SuperAdminCompanies from "@/pages/super-admin-companies";
import SuperAdminCompanyDetail from "@/pages/super-admin-company-detail";
import SuperAdminStaff from "@/pages/super-admin-staff";
import SuperAdminCreateAdmin from "@/pages/super-admin-create-admin";
import SuperAdminSubscriptions from "@/pages/super-admin-subscriptions";
import SuperAdminProfile from "@/pages/super-admin-profile";
import CompanySettings from "@/pages/company-settings";
import TrainingCenters from "@/pages/training-centers";
import LiveMap from "@/pages/live-map";
import CenterAttendance from "@/pages/center-attendance";
import FieldAttendance from "@/pages/field-attendance";
import AttendanceControl from "@/pages/attendance-control";
import Leaves from "@/pages/leaves";
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

function handle401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    logoutUser();
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 1;
      },
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
      <Route path="/company-register" component={CompanyRegister} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/staff" component={StaffManagement} />
      <ProtectedRoute path="/candidates" component={Candidates} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/notices" component={Notices} />
      <ProtectedRoute path="/live-map" component={LiveMap} />
      <ProtectedRoute path="/center-attendance" component={CenterAttendance} />
      <ProtectedRoute path="/field-attendance" component={FieldAttendance} />
      <ProtectedRoute path="/attendance-control" component={AttendanceControl} />
      <ProtectedRoute path="/leaves" component={Leaves} />
      <SuperAdminRoute path="/super-admin/companies/:id" component={({ params }: any) => (
        <SuperAdminCompanyDetail companyId={params.id} />
      )} />
      <SuperAdminRoute path="/super-admin/companies" component={SuperAdminCompanies} />
      <SuperAdminRoute path="/super-admin/subscriptions" component={SuperAdminSubscriptions} />
      <SuperAdminRoute path="/super-admin/staff" component={SuperAdminStaff} />
      <SuperAdminRoute path="/super-admin/create-admin" component={SuperAdminCreateAdmin} />
      <SuperAdminRoute path="/super-admin/profile" component={SuperAdminProfile} />
      <ProtectedRoute path="/training-centers" component={TrainingCenters} />
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
