import { Link, Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard, Users, UserSquare2, FileText, LogOut, Building2, ShieldCheck,
  Bell, Map, Settings, UserPlus, UserCheck, ClipboardList, CreditCard, UserCog,
  GraduationCap, SlidersHorizontal, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard",           label: "Dashboard",           icon: LayoutDashboard,  color: "text-cyan-400" },
  { href: "/staff",               label: "Staff Management",    icon: Users,             color: "text-violet-400" },
  { href: "/training-centers",    label: "Training Centers",    icon: Building2,         color: "text-emerald-400" },
  { href: "/center-attendance",   label: "Center Attendance",   icon: UserCheck,         color: "text-sky-400" },
  { href: "/field-attendance",    label: "Field Attendance",    icon: ClipboardList,     color: "text-indigo-400" },
  { href: "/attendance-control",  label: "Attendance Control",  icon: SlidersHorizontal, color: "text-purple-400" },
  { href: "/candidates",          label: "Candidates",          icon: UserSquare2,       color: "text-pink-400" },
  { href: "/live-map",            label: "Live Staff Map",      icon: Map,               color: "text-orange-400" },
  { href: "/leaves",              label: "Leave Requests",      icon: CalendarDays,      color: "text-green-400" },
  { href: "/notices",             label: "Notices",             icon: Bell,              color: "text-yellow-400" },
  { href: "/reports",             label: "Reports",             icon: FileText,          color: "text-teal-400" },
  { href: "/settings",            label: "Company Settings",    icon: Settings,          color: "text-slate-400" },
];

const superAdminItems = [
  { href: "/super-admin/companies",     label: "All Companies",       icon: Building2,  color: "text-cyan-400" },
  { href: "/super-admin/subscriptions", label: "Subscription Plans",  icon: CreditCard, color: "text-emerald-400" },
  { href: "/super-admin/staff",         label: "All Staff",           icon: Users,      color: "text-violet-400" },
  { href: "/super-admin/create-admin",  label: "Create Company Admin",icon: UserPlus,   color: "text-orange-400" },
  { href: "/super-admin/profile",       label: "My Profile",          icon: UserCog,    color: "text-sky-400" },
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

  const NavLink = ({
    href, label, icon: Icon, color,
  }: { href: string; label: string; icon: React.ElementType; color: string }) => {
    const isActive = location === href || location.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-white/10 text-white shadow-sm border border-white/10"
            : "text-slate-400 hover:bg-white/6 hover:text-slate-200"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? color : ""}`} />
        {label}
        {isActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col hidden md:flex shrink-0"
        style={{
          background: "linear-gradient(180deg, hsl(222,60%,12%) 0%, hsl(224,55%,10%) 100%)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Logo / Brand */}
        <div className="p-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
              }}
            >
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white leading-tight truncate">
                {user.companyName ? user.companyName : "SCMS"}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                Skill Center Management
              </div>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
            >
              <ShieldCheck className="h-3 w-3" />
              Super Admin
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}

          {isSuperAdmin && (
            <>
              <div className="pt-5 pb-2 px-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Super Admin
                </p>
              </div>
              {superAdminItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #06b6d4, #6366f1)", color: "#fff" }}
            >
              {(user.name ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{user.phone}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors font-medium"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
          <p className="mt-2 text-[10px] text-slate-600 text-center">
            v1.0.2 · Developed by Anil Yadav
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header
          className="h-14 flex items-center px-4 md:hidden justify-between"
          style={{
            background: "linear-gradient(90deg, hsl(222,60%,12%) 0%, hsl(224,55%,10%) 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #6366f1)" }}
            >
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">
              {user.companyName ? user.companyName : "SCMS"}
            </span>
            {isSuperAdmin && (
              <span className="text-xs text-amber-400 font-normal">(Super Admin)</span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
