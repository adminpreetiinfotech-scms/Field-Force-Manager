import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAdminPhoneGetter } from "@workspace/api-client-react";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import StaffManagement from "@/pages/staff";
import Candidates from "@/pages/candidates";
import Reports from "@/pages/reports";
import { AdminLayout } from "@/components/admin-layout";

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
      refetchOnWindowFocus: false,
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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => {
        window.location.replace(import.meta.env.BASE_URL + "dashboard");
        return null;
      }} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/staff" component={StaffManagement} />
      <ProtectedRoute path="/candidates" component={Candidates} />
      <ProtectedRoute path="/reports" component={Reports} />
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
