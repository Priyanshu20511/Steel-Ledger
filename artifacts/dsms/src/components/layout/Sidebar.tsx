import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  Factory,
  Truck,
  Table,
  BookOpen,
  BarChart3,
  History,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isAdmin = user?.role === "admin";
  const isProduction = user?.role === "production";
  const isDispatch = user?.role === "dispatch";
  const isViewer = user?.role === "viewer";

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, show: true },
    { name: "Stock Master", href: "/stock-master", icon: Package, show: true },
    {
      name: "Opening Stock",
      href: "/opening-stock",
      icon: BookOpen,
      show: true,
    },
    {
      name: "Production",
      href: "/production",
      icon: Factory,
      show: !isDispatch && !isViewer,
    },
    {
      name: "Dispatch",
      href: "/dispatch",
      icon: Truck,
      show: !isProduction && !isViewer,
    },
    {
      name: "Stock Register",
      href: "/stock-register",
      icon: Table,
      show: true,
    },
    { name: "Reports", href: "/reports", icon: BarChart3, show: true },
    { name: "Audit Logs", href: "/audit-logs", icon: History, show: isAdmin },
    { name: "Users", href: "/users", icon: Users, show: isAdmin },
    { name: "Settings", href: "/settings", icon: Settings, show: true },
  ];

  return (
    <div className="w-64 border-r border-border bg-sidebar flex-shrink-0 hidden md:flex flex-col">
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-3">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
        </nav>
      </ScrollArea>
    </div>
  );
}
