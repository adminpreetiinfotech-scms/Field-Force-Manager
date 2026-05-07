import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Clock, 
  UserCircle,
  LogOut,
  CreditCard,
  BarChart2,
  Bell,
  Activity,
  Settings,
  AlarmClock
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("sa_phone");
    setLocation("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/companies", label: "Companies", icon: Building2 },
    { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
    { href: "/reminders", label: "Sub. Reminders", icon: AlarmClock },
    { href: "/pending", label: "Pending Approvals", icon: Clock },
    { href: "/staff", label: "Staff Directory", icon: Users },
    { href: "/notices", label: "Notices", icon: Bell },
    { href: "/audit-logs", label: "Audit Logs", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/profile", label: "My Profile", icon: UserCircle },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col hidden md:flex">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="font-bold text-lg text-sidebar-foreground tracking-tight">SCMS Ops</div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href || location.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
