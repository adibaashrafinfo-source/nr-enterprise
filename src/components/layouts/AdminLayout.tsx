import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, ChevronDown, ClipboardList, FileText, Globe, Inbox, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Settings, ShoppingCart, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/nre/Logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth, roleAtLeast } from "@/hooks/use-auth";
import { USE_MOCK } from "@/config/flags";
import { dashboardSummaryQuery } from "@/lib/queries";
import type { Role } from "@/lib/types";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

export const ADMIN_NAV: { to: string; label: string; icon: typeof Package; min: Role }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, min: "staff" },
  { to: "/admin/products", label: "Products", icon: Package, min: "staff" },
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = ADMIN_NAV.filter((item) => roleAtLeast(role, item.min));
  const userId = user?.id ?? 0;
  const summary = useQuery({ ...dashboardSummaryQuery(userId, role ?? "staff"), enabled: userId > 0 && role !== null }).data;
  const currentItem = ADMIN_NAV.find((item) => item.to === pathname);
  const pageLabel = currentItem?.label ?? pathname.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ") ?? "Admin";

  const handleLogout = async () => {
    await queryClient.cancelQueries({ queryKey: ["admin"] });
    queryClient.removeQueries({ queryKey: ["admin"] });
    try {
      await logout();
    } catch {
      toast.error("Your local session was cleared, but the server could not confirm sign out.");
    }
    await navigate({ to: "/admin/login", replace: true });
  };

  const renderNav = (mobile = false) => items.map((item) => {
    const Icon = item.icon;
    const label = role === "staff" && item.to === "/admin/purchases" ? "Pending receipts" : item.label;
    const active = item.to === "/admin" ? pathname === item.to : pathname.startsWith(item.to);
    const count = item.to === "/admin/enquiries" ? summary?.new_enquiries ?? 0 : 0;
    return (
      <Link key={item.to} to={item.to} activeOptions={{ exact: item.to === "/admin" }} onClick={() => { if (mobile) setMobileOpen(false); }}
        title={!mobile && collapsed ? label : undefined} aria-label={!mobile && collapsed ? label : undefined}
        className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent ${active ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary" : "text-sidebar-foreground"} ${!mobile && collapsed ? "justify-center" : ""}`}>
        <Icon className="size-4 shrink-0" />
        {(mobile || !collapsed) && <span className="min-w-0 flex-1 truncate">{label}</span>}
        {(mobile || !collapsed) && count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">{count}</span>}
        {!mobile && collapsed && count > 0 && <span className="absolute ml-5 -mt-5 size-2 rounded-full bg-primary" aria-label={`${count} new enquiries`} />}
      </Link>
    );
  });

  return (
    <div className="flex min-h-screen bg-muted">
      <aside className={`hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex ${collapsed ? "w-[4.5rem]" : "w-64"}`}>
        <div className={`flex min-h-16 items-center gap-3 border-b border-sidebar-border px-4 ${collapsed ? "justify-center" : ""}`}>
          <Logo variant="mark" className="size-9 shrink-0" />
          {!collapsed && <div className="min-w-0"><p className="truncate font-semibold text-sidebar-accent-foreground">NR Enterprise</p><p className="text-xs opacity-70">Admin</p></div>}
          {!collapsed && <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={() => setCollapsed(true)}><PanelLeftClose /></Button>}
        </div>
        {collapsed && <Button variant="ghost" size="icon" className="mx-auto mt-3 text-sidebar-foreground hover:bg-sidebar-accent" aria-label="Expand sidebar" title="Expand sidebar" onClick={() => setCollapsed(false)}><PanelLeftOpen /></Button>}
        <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto p-3">{renderNav()}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex min-h-16 items-center justify-between gap-3 border-b bg-background px-3 py-2 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Open admin menu" onClick={() => setMobileOpen(true)}><Menu /></Button>
            <Logo variant="mark" className="size-8 shrink-0 md:hidden" />
            {USE_MOCK && <span className="hidden shrink-0 rounded-full bg-yellow-soft px-2.5 py-1 text-xs font-semibold text-warning sm:inline-flex">Demo data</span>}
            <AdminGlobalSearch userId={userId} />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block"><span className="block max-w-40 truncate text-sm font-medium">{user?.full_name}</span><span className="text-xs capitalize text-muted-foreground">{role}</span></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Account menu" title="Account menu"><ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user?.full_name}</DropdownMenuLabel>
                <DropdownMenuLabel className="pt-0 text-xs font-normal capitalize text-muted-foreground">{role}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>Change password</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void handleLogout(); }}><LogOut className="size-4" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 border-b bg-background px-4 py-2 text-xs text-muted-foreground md:px-6">
          <Link to="/admin" className="hover:text-foreground">Dashboard</Link><span aria-hidden="true">/</span><span className="capitalize text-foreground">{pathname === "/admin" ? "Overview" : pageLabel}</span>
        </nav>
        <main className="flex-1 p-4 md:p-6"><div className="mx-auto w-full max-w-[1600px]">{children}</div></main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4"><Logo variant="mark" className="size-9" /><div><p className="font-semibold text-sidebar-accent-foreground">NR Enterprise</p><p className="text-xs opacity-70">Admin</p></div></div>
          <nav aria-label="Mobile admin" className="space-y-1 p-3">{renderNav(true)}</nav>
        </SheetContent>
      </Sheet>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
