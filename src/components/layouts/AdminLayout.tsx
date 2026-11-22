import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BarChart3, Boxes, ClipboardList, FileText, Globe, Inbox, LayoutDashboard, LogOut, Package, Settings, ShoppingCart, Truck, Users } from "lucide-react";
import { Logo } from "@/components/nre/Logo";
import { Button } from "@/components/ui/button";
import { useAuth, roleAtLeast } from "@/hooks/use-auth";
import { USE_MOCK } from "@/config/flags";
import type { Role } from "@/lib/types";

export const ADMIN_NAV: { to: string; label: string; icon: typeof Package; min: Role }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, min: "staff" },
  { to: "/admin/products", label: "Products", icon: Package, min: "manager" },
  { to: "/admin/stock", label: "Stock", icon: Boxes, min: "staff" },
  { to: "/admin/orders", label: "Sales orders", icon: ClipboardList, min: "staff" },
  { to: "/admin/invoices", label: "Invoices", icon: FileText, min: "staff" },
  { to: "/admin/customers", label: "Customers", icon: Users, min: "staff" },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck, min: "manager" },
  { to: "/admin/purchases", label: "Purchases", icon: ShoppingCart, min: "staff" },
  { to: "/admin/enquiries", label: "Enquiries", icon: Inbox, min: "staff" },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, min: "manager" },
  { to: "/admin/content", label: "Website content", icon: Globe, min: "manager" },
  { to: "/admin/settings", label: "Settings & users", icon: Settings, min: "admin" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, role, logout } = useAuth();
  const items = ADMIN_NAV.filter((n) => roleAtLeast(role, n.min));
  return (
    <div className="flex min-h-screen bg-muted">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <Logo variant="mark" className="size-9" />
          <div><p className="font-semibold text-sidebar-accent-foreground">NR Enterprise</p><p className="text-xs opacity-70">Admin</p></div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/admin" }}
              className="flex items-center gap-3 rounded-full px-4 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground font-semibold hover:bg-sidebar-primary" }}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Logo variant="mark" className="size-8 md:hidden" />
            {USE_MOCK && <span className="rounded-full bg-yellow-soft px-2.5 py-0.5 text-xs font-semibold text-warning">Demo data</span>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block"><span className="block font-medium">{user?.full_name}</span><span className="text-xs capitalize text-muted-foreground">{role}</span></span>
            <Button variant="ghost" size="icon" aria-label="Log out" onClick={() => void logout()}><LogOut /></Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
