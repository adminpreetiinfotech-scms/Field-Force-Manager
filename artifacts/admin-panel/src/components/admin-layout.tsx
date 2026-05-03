import { Link, Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Users, UserSquare2, FileText, LogOut, Building2, ShieldCheck, Bell, Map, Settings, UserPlus, UserCheck, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/staff", label: "Staff Management", icon: Users },
  { href: "/center-attendance", label: "Center Attendance", icon: UserCheck },
  { href: "/field-attendance", label: "Field Attendance", icon: ClipboardList },
  { href: "/candidates", label: "Candidates", icon: UserSquare2 },
  { href: "/live-map", label: "Live Staff Map", icon: Map },
  { href: "/notices", label: "Notices", icon: Bell },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Company Settings", icon: Settings },
];

const superAdminItems = [
  { href: "/super-admin/companies", label: "All Companies", icon: Building2 },
  { href: "/super-admin/staff", label: "All Staff", icon: Users },
  { href: "/super-admin/create-admin", label: "Create Company Admin", icon: UserPlus },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return <Redirect to="/login" />;
  }

  const isSuperAdmin = user.role === "super_admin";

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const isActive = location === href || location.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col hidden md:flex">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">NS</div>
            Nistha Skill
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Admin Portal</div>
          {isSuperAdmin && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              <ShieldCheck className="h-3 w-3" />
              Super Admin
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {isSuperAdmin && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Super Admin
                </p>
              </div>
              {superAdminItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t">
          <div className="mb-4 px-3">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.phone}</p>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          <p className="mt-3 px-3 text-[10px] text-muted-foreground/60 text-center leading-tight">
            v1.0.2 · Developed by Anil Yadav
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 border-b bg-card flex items-center px-4 md:hidden justify-between">
          <div className="font-bold text-primary flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">NS</div>
            Nistha Skill
            {isSuperAdmin && <span className="text-xs text-amber-600 font-normal">(Super Admin)</span>}
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
